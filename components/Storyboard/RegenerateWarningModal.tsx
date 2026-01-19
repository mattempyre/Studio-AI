/**
 * RegenerateWarningModal Component
 *
 * Confirmation modal shown before regenerating all scenes.
 * Warns users that existing images/videos will be replaced.
 */

import React from 'react';
import * as Icons from '../Icons';
import { Button } from '../ui/button';

export interface SceneStats {
  totalSentences: number;
  withImages: number;
  withVideos: number;
  needingImages: number;
  needingVideos: number;
}

interface RegenerateWarningModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  sceneStats: SceneStats | null;
  isLoading?: boolean;
}

export const RegenerateWarningModal: React.FC<RegenerateWarningModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  sceneStats,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const imageCount = sceneStats?.withImages ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-surface-2 border border-border-color rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-full bg-amber-500/20">
            <Icons.AlertTriangle className="text-amber-400" size={20} />
          </div>
          <h3 className="text-lg font-bold text-white">Re-Generate All Images?</h3>
        </div>

        <p className="text-text-muted mb-4">
          This will replace all existing scene images with newly generated content.
          Videos will not be affected.
        </p>

        {imageCount > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-6">
            <p className="text-amber-200 text-sm">
              <span className="font-semibold">{imageCount}</span> image{imageCount !== 1 ? 's' : ''} will be regenerated.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Icons.RefreshCw size={16} className="animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Icons.RefreshCw size={16} />
                Re-Generate Images
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RegenerateWarningModal;
