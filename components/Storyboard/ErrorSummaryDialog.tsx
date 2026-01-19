/**
 * ErrorSummaryDialog Component
 * STORY-4-4: Bulk Scene Generation
 *
 * Features:
 * - Show error summary (AC: 8)
 * - Retry failed sentences option (AC: 9)
 */

import React from 'react';
import * as Icons from '../Icons';
import { Button } from '../ui/button';
import { type FailedSentence } from '../../hooks/useSceneGeneration';

interface ErrorSummaryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  failedSentences: FailedSentence[];
  onRetry: () => void;
}

export const ErrorSummaryDialog: React.FC<ErrorSummaryDialogProps> = ({
  isOpen,
  onClose,
  failedSentences,
  onRetry,
}) => {
  if (!isOpen) return null;

  const imageFailures = failedSentences.filter(f => f.jobType === 'image');
  const videoFailures = failedSentences.filter(f => f.jobType === 'video');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-[#1e1933] border border-white/10 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Icons.AlertTriangle className="text-red-400" size={20} />
            <h3 className="text-lg font-bold text-white">Generation Errors</h3>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-white transition-colors"
          >
            <Icons.X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Summary */}
          <div className="flex gap-4 text-sm">
            {imageFailures.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                <Icons.ImageIcon size={14} className="text-red-400" />
                <span className="text-red-300">{imageFailures.length} image{imageFailures.length !== 1 ? 's' : ''} failed</span>
              </div>
            )}
            {videoFailures.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                <Icons.Video size={14} className="text-red-400" />
                <span className="text-red-300">{videoFailures.length} video{videoFailures.length !== 1 ? 's' : ''} failed</span>
              </div>
            )}
          </div>

          {/* Error List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Failed Items ({failedSentences.length})
            </h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {failedSentences.map((failure, idx) => (
                <div
                  key={`${failure.sentenceId}-${failure.jobType}`}
                  className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/5"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {failure.jobType === 'image' ? (
                      <Icons.ImageIcon size={14} className="text-text-muted" />
                    ) : (
                      <Icons.Video size={14} className="text-text-muted" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-muted truncate">
                      Sentence: {failure.sentenceId.substring(0, 12)}...
                    </p>
                    <p className="text-sm text-red-300 mt-1 break-words">
                      {failure.error}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Common Errors Tip */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <Icons.Info size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-300">
                <p className="font-bold mb-1">Common causes:</p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-300/80">
                  <li>ComfyUI not running or unreachable</li>
                  <li>Invalid or missing prompts</li>
                  <li>Insufficient GPU memory</li>
                  <li>Network timeout during generation</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-white/5">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onRetry} disabled={failedSentences.length === 0}>
            <Icons.RefreshCw size={14} />
            Retry Failed ({failedSentences.length})
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ErrorSummaryDialog;
