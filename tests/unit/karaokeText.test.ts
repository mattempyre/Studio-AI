/**
 * Tests for KaraokeText Component Logic
 *
 * Tests the word highlighting logic used for karaoke-style text display
 * synchronized with audio playback.
 */

import { describe, it, expect } from 'vitest';
import type { WordTimingData } from '../../types';

/**
 * Simulates the KaraokeText component's word state calculation logic
 * This mirrors the logic in KaraokeText.tsx for testability
 */
interface WordState {
  isCurrentWord: boolean;
  isPastWord: boolean;
  isUpcomingWord: boolean;
  isNeutral: boolean;
  wordProgress: number;
}

function calculateWordState(
  wordTiming: WordTimingData,
  currentTimeMs: number,
  sentenceStartMs: number,
  sentenceEndMs: number,
  isPlaying: boolean
): WordState {
  // Check if sentence is active
  const isSentenceActive = currentTimeMs >= sentenceStartMs && currentTimeMs <= sentenceEndMs;

  // Calculate relative time
  const relativeTimeMs = currentTimeMs - sentenceStartMs;

  // Determine word states
  const isCurrentWord = isSentenceActive &&
    isPlaying &&
    relativeTimeMs >= wordTiming.startMs &&
    relativeTimeMs < wordTiming.endMs;

  const isPastWord = isSentenceActive &&
    relativeTimeMs >= wordTiming.endMs;

  const isUpcomingWord = isSentenceActive &&
    relativeTimeMs < wordTiming.startMs;

  const isNeutral = !isPlaying || !isSentenceActive;

  // Calculate progress through current word
  const wordProgress = isCurrentWord
    ? (relativeTimeMs - wordTiming.startMs) / (wordTiming.endMs - wordTiming.startMs)
    : 0;

  return { isCurrentWord, isPastWord, isUpcomingWord, isNeutral, wordProgress };
}

/**
 * Helper to get which word is currently highlighted
 */
function getCurrentHighlightedWord(
  wordTimings: WordTimingData[],
  currentTimeMs: number,
  sentenceStartMs: number,
  sentenceEndMs: number,
  isPlaying: boolean
): string | null {
  for (const wordTiming of wordTimings) {
    const state = calculateWordState(wordTiming, currentTimeMs, sentenceStartMs, sentenceEndMs, isPlaying);
    if (state.isCurrentWord) {
      return wordTiming.word;
    }
  }
  return null;
}

describe('KaraokeText Logic', () => {
  // Sample word timings for a sentence: "Hello world how are you"
  const sampleWordTimings: WordTimingData[] = [
    { word: 'Hello', startMs: 0, endMs: 400, probability: 0.95 },
    { word: 'world', startMs: 400, endMs: 800, probability: 0.92 },
    { word: 'how', startMs: 900, endMs: 1100, probability: 0.98 },
    { word: 'are', startMs: 1100, endMs: 1300, probability: 0.96 },
    { word: 'you', startMs: 1300, endMs: 1600, probability: 0.94 },
  ];

  const sentenceStartMs = 0;
  const sentenceEndMs = 1600;

  describe('Word State Calculation', () => {
    it('should identify current word during playback', () => {
      // At 200ms, "Hello" should be current (0-400ms)
      const state = calculateWordState(
        sampleWordTimings[0],
        200,
        sentenceStartMs,
        sentenceEndMs,
        true
      );

      expect(state.isCurrentWord).toBe(true);
      expect(state.isPastWord).toBe(false);
      expect(state.isUpcomingWord).toBe(false);
      expect(state.isNeutral).toBe(false);
    });

    it('should identify past words', () => {
      // At 500ms, "Hello" should be past (ended at 400ms)
      const state = calculateWordState(
        sampleWordTimings[0],
        500,
        sentenceStartMs,
        sentenceEndMs,
        true
      );

      expect(state.isCurrentWord).toBe(false);
      expect(state.isPastWord).toBe(true);
      expect(state.isUpcomingWord).toBe(false);
    });

    it('should identify upcoming words', () => {
      // At 200ms, "world" should be upcoming (starts at 400ms)
      const state = calculateWordState(
        sampleWordTimings[1],
        200,
        sentenceStartMs,
        sentenceEndMs,
        true
      );

      expect(state.isCurrentWord).toBe(false);
      expect(state.isPastWord).toBe(false);
      expect(state.isUpcomingWord).toBe(true);
    });

    it('should show neutral state when not playing', () => {
      const state = calculateWordState(
        sampleWordTimings[0],
        200,
        sentenceStartMs,
        sentenceEndMs,
        false // not playing
      );

      expect(state.isNeutral).toBe(true);
      expect(state.isCurrentWord).toBe(false);
    });

    it('should show neutral state when sentence is not active', () => {
      // Time is before sentence starts
      const state = calculateWordState(
        sampleWordTimings[0],
        -100, // before sentence
        sentenceStartMs,
        sentenceEndMs,
        true
      );

      expect(state.isNeutral).toBe(true);
    });

    it('should show neutral state after sentence ends', () => {
      // Time is after sentence ends
      const state = calculateWordState(
        sampleWordTimings[0],
        2000, // after sentence
        sentenceStartMs,
        sentenceEndMs,
        true
      );

      expect(state.isNeutral).toBe(true);
    });
  });

  describe('Word Progress Calculation', () => {
    it('should calculate 0% progress at word start', () => {
      const state = calculateWordState(
        sampleWordTimings[0], // "Hello" 0-400ms
        0, // exactly at start
        sentenceStartMs,
        sentenceEndMs,
        true
      );

      expect(state.wordProgress).toBe(0);
    });

    it('should calculate 50% progress at word midpoint', () => {
      const state = calculateWordState(
        sampleWordTimings[0], // "Hello" 0-400ms
        200, // midpoint
        sentenceStartMs,
        sentenceEndMs,
        true
      );

      expect(state.wordProgress).toBe(0.5);
    });

    it('should calculate ~100% progress near word end', () => {
      const state = calculateWordState(
        sampleWordTimings[0], // "Hello" 0-400ms
        399, // just before end
        sentenceStartMs,
        sentenceEndMs,
        true
      );

      expect(state.wordProgress).toBeCloseTo(0.9975, 2);
    });

    it('should have 0 progress for non-current words', () => {
      const state = calculateWordState(
        sampleWordTimings[1], // "world" - upcoming
        200,
        sentenceStartMs,
        sentenceEndMs,
        true
      );

      expect(state.wordProgress).toBe(0);
    });
  });

  describe('Word Highlighting Sequence', () => {
    it('should highlight words in sequence as time progresses', () => {
      const testCases = [
        { timeMs: 0, expectedWord: 'Hello' },
        { timeMs: 200, expectedWord: 'Hello' },
        { timeMs: 400, expectedWord: 'world' },
        { timeMs: 600, expectedWord: 'world' },
        { timeMs: 900, expectedWord: 'how' },
        { timeMs: 1100, expectedWord: 'are' },
        { timeMs: 1300, expectedWord: 'you' },
        { timeMs: 1500, expectedWord: 'you' },
      ];

      for (const { timeMs, expectedWord } of testCases) {
        const highlighted = getCurrentHighlightedWord(
          sampleWordTimings,
          timeMs,
          sentenceStartMs,
          sentenceEndMs,
          true
        );
        expect(highlighted).toBe(expectedWord);
      }
    });

    it('should handle gaps between words', () => {
      // At 850ms - between "world" (ends 800) and "how" (starts 900)
      const highlighted = getCurrentHighlightedWord(
        sampleWordTimings,
        850,
        sentenceStartMs,
        sentenceEndMs,
        true
      );

      // No word should be highlighted in the gap
      expect(highlighted).toBeNull();
    });

    it('should return null when playback is paused', () => {
      const highlighted = getCurrentHighlightedWord(
        sampleWordTimings,
        200,
        sentenceStartMs,
        sentenceEndMs,
        false // paused
      );

      expect(highlighted).toBeNull();
    });
  });

  describe('Sentence Boundary Handling', () => {
    it('should handle multi-sentence scenarios with offsets', () => {
      // Simulate second sentence in section, starting at 2000ms
      const secondSentenceStart = 2000;
      const secondSentenceEnd = 3600;

      // Word timings are relative to sentence start
      const secondSentenceWords: WordTimingData[] = [
        { word: 'Second', startMs: 0, endMs: 400, probability: 0.95 },
        { word: 'sentence', startMs: 400, endMs: 900, probability: 0.92 },
      ];

      // At global time 2200ms, relative time is 200ms
      // "Second" (0-400ms) should be current
      const highlighted = getCurrentHighlightedWord(
        secondSentenceWords,
        2200, // global time
        secondSentenceStart,
        secondSentenceEnd,
        true
      );

      expect(highlighted).toBe('Second');
    });

    it('should not highlight when outside sentence bounds', () => {
      const secondSentenceStart = 2000;
      const secondSentenceEnd = 3600;

      const secondSentenceWords: WordTimingData[] = [
        { word: 'Second', startMs: 0, endMs: 400, probability: 0.95 },
      ];

      // At global time 1500ms, sentence hasn't started yet
      const highlighted = getCurrentHighlightedWord(
        secondSentenceWords,
        1500,
        secondSentenceStart,
        secondSentenceEnd,
        true
      );

      expect(highlighted).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty word timings', () => {
      const highlighted = getCurrentHighlightedWord(
        [],
        200,
        0,
        1000,
        true
      );

      expect(highlighted).toBeNull();
    });

    it('should handle single word', () => {
      const singleWord: WordTimingData[] = [
        { word: 'Hello', startMs: 0, endMs: 500, probability: 0.95 },
      ];

      const highlighted = getCurrentHighlightedWord(
        singleWord,
        250,
        0,
        500,
        true
      );

      expect(highlighted).toBe('Hello');
    });

    it('should handle word at exact end boundary', () => {
      // At exactly 400ms, "Hello" should be past (endMs is exclusive)
      const state = calculateWordState(
        sampleWordTimings[0], // "Hello" 0-400ms
        400, // exactly at end
        sentenceStartMs,
        sentenceEndMs,
        true
      );

      // At exactly endMs, word should be past (range is [startMs, endMs))
      expect(state.isCurrentWord).toBe(false);
      expect(state.isPastWord).toBe(true);
    });

    it('should handle overlapping word boundaries gracefully', () => {
      // Simulating edge case where words might have identical start/end
      const edgeCaseWords: WordTimingData[] = [
        { word: 'Quick', startMs: 0, endMs: 200, probability: 0.95 },
        { word: 'words', startMs: 200, endMs: 400, probability: 0.92 },
      ];

      // At exactly 200ms boundary
      const quickState = calculateWordState(edgeCaseWords[0], 200, 0, 400, true);
      const wordsState = calculateWordState(edgeCaseWords[1], 200, 0, 400, true);

      // "Quick" should be past, "words" should be current
      expect(quickState.isPastWord).toBe(true);
      expect(wordsState.isCurrentWord).toBe(true);
    });

    it('should handle very short words', () => {
      const shortWord: WordTimingData[] = [
        { word: 'I', startMs: 0, endMs: 50, probability: 0.9 },
      ];

      const state = calculateWordState(shortWord[0], 25, 0, 50, true);
      expect(state.isCurrentWord).toBe(true);
      expect(state.wordProgress).toBe(0.5);
    });

    it('should handle words with zero duration gracefully', () => {
      const zeroDurationWord: WordTimingData[] = [
        { word: 'Instant', startMs: 100, endMs: 100, probability: 0.8 },
      ];

      const state = calculateWordState(zeroDurationWord[0], 100, 0, 200, true);

      // With zero duration, word will never be "current" (startMs === endMs)
      expect(state.isCurrentWord).toBe(false);
      expect(state.isPastWord).toBe(true);
    });
  });

  describe('Visual State Combinations', () => {
    it('should produce correct states for all words at a given time', () => {
      const timeMs = 600; // During "world" (400-800ms)

      const states = sampleWordTimings.map(word => ({
        word: word.word,
        ...calculateWordState(word, timeMs, sentenceStartMs, sentenceEndMs, true),
      }));

      expect(states[0].word).toBe('Hello');
      expect(states[0].isPastWord).toBe(true);

      expect(states[1].word).toBe('world');
      expect(states[1].isCurrentWord).toBe(true);

      expect(states[2].word).toBe('how');
      expect(states[2].isUpcomingWord).toBe(true);

      expect(states[3].word).toBe('are');
      expect(states[3].isUpcomingWord).toBe(true);

      expect(states[4].word).toBe('you');
      expect(states[4].isUpcomingWord).toBe(true);
    });

    it('should have all words neutral when paused', () => {
      const timeMs = 600;

      const states = sampleWordTimings.map(word => ({
        word: word.word,
        ...calculateWordState(word, timeMs, sentenceStartMs, sentenceEndMs, false), // paused
      }));

      // All words should be neutral when paused
      expect(states.every(s => s.isNeutral)).toBe(true);
      expect(states.every(s => !s.isCurrentWord)).toBe(true);
    });
  });
});
