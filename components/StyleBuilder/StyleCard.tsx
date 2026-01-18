import React from 'react';
import * as Icons from '../Icons';
import { VisualStyle, GenerationModel } from '../../types';

interface StyleCardProps {
  style: VisualStyle;
  models: GenerationModel[];
  onSelect: () => void;
  onDelete: () => void;
}

const StyleCard: React.FC<StyleCardProps> = ({ style, models, onSelect, onDelete }) => {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  const getCompatibleModelNames = () => {
    if (!style.compatibleModels || style.compatibleModels.length === 0) {
      return 'All models';
    }
    return style.compatibleModels
      .map((id) => models.find((m) => m.id === id)?.name || id)
      .join(', ');
  };

  return (
    <div
      onClick={onSelect}
      className="group relative bg-white/5 rounded-xl border border-white/5 hover:border-accent-blue/50 transition-all cursor-pointer overflow-hidden"
    >
      {/* Header with icon */}
      <div
        className={`h-24 flex items-center justify-center ${
          style.styleType === 'prompt'
            ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20'
            : 'bg-gradient-to-br from-purple-500/20 to-pink-500/20'
        }`}
      >
        {style.styleType === 'prompt' ? (
          <Icons.Type className="text-white/40" size={40} />
        ) : (
          <Icons.Layers className="text-white/40" size={40} />
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-white truncate flex-1">{style.name}</h3>
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
            title="Delete style"
          >
            <Icons.Trash2 size={14} />
          </button>
        </div>

        {style.description && (
          <p className="text-text-muted text-sm line-clamp-2 mb-3">{style.description}</p>
        )}

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span
            className={`px-2 py-1 text-xs rounded-full font-medium ${
              style.styleType === 'prompt'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-purple-500/10 text-purple-400'
            }`}
          >
            {style.styleType === 'prompt' ? 'PROMPT' : 'LORA'}
          </span>
          {style.requiresCharacterRef && (
            <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/10 text-yellow-400">
              <Icons.User size={10} className="inline mr-1" />
              Needs Ref
            </span>
          )}
        </div>

        {/* Compatible models */}
        <div className="text-xs text-text-muted truncate" title={getCompatibleModelNames()}>
          <Icons.Cpu size={10} className="inline mr-1" />
          {getCompatibleModelNames()}
        </div>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-accent-blue/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
};

export default StyleCard;
