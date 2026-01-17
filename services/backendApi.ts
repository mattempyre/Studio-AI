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
};

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
