/**
 * Long-Form Script Generation Inngest Function
 * STORY-006: Implements AgentWrite pattern with recursive summarization
 *
 * This function orchestrates the generation of long-form scripts (10+ minutes)
 * by breaking them into sections and generating each with context from previous sections.
 */

import { inngest } from '../client.js';
import { jobService } from '../../services/jobService.js';
import {
  db,
  projects,
  sections,
  sentences,
  scriptOutlines,
  generationJobs,
  type NewSection,
  type NewSentence,
  type SectionOutline,
} from '../../db/index.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import {
  getDeepseekClient,
  type ScriptOutlineResult,
  type GeneratedSectionResult,
  type SectionGenerationContext,
} from '../../clients/deepseek.js';

/**
 * Main long-form script generation function.
 * Handles both 'auto' mode (topic → script) and 'from-outline' mode (outline → script).
 */
export const generateLongScriptFunction = inngest.createFunction(
  {
    id: 'generate-long-script',
    name: 'Generate Long-Form Script',
    retries: 3,
    concurrency: {
      limit: 1, // Only one long-form generation at a time
    },
  },
  { event: 'script/generate-long' },
  async ({ event, step, runId }) => {
    const { projectId, outlineId, topic, targetDurationMinutes, visualStyle, mode } = event.data;

    console.log(`[LongScript] Starting long-form generation for project ${projectId}`);
    console.log(`[LongScript] Mode: ${mode}, Duration: ${targetDurationMinutes} min`);

    const client = getDeepseekClient();

    // Step 1: Create job record
    const job = await step.run('create-job-record', async () => {
      const job = await jobService.create({
        projectId,
        jobType: 'script-long',
        inngestRunId: runId,
      });
      await jobService.markRunning(job.id, runId);
      return job;
    });

    // Step 2: Generate or load outline
    const outline = await step.run('generate-or-load-outline', async () => {
      if (mode === 'from-outline' && outlineId) {
        // Load existing outline from database
        const existing = await db.select()
          .from(scriptOutlines)
          .where(eq(scriptOutlines.id, outlineId))
          .get();

        if (!existing) {
          throw new Error(`Outline ${outlineId} not found`);
        }

        return {
          id: existing.id,
          outline: {
            title: existing.title,
            totalTargetMinutes: existing.totalTargetMinutes,
            sections: (existing.sections as SectionOutline[]).map((s, i) => ({
              index: i,
              title: s.title,
              description: s.description,
              targetMinutes: s.targetMinutes,
              keyPoints: s.keyPoints,
            })),
          } as ScriptOutlineResult,
          runningSummary: existing.runningSummary || '',
          coveredTopics: (existing.coveredTopics || []) as string[],
          currentSectionIndex: existing.currentSectionIndex || 0,
        };
      }

      // Generate new outline
      console.log(`[LongScript] Generating outline for topic: ${topic}`);
      const generatedOutline = await client.generateOutline({
        topic,
        targetDurationMinutes,
        visualStyle,
      });

      // Save outline to database
      const newOutlineId = nanoid();
      const sectionOutlines: SectionOutline[] = generatedOutline.sections.map(s => ({
        index: s.index,
        title: s.title,
        description: s.description,
        targetMinutes: s.targetMinutes,
        keyPoints: s.keyPoints,
        status: 'pending' as const,
      }));

      await db.insert(scriptOutlines).values({
        id: newOutlineId,
        projectId,
        title: generatedOutline.title,
        topic,
        totalTargetMinutes: targetDurationMinutes,
        visualStyle,
        sections: sectionOutlines,
        status: 'generating',
        runningSummary: null,
        coveredTopics: [],
        currentSectionIndex: 0,
      });

      // Update job with outline reference and step tracking
      await db.update(generationJobs)
        .set({
          outlineId: newOutlineId,
          totalSteps: generatedOutline.sections.length,
          currentStep: 0,
          stepName: 'Outline generated',
        })
        .where(eq(generationJobs.id, job.id));

      // Emit outline generated event
      await inngest.send({
        name: 'script/outline-generated',
        data: {
          projectId,
          outlineId: newOutlineId,
          sectionCount: generatedOutline.sections.length,
        },
      });

      return {
        id: newOutlineId,
        outline: generatedOutline,
        runningSummary: '',
        coveredTopics: [] as string[],
        currentSectionIndex: 0,
      };
    });

    // Step 3: Update project with script title
    await step.run('update-project-title', async () => {
      await db.update(projects)
        .set({
          name: outline.outline.title,
          status: 'generating',
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId));
    });

    // Step 4-N: Generate each section sequentially
    let runningSummary = outline.runningSummary;
    let coveredTopics = [...outline.coveredTopics];
    let previousSectionEnding = '';
    let totalSentences = 0;
    let totalDuration = 0;

    // Start from where we left off (for resume support)
    const startIndex = outline.currentSectionIndex;

    for (let i = startIndex; i < outline.outline.sections.length; i++) {
      const section = outline.outline.sections[i];

      // Generate and save section content in a single step
      // IMPORTANT: We minimize step return data to avoid Inngest payload limits
      // Large data (sentences, prompts) is saved to DB, only minimal refs are returned
      const sectionResult = await step.run(`process-section-${i}`, async () => {
        console.log(`[LongScript] Generating section ${i}: ${section.title}`);

        // Update job progress
        const progress = Math.round((i / outline.outline.sections.length) * 100);
        await jobService.update(job.id, {
          progress,
          currentStep: i + 1,
          stepName: `Generating section: ${section.title}`,
        });

        // Update outline section status
        const updatedSections = [...outline.outline.sections].map((s, idx) => ({
          index: s.index,
          title: s.title,
          description: s.description,
          targetMinutes: s.targetMinutes,
          keyPoints: s.keyPoints,
          status: idx < i ? 'completed' : idx === i ? 'generating' : 'pending',
        })) as SectionOutline[];

        await db.update(scriptOutlines)
          .set({
            sections: updatedSections,
            currentSectionIndex: i,
            updatedAt: new Date(),
          })
          .where(eq(scriptOutlines.id, outline.id));

        // Build context for generation
        const context: SectionGenerationContext = {
          outline: outline.outline,
          currentSectionIndex: i,
          runningSummary,
          previousSectionEnding,
          coveredTopics,
          visualStyle,
        };

        // Generate the section
        const generatedSection = await client.generateSectionWithContext(context);

        // Save section to database immediately (don't return large data)
        const sectionId = nanoid();
        const newSection: NewSection = {
          id: sectionId,
          projectId,
          title: generatedSection.title,
          order: i,
        };

        await db.insert(sections).values(newSection);

        // Create sentence records
        const sentenceRecords: NewSentence[] = generatedSection.sentences.map((s, idx) => ({
          id: nanoid(),
          sectionId,
          text: s.text,
          order: idx,
          imagePrompt: s.imagePrompt || null,
          videoPrompt: s.videoPrompt || null,
          cameraMovement: 'static',
          motionStrength: 0.5,
          status: 'pending',
        }));

        if (sentenceRecords.length > 0) {
          await db.insert(sentences).values(sentenceRecords);
        }

        // Compress summary with new section content
        const newSummary = await client.compressSummary(
          runningSummary,
          generatedSection,
          300 // Max words for summary
        );

        // Extract new covered topics
        const newTopics = await client.extractCoveredTopics(generatedSection);

        // Get last sentence for continuity (just the text, not the whole object)
        const lastSentenceText = generatedSection.sentences[generatedSection.sentences.length - 1]?.text || '';

        // Update outline with new memory state
        await db.update(scriptOutlines)
          .set({
            runningSummary: newSummary,
            coveredTopics: [...coveredTopics, ...newTopics],
            updatedAt: new Date(),
          })
          .where(eq(scriptOutlines.id, outline.id));

        // Return ONLY minimal data needed for next iteration
        // This avoids Inngest payload size limits by not storing full sentence content
        return {
          sectionId,
          sectionTitle: generatedSection.title,
          sentenceCount: sentenceRecords.length,
          durationMinutes: generatedSection.durationMinutes,
          // Memory state for next iteration (kept small)
          newSummary,
          newTopics,
          lastSentenceText,
        };
      });

      // Update loop variables from minimal step result
      // SAFETY: Limit summary to 2000 chars and topics to last 50 to avoid payload bloat
      runningSummary = sectionResult.newSummary.slice(0, 2000);
      // Keep only the most recent topics to prevent unbounded growth
      const allTopics = [...coveredTopics, ...sectionResult.newTopics];
      coveredTopics = allTopics.slice(-50); // Keep last 50 topics max
      previousSectionEnding = sectionResult.lastSentenceText.slice(0, 500);
      totalSentences += sectionResult.sentenceCount;
      totalDuration += sectionResult.durationMinutes;

      // Emit section completed event
      await step.run(`emit-section-complete-${i}`, async () => {
        await inngest.send({
          name: 'script/section-completed',
          data: {
            projectId,
            outlineId: outline.id,
            sectionIndex: i,
            sectionTitle: sectionResult.sectionTitle,
            sentenceCount: sectionResult.sentenceCount,
          },
        });

        // Mark section as completed in outline
        const finalSections = (await db.select()
          .from(scriptOutlines)
          .where(eq(scriptOutlines.id, outline.id))
          .get())?.sections as SectionOutline[] || [];

        const updatedSections = finalSections.map((s, idx) => ({
          ...s,
          status: idx <= i ? 'completed' : s.status,
        })) as SectionOutline[];

        await db.update(scriptOutlines)
          .set({ sections: updatedSections })
          .where(eq(scriptOutlines.id, outline.id));
      });
    }

    // Final step: Mark everything as complete
    const result = await step.run('finalize', async () => {
      // Update outline status
      await db.update(scriptOutlines)
        .set({
          status: 'completed',
          updatedAt: new Date(),
        })
        .where(eq(scriptOutlines.id, outline.id));

      // Update project status
      await db.update(projects)
        .set({
          status: 'ready',
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId));

      // Mark job as completed
      await jobService.markCompleted(job.id);

      // Emit completion event
      await inngest.send({
        name: 'script/long-completed',
        data: {
          projectId,
          outlineId: outline.id,
          totalSections: outline.outline.sections.length,
          totalSentences,
          totalDurationMinutes: Math.round(totalDuration * 10) / 10,
        },
      });

      return {
        outlineId: outline.id,
        title: outline.outline.title,
        totalSections: outline.outline.sections.length,
        totalSentences,
        totalDurationMinutes: Math.round(totalDuration * 10) / 10,
      };
    });

    // Trigger image prompt generation for sentences missing prompts
    // Uses the project's styleId and cast for better context (STORY 4.1)
    await step.sendEvent('trigger-image-prompts', {
      name: 'prompts/generate-image',
      data: {
        projectId,
        force: false, // Only generate for sentences without prompts
      },
    });

    console.log(`[LongScript] Completed generation: ${result.totalSections} sections, ${result.totalSentences} sentences`);

    return {
      success: true,
      jobId: job.id,
      ...result,
    };
  }
);

/**
 * Separate function to generate outline only (for outline-first workflow).
 * User can review and approve outline before triggering full generation.
 */
export const generateOutlineOnlyFunction = inngest.createFunction(
  {
    id: 'generate-outline-only',
    name: 'Generate Script Outline',
    retries: 3,
  },
  { event: 'script/outline-generated' },
  async ({ event }) => {
    // This is just an event handler for tracking - the actual outline
    // generation happens in the main function or via API endpoint
    console.log(`[Outline] Outline generated for project ${event.data.projectId}`);
    console.log(`[Outline] Outline ID: ${event.data.outlineId}, Sections: ${event.data.sectionCount}`);

    return { received: true };
  }
);
