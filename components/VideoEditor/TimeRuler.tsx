import React from 'react';
import { TimeRulerProps } from './types';

const formatTime = (time: number): string => {
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const TimeRuler: React.FC<TimeRulerProps> = ({
  duration,
  pixelsPerSecond,
  scrollOffset
}) => {
  // Calculate tick interval based on zoom level
  const getTickInterval = (): number => {
    if (pixelsPerSecond >= 200) return 1; // Every second
    if (pixelsPerSecond >= 100) return 2; // Every 2 seconds
    if (pixelsPerSecond >= 50) return 5; // Every 5 seconds
    if (pixelsPerSecond >= 25) return 10; // Every 10 seconds
    return 15; // Every 15 seconds
  };

  const tickInterval = getTickInterval();
  const totalWidth = duration * pixelsPerSecond;
  const ticks: number[] = [];

  for (let t = 0; t <= duration; t += tickInterval) {
    ticks.push(t);
  }

  return (
    <div
      className="h-6 bg-black/30 border-b border-white/10 relative overflow-hidden"
      style={{ width: totalWidth }}
    >
      {ticks.map(tick => (
        <div
          key={tick}
          className="absolute top-0 h-full flex flex-col justify-end"
          style={{ left: tick * pixelsPerSecond }}
        >
          <div className="w-px h-2 bg-white/30" />
          <span className="text-[9px] text-text-muted ml-1 whitespace-nowrap select-none">
            {formatTime(tick)}
          </span>
        </div>
      ))}

      {/* Minor ticks (only at higher zoom levels) */}
      {pixelsPerSecond >= 50 && Array.from({ length: Math.floor(duration) }).map((_, i) => {
        if (i % tickInterval !== 0) {
          return (
            <div
              key={`minor-${i}`}
              className="absolute top-0 h-full"
              style={{ left: i * pixelsPerSecond }}
            >
              <div className="w-px h-1 bg-white/15" />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
};

export default TimeRuler;
