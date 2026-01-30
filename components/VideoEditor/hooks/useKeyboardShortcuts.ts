import { useEffect, useCallback } from 'react';

interface UseKeyboardShortcutsOptions {
  onTogglePlayback: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onJumpToNextClip?: () => void;
  onJumpToPrevClip?: () => void;
  onShuttle: (direction: 'forward' | 'backward' | 'stop') => void;
  onSetInPoint?: () => void;
  onSetOutPoint?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onDelete?: () => void;
  isEnabled?: boolean;
}

export function useKeyboardShortcuts({
  onTogglePlayback,
  onStepForward,
  onStepBackward,
  onJumpToNextClip,
  onJumpToPrevClip,
  onShuttle,
  onSetInPoint,
  onSetOutPoint,
  onZoomIn,
  onZoomOut,
  onDelete,
  isEnabled = true
}: UseKeyboardShortcutsOptions): void {

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isEnabled) return;

    // Ignore if user is typing in an input field
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    switch (e.code) {
      // Space - Play/Pause
      case 'Space':
        e.preventDefault();
        onTogglePlayback();
        break;

      // J - Shuttle backward
      case 'KeyJ':
        e.preventDefault();
        onShuttle('backward');
        break;

      // K - Stop/Pause
      case 'KeyK':
        e.preventDefault();
        onShuttle('stop');
        break;

      // L - Shuttle forward
      case 'KeyL':
        e.preventDefault();
        onShuttle('forward');
        break;

      // Left Arrow - Step backward (Shift = jump to previous clip)
      case 'ArrowLeft':
        e.preventDefault();
        if (e.shiftKey && onJumpToPrevClip) {
          onJumpToPrevClip();
        } else {
          onStepBackward();
        }
        break;

      // Right Arrow - Step forward (Shift = jump to next clip)
      case 'ArrowRight':
        e.preventDefault();
        if (e.shiftKey && onJumpToNextClip) {
          onJumpToNextClip();
        } else {
          onStepForward();
        }
        break;

      // [ - Set in point (trim start)
      case 'BracketLeft':
        e.preventDefault();
        onSetInPoint?.();
        break;

      // ] - Set out point (trim end)
      case 'BracketRight':
        e.preventDefault();
        onSetOutPoint?.();
        break;

      // + / = - Zoom in
      case 'Equal':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          onZoomIn?.();
        }
        break;

      // - - Zoom out
      case 'Minus':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          onZoomOut?.();
        }
        break;

      // Delete/Backspace - Delete selected clip
      case 'Delete':
      case 'Backspace':
        if (!target.closest('input, textarea, [contenteditable]')) {
          e.preventDefault();
          onDelete?.();
        }
        break;

      default:
        break;
    }
  }, [
    isEnabled,
    onTogglePlayback,
    onStepForward,
    onStepBackward,
    onJumpToNextClip,
    onJumpToPrevClip,
    onShuttle,
    onSetInPoint,
    onSetOutPoint,
    onZoomIn,
    onZoomOut,
    onDelete
  ]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
