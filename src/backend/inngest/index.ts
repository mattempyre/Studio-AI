// Inngest configuration and exports
export { inngest, type StudioEvents } from './client.js';
export * from './functions/index.js';

// Collect all functions for the serve handler
import {
  helloFunction,
  generateLongScriptFunction,
  generateOutlineOnlyFunction,
  generateScriptFunction,
  generateAudioFunction,
  generateSectionAudioFunction,
  retroactiveAudioAlignmentFunction,
  generateImageFunction,
  generateImagePromptsFunction,
} from './functions/index.js';

// All functions to be registered with Inngest
// Add new functions here as they are created
export const functions = [
  helloFunction,
  generateLongScriptFunction,
  generateOutlineOnlyFunction,
  generateScriptFunction,
  generateAudioFunction,
  generateSectionAudioFunction,
  retroactiveAudioAlignmentFunction,
  generateImageFunction,
  generateImagePromptsFunction,
  // Future functions:
  // generateVideo,
  // exportProject,
];
