/**
 * Types for Image Edit Modal
 */

export type EditMode = 'full' | 'inpaint';

export interface ImageEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imagePrompt: string;
  sceneId: string;
  projectId: string;
  onEditComplete: (newImageUrl: string) => void;
}

export interface MaskCanvasProps {
  imageUrl: string;
  brushSize: number;
  isErasing: boolean;
  onMaskChange: (maskDataUrl: string | null) => void;
}

export interface BrushControlsProps {
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  isErasing: boolean;
  onErasingChange: (isErasing: boolean) => void;
  onClearMask: () => void;
}

export interface EditModeSelectorProps {
  mode: EditMode;
  onModeChange: (mode: EditMode) => void;
}

export interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}

export interface EditImageRequest {
  editPrompt: string;
  editMode: EditMode;
  maskImage?: string; // Base64 PNG for inpaint mode
  seed?: number;
  steps?: number;
}

export interface EditImageResponse {
  success: boolean;
  data?: {
    jobId: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
  };
  error?: {
    code: string;
    message: string;
  };
}
