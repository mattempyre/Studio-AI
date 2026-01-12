
export type ViewState = 'dashboard' | 'script' | 'voiceover' | 'storyboard' | 'video';

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

export interface Character {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  stylePrompt?: string; // The specific AI prompt used to generate this character
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
