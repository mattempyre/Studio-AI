/**
 * Global Audio Player Context
 * Provides persistent audio playback across page navigation
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

interface AudioPlayerState {
  /** Current audio URL being played */
  audioUrl: string | null;
  /** Label for the current track */
  trackLabel: string | undefined;
  /** Section ID for karaoke sync */
  sectionId: string | null;
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Current playback time in milliseconds */
  currentTimeMs: number;
  /** Whether to auto-play this audio (true for new audio requests, false for persisting state) */
  shouldAutoPlay: boolean;
}

interface AudioPlayerContextValue extends AudioPlayerState {
  /** Play audio from a URL */
  playAudio: (url: string, label?: string, sectionId?: string | null) => void;
  /** Stop and close the audio player */
  closePlayer: () => void;
  /** Update current time (called by AudioPlayer) */
  setCurrentTimeMs: (timeMs: number) => void;
  /** Update playing state (called by AudioPlayer) */
  setIsPlaying: (isPlaying: boolean) => void;
  /** Clear auto-play flag after audio starts playing (called by AudioPlayer) */
  clearAutoPlay: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

export const useAudioPlayer = (): AudioPlayerContextValue => {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within AudioPlayerProvider');
  }
  return context;
};

interface AudioPlayerProviderProps {
  children: React.ReactNode;
}

export const AudioPlayerProvider: React.FC<AudioPlayerProviderProps> = ({ children }) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [trackLabel, setTrackLabel] = useState<string | undefined>(undefined);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);

  // Track the previous URL to detect new audio vs same audio
  const previousUrlRef = useRef<string | null>(null);

  const playAudio = useCallback((url: string, label?: string, newSectionId?: string | null) => {
    // Only auto-play if this is a NEW audio URL
    const isNewAudio = url !== previousUrlRef.current;
    previousUrlRef.current = url;

    console.log('[AudioContext] playAudio:', { url, label, sectionId: newSectionId, isNewAudio });

    setAudioUrl(url);
    setTrackLabel(label);
    setSectionId(newSectionId ?? null);

    // Set auto-play flag for new audio requests
    if (isNewAudio) {
      setCurrentTimeMs(0);
      setShouldAutoPlay(true);
    }
  }, []);

  const closePlayer = useCallback(() => {
    console.log('[AudioContext] closePlayer');
    setAudioUrl(null);
    setTrackLabel(undefined);
    setSectionId(null);
    setIsPlaying(false);
    setCurrentTimeMs(0);
    setShouldAutoPlay(false);
    previousUrlRef.current = null;
  }, []);

  const clearAutoPlay = useCallback(() => {
    setShouldAutoPlay(false);
  }, []);

  const value: AudioPlayerContextValue = {
    audioUrl,
    trackLabel,
    sectionId,
    isPlaying,
    currentTimeMs,
    shouldAutoPlay,
    playAudio,
    closePlayer,
    setCurrentTimeMs,
    setIsPlaying,
    clearAutoPlay,
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
};

export default AudioPlayerContext;
