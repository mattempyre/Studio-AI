import React from 'react';
import * as Icons from '../Icons';
import { GenerationModel } from '../../types';

interface ModelCardProps {
  model: GenerationModel;
  onSelect: () => void;
  onDelete: () => void;
}

const ModelCard: React.FC<ModelCardProps> = ({ model, onSelect, onDelete }) => {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  const isVideoModel = model.workflowCategory === 'video';

  // Determine workflow type label
  const getTypeLabel = () => {
    switch (model.workflowType) {
      case 'text-to-image': return 'T2I';
      case 'image-to-image': return 'I2I';
      case 'image-to-video': return 'I2V';
      default: return model.workflowType;
    }
  };

  return (
    <div
      onClick={onSelect}
      className="group relative bg-white/5 rounded-xl border border-white/5 hover:border-accent-blue/50 transition-all cursor-pointer overflow-hidden"
    >
      {/* Header with icon */}
      <div className={`h-24 flex items-center justify-center ${
        isVideoModel
          ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20'
          : 'bg-gradient-to-br from-accent-blue/20 to-purple-500/20'
      }`}>
        {isVideoModel ? (
          <Icons.Film className="text-white/40" size={40} />
        ) : (
          <Icons.ImageIcon className="text-white/40" size={40} />
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-white truncate flex-1">{model.name}</h3>
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
            title="Delete model"
          >
            <Icons.Trash2 size={14} />
          </button>
        </div>

        {model.description && (
          <p className="text-text-muted text-sm line-clamp-2 mb-3">{model.description}</p>
        )}

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
            isVideoModel
              ? 'bg-purple-500/10 text-purple-400'
              : 'bg-accent-blue/10 text-accent-blue'
          }`}>
            {getTypeLabel()}
          </span>
          {model.defaultSteps && (
            <span className="px-2 py-1 text-xs rounded-full bg-white/5 text-text-muted">
              {model.defaultSteps} steps
            </span>
          )}
          {model.defaultCfg && (
            <span className="px-2 py-1 text-xs rounded-full bg-white/5 text-text-muted">
              cfg {model.defaultCfg}
            </span>
          )}
          {/* Video-specific badges */}
          {isVideoModel && model.defaultFrames && (
            <span className="px-2 py-1 text-xs rounded-full bg-white/5 text-text-muted">
              {model.defaultFrames} frames
            </span>
          )}
          {isVideoModel && model.defaultFps && (
            <span className="px-2 py-1 text-xs rounded-full bg-white/5 text-text-muted">
              {model.defaultFps} fps
            </span>
          )}
          {model.workflowFile ? (
            <span className="px-2 py-1 text-xs rounded-full bg-green-500/10 text-green-400">
              <Icons.Check size={10} className="inline mr-1" />
              Workflow
            </span>
          ) : (
            <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/10 text-yellow-400">
              No workflow
            </span>
          )}
        </div>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-accent-blue/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
};

export default ModelCard;
