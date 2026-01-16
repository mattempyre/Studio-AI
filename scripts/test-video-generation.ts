/**
 * Quick video generation test
 */
import 'dotenv/config';
import { createComfyUIClient, ComfyUIError } from '../src/backend/clients/comfyui.js';
import { getVideoWorkflowPath } from '../workflows/config.js';
import { generateOutputPath, ensureOutputDir } from '../src/backend/services/outputPaths.js';

async function main() {
  // Use 'test' as project ID for test files
  const testProjectId = 'test';
  await ensureOutputDir(testProjectId, 'videos');

  const client = createComfyUIClient({
    baseUrl: process.env.COMFYUI_URL || 'http://localhost:8188',
    timeout: 600000, // 10 minutes for video
    maxRetries: 3,
  });

  console.log('🎬 Video Generation Test\n');
  console.log(`Server: ${process.env.COMFYUI_URL || 'http://localhost:8188'}\n`);

  // Check server
  const healthy = await client.healthCheck();
  if (!healthy) {
    console.log('❌ ComfyUI server is not available!');
    process.exit(1);
  }
  console.log('✅ Server is healthy\n');

  const inputImage = 'C:\\Git Repos\\Studio-AI\\image_test\\family.jpg';
  const prompt = `A smooth animated scene in a snowy winter park in a small town. The camera slowly pushes in from a wide shot toward the group of characters standing in the snow. The father leans forward and gestures with his hand while talking, his mouth moving naturally and his arm motion looping realistically. The two kids react with subtle head turns and blinking, looking up at him with small facial expressions. The mother stands in the background near the benches, slightly shifting her posture and blinking, looking unimpressed. Snow gently falls in the air, with soft wind movement in the trees. Background stays consistent with the bridge, benches, and lamppost with a Christmas wreath. Keep the original composition and perspective perfectly locked, clean cartoon animation style, smooth motion, no camera shake, natural timing`;

  console.log('📷 Input image:', inputImage);
  console.log('\n📝 Prompt:', prompt.slice(0, 100) + '...\n');

  const workflowPath = getVideoWorkflowPath('wan-2.2-14b');
  console.log('🔧 Workflow:', workflowPath);

  const outputPath = generateOutputPath(testProjectId, 'videos', 'family-video', 'mp4');
  console.log('📁 Output:', outputPath);
  console.log('\n⏳ Starting generation (this may take several minutes)...\n');

  try {
    const result = await client.generateVideo(
      workflowPath,
      {
        imageFile: inputImage,
        prompt: prompt,
        width: 1280,
        height: 720,
        frames: 81,
        fps: 16,
        seed: Math.floor(Math.random() * 1000000),
      },
      outputPath,
      (progress, message) => {
        const bar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
        process.stdout.write(`\r[${bar}] ${progress}% ${message || ''}                    `);
      }
    );

    console.log('\n\n✅ Video generated successfully!');
    console.log(`📁 Output: ${result}`);
  } catch (error) {
    if (error instanceof ComfyUIError) {
      console.log('\n\n❌ Generation failed:', error.message);
      console.log('   Code:', error.code);
      if (error.details) {
        console.log('   Details:', JSON.stringify(error.details, null, 2).slice(0, 500));
      }
    } else {
      throw error;
    }
  }
}

main().catch(console.error);
