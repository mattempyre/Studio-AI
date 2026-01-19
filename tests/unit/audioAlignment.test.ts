/**
 * Tests for Audio Alignment Service
 *
 * Tests the sentence-to-word alignment algorithm used for batch audio generation.
 */

import { describe, it, expect } from 'vitest';
import {
  alignSentencesToTranscription,
  alignSentencesToTranscriptionWithWords,
  validateAlignment,
  type SentenceInput,
} from '../../src/backend/services/audioAlignment';
import type { WordTiming } from '../../src/backend/clients/whisper';

describe('audioAlignment', () => {
  describe('alignSentencesToTranscription', () => {
    it('should align sentences to word timings correctly', () => {
      const sentences: SentenceInput[] = [
        { sentenceId: 's1', text: 'Hello world.', order: 0 },
        { sentenceId: 's2', text: 'How are you?', order: 1 },
      ];

      const words: WordTiming[] = [
        { word: 'Hello', start: 0.0, end: 0.5, probability: 0.95 },
        { word: 'world', start: 0.5, end: 1.0, probability: 0.92 },
        { word: 'How', start: 1.2, end: 1.5, probability: 0.98 },
        { word: 'are', start: 1.5, end: 1.7, probability: 0.96 },
        { word: 'you', start: 1.7, end: 2.0, probability: 0.94 },
      ];

      const result = alignSentencesToTranscription(sentences, words);

      expect(result.sentenceTimings).toHaveLength(2);

      // First sentence: "Hello world" - 0.0s to 1.0s
      expect(result.sentenceTimings[0].sentenceId).toBe('s1');
      expect(result.sentenceTimings[0].startMs).toBe(0);
      expect(result.sentenceTimings[0].endMs).toBe(1000);

      // Second sentence: "How are you" - 1.2s to 2.0s
      expect(result.sentenceTimings[1].sentenceId).toBe('s2');
      expect(result.sentenceTimings[1].startMs).toBe(1200);
      expect(result.sentenceTimings[1].endMs).toBe(2000);
    });

    it('should handle fuzzy word matching', () => {
      const sentences: SentenceInput[] = [
        { sentenceId: 's1', text: "It's a beautiful day.", order: 0 },
      ];

      const words: WordTiming[] = [
        { word: "It's", start: 0.0, end: 0.3, probability: 0.9 },
        { word: 'a', start: 0.3, end: 0.4, probability: 0.95 },
        { word: 'beautiful', start: 0.4, end: 0.9, probability: 0.85 },
        { word: 'day', start: 0.9, end: 1.2, probability: 0.92 },
      ];

      const result = alignSentencesToTranscription(sentences, words);

      expect(result.sentenceTimings).toHaveLength(1);
      expect(result.sentenceTimings[0].startMs).toBe(0);
      expect(result.sentenceTimings[0].endMs).toBe(1200);
      expect(result.sentenceTimings[0].confidence).toBeGreaterThan(0.5);
    });

    it('should handle transcription variations', () => {
      const sentences: SentenceInput[] = [
        { sentenceId: 's1', text: 'The color is blue.', order: 0 },
      ];

      // Whisper might transcribe "colour" instead of "color"
      const words: WordTiming[] = [
        { word: 'The', start: 0.0, end: 0.2, probability: 0.98 },
        { word: 'colour', start: 0.2, end: 0.6, probability: 0.88 },
        { word: 'is', start: 0.6, end: 0.8, probability: 0.95 },
        { word: 'blue', start: 0.8, end: 1.1, probability: 0.92 },
      ];

      const result = alignSentencesToTranscription(sentences, words);

      expect(result.sentenceTimings).toHaveLength(1);
      // Should still align despite "color" vs "colour" difference
      expect(result.sentenceTimings[0].confidence).toBeGreaterThan(0);
    });

    it('should handle empty sentences', () => {
      const sentences: SentenceInput[] = [
        { sentenceId: 's1', text: '', order: 0 },
        { sentenceId: 's2', text: 'Hello', order: 1 },
      ];

      const words: WordTiming[] = [
        { word: 'Hello', start: 0.0, end: 0.5, probability: 0.95 },
      ];

      const result = alignSentencesToTranscription(sentences, words);

      expect(result.sentenceTimings).toHaveLength(2);
      expect(result.warnings).toContain('Sentence s1 has no words to align');
    });

    it('should handle empty word array', () => {
      const sentences: SentenceInput[] = [
        { sentenceId: 's1', text: 'Hello world.', order: 0 },
      ];

      const result = alignSentencesToTranscription(sentences, []);

      expect(result.sentenceTimings).toHaveLength(1);
      expect(result.sentenceTimings[0].startMs).toBe(0);
      expect(result.sentenceTimings[0].endMs).toBe(0);
      expect(result.warnings).toContain('No transcription words available');
    });

    it('should handle empty sentences array', () => {
      const words: WordTiming[] = [
        { word: 'Hello', start: 0.0, end: 0.5, probability: 0.95 },
      ];

      const result = alignSentencesToTranscription([], words);

      expect(result.sentenceTimings).toHaveLength(0);
      expect(result.warnings).toContain('No sentences to align');
    });

    it('should sort sentences by order', () => {
      const sentences: SentenceInput[] = [
        { sentenceId: 's2', text: 'Second sentence.', order: 1 },
        { sentenceId: 's1', text: 'First sentence.', order: 0 },
      ];

      const words: WordTiming[] = [
        { word: 'First', start: 0.0, end: 0.3, probability: 0.95 },
        { word: 'sentence', start: 0.3, end: 0.8, probability: 0.92 },
        { word: 'Second', start: 1.0, end: 1.4, probability: 0.94 },
        { word: 'sentence', start: 1.4, end: 1.9, probability: 0.91 },
      ];

      const result = alignSentencesToTranscription(sentences, words);

      // First timing should be for s1 (order 0)
      expect(result.sentenceTimings[0].sentenceId).toBe('s1');
      expect(result.sentenceTimings[1].sentenceId).toBe('s2');
    });

    it('should calculate average confidence', () => {
      const sentences: SentenceInput[] = [
        { sentenceId: 's1', text: 'Hello', order: 0 },
        { sentenceId: 's2', text: 'World', order: 1 },
      ];

      const words: WordTiming[] = [
        { word: 'Hello', start: 0.0, end: 0.5, probability: 0.95 },
        { word: 'World', start: 0.5, end: 1.0, probability: 0.92 },
      ];

      const result = alignSentencesToTranscription(sentences, words);

      expect(result.averageConfidence).toBe(1.0); // Perfect match
    });

    it('should warn on low confidence alignments', () => {
      const sentences: SentenceInput[] = [
        { sentenceId: 's1', text: 'Completely different text here.', order: 0 },
      ];

      const words: WordTiming[] = [
        { word: 'Some', start: 0.0, end: 0.3, probability: 0.95 },
        { word: 'other', start: 0.3, end: 0.6, probability: 0.92 },
        { word: 'words', start: 0.6, end: 1.0, probability: 0.94 },
      ];

      const result = alignSentencesToTranscription(sentences, words);

      expect(result.warnings.some((w) => w.includes('Low confidence'))).toBe(true);
    });
  });

  describe('validateAlignment', () => {
    it('should pass valid alignments', () => {
      const result = {
        sentenceTimings: [
          { sentenceId: 's1', startMs: 0, endMs: 1000, confidence: 0.9 },
          { sentenceId: 's2', startMs: 1000, endMs: 2000, confidence: 0.85 },
        ],
        totalDurationMs: 2000,
        averageConfidence: 0.875,
        warnings: [],
      };

      const validation = validateAlignment(result);

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect overlapping sentences', () => {
      const result = {
        sentenceTimings: [
          { sentenceId: 's1', startMs: 0, endMs: 1500, confidence: 0.9 },
          { sentenceId: 's2', startMs: 1000, endMs: 2000, confidence: 0.85 },
        ],
        totalDurationMs: 2000,
        averageConfidence: 0.875,
        warnings: [],
      };

      const validation = validateAlignment(result);

      expect(validation.isValid).toBe(false);
      expect(validation.issues.some((i) => i.includes('overlap'))).toBe(true);
    });

    it('should detect zero-length sentences', () => {
      const result = {
        sentenceTimings: [
          { sentenceId: 's1', startMs: 1000, endMs: 1000, confidence: 0.9 },
        ],
        totalDurationMs: 2000,
        averageConfidence: 0.9,
        warnings: [],
      };

      const validation = validateAlignment(result);

      expect(validation.isValid).toBe(false);
      expect(validation.issues.some((i) => i.includes('zero or negative duration'))).toBe(true);
    });

    it('should detect low overall confidence', () => {
      const result = {
        sentenceTimings: [
          { sentenceId: 's1', startMs: 0, endMs: 1000, confidence: 0.3 },
        ],
        totalDurationMs: 1000,
        averageConfidence: 0.3,
        warnings: [],
      };

      const validation = validateAlignment(result);

      expect(validation.isValid).toBe(false);
      expect(validation.issues.some((i) => i.includes('Low overall alignment confidence'))).toBe(true);
    });
  });

  describe('alignSentencesToTranscriptionWithWords', () => {
    it('should return word timings for each sentence', () => {
      const sentences: SentenceInput[] = [
        { sentenceId: 's1', text: 'Hello world.', order: 0 },
        { sentenceId: 's2', text: 'How are you?', order: 1 },
      ];

      const words: WordTiming[] = [
        { word: 'Hello', start: 0.0, end: 0.5, probability: 0.95 },
        { word: 'world', start: 0.5, end: 1.0, probability: 0.92 },
        { word: 'How', start: 1.2, end: 1.5, probability: 0.98 },
        { word: 'are', start: 1.5, end: 1.7, probability: 0.96 },
        { word: 'you', start: 1.7, end: 2.0, probability: 0.94 },
      ];

      const result = alignSentencesToTranscriptionWithWords(sentences, words);

      expect(result.sentenceTimings).toHaveLength(2);

      // First sentence should have word timings
      expect(result.sentenceTimings[0].words).toHaveLength(2);
      expect(result.sentenceTimings[0].words[0].word).toBe('Hello');
      expect(result.sentenceTimings[0].words[1].word).toBe('world');

      // Second sentence should have word timings
      expect(result.sentenceTimings[1].words).toHaveLength(3);
      expect(result.sentenceTimings[1].words[0].word).toBe('How');
      expect(result.sentenceTimings[1].words[1].word).toBe('are');
      expect(result.sentenceTimings[1].words[2].word).toBe('you');
    });

    it('should make word timings relative to sentence start', () => {
      const sentences: SentenceInput[] = [
        { sentenceId: 's1', text: 'Hello world.', order: 0 },
        { sentenceId: 's2', text: 'Good morning.', order: 1 },
      ];

      const words: WordTiming[] = [
        { word: 'Hello', start: 0.0, end: 0.5, probability: 0.95 },
        { word: 'world', start: 0.5, end: 1.0, probability: 0.92 },
        { word: 'Good', start: 1.5, end: 2.0, probability: 0.98 },
        { word: 'morning', start: 2.0, end: 2.5, probability: 0.96 },
      ];

      const result = alignSentencesToTranscriptionWithWords(sentences, words);

      // First sentence: starts at 0ms
      expect(result.sentenceTimings[0].startMs).toBe(0);
      expect(result.sentenceTimings[0].words[0].startMs).toBe(0); // 0.0 - 0.0 = 0
      expect(result.sentenceTimings[0].words[1].startMs).toBe(500); // 0.5 - 0.0 = 0.5s = 500ms

      // Second sentence: starts at 1500ms
      expect(result.sentenceTimings[1].startMs).toBe(1500);
      expect(result.sentenceTimings[1].words[0].startMs).toBe(0); // 1.5 - 1.5 = 0
      expect(result.sentenceTimings[1].words[1].startMs).toBe(500); // 2.0 - 1.5 = 0.5s = 500ms
    });

    it('should preserve word probabilities', () => {
      const sentences: SentenceInput[] = [
        { sentenceId: 's1', text: 'Hello world.', order: 0 },
      ];

      const words: WordTiming[] = [
        { word: 'Hello', start: 0.0, end: 0.5, probability: 0.95 },
        { word: 'world', start: 0.5, end: 1.0, probability: 0.78 },
      ];

      const result = alignSentencesToTranscriptionWithWords(sentences, words);

      expect(result.sentenceTimings[0].words[0].probability).toBe(0.95);
      expect(result.sentenceTimings[0].words[1].probability).toBe(0.78);
    });

    it('should handle empty words array', () => {
      const sentences: SentenceInput[] = [
        { sentenceId: 's1', text: 'Hello world.', order: 0 },
      ];

      const result = alignSentencesToTranscriptionWithWords(sentences, []);

      expect(result.sentenceTimings).toHaveLength(1);
      expect(result.sentenceTimings[0].words).toHaveLength(0);
      expect(result.warnings).toContain('No transcription words available');
    });

    it('should handle empty sentences array', () => {
      const words: WordTiming[] = [
        { word: 'Hello', start: 0.0, end: 0.5, probability: 0.95 },
      ];

      const result = alignSentencesToTranscriptionWithWords([], words);

      expect(result.sentenceTimings).toHaveLength(0);
      expect(result.warnings).toContain('No sentences to align');
    });

    it('should handle sentences with no matching words', () => {
      const sentences: SentenceInput[] = [
        { sentenceId: 's1', text: 'Completely different text.', order: 0 },
      ];

      const words: WordTiming[] = [
        { word: 'Something', start: 0.0, end: 0.5, probability: 0.95 },
        { word: 'else', start: 0.5, end: 1.0, probability: 0.92 },
      ];

      const result = alignSentencesToTranscriptionWithWords(sentences, words);

      expect(result.sentenceTimings).toHaveLength(1);
      // Should still have timing info even with low confidence
      expect(result.sentenceTimings[0].startMs).toBeDefined();
      expect(result.sentenceTimings[0].endMs).toBeDefined();
      // May have low confidence
      expect(result.sentenceTimings[0].confidence).toBeLessThan(1);
    });

    it('should handle fuzzy matching and capture words', () => {
      const sentences: SentenceInput[] = [
        { sentenceId: 's1', text: "It's beautiful.", order: 0 },
      ];

      const words: WordTiming[] = [
        { word: "It's", start: 0.0, end: 0.3, probability: 0.9 },
        { word: 'beautiful', start: 0.3, end: 0.8, probability: 0.85 },
      ];

      const result = alignSentencesToTranscriptionWithWords(sentences, words);

      expect(result.sentenceTimings[0].words).toHaveLength(2);
      expect(result.sentenceTimings[0].words[0].word).toBe("It's");
      expect(result.sentenceTimings[0].words[1].word).toBe('beautiful');
    });

    it('should sort sentences by order before alignment', () => {
      const sentences: SentenceInput[] = [
        { sentenceId: 's2', text: 'Second.', order: 1 },
        { sentenceId: 's1', text: 'First.', order: 0 },
      ];

      const words: WordTiming[] = [
        { word: 'First', start: 0.0, end: 0.5, probability: 0.95 },
        { word: 'Second', start: 0.8, end: 1.3, probability: 0.92 },
      ];

      const result = alignSentencesToTranscriptionWithWords(sentences, words);

      // Results should be in order (s1 first, then s2)
      expect(result.sentenceTimings[0].sentenceId).toBe('s1');
      expect(result.sentenceTimings[1].sentenceId).toBe('s2');
    });

    it('should calculate correct endMs for words', () => {
      const sentences: SentenceInput[] = [
        { sentenceId: 's1', text: 'Hello world.', order: 0 },
      ];

      const words: WordTiming[] = [
        { word: 'Hello', start: 0.123, end: 0.456, probability: 0.95 },
        { word: 'world', start: 0.567, end: 0.890, probability: 0.92 },
      ];

      const result = alignSentencesToTranscriptionWithWords(sentences, words);

      // Check rounding: 0.123 * 1000 = 123, 0.456 * 1000 = 456
      expect(result.sentenceTimings[0].words[0].startMs).toBe(0); // relative to sentence start
      expect(result.sentenceTimings[0].words[0].endMs).toBe(333); // (0.456 - 0.123) * 1000 = 333ms
      expect(result.sentenceTimings[0].words[1].startMs).toBe(444); // (0.567 - 0.123) * 1000 = 444ms
      expect(result.sentenceTimings[0].words[1].endMs).toBe(767); // (0.890 - 0.123) * 1000 = 767ms
    });
  });
});
