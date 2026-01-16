/**
 * Quick test script for Deepseek API
 * Run with: npx tsx scripts/test-deepseek.ts
 */

import { config } from 'dotenv';
import { createDeepseekClient } from '../src/backend/clients/deepseek.js';

// Load .env.local
config({ path: '.env.local' });

async function main() {
  console.log('Testing Deepseek API connection...\n');

  // Check if API key is present
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('❌ DEEPSEEK_API_KEY not found in .env.local');
    process.exit(1);
  }
  console.log('✓ API key found');

  try {
    const client = createDeepseekClient();
    console.log('✓ Client created\n');

    console.log('Generating a short test script (30 second video about cats)...\n');

    const script = await client.generateScript({
      topic: 'Why cats are great pets',
      targetDurationMinutes: 0.5, // 30 seconds
    });

    console.log('✓ Script generated successfully!\n');
    console.log('─'.repeat(50));
    console.log(`Title: ${script.title}`);
    console.log(`Sections: ${script.sections.length}`);
    console.log(`Total sentences: ${script.totalSentences}`);
    console.log(`Estimated duration: ${script.estimatedDurationMinutes} minutes`);
    console.log('─'.repeat(50));

    // Show first section preview
    if (script.sections.length > 0) {
      const firstSection = script.sections[0];
      console.log(`\nFirst section: "${firstSection.title}"`);
      if (firstSection.sentences.length > 0) {
        console.log(`  First sentence: "${firstSection.sentences[0].text}"`);
      }
    }

    console.log('\n✅ Deepseek API is working correctly!');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
