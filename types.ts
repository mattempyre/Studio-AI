
export type ViewState = 'dashboard' | 'script' | 'voiceover' | 'storyboard' | 'video' | 'characters' | 'style-builder';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

export interface ScriptSection {
  id: string;
  title: string;
  content: string;
  duration: string;
  audioUrl?: string; // New field for persisting generated audio
}

// Word timing data for karaoke-style highlighting
export interface WordTimingData {
  word: string;
  startMs: number; // milliseconds relative to sentence start
  endMs: number;
  probability: number; // confidence from Whisper (0-1)
}

// Backend data model types (sections/sentences structure)
export interface BackendSentence {
  id: string;
  sectionId: string;
  text: string;
  order: number;
  imagePrompt: string | null;
  videoPrompt: string | null;
  cameraMovement: string;
  motionStrength: number;
  // Audio fields
  audioFile: string | null;
  audioDuration: number | null;
  audioStartMs: number | null; // Start time in section audio (batch generation)
  audioEndMs: number | null; // End time in section audio (batch generation)
  sectionAudioFile: string | null; // Path to section-level audio (batch generation)
  wordTimings: WordTimingData[] | null; // Word-level timings for karaoke highlighting
  // Image/video fields
  imageFile: string | null;
  videoFile: string | null;
  // Dirty flags
  isAudioDirty: boolean;
  isImageDirty: boolean;
  isVideoDirty: boolean;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface BackendSection {
  id: string;
  projectId: string;
  title: string;
  order: number;
  sentences: BackendSentence[];
  createdAt: Date | null;
}

export interface BackendProject {
  id: string;
  name: string;
  topic: string | null;
  targetDuration: number;
  modelId: string | null;  // Selected generation model ID
  styleId: string | null;  // Selected visual style ID
  visualStyle: string;     // Legacy field, kept for compatibility
  voiceId: string | null;
  status: string;
  sections: BackendSection[];
  cast: string[];
  characters?: Character[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  startTime: number; // in seconds relative to scene
}

export interface Source {
  title: string;
  uri: string;
}

// Frontend Character type (used in project cast, UI display)
export interface Character {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  stylePrompt?: string; // The specific AI prompt used to generate this character
}

// Backend Character type (from API, aligned with DB schema)
export interface BackendCharacter {
  id: string;
  name: string;
  description: string | null;
  referenceImages: string[];
  styleLora: string | null;
  createdAt: string | null;
}

// API response types for characters
export interface CharacterApiResponse {
  success: boolean;
  data: BackendCharacter;
}

export interface CharactersListApiResponse {
  success: boolean;
  data: BackendCharacter[];
}

// Generation Model types (ComfyUI workflow configurations)
export interface GenerationModel {
  id: string;
  name: string;
  description: string | null;
  workflowFile: string | null;
  workflowCategory: 'image' | 'video';
  workflowType: 'text-to-image' | 'image-to-image' | 'image-to-video';
  defaultSteps: number | null;
  defaultCfg: number | null;
  defaultFrames: number | null;  // For video models
  defaultFps: number | null;     // For video models
  isActive: boolean;
  createdAt: string | null;
}

export interface GenerationModelApiResponse {
  success: boolean;
  data: GenerationModel;
}

export interface GenerationModelsListApiResponse {
  success: boolean;
  data: GenerationModel[];
}

// Visual Style types (prompt prefixes and LoRA configurations)
export interface VisualStyle {
  id: string;
  name: string;
  description: string | null;
  styleType: 'prompt' | 'lora';
  promptPrefix: string | null;
  loraFile: string | null;
  loraStrength: number | null;
  compatibleModels: string[];
  requiresCharacterRef: boolean;
  isActive: boolean;
  createdAt: string | null;
}

export interface VisualStyleApiResponse {
  success: boolean;
  data: VisualStyle;
}

export interface VisualStylesListApiResponse {
  success: boolean;
  data: VisualStyle[];
}

export interface Scene {
  id: string;
  scriptSectionId: string;
  timestamp: string;
  narration: string;
  imagePrompt: string;
  videoPrompt?: string; // New field for video generation prompt
  imageUrl?: string;
  videoUrl?: string; // New field for generated video URL
  cameraMovement: string;
  visualStyle: string;
  trimStart?: number; // seconds
  trimEnd?: number; // seconds
}

export interface AudioClip {
  id: string;
  name: string;
  startTime: number; // Seconds on timeline
  duration: number; // Seconds
}

export interface AudioTrack {
  id: string;
  type: 'voice' | 'music' | 'sfx';
  name: string;
  volume: number;
  isMuted: boolean;
  clips: AudioClip[];
}

export interface Project {
  id: string;
  name: string;
  type: string;
  status: 'draft' | 'rendering' | 'completed';
  lastEdited: string;
  createdAt: string;
  thumbnail?: string;
  script: ScriptSection[];
  scenes: Scene[];
  textOverlays: TextOverlay[];
  voiceId?: string; // New field
  musicTrack?: string; // Deprecated in favor of audioTracks
  musicVolume?: number;
  audioTracks?: AudioTrack[]; // New field for multi-track audio
  progress: number;
  sources?: Source[];
  visualStyle?: string; // New field
  characters?: Character[]; // New field
}

export interface Template {
  id: string;
  title: string;
  description: string;
  duration: string;
  category: string;
  thumbnail: string;
  isPremium?: boolean;
  isNew?: boolean;
}

export interface Voice {
  id: string;
  name: string;
  category: 'platform' | 'cloned';
  style: string;
  gender: 'Male' | 'Female';
  previewUrl?: string;
}
