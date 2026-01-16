/**
 * Manual test script for ComfyUI integration
 *
 * Usage: npx tsx scripts/test-comfyui.ts
 *
 * Prerequisites:
 * - ComfyUI running on localhost:8188
 * - Required models installed in ComfyUI
 */

import 'dotenv/config';
import { createComfyUIClient, ComfyUIError } from '../src/backend/clients/comfyui.js';
import { getImageWorkflowPath, getVideoWorkflowPath, listVideoModels } from '../workflows/config.js';
import { generateOutputPath, ensureProjectDirs } from '../src/backend/services/outputPaths.js';

async function main() {
  // Use 'test' as project ID for test files
  const testProjectId = 'test';
  await ensureProjectDirs(testProjectId);

  const client = createComfyUIClient({
    baseUrl: process.env.COMFYUI_URL || 'http://localhost:8188',
    timeout: 300000, // 5 minutes
    maxRetries: 3,
  });

  console.log('🔍 ComfyUI Client Test\n');
  console.log(`Server URL: ${process.env.COMFYUI_URL || 'http://localhost:8188'}\n`);

  // Test 1: Health Check
  console.log('1️⃣  Testing server connection...');
  const healthy = await client.healthCheck();
  if (!healthy) {
    console.log('❌ ComfyUI server is not available!');
    console.log('   Make sure ComfyUI is running on localhost:8188');
    console.log('   Or set COMFYUI_URL in your .env.local file');
    process.exit(1);
  }
  console.log('✅ Server is healthy!\n');

  // Test 2: Get System Stats
  console.log('2️⃣  Getting system stats...');
  try {
    const stats = await client.getSystemStats();
    console.log('✅ System stats retrieved:');
    console.log(JSON.stringify(stats, null, 2).slice(0, 500) + '...\n');
  } catch (error) {
    console.log('⚠️  Could not get system stats:', (error as Error).message, '\n');
  }

  // Test 3: Get Queue Status
  console.log('3️⃣  Getting queue status...');
  try {
    const queue = await client.getQueueStatus();
    console.log('✅ Queue status:');
    console.log(`   Running: ${(queue.queue_running as unknown[]).length} jobs`);
    console.log(`   Pending: ${(queue.queue_pending as unknown[]).length} jobs\n`);
  } catch (error) {
    console.log('⚠️  Could not get queue status:', (error as Error).message, '\n');
  }

  // Test 4: Load Workflow
  console.log('4️⃣  Loading workflow...');
  try {
    const workflowPath = getImageWorkflowPath('flux-2');
    console.log(`   Path: ${workflowPath}`);
    const workflow = await client.loadWorkflow(workflowPath);
    const nodeCount = Object.keys(workflow).length;
    console.log(`✅ Workflow loaded: ${nodeCount} nodes\n`);

    // Test 5: Prepare Workflow
    console.log('5️⃣  Preparing workflow with test parameters...');
    const prepared = client.prepareImageWorkflow(workflow, {
      prompt: 'A serene mountain landscape at sunset, golden hour lighting, photorealistic',
      negativePrompt: 'blurry, low quality, distorted',
      width: 1024,
      height: 768,
      seed: 12345,
      steps: 20,
      cfg: 7,
    });
    console.log('✅ Workflow prepared with parameters\n');

    // Ask user if they want to run generation
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎨 Ready to test image generation!');
    console.log('');
    console.log('This will:');
    console.log('  1. Queue the workflow to ComfyUI');
    console.log('  2. Poll for progress via WebSocket');
    console.log('  3. Download the generated image');
    console.log('');
    console.log('⚠️  Make sure you have the required model:');
    console.log('   flux1-dev-fp8.safetensors (or update the workflow)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check for --generate flag
    if (process.argv.includes('--generate')) {
      console.log('6️⃣  Running image generation (this may take a while)...\n');

      try {
        const outputPath = generateOutputPath(testProjectId, 'images', 'test', 'png');

        const result = await client.generateImage(
          workflowPath,
          {
            prompt: 'A serene mountain landscape at sunset, golden hour lighting, photorealistic',
            negativePrompt: 'blurry, low quality, distorted',
            width: 1024,
            height: 768,
            seed: 12345,
            steps: 20,
            cfg: 7,
          },
          outputPath,
          (progress, message) => {
            const bar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
            process.stdout.write(`\r   [${bar}] ${progress}% ${message || ''}`);
          }
        );

        console.log('\n');
        console.log('✅ Image generated successfully!');
        console.log(`   Output: ${result}`);
      } catch (error) {
        if (error instanceof ComfyUIError) {
          console.log('\n❌ Generation failed:', error.message);
          console.log('   Error code:', error.code);
          if (error.details) {
            console.log('   Details:', JSON.stringify(error.details, null, 2));
          }
        } else {
          throw error;
        }
      }
    } else {
      console.log('ℹ️  Run with --generate flag to test full image generation:');
      console.log('   npx tsx scripts/test-comfyui.ts --generate\n');
    }

    // Test Video Workflow Loading
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎬 Video Workflow Test\n');

    console.log('Available video models:', listVideoModels().join(', '));

    const videoWorkflowPath = getVideoWorkflowPath('wan-2.2-14b');
    console.log(`\nLoading: ${videoWorkflowPath}`);

    const videoWorkflow = await client.loadWorkflow(videoWorkflowPath);
    const videoNodeCount = Object.keys(videoWorkflow).length;
    console.log(`✅ Video workflow loaded: ${videoNodeCount} nodes\n`);

    // Show what nodes will be injected
    console.log('Detected injectable nodes:');
    for (const [nodeId, node] of Object.entries(videoWorkflow)) {
      if (node.class_type === 'LoadImage') {
        console.log(`   - Node ${nodeId}: LoadImage (source image)`);
      }
      if (node.class_type === 'CLIPTextEncode') {
        const title = node._meta?.title || 'untitled';
        console.log(`   - Node ${nodeId}: CLIPTextEncode (${title})`);
      }
      if (node.class_type === 'WanImageToVideo') {
        console.log(`   - Node ${nodeId}: WanImageToVideo (width, height, frames)`);
      }
      if (node.class_type === 'CreateVideo') {
        console.log(`   - Node ${nodeId}: CreateVideo (fps)`);
      }
    }

    // Test video workflow preparation
    console.log('\nPreparing video workflow with test parameters...');
    const preparedVideo = client.prepareVideoWorkflow(videoWorkflow, {
      imageFile: '/path/to/input/image.png',
      prompt: 'A smooth camera pan across the scene with gentle motion',
      width: 1280,
      height: 720,
      frames: 81,
      fps: 16,
      seed: 12345,
    });
    console.log('✅ Video workflow prepared\n');

    // Check if --generate-video flag is passed
    if (process.argv.includes('--generate-video')) {
      const inputImage = process.argv[process.argv.indexOf('--generate-video') + 1];

      if (!inputImage) {
        console.log('❌ Please provide an input image path:');
        console.log('   npx tsx scripts/test-comfyui.ts --generate-video /path/to/image.png\n');
      } else {
        console.log(`6️⃣  Running video generation with input: ${inputImage}\n`);
        console.log('⚠️  This may take several minutes...\n');

        try {
          const outputPath = generateOutputPath(testProjectId, 'videos', 'video', 'mp4');

          const result = await client.generateVideo(
            videoWorkflowPath,
            {
              imageFile: inputImage,
              prompt: 'Smooth animated motion, camera slowly pans across the scene',
              width: 1280,
              height: 720,
              frames: 81,
              fps: 16,
              seed: Math.floor(Math.random() * 1000000),
            },
            outputPath,
            (progress, message) => {
              const bar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
              process.stdout.write(`\r   [${bar}] ${progress}% ${message || ''}`);
            }
          );

          console.log('\n');
          console.log('✅ Video generated successfully!');
          console.log(`   Output: ${result}`);
        } catch (error) {
          if (error instanceof ComfyUIError) {
            console.log('\n❌ Video generation failed:', error.message);
            console.log('   Error code:', error.code);
            if (error.details) {
              console.log('   Details:', JSON.stringify(error.details, null, 2));
            }
          } else {
            throw error;
          }
        }
      }
    } else {
      console.log('ℹ️  Run with --generate-video flag to test video generation:');
      console.log('   npx tsx scripts/test-comfyui.ts --generate-video /path/to/image.png\n');
    }

  } catch (error) {
    if (error instanceof ComfyUIError) {
      console.log('❌ Error:', error.message);
      console.log('   Code:', error.code);
    } else {
      throw error;
    }
  }

  console.log('\n✨ Test complete!');
}

main().catch(console.error);
