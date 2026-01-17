import { useState, useEffect, useCallback } from 'react';
import { BackendCharacter, CharactersListApiResponse, CharacterApiResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface UseCharactersReturn {
  characters: BackendCharacter[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createCharacter: (data: CreateCharacterData) => Promise<BackendCharacter | null>;
  updateCharacter: (id: string, data: UpdateCharacterData) => Promise<BackendCharacter | null>;
  deleteCharacter: (id: string) => Promise<boolean>;
  uploadImage: (characterId: string, file: File) => Promise<{ index: number; url: string } | null>;
  deleteImage: (characterId: string, index: number) => Promise<boolean>;
}

interface CreateCharacterData {
  name: string;
  description?: string;
  styleLora?: string;
}

interface UpdateCharacterData {
  name?: string;
  description?: string;
  styleLora?: string;
}

export function useCharacters(): UseCharactersReturn {
  const [characters, setCharacters] = useState<BackendCharacter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCharacters = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/v1/characters`);
      if (!response.ok) {
        throw new Error(`Failed to fetch characters: ${response.statusText}`);
      }
      const data: CharactersListApiResponse = await response.json();
      if (data.success) {
        setCharacters(data.data);
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
    fetchCharacters();
  }, [fetchCharacters]);

  const createCharacter = useCallback(async (data: CreateCharacterData): Promise<BackendCharacter | null> => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`Failed to create character: ${response.statusText}`);
      }
      const result: CharacterApiResponse = await response.json();
      if (result.success) {
        setCharacters(prev => [...prev, result.data]);
        return result.data;
      }
      return null;
    } catch (err) {
      console.error('Create character error:', err);
      return null;
    }
  }, []);

  const updateCharacter = useCallback(async (id: string, data: UpdateCharacterData): Promise<BackendCharacter | null> => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/characters/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`Failed to update character: ${response.statusText}`);
      }
      const result: CharacterApiResponse = await response.json();
      if (result.success) {
        setCharacters(prev => prev.map(c => c.id === id ? result.data : c));
        return result.data;
      }
      return null;
    } catch (err) {
      console.error('Update character error:', err);
      return null;
    }
  }, []);

  const deleteCharacter = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/characters/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`Failed to delete character: ${response.statusText}`);
      }
      setCharacters(prev => prev.filter(c => c.id !== id));
      return true;
    } catch (err) {
      console.error('Delete character error:', err);
      return false;
    }
  }, []);

  const uploadImage = useCallback(async (characterId: string, file: File): Promise<{ index: number; url: string } | null> => {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${API_BASE}/api/v1/characters/${characterId}/images`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`Failed to upload image: ${response.statusText}`);
      }
      const result = await response.json();
      if (result.index !== undefined && result.url) {
        // Refetch to get updated character with new image
        await fetchCharacters();
        return { index: result.index, url: result.url };
      }
      return null;
    } catch (err) {
      console.error('Upload image error:', err);
      return null;
    }
  }, [fetchCharacters]);

  const deleteImage = useCallback(async (characterId: string, index: number): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/characters/${characterId}/images/${index}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`Failed to delete image: ${response.statusText}`);
      }
      // Refetch to get updated character
      await fetchCharacters();
      return true;
    } catch (err) {
      console.error('Delete image error:', err);
      return false;
    }
  }, [fetchCharacters]);

  return {
    characters,
    isLoading,
    error,
    refetch: fetchCharacters,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    uploadImage,
    deleteImage,
  };
}
