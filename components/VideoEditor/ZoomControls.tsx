import React from 'react';
import * as Icons from '../Icons';
import { ZoomControlsProps } from './types';

const ZOOM_PRESETS = [
  { label: '25%', value: 25 },
  { label: '50%', value: 50 },
  { label: '100%', value: 100 },
  { label: '200%', value: 200 },
  { label: '400%', value: 400 },
];

const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoomLevel,
  onZoomChange
}) => {
  const handleZoomIn = () => {
    const nextPreset = ZOOM_PRESETS.find(p => p.value > zoomLevel);
    if (nextPreset) {
      onZoomChange(nextPreset.value);
    }
  };

  const handleZoomOut = () => {
    const prevPresets = ZOOM_PRESETS.filter(p => p.value < zoomLevel);
    const prevPreset = prevPresets[prevPresets.length - 1];
    if (prevPreset) {
      onZoomChange(prevPreset.value);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onZoomChange(Number(e.target.value));
  };

  const currentPreset = ZOOM_PRESETS.find(p => p.value === zoomLevel);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
      <button
        onClick={handleZoomOut}
        disabled={zoomLevel <= 25}
        className="p-1 hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Zoom Out (Cmd+-)"
      >
        <Icons.Minus size={14} className="text-text-muted" />
      </button>

      <input
        type="range"
        min={25}
        max={400}
        step={25}
        value={zoomLevel}
        onChange={handleSliderChange}
        className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
      />

      <button
        onClick={handleZoomIn}
        disabled={zoomLevel >= 400}
        className="p-1 hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Zoom In (Cmd++)"
      >
        <Icons.Plus size={14} className="text-text-muted" />
      </button>

      <span className="text-[10px] text-text-muted font-mono min-w-[32px] text-center">
        {currentPreset?.label || `${zoomLevel}%`}
      </span>
    </div>
  );
};

export default ZoomControls;
