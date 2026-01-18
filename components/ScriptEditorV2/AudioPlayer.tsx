/**
 * AudioPlayer Component
 * Fixed footer audio player with Spotify-style design
 * Features: playback controls, progress bar, volume slider
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as Icons from '../Icons';

interface AudioPlayerProps {
  /** Current audio URL to play */
  audioUrl: string | null;
  /** Called when the player is closed */
  onClose: () => void;
  /** Optional label for the current track */
  trackLabel?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  onClose,
  trackLabel,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [previousVolume, setPreviousVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHoveringProgress, setIsHoveringProgress] = useState(false);
  const [isHoveringVolume, setIsHoveringVolume] = useState(false);

  // Format time as mm:ss
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize audio when URL changes
  useEffect(() => {
    if (!audioUrl) return;

    // Clean up previous audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setIsLoading(true);
    setError(null);
    setCurrentTime(0);
    setDuration(0);

    const audio = new Audio(audioUrl);
    audio.volume = isMuted ? 0 : volume;
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setError('Failed to load audio');
      setIsLoading(false);
      setIsPlaying(false);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
      // Auto-play when ready
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error('Auto-play failed:', err);
      });
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.pause();
    };
  }, [audioUrl]);

  // Update audio volume when volume state changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error('Play failed:', err);
        setError('Failed to play audio');
      });
    }
  }, [isPlaying]);

  // Seek to position
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressRef.current || !duration) return;

    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = percent * duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  // Handle volume change
  const handleVolumeChange = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!volumeRef.current) return;

    const rect = volumeRef.current.getBoundingClientRect();
    const newVolume = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (newVolume > 0) {
      setPreviousVolume(newVolume);
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      setVolume(previousVolume || 0.5);
    } else {
      setPreviousVolume(volume);
      setIsMuted(true);
    }
  }, [isMuted, volume, previousVolume]);

  // Skip backward 5 seconds
  const skipBackward = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5);
  }, []);

  // Skip forward 5 seconds
  const skipForward = useCallback(() => {
    if (!audioRef.current || !duration) return;
    audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 5);
  }, [duration]);

  // Handle close
  const handleClose = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    onClose();
  }, [onClose]);

  // Get volume icon based on current level
  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <Icons.VolumeX size={16} />;
    if (volume < 0.5) return <Icons.Volume2 size={16} />;
    return <Icons.Volume2 size={16} />;
  };

  // Don't render if no audio URL
  if (!audioUrl) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const volumePercent = isMuted ? 0 : volume * 100;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#181818] border-t border-[#282828] z-50">
      <div className="h-[72px] px-4 flex items-center justify-between">
        {/* Left: Track info */}
        <div className="flex items-center gap-3 min-w-[180px] w-[30%]">
          {/* Album art placeholder */}
          <div className="w-14 h-14 bg-[#282828] rounded flex items-center justify-center flex-shrink-0">
            <Icons.Music size={24} className="text-[#535353]" />
          </div>
          <div className="min-w-0">
            <div className="text-sm text-white font-medium truncate">
              {trackLabel || 'Audio Track'}
            </div>
            <div className="text-xs text-[#b3b3b3] truncate">
              Generated Audio
            </div>
          </div>
        </div>

        {/* Center: Playback controls and progress */}
        <div className="flex flex-col items-center max-w-[722px] w-[40%]">
          {/* Controls */}
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={skipBackward}
              className="text-[#b3b3b3] hover:text-white transition-colors disabled:opacity-50"
              title="Rewind 5s"
              disabled={isLoading}
            >
              <Icons.SkipBack size={16} />
            </button>

            <button
              onClick={togglePlayPause}
              className="w-8 h-8 bg-primary rounded-full flex items-center justify-center hover:scale-105 hover:brightness-110 transition-all disabled:opacity-50"
              disabled={isLoading || !!error}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isLoading ? (
                <Icons.RefreshCw size={16} className="text-white animate-spin" />
              ) : isPlaying ? (
                <Icons.Pause size={16} className="text-white" />
              ) : (
                <Icons.Play size={16} className="text-white ml-0.5" />
              )}
            </button>

            <button
              onClick={skipForward}
              className="text-[#b3b3b3] hover:text-white transition-colors disabled:opacity-50"
              title="Forward 5s"
              disabled={isLoading}
            >
              <Icons.SkipForward size={16} />
            </button>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2 w-full">
            <span className="text-[11px] text-[#a7a7a7] tabular-nums min-w-[40px] text-right">
              {formatTime(currentTime)}
            </span>

            <div
              ref={progressRef}
              onClick={handleSeek}
              onMouseEnter={() => setIsHoveringProgress(true)}
              onMouseLeave={() => setIsHoveringProgress(false)}
              className="flex-1 h-1 bg-[#4d4d4d] rounded-full cursor-pointer group relative"
            >
              <div
                className={`h-full rounded-full transition-colors ${isHoveringProgress ? 'bg-[#1db954]' : 'bg-white'}`}
                style={{ width: `${progress}%` }}
              />
              {/* Scrubber dot */}
              {isHoveringProgress && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md"
                  style={{ left: `calc(${progress}% - 6px)` }}
                />
              )}
            </div>

            <span className="text-[11px] text-[#a7a7a7] tabular-nums min-w-[40px]">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right: Volume and close */}
        <div className="flex items-center justify-end gap-3 min-w-[180px] w-[30%]">
          {/* Error indicator */}
          {error && (
            <div className="flex items-center gap-1.5 text-red-400 text-xs mr-2">
              <Icons.AlertCircle size={14} />
            </div>
          )}

          {/* Volume control */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="text-[#b3b3b3] hover:text-white transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {getVolumeIcon()}
            </button>

            <div
              ref={volumeRef}
              onClick={handleVolumeChange}
              onMouseEnter={() => setIsHoveringVolume(true)}
              onMouseLeave={() => setIsHoveringVolume(false)}
              className="w-24 h-1 bg-[#4d4d4d] rounded-full cursor-pointer group relative"
            >
              <div
                className={`h-full rounded-full transition-colors ${isHoveringVolume ? 'bg-[#1db954]' : 'bg-white'}`}
                style={{ width: `${volumePercent}%` }}
              />
              {/* Volume scrubber dot */}
              {isHoveringVolume && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md"
                  style={{ left: `calc(${volumePercent}% - 6px)` }}
                />
              )}
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="p-1.5 text-[#b3b3b3] hover:text-white transition-colors ml-2"
            title="Close player"
          >
            <Icons.X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;
