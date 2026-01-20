// Export all Inngest functions
// Functions are registered with the Inngest serve handler

export { helloFunction } from './hello.js';
export { generateLongScriptFunction, generateOutlineOnlyFunction } from './generateLongScript.js';
export { generateScriptFunction } from './generateScript.js';
export { generateAudioFunction } from './generateAudio.js';
export { generateSectionAudioFunction } from './generateSectionAudio.js';
export { retroactiveAudioAlignmentFunction } from './retroactiveAudioAlignment.js';
export { generateImageFunction } from './generateImage.js';
export { generateImageEditFunction } from './generateImageEdit.js';
export { generateImageBatchFunction } from './generateImageBatch.js';
export { generateImagePromptsFunction } from './generatePrompts.js';
export { generateVideoPromptsFunction } from './generateVideoPrompts.js';
export { generateVideoFunction, calculateFrameCount, DEFAULT_FPS, DEFAULT_DURATION_SECONDS } from './generateVideo.js';

// Future functions to be added:
// export { exportProject } from './export.js';
