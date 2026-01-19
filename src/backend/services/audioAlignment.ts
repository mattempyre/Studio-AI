/**
 * Audio Alignment Service
 *
 * Aligns transcribed words from Whisper back to original sentences.
 * Uses fuzzy matching to handle transcription variations.
 */

import type { WordTiming } from '../clients/whisper.js';

/**
 * Sentence with ID and text for alignment
 */
export interface SentenceInput {
  sentenceId: string;
  text: string;
  order: number;
}

/**
 * Word timing data for karaoke-style highlighting
 */
export interface WordTimingData {
  word: string;
  startMs: number; // milliseconds relative to sentence start
  endMs: number;
  probability: number; // confidence from Whisper (0-1)
}

/**
 * Result of sentence alignment with timing
 */
export interface SentenceTiming {
  sentenceId: string;
  startMs: number;
  endMs: number;
  confidence: number; // 0-1, based on word match quality
}

/**
 * Sentence timing with word-level data for karaoke highlighting
 */
export interface SentenceTimingWithWords extends SentenceTiming {
  words: WordTimingData[];
}

/**
 * Result of full section alignment
 */
export interface AlignmentResult {
  sentenceTimings: SentenceTiming[];
  totalDurationMs: number;
  averageConfidence: number;
  warnings: string[];
}

/**
 * Result of full section alignment with word-level data
 */
export interface AlignmentResultWithWords {
  sentenceTimings: SentenceTimingWithWords[];
  totalDurationMs: number;
  averageConfidence: number;
  warnings: string[];
}

/**
 * Tokenize text into normalized words for matching
 */
function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, '') // Remove punctuation except apostrophes
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Normalize a word for comparison
 */
function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^\w']/g, '') // Keep only alphanumeric and apostrophes
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Check if two words match (exact or fuzzy)
 */
function wordsMatch(whisperWord: string, targetWord: string): boolean {
  const w1 = normalizeWord(whisperWord);
  const w2 = normalizeWord(targetWord);

  // Exact match
  if (w1 === w2) return true;

  // Empty check
  if (w1.length === 0 || w2.length === 0) return false;

  // Fuzzy match: allow distance proportional to word length
  const maxDistance = Math.max(1, Math.floor(Math.max(w1.length, w2.length) * 0.3));
  const distance = levenshteinDistance(w1, w2);

  return distance <= maxDistance;
}

/**
 * Calculate match confidence for a word pair
 */
function wordMatchConfidence(whisperWord: string, targetWord: string): number {
  const w1 = normalizeWord(whisperWord);
  const w2 = normalizeWord(targetWord);

  if (w1 === w2) return 1.0;
  if (w1.length === 0 || w2.length === 0) return 0.0;

  const distance = levenshteinDistance(w1, w2);
  const maxLen = Math.max(w1.length, w2.length);

  return Math.max(0, 1 - distance / maxLen);
}

/**
 * Find the best starting position for a sentence in the word array
 */
function findSentenceStart(
  sentenceWords: string[],
  whisperWords: WordTiming[],
  startIndex: number,
  maxLookahead: number = 10
): { index: number; confidence: number } {
  if (sentenceWords.length === 0) {
    return { index: startIndex, confidence: 0 };
  }

  const firstWord = sentenceWords[0];
  let bestIndex = startIndex;
  let bestConfidence = 0;

  // Look for the best match within the lookahead window
  const searchEnd = Math.min(startIndex + maxLookahead, whisperWords.length);
  for (let i = startIndex; i < searchEnd; i++) {
    const confidence = wordMatchConfidence(whisperWords[i].word, firstWord);
    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestIndex = i;
    }
    // If we find an exact match, stop looking
    if (confidence === 1.0) break;
  }

  return { index: bestIndex, confidence: bestConfidence };
}

/**
 * Align sentences to transcription word timings
 *
 * @param sentences - Array of sentences with IDs and text
 * @param words - Word-level timings from Whisper transcription
 * @returns Alignment result with per-sentence timings
 */
export function alignSentencesToTranscription(
  sentences: SentenceInput[],
  words: WordTiming[]
): AlignmentResult {
  const warnings: string[] = [];

  if (sentences.length === 0) {
    return {
      sentenceTimings: [],
      totalDurationMs: 0,
      averageConfidence: 0,
      warnings: ['No sentences to align'],
    };
  }

  if (words.length === 0) {
    return {
      sentenceTimings: sentences.map((s) => ({
        sentenceId: s.sentenceId,
        startMs: 0,
        endMs: 0,
        confidence: 0,
      })),
      totalDurationMs: 0,
      averageConfidence: 0,
      warnings: ['No transcription words available'],
    };
  }

  // Sort sentences by order
  const sortedSentences = [...sentences].sort((a, b) => a.order - b.order);
  const results: SentenceTiming[] = [];
  let wordIndex = 0;
  let totalConfidence = 0;

  for (const sentence of sortedSentences) {
    const sentenceWords = tokenizeText(sentence.text);

    if (sentenceWords.length === 0) {
      // Empty sentence - use the current position
      const currentTime = wordIndex < words.length ? words[wordIndex].start : (words[words.length - 1]?.end || 0);
      results.push({
        sentenceId: sentence.sentenceId,
        startMs: Math.round(currentTime * 1000),
        endMs: Math.round(currentTime * 1000),
        confidence: 0,
      });
      warnings.push(`Sentence ${sentence.sentenceId} has no words to align`);
      continue;
    }

    // Find where this sentence starts
    const startSearch = findSentenceStart(sentenceWords, words, wordIndex);
    const sentenceStartIndex = startSearch.index;
    let sentenceEndIndex = sentenceStartIndex;
    let matchCount = 0;

    // Walk through sentence words and find matching Whisper words
    let currentWordIndex = sentenceStartIndex;
    for (const targetWord of sentenceWords) {
      // Look for this word in the next few Whisper words
      let found = false;
      const searchEnd = Math.min(currentWordIndex + 5, words.length);

      for (let i = currentWordIndex; i < searchEnd; i++) {
        if (wordsMatch(words[i].word, targetWord)) {
          currentWordIndex = i + 1;
          sentenceEndIndex = i;
          matchCount++;
          found = true;
          break;
        }
      }

      // If not found, advance anyway to avoid getting stuck
      if (!found && currentWordIndex < words.length) {
        currentWordIndex++;
        sentenceEndIndex = Math.min(currentWordIndex, words.length - 1);
      }
    }

    // Calculate timing
    const startTime = words[sentenceStartIndex]?.start || 0;
    const endTime = words[sentenceEndIndex]?.end || startTime;

    // Calculate confidence based on how many words matched
    const confidence = sentenceWords.length > 0 ? matchCount / sentenceWords.length : 0;

    results.push({
      sentenceId: sentence.sentenceId,
      startMs: Math.round(startTime * 1000),
      endMs: Math.round(endTime * 1000),
      confidence,
    });

    totalConfidence += confidence;

    // Low confidence warning
    if (confidence < 0.5) {
      warnings.push(
        `Low confidence (${(confidence * 100).toFixed(0)}%) for sentence ${sentence.sentenceId}: "${sentence.text.substring(0, 50)}..."`
      );
    }

    // Move word index forward for next sentence
    wordIndex = sentenceEndIndex + 1;
  }

  // Calculate total duration
  const totalDurationMs = words.length > 0 ? Math.round(words[words.length - 1].end * 1000) : 0;

  return {
    sentenceTimings: results,
    totalDurationMs,
    averageConfidence: results.length > 0 ? totalConfidence / results.length : 0,
    warnings,
  };
}

/**
 * Align sentences to transcription word timings WITH word-level data
 *
 * This version returns word timings for each sentence, enabling karaoke-style highlighting.
 * Word times are relative to the sentence start.
 *
 * @param sentences - Array of sentences with IDs and text
 * @param words - Word-level timings from Whisper transcription
 * @returns Alignment result with per-sentence timings AND word timings
 */
export function alignSentencesToTranscriptionWithWords(
  sentences: SentenceInput[],
  words: WordTiming[]
): AlignmentResultWithWords {
  const warnings: string[] = [];

  if (sentences.length === 0) {
    return {
      sentenceTimings: [],
      totalDurationMs: 0,
      averageConfidence: 0,
      warnings: ['No sentences to align'],
    };
  }

  if (words.length === 0) {
    return {
      sentenceTimings: sentences.map((s) => ({
        sentenceId: s.sentenceId,
        startMs: 0,
        endMs: 0,
        confidence: 0,
        words: [],
      })),
      totalDurationMs: 0,
      averageConfidence: 0,
      warnings: ['No transcription words available'],
    };
  }

  // Sort sentences by order
  const sortedSentences = [...sentences].sort((a, b) => a.order - b.order);
  const results: SentenceTimingWithWords[] = [];
  let wordIndex = 0;
  let totalConfidence = 0;

  for (const sentence of sortedSentences) {
    const sentenceWords = tokenizeText(sentence.text);
    const capturedWords: WordTimingData[] = [];

    if (sentenceWords.length === 0) {
      // Empty sentence - use the current position
      const currentTime = wordIndex < words.length ? words[wordIndex].start : (words[words.length - 1]?.end || 0);
      results.push({
        sentenceId: sentence.sentenceId,
        startMs: Math.round(currentTime * 1000),
        endMs: Math.round(currentTime * 1000),
        confidence: 0,
        words: [],
      });
      warnings.push(`Sentence ${sentence.sentenceId} has no words to align`);
      continue;
    }

    // Find where this sentence starts
    const startSearch = findSentenceStart(sentenceWords, words, wordIndex);
    const sentenceStartIndex = startSearch.index;
    let sentenceEndIndex = sentenceStartIndex;
    let matchCount = 0;

    // Track the absolute start time of this sentence
    const sentenceStartTime = words[sentenceStartIndex]?.start || 0;

    // Walk through sentence words and find matching Whisper words
    let currentWordIndex = sentenceStartIndex;
    for (const targetWord of sentenceWords) {
      // Look for this word in the next few Whisper words
      let found = false;
      const searchEnd = Math.min(currentWordIndex + 5, words.length);

      for (let i = currentWordIndex; i < searchEnd; i++) {
        if (wordsMatch(words[i].word, targetWord)) {
          const whisperWord = words[i];
          // Capture word timing relative to sentence start
          capturedWords.push({
            word: whisperWord.word.trim(),
            startMs: Math.round((whisperWord.start - sentenceStartTime) * 1000),
            endMs: Math.round((whisperWord.end - sentenceStartTime) * 1000),
            probability: whisperWord.probability,
          });
          currentWordIndex = i + 1;
          sentenceEndIndex = i;
          matchCount++;
          found = true;
          break;
        }
      }

      // If not found, advance anyway to avoid getting stuck
      if (!found && currentWordIndex < words.length) {
        currentWordIndex++;
        sentenceEndIndex = Math.min(currentWordIndex, words.length - 1);
      }
    }

    // Calculate timing
    const startTime = words[sentenceStartIndex]?.start || 0;
    const endTime = words[sentenceEndIndex]?.end || startTime;

    // Calculate confidence based on how many words matched
    const confidence = sentenceWords.length > 0 ? matchCount / sentenceWords.length : 0;

    results.push({
      sentenceId: sentence.sentenceId,
      startMs: Math.round(startTime * 1000),
      endMs: Math.round(endTime * 1000),
      confidence,
      words: capturedWords,
    });

    totalConfidence += confidence;

    // Low confidence warning
    if (confidence < 0.5) {
      warnings.push(
        `Low confidence (${(confidence * 100).toFixed(0)}%) for sentence ${sentence.sentenceId}: "${sentence.text.substring(0, 50)}..."`
      );
    }

    // Move word index forward for next sentence
    wordIndex = sentenceEndIndex + 1;
  }

  // Calculate total duration
  const totalDurationMs = words.length > 0 ? Math.round(words[words.length - 1].end * 1000) : 0;

  return {
    sentenceTimings: results,
    totalDurationMs,
    averageConfidence: results.length > 0 ? totalConfidence / results.length : 0,
    warnings,
  };
}

/**
 * Validate alignment results and suggest corrections
 */
export function validateAlignment(result: AlignmentResult): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for overlapping sentences
  for (let i = 1; i < result.sentenceTimings.length; i++) {
    const prev = result.sentenceTimings[i - 1];
    const curr = result.sentenceTimings[i];

    if (curr.startMs < prev.endMs) {
      issues.push(
        `Sentences ${prev.sentenceId} and ${curr.sentenceId} overlap: ${prev.endMs}ms > ${curr.startMs}ms`
      );
    }
  }

  // Check for zero-length sentences
  for (const timing of result.sentenceTimings) {
    if (timing.endMs <= timing.startMs) {
      issues.push(`Sentence ${timing.sentenceId} has zero or negative duration`);
    }
  }

  // Check overall confidence
  if (result.averageConfidence < 0.5) {
    issues.push(`Low overall alignment confidence: ${(result.averageConfidence * 100).toFixed(0)}%`);
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}
