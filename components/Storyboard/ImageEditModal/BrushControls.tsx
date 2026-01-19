import React from 'react';
import * as Icons from '../../Icons';
import type { BrushControlsProps } from './types';

const BrushControls: React.FC<BrushControlsProps> = ({
  brushSize,
  onBrushSizeChange,
  isErasing,
  onErasingChange,
  onClearMask,
}) => {
  return (
    <div className="flex items-center gap-4 p-3 bg-[#1e1933] rounded-lg border border-white/10">
      {/* Brush Size */}
      <div className="flex items-center gap-3 flex-1">
        <div className="flex items-center gap-2">
          <Icons.Circle size={12} className="text-text-muted" />
          <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
            Brush
          </span>
        </div>
        <input
          type="range"
          min={5}
          max={100}
          value={brushSize}
          onChange={(e) => onBrushSizeChange(Number(e.target.value))}
          className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none accent-primary cursor-pointer"
        />
        <span className="text-xs text-text-muted w-8 text-right">{brushSize}px</span>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-white/10" />

      {/* Erase Toggle */}
      <button
        onClick={() => onErasingChange(!isErasing)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all ${
          isErasing
            ? 'bg-error/20 text-error border border-error/30'
            : 'bg-surface-2 text-text-muted hover:text-white border border-white/10'
        }`}
        title={isErasing ? 'Erasing mode' : 'Drawing mode'}
      >
        <Icons.Eraser size={14} />
        <span className="text-xs font-medium">Erase</span>
      </button>

      {/* Clear Button */}
      <button
        onClick={onClearMask}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface-2 text-text-muted hover:text-white border border-white/10 transition-all"
        title="Clear mask"
      >
        <Icons.Trash2 size={14} />
        <span className="text-xs font-medium">Clear</span>
      </button>
    </div>
  );
};

export default BrushControls;
