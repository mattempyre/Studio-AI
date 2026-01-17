import React, { useState, useMemo } from 'react';
import * as Icons from '../Icons';
import { useCharacters } from '../../hooks/useCharacters';
import { BackendCharacter } from '../../types';

interface CharacterPickerProps {
    excludeIds: string[];
    onSelect: (characterIds: string[]) => void;
    onClose: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const CharacterPicker: React.FC<CharacterPickerProps> = ({ excludeIds, onSelect, onClose }) => {
    const { characters, isLoading } = useCharacters();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    // Filter available characters (not already in cast)
    const availableCharacters = useMemo(() => {
        return characters.filter(c => !excludeIds.includes(c.id));
    }, [characters, excludeIds]);

    // Filter by search query
    const filteredCharacters = useMemo(() => {
        if (!searchQuery.trim()) return availableCharacters;
        const query = searchQuery.toLowerCase();
        return availableCharacters.filter(c =>
            c.name.toLowerCase().includes(query) ||
            (c.description && c.description.toLowerCase().includes(query))
        );
    }, [availableCharacters, searchQuery]);

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleAdd = () => {
        onSelect(Array.from(selectedIds));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-surface-1 w-full max-w-4xl max-h-[90vh] rounded-2xl border border-border-color shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-white">Add Characters to Cast</h2>
                        <p className="text-text-muted text-sm mt-1">Select characters to include in scene generation</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-lg text-text-muted hover:text-white transition-colors"
                    >
                        <Icons.X size={20} />
                    </button>
                </div>

                {/* Search & Stats */}
                <div className="px-6 py-4 flex gap-4 border-b border-white/5 shrink-0 bg-surface-2/50">
                    <div className="relative flex-1">
                        <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                        <input
                            type="text"
                            placeholder="Search characters by name or description..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-surface-dark border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-text-muted/50"
                            autoFocus
                        />
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                        <div className="px-3 py-1 bg-primary/10 rounded-full border border-primary/20 text-primary-light font-medium">
                            {selectedIds.size} selected
                        </div>
                        <div className="text-text-muted">
                            {filteredCharacters.length} available
                        </div>
                    </div>
                </div>

                {/* Grid Content */}
                <div className="flex-1 overflow-y-auto p-6 min-h-[400px]">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Icons.RefreshCw className="animate-spin text-primary" size={32} />
                        </div>
                    ) : filteredCharacters.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-text-muted opacity-60">
                            <Icons.User size={48} className="mb-4 stroke-1" />
                            {availableCharacters.length === 0 ? (
                                <p>All library characters are already in the cast.</p>
                            ) : (
                                <p>No characters match your search.</p>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredCharacters.map(character => {
                                const isSelected = selectedIds.has(character.id);
                                const thumbnail = character.referenceImages.length > 0
                                    ? `${API_BASE}${character.referenceImages[0]}`
                                    : null;

                                return (
                                    <div
                                        key={character.id}
                                        onClick={() => toggleSelection(character.id)}
                                        className={`
                      group relative rounded-xl border-2 transition-all cursor-pointer overflow-hidden
                      ${isSelected
                                                ? 'border-primary bg-primary/10 shadow-[0_0_15px_-5px_var(--primary)]'
                                                : 'border-white/5 bg-surface-2 hover:border-white/20 hover:bg-surface-3'
                                            }
                    `}
                                    >
                                        {/* Thumbnail Aspect Ratio */}
                                        <div className="aspect-[4/5] bg-black/50 relative">
                                            {thumbnail ? (
                                                <img
                                                    src={thumbnail}
                                                    alt={character.name}
                                                    className={`w-full h-full object-cover transition-transform duration-500 ${isSelected ? 'scale-105' : 'group-hover:scale-105'}`}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-white/20">
                                                    <Icons.User size={40} />
                                                </div>
                                            )}

                                            {/* Checkbox Overlay */}
                                            <div className={`absolute top-3 right-3 transition-transform duration-200 ${isSelected ? 'scale-100' : 'scale-90 opacity-0 group-hover:opacity-100'}`}>
                                                <div className={`
                          size-6 rounded-full flex items-center justify-center border shadow-sm
                          ${isSelected ? 'bg-primary border-primary text-white' : 'bg-black/50 border-white/50 text-transparent hover:bg-black/70'}
                        `}>
                                                    <Icons.Check size={14} strokeWidth={3} />
                                                </div>
                                            </div>

                                            {/* Gradient Overlay */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

                                            {/* Info */}
                                            <div className="absolute bottom-0 left-0 right-0 p-3 pointer-events-none">
                                                <h3 className="font-bold text-white text-sm truncate leading-tight">{character.name}</h3>
                                                {character.description && (
                                                    <p className="text-[10px] text-white/60 line-clamp-1 mt-0.5">{character.description}</p>
                                                )}
                                                <div className="flex gap-1 mt-2">
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/10 border border-white/5 text-white/70 backdrop-blur-sm">
                                                        {character.referenceImages.length} imgs
                                                    </span>
                                                    {character.styleLora && (
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-200 backdrop-blur-sm">
                                                            LoRA
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 flex items-center justify-end gap-3 bg-surface-2/50 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-text-muted hover:text-white hover:bg-white/5 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleAdd}
                        disabled={selectedIds.size === 0}
                        className={`
              flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold text-white shadow-lg transition-all
              ${selectedIds.size > 0
                                ? 'bg-primary hover:bg-primary-hover shadow-primary/20 hover:shadow-primary/40 -translate-y-0.5'
                                : 'bg-white/5 text-white/30 cursor-not-allowed'
                            }
            `}
                    >
                        <Icons.Plus size={16} />
                        <span>Add Selected</span>
                        {selectedIds.size > 0 && (
                            <span className="bg-white/20 px-1.5 py-0.5 rounded textxs">{selectedIds.size}</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CharacterPicker;
