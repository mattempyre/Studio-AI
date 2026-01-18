// Export all Inngest functions
// Functions are registered with the Inngest serve handler

export { helloFunction } from './hello.js';
export { generateLongScriptFunction, generateOutlineOnlyFunction } from './generateLongScript.js';
export { generateScriptFunction } from './generateScript.js';
export { generateAudioFunction } from './generateAudio.js';
export { generateImageFunction } from './generateImage.js';

// Future functions to be added:
// export { generateVideo } from './video.js';
// export { exportProject } from './export.js';
