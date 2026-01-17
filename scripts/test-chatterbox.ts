/**
 * Manual test script for Chatterbox TTS integration
 *
 * Usage: npx tsx scripts/test-chatterbox.ts
 *
 * Options:
 *   --generate [voice]     Generate speech with a predefined voice
 *   --all-voices           Test multiple voices
 *   --clone <audio-file>   Upload reference audio and generate with cloned voice
 *   --list-refs            List uploaded reference audio files
 *
 * Prerequisites:
 * - Chatterbox TTS running on localhost:8004 (or CHATTERBOX_URL)
 */

import 'dotenv/config';
import { createChatterboxClient, ChatterboxError, type VoiceInfo } from '../src/backend/clients/chatterbox.js';
import { generateOutputPath, ensureOutputDir } from '../src/backend/services/outputPaths.js';
import * as path from 'path';

async function main() {
  // Use 'test' as project ID for test files
  const testProjectId = 'test';
  await ensureOutputDir(testProjectId, 'audio');

  const client = createChatterboxClient({
    baseUrl: process.env.CHATTERBOX_URL || 'http://localhost:8004',
    timeout: 60000, // 1 minute
    maxRetries: 3,
  });

  console.log('🎤 Chatterbox TTS Client Test\n');
  console.log(`Server: ${process.env.CHATTERBOX_URL || 'http://localhost:8004'}\n`);

  // Test 1: Health Check
  console.log('1️⃣  Testing server connection...');
  const healthy = await client.healthCheck();
  if (!healthy) {
    console.log('❌ Chatterbox server is not available!');
    console.log('   Make sure Chatterbox is running on localhost:8004');
    console.log('   Or set CHATTERBOX_URL in your .env.local file');
    process.exit(1);
  }
  console.log('✅ Server is healthy!\n');

  // Test 2: Get Available Voices
  console.log('2️⃣  Getting available voices...');
  let voices: VoiceInfo[] = [];
  try {
    voices = await client.getVoices();
    console.log(`✅ Found ${voices.length} voices:`);
    const voiceNames = voices.map(v => v.display_name).slice(0, 10);
    console.log(`   ${voiceNames.join(', ')}${voices.length > 10 ? '...' : ''}`);
    console.log('');
  } catch (error) {
    console.log('⚠️  Could not get voices:', (error as Error).message);
    console.log('');
  }

  // Test 3: Generate Speech
  console.log('3️⃣  Generating speech...');
  const testText = 'Hello! This is a test of the Chatterbox text to speech system. The quick brown fox jumps over the lazy dog.';
  console.log(`   Text: "${testText}"\n`);

  // Check for --generate flag
  if (process.argv.includes('--generate')) {
    const voiceArg = process.argv[process.argv.indexOf('--generate') + 1];
    // Use provided voice, or first available from server, or default to Emily
    const voice = voiceArg && !voiceArg.startsWith('-')
      ? voiceArg
      : (voices.length > 0 ? voices[0].display_name : 'Emily');
    console.log(`   Voice: ${voice}`);

    try {
      const outputPath = generateOutputPath(testProjectId, 'audio', 'test-speech', 'wav');
      console.log(`   Output: ${outputPath}\n`);
      console.log('   ⏳ Generating...');

      const startTime = Date.now();
      const result = await client.generateSpeech(
        {
          text: testText,
          voice: voice,
        },
        outputPath
      );
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('\n✅ Speech generated successfully!');
      console.log(`   File: ${result.filePath}`);
      console.log(`   Duration: ${result.durationMs}ms (${(result.durationMs / 1000).toFixed(2)}s)`);
      console.log(`   Size: ${(result.fileSizeBytes / 1024).toFixed(2)} KB`);
      console.log(`   Generation time: ${elapsed}s`);
    } catch (error) {
      if (error instanceof ChatterboxError) {
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
    console.log('ℹ️  Run with --generate flag to test speech generation:');
    console.log('   npx tsx scripts/test-chatterbox.ts --generate');
    console.log('   npx tsx scripts/test-chatterbox.ts --generate puck');
    console.log('   npx tsx scripts/test-chatterbox.ts --generate kore');
  }

  // Test 4: Generate with multiple voices
  if (process.argv.includes('--all-voices')) {
    console.log('\n4️⃣  Testing multiple voices...\n');

    // Use first 5 voices from server, or fallback
    const testVoices = voices.length > 0
      ? voices.slice(0, 5).map(v => v.display_name)
      : ['Emily', 'Michael', 'Alice', 'Thomas', 'Olivia'];
    const shortText = 'Testing voice preset.';

    for (const voice of testVoices) {
      console.log(`   Testing voice: ${voice}...`);
      try {
        const outputPath = generateOutputPath(testProjectId, 'audio', `voice-${voice.toLowerCase()}`, 'wav');
        const result = await client.generateSpeech(
          { text: shortText, voice },
          outputPath
        );
        console.log(`   ✅ ${voice}: ${result.durationMs}ms, ${(result.fileSizeBytes / 1024).toFixed(2)} KB`);
      } catch (error) {
        console.log(`   ❌ ${voice}: ${(error as Error).message}`);
      }
    }
  }

  // Test 5: List uploaded reference files
  if (process.argv.includes('--list-refs')) {
    console.log('\n5️⃣  Listing uploaded reference files...\n');

    try {
      const refFiles = await client.getUploadedReferenceFiles();
      if (refFiles.length === 0) {
        console.log('   No reference files uploaded yet.');
        console.log('   Use --clone <audio-file> to upload and test voice cloning.');
      } else {
        console.log(`   Found ${refFiles.length} reference file(s):`);
        for (const file of refFiles) {
          console.log(`   • ${file}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Error: ${(error as Error).message}`);
    }
  }

  // Test 6: Voice cloning
  const cloneIndex = process.argv.indexOf('--clone');
  if (cloneIndex !== -1) {
    const audioFilePath = process.argv[cloneIndex + 1];

    if (!audioFilePath || audioFilePath.startsWith('-')) {
      console.log('\n❌ Error: --clone requires an audio file path');
      console.log('   Usage: npx tsx scripts/test-chatterbox.ts --clone path/to/voice.wav');
      process.exit(1);
    }

    console.log('\n6️⃣  Testing voice cloning...\n');
    console.log(`   Reference audio: ${audioFilePath}`);

    try {
      // Step 1: Upload reference audio
      console.log('\n   📤 Uploading reference audio...');
      const uploadResult = await client.uploadReferenceAudio(audioFilePath);
      console.log(`   ✅ Uploaded: ${uploadResult.filename}`);

      // Step 2: Generate speech with cloned voice
      console.log('\n   🎙️  Generating speech with cloned voice...');
      const cloneText = 'Hello! This is a test of voice cloning with Chatterbox. The quick brown fox jumps over the lazy dog.';
      console.log(`   Text: "${cloneText}"\n`);

      const outputPath = generateOutputPath(testProjectId, 'audio', `cloned-${path.parse(audioFilePath).name}`, 'wav');
      console.log(`   Output: ${outputPath}`);
      console.log('   ⏳ Generating...');

      const startTime = Date.now();
      const result = await client.generateSpeech(
        {
          text: cloneText,
          referenceAudioFilename: uploadResult.filename,
        },
        outputPath
      );
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('\n   ✅ Cloned speech generated successfully!');
      console.log(`   File: ${result.filePath}`);
      console.log(`   Duration: ${result.durationMs}ms (${(result.durationMs / 1000).toFixed(2)}s)`);
      console.log(`   Size: ${(result.fileSizeBytes / 1024).toFixed(2)} KB`);
      console.log(`   Generation time: ${elapsed}s`);

    } catch (error) {
      if (error instanceof ChatterboxError) {
        console.log('\n   ❌ Voice cloning failed:', error.message);
        console.log('   Error code:', error.code);
        if (error.details) {
          console.log('   Details:', JSON.stringify(error.details, null, 2));
        }
      } else {
        throw error;
      }
    }
  }

  console.log('\n✨ Test complete!');
}

main().catch(console.error);
