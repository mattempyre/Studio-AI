import { Scene, AudioTrack, TextOverlay, TimelineState } from '../../types';

export interface VideoEditorProps {
  scenes: Scene[];
  audioTracks: AudioTrack[];
  textOverlays: TextOverlay[];
  duration: number;
  onUpdateScenes: (scenes: Scene[]) => void;
  onUpdateAudioTracks: (tracks: AudioTrack[]) => void;
  onUpdateTextOverlays: (overlays: TextOverlay[]) => void;
  onExport?: () => void;
  onSave?: () => void;
  status?: 'draft' | 'rendering' | 'completed';
}

export interface TimelineClipProps {
  scene: Scene;
  pixelsPerSecond: number;
  isSelected: boolean;
  isDragging: boolean;
  onSelect: (sceneId: string) => void;
  onTrimStart: (sceneId: string, newTrimStart: number) => void;
  onTrimEnd: (sceneId: string, newTrimEnd: number) => void;
  onSlipOffsetChange?: (sceneId: string, offset: number) => void;
  onDragStart: (e: React.DragEvent, sceneId: string) => void;
  registerVideoRef: (sceneId: string, element: HTMLVideoElement | null) => void;
}

export interface TimeRulerProps {
  duration: number;
  pixelsPerSecond: number;
  scrollOffset: number;
}

export interface PlaybackControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlayback: () => void;
  onSeek: (time: number) => void;
}

export interface ZoomControlsProps {
  zoomLevel: number;
  onZoomChange: (level: number) => void;
}

export interface TimelineProps {
  scenes: Scene[];
  audioTracks: AudioTrack[];
  currentTime: number;
  duration: number;
  pixelsPerSecond: number;
  selectedClipId: string | null;
  isDragging: boolean;
  dropTargetIndex: number | null;
  onSelectClip: (sceneId: string) => void;
  onTrimStart: (sceneId: string, newTrimStart: number) => void;
  onTrimEnd: (sceneId: string, newTrimEnd: number) => void;
  onSlipOffsetChange?: (sceneId: string, offset: number) => void;
  onDragStart: (e: React.DragEvent, sceneId: string) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  registerVideoRef: (sceneId: string, element: HTMLVideoElement | null) => void;
  registerAudioRef?: (clipId: string, element: HTMLAudioElement | null) => void;
}

export type ToolType = 'none' | 'text' | 'music' | 'trim' | 'sfx';
