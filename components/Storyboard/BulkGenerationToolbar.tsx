/**
 * BulkGenerationToolbar Component
 * STORY-4-4: Bulk Scene Generation
 *
 * Features:
 * - "Generate All Scenes" button (AC: 1)
 * - Progress display: "Generating... (5/24)" (AC: 2)
 * - Cancel button (AC: 5)
 * - Completion toast notification (AC: 7)
 */

import React, { useEffect, useRef, useState } from 'react';
import * as Icons from '../Icons';
import { Button } from '../ui/button';
import { useSceneGeneration, type FailedSentence } from '../../hooks/useSceneGeneration';
import ErrorSummaryDialog from './ErrorSummaryDialog';
import RegenerateWarningModal from './RegenerateWarningModal';
import VideoRegenerateModal from './VideoRegenerateModal';

interface BulkGenerationToolbarProps {
  projectId: string | null;
  /** Called when generation completes (for refreshing data) */
  onGenerationComplete?: () => void;
  /** Called when an image completes */
  onImageComplete?: (sentenceId: string, imageFile: string) => void;
  /** Called when a video completes */
  onVideoComplete?: (sentenceId: string, videoFile: string) => void;
}

export const BulkGenerationToolbar: React.FC<BulkGenerationToolbarProps> = ({
  projectId,
  onGenerationComplete,
  onImageComplete,
  onVideoComplete,
}) => {
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [showVideoRegenerateModal, setShowVideoRegenerateModal] = useState(false);
  const [completionNotification, setCompletionNotification] = useState<string | null>(null);
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // STORY-5-4: Track if we're generating videos specifically
  const [isGeneratingVideos, setIsGeneratingVideos] = useState(false);

  const {
    isGenerating,
    isLoading,
    overallProgress,
    imagesCompleted,
    videosCompleted,
    totalImages,
    totalVideos,
    failedCount,
    failedSentences,
    completedCount,
    sceneStats,
    hasExistingContent,
    hasExistingVideos,
    canGenerateVideos,
    fetchSceneStats,
    generateAll,
    generateAllVideos,
    cancelAll,
    retryFailed,
    clearStates,
    error,
  } = useSceneGeneration(projectId, {
    onImageComplete,
    onVideoComplete,
    onAllComplete: () => {
      // Show completion notification (AC: 7)
      if (failedCount > 0) {
        setCompletionNotification(`Generation complete with ${failedCount} failed. Click to view details.`);
      } else {
        setCompletionNotification(`All scenes generated successfully!`);
      }

      // Auto-dismiss after 5 seconds
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
      notificationTimeoutRef.current = setTimeout(() => {
        setCompletionNotification(null);
      }, 5000);

      onGenerationComplete?.();
    },
  });

  // Clean up notification timeout on unmount
  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  // Handle button click - show modal if content exists, otherwise generate directly
  const handleButtonClick = () => {
    if (hasExistingContent) {
      setShowRegenerateModal(true);
    } else {
      handleGenerateAll(false);
    }
  };

  // Generate all images (no force - only generates missing/dirty)
  // Note: Videos are generated separately after user reviews images
  const handleGenerateAll = async (force: boolean) => {
    clearStates();
    const result = await generateAll(false, force); // includeVideos=false
    if (result) {
      const total = result.queued.images;
      if (total === 0) {
        setCompletionNotification('All images already up-to-date!');
        if (notificationTimeoutRef.current) {
          clearTimeout(notificationTimeoutRef.current);
        }
        notificationTimeoutRef.current = setTimeout(() => {
          setCompletionNotification(null);
        }, 3000);
      }
    }
  };

  // Handle regenerate confirmation from modal
  const handleRegenerateConfirm = async () => {
    setShowRegenerateModal(false);
    // Only regenerate images, not videos - user should review images first
    clearStates();
    const result = await generateAll(false, true); // includeVideos=false, force=true
    if (result) {
      const total = result.queued.images;
      if (total === 0) {
        setCompletionNotification('All images already up-to-date!');
        if (notificationTimeoutRef.current) {
          clearTimeout(notificationTimeoutRef.current);
        }
        notificationTimeoutRef.current = setTimeout(() => {
          setCompletionNotification(null);
        }, 3000);
      }
    }
    // Refresh scene stats after regeneration completes
    fetchSceneStats();
  };

  // STORY-5-4: Handle video generation button click (AC: 30-38)
  const handleVideoButtonClick = () => {
    if (hasExistingVideos) {
      setShowVideoRegenerateModal(true);
    } else {
      handleGenerateAllVideos(false);
    }
  };

  // STORY-5-4: Generate all videos
  const handleGenerateAllVideos = async (force: boolean) => {
    setIsGeneratingVideos(true);
    clearStates();
    const result = await generateAllVideos(force);
    if (result) {
      const total = result.queued;
      if (total === 0) {
        setCompletionNotification('No videos to generate! Ensure sentences have images and video prompts.');
        if (notificationTimeoutRef.current) {
          clearTimeout(notificationTimeoutRef.current);
        }
        notificationTimeoutRef.current = setTimeout(() => {
          setCompletionNotification(null);
        }, 3000);
        setIsGeneratingVideos(false);
      }
    } else {
      setIsGeneratingVideos(false);
    }
  };

  // STORY-5-4: Handle video regenerate confirmation from modal
  const handleVideoRegenerateConfirm = async () => {
    setShowVideoRegenerateModal(false);
    await handleGenerateAllVideos(true);
  };

  // Reset video generating flag when generation completes
  useEffect(() => {
    if (!isGenerating && isGeneratingVideos) {
      setIsGeneratingVideos(false);
    }
  }, [isGenerating, isGeneratingVideos]);

  const handleCancel = async () => {
    await cancelAll();
  };

  const handleRetryFailed = async () => {
    setShowErrorDialog(false);
    await retryFailed();
  };

  const handleDismissNotification = () => {
    setCompletionNotification(null);
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
  };

  const totalJobs = totalImages + totalVideos;
  const completedJobs = imagesCompleted + videosCompleted + failedCount;

  // Determine button state and text
  const getButtonContent = () => {
    if (isLoading) {
      return (
        <>
          <Icons.RefreshCw size={16} className="animate-spin" />
          Starting...
        </>
      );
    }

    if (isGenerating) {
      return (
        <>
          <Icons.RefreshCw size={16} className="animate-spin" />
          Generating... ({completedJobs}/{totalJobs})
        </>
      );
    }

    // Show "Re-Generate" if content already exists
    if (hasExistingContent) {
      return (
        <>
          <Icons.RefreshCw size={16} />
          Re-Generate Images
        </>
      );
    }

    return (
      <>
        <Icons.Wand2 size={16} />
        Generate All Images
      </>
    );
  };

  // STORY-5-4: Get video button content
  const getVideoButtonContent = () => {
    if (isLoading && isGeneratingVideos) {
      return (
        <>
          <Icons.RefreshCw size={16} className="animate-spin" />
          Starting...
        </>
      );
    }

    if (isGenerating && totalVideos > 0) {
      return (
        <>
          <Icons.RefreshCw size={16} className="animate-spin" />
          Videos... ({videosCompleted}/{totalVideos})
        </>
      );
    }

    // Show "Re-Generate" if videos already exist (AC: 38)
    if (hasExistingVideos) {
      return (
        <>
          <Icons.RefreshCw size={16} />
          Re-Generate Videos
        </>
      );
    }

    return (
      <>
        <Icons.Video size={16} />
        Generate All Videos
      </>
    );
  };

  return (
    <div className="flex items-center gap-3">
      {/* Generate Images Button */}
      <Button
        variant={isGenerating && !isGeneratingVideos ? 'outline' : 'default'}
        onClick={handleButtonClick}
        disabled={isLoading || isGenerating || !projectId}
        className="min-w-[200px]"
      >
        {getButtonContent()}
      </Button>

      {/* STORY-5-4: Generate Videos Button (AC: 30-32, 38) */}
      {canGenerateVideos && (
        <Button
          variant={isGenerating && isGeneratingVideos ? 'outline' : 'secondary'}
          onClick={handleVideoButtonClick}
          disabled={isLoading || isGenerating || !projectId}
          className="min-w-[180px]"
        >
          {getVideoButtonContent()}
        </Button>
      )}

      {/* Cancel Button - only show when generating */}
      {isGenerating && (
        <Button
          variant="destructive"
          onClick={handleCancel}
          disabled={isLoading}
          size="sm"
        >
          <Icons.X size={14} />
          Cancel
        </Button>
      )}

      {/* Progress Bar - only show when generating */}
      {isGenerating && totalJobs > 0 && (
        <div className="flex items-center gap-2 px-3">
          <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <span className="text-xs text-text-muted">
            {overallProgress}%
          </span>
        </div>
      )}

      {/* Error indicator - show when there are failures */}
      {failedCount > 0 && !isGenerating && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowErrorDialog(true)}
          className="text-red-400 hover:text-red-300"
        >
          <Icons.AlertTriangle size={14} />
          {failedCount} failed
        </Button>
      )}

      {/* Completion Notification Toast */}
      {completionNotification && (
        <div
          onClick={() => {
            if (failedCount > 0) {
              setShowErrorDialog(true);
            }
            handleDismissNotification();
          }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-all animate-in fade-in slide-in-from-top-2 ${
            failedCount > 0
              ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
              : 'bg-green-500/20 text-green-300 border border-green-500/30'
          }`}
        >
          {failedCount > 0 ? (
            <Icons.AlertTriangle size={14} />
          ) : (
            <Icons.CheckCircle size={14} />
          )}
          {completionNotification}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDismissNotification();
            }}
            className="ml-1 hover:opacity-70"
          >
            <Icons.X size={12} />
          </button>
        </div>
      )}

      {/* Error indicator for API errors */}
      {error && !isGenerating && (
        <span className="text-xs text-red-400">{error}</span>
      )}

      {/* Error Summary Dialog */}
      <ErrorSummaryDialog
        isOpen={showErrorDialog}
        onClose={() => setShowErrorDialog(false)}
        failedSentences={failedSentences}
        onRetry={handleRetryFailed}
      />

      {/* Regenerate Warning Modal */}
      <RegenerateWarningModal
        isOpen={showRegenerateModal}
        onConfirm={handleRegenerateConfirm}
        onCancel={() => setShowRegenerateModal(false)}
        sceneStats={sceneStats}
        isLoading={isLoading}
      />

      {/* STORY-5-4: Video Regenerate Warning Modal */}
      <VideoRegenerateModal
        isOpen={showVideoRegenerateModal}
        onConfirm={handleVideoRegenerateConfirm}
        onCancel={() => setShowVideoRegenerateModal(false)}
        sceneStats={sceneStats}
        isLoading={isLoading}
      />
    </div>
  );
};

export default BulkGenerationToolbar;
