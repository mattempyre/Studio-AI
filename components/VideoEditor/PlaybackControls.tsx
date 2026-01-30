import React, { useRef } from 'react';
import * as Icons from '../Icons';
import { PlaybackControlsProps } from './types';

const formatTime = (time: number): string => {
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  onTogglePlayback,
  onSeek
}) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const progressPercent = Math.min(100, Math.max(0, (currentTime / duration) * 100));

  const handleScrub = (clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    onSeek(percentage * duration);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    handleScrub(e.clientX);

    const handleMouseMove = (ev: MouseEvent) => handleScrub(ev.clientX);
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="h-10 border-b border-white/5 flex items-center px-4 justify-between bg-black/20 shrink-0">
      <div className="flex items-center gap-4 text-xs font-bold text-text-muted w-full select-none">
        <button
          className="hover:text-white shrink-0 outline-none"
          onClick={onTogglePlayback}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? (
            <div className="flex gap-0.5">
              <div className="w-1 h-3 bg-current rounded-sm" />
              <div className="w-1 h-3 bg-current rounded-sm" />
            </div>
          ) : (
            <Icons.PlayCircle size={16} />
          )}
        </button>

        <span className="font-mono text-[10px] w-10 text-right">
          {formatTime(currentTime)}
        </span>

        {/* Interactive Slider */}
        <div
          ref={sliderRef}
          onMouseDown={handleMouseDown}
          className="flex-1 h-8 flex items-center cursor-pointer group relative"
        >
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-75"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div
            className="absolute h-3 w-3 bg-white rounded-full shadow-lg border border-black/10 transform -translate-x-1/2 group-hover:scale-125 transition-transform z-20"
            style={{ left: `${progressPercent}%` }}
          />
        </div>

        <span className="font-mono text-[10px] w-10">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
};

export default PlaybackControls;
