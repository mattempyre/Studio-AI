import React from 'react';
import * as Icons from '../Icons';
import { BackendCharacter } from '../../types';
import CharacterCard from './CharacterCard';

interface CharacterGridProps {
  characters: BackendCharacter[];
  onSelect: (character: BackendCharacter) => void;
  onDelete: (character: BackendCharacter) => void;
  onCreate: () => void;
}

export const CharacterGrid: React.FC<CharacterGridProps> = ({
  characters,
  onSelect,
  onDelete,
  onCreate,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
      {/* Create New Card */}
      <button
        onClick={onCreate}
        className="aspect-square border-2 border-dashed border-white/10 hover:border-primary/50 rounded-xl flex flex-col items-center justify-center gap-3 text-text-muted hover:text-primary hover:bg-primary/5 transition-all group"
      >
        <div className="size-16 rounded-full bg-white/5 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
          <Icons.Plus size={28} className="group-hover:scale-110 transition-transform" />
        </div>
        <span className="text-sm font-bold">New Character</span>
      </button>

      {/* Character Cards */}
      {characters.map((character) => (
        <CharacterCard
          key={character.id}
          character={character}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export default CharacterGrid;
