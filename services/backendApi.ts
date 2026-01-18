import type { BackendProject, BackendSection, BackendSentence } from '../types';

const API_BASE = 'http://localhost:3001/api/v1';

// Generic API response handler
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
    throw new Error(error.error?.message || 'Request failed');
  }
  const data = await response.json();
  return data.data;
}

// Projects API
export const projectsApi = {
  list: async (): Promise<{ projects: BackendProject[] }> => {
    const response = await fetch(`${API_BASE}/projects`);
    return handleResponse(response);
  },

  get: async (id: string): Promise<BackendProject> => {
    const response = await fetch(`${API_BASE}/projects/${id}`);
    return handleResponse(response);
  },

  create: async (data: { name: string; topic?: string; targetDuration?: number; visualStyle?: string; voiceId?: string }): Promise<BackendProject> => {
    const response = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  update: async (id: string, data: Partial<{ name: string; topic: string; targetDuration: number; visualStyle: string; voiceId: string; status: string }>): Promise<BackendProject> => {
    const response = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Delete failed' } }));
      throw new Error(error.error?.message || 'Delete failed');
    }
  },

  addCast: async (projectId: string, characterId: string): Promise<any[]> => {
    const response = await fetch(`${API_BASE}/projects/${projectId}/cast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId }),
    });
    return handleResponse(response);
  },

  addCastBatch: async (projectId: string, characterIds: string[]): Promise<{ added: string[]; skipped: string[] }> => {
    const response = await fetch(`${API_BASE}/projects/${projectId}/cast/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterIds }),
    });
    return handleResponse(response);
  },

  removeCast: async (projectId: string, characterId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/projects/${projectId}/cast/${characterId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Remove cast failed' } }));
      throw new Error(error.error?.message || 'Remove cast failed');
    }
  },
};

// AI Expansion types
export interface GeneratedSentence {
  text: string;
  imagePrompt?: string;
  videoPrompt?: string;
}

export interface AIExpandResult {
  sectionId: string;
  sectionTitle: string;
  generatedSentences: GeneratedSentence[];
  insertPosition: number;
}

export interface AIExpandAcceptResult {
  sectionId: string;
  insertedCount: number;
  sentences: BackendSentence[];
}

// Sections API
export const sectionsApi = {
  get: async (id: string): Promise<BackendSection> => {
    const response = await fetch(`${API_BASE}/sections/${id}`);
    return handleResponse(response);
  },

  create: async (data: { projectId: string; title: string; order: number }): Promise<BackendSection> => {
    const response = await fetch(`${API_BASE}/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  update: async (id: string, data: Partial<{ title: string; order: number }>): Promise<BackendSection> => {
    const response = await fetch(`${API_BASE}/sections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/sections/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Delete failed' } }));
      throw new Error(error.error?.message || 'Delete failed');
    }
  },

  reorder: async (projectId: string, sectionIds: string[]): Promise<void> => {
    const response = await fetch(`${API_BASE}/sections/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, sectionIds }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Reorder failed' } }));
      throw new Error(error.error?.message || 'Reorder failed');
    }
  },

  // AI Section Expansion
  aiExpand: async (
    sectionId: string,
    data: {
      mode: 'quick' | 'guided';
      prompt?: string;
      sentenceCount: number;
      insertAfterSentenceId?: string;
    }
  ): Promise<AIExpandResult> => {
    const response = await fetch(`${API_BASE}/sections/${sectionId}/ai-expand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  aiExpandAccept: async (
    sectionId: string,
    data: {
      generatedSentences: GeneratedSentence[];
      insertAfterSentenceId?: string;
    }
  ): Promise<AIExpandAcceptResult> => {
    const response = await fetch(`${API_BASE}/sections/${sectionId}/ai-expand/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },
};

// Sentences API
export const sentencesApi = {
  get: async (id: string): Promise<BackendSentence> => {
    const response = await fetch(`${API_BASE}/sentences/${id}`);
    return handleResponse(response);
  },

  create: async (data: {
    sectionId: string;
    text: string;
    order: number;
    imagePrompt?: string;
    videoPrompt?: string;
    cameraMovement?: string;
    motionStrength?: number;
  }): Promise<BackendSentence> => {
    const response = await fetch(`${API_BASE}/sentences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  update: async (id: string, data: Partial<{
    text: string;
    order: number;
    imagePrompt: string;
    videoPrompt: string;
    cameraMovement: string;
    motionStrength: number;
  }>): Promise<BackendSentence> => {
    const response = await fetch(`${API_BASE}/sentences/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/sentences/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Delete failed' } }));
      throw new Error(error.error?.message || 'Delete failed');
    }
  },

  reorder: async (sectionId: string, sentenceIds: string[]): Promise<void> => {
    const response = await fetch(`${API_BASE}/sentences/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId, sentenceIds }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Reorder failed' } }));
      throw new Error(error.error?.message || 'Reorder failed');
    }
  },

  move: async (id: string, targetSectionId: string, targetOrder: number): Promise<BackendSentence> => {
    const response = await fetch(`${API_BASE}/sentences/${id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetSectionId, targetOrder }),
    });
    return handleResponse(response);
  },
};

// Scripts API
export interface QuickGenerateResult {
  title: string;
  sections: Array<{ id: string; title: string; sentenceCount: number }>;
  totalSentences: number;
  estimatedDurationMinutes: number;
}

// Async generation job result (Inngest)
export interface GenerateJobResult {
  jobId: string;
  status: 'queued';
  totalSections: number;
  estimatedDurationSeconds: number;
}

// SSE progress event types
export interface GenerationProgressEvent {
  type: 'connected' | 'progress' | 'complete' | 'error';
  data: {
    projectId?: string;
    jobId?: string;
    status?: string;
    currentSection?: number;
    totalSections?: number;
    currentSectionTitle?: string;
    percentComplete?: number;
    sectionsCompleted?: string[];
    totalSentences?: number;
    totalDurationMinutes?: number;
    error?: string;
  };
}

export const scriptsApi = {
  // Synchronous generation for short scripts (blocks until complete)
  quickGenerate: async (
    projectId: string,
    data: {
      topic: string;
      targetDurationMinutes: number;
      visualStyle?: string;
      useSearchGrounding?: boolean;
    }
  ): Promise<QuickGenerateResult> => {
    const response = await fetch(`${API_BASE}/projects/${projectId}/quick-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  // Async generation for long scripts (>15 min) - returns immediately with jobId
  generateLong: async (
    projectId: string,
    data: {
      topic: string;
      targetDurationMinutes: number;
      visualStyle?: string;
      mode?: 'auto' | 'from-outline';
      outlineId?: string;
    }
  ): Promise<GenerateJobResult> => {
    const response = await fetch(`${API_BASE}/projects/${projectId}/generate-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: data.mode || 'auto',
        topic: data.topic,
        targetDurationMinutes: data.targetDurationMinutes,
        visualStyle: data.visualStyle,
        outlineId: data.outlineId,
      }),
    });
    return handleResponse(response);
  },

  // Subscribe to generation progress via SSE
  subscribeToProgress: (
    projectId: string,
    callbacks: {
      onProgress?: (data: GenerationProgressEvent['data']) => void;
      onComplete?: (data: GenerationProgressEvent['data']) => void;
      onError?: (error: string) => void;
    }
  ): (() => void) => {
    const eventSource = new EventSource(`${API_BASE}/projects/${projectId}/generation-status`);

    eventSource.addEventListener('connected', (e) => {
      console.log('[SSE] Connected to generation status stream');
    });

    eventSource.addEventListener('progress', (e) => {
      try {
        const data = JSON.parse(e.data);
        callbacks.onProgress?.(data);
      } catch (err) {
        console.error('[SSE] Failed to parse progress event:', err);
      }
    });

    eventSource.addEventListener('complete', (e) => {
      try {
        const data = JSON.parse(e.data);
        callbacks.onComplete?.(data);
        eventSource.close();
      } catch (err) {
        console.error('[SSE] Failed to parse complete event:', err);
      }
    });

    eventSource.addEventListener('error', (e) => {
      // Check if this is an SSE error event with data
      if (e instanceof MessageEvent && e.data) {
        try {
          const data = JSON.parse(e.data);
          callbacks.onError?.(data.error || 'Unknown error');
        } catch {
          callbacks.onError?.('Connection error');
        }
      } else {
        // Connection error
        callbacks.onError?.('Connection lost');
      }
      eventSource.close();
    });

    // Return cleanup function
    return () => {
      eventSource.close();
    };
  },
};
