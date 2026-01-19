/**
 * useAudioPlaybackSync Hook
 *
 * Provides high-frequency audio playback state updates for karaoke-style word highlighting.
 * Uses requestAnimationFrame for smooth 60fps updates during playback.
 */

import { useState, useEffect, useCallback, type RefObject } from 'react';

export interface UseAudioPlaybackSyncOptions {
  /** Reference to the audio element */
  audioRef: RefObject<HTMLAudioElement | null>;
  /** How often to poll time when using fallback (default: 50ms) */
  fallbackIntervalMs?: number;
}

export interface UseAudioPlaybackSyncReturn {
  /** Current playback position in milliseconds */
  currentTimeMs: number;
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Total duration in milliseconds */
  durationMs: number;
  /** Seek to a specific time in milliseconds */
  seekTo: (timeMs: number) => void;
}

/**
 * Hook for synchronizing UI with audio playback state.
 *
 * Features:
 * - Uses requestAnimationFrame for smooth updates during playback
 * - Falls back to interval-based polling if RAF unavailable
 * - Provides seek functionality
 * - Returns time in milliseconds for precise word timing
 */
export function useAudioPlaybackSync(
  options: UseAudioPlaybackSyncOptions
): UseAudioPlaybackSyncReturn {
  const { audioRef, fallbackIntervalMs = 50 } = options;

  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [durationMs, setDurationMs] = useState(0);

  // Seek to a specific time
  const seekTo = useCallback((timeMs: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = timeMs / 1000;
      setCurrentTimeMs(timeMs);
    }
  }, [audioRef]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let animationFrameId: number | null = null;
    let isActive = true;

    // Update time using requestAnimationFrame for smooth 60fps updates
    const updateTimeWithRAF = () => {
      if (!isActive) return;

      if (audio && !audio.paused) {
        setCurrentTimeMs(Math.round(audio.currentTime * 1000));
        animationFrameId = requestAnimationFrame(updateTimeWithRAF);
      }
    };

    // Event handlers
    const handlePlay = () => {
      setIsPlaying(true);
      // Start RAF loop for smooth updates
      if (animationFrameId === null) {
        updateTimeWithRAF();
      }
    };

    const handlePause = () => {
      setIsPlaying(false);
      // Stop RAF loop
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };

    const handleTimeUpdate = () => {
      // Fallback update for when RAF isn't running (paused, seeking)
      setCurrentTimeMs(Math.round(audio.currentTime * 1000));
    };

    const handleLoadedMetadata = () => {
      setDurationMs(Math.round(audio.duration * 1000));
    };

    const handleDurationChange = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDurationMs(Math.round(audio.duration * 1000));
      }
    };

    const handleSeeking = () => {
      setCurrentTimeMs(Math.round(audio.currentTime * 1000));
    };

    // Check initial state
    if (!audio.paused) {
      setIsPlaying(true);
      updateTimeWithRAF();
    }
    if (audio.duration && !isNaN(audio.duration)) {
      setDurationMs(Math.round(audio.duration * 1000));
    }
    setCurrentTimeMs(Math.round(audio.currentTime * 1000));

    // Attach listeners
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('seeking', handleSeeking);
    audio.addEventListener('seeked', handleSeeking);

    return () => {
      isActive = false;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('seeking', handleSeeking);
      audio.removeEventListener('seeked', handleSeeking);
    };
  }, [audioRef, fallbackIntervalMs]);

  return {
    currentTimeMs,
    isPlaying,
    durationMs,
    seekTo,
  };
}

export default useAudioPlaybackSync;
