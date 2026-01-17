import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCharacters } from '../../../hooks/useCharacters';

const API_BASE = 'http://localhost:3001';

describe('useCharacters hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetches characters on mount', async () => {
    const mockCharacters = [
      { id: 'char_1', name: 'Test', description: null, referenceImages: [], styleLora: null, createdAt: null },
    ];

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockCharacters }),
    });

    const { result } = renderHook(() => useCharacters());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.characters).toEqual(mockCharacters);
    expect(global.fetch).toHaveBeenCalledWith(`${API_BASE}/api/v1/characters`);
  });

  it('handles fetch error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error',
    });

    const { result } = renderHook(() => useCharacters());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.characters).toEqual([]);
  });

  it('creates a new character', async () => {
    const existingCharacters = [
      { id: 'char_1', name: 'Existing', description: null, referenceImages: [], styleLora: null, createdAt: null },
    ];
    const newCharacter = { id: 'char_2', name: 'New Character', description: 'Desc', referenceImages: [], styleLora: null, createdAt: null };

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: existingCharacters }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: newCharacter }),
      });

    const { result } = renderHook(() => useCharacters());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let createdChar;
    await act(async () => {
      createdChar = await result.current.createCharacter({ name: 'New Character', description: 'Desc' });
    });

    expect(createdChar).toEqual(newCharacter);
    expect(result.current.characters).toHaveLength(2);
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE}/api/v1/characters`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'New Character', description: 'Desc' }),
      })
    );
  });

  it('updates a character', async () => {
    const initialCharacter = { id: 'char_1', name: 'Original', description: null, referenceImages: [], styleLora: null, createdAt: null };
    const updatedCharacter = { ...initialCharacter, name: 'Updated' };

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [initialCharacter] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: updatedCharacter }),
      });

    const { result } = renderHook(() => useCharacters());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let updated;
    await act(async () => {
      updated = await result.current.updateCharacter('char_1', { name: 'Updated' });
    });

    expect(updated).toEqual(updatedCharacter);
    expect(result.current.characters[0].name).toBe('Updated');
  });

  it('deletes a character', async () => {
    const existingCharacter = { id: 'char_1', name: 'ToDelete', description: null, referenceImages: [], styleLora: null, createdAt: null };

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [existingCharacter] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { deleted: true } }),
      });

    const { result } = renderHook(() => useCharacters());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.characters).toHaveLength(1);

    let success;
    await act(async () => {
      success = await result.current.deleteCharacter('char_1');
    });

    expect(success).toBe(true);
    expect(result.current.characters).toHaveLength(0);
  });

  it('handles delete failure', async () => {
    const existingCharacter = { id: 'char_1', name: 'ToDelete', description: null, referenceImages: [], styleLora: null, createdAt: null };

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [existingCharacter] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

    const { result } = renderHook(() => useCharacters());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success;
    await act(async () => {
      success = await result.current.deleteCharacter('char_1');
    });

    expect(success).toBe(false);
    // Character should still be in list since delete failed
    expect(result.current.characters).toHaveLength(1);
  });

  it('can refetch characters', async () => {
    const initialCharacters = [
      { id: 'char_1', name: 'Initial', description: null, referenceImages: [], styleLora: null, createdAt: null },
    ];
    const updatedCharacters = [
      { id: 'char_1', name: 'Initial', description: null, referenceImages: [], styleLora: null, createdAt: null },
      { id: 'char_2', name: 'New', description: null, referenceImages: [], styleLora: null, createdAt: null },
    ];

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: initialCharacters }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: updatedCharacters }),
      });

    const { result } = renderHook(() => useCharacters());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.characters).toHaveLength(1);

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.characters).toHaveLength(2);
    });
  });
});
