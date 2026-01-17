/**
 * Manual Trigger Script for Audio Generation Job
 * 
 * This script triggers a real Inngest job for audio generation.
 * You can watch the execution in the Inngest Dev Server dashboard (http://localhost:8288).
 * 
 * Usage: npm run trigger-audio
 */

import { inngest } from '../src/backend/inngest/client.js';
import { db, projects, sections, sentences } from '../src/backend/db/index.js';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

async function main() {
    console.log('🚀 Triggering Audio Generation Job...');

    try {
        // 1. Setup Test Data
        const projectId = 'test-audio-project';
        const sId = 'test-sentence-' + nanoid(5);

        // Ensure project exists
        const existingProject = await db.select().from(projects).where(eq(projects.id, projectId)).get();
        if (!existingProject) {
            await db.insert(projects).values({
                id: projectId,
                name: 'Audio Test Project',
                topic: 'Testing Audio Hookup',
                targetDuration: 1,
                visualStyle: 'cinematic',
                voiceId: 'Emily',  // Chatterbox voice
                status: 'draft',
            });
            console.log('✅ Created test project');
        } else {
            console.log('ℹ️  Using existing test project');
        }

        // Ensure section exists (using 'id' as the variable name for the section's actual ID)
        let section = await db.select().from(sections).where(eq(sections.projectId, projectId)).get();
        let targetSectionId: string;

        if (!section) {
            targetSectionId = nanoid();
            await db.insert(sections).values({
                id: targetSectionId,
                projectId,
                title: 'Test Section',
                order: 0,
            });
            console.log('✅ Created test section');
        } else {
            targetSectionId = section.id;
            console.log('ℹ️  Using existing test section');
        }

        // Create test sentence
        await db.insert(sentences).values({
            id: sId,
            sectionId: targetSectionId,
            text: 'Antigravity testing: The audio generation engine is now connected to Inngest. This is a real test run.',
            order: 0,
            status: 'pending',
            isAudioDirty: true,
            cameraMovement: 'static',
            motionStrength: 0.5,
        });
        console.log(`✅ Created test sentence: ${sId}`);

        // 2. Send Inngest Event
        console.log('📡 Sending audio/generate event...');
        const result = await inngest.send({
            name: 'audio/generate',
            data: {
                sentenceId: sId,
                projectId,
                text: 'Antigravity testing: The audio generation engine is now connected to Inngest. This is a real test run.',
                voiceId: 'Emily',  // Chatterbox voice
            },
        });

        console.log('✨ Event sent successfully!');
        console.log(`🔗 Watch the run here: http://localhost:8288/runs`);
        console.log(`📝 Job ID: ${result.ids[0]}`);

        // Keep alive for a moment to ensure event is flushed
        await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
        console.error('❌ Error during trigger:', error);
    } finally {
        process.exit(0);
    }
}

main();
