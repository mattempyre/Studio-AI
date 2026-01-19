/**
 * Unit tests for BulkGenerationToolbar component
 * STORY-4-4: Bulk Scene Generation
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BulkGenerationToolbar } from '../../../components/Storyboard/BulkGenerationToolbar';

// Mock the useSceneGeneration hook
const mockGenerateAll = vi.fn();
const mockCancelAll = vi.fn();
const mockRetryFailed = vi.fn();
const mockClearStates = vi.fn();

vi.mock('../../../hooks/useSceneGeneration', () => ({
  useSceneGeneration: vi.fn(() => ({
    isGenerating: false,
    isLoading: false,
    overallProgress: 0,
    imagesCompleted: 0,
    videosCompleted: 0,
    totalImages: 0,
    totalVideos: 0,
    failedCount: 0,
    failedSentences: [],
    completedCount: 0,
    generateAll: mockGenerateAll,
    cancelAll: mockCancelAll,
    retryFailed: mockRetryFailed,
    clearStates: mockClearStates,
    error: null,
  })),
}));

import { useSceneGeneration } from '../../../hooks/useSceneGeneration';

describe('BulkGenerationToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateAll.mockResolvedValue({
      queued: { images: 5, videos: 3 },
      totalSentences: 8,
      imageJobs: [],
      videoJobs: [],
      message: 'Queued jobs',
    });
  });

  describe('Generate All Button', () => {
    it('should render "Generate All Scenes" button (AC: 1)', () => {
      render(<BulkGenerationToolbar projectId="project-1" />);

      expect(screen.getByText('Generate All Scenes')).toBeInTheDocument();
    });

    it('should call generateAll when button is clicked', async () => {
      render(<BulkGenerationToolbar projectId="project-1" />);

      const button = screen.getByText('Generate All Scenes');
      fireEvent.click(button);

      expect(mockClearStates).toHaveBeenCalled();
      expect(mockGenerateAll).toHaveBeenCalledWith(true);
    });

    it('should be disabled when no projectId', () => {
      render(<BulkGenerationToolbar projectId={null} />);

      const button = screen.getByText('Generate All Scenes');
      expect(button).toBeDisabled();
    });
  });

  describe('Progress Display', () => {
    it('should show progress text when generating (AC: 2)', () => {
      vi.mocked(useSceneGeneration).mockReturnValue({
        isGenerating: true,
        isLoading: false,
        overallProgress: 50,
        imagesCompleted: 3,
        videosCompleted: 2,
        totalImages: 6,
        totalVideos: 4,
        failedCount: 0,
        failedSentences: [],
        completedCount: 5,
        generateAll: mockGenerateAll,
        cancelAll: mockCancelAll,
        retryFailed: mockRetryFailed,
        clearStates: mockClearStates,
        error: null,
        sentenceStates: new Map(),
        totalPending: 5,
        getSentenceStatus: vi.fn(),
      });

      render(<BulkGenerationToolbar projectId="project-1" />);

      // Should show progress like "Generating... (5/10)"
      expect(screen.getByText(/Generating\.\.\./)).toBeInTheDocument();
      expect(screen.getByText(/\(5\/10\)/)).toBeInTheDocument();
    });

    it('should show progress bar when generating', () => {
      vi.mocked(useSceneGeneration).mockReturnValue({
        isGenerating: true,
        isLoading: false,
        overallProgress: 60,
        imagesCompleted: 3,
        videosCompleted: 3,
        totalImages: 5,
        totalVideos: 5,
        failedCount: 0,
        failedSentences: [],
        completedCount: 6,
        generateAll: mockGenerateAll,
        cancelAll: mockCancelAll,
        retryFailed: mockRetryFailed,
        clearStates: mockClearStates,
        error: null,
        sentenceStates: new Map(),
        totalPending: 4,
        getSentenceStatus: vi.fn(),
      });

      render(<BulkGenerationToolbar projectId="project-1" />);

      expect(screen.getByText('60%')).toBeInTheDocument();
    });
  });

  describe('Cancel Button', () => {
    it('should show cancel button when generating (AC: 5)', () => {
      vi.mocked(useSceneGeneration).mockReturnValue({
        isGenerating: true,
        isLoading: false,
        overallProgress: 30,
        imagesCompleted: 1,
        videosCompleted: 0,
        totalImages: 5,
        totalVideos: 3,
        failedCount: 0,
        failedSentences: [],
        completedCount: 1,
        generateAll: mockGenerateAll,
        cancelAll: mockCancelAll,
        retryFailed: mockRetryFailed,
        clearStates: mockClearStates,
        error: null,
        sentenceStates: new Map(),
        totalPending: 7,
        getSentenceStatus: vi.fn(),
      });

      render(<BulkGenerationToolbar projectId="project-1" />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should call cancelAll when cancel button is clicked', async () => {
      vi.mocked(useSceneGeneration).mockReturnValue({
        isGenerating: true,
        isLoading: false,
        overallProgress: 30,
        imagesCompleted: 1,
        videosCompleted: 0,
        totalImages: 5,
        totalVideos: 3,
        failedCount: 0,
        failedSentences: [],
        completedCount: 1,
        generateAll: mockGenerateAll,
        cancelAll: mockCancelAll,
        retryFailed: mockRetryFailed,
        clearStates: mockClearStates,
        error: null,
        sentenceStates: new Map(),
        totalPending: 7,
        getSentenceStatus: vi.fn(),
      });

      render(<BulkGenerationToolbar projectId="project-1" />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockCancelAll).toHaveBeenCalled();
    });

    it('should not show cancel button when not generating', () => {
      vi.mocked(useSceneGeneration).mockReturnValue({
        isGenerating: false,
        isLoading: false,
        overallProgress: 0,
        imagesCompleted: 0,
        videosCompleted: 0,
        totalImages: 0,
        totalVideos: 0,
        failedCount: 0,
        failedSentences: [],
        completedCount: 0,
        generateAll: mockGenerateAll,
        cancelAll: mockCancelAll,
        retryFailed: mockRetryFailed,
        clearStates: mockClearStates,
        error: null,
        sentenceStates: new Map(),
        totalPending: 0,
        getSentenceStatus: vi.fn(),
      });

      render(<BulkGenerationToolbar projectId="project-1" />);

      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });
  });

  describe('Error Display', () => {
    it('should show failed count indicator (AC: 8)', () => {
      vi.mocked(useSceneGeneration).mockReturnValue({
        isGenerating: false,
        isLoading: false,
        overallProgress: 100,
        imagesCompleted: 3,
        videosCompleted: 2,
        totalImages: 5,
        totalVideos: 3,
        failedCount: 3,
        failedSentences: [
          { sentenceId: 'sent-1', jobType: 'image' as const, error: 'Timeout' },
          { sentenceId: 'sent-2', jobType: 'video' as const, error: 'Invalid prompt' },
          { sentenceId: 'sent-3', jobType: 'image' as const, error: 'GPU error' },
        ],
        completedCount: 5,
        generateAll: mockGenerateAll,
        cancelAll: mockCancelAll,
        retryFailed: mockRetryFailed,
        clearStates: mockClearStates,
        error: null,
        sentenceStates: new Map(),
        totalPending: 0,
        getSentenceStatus: vi.fn(),
      });

      render(<BulkGenerationToolbar projectId="project-1" />);

      expect(screen.getByText('3 failed')).toBeInTheDocument();
    });
  });
});
