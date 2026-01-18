/**
 * Unit Tests for SentenceAudioStatus Component
 * STORY-3-3: Bulk Audio Generation
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SentenceAudioStatus } from '../../../components/ScriptEditorV2/SentenceAudioStatus';
import type { SentenceAudioState } from '../../../hooks/useAudioGeneration';

describe('SentenceAudioStatus', () => {
  const mockOnPlayAudio = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('queued state', () => {
    it('shows queued indicator', () => {
      const audioState: SentenceAudioState = {
        status: 'queued',
        jobId: 'job-1',
      };

      render(
        <SentenceAudioStatus
          audioState={audioState}
          isAudioDirty={true}
        />
      );

      expect(screen.getByText('Queued')).toBeInTheDocument();
    });
  });

  describe('generating state', () => {
    it('shows generating indicator', () => {
      const audioState: SentenceAudioState = {
        status: 'generating',
        jobId: 'job-1',
        progress: 50,
      };

      render(
        <SentenceAudioStatus
          audioState={audioState}
          isAudioDirty={true}
        />
      );

      expect(screen.getByText('Generating...')).toBeInTheDocument();
    });

    it('shows progress bar when progress is available', () => {
      const audioState: SentenceAudioState = {
        status: 'generating',
        jobId: 'job-1',
        progress: 75,
      };

      const { container } = render(
        <SentenceAudioStatus
          audioState={audioState}
          isAudioDirty={true}
        />
      );

      // Check that progress bar element exists with correct width
      const progressBar = container.querySelector('[style*="width: 75%"]');
      expect(progressBar).toBeInTheDocument();
    });

    it('does not show progress bar when progress is 0', () => {
      const audioState: SentenceAudioState = {
        status: 'generating',
        jobId: 'job-1',
        progress: 0,
      };

      const { container } = render(
        <SentenceAudioStatus
          audioState={audioState}
          isAudioDirty={true}
        />
      );

      // Should not have a progress bar container (16px wide)
      const progressContainer = container.querySelector('.w-16');
      expect(progressContainer).not.toBeInTheDocument();
    });
  });

  describe('failed state', () => {
    it('shows failed indicator with error message', () => {
      const audioState: SentenceAudioState = {
        status: 'failed',
        jobId: 'job-1',
        error: 'TTS service unavailable',
      };

      render(
        <SentenceAudioStatus
          audioState={audioState}
          isAudioDirty={true}
        />
      );

      expect(screen.getByText('TTS service unavailable')).toBeInTheDocument();
    });

    it('shows generic "Failed" when no error message', () => {
      const audioState: SentenceAudioState = {
        status: 'failed',
        jobId: 'job-1',
      };

      render(
        <SentenceAudioStatus
          audioState={audioState}
          isAudioDirty={true}
        />
      );

      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('has error message as title attribute for truncated text', () => {
      const longError = 'This is a very long error message that should be truncated in the UI';
      const audioState: SentenceAudioState = {
        status: 'failed',
        jobId: 'job-1',
        error: longError,
      };

      const { container } = render(
        <SentenceAudioStatus
          audioState={audioState}
          isAudioDirty={true}
        />
      );

      const errorElement = container.querySelector('[title]');
      expect(errorElement).toHaveAttribute('title', longError);
    });
  });

  describe('completed state', () => {
    it('shows play button when audio file is available', () => {
      const audioState: SentenceAudioState = {
        status: 'completed',
        jobId: 'job-1',
        audioFile: '/audio/test.wav',
        audioDuration: 5000,
      };

      render(
        <SentenceAudioStatus
          audioState={audioState}
          isAudioDirty={false}
          onPlayAudio={mockOnPlayAudio}
        />
      );

      expect(screen.getByTitle('Play audio')).toBeInTheDocument();
    });

    it('calls onPlayAudio when play button is clicked', () => {
      const audioState: SentenceAudioState = {
        status: 'completed',
        jobId: 'job-1',
        audioFile: '/audio/test.wav',
        audioDuration: 5000,
      };

      render(
        <SentenceAudioStatus
          audioState={audioState}
          isAudioDirty={false}
          onPlayAudio={mockOnPlayAudio}
        />
      );

      fireEvent.click(screen.getByTitle('Play audio'));

      expect(mockOnPlayAudio).toHaveBeenCalledWith('/audio/test.wav');
    });

    it('shows duration when available', () => {
      const audioState: SentenceAudioState = {
        status: 'completed',
        jobId: 'job-1',
        audioFile: '/audio/test.wav',
        audioDuration: 5500, // 5.5 seconds
      };

      render(
        <SentenceAudioStatus
          audioState={audioState}
          isAudioDirty={false}
          onPlayAudio={mockOnPlayAudio}
        />
      );

      expect(screen.getByText('5.5s')).toBeInTheDocument();
    });

    it('shows "NEW" badge for recently generated audio', () => {
      const audioState: SentenceAudioState = {
        status: 'completed',
        jobId: 'job-1',
        audioFile: '/audio/test.wav',
        audioDuration: 5000,
      };

      render(
        <SentenceAudioStatus
          audioState={audioState}
          isAudioDirty={false}
          onPlayAudio={mockOnPlayAudio}
        />
      );

      expect(screen.getByText('NEW')).toBeInTheDocument();
    });

    it('stops event propagation when play button is clicked', () => {
      const audioState: SentenceAudioState = {
        status: 'completed',
        jobId: 'job-1',
        audioFile: '/audio/test.wav',
        audioDuration: 5000,
      };

      const onParentClick = vi.fn();

      render(
        <div onClick={onParentClick}>
          <SentenceAudioStatus
            audioState={audioState}
            isAudioDirty={false}
            onPlayAudio={mockOnPlayAudio}
          />
        </div>
      );

      fireEvent.click(screen.getByTitle('Play audio'));

      expect(mockOnPlayAudio).toHaveBeenCalled();
      expect(onParentClick).not.toHaveBeenCalled();
    });
  });

  describe('existing audio (no active generation state)', () => {
    it('shows play button for existing audio file', () => {
      render(
        <SentenceAudioStatus
          isAudioDirty={false}
          existingAudioFile="/audio/existing.wav"
          existingDuration={3000}
          onPlayAudio={mockOnPlayAudio}
        />
      );

      expect(screen.getByTitle('Play audio')).toBeInTheDocument();
    });

    it('shows duration for existing audio', () => {
      render(
        <SentenceAudioStatus
          isAudioDirty={false}
          existingAudioFile="/audio/existing.wav"
          existingDuration={7300}
          onPlayAudio={mockOnPlayAudio}
        />
      );

      expect(screen.getByText('7.3s')).toBeInTheDocument();
    });

    it('calls onPlayAudio with existing file when clicked', () => {
      render(
        <SentenceAudioStatus
          isAudioDirty={false}
          existingAudioFile="/audio/existing.wav"
          existingDuration={3000}
          onPlayAudio={mockOnPlayAudio}
        />
      );

      fireEvent.click(screen.getByTitle('Play audio'));

      expect(mockOnPlayAudio).toHaveBeenCalledWith('/audio/existing.wav');
    });

    it('does not show "NEW" badge for existing audio', () => {
      render(
        <SentenceAudioStatus
          isAudioDirty={false}
          existingAudioFile="/audio/existing.wav"
          existingDuration={3000}
          onPlayAudio={mockOnPlayAudio}
        />
      );

      expect(screen.queryByText('NEW')).not.toBeInTheDocument();
    });
  });

  describe('dirty audio state', () => {
    it('shows "Outdated" when audio is dirty and no generation in progress', () => {
      render(
        <SentenceAudioStatus
          isAudioDirty={true}
        />
      );

      expect(screen.getByText('Outdated')).toBeInTheDocument();
    });

    it('has tooltip explaining outdated state', () => {
      const { container } = render(
        <SentenceAudioStatus
          isAudioDirty={true}
        />
      );

      const element = container.querySelector('[title="Audio needs regeneration"]');
      expect(element).toBeInTheDocument();
    });
  });

  describe('no audio state', () => {
    it('shows "No audio" when no audio file and not dirty', () => {
      render(
        <SentenceAudioStatus
          isAudioDirty={false}
        />
      );

      expect(screen.getByText('No audio')).toBeInTheDocument();
    });
  });

  describe('priority handling', () => {
    it('prefers new audio file over existing when completed', () => {
      const audioState: SentenceAudioState = {
        status: 'completed',
        jobId: 'job-1',
        audioFile: '/audio/new.wav',
        audioDuration: 5000,
      };

      render(
        <SentenceAudioStatus
          audioState={audioState}
          isAudioDirty={false}
          existingAudioFile="/audio/old.wav"
          existingDuration={3000}
          onPlayAudio={mockOnPlayAudio}
        />
      );

      fireEvent.click(screen.getByTitle('Play audio'));

      // Should play the new file, not the old one
      expect(mockOnPlayAudio).toHaveBeenCalledWith('/audio/new.wav');
    });

    it('shows new duration over existing duration when completed', () => {
      const audioState: SentenceAudioState = {
        status: 'completed',
        jobId: 'job-1',
        audioFile: '/audio/new.wav',
        audioDuration: 8000, // 8 seconds
      };

      render(
        <SentenceAudioStatus
          audioState={audioState}
          isAudioDirty={false}
          existingAudioFile="/audio/old.wav"
          existingDuration={3000} // 3 seconds
          onPlayAudio={mockOnPlayAudio}
        />
      );

      expect(screen.getByText('8.0s')).toBeInTheDocument();
      expect(screen.queryByText('3.0s')).not.toBeInTheDocument();
    });

    it('falls back to existing audio when new audio is not available but status is completed', () => {
      const audioState: SentenceAudioState = {
        status: 'completed',
        jobId: 'job-1',
        // No audioFile in state
      };

      render(
        <SentenceAudioStatus
          audioState={audioState}
          isAudioDirty={false}
          existingAudioFile="/audio/existing.wav"
          existingDuration={3000}
          onPlayAudio={mockOnPlayAudio}
        />
      );

      fireEvent.click(screen.getByTitle('Play audio'));

      expect(mockOnPlayAudio).toHaveBeenCalledWith('/audio/existing.wav');
    });
  });

  describe('without onPlayAudio callback', () => {
    it('does not render play button when onPlayAudio is not provided', () => {
      const audioState: SentenceAudioState = {
        status: 'completed',
        jobId: 'job-1',
        audioFile: '/audio/test.wav',
        audioDuration: 5000,
      };

      render(
        <SentenceAudioStatus
          audioState={audioState}
          isAudioDirty={false}
          // No onPlayAudio provided
        />
      );

      expect(screen.queryByTitle('Play audio')).not.toBeInTheDocument();
    });

    it('still shows duration when onPlayAudio is not provided', () => {
      const audioState: SentenceAudioState = {
        status: 'completed',
        jobId: 'job-1',
        audioFile: '/audio/test.wav',
        audioDuration: 5000,
      };

      render(
        <SentenceAudioStatus
          audioState={audioState}
          isAudioDirty={false}
        />
      );

      expect(screen.getByText('5.0s')).toBeInTheDocument();
    });
  });
});
