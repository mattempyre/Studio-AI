/**
 * Unit Tests for AudioToolbar Component
 * STORY-3-3: Bulk Audio Generation
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AudioToolbar } from '../../../components/ScriptEditorV2/AudioToolbar';

describe('AudioToolbar', () => {
  const defaultProps = {
    isGenerating: false,
    isLoading: false,
    dirtySentenceCount: 0,
    totalPending: 0,
    completedCount: 0,
    failedCount: 0,
    overallProgress: 0,
    onGenerateAll: vi.fn(),
    onCancelAll: vi.fn(),
    error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('idle state', () => {
    it('renders "Generate All Audio" button when not generating', () => {
      render(<AudioToolbar {...defaultProps} dirtySentenceCount={5} />);

      expect(screen.getByText('Generate All Audio')).toBeInTheDocument();
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });

    it('shows dirty sentence count badge when there are dirty sentences', () => {
      render(<AudioToolbar {...defaultProps} dirtySentenceCount={5} />);

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('disables button when no dirty sentences', () => {
      render(<AudioToolbar {...defaultProps} dirtySentenceCount={0} />);

      const button = screen.getByText('Generate All Audio').closest('button');
      expect(button).toBeDisabled();
    });

    it('enables button when there are dirty sentences', () => {
      render(<AudioToolbar {...defaultProps} dirtySentenceCount={3} />);

      const button = screen.getByText('Generate All Audio').closest('button');
      expect(button).not.toBeDisabled();
    });

    it('shows "All audio up to date" when no dirty sentences and not generating', () => {
      render(<AudioToolbar {...defaultProps} dirtySentenceCount={0} />);

      expect(screen.getByText('All audio up to date')).toBeInTheDocument();
    });

    it('calls onGenerateAll when button is clicked', () => {
      const onGenerateAll = vi.fn();
      render(
        <AudioToolbar
          {...defaultProps}
          dirtySentenceCount={3}
          onGenerateAll={onGenerateAll}
        />
      );

      fireEvent.click(screen.getByText('Generate All Audio'));

      expect(onGenerateAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('generating state', () => {
    it('shows Cancel button when generating', () => {
      render(<AudioToolbar {...defaultProps} isGenerating={true} totalPending={5} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.queryByText('Generate All Audio')).not.toBeInTheDocument();
    });

    it('shows progress bar when generating', () => {
      render(
        <AudioToolbar
          {...defaultProps}
          isGenerating={true}
          totalPending={3}
          completedCount={2}
          overallProgress={40}
        />
      );

      // Progress bar should be visible (check for progress section)
      expect(screen.getByText('Generating...')).toBeInTheDocument();
    });

    it('shows completion count during generation', () => {
      render(
        <AudioToolbar
          {...defaultProps}
          isGenerating={true}
          totalPending={3}
          completedCount={2}
          overallProgress={40}
        />
      );

      // Should show "2" (completed) and "/5" (total)
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('/5')).toBeInTheDocument();
    });

    it('calls onCancelAll when cancel button is clicked', () => {
      const onCancelAll = vi.fn();
      render(
        <AudioToolbar
          {...defaultProps}
          isGenerating={true}
          totalPending={5}
          onCancelAll={onCancelAll}
        />
      );

      fireEvent.click(screen.getByText('Cancel'));

      expect(onCancelAll).toHaveBeenCalledTimes(1);
    });

    it('disables cancel button when loading', () => {
      render(
        <AudioToolbar
          {...defaultProps}
          isGenerating={true}
          isLoading={true}
          totalPending={5}
        />
      );

      const cancelButton = screen.getByText('Cancel').closest('button');
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('loading state', () => {
    it('shows loading spinner when loading and not generating', () => {
      render(
        <AudioToolbar {...defaultProps} isLoading={true} dirtySentenceCount={3} />
      );

      // Button should still say "Generate All Audio" but be disabled
      const button = screen.getByText('Generate All Audio').closest('button');
      expect(button).toBeDisabled();
    });

    it('disables generate button when loading', () => {
      render(
        <AudioToolbar {...defaultProps} isLoading={true} dirtySentenceCount={5} />
      );

      const button = screen.getByText('Generate All Audio').closest('button');
      expect(button).toBeDisabled();
    });
  });

  describe('progress display', () => {
    it('shows progress when there are completed jobs', () => {
      render(
        <AudioToolbar
          {...defaultProps}
          completedCount={3}
          totalPending={0}
          overallProgress={100}
        />
      );

      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('/3')).toBeInTheDocument();
    });

    it('shows failed count when there are failures', () => {
      render(
        <AudioToolbar
          {...defaultProps}
          completedCount={2}
          failedCount={1}
          totalPending={0}
          overallProgress={100}
        />
      );

      expect(screen.getByText('1 failed')).toBeInTheDocument();
    });

    it('does not show failed count when no failures', () => {
      render(
        <AudioToolbar
          {...defaultProps}
          completedCount={3}
          failedCount={0}
          totalPending={0}
          overallProgress={100}
        />
      );

      expect(screen.queryByText(/failed/)).not.toBeInTheDocument();
    });

    it('calculates total jobs correctly', () => {
      render(
        <AudioToolbar
          {...defaultProps}
          isGenerating={true}
          totalPending={2}
          completedCount={3}
          failedCount={1}
          overallProgress={67}
        />
      );

      // Total = pending (2) + completed (3) + failed (1) = 6
      expect(screen.getByText('3')).toBeInTheDocument(); // completed
      expect(screen.getByText('/6')).toBeInTheDocument(); // total
    });
  });

  describe('error display', () => {
    it('shows error message when error is present', () => {
      render(
        <AudioToolbar {...defaultProps} error="Failed to connect to server" />
      );

      expect(screen.getByText('Failed to connect to server')).toBeInTheDocument();
    });

    it('does not show error section when error is null', () => {
      render(<AudioToolbar {...defaultProps} error={null} />);

      // Should not have any error-related text
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });
  });

  describe('button title attributes', () => {
    it('shows helpful tooltip when disabled due to no dirty sentences', () => {
      render(<AudioToolbar {...defaultProps} dirtySentenceCount={0} />);

      const button = screen.getByText('Generate All Audio').closest('button');
      expect(button).toHaveAttribute(
        'title',
        'All sentences have up-to-date audio'
      );
    });

    it('shows count tooltip when there are dirty sentences', () => {
      render(<AudioToolbar {...defaultProps} dirtySentenceCount={7} />);

      const button = screen.getByText('Generate All Audio').closest('button');
      expect(button).toHaveAttribute(
        'title',
        'Generate audio for 7 sentences'
      );
    });
  });
});
