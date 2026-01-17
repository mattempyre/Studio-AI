
export type ViewState = 'dashboard' | 'script' | 'voiceover' | 'storyboard' | 'video' | 'characters';

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
  audioFile: string | null;
  audioDuration: number | null;
  imageFile: string | null;
  videoFile: string | null;
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
  visualStyle: string;
  voiceId: string | null;
  status: string;
  sections: BackendSection[];
  cast: string[];
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
