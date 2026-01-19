/**
 * useAudioGeneration Hook for Bulk Audio Generation
 * STORY-3-3: Hook for managing bulk audio generation state and operations
 *
 * Features:
 * - Trigger bulk audio generation for all dirty sentences
 * - Track per-sentence generation status via WebSocket
 * - Cancel queued jobs
 * - Aggregate progress tracking
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useWebSocket, type ProgressEvent, type JobCompleteEvent, type JobFailedEvent } from './useWebSocket';

// =============================================================================
// Types
// =============================================================================

export type SentenceAudioStatus = 'idle' | 'queued' | 'generating' | 'completed' | 'failed';

export interface SentenceAudioState {
  sentenceId: string;
  jobId?: string;
  status: SentenceAudioStatus;
  progress: number;
  audioFile?: string;
  audioDuration?: number;
  error?: string;
}

export interface BulkGenerationResult {
  queued: number;
  total: number;
  jobs: Array<{ sentenceId: string; jobId: string }>;
  message: string;
}

export interface CancelResult {
  cancelled: number;
  jobIds: string[];
  message: string;
}

export type AudioGenerationMode = 'per-sentence' | 'per-section';

export interface SectionGenerationResult {
  queued: number;
  totalSentences: number;
  sections: Array<{
    sectionId: string;
    jobId: string;
    sentenceCount: number;
    sentenceIds: string[];
  }>;
  message: string;
}

export interface UseAudioGenerationOptions {
  /** Generation mode: 'per-sentence' (individual) or 'per-section' (batch with Whisper) */
  mode?: AudioGenerationMode;
  /** Called when any sentence audio completes */
  onSentenceComplete?: (sentenceId: string, audioFile: string, duration?: number) => void;
  /** Called when any sentence audio fails */
  onSentenceFailed?: (sentenceId: string, error: string) => void;
  /** Called when a section's audio generation completes (for refetching project data with wordTimings) */
  onSectionComplete?: (sectionId: string) => void;
  /** Called when all audio generation completes */
  onAllComplete?: () => void;
}

export interface UseAudioGenerationReturn {
  /** Map of sentence ID to audio generation state */
  sentenceStates: Map<string, SentenceAudioState>;
  /** Whether any audio is currently being generated */
  isGenerating: boolean;
  /** Whether a bulk generation request is in progress */
  isLoading: boolean;
  /** Total number of sentences being processed */
  totalPending: number;
  /** Number of sentences completed */
  completedCount: number;
  /** Number of sentences failed */
  failedCount: number;
  /** Overall progress percentage (0-100) */
  overallProgress: number;
  /** Current generation mode */
  mode: AudioGenerationMode;
  /** Start bulk audio generation for all dirty sentences */
  generateAll: () => Promise<BulkGenerationResult | SectionGenerationResult | null>;
  /** Cancel all queued generation jobs */
  cancelAll: () => Promise<CancelResult | null>;
  /** Switch generation mode */
  setMode: (mode: AudioGenerationMode) => void;
  /** Get the status of a specific sentence */
  getSentenceStatus: (sentenceId: string) => SentenceAudioState | undefined;
  /** Clear all generation states */
  clearStates: () => void;
  /** Force regenerate all audio (marks all as dirty first) */
  forceRegenerate: () => Promise<BulkGenerationResult | SectionGenerationResult | null>;
  /** Generate audio for a specific section */
  generateSection: (sectionId: string) => Promise<SectionGenerationResult | null>;
  /** Error message if generation failed to start */
  error: string | null;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// =============================================================================
// Hook Implementation
// =============================================================================

export function useAudioGeneration(
  projectId: string | null,
  options: UseAudioGenerationOptions = {}
): UseAudioGenerationReturn {
  const { mode: initialMode = 'per-section', onSentenceComplete, onSentenceFailed, onSectionComplete, onAllComplete } = options;

  // State
  const [sentenceStates, setSentenceStates] = useState<Map<string, SentenceAudioState>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AudioGenerationMode>(initialMode);

  // WebSocket integration for real-time progress
  const { status: wsStatus } = useWebSocket(projectId, {
    onProgress: useCallback((event: ProgressEvent) => {
      if (event.jobType !== 'audio' || !event.sentenceId) return;

      setSentenceStates(prev => {
        const updated = new Map(prev);
        const existing = updated.get(event.sentenceId!) || {
          sentenceId: event.sentenceId!,
          status: 'generating' as SentenceAudioStatus,
          progress: 0,
        };

        updated.set(event.sentenceId!, {
          ...existing,
          jobId: event.jobId,
          status: 'generating',
          progress: event.progress,
        });

        return updated;
      });
    }, []),

    onJobComplete: useCallback((event: JobCompleteEvent) => {
      if (event.jobType !== 'audio') return;

      // Handle section completion (triggers project refetch for wordTimings)
      // This is when a section job completes without a specific sentence
      if (event.sectionId && !event.sentenceId) {
        console.log('[Audio] Section completed, triggering refetch:', event.sectionId);
        onSectionComplete?.(event.sectionId);
        return;
      }

      // Handle individual sentence completion
      if (!event.sentenceId) return;

      const audioFile = event.result.file;
      const duration = event.result.duration;
      const startMs = event.result.startMs;
      const endMs = event.result.endMs;

      setSentenceStates(prev => {
        const updated = new Map(prev);
        updated.set(event.sentenceId!, {
          sentenceId: event.sentenceId!,
          jobId: event.jobId,
          status: 'completed',
          progress: 100,
          audioFile,
          audioDuration: duration ?? (endMs !== undefined && startMs !== undefined ? endMs - startMs : undefined),
        });
        return updated;
      });

      if (audioFile) {
        onSentenceComplete?.(event.sentenceId!, audioFile, duration ?? (endMs !== undefined && startMs !== undefined ? endMs - startMs : undefined));
      }
    }, [onSentenceComplete, onSectionComplete]),

    onJobFailed: useCallback((event: JobFailedEvent) => {
      if (event.jobType !== 'audio' || !event.sentenceId) return;

      setSentenceStates(prev => {
        const updated = new Map(prev);
        updated.set(event.sentenceId!, {
          sentenceId: event.sentenceId!,
          jobId: event.jobId,
          status: 'failed',
          progress: 0,
          error: event.error,
        });
        return updated;
      });

      onSentenceFailed?.(event.sentenceId!, event.error);
    }, [onSentenceFailed]),
  });

  // Computed values
  const { isGenerating, totalPending, completedCount, failedCount, overallProgress } = useMemo(() => {
    const states = Array.from(sentenceStates.values());
    const generating = states.some(s => s.status === 'generating' || s.status === 'queued');
    const pending = states.filter(s => s.status === 'queued' || s.status === 'generating').length;
    const completed = states.filter(s => s.status === 'completed').length;
    const failed = states.filter(s => s.status === 'failed').length;

    const total = states.length;
    const progress = total > 0
      ? Math.round(((completed + failed) / total) * 100)
      : 0;

    return {
      isGenerating: generating,
      totalPending: pending,
      completedCount: completed,
      failedCount: failed,
      overallProgress: progress,
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

  // Generate audio for all dirty sentences (supports both modes)
  const generateAll = useCallback(async (): Promise<BulkGenerationResult | SectionGenerationResult | null> => {
    if (!projectId) {
      setError('No project selected');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Choose endpoint based on mode
      const endpoint = mode === 'per-section'
        ? `${API_BASE}/api/v1/projects/${projectId}/generate-section-audio`
        : `${API_BASE}/api/v1/projects/${projectId}/generate-audio`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
        throw new Error(errorData.error?.message || 'Failed to start audio generation');
      }

      const result = await response.json();

      if (mode === 'per-section') {
        // Section mode: initialize states for all sentences in queued sections
        const data = result.data as SectionGenerationResult;

        // Initialize sentence states for all sentences in queued sections
        if (data.sections && data.sections.length > 0) {
          setSentenceStates(prev => {
            const updated = new Map(prev);
            for (const section of data.sections) {
              if (section.sentenceIds) {
                for (const sentenceId of section.sentenceIds) {
                  updated.set(sentenceId, {
                    sentenceId,
                    jobId: section.jobId,
                    status: 'queued',
                    progress: 0,
                  });
                }
              }
            }
            return updated;
          });
        }

        return data;
      } else {
        // Per-sentence mode: existing behavior
        const data = result.data as BulkGenerationResult;

        // Initialize sentence states for queued jobs (if any)
        if (data.jobs && data.jobs.length > 0) {
          setSentenceStates(prev => {
            const updated = new Map(prev);
            for (const job of data.jobs) {
              updated.set(job.sentenceId, {
                sentenceId: job.sentenceId,
                jobId: job.jobId,
                status: 'queued',
                progress: 0,
              });
            }
            return updated;
          });
        }

        return data;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [projectId, mode]);

  // Cancel all queued jobs
  const cancelAll = useCallback(async (): Promise<CancelResult | null> => {
    if (!projectId) {
      setError('No project selected');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/cancel-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
        throw new Error(errorData.error?.message || 'Failed to cancel audio generation');
      }

      const result = await response.json();
      const data = result.data as CancelResult;

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

  // Get status of a specific sentence
  const getSentenceStatus = useCallback((sentenceId: string): SentenceAudioState | undefined => {
    return sentenceStates.get(sentenceId);
  }, [sentenceStates]);

  // Clear all states
  const clearStates = useCallback(() => {
    setSentenceStates(new Map());
    setError(null);
  }, []);

  // Force regenerate all audio (marks all as dirty first, then generates)
  const forceRegenerate = useCallback(async (): Promise<BulkGenerationResult | SectionGenerationResult | null> => {
    if (!projectId) {
      setError('No project selected');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First, mark all audio as dirty
      const markResponse = await fetch(`${API_BASE}/api/v1/projects/${projectId}/mark-audio-dirty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!markResponse.ok) {
        const errorData = await markResponse.json().catch(() => ({ error: { message: 'Request failed' } }));
        throw new Error(errorData.error?.message || 'Failed to mark audio for regeneration');
      }

      // Then trigger generation (reuse generateAll logic but inline to avoid dependency issues)
      const endpoint = mode === 'per-section'
        ? `${API_BASE}/api/v1/projects/${projectId}/generate-section-audio`
        : `${API_BASE}/api/v1/projects/${projectId}/generate-audio`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
        throw new Error(errorData.error?.message || 'Failed to start audio generation');
      }

      const result = await response.json();

      if (mode === 'per-section') {
        const data = result.data as SectionGenerationResult;
        // Initialize sentence states for all sentences in queued sections
        if (data.sections && data.sections.length > 0) {
          setSentenceStates(prev => {
            const updated = new Map(prev);
            for (const section of data.sections) {
              if (section.sentenceIds) {
                for (const sentenceId of section.sentenceIds) {
                  updated.set(sentenceId, {
                    sentenceId,
                    jobId: section.jobId,
                    status: 'queued',
                    progress: 0,
                  });
                }
              }
            }
            return updated;
          });
        }
        return data;
      } else {
        const data = result.data as BulkGenerationResult;
        if (data.jobs && data.jobs.length > 0) {
          setSentenceStates(prev => {
            const updated = new Map(prev);
            for (const job of data.jobs) {
              updated.set(job.sentenceId, {
                sentenceId: job.sentenceId,
                jobId: job.jobId,
                status: 'queued',
                progress: 0,
              });
            }
            return updated;
          });
        }
        return data;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [projectId, mode]);

  // Generate audio for a specific section
  const generateSection = useCallback(async (sectionId: string): Promise<SectionGenerationResult | null> => {
    if (!projectId) {
      setError('No project selected');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First mark the section's sentences as dirty to force regeneration
      await fetch(`${API_BASE}/api/v1/projects/${projectId}/mark-audio-dirty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId }),
      });

      // Then trigger section-specific audio generation
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/generate-section-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
        throw new Error(errorData.error?.message || 'Failed to start section audio generation');
      }

      const result = await response.json();
      const data = result.data as SectionGenerationResult;

      // Initialize sentence states for sentences in this section
      if (data.sections && data.sections.length > 0) {
        setSentenceStates(prev => {
          const updated = new Map(prev);
          for (const section of data.sections) {
            if (section.sentenceIds) {
              for (const sentenceId of section.sentenceIds) {
                updated.set(sentenceId, {
                  sentenceId,
                  jobId: section.jobId,
                  status: 'queued',
                  progress: 0,
                });
              }
            }
          }
          return updated;
        });
      }

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  return {
    sentenceStates,
    isGenerating,
    isLoading,
    totalPending,
    completedCount,
    failedCount,
    overallProgress,
    mode,
    generateAll,
    cancelAll,
    setMode,
    getSentenceStatus,
    clearStates,
    forceRegenerate,
    generateSection,
    error,
  };
}

export default useAudioGeneration;
