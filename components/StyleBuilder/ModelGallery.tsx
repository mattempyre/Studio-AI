import React from 'react';
import * as Icons from '../Icons';
import { GenerationModel } from '../../types';
import ModelCard from './ModelCard';

interface ModelGalleryProps {
  models: GenerationModel[];
  onSelect: (model: GenerationModel) => void;
  onDelete: (model: GenerationModel) => void;
  onCreate: () => void;
}

const ModelGallery: React.FC<ModelGalleryProps> = ({
  models,
  onSelect,
  onDelete,
  onCreate,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {models.map((model) => (
        <ModelCard
          key={model.id}
          model={model}
          onSelect={() => onSelect(model)}
          onDelete={() => onDelete(model)}
        />
      ))}

      {/* Add New Card */}
      <button
        onClick={onCreate}
        className="group h-48 rounded-xl border-2 border-dashed border-white/10 hover:border-accent-blue/50 transition-all flex flex-col items-center justify-center gap-3 bg-white/[0.02] hover:bg-accent-blue/5"
      >
        <div className="size-12 rounded-full bg-white/5 group-hover:bg-accent-blue/10 flex items-center justify-center transition-colors">
          <Icons.Plus className="text-text-muted group-hover:text-accent-blue transition-colors" size={24} />
        </div>
        <span className="text-text-muted group-hover:text-white text-sm font-medium transition-colors">
          Add New Model
        </span>
      </button>
    </div>
  );
};

export default ModelGallery;
