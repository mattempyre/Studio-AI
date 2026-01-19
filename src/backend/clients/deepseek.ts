/**
 * Deepseek API Client for Script Generation
 * STORY-005: Deepseek API Client Integration
 *
 * Provides script generation from topics with structured output (sections/sentences),
 * search grounding option, and duration targeting.
 */

import { config } from 'dotenv';

config();

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface DeepseekClientOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxRetries?: number;
  retryDelay?: number;
}

export interface ScriptGenerationOptions {
  topic: string;
  targetDurationMinutes: number;
  visualStyle?: string;
  useSearchGrounding?: boolean;
  additionalInstructions?: string;
}

export interface GeneratedSentence {
  text: string;
  imagePrompt?: string;
  videoPrompt?: string;
}

export interface GeneratedSection {
  title: string;
  sentences: GeneratedSentence[];
  durationMinutes?: number;
}

// Long-form script generation types
export interface OutlineGenerationOptions {
  topic: string;
  targetDurationMinutes: number;
  visualStyle?: string;
}

export interface ScriptOutlineSection {
  index: number;
  title: string;
  description: string;
  targetMinutes: number;
  keyPoints: string[];
}

export interface ScriptOutlineResult {
  title: string;
  totalTargetMinutes: number;
  sections: ScriptOutlineSection[];
}

export interface SectionGenerationContext {
  outline: ScriptOutlineResult;
  currentSectionIndex: number;
  runningSummary: string;
  previousSectionEnding: string;
  coveredTopics: string[];
  visualStyle: string;
}

export interface GeneratedSectionResult {
  sectionIndex: number;
  title: string;
  sentences: GeneratedSentence[];
  sentenceCount: number;
  wordCount: number;
  durationMinutes: number;
}

export interface GeneratedScript {
  title: string;
  sections: GeneratedSection[];
  totalSentences: number;
  estimatedDurationMinutes: number;
}

// Section expansion types (AI-assisted sentence generation)
export interface SectionExpansionOptions {
  sectionTitle: string;
  existingSentences: string[];
  projectTopic: string;
  visualStyle: string;
  mode: 'quick' | 'guided';
  userPrompt?: string;
  sentenceCount: number;
  insertAfterIndex?: number; // -1 or undefined = end of section
}

export interface ExpandedSentence {
  text: string;
  imagePrompt: string;
  videoPrompt: string;
}

export interface SectionExpansionResult {
  sentences: ExpandedSentence[];
}

// Image prompt generation types
export interface ImagePromptSentence {
  id: string;
  index: number;
  text: string;
  sectionTitle: string;
}

export interface ImagePromptGenerationOptions {
  sentences: ImagePromptSentence[];
  styleContext?: {
    name: string;
    promptPrefix: string | null;
  };
  castCharacters?: Array<{
    name: string;
    description: string | null;
  }>;
}

export interface GeneratedImagePromptResult {
  prompts: Array<{
    index: number;
    imagePrompt: string;
  }>;
}

// Video prompt generation types
export interface VideoPromptSentence {
  id: string;
  index: number;
  text: string;
  sectionTitle: string;
  imagePrompt: string | null;
}

export interface VideoPromptGenerationOptions {
  sentences: VideoPromptSentence[];
  styleContext?: {
    name: string;
    promptPrefix: string | null;
  };
  castCharacters?: Array<{
    name: string;
    description: string | null;
  }>;
}

export interface GeneratedVideoPromptResult {
  prompts: Array<{
    index: number;
    videoPrompt: string;
  }>;
}

interface DeepseekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepseekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// =============================================================================
// Error Handling
// =============================================================================

export type DeepseekErrorCode =
  | 'API_KEY_MISSING'
  | 'API_ERROR'
  | 'RATE_LIMIT'
  | 'INVALID_RESPONSE'
  | 'PARSE_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT';

export class DeepseekError extends Error {
  constructor(
    message: string,
    public code: DeepseekErrorCode,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DeepseekError';
  }
}

// =============================================================================
// Deepseek Client Class
// =============================================================================

export class DeepseekClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(options: DeepseekClientOptions = {}) {
    const apiKey = options.apiKey || process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      throw new DeepseekError(
        'Deepseek API key is required. Set DEEPSEEK_API_KEY environment variable or pass apiKey option.',
        'API_KEY_MISSING'
      );
    }

    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    this.model = options.model || process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;
  }

  /**
   * Generate a script from a topic with structured sections and sentences
   */
  async generateScript(options: ScriptGenerationOptions): Promise<GeneratedScript> {
    const systemPrompt = this.buildSystemPrompt(options);
    const userPrompt = this.buildUserPrompt(options);

    const response = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    return this.parseScriptResponse(response);
  }

  /**
   * Send a chat completion request to Deepseek API
   */
  async chat(messages: DeepseekMessage[]): Promise<string> {
    const response = await this.fetchWithRetry<DeepseekResponse>(
      `${this.baseUrl}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.7,
          max_tokens: 8000,
        }),
      }
    );

    if (!response.choices || response.choices.length === 0) {
      throw new DeepseekError('No response choices returned from API', 'INVALID_RESPONSE', {
        response,
      });
    }

    return response.choices[0].message.content;
  }

  /**
   * Check if the Deepseek API is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.chat([{ role: 'user', content: 'Hello' }]);
      return true;
    } catch {
      return false;
    }
  }

  // ===========================================================================
  // Long-Form Script Generation Methods
  // ===========================================================================

  /**
   * Generate an outline for a long-form script.
   * Creates a structured plan with sections, descriptions, and time allocations.
   */
  async generateOutline(options: OutlineGenerationOptions): Promise<ScriptOutlineResult> {
    const sectionCount = Math.max(1, Math.ceil(options.targetDurationMinutes / 8));

    const systemPrompt = `You are a professional video script planner. Create a detailed outline for a ${options.targetDurationMinutes} minute video about "${options.topic}".

OUTPUT FORMAT (JSON only, no markdown):
{
  "title": "Engaging Video Title",
  "sections": [
    {
      "index": 0,
      "title": "Section Title",
      "description": "2-3 sentence description of what this section covers",
      "targetMinutes": 8,
      "keyPoints": ["Point 1", "Point 2", "Point 3"]
    }
  ]
}

GUIDELINES:
- Create approximately ${sectionCount} sections (roughly 1 section per 8 minutes)
- Each section should have a clear focus and natural flow to the next
- Distribute time based on topic importance
- First section should hook the viewer
- Last section should provide a satisfying conclusion
- Key points should be specific and actionable for the script writer
- Total section minutes should equal ${options.targetDurationMinutes}${options.visualStyle ? `\n- Keep the visual style "${options.visualStyle}" in mind when planning` : ''}

Output ONLY valid JSON. No markdown, no explanation.`;

    const response = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Create an outline for a ${options.targetDurationMinutes} minute video about: "${options.topic}"` },
    ]);

    return this.parseOutlineResponse(response, options.targetDurationMinutes);
  }

  /**
   * Generate a single section with full context from previous sections.
   * Uses running summary and covered topics to prevent repetition.
   */
  async generateSectionWithContext(context: SectionGenerationContext): Promise<GeneratedSectionResult> {
    const section = context.outline.sections[context.currentSectionIndex];
    if (!section) {
      throw new DeepseekError(
        `Section index ${context.currentSectionIndex} not found in outline`,
        'INVALID_RESPONSE'
      );
    }

    const wordsNeeded = section.targetMinutes * 150;
    const sentencesNeeded = Math.ceil(wordsNeeded / 15);

    const systemPrompt = this.buildSectionSystemPrompt(context, section, sentencesNeeded);
    const userPrompt = this.buildSectionUserPrompt(context, section);

    const response = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    return this.parseSectionResponse(response, section);
  }

  /**
   * Compress content into a running summary for context management.
   * Keeps the summary under maxWords while preserving key facts.
   */
  async compressSummary(
    previousSummary: string,
    newSection: GeneratedSectionResult,
    maxWords: number = 300
  ): Promise<string> {
    const newContent = newSection.sentences.map(s => s.text).join(' ');

    const prompt = `You are a summarizer. Combine the existing summary with new content into a concise summary.

EXISTING SUMMARY:
${previousSummary || '(No previous summary - this is the first section)'}

NEW CONTENT (Section "${newSection.title}"):
${newContent}

Create a summary that:
1. Preserves key facts, names, dates, and relationships
2. Captures the main narrative thread
3. Is under ${maxWords} words
4. Maintains chronological flow

Output ONLY the summary text, no headers or formatting.`;

    const response = await this.chat([
      { role: 'user', content: prompt },
    ]);

    return response.trim();
  }

  /**
   * Extract key topics covered in a section for anti-repetition tracking.
   */
  async extractCoveredTopics(section: GeneratedSectionResult): Promise<string[]> {
    const content = section.sentences.map(s => s.text).join(' ');

    const prompt = `Extract the key topics, concepts, and facts covered in this text. Output as a JSON array of short phrases (3-5 words each).

TEXT:
${content}

Output ONLY a JSON array like: ["topic one", "topic two", "topic three"]`;

    const response = await this.chat([
      { role: 'user', content: prompt },
    ]);

    try {
      const parsed = JSON.parse(response.trim());
      if (Array.isArray(parsed)) {
        return parsed.filter((t): t is string => typeof t === 'string');
      }
    } catch {
      // If parsing fails, extract simple phrases
      const topics = response.match(/"([^"]+)"/g);
      if (topics) {
        return topics.map(t => t.replace(/"/g, ''));
      }
    }

    return [];
  }

  // ===========================================================================
  // Private Helper Methods for Long-Form Generation
  // ===========================================================================

  private buildSectionSystemPrompt(
    context: SectionGenerationContext,
    section: ScriptOutlineSection,
    sentencesNeeded: number
  ): string {
    return `You are a professional video script writer continuing a ${context.outline.totalTargetMinutes} minute video titled "${context.outline.title}".

FULL OUTLINE:
${JSON.stringify(context.outline.sections.map(s => ({ index: s.index, title: s.title, targetMinutes: s.targetMinutes })), null, 2)}

CURRENT SECTION TO WRITE:
Section ${section.index}: "${section.title}"
Description: ${section.description}
Target: ${section.targetMinutes} minutes (~${section.targetMinutes * 150} words, ~${sentencesNeeded} sentences)
Key points to cover: ${section.keyPoints.join(', ')}

${context.runningSummary ? `STORY SO FAR (summary):\n${context.runningSummary}\n` : ''}
${context.previousSectionEnding ? `PREVIOUS SECTION ENDED WITH:\n"${context.previousSectionEnding}"\n` : ''}
${context.coveredTopics.length > 0 ? `ALREADY COVERED (do not re-explain these):\n- ${context.coveredTopics.join('\n- ')}\n` : ''}

VISUAL STYLE: ${context.visualStyle}

OUTPUT FORMAT (JSON only):
{
  "sentences": [
    {
      "text": "The narration text for this sentence.",
      "imagePrompt": "A detailed image prompt in ${context.visualStyle} style.",
      "videoPrompt": "Subject action with physical details, environmental effects present. Camera movement type capturing focal point."
    }
  ]
}

GUIDELINES:
- Continue the narrative naturally from where the previous section left off
- Each sentence should be 10-20 words for clear narration
- Do NOT repeat information already covered
- Cover ALL key points for this section
- End with a smooth transition to the next section (unless this is the last section)
- Image prompts should match the ${context.visualStyle} visual style
- Video prompts follow Wan 2.2 format (30-80 words): Subject Action + Environmental Effects + Camera Movement
  - Include physical details (muscle tension, facial expressions, gestures)
  - Add environmental context (wind, light quality, particles)
  - End with specific camera movement describing what it captures
- Output ONLY valid JSON, no markdown or explanation`;
  }

  private buildSectionUserPrompt(
    context: SectionGenerationContext,
    section: ScriptOutlineSection
  ): string {
    const isFirst = context.currentSectionIndex === 0;
    const isLast = context.currentSectionIndex === context.outline.sections.length - 1;

    let prompt = `Write section ${section.index}: "${section.title}"`;

    if (isFirst) {
      prompt += '\n\nThis is the FIRST section - start with a compelling hook to engage viewers.';
    } else if (isLast) {
      prompt += '\n\nThis is the FINAL section - provide a satisfying conclusion and summary.';
    }

    return prompt;
  }

  private parseOutlineResponse(content: string, targetMinutes: number): ScriptOutlineResult {
    let jsonContent = content.trim();

    // Handle markdown code blocks
    const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    // Try to find JSON object
    const objectMatch = jsonContent.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonContent = objectMatch[0];
    }

    try {
      const parsed = JSON.parse(jsonContent);

      if (!parsed.title || !Array.isArray(parsed.sections)) {
        throw new DeepseekError(
          'Invalid outline structure: missing title or sections',
          'PARSE_ERROR',
          { parsed }
        );
      }

      const sections: ScriptOutlineSection[] = parsed.sections.map(
        (section: Record<string, unknown>, index: number) => ({
          index,
          title: String(section.title || `Section ${index + 1}`),
          description: String(section.description || ''),
          targetMinutes: Number(section.targetMinutes) || Math.ceil(targetMinutes / parsed.sections.length),
          keyPoints: Array.isArray(section.keyPoints)
            ? section.keyPoints.map(String)
            : [],
        })
      );

      return {
        title: parsed.title,
        totalTargetMinutes: targetMinutes,
        sections,
      };
    } catch (error) {
      if (error instanceof DeepseekError) {
        throw error;
      }

      throw new DeepseekError(
        `Failed to parse outline response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARSE_ERROR',
        { content: content.substring(0, 500) }
      );
    }
  }

  private parseSectionResponse(
    content: string,
    section: ScriptOutlineSection
  ): GeneratedSectionResult {
    let jsonContent = content.trim();

    // Handle markdown code blocks
    const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    // Try to find JSON object
    const objectMatch = jsonContent.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonContent = objectMatch[0];
    }

    try {
      const parsed = JSON.parse(jsonContent);

      if (!Array.isArray(parsed.sentences)) {
        throw new DeepseekError(
          'Invalid section response: missing sentences array',
          'PARSE_ERROR',
          { parsed }
        );
      }

      const sentences: GeneratedSentence[] = parsed.sentences.map(
        (sentence: Record<string, unknown>) => ({
          text: String(sentence.text || ''),
          imagePrompt: sentence.imagePrompt ? String(sentence.imagePrompt) : undefined,
          videoPrompt: sentence.videoPrompt ? String(sentence.videoPrompt) : undefined,
        })
      );

      const wordCount = sentences.reduce(
        (sum, s) => sum + s.text.split(/\s+/).length,
        0
      );

      return {
        sectionIndex: section.index,
        title: section.title,
        sentences,
        sentenceCount: sentences.length,
        wordCount,
        durationMinutes: Math.round((wordCount / 150) * 10) / 10,
      };
    } catch (error) {
      if (error instanceof DeepseekError) {
        throw error;
      }

      throw new DeepseekError(
        `Failed to parse section response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARSE_ERROR',
        { content: content.substring(0, 500) }
      );
    }
  }

  /**
   * Build system prompt for script generation
   */
  private buildSystemPrompt(options: ScriptGenerationOptions): string {
    const basePrompt = `You are a professional video script writer. Your task is to create engaging, well-structured scripts for video content.

OUTPUT FORMAT:
You MUST respond with a valid JSON object following this exact structure:
{
  "title": "Script Title",
  "sections": [
    {
      "title": "Section Title",
      "sentences": [
        {
          "text": "The narration text for this sentence.",
          "imagePrompt": "A detailed image prompt describing the visual for this sentence.",
          "videoPrompt": "Subject action with physical details, environmental effects. Camera movement capturing focal point."
        }
      ]
    }
  ]
}

GUIDELINES:
- Each sentence should be 10-20 words for clear narration
- Average speaking rate is approximately 150 words per minute
- Create image prompts that are detailed and visually descriptive
- Video prompts should follow Wan 2.2 format (30-80 words): Subject Action + Environmental Effects + Camera Movement
  - Subject Action: What the main subject does with physical details (gestures, expressions, movement)
  - Environmental Effects: Atmospheric elements (wind, light, particles, reflections)
  - Camera Movement: Cinematic camera motion (dolly, pan, zoom, track, orbit) with what it captures
  - Example: "The scientist leans forward, eyes widening with discovery. Dust motes drift through lamplight. Camera slowly dollies in, capturing the revelation in her expression."
- Group related sentences into logical sections with clear titles
- Ensure smooth transitions between sections`;

    if (options.visualStyle) {
      return `${basePrompt}

VISUAL STYLE:
Apply the following visual style to all image prompts: ${options.visualStyle}`;
    }

    return basePrompt;
  }

  /**
   * Build user prompt for script generation
   */
  private buildUserPrompt(options: ScriptGenerationOptions): string {
    const wordsNeeded = options.targetDurationMinutes * 150;
    const sentencesNeeded = Math.ceil(wordsNeeded / 15); // ~15 words per sentence

    let prompt = `Create a video script about: "${options.topic}"

TARGET DURATION: ${options.targetDurationMinutes} minutes (approximately ${wordsNeeded} words, ${sentencesNeeded} sentences)

The script should be engaging, informative, and suitable for a video presentation.`;

    if (options.useSearchGrounding) {
      prompt += `

IMPORTANT: Include accurate, factual information. If discussing statistics, dates, or specific facts, ensure they are accurate and verifiable. Focus on well-established information.`;
    }

    if (options.additionalInstructions) {
      prompt += `

ADDITIONAL INSTRUCTIONS:
${options.additionalInstructions}`;
    }

    prompt += `

Remember to output ONLY valid JSON matching the required format. Do not include any text before or after the JSON.`;

    return prompt;
  }

  /**
   * Parse the script response from Deepseek
   */
  private parseScriptResponse(content: string): GeneratedScript {
    // Try to extract JSON from the response
    let jsonContent = content.trim();

    // Handle markdown code blocks
    const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    // Try to find JSON object in the content
    const objectMatch = jsonContent.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonContent = objectMatch[0];
    }

    try {
      const parsed = JSON.parse(jsonContent);

      // Validate structure
      if (!parsed.title || !Array.isArray(parsed.sections)) {
        throw new DeepseekError(
          'Invalid script structure: missing title or sections',
          'PARSE_ERROR',
          { parsed }
        );
      }

      // Validate and normalize sections
      const sections: GeneratedSection[] = parsed.sections.map(
        (section: Record<string, unknown>, sectionIndex: number) => {
          if (!section.title || !Array.isArray(section.sentences)) {
            throw new DeepseekError(
              `Invalid section structure at index ${sectionIndex}`,
              'PARSE_ERROR',
              { section }
            );
          }

          const sentences: GeneratedSentence[] = (
            section.sentences as Array<Record<string, unknown>>
          ).map((sentence, sentenceIndex: number) => {
            if (!sentence.text || typeof sentence.text !== 'string') {
              throw new DeepseekError(
                `Invalid sentence at section ${sectionIndex}, sentence ${sentenceIndex}`,
                'PARSE_ERROR',
                { sentence }
              );
            }

            return {
              text: sentence.text as string,
              imagePrompt: (sentence.imagePrompt as string) || undefined,
              videoPrompt: (sentence.videoPrompt as string) || undefined,
            };
          });

          return {
            title: section.title as string,
            sentences,
          };
        }
      );

      // Calculate totals
      const totalSentences = sections.reduce((sum, section) => sum + section.sentences.length, 0);
      const totalWords = sections.reduce(
        (sum, section) =>
          sum + section.sentences.reduce((sSum, s) => sSum + s.text.split(/\s+/).length, 0),
        0
      );
      const estimatedDurationMinutes = Math.round((totalWords / 150) * 10) / 10;

      return {
        title: parsed.title,
        sections,
        totalSentences,
        estimatedDurationMinutes,
      };
    } catch (error) {
      if (error instanceof DeepseekError) {
        throw error;
      }

      throw new DeepseekError(
        `Failed to parse script response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARSE_ERROR',
        { content: content.substring(0, 500) }
      );
    }
  }

  /**
   * Fetch with retry logic and exponential backoff
   */
  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit,
    attempt: number = 1
  ): Promise<T> {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(120000), // 120 second timeout for long script generation
      });

      if (response.status === 429) {
        // Rate limited
        if (attempt <= this.maxRetries) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '5', 10);
          const delay = Math.max(retryAfter * 1000, this.retryDelay * Math.pow(2, attempt - 1));
          await this.sleep(delay);
          return this.fetchWithRetry<T>(url, options, attempt + 1);
        }
        throw new DeepseekError('Rate limit exceeded after retries', 'RATE_LIMIT');
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error');
        throw new DeepseekError(`API request failed: ${response.status} ${response.statusText}`, 'API_ERROR', {
          status: response.status,
          body: errorBody,
        });
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof DeepseekError) {
        throw error;
      }

      // Network or timeout error - retry
      if (attempt <= this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        await this.sleep(delay);
        return this.fetchWithRetry<T>(url, options, attempt + 1);
      }

      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new DeepseekError('Request timed out', 'TIMEOUT');
      }

      throw new DeepseekError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NETWORK_ERROR'
      );
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Expand a section by generating additional sentences using AI
   * Supports both quick (automatic) and guided (user-prompted) modes
   */
  async expandSection(options: SectionExpansionOptions): Promise<SectionExpansionResult> {
    const {
      sectionTitle,
      existingSentences,
      projectTopic,
      visualStyle,
      mode,
      userPrompt,
      sentenceCount,
      insertAfterIndex,
    } = options;

    // Build context about where we're inserting
    const insertPosition = insertAfterIndex !== undefined && insertAfterIndex >= 0
      ? `after sentence ${insertAfterIndex + 1}`
      : 'at the end of the section';

    // Get surrounding context for better continuity
    const previousSentence = insertAfterIndex !== undefined && insertAfterIndex >= 0
      ? existingSentences[insertAfterIndex]
      : existingSentences[existingSentences.length - 1];

    const nextSentence = insertAfterIndex !== undefined && insertAfterIndex >= 0 && insertAfterIndex < existingSentences.length - 1
      ? existingSentences[insertAfterIndex + 1]
      : undefined;

    const systemPrompt = `You are a professional script writer creating narration for educational/documentary videos.
You will be given context about an existing script section and must generate ${sentenceCount} new sentence(s) that flow naturally.

IMPORTANT RULES:
1. Each sentence should be narration text - spoken by a narrator
2. Sentences should be 15-30 words each for good pacing
3. Maintain the same tone and style as existing sentences
4. Create smooth transitions with surrounding content
5. For each sentence, also create image and video prompts for ${visualStyle} visual style
6. Video prompts use Wan 2.2 format (30-80 words): Subject Action + Environmental Effects + Camera Movement

You MUST respond with valid JSON in this exact format:
{
  "sentences": [
    {
      "text": "The narration sentence...",
      "imagePrompt": "A ${visualStyle} shot of...",
      "videoPrompt": "Subject performs action with physical detail, environmental atmosphere present. Camera movement type capturing focal element."
    }
  ]
}`;

    let userContent: string;

    if (mode === 'guided' && userPrompt) {
      userContent = `PROJECT TOPIC: ${projectTopic}

SECTION: "${sectionTitle}"

EXISTING SENTENCES IN THIS SECTION:
${existingSentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}

INSERTION POINT: ${insertPosition}
${previousSentence ? `PREVIOUS SENTENCE: "${previousSentence}"` : ''}
${nextSentence ? `NEXT SENTENCE: "${nextSentence}"` : ''}

USER INSTRUCTION: ${userPrompt}

Generate ${sentenceCount} sentence(s) following the user's instruction while maintaining flow with the existing content.`;
    } else {
      // Quick mode - automatic expansion
      userContent = `PROJECT TOPIC: ${projectTopic}

SECTION: "${sectionTitle}"

EXISTING SENTENCES IN THIS SECTION:
${existingSentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}

INSERTION POINT: ${insertPosition}
${previousSentence ? `PREVIOUS SENTENCE: "${previousSentence}"` : ''}
${nextSentence ? `NEXT SENTENCE: "${nextSentence}"` : ''}

Generate ${sentenceCount} sentence(s) that naturally continue or expand on the section's content.
- Add more detail, examples, or explanations that fit the section's theme
- Ensure smooth transitions with surrounding sentences
- Maintain the educational/informative tone`;
    }

    const response = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ]);

    // Parse the response
    return this.parseExpansionResponse(response);
  }

  /**
   * Generate image prompts for a batch of sentences using LLM.
   * Prompts are 50-150 words describing composition, lighting, mood, and subjects.
   */
  async generateImagePrompts(options: ImagePromptGenerationOptions): Promise<GeneratedImagePromptResult> {
    const { sentences, styleContext, castCharacters } = options;

    if (sentences.length === 0) {
      return { prompts: [] };
    }

    const systemPrompt = this.buildImagePromptSystemPrompt(styleContext, castCharacters);
    const userPrompt = this.buildImagePromptUserPrompt(sentences);

    const response = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    return this.parseImagePromptResponse(response, sentences.length);
  }

  /**
   * Build system prompt for image prompt generation.
   */
  private buildImagePromptSystemPrompt(
    styleContext?: { name: string; promptPrefix: string | null },
    castCharacters?: Array<{ name: string; description: string | null }>
  ): string {
    let systemPrompt = `You are a professional visual director creating image prompts for video production.
Your task is to generate detailed image prompts that will be used to create visuals for a narrated video.

OUTPUT REQUIREMENTS:
- Each prompt must be 50-150 words
- Include: composition, lighting, mood, and subject details
- Describe the scene as if you're directing a cinematographer
- Focus on visual elements that match the narration text
- Use specific, concrete descriptions (not vague or abstract)

OUTPUT FORMAT (JSON only, no markdown):
{
  "prompts": [
    {
      "index": 0,
      "imagePrompt": "A detailed description of the visual scene..."
    }
  ]
}

IMPORTANT GUIDELINES:
- Match the tone and content of the narration text
- Create visually interesting compositions
- Consider the flow between consecutive scenes
- Use cinematic language (wide shot, close-up, silhouette, etc.)`;

    // Add style context if available
    if (styleContext?.promptPrefix) {
      systemPrompt += `

VISUAL STYLE CONTEXT:
Apply the following visual style to ALL prompts: ${styleContext.promptPrefix}
Style name: ${styleContext.name}
Ensure every image prompt incorporates this aesthetic consistently.`;
    }

    // Add character descriptions if cast exists
    if (castCharacters && castCharacters.length > 0) {
      systemPrompt += `

CHARACTER REFERENCE GUIDE:
When any of these characters appear in the narration, include their visual description in the prompt:`;

      for (const char of castCharacters) {
        systemPrompt += `
- ${char.name}: ${char.description || 'No detailed description provided'}`;
      }

      systemPrompt += `

IMPORTANT: When a character is mentioned in the text, describe their appearance using the provided details.
Include relevant character descriptions naturally within the scene description.`;
    }

    systemPrompt += `

Output ONLY valid JSON. No markdown code blocks, no explanation.`;

    return systemPrompt;
  }

  /**
   * Build user prompt for image prompt generation batch.
   */
  private buildImagePromptUserPrompt(sentences: ImagePromptSentence[]): string {
    let userPrompt = `Generate image prompts for the following ${sentences.length} narration sentences.
Each prompt should visualize the scene described in the narration.

SENTENCES TO PROCESS:`;

    for (const sentence of sentences) {
      userPrompt += `

[${sentence.index}] Section: "${sentence.sectionTitle}"
Narration: "${sentence.text}"`;
    }

    userPrompt += `

Generate a detailed image prompt for each sentence above. Return JSON with the "prompts" array containing objects with "index" (matching the number in brackets) and "imagePrompt" fields.`;

    return userPrompt;
  }

  /**
   * Parse image prompt generation response.
   */
  private parseImagePromptResponse(content: string, expectedCount: number): GeneratedImagePromptResult {
    let jsonContent = content.trim();

    // Handle markdown code blocks
    const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    // Try to find JSON object in the content
    const objectMatch = jsonContent.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonContent = objectMatch[0];
    }

    try {
      const parsed = JSON.parse(jsonContent);

      if (!parsed.prompts || !Array.isArray(parsed.prompts)) {
        throw new DeepseekError(
          'Invalid response structure: missing prompts array',
          'PARSE_ERROR',
          { parsed }
        );
      }

      // Validate and normalize prompts
      const prompts = parsed.prompts.map((p: Record<string, unknown>) => ({
        index: Number(p.index),
        imagePrompt: String(p.imagePrompt || ''),
      }));

      // Log warning if we got fewer prompts than expected
      if (prompts.length < expectedCount) {
        console.warn(`Image prompt generation: expected ${expectedCount} prompts, got ${prompts.length}`);
      }

      return { prompts };
    } catch (error) {
      if (error instanceof DeepseekError) {
        throw error;
      }

      throw new DeepseekError(
        `Failed to parse image prompt response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARSE_ERROR',
        { content: content.substring(0, 500) }
      );
    }
  }

  /**
   * Generate video prompts for a batch of sentences using LLM.
   * Prompts follow Wan 2.2 format: Subject Action + Environmental Effects + Camera Movement
   * Uses the imagePrompt for visual continuity when available.
   */
  async generateVideoPrompts(options: VideoPromptGenerationOptions): Promise<GeneratedVideoPromptResult> {
    const { sentences, styleContext, castCharacters } = options;

    if (sentences.length === 0) {
      return { prompts: [] };
    }

    const systemPrompt = this.buildVideoPromptSystemPrompt(styleContext, castCharacters);
    const userPrompt = this.buildVideoPromptUserPrompt(sentences);

    const response = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    return this.parseVideoPromptResponse(response, sentences.length);
  }

  /**
   * Build system prompt for video prompt generation.
   */
  private buildVideoPromptSystemPrompt(
    styleContext?: { name: string; promptPrefix: string | null },
    castCharacters?: Array<{ name: string; description: string | null }>
  ): string {
    let systemPrompt = `You are a professional video director creating motion prompts for AI video generation (Wan 2.2 model).
Your task is to generate video prompts that bring still images to life with realistic motion.

OUTPUT FORMAT: Subject Action + Environmental Effects + Camera Movement

STRUCTURE:
1. SUBJECT ACTION (required): Describe what the main subject does with physical details
   - Muscle movements, facial expressions, posture changes
   - Specific actions: raises, turns, reaches, breathes, gestures
   - Use adverbs for pacing: slowly, gently, suddenly, gradually

2. ENVIRONMENTAL EFFECTS (required): Add atmosphere and ambient motion
   - Wind effects: hair movement, clothing ripple, particles drifting
   - Light changes: shadows shifting, reflections, highlights
   - Background elements: clouds moving, water rippling, leaves rustling

3. CAMERA MOVEMENT (required): Cinematic camera work
   - Movement types: dolly in/out, pan left/right, tilt up/down, track, orbit, crane
   - Direction and speed: slowly, gradually, smoothly
   - Focus target: what the camera is capturing or revealing

EXAMPLE OUTPUT:
"The scientist leans forward, eyes widening with discovery, fingers trembling slightly over the ancient text. Dust motes drift lazily through the warm beam of lamplight, shadows dancing softly on the weathered wall. Camera slowly dollies in, capturing the moment of revelation in her expression."

OUTPUT FORMAT (JSON only, no markdown):
{
  "prompts": [
    {
      "index": 0,
      "videoPrompt": "Subject action description with physical details..."
    }
  ]
}

IMPORTANT GUIDELINES:
- Each prompt must be 30-80 words
- Match the tone of the narration text
- Reference the image prompt for visual continuity when provided
- Include subtle, realistic motion (avoid dramatic or unrealistic changes)
- Prefer reliable camera movements: dolly in, pull back, tracking shot, pan, orbit
- Avoid: whip pan, crash zoom, rapid movements (model doesn't handle these well)`;

    // Add style context if available
    if (styleContext?.promptPrefix) {
      systemPrompt += `

VISUAL STYLE CONTEXT:
Apply the following visual style: ${styleContext.promptPrefix}
Style name: ${styleContext.name}
Ensure motion descriptions complement this aesthetic.`;
    }

    // Add character descriptions if cast exists
    if (castCharacters && castCharacters.length > 0) {
      systemPrompt += `

CHARACTER REFERENCE GUIDE:
When any of these characters appear, include appropriate motion for their physical characteristics:`;

      for (const char of castCharacters) {
        systemPrompt += `
- ${char.name}: ${char.description || 'No detailed description provided'}`;
      }
    }

    systemPrompt += `

Output ONLY valid JSON. No markdown code blocks, no explanation.`;

    return systemPrompt;
  }

  /**
   * Build user prompt for video prompt generation batch.
   */
  private buildVideoPromptUserPrompt(sentences: VideoPromptSentence[]): string {
    let userPrompt = `Generate video prompts for the following ${sentences.length} sentences.
Each prompt should describe motion that brings the still image to life.

SENTENCES TO PROCESS:`;

    for (const sentence of sentences) {
      userPrompt += `

[${sentence.index}] Section: "${sentence.sectionTitle}"
Narration: "${sentence.text}"`;
      if (sentence.imagePrompt) {
        userPrompt += `
Image visual: "${sentence.imagePrompt}"`;
      }
    }

    userPrompt += `

Generate a Wan 2.2 format video prompt for each sentence. Return JSON with the "prompts" array containing objects with "index" (matching the number in brackets) and "videoPrompt" fields.`;

    return userPrompt;
  }

  /**
   * Parse video prompt generation response.
   */
  private parseVideoPromptResponse(content: string, expectedCount: number): GeneratedVideoPromptResult {
    let jsonContent = content.trim();

    // Handle markdown code blocks
    const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    // Try to find JSON object in the content
    const objectMatch = jsonContent.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonContent = objectMatch[0];
    }

    try {
      const parsed = JSON.parse(jsonContent);

      if (!parsed.prompts || !Array.isArray(parsed.prompts)) {
        throw new DeepseekError(
          'Invalid response structure: missing prompts array',
          'PARSE_ERROR',
          { parsed }
        );
      }

      // Validate and normalize prompts
      const prompts = parsed.prompts.map((p: Record<string, unknown>) => ({
        index: Number(p.index),
        videoPrompt: String(p.videoPrompt || ''),
      }));

      // Log warning if we got fewer prompts than expected
      if (prompts.length < expectedCount) {
        console.warn(`Video prompt generation: expected ${expectedCount} prompts, got ${prompts.length}`);
      }

      return { prompts };
    } catch (error) {
      if (error instanceof DeepseekError) {
        throw error;
      }

      throw new DeepseekError(
        `Failed to parse video prompt response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARSE_ERROR',
        { content: content.substring(0, 500) }
      );
    }
  }

  /**
   * Parse the expansion response into structured sentences
   */
  private parseExpansionResponse(content: string): SectionExpansionResult {
    try {
      // Try to extract JSON from the response
      let jsonContent = content;

      // Handle markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonContent);

      if (!parsed.sentences || !Array.isArray(parsed.sentences)) {
        throw new DeepseekError('Invalid expansion response: missing sentences array', 'PARSE_ERROR');
      }

      const sentences: ExpandedSentence[] = parsed.sentences.map((s: Record<string, unknown>, index: number) => {
        if (!s.text || typeof s.text !== 'string') {
          throw new DeepseekError(`Invalid sentence at index ${index}: missing text`, 'PARSE_ERROR');
        }

        return {
          text: s.text,
          imagePrompt: (s.imagePrompt as string) || '',
          videoPrompt: (s.videoPrompt as string) || '',
        };
      });

      return { sentences };
    } catch (error) {
      if (error instanceof DeepseekError) {
        throw error;
      }

      throw new DeepseekError(
        `Failed to parse expansion response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARSE_ERROR',
        { content: content.substring(0, 500) }
      );
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

let clientInstance: DeepseekClient | null = null;

/**
 * Create a new Deepseek client instance
 */
export function createDeepseekClient(options?: DeepseekClientOptions): DeepseekClient {
  return new DeepseekClient(options);
}

/**
 * Get or create a singleton Deepseek client instance
 */
export function getDeepseekClient(): DeepseekClient {
  if (!clientInstance) {
    clientInstance = new DeepseekClient();
  }
  return clientInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetDeepseekClient(): void {
  clientInstance = null;
}
