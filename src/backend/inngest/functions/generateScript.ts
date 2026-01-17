/**
 * Short-Form Script Generation Inngest Function
 * STORY-009: AI Script Generation
 *
 * Handles script generation for short-form videos (<10 minutes).
 * Uses a single Deepseek API call to generate the complete script
 * with sections and sentences, then stores them in the database.
 */

import { inngest } from '../client.js';
import { jobService } from '../../services/jobService.js';
import {
  db,
  projects,
  sections,
  sentences,
  type NewSection,
  type NewSentence,
} from '../../db/index.js';
import { eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDeepseekClient } from '../../clients/deepseek.js';

/**
 * Short-form script generation function.
 * Generates scripts for videos under 10 minutes in a single API call.
 */
export const generateScriptFunction = inngest.createFunction(
  {
    id: 'generate-script',
    name: 'Generate Short Script',
    retries: 2,
    concurrency: {
      limit: 2, // Allow 2 concurrent short-form generations
    },
  },
  { event: 'script/generate' },
  async ({ event, step, runId }) => {
    const { projectId, topic, targetDuration, useSearch } = event.data;

    console.log(`[Script] Starting short-form generation for project ${projectId}`);
    console.log(`[Script] Topic: "${topic}", Duration: ${targetDuration} min`);

    const client = getDeepseekClient();

    // Step 1: Create and start job
    const job = await step.run('create-job', async () => {
      const newJob = await jobService.create({
        projectId,
        jobType: 'script',
        inngestRunId: runId,
      });
      await jobService.markRunning(newJob.id, runId);
      return newJob;
    });

    // Step 2: Update project status to generating
    await step.run('update-project-status', async () => {
      await db.update(projects)
        .set({
          status: 'generating',
          topic,
          targetDuration,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId));

      // Broadcast progress: 0%
      await jobService.updateProgressWithBroadcast(job.id, 0, {
        projectId,
        jobType: 'script',
        message: 'Starting script generation...',
      });
    });

    // Step 3: Get project visual style
    const projectData = await step.run('get-project', async () => {
      const project = await db.select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .get();

      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      return project;
    });

    // Step 4: Generate script via Deepseek
    const generatedScript = await step.run('generate-script-content', async () => {
      // Broadcast progress: 25%
      await jobService.updateProgressWithBroadcast(job.id, 25, {
        projectId,
        jobType: 'script',
        message: 'Generating script with AI...',
      });

      const script = await client.generateScript({
        topic,
        targetDurationMinutes: targetDuration,
        visualStyle: projectData.visualStyle,
        useSearchGrounding: useSearch,
      });

      return script;
    });

    // Step 5: Clear existing sections and sentences
    await step.run('clear-existing-script', async () => {
      // Broadcast progress: 50%
      await jobService.updateProgressWithBroadcast(job.id, 50, {
        projectId,
        jobType: 'script',
        message: 'Preparing to save script...',
      });

      // Get all section IDs for this project
      const existingSections = await db.select({ id: sections.id })
        .from(sections)
        .where(eq(sections.projectId, projectId));

      const sectionIds = existingSections.map(s => s.id);

      // Delete sentences in those sections
      if (sectionIds.length > 0) {
        await db.delete(sentences)
          .where(inArray(sentences.sectionId, sectionIds));
      }

      // Delete sections
      await db.delete(sections)
        .where(eq(sections.projectId, projectId));
    });

    // Step 6: Save sections and sentences to database
    const savedData = await step.run('save-script-to-db', async () => {
      // Broadcast progress: 75%
      await jobService.updateProgressWithBroadcast(job.id, 75, {
        projectId,
        jobType: 'script',
        message: 'Saving script to database...',
      });

      let totalSentenceCount = 0;

      for (let sectionIndex = 0; sectionIndex < generatedScript.sections.length; sectionIndex++) {
        const section = generatedScript.sections[sectionIndex];
        const sectionId = nanoid();

        // Create section record
        const newSection: NewSection = {
          id: sectionId,
          projectId,
          title: section.title,
          order: sectionIndex,
        };

        await db.insert(sections).values(newSection);

        // Create sentence records for this section
        for (let sentenceIndex = 0; sentenceIndex < section.sentences.length; sentenceIndex++) {
          const sentence = section.sentences[sentenceIndex];

          const newSentence: NewSentence = {
            id: nanoid(),
            sectionId,
            text: sentence.text,
            order: sentenceIndex,
            imagePrompt: sentence.imagePrompt || null,
            videoPrompt: sentence.videoPrompt || null,
            cameraMovement: 'static',
            motionStrength: 0.5,
            status: 'pending',
            isAudioDirty: true,
            isImageDirty: true,
            isVideoDirty: true,
          };

          await db.insert(sentences).values(newSentence);
          totalSentenceCount++;
        }
      }

      return {
        sectionCount: generatedScript.sections.length,
        sentenceCount: totalSentenceCount,
      };
    });

    // Step 7: Update project status to ready
    await step.run('finalize', async () => {
      // Update project with title and status
      await db.update(projects)
        .set({
          name: generatedScript.title,
          status: 'ready',
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId));

      // Mark job as completed with broadcast
      await jobService.markCompletedWithBroadcast(job.id, {
        projectId,
        jobType: 'script',
      });

      // Emit completion event
      await inngest.send({
        name: 'script/completed',
        data: {
          projectId,
          sectionCount: savedData.sectionCount,
          sentenceCount: savedData.sentenceCount,
        },
      });
    });

    console.log(`[Script] Completed generation: ${savedData.sectionCount} sections, ${savedData.sentenceCount} sentences`);

    return {
      success: true,
      jobId: job.id,
      title: generatedScript.title,
      sectionCount: savedData.sectionCount,
      sentenceCount: savedData.sentenceCount,
      estimatedDurationMinutes: generatedScript.estimatedDurationMinutes,
    };
  }
);
