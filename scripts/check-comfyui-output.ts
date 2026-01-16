/**
 * Check ComfyUI history for output files
 */
import 'dotenv/config';

const baseUrl = process.env.COMFYUI_URL || 'http://localhost:8188';

async function main() {
  console.log('Checking ComfyUI history...\n');

  // Get recent history
  const historyRes = await fetch(`${baseUrl}/history`);
  const history = await historyRes.json();

  const promptIds = Object.keys(history).slice(-3); // Last 3 jobs

  for (const promptId of promptIds) {
    const job = history[promptId];
    console.log(`\n📋 Prompt ID: ${promptId}`);
    console.log(`   Status: ${job.status?.status_str || 'unknown'}`);
    console.log(`   Completed: ${job.status?.completed}`);

    if (job.outputs) {
      console.log('   Outputs:');
      for (const [nodeId, output] of Object.entries(job.outputs)) {
        const out = output as any;
        if (out.images) {
          console.log(`     Node ${nodeId} (images):`, out.images);
        }
        if (out.gifs) {
          console.log(`     Node ${nodeId} (gifs):`, out.gifs);
        }
        if (out.videos) {
          console.log(`     Node ${nodeId} (videos):`, out.videos);
        }
        // Check for other output types
        const keys = Object.keys(out);
        for (const key of keys) {
          if (!['images', 'gifs', 'videos'].includes(key)) {
            console.log(`     Node ${nodeId} (${key}):`, out[key]);
          }
        }
      }
    }
  }

  // Also check what's in the output folder
  console.log('\n\nChecking /view endpoint for video folder...');
  try {
    const viewRes = await fetch(`${baseUrl}/view?filename=ComfyUI_00001_.mp4&subfolder=video&type=output`);
    console.log('Video file check:', viewRes.ok ? 'Found!' : `Not found (${viewRes.status})`);
  } catch (e) {
    console.log('Error checking video:', e);
  }
}

main().catch(console.error);
