// Export all Inngest functions
// Functions are registered with the Inngest serve handler

export { helloFunction } from './hello.js';
export { generateLongScriptFunction, generateOutlineOnlyFunction } from './generateLongScript.js';
export { generateScriptFunction } from './generateScript.js';

// Future functions to be added:
// export { generateAudio } from './audio.js';
// export { generateImage } from './image.js';
// export { generateVideo } from './video.js';
// export { exportProject } from './export.js';
