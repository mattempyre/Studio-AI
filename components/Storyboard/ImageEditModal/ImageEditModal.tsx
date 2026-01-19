/**
 * ImageEditModal Component
 *
 * Modal for editing scene images using prompt-based or selective (inpainting) editing.
 * Integrates with ComfyUI Flux2 Klein 9B Inpainting workflow.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as Icons from '../../Icons';
import { Button } from '../../ui/button';
import EditModeSelector from './EditModeSelector';
import PromptInput from './PromptInput';
import MaskCanvas from './MaskCanvas';
import BrushControls from './BrushControls';
import { useWebSocket, type JobCompleteEvent, type ProgressEvent, type JobFailedEvent } from '@/hooks/useWebSocket';
import type { ImageEditModalProps, EditMode } from './types';

// Backend API base URL - matches pattern used in services/backendApi.ts
const API_BASE = 'http://localhost:3001';

// Polling interval for job status fallback (when WebSocket events aren't received)
const JOB_POLL_INTERVAL = 2000; // 2 seconds

const ImageEditModal: React.FC<ImageEditModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  imagePrompt,
  sceneId,
  projectId,
  onEditComplete,
}) => {
  const [editMode, setEditMode] = useState<EditMode>('full');
  const [editPrompt, setEditPrompt] = useState('');
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(30);
  const [isErasing, setIsErasing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement & { clearMask?: () => void }>(null);

  // WebSocket handlers
  const handleProgress = useCallback((event: ProgressEvent) => {
    if (event.sentenceId === sceneId && event.jobType === 'image') {
      setProgress(event.progress);
      if (event.message) {
        setProgressMessage(event.message);
      }
    }
  }, [sceneId]);

  const handleJobComplete = useCallback((event: JobCompleteEvent) => {
    if (event.sentenceId === sceneId && event.jobType === 'image') {
      setProgress(100);
      setProgressMessage('Edit complete!');
      setIsComplete(true);
      setIsSubmitting(false);
      if (event.result?.file) {
        // Add cache-busting timestamp to force image reload
        const newUrl = `${API_BASE}${event.result.file}?t=${Date.now()}`;
        setResultImageUrl(newUrl);
      }
    }
  }, [sceneId]);

  const handleJobFailed = useCallback((event: JobFailedEvent) => {
    if (event.sentenceId === sceneId && event.jobType === 'image') {
      setError(event.error || 'Image edit failed');
      setIsSubmitting(false);
      setProgress(null);
    }
  }, [sceneId]);

  // Subscribe to WebSocket for progress updates
  useWebSocket(projectId, {
    onProgress: handleProgress,
    onJobComplete: handleJobComplete,
    onJobFailed: handleJobFailed,
    autoConnect: isOpen,
  });

  // Polling fallback: check job status periodically when WebSocket events aren't received
  useEffect(() => {
    if (!isSubmitting || !jobId || isComplete) return;

    const pollJobStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/v1/jobs/${jobId}`);
        if (!response.ok) return;

        const data = await response.json();
        const job = data.data;

        if (job.status === 'completed') {
          setProgress(100);
          setProgressMessage('Edit complete!');
          setIsComplete(true);
          setIsSubmitting(false);
          if (job.resultFile) {
            const newUrl = `${API_BASE}${job.resultFile}?t=${Date.now()}`;
            setResultImageUrl(newUrl);
          }
        } else if (job.status === 'failed') {
          setError(job.errorMessage || 'Image edit failed');
          setIsSubmitting(false);
          setProgress(null);
        } else if (job.status === 'running' && job.progress !== undefined) {
          setProgress(job.progress);
        }
      } catch (err) {
        console.error('Failed to poll job status:', err);
      }
    };

    // Poll immediately and then at intervals
    pollJobStatus();
    const intervalId = setInterval(pollJobStatus, JOB_POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isSubmitting, jobId, isComplete]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setEditPrompt('');
      setMaskDataUrl(null);
      setIsSubmitting(false);
      setProgress(null);
      setProgressMessage('');
      setError(null);
      setEditMode('full');
      setJobId(null);
      setIsComplete(false);
      setResultImageUrl(null);
    }
  }, [isOpen]);

  // Handle escape key - always allow closing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleClearMask = useCallback(() => {
    // Access the clearMask method attached to the canvas
    const canvas = document.querySelector('canvas[class*="cursor-crosshair"]') as HTMLCanvasElement & { clearMask?: () => void };
    if (canvas?.clearMask) {
      canvas.clearMask();
    }
    setMaskDataUrl(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!editPrompt.trim()) {
      setError('Please enter an edit prompt');
      return;
    }

    if (editMode === 'inpaint' && !maskDataUrl) {
      setError('Please draw on the image to select the area you want to edit');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setProgress(0);
    setProgressMessage('Starting image edit...');

    try {
      const response = await fetch(`${API_BASE}/api/v1/sentences/${sceneId}/edit-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          editPrompt: editPrompt.trim(),
          editMode,
          maskImage: editMode === 'inpaint' ? maskDataUrl : undefined,
        }),
      });

      // Handle non-OK responses with robust error parsing
      if (!response.ok) {
        let errorMessage = 'Failed to start image edit';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            errorMessage = data.error?.message || errorMessage;
          } else {
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
          }
        } catch {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setJobId(data.data?.jobId || null);
      setProgressMessage('Job queued, waiting for processing...');

      // Progress will now be updated via WebSocket
      // Modal stays open until job completes or user cancels
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsSubmitting(false);
      setProgress(null);
    }
  }, [editPrompt, editMode, maskDataUrl, sceneId]);

  const handleAcceptResult = useCallback(() => {
    if (resultImageUrl) {
      onEditComplete(resultImageUrl);
    }
    onClose();
  }, [resultImageUrl, onEditComplete, onClose]);

  const handleRejectResult = useCallback(() => {
    // Reset to allow another edit attempt
    setIsComplete(false);
    setResultImageUrl(null);
    setProgress(null);
    setProgressMessage('');
    setJobId(null);
  }, []);

  if (!isOpen) return null;

  const canSubmit = editPrompt.trim() && (editMode === 'full' || maskDataUrl);
  const showResultPreview = isComplete && resultImageUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop - always allow closing */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#0d0b1a] border border-white/10 rounded-xl w-full max-w-2xl mx-4 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/20">
              <Icons.Edit3 className="text-primary" size={18} />
            </div>
            <h3 className="text-lg font-bold text-white">
              {showResultPreview ? 'Edit Result' : 'Edit Image'}
            </h3>
          </div>
          <button
            onClick={onClose}
            title={isSubmitting && !isComplete ? 'Click to cancel and close' : 'Close'}
            className="p-2 text-text-muted hover:text-white transition-colors"
          >
            <Icons.X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {showResultPreview ? (
            // Show result preview with before/after comparison
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-text-muted mb-2 font-medium">Original</p>
                  <div className="relative w-full h-[200px] bg-black rounded-lg overflow-hidden flex items-center justify-center">
                    <img
                      src={imageUrl}
                      alt="Original"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-2 font-medium">Edited</p>
                  <div className="relative w-full h-[200px] bg-black rounded-lg overflow-hidden flex items-center justify-center">
                    <img
                      src={resultImageUrl}
                      alt="Edited"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/30 rounded-lg">
                <Icons.CheckCircle className="text-success" size={16} />
                <p className="text-sm text-success">Edit complete! Review the result and accept or try again.</p>
              </div>
            </div>
          ) : (
            // Show edit interface
            <>
              {/* Edit Mode Selector */}
              <EditModeSelector mode={editMode} onModeChange={setEditMode} />

              {/* Canvas / Image Preview */}
              {editMode === 'inpaint' ? (
                <>
                  <MaskCanvas
                    imageUrl={imageUrl}
                    brushSize={brushSize}
                    isErasing={isErasing}
                    onMaskChange={setMaskDataUrl}
                  />
                  <BrushControls
                    brushSize={brushSize}
                    onBrushSizeChange={setBrushSize}
                    isErasing={isErasing}
                    onErasingChange={setIsErasing}
                    onClearMask={handleClearMask}
                  />
                </>
              ) : (
                <div className="relative w-full h-[300px] bg-black rounded-lg overflow-hidden flex items-center justify-center">
                  <img
                    src={imageUrl}
                    alt="Scene to edit"
                    className="max-w-full max-h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                </div>
              )}

              {/* Prompt Input */}
              <PromptInput
                value={editPrompt}
                onChange={setEditPrompt}
                placeholder={
                  editMode === 'full'
                    ? 'Describe how you want to modify the entire image...'
                    : 'Describe what you want in the selected area...'
                }
              />

              {/* Current prompt reference */}
              {imagePrompt && (
                <div className="text-[10px] text-text-muted">
                  <span className="font-bold uppercase tracking-wider">Original prompt: </span>
                  <span className="italic">{imagePrompt.slice(0, 100)}{imagePrompt.length > 100 ? '...' : ''}</span>
                </div>
              )}
            </>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-error/10 border border-error/30 rounded-lg">
              <Icons.AlertCircle className="text-error" size={16} />
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {/* Progress */}
          {isSubmitting && progress !== null && !isComplete && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>{progressMessage || 'Generating edit...'}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10 bg-black/20">
          {showResultPreview ? (
            // Show accept/reject buttons for result
            <>
              <Button
                variant="outline"
                onClick={handleRejectResult}
              >
                <Icons.RotateCcw size={16} />
                Try Again
              </Button>
              <Button
                onClick={handleAcceptResult}
              >
                <Icons.Check size={16} />
                Accept
              </Button>
            </>
          ) : (
            // Show cancel/apply buttons for edit
            <>
              <Button
                variant="outline"
                onClick={onClose}
              >
                {isSubmitting ? 'Cancel' : 'Close'}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Icons.RefreshCw size={16} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Icons.Wand2 size={16} />
                    Apply Edit
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageEditModal;
