import React, { useRef, useCallback } from 'react';
import * as Icons from '../Icons';
import { TimelineProps } from './types';
import TimelineClip from './TimelineClip';
import TimeRuler from './TimeRuler';
import { AudioTrack } from '../../types';

const Timeline: React.FC<TimelineProps> = ({
  scenes,
  audioTracks,
  currentTime,
  duration,
  pixelsPerSecond,
  selectedClipId,
  isDragging,
  dropTargetIndex,
  onSelectClip,
  onTrimStart,
  onTrimEnd,
  onSlipOffsetChange,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  registerVideoRef,
  registerAudioRef
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const totalWidth = duration * pixelsPerSecond;
  const playheadLeft = currentTime * pixelsPerSecond;

  const TRACK_LABEL_WIDTH = 96; // 6rem = 96px

  // Handle mouse wheel for horizontal scrolling (shift+wheel or trackpad)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollContainerRef.current) {
      // Shift+wheel for horizontal scroll, or use deltaX for trackpad
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        scrollContainerRef.current.scrollLeft += e.shiftKey ? e.deltaY : e.deltaX;
      }
    }
  }, []);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Fixed track labels column */}
      <div className="shrink-0 flex flex-col bg-[#131022] z-10" style={{ width: TRACK_LABEL_WIDTH }}>
        {/* Ruler spacer */}
        <div className="h-6 shrink-0 border-b border-white/5" />
        {/* Video track label */}
        <div className="h-12 flex items-center px-3 border-b border-white/5">
          <span className="text-[10px] font-bold text-text-muted flex items-center gap-2">
            <Icons.Video size={12} /> VIDEO
          </span>
        </div>
        {/* Audio track labels */}
        {audioTracks.map((track) => (
          <div key={track.id} className="h-10 flex items-center px-3 border-b border-white/5">
            <span className="text-[10px] font-bold text-text-muted flex items-center gap-2 truncate">
              {track.type === 'voice' && <Icons.Mic size={12} className="text-purple-400" />}
              {track.type === 'music' && <Icons.Music size={12} className="text-blue-400" />}
              {track.type === 'sfx' && <Icons.Volume2 size={12} className="text-orange-400" />}
              <span className="truncate">{track.name}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Scrollable timeline area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative"
        onWheel={handleWheel}
      >
        {/* Playhead line - follows scroll */}
        <div
          className="absolute top-0 bottom-0 w-px bg-primary z-20 pointer-events-none"
          style={{ left: playheadLeft }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 text-primary">
            <Icons.ChevronDown size={10} fill="currentColor" />
          </div>
        </div>

        {/* Timeline content with minimum width based on duration and zoom */}
        <div style={{ minWidth: totalWidth + 100 }}>
          {/* Time ruler */}
          <div className="h-6 shrink-0 border-b border-white/5">
            <TimeRuler
              duration={duration}
              pixelsPerSecond={pixelsPerSecond}
              scrollOffset={0}
            />
          </div>

          {/* Video Track */}
          <div
            className="h-12 relative bg-white/5 border-b border-white/5"
            style={{ width: totalWidth }}
            onDragOver={(e) => {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left + (scrollContainerRef.current?.scrollLeft || 0);
              let dropIndex = 0;
              let accumulatedWidth = 0;

              for (let i = 0; i < scenes.length; i++) {
                const scene = scenes[i];
                const sceneWidth = (scene.effectiveDuration ?? scene.videoDuration ?? 5) * pixelsPerSecond;
                if (x > accumulatedWidth + sceneWidth / 2) {
                  dropIndex = i + 1;
                }
                accumulatedWidth += sceneWidth;
              }

              onDragOver(e, dropIndex);
            }}
            onDragLeave={onDragEnd}
            onDrop={(e) => {
              if (dropTargetIndex !== null) {
                onDrop(e, dropTargetIndex);
              }
            }}
          >
            {/* Render video clips */}
            {scenes.map((scene) => (
              <TimelineClip
                key={scene.id}
                scene={scene}
                pixelsPerSecond={pixelsPerSecond}
                isSelected={selectedClipId === scene.id}
                isDragging={isDragging && selectedClipId === scene.id}
                onSelect={onSelectClip}
                onTrimStart={onTrimStart}
                onTrimEnd={onTrimEnd}
                onSlipOffsetChange={onSlipOffsetChange}
                onDragStart={onDragStart}
                registerVideoRef={registerVideoRef}
              />
            ))}

            {/* Drop indicator */}
            {isDragging && dropTargetIndex !== null && (
              <DropIndicator
                index={dropTargetIndex}
                scenes={scenes}
                pixelsPerSecond={pixelsPerSecond}
              />
            )}
          </div>

          {/* Audio Tracks */}
          {audioTracks.map((track) => (
            <AudioTrackRow
              key={track.id}
              track={track}
              duration={duration}
              pixelsPerSecond={pixelsPerSecond}
              totalWidth={totalWidth}
              registerAudioRef={registerAudioRef}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Drop indicator component
const DropIndicator: React.FC<{
  index: number;
  scenes: TimelineProps['scenes'];
  pixelsPerSecond: number;
}> = ({ index, scenes, pixelsPerSecond }) => {
  let position = 0;

  for (let i = 0; i < index && i < scenes.length; i++) {
    const scene = scenes[i];
    position += (scene.effectiveDuration ?? scene.videoDuration ?? 5) * pixelsPerSecond;
  }

  return (
    <div
      className="absolute top-0 bottom-0 w-1 bg-primary rounded z-30 animate-pulse"
      style={{ left: position - 2 }}
    />
  );
};

// Audio track row component
const AudioTrackRow: React.FC<{
  track: AudioTrack;
  duration: number;
  pixelsPerSecond: number;
  totalWidth: number;
  registerAudioRef?: (clipId: string, element: HTMLAudioElement | null) => void;
}> = ({ track, duration, pixelsPerSecond, totalWidth, registerAudioRef }) => {
  const getClipColorClass = () => {
    switch (track.type) {
      case 'voice':
        return 'bg-purple-500/40 border-purple-500 text-purple-200';
      case 'music':
        return 'bg-blue-500/40 border-blue-500 text-blue-200';
      case 'sfx':
        return 'bg-orange-500/40 border-orange-500 text-orange-200';
    }
  };

  return (
    <div
      className="h-10 bg-[#1e1933] relative border-b border-white/5"
      style={{ width: totalWidth }}
    >
      {track.clips.map((clip) => {
        const left = clip.startTime * pixelsPerSecond;
        const width = clip.duration * pixelsPerSecond;

        return (
          <div
            key={clip.id}
            className={`absolute top-1 bottom-1 border rounded px-1 flex items-center overflow-hidden cursor-pointer hover:brightness-125 transition-all ${getClipColorClass()}`}
            style={{ left, width }}
            title={`${clip.name} (${clip.duration}s)`}
          >
            <span className="text-[9px] font-bold truncate">{clip.name}</span>
            {/* Hidden audio element for playback sync */}
            {clip.audioUrl && registerAudioRef && (
              <audio
                ref={(el) => registerAudioRef(clip.id, el)}
                src={clip.audioUrl}
                preload="auto"
                className="hidden"
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Timeline;
