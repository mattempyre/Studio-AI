/**
 * Unit Tests for useAudioGeneration Hook
 * STORY-3-3: Bulk Audio Generation
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAudioGeneration } from '../../hooks/useAudioGeneration';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the WebSocket hook
vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    status: 'connected',
  })),
}));

describe('useAudioGeneration', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should initialize with empty states', () => {
      const { result } = renderHook(() => useAudioGeneration('project-123'));

      expect(result.current.sentenceStates.size).toBe(0);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.totalPending).toBe(0);
      expect(result.current.completedCount).toBe(0);
      expect(result.current.failedCount).toBe(0);
      expect(result.current.overallProgress).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it('should return null when project ID is null', async () => {
      const { result } = renderHook(() => useAudioGeneration(null));

      let response;
      await act(async () => {
        response = await result.current.generateAll();
      });

      expect(response).toBeNull();
      expect(result.current.error).toBe('No project selected');
    });
  });

  describe('generateAll', () => {
    it('should queue audio generation jobs (per-sentence mode)', async () => {
      const mockResponse = {
        success: true,
        data: {
          queued: 3,
          total: 5,
          jobs: [
            { sentenceId: 's1', jobId: 'j1' },
            { sentenceId: 's2', jobId: 'j2' },
            { sentenceId: 's3', jobId: 'j3' },
          ],
          message: 'Queued 3 audio generation jobs',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      // Explicitly use per-sentence mode (default is now per-section)
      const { result } = renderHook(() => useAudioGeneration('project-123', { mode: 'per-sentence' }));

      let response;
      await act(async () => {
        response = await result.current.generateAll();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/projects/project-123/generate-audio',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      expect(response).toEqual(mockResponse.data);
      expect(result.current.sentenceStates.size).toBe(3);
      expect(result.current.sentenceStates.get('s1')?.status).toBe('queued');
      expect(result.current.sentenceStates.get('s2')?.status).toBe('queued');
      expect(result.current.sentenceStates.get('s3')?.status).toBe('queued');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          error: { message: 'Project not found' },
        }),
      });

      const { result } = renderHook(() => useAudioGeneration('project-123', { mode: 'per-sentence' }));

      let response;
      await act(async () => {
        response = await result.current.generateAll();
      });

      expect(response).toBeNull();
      expect(result.current.error).toBe('Project not found');
    });

    it('should handle no dirty sentences gracefully', async () => {
      const mockResponse = {
        success: true,
        data: {
          queued: 0,
          message: 'All sentences already have up-to-date audio',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useAudioGeneration('project-123', { mode: 'per-sentence' }));

      let response;
      await act(async () => {
        response = await result.current.generateAll();
      });

      expect(response?.queued).toBe(0);
      expect(result.current.sentenceStates.size).toBe(0);
    });
  });

  describe('cancelAll', () => {
    it('should cancel queued jobs', async () => {
      // First, queue some jobs
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            queued: 2,
            jobs: [
              { sentenceId: 's1', jobId: 'j1' },
              { sentenceId: 's2', jobId: 'j2' },
            ],
          },
        }),
      });

      const { result } = renderHook(() => useAudioGeneration('project-123', { mode: 'per-sentence' }));

      await act(async () => {
        await result.current.generateAll();
      });

      // Now cancel
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            cancelled: 2,
            jobIds: ['j1', 'j2'],
            message: 'Cancelled 2 queued jobs',
          },
        }),
      });

      let cancelResponse;
      await act(async () => {
        cancelResponse = await result.current.cancelAll();
      });

      expect(cancelResponse?.cancelled).toBe(2);
      // Queued jobs should be marked as failed with cancel message
      expect(result.current.sentenceStates.get('s1')?.status).toBe('failed');
      expect(result.current.sentenceStates.get('s1')?.error).toBe('Cancelled by user');
    });

    it('should handle cancel with no queued jobs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            cancelled: 0,
            message: 'No queued jobs to cancel',
          },
        }),
      });

      const { result } = renderHook(() => useAudioGeneration('project-123', { mode: 'per-sentence' }));

      let cancelResponse;
      await act(async () => {
        cancelResponse = await result.current.cancelAll();
      });

      expect(cancelResponse?.cancelled).toBe(0);
    });
  });

  describe('getSentenceStatus', () => {
    it('should return undefined for unknown sentences', () => {
      const { result } = renderHook(() => useAudioGeneration('project-123', { mode: 'per-sentence' }));

      const status = result.current.getSentenceStatus('unknown-id');
      expect(status).toBeUndefined();
    });

    it('should return correct status for tracked sentences', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            queued: 1,
            jobs: [{ sentenceId: 's1', jobId: 'j1' }],
          },
        }),
      });

      const { result } = renderHook(() => useAudioGeneration('project-123', { mode: 'per-sentence' }));

      await act(async () => {
        await result.current.generateAll();
      });

      const status = result.current.getSentenceStatus('s1');
      expect(status).toBeDefined();
      expect(status?.status).toBe('queued');
      expect(status?.jobId).toBe('j1');
    });
  });

  describe('clearStates', () => {
    it('should clear all sentence states and error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            queued: 2,
            jobs: [
              { sentenceId: 's1', jobId: 'j1' },
              { sentenceId: 's2', jobId: 'j2' },
            ],
          },
        }),
      });

      const { result } = renderHook(() => useAudioGeneration('project-123', { mode: 'per-sentence' }));

      await act(async () => {
        await result.current.generateAll();
      });

      expect(result.current.sentenceStates.size).toBe(2);

      act(() => {
        result.current.clearStates();
      });

      expect(result.current.sentenceStates.size).toBe(0);
      expect(result.current.error).toBeNull();
    });
  });

  describe('computed values', () => {
    it('should calculate isGenerating correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            queued: 1,
            jobs: [{ sentenceId: 's1', jobId: 'j1' }],
          },
        }),
      });

      const { result } = renderHook(() => useAudioGeneration('project-123', { mode: 'per-sentence' }));

      expect(result.current.isGenerating).toBe(false);

      await act(async () => {
        await result.current.generateAll();
      });

      // Should be true because we have queued jobs
      expect(result.current.isGenerating).toBe(true);
    });
  });
});
