import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TimelineClipProps } from './types';

// Handle duration in seconds (videos are generated with extra handles for slip editing)
const HANDLE_SECONDS = 0.5;
const MAX_SLIP_RANGE = HANDLE_SECONDS * 2; // 1.0 second total slip range

const TimelineClip: React.FC<TimelineClipProps> = ({
  scene,
  pixelsPerSecond,
  isSelected,
  isDragging,
  onSelect,
  onTrimStart,
  onTrimEnd,
  onSlipOffsetChange,
  onDragStart,
  registerVideoRef
}) => {
  const [isTrimming, setIsTrimming] = useState<'start' | 'end' | null>(null);
  const [isSlipping, setIsSlipping] = useState(false);
  const [isAltHeld, setIsAltHeld] = useState(false);
  const clipRef = useRef<HTMLDivElement>(null);

  const timelineStart = scene.timelineStart ?? 0;
  const videoDuration = scene.videoDuration ?? 5;
  const trimStart = scene.trimStart ?? 0;
  const trimEnd = scene.trimEnd ?? 0;
  const effectiveDuration = scene.effectiveDuration ?? (videoDuration - trimStart - trimEnd);
  const currentSlipOffset = scene.slipOffset ?? 0;

  const leftPosition = timelineStart * pixelsPerSecond;
  const clipWidth = effectiveDuration * pixelsPerSecond;
  const minClipWidth = 20; // Minimum width in pixels

  // Calculate trimmed portions width for visual feedback
  const trimStartWidth = trimStart * pixelsPerSecond;
  const trimEndWidth = trimEnd * pixelsPerSecond;

  // Determine if slip editing is available for this clip
  // Videos with handles have duration > effective duration + handle buffer
  const hasSlipHandles = videoDuration >= effectiveDuration + MAX_SLIP_RANGE;
  const canSlip = hasSlipHandles && onSlipOffsetChange !== undefined;

  // Track Alt key globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsAltHeld(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsAltHeld(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleTrimMouseDown = useCallback((
    e: React.MouseEvent,
    edge: 'start' | 'end'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setIsTrimming(edge);

    const startX = e.clientX;
    const originalTrimStart = trimStart;
    const originalTrimEnd = trimEnd;

    const handleMouseMove = (ev: MouseEvent) => {
      const deltaX = ev.clientX - startX;
      const deltaSeconds = deltaX / pixelsPerSecond;

      if (edge === 'start') {
        // Trimming from start - moving right increases trim, left decreases
        const newTrimStart = Math.max(0, Math.min(
          videoDuration - trimEnd - 0.5, // Leave at least 0.5s
          originalTrimStart + deltaSeconds
        ));
        onTrimStart(scene.id, newTrimStart);
      } else {
        // Trimming from end - moving left increases trim, right decreases
        const newTrimEnd = Math.max(0, Math.min(
          videoDuration - trimStart - 0.5, // Leave at least 0.5s
          originalTrimEnd - deltaSeconds
        ));
        onTrimEnd(scene.id, newTrimEnd);
      }
    };

    const handleMouseUp = () => {
      setIsTrimming(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };

    document.body.style.cursor = 'ew-resize';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [scene.id, trimStart, trimEnd, videoDuration, pixelsPerSecond, onTrimStart, onTrimEnd]);

  const handleSlipMouseDown = useCallback((e: React.MouseEvent) => {
    if (!canSlip || !onSlipOffsetChange) return;

    e.stopPropagation();
    e.preventDefault();
    setIsSlipping(true);

    const startX = e.clientX;
    const originalSlipOffset = currentSlipOffset;

    const handleMouseMove = (ev: MouseEvent) => {
      const deltaX = ev.clientX - startX;
      const deltaSeconds = deltaX / pixelsPerSecond;

      // Clamp slip offset to valid range (0 to MAX_SLIP_RANGE)
      const newSlipOffset = Math.max(0, Math.min(
        MAX_SLIP_RANGE,
        originalSlipOffset + deltaSeconds
      ));

      onSlipOffsetChange(scene.id, newSlipOffset);
    };

    const handleMouseUp = () => {
      setIsSlipping(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };

    document.body.style.cursor = 'move';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [canSlip, currentSlipOffset, pixelsPerSecond, scene.id, onSlipOffsetChange]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(scene.id);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // If Alt is held and we're clicking on the clip body (not trim handles), enter slip mode
    if (e.altKey && canSlip) {
      handleSlipMouseDown(e);
    }
  };

  const handleDragStartInternal = (e: React.DragEvent) => {
    if (isTrimming || isSlipping) {
      e.preventDefault();
      return;
    }
    // Don't start drag if Alt is held (slip mode)
    if (e.altKey && canSlip) {
      e.preventDefault();
      return;
    }
    onDragStart(e, scene.id);
  };

  // Calculate slip indicator position as percentage
  const slipIndicatorPosition = canSlip
    ? (currentSlipOffset / MAX_SLIP_RANGE) * 100
    : 0;

  return (
    <div
      ref={clipRef}
      className={`absolute top-1 bottom-1 group ${
        isSlipping
          ? 'cursor-move'
          : isAltHeld && canSlip
            ? 'cursor-move'
            : 'cursor-grab active:cursor-grabbing'
      } ${isDragging ? 'opacity-50' : ''} ${
        isSelected ? 'ring-2 ring-primary ring-offset-1 ring-offset-transparent' : ''
      }`}
      style={{
        left: leftPosition,
        width: Math.max(minClipWidth, clipWidth),
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      draggable={!isTrimming && !isSlipping && !(isAltHeld && canSlip)}
      onDragStart={handleDragStartInternal}
    >
      {/* Trimmed start indicator (grayed out) */}
      {trimStart > 0 && (
        <div
          className="absolute right-full top-0 bottom-0 bg-black/60 border-r border-red-500/50"
          style={{ width: trimStartWidth }}
        >
          <div className="absolute inset-0 bg-stripes opacity-30" />
        </div>
      )}

      {/* Main clip content */}
      <div className="absolute inset-0 bg-primary/30 border border-primary/50 rounded overflow-hidden">
        {/* Video thumbnail or preview */}
        {scene.videoUrl ? (
          <video
            ref={(el) => registerVideoRef(scene.id, el)}
            src={scene.videoUrl}
            className="w-full h-full object-cover opacity-70"
            muted
            preload="metadata"
          />
        ) : scene.imageUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-50"
            style={{ backgroundImage: `url(${scene.imageUrl})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
            <span className="text-[8px] text-white/50">No media</span>
          </div>
        )}

        {/* Clip label */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
          <span className="text-[9px] text-white font-medium truncate block">
            {scene.narration.substring(0, 20)}...
          </span>
        </div>

        {/* Duration badge */}
        <div className="absolute top-1 right-1 bg-black/60 px-1 py-0.5 rounded text-[8px] text-white/70 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
          {effectiveDuration.toFixed(1)}s
        </div>

        {/* Slip indicator - shows when Alt is held or when slipping */}
        {(isAltHeld || isSlipping) && (
          <div className="absolute inset-x-0 bottom-6 mx-2">
            {canSlip ? (
              <div className="relative">
                {/* Slip range background */}
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  {/* Slip position indicator */}
                  <div
                    className={`absolute top-0 bottom-0 w-2 rounded-full transition-all ${
                      isSlipping ? 'bg-yellow-400 shadow-lg shadow-yellow-400/50' : 'bg-yellow-500/80'
                    }`}
                    style={{
                      left: `calc(${slipIndicatorPosition}% - 4px)`,
                    }}
                  />
                  {/* Filled portion */}
                  <div
                    className="h-full bg-yellow-500/40"
                    style={{ width: `${slipIndicatorPosition}%` }}
                  />
                </div>
                {/* Slip value label */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] text-yellow-400 font-mono whitespace-nowrap">
                  Slip: {currentSlipOffset.toFixed(2)}s
                </div>
              </div>
            ) : (
              /* No slip available indicator for legacy videos */
              <div className="flex items-center justify-center">
                <span className="text-[8px] text-red-400/80 bg-black/60 px-1.5 py-0.5 rounded">
                  No slip handles
                </span>
              </div>
            )}
          </div>
        )}

        {/* Slip mode border indicator */}
        {(isSlipping || (isAltHeld && canSlip)) && (
          <div className={`absolute inset-0 rounded border-2 pointer-events-none ${
            isSlipping ? 'border-yellow-400' : 'border-yellow-500/50'
          }`} />
        )}
      </div>

      {/* Trim handle - Start */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 group/handle ${
          isTrimming === 'start' ? 'bg-primary' : 'hover:bg-primary/80'
        }`}
        onMouseDown={(e) => handleTrimMouseDown(e, 'start')}
      >
        <div className="absolute inset-y-1 left-0.5 w-0.5 bg-white/50 rounded opacity-0 group-hover/handle:opacity-100 transition-opacity" />
      </div>

      {/* Trim handle - End */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 group/handle ${
          isTrimming === 'end' ? 'bg-primary' : 'hover:bg-primary/80'
        }`}
        onMouseDown={(e) => handleTrimMouseDown(e, 'end')}
      >
        <div className="absolute inset-y-1 right-0.5 w-0.5 bg-white/50 rounded opacity-0 group-hover/handle:opacity-100 transition-opacity" />
      </div>

      {/* Trimmed end indicator (grayed out) */}
      {trimEnd > 0 && (
        <div
          className="absolute left-full top-0 bottom-0 bg-black/60 border-l border-red-500/50"
          style={{ width: trimEndWidth }}
        >
          <div className="absolute inset-0 bg-stripes opacity-30" />
        </div>
      )}
    </div>
  );
};

export default TimelineClip;
