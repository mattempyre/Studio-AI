import React, { useState, useRef, useCallback } from 'react';
import { TimelineClipProps } from './types';

const TimelineClip: React.FC<TimelineClipProps> = ({
  scene,
  pixelsPerSecond,
  isSelected,
  isDragging,
  onSelect,
  onTrimStart,
  onTrimEnd,
  onDragStart,
  registerVideoRef
}) => {
  const [isTrimming, setIsTrimming] = useState<'start' | 'end' | null>(null);
  const clipRef = useRef<HTMLDivElement>(null);

  const timelineStart = scene.timelineStart ?? 0;
  const videoDuration = scene.videoDuration ?? 5;
  const trimStart = scene.trimStart ?? 0;
  const trimEnd = scene.trimEnd ?? 0;
  const effectiveDuration = scene.effectiveDuration ?? (videoDuration - trimStart - trimEnd);

  const leftPosition = timelineStart * pixelsPerSecond;
  const clipWidth = effectiveDuration * pixelsPerSecond;
  const minClipWidth = 20; // Minimum width in pixels

  // Calculate trimmed portions width for visual feedback
  const trimStartWidth = trimStart * pixelsPerSecond;
  const trimEndWidth = trimEnd * pixelsPerSecond;

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

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(scene.id);
  };

  const handleDragStartInternal = (e: React.DragEvent) => {
    if (isTrimming) {
      e.preventDefault();
      return;
    }
    onDragStart(e, scene.id);
  };

  return (
    <div
      ref={clipRef}
      className={`absolute top-1 bottom-1 group cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50' : ''
      } ${isSelected ? 'ring-2 ring-primary ring-offset-1 ring-offset-transparent' : ''}`}
      style={{
        left: leftPosition,
        width: Math.max(minClipWidth, clipWidth),
      }}
      onClick={handleClick}
      draggable={!isTrimming}
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
