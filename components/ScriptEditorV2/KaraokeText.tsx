/**
 * KaraokeText Component
 *
 * Renders sentence text with word-by-word highlighting synchronized to audio playback.
 * Words highlight as they are spoken, creating a karaoke-style reading experience.
 */

import React, { useMemo } from 'react';
import type { WordTimingData } from '../../types';

export interface KaraokeTextProps {
  /** The full sentence text (used as fallback if no word timings) */
  text: string;
  /** Word-level timing data from Whisper transcription */
  wordTimings: WordTimingData[] | null;
  /** Current audio playback position in milliseconds */
  currentTimeMs: number;
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** When this sentence starts in the section audio (ms) */
  sentenceStartMs: number;
  /** When this sentence ends in the section audio (ms) */
  sentenceEndMs: number;
  /** Optional className for the container */
  className?: string;
}

/**
 * KaraokeText renders sentence text with word highlighting based on audio playback time.
 *
 * Features:
 * - Highlights the current word being spoken
 * - Dims past words, fades upcoming words
 * - Falls back to plain text if no word timings available
 * - Smooth CSS transitions between words
 */
export const KaraokeText: React.FC<KaraokeTextProps> = ({
  text,
  wordTimings,
  currentTimeMs,
  isPlaying,
  sentenceStartMs,
  sentenceEndMs,
  className = '',
}) => {
  // Check if this sentence is currently active in playback
  const isSentenceActive = useMemo(() => {
    return currentTimeMs >= sentenceStartMs && currentTimeMs <= sentenceEndMs;
  }, [currentTimeMs, sentenceStartMs, sentenceEndMs]);

  // Calculate time relative to sentence start
  const relativeTimeMs = useMemo(() => {
    return currentTimeMs - sentenceStartMs;
  }, [currentTimeMs, sentenceStartMs]);

  // If no word timings available, render plain text
  if (!wordTimings || wordTimings.length === 0) {
    return (
      <span className={`text-white/90 ${className}`}>
        {text}
      </span>
    );
  }

  return (
    <span className={`karaoke-text inline ${className}`}>
      {wordTimings.map((wordTiming, index) => {
        // Determine word state based on current playback time
        const isCurrentWord = isSentenceActive &&
          isPlaying &&
          relativeTimeMs >= wordTiming.startMs &&
          relativeTimeMs < wordTiming.endMs;

        const isPastWord = isSentenceActive &&
          relativeTimeMs >= wordTiming.endMs;

        const isUpcomingWord = isSentenceActive &&
          relativeTimeMs < wordTiming.startMs;

        // When not playing or sentence not active, show neutral state
        const isNeutral = !isPlaying || !isSentenceActive;

        // Calculate progress through current word for smooth highlighting
        const wordProgress = isCurrentWord
          ? (relativeTimeMs - wordTiming.startMs) / (wordTiming.endMs - wordTiming.startMs)
          : 0;

        return (
          <span
            key={index}
            className={`
              transition-all duration-75 ease-out
              ${isNeutral ? 'text-white/90' : ''}
              ${isCurrentWord ? 'text-blue-400 font-semibold scale-105 inline-block' : ''}
              ${isPastWord ? 'text-white/80' : ''}
              ${isUpcomingWord ? 'text-white/50' : ''}
            `}
            style={{
              // Add subtle background highlight for current word
              ...(isCurrentWord ? {
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                borderRadius: '2px',
                padding: '0 2px',
                margin: '0 -2px',
              } : {}),
            }}
          >
            {wordTiming.word}
            {index < wordTimings.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </span>
  );
};

export default KaraokeText;
