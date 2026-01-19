/**
 * AudioToolbar Component
 * STORY-3-3: Bulk audio generation controls for ScriptEditorV2
 *
 * Features:
 * - "Generate All" button to queue audio for all dirty sentences
 * - Mode toggle: per-sentence (individual) vs per-section (batch with Whisper)
 * - Overall progress bar during generation
 * - Cancel button for queued jobs
 * - Status summary (X of Y complete)
 */

import React from 'react';
import * as Icons from '../Icons';
import type { AudioGenerationMode } from '../../hooks/useAudioGeneration';

interface AudioToolbarProps {
  /** Whether audio generation is currently in progress */
  isGenerating: boolean;
  /** Whether the generate/cancel request is loading */
  isLoading: boolean;
  /** Number of sentences with dirty audio flags */
  dirtySentenceCount: number;
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
  /** Called when mode is changed */
  onModeChange: (mode: AudioGenerationMode) => void;
  /** Called when "Generate All" is clicked */
  onGenerateAll: () => void;
  /** Called when "Cancel" is clicked */
  onCancelAll: () => void;
  /** Called when "Force Regenerate" is clicked */
  onForceRegenerate: () => void;
  /** Error message if any */
  error?: string | null;
}

export const AudioToolbar: React.FC<AudioToolbarProps> = ({
  isGenerating,
  isLoading,
  dirtySentenceCount,
  totalPending,
  completedCount,
  failedCount,
  overallProgress,
  mode,
  onModeChange,
  onGenerateAll,
  onCancelAll,
  onForceRegenerate,
  error,
}) => {
  const showProgress = isGenerating || (completedCount > 0 || failedCount > 0);
  const totalProcessed = completedCount + failedCount;
  const totalJobs = totalPending + totalProcessed;

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-surface-2 border border-border-subtle rounded-xl">
      {/* Mode Toggle */}
      <div className="flex items-center gap-1 p-1 bg-surface-0 rounded-lg">
        <button
          onClick={() => onModeChange('per-sentence')}
          disabled={isGenerating}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            mode === 'per-sentence'
              ? 'bg-surface-2 text-text-primary shadow-sm'
              : 'text-text-muted hover:text-text-secondary'
          } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="Generate audio for each sentence individually"
        >
          <Icons.List size={12} />
          Individual
        </button>
        <button
          onClick={() => onModeChange('per-section')}
          disabled={isGenerating}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            mode === 'per-section'
              ? 'bg-surface-2 text-text-primary shadow-sm'
              : 'text-text-muted hover:text-text-secondary'
          } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="Batch generate by section (faster, uses Whisper for timing)"
        >
          <Icons.Layers size={12} />
          Batch
        </button>
      </div>

      {/* Generate/Cancel Button */}
      <div className="flex items-center gap-2">
        {isGenerating ? (
          <button
            onClick={onCancelAll}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Icons.RefreshCw className="animate-spin" size={14} />
            ) : (
              <Icons.XCircle size={14} />
            )}
            Cancel
          </button>
        ) : (
          <button
            onClick={onGenerateAll}
            disabled={isLoading || dirtySentenceCount === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary font-bold text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={dirtySentenceCount === 0 ? 'All sentences have up-to-date audio' : `Generate audio for ${dirtySentenceCount} sentences`}
          >
            {isLoading ? (
              <Icons.RefreshCw className="animate-spin" size={14} />
            ) : (
              <Icons.Mic size={14} />
            )}
            Generate All Audio
            {dirtySentenceCount > 0 && (
              <span className="px-1.5 py-0.5 bg-primary/30 rounded text-[10px]">
                {dirtySentenceCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Progress Section */}
      {showProgress && (
        <div className="flex-1 flex items-center gap-4">
          {/* Progress Bar */}
          <div className="flex-1 max-w-xs">
            <div className="h-2 bg-surface-0 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  failedCount > 0 ? 'bg-gradient-to-r from-primary to-red-500' : 'bg-primary'
                }`}
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          {/* Status Text */}
          <div className="flex items-center gap-3 text-xs">
            {isGenerating && totalPending > 0 && (
              <span className="text-text-muted flex items-center gap-1">
                <Icons.RefreshCw className="animate-spin text-primary" size={12} />
                Generating...
              </span>
            )}

            <span className="text-text-secondary">
              <span className="text-primary font-bold">{completedCount}</span>
              <span className="text-text-muted">/{totalJobs}</span>
            </span>

            {failedCount > 0 && (
              <span className="text-red-400 flex items-center gap-1">
                <Icons.AlertTriangle size={12} />
                {failedCount} failed
              </span>
            )}
          </div>
        </div>
      )}

      {/* Idle Status with Regenerate Option */}
      {!showProgress && dirtySentenceCount === 0 && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Icons.CheckCircle size={14} className="text-green-400" />
            All audio up to date
          </div>
          <button
            onClick={onForceRegenerate}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary hover:bg-surface-0 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Regenerate all audio from scratch"
          >
            <Icons.RefreshCw size={12} />
            Regenerate All
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <Icons.AlertCircle size={14} />
          {error}
        </div>
      )}
    </div>
  );
};

export default AudioToolbar;
