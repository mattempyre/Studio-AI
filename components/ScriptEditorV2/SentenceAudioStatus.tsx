/**
 * SentenceAudioStatus Component
 * STORY-3-3: Per-sentence audio generation status indicator
 *
 * Features:
 * - Shows queued/generating/completed/failed status
 * - Progress indicator during generation
 * - Audio playback button when completed
 * - Error message on failure
 */

import React from 'react';
import * as Icons from '../Icons';
import type { SentenceAudioStatus as StatusType, SentenceAudioState } from '../../hooks/useAudioGeneration';

interface SentenceAudioStatusProps {
  /** Audio generation state for this sentence */
  audioState?: SentenceAudioState;
  /** Whether this sentence has dirty audio flag from backend */
  isAudioDirty: boolean;
  /** Existing audio file URL if any */
  existingAudioFile?: string | null;
  /** Existing audio duration in ms */
  existingDuration?: number | null;
  /** Called when play button is clicked */
  onPlayAudio?: (audioUrl: string) => void;
}

export const SentenceAudioStatus: React.FC<SentenceAudioStatusProps> = ({
  audioState,
  isAudioDirty,
  existingAudioFile,
  existingDuration,
  onPlayAudio,
}) => {
  // Determine what to show based on state
  const status = audioState?.status;
  const progress = audioState?.progress || 0;
  const error = audioState?.error;
  const newAudioFile = audioState?.audioFile;
  const newDuration = audioState?.audioDuration;

  // Use new audio if available, otherwise fall back to existing
  const audioFile = newAudioFile || existingAudioFile;
  const duration = newDuration || existingDuration;

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioFile && onPlayAudio) {
      onPlayAudio(audioFile);
    }
  };

  // Queued state
  if (status === 'queued') {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-yellow-400/80">
        <Icons.Clock size={10} />
        <span>Queued</span>
      </div>
    );
  }

  // Generating state with progress
  if (status === 'generating') {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-[10px] text-primary">
          <Icons.RefreshCw size={10} className="animate-spin" />
          <span>Generating...</span>
        </div>
        {progress > 0 && (
          <div className="w-16 h-1 bg-surface-0 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  // Failed state
  if (status === 'failed') {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-red-400" title={error}>
        <Icons.AlertCircle size={10} />
        <span className="truncate max-w-24">{error || 'Failed'}</span>
      </div>
    );
  }

  // Completed state (either from current generation or existing file)
  if (status === 'completed' || audioFile) {
    const isNewlyGenerated = status === 'completed';

    return (
      <div className="flex items-center gap-2">
        {/* Play button */}
        {audioFile && onPlayAudio && (
          <button
            onClick={handlePlayClick}
            className="p-1 text-primary hover:text-primary/80 hover:bg-primary/10 rounded transition-colors"
            title="Play audio"
          >
            <Icons.PlayCircle size={14} />
          </button>
        )}

        {/* Duration display */}
        {duration && (
          <span className="text-[10px] text-text-muted flex items-center gap-1">
            <Icons.Clock size={10} />
            {(duration / 1000).toFixed(1)}s
          </span>
        )}

        {/* "New" badge for recently generated */}
        {isNewlyGenerated && (
          <span className="text-[9px] font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">
            NEW
          </span>
        )}
      </div>
    );
  }

  // Dirty audio indicator (needs regeneration but not in queue)
  if (isAudioDirty) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-text-muted" title="Audio needs regeneration">
        <Icons.Volume2 size={10} className="text-yellow-400/60" />
        <span>Outdated</span>
      </div>
    );
  }

  // Up-to-date audio with existing file
  if (audioFile) {
    return (
      <div className="flex items-center gap-2">
        {onPlayAudio && (
          <button
            onClick={handlePlayClick}
            className="p-1 text-text-muted hover:text-primary hover:bg-primary/10 rounded transition-colors"
            title="Play audio"
          >
            <Icons.PlayCircle size={14} />
          </button>
        )}
        {duration && (
          <span className="text-[10px] text-text-muted flex items-center gap-1">
            <Icons.Clock size={10} />
            {(duration / 1000).toFixed(1)}s
          </span>
        )}
      </div>
    );
  }

  // No audio
  return (
    <span className="text-[10px] text-text-muted/50 flex items-center gap-1">
      <Icons.VolumeX size={10} />
      No audio
    </span>
  );
};

export default SentenceAudioStatus;
