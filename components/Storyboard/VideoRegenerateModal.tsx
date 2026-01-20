/**
 * VideoRegenerateModal Component
 * STORY-5-4: Video Generation UI
 *
 * Warning modal before regenerating all videos.
 */

import React from 'react';
import * as Icons from '../Icons';
import { Button } from '../ui/button';
import type { SceneStats } from '../../hooks/useSceneGeneration';

interface VideoRegenerateModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  sceneStats: SceneStats | null;
  isLoading?: boolean;
}

export const VideoRegenerateModal: React.FC<VideoRegenerateModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  sceneStats,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const existingVideoCount = sceneStats?.existingVideoCount ?? sceneStats?.withVideos ?? 0;
  const videoEligibleCount = sceneStats?.videoEligibleCount ?? sceneStats?.withImages ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e1933] border border-white/10 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <Icons.AlertTriangle className="text-yellow-400" size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-2">
              Re-Generate All Videos?
            </h3>
            <p className="text-sm text-text-muted mb-4">
              This will regenerate all videos, including {existingVideoCount} existing video{existingVideoCount !== 1 ? 's' : ''}.
              {videoEligibleCount > existingVideoCount && (
                <span className="block mt-2">
                  {videoEligibleCount - existingVideoCount} new video{videoEligibleCount - existingVideoCount !== 1 ? 's' : ''} will also be generated.
                </span>
              )}
            </p>

            <div className="bg-[#0d0b1a] rounded-lg p-3 mb-4 text-xs">
              <div className="flex justify-between text-text-muted mb-1">
                <span>Eligible sentences:</span>
                <span className="text-white font-medium">{videoEligibleCount}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Existing videos:</span>
                <span className="text-yellow-400 font-medium">{existingVideoCount}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                disabled={isLoading}
                className="flex-1 bg-yellow-600 hover:bg-yellow-500"
              >
                {isLoading ? (
                  <>
                    <Icons.RefreshCw className="animate-spin" size={14} />
                    Starting...
                  </>
                ) : (
                  <>
                    <Icons.Video size={14} />
                    Re-Generate
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoRegenerateModal;
