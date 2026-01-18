import { useState, useEffect, useCallback } from 'react';
import { GenerationModel, GenerationModelsListApiResponse, GenerationModelApiResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface CreateModelData {
  name: string;
  description?: string;
  workflowCategory?: 'image' | 'video';
  workflowType?: 'text-to-image' | 'image-to-image' | 'image-to-video';
  defaultSteps?: number;
  defaultCfg?: number;
  defaultFrames?: number;
  defaultFps?: number;
}

interface UpdateModelData {
  name?: string;
  description?: string;
  workflowCategory?: 'image' | 'video';
  workflowType?: 'text-to-image' | 'image-to-image' | 'image-to-video';
  defaultSteps?: number;
  defaultCfg?: number;
  defaultFrames?: number;
  defaultFps?: number;
}

interface UseModelsReturn {
  models: GenerationModel[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createModel: (data: CreateModelData) => Promise<GenerationModel | null>;
  updateModel: (id: string, data: UpdateModelData) => Promise<GenerationModel | null>;
  deleteModel: (id: string) => Promise<boolean>;
  uploadWorkflow: (modelId: string, file: File) => Promise<GenerationModel | null>;
  getWorkflow: (modelId: string) => Promise<object | null>;
}

export function useModels(): UseModelsReturn {
  const [models, setModels] = useState<GenerationModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/v1/models`);
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
      const data: GenerationModelsListApiResponse = await response.json();
      if (data.success) {
        setModels(data.data);
      } else {
        throw new Error('API returned unsuccessful response');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const createModel = useCallback(async (data: CreateModelData): Promise<GenerationModel | null> => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`Failed to create model: ${response.statusText}`);
      }
      const result: GenerationModelApiResponse = await response.json();
      if (result.success) {
        setModels(prev => [...prev, result.data]);
        return result.data;
      }
      return null;
    } catch (err) {
      console.error('Create model error:', err);
      return null;
    }
  }, []);

  const updateModel = useCallback(async (id: string, data: UpdateModelData): Promise<GenerationModel | null> => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/models/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`Failed to update model: ${response.statusText}`);
      }
      const result: GenerationModelApiResponse = await response.json();
      if (result.success) {
        setModels(prev => prev.map(m => m.id === id ? result.data : m));
        return result.data;
      }
      return null;
    } catch (err) {
      console.error('Update model error:', err);
      return null;
    }
  }, []);

  const deleteModel = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/models/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`Failed to delete model: ${response.statusText}`);
      }
      setModels(prev => prev.filter(m => m.id !== id));
      return true;
    } catch (err) {
      console.error('Delete model error:', err);
      return false;
    }
  }, []);

  const uploadWorkflow = useCallback(async (modelId: string, file: File): Promise<GenerationModel | null> => {
    try {
      const formData = new FormData();
      formData.append('workflow', file);

      const response = await fetch(`${API_BASE}/api/v1/models/${modelId}/workflow`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`Failed to upload workflow: ${response.statusText}`);
      }
      const result: GenerationModelApiResponse = await response.json();
      if (result.success) {
        setModels(prev => prev.map(m => m.id === modelId ? result.data : m));
        return result.data;
      }
      return null;
    } catch (err) {
      console.error('Upload workflow error:', err);
      return null;
    }
  }, []);

  const getWorkflow = useCallback(async (modelId: string): Promise<object | null> => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/models/${modelId}/workflow`);
      if (!response.ok) {
        throw new Error(`Failed to get workflow: ${response.statusText}`);
      }
      const result = await response.json();
      if (result.success) {
        return result.data;
      }
      return null;
    } catch (err) {
      console.error('Get workflow error:', err);
      return null;
    }
  }, []);

  return {
    models,
    isLoading,
    error,
    refetch: fetchModels,
    createModel,
    updateModel,
    deleteModel,
    uploadWorkflow,
    getWorkflow,
  };
}
