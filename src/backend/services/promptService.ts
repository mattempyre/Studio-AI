/**
 * Image Prompt Generation Service
 * STORY 4.1: Image Prompt Generation
 *
 * Generates detailed image prompts for sentences using LLM.
 * Includes style context, section context, and cast character descriptions.
 */

import { db, projects, sections, sentences, projectCast, characters, visualStyles } from '../db/index.js';
import { eq, inArray } from 'drizzle-orm';
import { getDeepseekClient, type ImagePromptSentence } from '../clients/deepseek.js';

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface SentenceForPrompt {
  id: string;
  text: string;
  sectionTitle: string;
  order: number;
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

export interface PromptGenerationOptions {
  projectId: string;
  sentenceIds?: string[]; // If not provided, generate for all sentences without prompts
  force?: boolean; // If true, regenerate even if prompt exists
  batchSize?: number; // Default: 15 (between 10-20)
}

export interface GeneratedImagePrompt {
  sentenceId: string;
  imagePrompt: string;
}

export interface PromptGenerationResult {
  success: boolean;
  total: number;
  generated: number;
  prompts: GeneratedImagePrompt[];
  errors?: string[];
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Get project context needed for prompt generation.
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
 * Get sentences for prompt generation.
 * Groups sentences by section for context.
 */
export async function getSentencesForGeneration(
  projectId: string,
  sentenceIds?: string[],
  force: boolean = false
): Promise<SentenceForPrompt[]> {
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

  // Build query for sentences
  let sentenceQuery = db
    .select()
    .from(sentences)
    .where(inArray(sentences.sectionId, sectionIds))
    .orderBy(sentences.order);

  const allSentences = await sentenceQuery;

  // Filter based on options
  let filteredSentences = allSentences;

  // Filter by specific sentence IDs if provided
  if (sentenceIds && sentenceIds.length > 0) {
    const sentenceIdSet = new Set(sentenceIds);
    filteredSentences = filteredSentences.filter(s => sentenceIdSet.has(s.id));
  }

  // Filter out sentences that already have prompts (unless force=true)
  if (!force) {
    filteredSentences = filteredSentences.filter(
      s => !s.imagePrompt || s.imagePrompt.trim() === ''
    );
  }

  // Map to SentenceForPrompt format
  return filteredSentences.map(s => ({
    id: s.id,
    text: s.text,
    sectionTitle: sectionTitleMap.get(s.sectionId) || 'Unknown Section',
    order: s.order,
  }));
}

/**
 * Generate image prompts for a batch of sentences.
 * Uses the DeepseekClient's generateImagePrompts method for LLM calls.
 */
export async function generatePromptsForBatch(
  batchSentences: SentenceForPrompt[],
  styleContext: StyleContext | null,
  castCharacters: CharacterContext[]
): Promise<GeneratedImagePrompt[]> {
  if (batchSentences.length === 0) {
    return [];
  }

  const deepseek = getDeepseekClient();

  // Prepare batch with indices for the client
  const sentencesForClient: ImagePromptSentence[] = batchSentences.map((s, idx) => ({
    id: s.id,
    index: idx,
    text: s.text,
    sectionTitle: s.sectionTitle,
  }));

  // Call the client's generateImagePrompts method
  const result = await deepseek.generateImagePrompts({
    sentences: sentencesForClient,
    styleContext: styleContext ? {
      name: styleContext.name,
      promptPrefix: styleContext.promptPrefix,
    } : undefined,
    castCharacters: castCharacters.length > 0 ? castCharacters : undefined,
  });

  // Map back to sentence IDs
  const promptMap = new Map(result.prompts.map(p => [p.index, p.imagePrompt]));

  return sentencesForClient.map(s => ({
    sentenceId: s.id,
    imagePrompt: promptMap.get(s.index) || '',
  })).filter(p => p.imagePrompt.length > 0);
}

/**
 * Main function to generate image prompts for a project.
 * Handles batching and progress tracking.
 */
export async function generateImagePrompts(
  options: PromptGenerationOptions,
  onProgress?: (current: number, total: number, message: string) => Promise<void>
): Promise<PromptGenerationResult> {
  const { projectId, sentenceIds, force = false, batchSize = 15 } = options;
  const errors: string[] = [];
  const allPrompts: GeneratedImagePrompt[] = [];

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
  const sentencesToProcess = await getSentencesForGeneration(projectId, sentenceIds, force);

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

  // Process in batches
  const effectiveBatchSize = Math.min(Math.max(batchSize, 10), 20); // Clamp between 10-20

  for (let i = 0; i < sentencesToProcess.length; i += effectiveBatchSize) {
    const batch = sentencesToProcess.slice(i, i + effectiveBatchSize);

    if (onProgress) {
      await onProgress(processed, total, `Processing batch ${Math.floor(i / effectiveBatchSize) + 1}...`);
    }

    try {
      const batchPrompts = await generatePromptsForBatch(batch, styleContext, castCharacters);
      allPrompts.push(...batchPrompts);

      // Update sentences in database
      for (const prompt of batchPrompts) {
        await db
          .update(sentences)
          .set({
            imagePrompt: prompt.imagePrompt,
            isImageDirty: true, // Mark as needing image regeneration
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
