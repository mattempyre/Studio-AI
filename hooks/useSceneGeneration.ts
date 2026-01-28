/**
 * useSceneGeneration Hook for Bulk Scene Generation
 * STORY-4-4: Hook for managing bulk scene (image/video) generation state and operations
 *
 * Features:
 * - Trigger bulk image/video generation for all sentences
 * - Track per-sentence generation status via WebSocket
 * - Cancel queued jobs
 * - Aggregate progress tracking
 * - Error collection and retry failed
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useWebSocket, type ProgressEvent, type JobCompleteEvent, type JobFailedEvent } from './useWebSocket';

// =============================================================================
// Types
// =============================================================================

export type SentenceSceneStatus = 'idle' | 'queued' | 'generating' | 'completed' | 'failed';

export interface SentenceSceneState {
  sentenceId: string;
  jobId?: string;
  status: SentenceSceneStatus;
  progress: number;
  jobType: 'image' | 'video';
  imageFile?: string;
  videoFile?: string;
  error?: string;
}

export interface BulkSceneGenerationResult {
  queued: {
    images: number;
    videos: number;
  };
  totalSentences: number;
  imageJobs: Array<{ sentenceId: string; jobId: string }>;
  videoJobs: Array<{ sentenceId: string; jobId: string }>;
  message: string;
}

export interface CancelSceneResult {
  cancelled: {
    images: number;
    videos: number;
  };
  jobIds: string[];
  message: string;
}

export interface RetryFailedResult {
  retried: number;
  jobs: Array<{ sentenceId: string; jobId: string; jobType: string }>;
  message: string;
}

export interface SceneStats {
  totalSentences: number;
  withImages: number;
  withVideos: number;
  needingImages: number;
  needingVideos: number;
  // STORY-5-4: Video-specific stats
  videoEligibleCount: number;  // Sentences with imageFile + videoPrompt
  existingVideoCount: number;  // Sentences with videoFile
}

export interface FailedSentence {
  sentenceId: string;
  jobType: 'image' | 'video';
  error: string;
}

export interface UseSceneGenerationOptions {
  /** Include video generation after images (default: true) */
  includeVideos?: boolean;
  /** Called when any sentence image completes */
  onImageComplete?: (sentenceId: string, imageFile: string) => void;
  /** Called when any sentence video completes */
  onVideoComplete?: (sentenceId: string, videoFile: string) => void;
  /** Called when any job fails */
  onJobFailed?: (sentenceId: string, jobType: 'image' | 'video', error: string) => void;
  /** Called when all generation completes */
  onAllComplete?: () => void;
}

// STORY-5-4: Bulk video generation result type
export interface BulkVideoGenerationResult {
  queued: number;
  totalSentences: number;
  videoJobs: Array<{ sentenceId: string; jobId: string }>;
  message: string;
}

export interface UseSceneGenerationReturn {
  /** Map of sentence ID to scene generation state */
  sentenceStates: Map<string, SentenceSceneState>;
  /** Whether any generation is currently in progress */
  isGenerating: boolean;
  /** Whether a bulk generation request is in progress */
  isLoading: boolean;
  /** Total number of sentences being processed */
  totalPending: number;
  /** Number of completed (images + videos) */
  completedCount: number;
  /** Number of failed jobs */
  failedCount: number;
  /** Overall progress percentage (0-100) */
  overallProgress: number;
  /** Number of images completed */
  imagesCompleted: number;
  /** Number of videos completed */
  videosCompleted: number;
  /** Total images queued */
  totalImages: number;
  /** Total videos queued */
  totalVideos: number;
  /** List of failed sentences */
  failedSentences: FailedSentence[];
  /** Scene statistics for determining button state */
  sceneStats: SceneStats | null;
  /** Whether existing content exists (for showing Re-Generate vs Generate) */
  hasExistingContent: boolean;
  /** STORY-5-4: Whether existing videos exist (for showing Re-Generate Videos vs Generate Videos) */
  hasExistingVideos: boolean;
  /** STORY-5-4: Whether videos can be generated (has eligible sentences) */
  canGenerateVideos: boolean;
  /** Fetch scene stats from the server */
  fetchSceneStats: () => Promise<SceneStats | null>;
  /** Start bulk scene generation */
  generateAll: (includeVideos?: boolean, force?: boolean) => Promise<BulkSceneGenerationResult | null>;
  /** STORY-5-4: Start bulk video generation only */
  generateAllVideos: (force?: boolean) => Promise<BulkVideoGenerationResult | null>;
  /** Cancel all queued generation jobs */
  cancelAll: () => Promise<CancelSceneResult | null>;
  /** Retry failed sentences */
  retryFailed: (sentenceIds?: string[]) => Promise<RetryFailedResult | null>;
  /** Get the status of a specific sentence */
  getSentenceStatus: (sentenceId: string) => SentenceSceneState | undefined;
  /** Clear all generation states */
  clearStates: () => void;
  /** Error message if generation failed to start */
  error: string | null;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// =============================================================================
// Hook Implementation
// =============================================================================

export function useSceneGeneration(
  projectId: string | null,
  options: UseSceneGenerationOptions = {}
): UseSceneGenerationReturn {
  const {
    includeVideos: defaultIncludeVideos = true,
    onImageComplete,
    onVideoComplete,
    onJobFailed,
    onAllComplete,
  } = options;

  // State
  const [sentenceStates, setSentenceStates] = useState<Map<string, SentenceSceneState>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalImages, setTotalImages] = useState(0);
  const [totalVideos, setTotalVideos] = useState(0);
  const [sceneStats, setSceneStats] = useState<SceneStats | null>(null);

  // Computed value: whether existing content exists
  const hasExistingContent = useMemo(() => {
    if (!sceneStats) return false;
    return sceneStats.withImages > 0 || sceneStats.withVideos > 0;
  }, [sceneStats]);

  // STORY-5-4: Whether existing videos exist
  const hasExistingVideos = useMemo(() => {
    if (!sceneStats) return false;
    return (sceneStats.existingVideoCount ?? sceneStats.withVideos) > 0;
  }, [sceneStats]);

  // STORY-5-4: Whether videos can be generated (has eligible sentences: imageFile + videoPrompt)
  const canGenerateVideos = useMemo(() => {
    if (!sceneStats) return false;
    // videoEligibleCount is sentences with both imageFile AND videoPrompt
    // Fall back to checking if there are any images (more permissive)
    return (sceneStats.videoEligibleCount ?? 0) > 0 || sceneStats.withImages > 0;
  }, [sceneStats]);

  // Fetch scene stats from the server
  const fetchSceneStats = useCallback(async (): Promise<SceneStats | null> => {
    if (!projectId) return null;

    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/scene-stats`);
      if (!response.ok) return null;

      const result = await response.json();
      const stats = result.data as SceneStats;
      setSceneStats(stats);
      return stats;
    } catch {
      return null;
    }
  }, [projectId]);

  // Fetch scene stats on mount and when projectId changes
  useEffect(() => {
    if (projectId) {
      fetchSceneStats();
    } else {
      setSceneStats(null);
    }
  }, [projectId, fetchSceneStats]);

  // Track batch progress separately (for video-batch and image-batch)
  const [batchProgress, setBatchProgress] = useState<number>(0);

  // WebSocket integration for real-time progress
  const { status: wsStatus } = useWebSocket(projectId, {
    onProgress: useCallback((event: ProgressEvent) => {
      // Handle batch progress events (no sentenceId, just overall progress)
      if (event.jobType === 'video-batch' || event.jobType === 'image-batch') {
        setBatchProgress(event.progress);
        return;
      }

      if (event.jobType !== 'image' && event.jobType !== 'video') return;
      if (!event.sentenceId) return;

      setSentenceStates(prev => {
        const updated = new Map(prev);
        const existing = updated.get(event.sentenceId!) || {
          sentenceId: event.sentenceId!,
          status: 'generating' as SentenceSceneStatus,
          progress: 0,
          jobType: event.jobType as 'image' | 'video',
        };

        updated.set(event.sentenceId!, {
          ...existing,
          jobId: event.jobId,
          status: 'generating',
          progress: event.progress,
          jobType: event.jobType as 'image' | 'video',
        });

        return updated;
      });
    }, []),

    onJobComplete: useCallback((event: JobCompleteEvent) => {
      // Debug logging for job completion
      console.log('[useSceneGeneration] job_complete event received:', {
        type: event.type,
        jobType: event.jobType,
        sentenceId: event.sentenceId,
        file: event.result?.file,
      });

      // Handle batch completion (reset batch progress)
      if (event.jobType === 'video-batch' || event.jobType === 'image-batch') {
        setBatchProgress(100);
        return;
      }

      if (event.jobType !== 'image' && event.jobType !== 'video') return;
      if (!event.sentenceId) return;

      const file = event.result?.file;
      const jobType = event.jobType as 'image' | 'video';

      setSentenceStates(prev => {
        const updated = new Map(prev);
        const existing = updated.get(event.sentenceId!) || {
          sentenceId: event.sentenceId!,
          status: 'completed' as SentenceSceneStatus,
          progress: 100,
          jobType,
        };

        updated.set(event.sentenceId!, {
          ...existing,
          jobId: event.jobId,
          status: 'completed',
          progress: 100,
          jobType,
          ...(jobType === 'image' ? { imageFile: file } : { videoFile: file }),
        });

        return updated;
      });

      if (file) {
        if (jobType === 'image') {
          onImageComplete?.(event.sentenceId!, file);
        } else {
          onVideoComplete?.(event.sentenceId!, file);
        }
      }
    }, [onImageComplete, onVideoComplete]),

    onJobFailed: useCallback((event: JobFailedEvent) => {
      // Handle batch failure
      if (event.jobType === 'video-batch' || event.jobType === 'image-batch') {
        setBatchProgress(0);
        return;
      }

      if (event.jobType !== 'image' && event.jobType !== 'video') return;
      if (!event.sentenceId) return;

      const jobType = event.jobType as 'image' | 'video';

      setSentenceStates(prev => {
        const updated = new Map(prev);
        updated.set(event.sentenceId!, {
          sentenceId: event.sentenceId!,
          jobId: event.jobId,
          status: 'failed',
          progress: 0,
          jobType,
          error: event.error,
        });
        return updated;
      });

      onJobFailed?.(event.sentenceId!, jobType, event.error);
    }, [onJobFailed]),
  });

  // Computed values
  const {
    isGenerating,
    totalPending,
    completedCount,
    failedCount,
    overallProgress,
    imagesCompleted,
    videosCompleted,
    failedSentences,
  } = useMemo(() => {
    const states = Array.from(sentenceStates.values());
    const generating = states.some(s => s.status === 'generating' || s.status === 'queued');
    const pending = states.filter(s => s.status === 'queued' || s.status === 'generating').length;
    const completed = states.filter(s => s.status === 'completed').length;
    const failed = states.filter(s => s.status === 'failed').length;

    const imagesComplete = states.filter(s => s.jobType === 'image' && s.status === 'completed').length;
    const videosComplete = states.filter(s => s.jobType === 'video' && s.status === 'completed').length;

    const total = states.length;
    const progress = total > 0
      ? Math.round(((completed + failed) / total) * 100)
      : 0;

    const failedList: FailedSentence[] = states
      .filter(s => s.status === 'failed')
      .map(s => ({
        sentenceId: s.sentenceId,
        jobType: s.jobType,
        error: s.error || 'Unknown error',
      }));

    return {
      isGenerating: generating,
      totalPending: pending,
      completedCount: completed,
      failedCount: failed,
      overallProgress: progress,
      imagesCompleted: imagesComplete,
      videosCompleted: videosComplete,
      failedSentences: failedList,
    };
  }, [sentenceStates]);

  // Check for all complete
  useEffect(() => {
    const states = Array.from(sentenceStates.values());
    if (states.length > 0 && !isGenerating && isLoading === false) {
      const allDone = states.every(s => s.status === 'completed' || s.status === 'failed');
      if (allDone && (completedCount > 0 || failedCount > 0)) {
        onAllComplete?.();
      }
    }
  }, [sentenceStates, isGenerating, isLoading, completedCount, failedCount, onAllComplete]);

  // Generate all scenes (images and optionally videos)
  // force: when true, regenerate all scenes regardless of existing files
  const generateAll = useCallback(async (includeVideos = defaultIncludeVideos, force = false): Promise<BulkSceneGenerationResult | null> => {
    if (!projectId) {
      setError('No project selected');
      return null;
    }

    setIsLoading(true);
    setError(null);
    setSentenceStates(new Map()); // Clear previous states

    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/generate-scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeVideos, force }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
        throw new Error(errorData.error?.message || 'Failed to start scene generation');
      }

      const result = await response.json();
      const data = result.data as BulkSceneGenerationResult;

      // Initialize sentence states for all queued jobs
      setSentenceStates(prev => {
        const updated = new Map(prev);

        // Add image jobs
        for (const job of data.imageJobs || []) {
          updated.set(job.sentenceId, {
            sentenceId: job.sentenceId,
            jobId: job.jobId,
            status: 'queued',
            progress: 0,
            jobType: 'image',
          });
        }

        // Add video jobs (they'll be processed after images)
        for (const job of data.videoJobs || []) {
          // Only add if not already tracking an image job for this sentence
          if (!updated.has(job.sentenceId)) {
            updated.set(job.sentenceId, {
              sentenceId: job.sentenceId,
              jobId: job.jobId,
              status: 'queued',
              progress: 0,
              jobType: 'video',
            });
          }
        }

        return updated;
      });

      // Track totals
      setTotalImages(data.imageJobs?.length || 0);
      setTotalVideos(data.videoJobs?.length || 0);

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [projectId, defaultIncludeVideos]);

  // STORY-5-4: Generate all videos only (AC: 33-37)
  const generateAllVideos = useCallback(async (force = false): Promise<BulkVideoGenerationResult | null> => {
    if (!projectId) {
      setError('No project selected');
      return null;
    }

    setIsLoading(true);
    setError(null);
    setSentenceStates(new Map()); // Clear previous states

    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/generate-videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
        throw new Error(errorData.error?.message || 'Failed to start video generation');
      }

      const result = await response.json();
      const data = result.data as BulkVideoGenerationResult;

      // Initialize sentence states for all queued video jobs
      setSentenceStates(prev => {
        const updated = new Map(prev);

        for (const job of data.videoJobs || []) {
          updated.set(job.sentenceId, {
            sentenceId: job.sentenceId,
            jobId: job.jobId,
            status: 'queued',
            progress: 0,
            jobType: 'video',
          });
        }

        return updated;
      });

      // Track totals
      setTotalImages(0);
      setTotalVideos(data.videoJobs?.length || 0);

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Cancel all queued jobs
  const cancelAll = useCallback(async (): Promise<CancelSceneResult | null> => {
    if (!projectId) {
      setError('No project selected');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/cancel-scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
        throw new Error(errorData.error?.message || 'Failed to cancel scene generation');
      }

      const result = await response.json();
      const data = result.data as CancelSceneResult;

      // Update sentence states for cancelled jobs
      setSentenceStates(prev => {
        const updated = new Map(prev);
        for (const [sentenceId, state] of updated) {
          if (state.status === 'queued') {
            updated.set(sentenceId, {
              ...state,
              status: 'failed',
              error: 'Cancelled by user',
            });
          }
        }
        return updated;
      });

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Retry failed sentences
  const retryFailed = useCallback(async (sentenceIds?: string[]): Promise<RetryFailedResult | null> => {
    if (!projectId) {
      setError('No project selected');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/retry-failed-scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentenceIds }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
        throw new Error(errorData.error?.message || 'Failed to retry failed scenes');
      }

      const result = await response.json();
      const data = result.data as RetryFailedResult;

      // Update sentence states for retried jobs
      setSentenceStates(prev => {
        const updated = new Map(prev);
        for (const job of data.jobs || []) {
          updated.set(job.sentenceId, {
            sentenceId: job.sentenceId,
            jobId: job.jobId,
            status: 'queued',
            progress: 0,
            jobType: job.jobType as 'image' | 'video',
          });
        }
        return updated;
      });

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Get status of a specific sentence
  const getSentenceStatus = useCallback((sentenceId: string): SentenceSceneState | undefined => {
    return sentenceStates.get(sentenceId);
  }, [sentenceStates]);

  // Clear all states
  const clearStates = useCallback(() => {
    setSentenceStates(new Map());
    setError(null);
    setTotalImages(0);
    setTotalVideos(0);
    setBatchProgress(0);
  }, []);

  return {
    sentenceStates,
    isGenerating,
    isLoading,
    totalPending,
    completedCount,
    failedCount,
    overallProgress,
    imagesCompleted,
    videosCompleted,
    totalImages,
    totalVideos,
    failedSentences,
    sceneStats,
    hasExistingContent,
    hasExistingVideos,
    canGenerateVideos,
    fetchSceneStats,
    generateAll,
    generateAllVideos,
    cancelAll,
    retryFailed,
    getSentenceStatus,
    clearStates,
    error,
  };
}

export default useSceneGeneration;
