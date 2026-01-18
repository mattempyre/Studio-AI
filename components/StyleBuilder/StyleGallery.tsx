import React, { useState, useMemo } from 'react';
import * as Icons from '../Icons';
import { VisualStyle, GenerationModel } from '../../types';
import StyleCard from './StyleCard';

interface StyleGalleryProps {
  styles: VisualStyle[];
  models: GenerationModel[];
  onSelect: (style: VisualStyle) => void;
  onDelete: (style: VisualStyle) => void;
  onCreate: () => void;
}

const StyleGallery: React.FC<StyleGalleryProps> = ({
  styles,
  models,
  onSelect,
  onDelete,
  onCreate,
}) => {
  const [filterModel, setFilterModel] = useState<string>('');

  const filteredStyles = useMemo(() => {
    if (!filterModel) return styles;
    return styles.filter((style) => {
      // If style has no compatible models, it works with all
      if (!style.compatibleModels || style.compatibleModels.length === 0) return true;
      return style.compatibleModels.includes(filterModel);
    });
  }, [styles, filterModel]);

  return (
    <div>
      {/* Filter */}
      <div className="mb-6 flex items-center gap-4">
        <label className="text-sm text-text-muted">Filter by model:</label>
        <select
          value={filterModel}
          onChange={(e) => setFilterModel(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-accent-blue focus:outline-none"
        >
          <option value="">All Models</option>
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
        {filterModel && (
          <span className="text-sm text-text-muted">
            {filteredStyles.length} style{filteredStyles.length !== 1 ? 's' : ''} compatible
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredStyles.map((style) => (
          <StyleCard
            key={style.id}
            style={style}
            models={models}
            onSelect={() => onSelect(style)}
            onDelete={() => onDelete(style)}
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
            Add New Style
          </span>
        </button>
      </div>
    </div>
  );
};

export default StyleGallery;
