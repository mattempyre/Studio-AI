/**
 * Video Prompt Generation Service
 *
 * Generates detailed video prompts for sentences using LLM.
 * Follows Wan 2.2 format: Subject Action + Environmental Effects + Camera Movement.
 * Uses imagePrompt for visual continuity when available.
 */

import { db, projects, sections, sentences, projectCast, characters, visualStyles } from '../db/index.js';
import { eq, inArray } from 'drizzle-orm';
import { getDeepseekClient, type VideoPromptSentence } from '../clients/deepseek.js';

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface SentenceForVideoPrompt {
  id: string;
  text: string;
  sectionTitle: string;
  order: number;
  imagePrompt: string | null;
}

export interface CharacterContext {
  name: string;
  description: string | null;
}

export interface StyleContext {
  name: string;
  promptPrefix: string | null;
  styleType: 'prompt' | 'lora';
}

export interface VideoPromptGenerationOptions {
  projectId: string;
  sentenceIds?: string[]; // If not provided, generate for all sentences without video prompts
  force?: boolean; // If true, regenerate even if video prompt exists
  batchSize?: number; // Default: 10 (smaller due to longer prompts)
}

export interface GeneratedVideoPrompt {
  sentenceId: string;
  videoPrompt: string;
}

export interface VideoPromptGenerationResult {
  success: boolean;
  total: number;
  generated: number;
  prompts: GeneratedVideoPrompt[];
  errors?: string[];
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Get project context needed for video prompt generation.
 */
export async function getProjectContext(projectId: string): Promise<{
  project: typeof projects.$inferSelect | null;
  styleContext: StyleContext | null;
  castCharacters: CharacterContext[];
}> {
  // Get project with styleId
  const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();

  if (!project) {
    return { project: null, styleContext: null, castCharacters: [] };
  }

  // Get style context if styleId is set
  let styleContext: StyleContext | null = null;
  if (project.styleId) {
    const style = await db.select().from(visualStyles).where(eq(visualStyles.id, project.styleId)).get();
    if (style) {
      styleContext = {
        name: style.name,
        promptPrefix: style.promptPrefix,
        styleType: style.styleType as 'prompt' | 'lora',
      };
    }
  }

  // Get cast characters
  const castResult = await db
    .select({
      name: characters.name,
      description: characters.description,
    })
    .from(projectCast)
    .innerJoin(characters, eq(projectCast.characterId, characters.id))
    .where(eq(projectCast.projectId, projectId));

  return {
    project,
    styleContext,
    castCharacters: castResult,
  };
}

/**
 * Get sentences for video prompt generation.
 * Includes imagePrompt for visual continuity.
 */
export async function getSentencesForVideoPromptGeneration(
  projectId: string,
  sentenceIds?: string[],
  force: boolean = false
): Promise<SentenceForVideoPrompt[]> {
  // Get all sections for the project
  const projectSections = await db
    .select()
    .from(sections)
    .where(eq(sections.projectId, projectId))
    .orderBy(sections.order);

  if (projectSections.length === 0) {
    return [];
  }

  const sectionIds = projectSections.map(s => s.id);
  const sectionTitleMap = new Map(projectSections.map(s => [s.id, s.title]));

  // Get all sentences
  const allSentences = await db
    .select()
    .from(sentences)
    .where(inArray(sentences.sectionId, sectionIds))
    .orderBy(sentences.order);

  // Filter based on options
  let filteredSentences = allSentences;

  // Filter by specific sentence IDs if provided
  if (sentenceIds && sentenceIds.length > 0) {
    const sentenceIdSet = new Set(sentenceIds);
    filteredSentences = filteredSentences.filter(s => sentenceIdSet.has(s.id));
  }

  // Filter out sentences that already have video prompts (unless force=true)
  if (!force) {
    filteredSentences = filteredSentences.filter(
      s => !s.videoPrompt || s.videoPrompt.trim() === ''
    );
  }

  // Map to SentenceForVideoPrompt format (include imagePrompt for continuity)
  return filteredSentences.map(s => ({
    id: s.id,
    text: s.text,
    sectionTitle: sectionTitleMap.get(s.sectionId) || 'Unknown Section',
    order: s.order,
    imagePrompt: s.imagePrompt,
  }));
}

/**
 * Generate video prompts for a batch of sentences.
 * Uses the DeepseekClient's generateVideoPrompts method for LLM calls.
 */
export async function generateVideoPromptsForBatch(
  batchSentences: SentenceForVideoPrompt[],
  styleContext: StyleContext | null,
  castCharacters: CharacterContext[]
): Promise<GeneratedVideoPrompt[]> {
  if (batchSentences.length === 0) {
    return [];
  }

  const deepseek = getDeepseekClient();

  // Prepare batch with indices for the client (include imagePrompt for visual continuity)
  const sentencesForClient: VideoPromptSentence[] = batchSentences.map((s, idx) => ({
    id: s.id,
    index: idx,
    text: s.text,
    sectionTitle: s.sectionTitle,
    imagePrompt: s.imagePrompt,
  }));

  // Call the client's generateVideoPrompts method
  const result = await deepseek.generateVideoPrompts({
    sentences: sentencesForClient,
    styleContext: styleContext ? {
      name: styleContext.name,
      promptPrefix: styleContext.promptPrefix,
    } : undefined,
    castCharacters: castCharacters.length > 0 ? castCharacters : undefined,
  });

  // Map back to sentence IDs
  const promptMap = new Map(result.prompts.map(p => [p.index, p.videoPrompt]));

  return sentencesForClient.map(s => ({
    sentenceId: s.id,
    videoPrompt: promptMap.get(s.index) || '',
  })).filter(p => p.videoPrompt.length > 0);
}

/**
 * Main function to generate video prompts for a project.
 * Handles batching and progress tracking.
 */
export async function generateVideoPrompts(
  options: VideoPromptGenerationOptions,
  onProgress?: (current: number, total: number, message: string) => Promise<void>
): Promise<VideoPromptGenerationResult> {
  const { projectId, sentenceIds, force = false, batchSize = 10 } = options;
  const errors: string[] = [];
  const allPrompts: GeneratedVideoPrompt[] = [];

  // Get project context
  const { project, styleContext, castCharacters } = await getProjectContext(projectId);

  if (!project) {
    return {
      success: false,
      total: 0,
      generated: 0,
      prompts: [],
      errors: ['Project not found'],
    };
  }

  // Get sentences to process
  const sentencesToProcess = await getSentencesForVideoPromptGeneration(projectId, sentenceIds, force);

  if (sentencesToProcess.length === 0) {
    return {
      success: true,
      total: 0,
      generated: 0,
      prompts: [],
    };
  }

  const total = sentencesToProcess.length;
  let processed = 0;

  // Process in batches (smaller batch size for video prompts due to longer output)
  const effectiveBatchSize = Math.min(Math.max(batchSize, 5), 15); // Clamp between 5-15

  for (let i = 0; i < sentencesToProcess.length; i += effectiveBatchSize) {
    const batch = sentencesToProcess.slice(i, i + effectiveBatchSize);

    if (onProgress) {
      await onProgress(processed, total, `Processing batch ${Math.floor(i / effectiveBatchSize) + 1}...`);
    }

    try {
      const batchPrompts = await generateVideoPromptsForBatch(batch, styleContext, castCharacters);
      allPrompts.push(...batchPrompts);

      // Update sentences in database
      for (const prompt of batchPrompts) {
        await db
          .update(sentences)
          .set({
            videoPrompt: prompt.videoPrompt,
            isVideoDirty: true, // Mark as needing video regeneration
            updatedAt: new Date(),
          })
          .where(eq(sentences.id, prompt.sentenceId));
      }

      processed += batch.length;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Batch ${Math.floor(i / effectiveBatchSize) + 1} failed: ${errorMessage}`);
      console.error(`Batch processing error:`, error);
    }
  }

  if (onProgress) {
    await onProgress(total, total, 'Complete');
  }

  return {
    success: errors.length === 0,
    total,
    generated: allPrompts.length,
    prompts: allPrompts,
    errors: errors.length > 0 ? errors : undefined,
  };
}
