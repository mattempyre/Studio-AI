import React from 'react';
import * as Icons from '../Icons';
import { BackendCharacter } from '../../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface CharacterCardProps {
  character: BackendCharacter;
  onSelect: (character: BackendCharacter) => void;
  onDelete: (character: BackendCharacter) => void;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({ character, onSelect, onDelete }) => {
  const thumbnail = character.referenceImages.length > 0
    ? `${API_BASE}${character.referenceImages[0]}`
    : null;

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(character);
  };

  return (
    <div
      onClick={() => onSelect(character)}
      className="group bg-card-bg border border-border-color rounded-xl overflow-hidden cursor-pointer hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all"
    >
      {/* Image Container */}
      <div className="aspect-square bg-black relative overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={character.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#1e1933]">
            <Icons.User className="text-text-muted opacity-30" size={48} />
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Action Buttons */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleDeleteClick}
            className="p-2 bg-black/60 backdrop-blur-sm text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
            title="Delete character"
          >
            <Icons.Trash2 size={14} />
          </button>
        </div>

        {/* LoRA Badge */}
        {character.styleLora && (
          <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] bg-blue-500/80 backdrop-blur-sm text-white px-2 py-1 rounded-full font-medium">
              LoRA: {character.styleLora}
            </span>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="p-4">
        <h3 className="font-bold text-white truncate mb-1">{character.name}</h3>
        {character.description && (
          <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
            {character.description}
          </p>
        )}
        {!character.description && (
          <p className="text-xs text-text-muted/50 italic">No description</p>
        )}

        {/* Image Count */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
          <Icons.ImageIcon size={12} className="text-text-muted" />
          <span className="text-[10px] text-text-muted">
            {character.referenceImages.length} {character.referenceImages.length === 1 ? 'image' : 'images'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CharacterCard;
