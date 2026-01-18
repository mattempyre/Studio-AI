import { useState, useEffect, useCallback } from 'react';
import { VisualStyle, VisualStylesListApiResponse, VisualStyleApiResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface CreateStyleData {
  name: string;
  description?: string;
  styleType: 'prompt' | 'lora';
  promptPrefix?: string;
  loraFile?: string;
  loraStrength?: number;
  compatibleModels?: string[];
  requiresCharacterRef?: boolean;
}

interface UpdateStyleData {
  name?: string;
  description?: string;
  styleType?: 'prompt' | 'lora';
  promptPrefix?: string;
  loraFile?: string;
  loraStrength?: number;
  compatibleModels?: string[];
  requiresCharacterRef?: boolean;
}

interface UseStylesReturn {
  styles: VisualStyle[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  fetchStylesForModel: (modelId: string) => Promise<VisualStyle[]>;
  createStyle: (data: CreateStyleData) => Promise<VisualStyle | null>;
  updateStyle: (id: string, data: UpdateStyleData) => Promise<VisualStyle | null>;
  deleteStyle: (id: string) => Promise<boolean>;
  getStyleById: (id: string) => VisualStyle | undefined;
  getPromptStyles: () => VisualStyle[];
  getLoraStyles: () => VisualStyle[];
}

export function useStyles(): UseStylesReturn {
  const [styles, setStyles] = useState<VisualStyle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStyles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/v1/styles`);
      if (!response.ok) {
        throw new Error(`Failed to fetch styles: ${response.statusText}`);
      }
      const data: VisualStylesListApiResponse = await response.json();
      if (data.success) {
        setStyles(data.data);
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
    fetchStyles();
  }, [fetchStyles]);

  const fetchStylesForModel = useCallback(async (modelId: string): Promise<VisualStyle[]> => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/styles?model=${encodeURIComponent(modelId)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch styles for model: ${response.statusText}`);
      }
      const data: VisualStylesListApiResponse = await response.json();
      if (data.success) {
        return data.data;
      }
      return [];
    } catch (err) {
      console.error('Fetch styles for model error:', err);
      return [];
    }
  }, []);

  const createStyle = useCallback(async (data: CreateStyleData): Promise<VisualStyle | null> => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/styles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`Failed to create style: ${response.statusText}`);
      }
      const result: VisualStyleApiResponse = await response.json();
      if (result.success) {
        setStyles(prev => [...prev, result.data]);
        return result.data;
      }
      return null;
    } catch (err) {
      console.error('Create style error:', err);
      return null;
    }
  }, []);

  const updateStyle = useCallback(async (id: string, data: UpdateStyleData): Promise<VisualStyle | null> => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/styles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`Failed to update style: ${response.statusText}`);
      }
      const result: VisualStyleApiResponse = await response.json();
      if (result.success) {
        setStyles(prev => prev.map(s => s.id === id ? result.data : s));
        return result.data;
      }
      return null;
    } catch (err) {
      console.error('Update style error:', err);
      return null;
    }
  }, []);

  const deleteStyle = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/styles/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`Failed to delete style: ${response.statusText}`);
      }
      setStyles(prev => prev.filter(s => s.id !== id));
      return true;
    } catch (err) {
      console.error('Delete style error:', err);
      return false;
    }
  }, []);

  const getStyleById = useCallback((id: string): VisualStyle | undefined => {
    return styles.find(s => s.id === id);
  }, [styles]);

  const getPromptStyles = useCallback((): VisualStyle[] => {
    return styles.filter(s => s.styleType === 'prompt');
  }, [styles]);

  const getLoraStyles = useCallback((): VisualStyle[] => {
    return styles.filter(s => s.styleType === 'lora');
  }, [styles]);

  return {
    styles,
    isLoading,
    error,
    refetch: fetchStyles,
    fetchStylesForModel,
    createStyle,
    updateStyle,
    deleteStyle,
    getStyleById,
    getPromptStyles,
    getLoraStyles,
  };
}
