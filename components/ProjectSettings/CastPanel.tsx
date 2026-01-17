import React, { useState } from 'react';
import * as Icons from '../Icons';
import { BackendProject, BackendCharacter } from '../../types';
import { CharacterPicker } from './CharacterPicker';

interface CastPanelProps {
    project: BackendProject;
    onUpdate: () => void; // Trigger refresh of project data
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const CastPanel: React.FC<CastPanelProps> = ({ project, onUpdate }) => {
    const [showPicker, setShowPicker] = useState(false);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    // Safely access cast array (it might be just IDs if not fully hydrated, but our API update ensures it's objects)
    // We type cast it to backend character array assuming the API updated in STORY-013 returns full objects
    const cast = (project.cast || []) as unknown as BackendCharacter[];

    const handleAddCharacters = async (characterIds: string[]) => {
        try {
            const response = await fetch(`${API_BASE}/api/v1/projects/${project.id}/cast/batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ characterIds }),
            });

            if (!response.ok) throw new Error('Failed to add characters');

            onUpdate();
            setShowPicker(false);
        } catch (error) {
            console.error('Error adding characters:', error);
            // Ideally show toast error here
        }
    };

    const handleRemoveCharacter = async (characterId: string) => {
        try {
            setIsDeleting(characterId);
            const response = await fetch(`${API_BASE}/api/v1/projects/${project.id}/cast/${characterId}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to remove character');

            onUpdate();
        } catch (error) {
            console.error('Error removing character:', error);
        } finally {
            setIsDeleting(null);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background-dark text-white p-8 overflow-y-auto">
            {/* Header */}
            <div className="max-w-5xl mx-auto w-full mb-8">
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-3xl font-bold font-display">Cast & Characters</h1>
                    <button
                        onClick={() => setShowPicker(true)}
                        className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-glow-sm"
                    >
                        <Icons.Plus size={16} />
                        <span>Add Character</span>
                    </button>
                </div>
                <p className="text-text-muted">
                    Manage the recurring characters in this project. Characters in the cast are used to maintain visual consistency across generated scenes.
                </p>
            </div>

            {/* Cast Grid */}
            <div className="max-w-5xl mx-auto w-full flex-1">
                {cast.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-white/5 rounded-2xl bg-surface-1/50">
                        <div className="bg-surface-2 p-4 rounded-full mb-4">
                            <Icons.Users className="text-text-muted" size={40} />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">No characters in cast</h3>
                        <p className="text-text-muted text-center max-w-md mb-6">
                            Add characters from your library to ensure they appear consistently in your generated video scenes.
                        </p>
                        <button
                            onClick={() => setShowPicker(true)}
                            className="flex items-center gap-2 bg-surface-2 hover:bg-surface-3 text-white px-5 py-2.5 rounded-lg font-medium transition-colors border border-white/10"
                        >
                            <Icons.Plus size={16} />
                            <span>Browse Library</span>
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {cast.map((character) => {
                            const thumbnail = character.referenceImages?.[0]
                                ? `${API_BASE}${character.referenceImages[0]}`
                                : null;

                            return (
                                <div
                                    key={character.id}
                                    className="group flex items-center gap-4 p-4 bg-surface-1 border border-border-color rounded-xl hover:border-primary/30 hover:bg-surface-2 transition-all"
                                >
                                    {/* Avatar */}
                                    <div className="size-16 rounded-lg bg-black/50 overflow-hidden flex-shrink-0 relative border border-white/5">
                                        {thumbnail ? (
                                            <img src={thumbnail} alt={character.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="flex items-center justify-center w-full h-full">
                                                <Icons.User className="text-white/20" size={24} />
                                            </div>
                                        )}
                                        {character.styleLora && (
                                            <div className="absolute bottom-0 inset-x-0 bg-blue-500/80 text-white text-[9px] font-bold text-center py-0.5 backdrop-blur-sm">
                                                LoRA
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-lg text-white truncate">{character.name}</h3>
                                            <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-text-muted border border-white/5 hidden sm:block">
                                                {character.referenceImages?.length || 0} refs
                                            </span>
                                        </div>
                                        <p className="text-sm text-text-muted line-clamp-1">
                                            {character.description || <span className="italic opacity-50">No description</span>}
                                        </p>
                                    </div>

                                    {/* Settings / Stats - Placeholder for future "Role" or "Costume" */}
                                    <div className="hidden sm:flex items-center gap-6 px-4 border-l border-white/5">
                                        <div className="flex flex-col items-center gap-1 min-w-[60px]">
                                            <span className="text-[10px] uppercase text-text-muted font-bold tracking-wider">Role</span>
                                            <span className="text-xs text-white">-</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 pl-4 border-l border-white/5">
                                        <button
                                            onClick={() => handleRemoveCharacter(character.id)}
                                            disabled={isDeleting === character.id}
                                            className="p-2 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                                            title="Remove from cast"
                                        >
                                            {isDeleting === character.id ? (
                                                <Icons.RefreshCw size={20} className="animate-spin" />
                                            ) : (
                                                <Icons.X size={20} />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {showPicker && (
                <CharacterPicker
                    excludeIds={cast.map(c => c.id)}
                    onSelect={handleAddCharacters}
                    onClose={() => setShowPicker(false)}
                />
            )}
        </div>
    );
};

export default CastPanel;
