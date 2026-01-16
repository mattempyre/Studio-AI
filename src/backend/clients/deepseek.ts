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
}

export interface GeneratedScript {
  title: string;
  sections: GeneratedSection[];
  totalSentences: number;
  estimatedDurationMinutes: number;
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
          "videoPrompt": "A brief motion description for video generation."
        }
      ]
    }
  ]
}

GUIDELINES:
- Each sentence should be 10-20 words for clear narration
- Average speaking rate is approximately 150 words per minute
- Create image prompts that are detailed and visually descriptive
- Video prompts should describe camera movement or motion (e.g., "slow zoom in", "pan right")
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
        signal: AbortSignal.timeout(60000), // 60 second timeout
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
