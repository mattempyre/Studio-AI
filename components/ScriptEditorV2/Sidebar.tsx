import React from 'react';
import * as Icons from '../Icons';
import { Character, Voice, BackendProject } from '../../types';
import { PLATFORM_VOICES } from './utils';

interface SidebarProps {
    activePanelTab: 'cast' | 'voice';
    setActivePanelTab: (tab: 'cast' | 'voice') => void;
    setShowRightPanel: (show: boolean) => void;
    isCreatingChar: boolean;
    setIsCreatingChar: (creating: boolean) => void;
    renderForm: (isEdit: boolean) => React.ReactNode;
    resetCharacterForm: () => void;
    libraryCharacters: Character[];
    editingCharacterId: string | null;
    setEditingCharacterId: (id: string | null) => void;
    setNewCharName: (name: string) => void;
    setNewCharDesc: (desc: string) => void;
    setFormImageUrl: (url: string) => void;
    project: BackendProject;
    toggleCharacterInProject: (char: Character) => Promise<void>;
    voiceCategory: 'platform' | 'cloned';
    setVoiceCategory: (cat: 'platform' | 'cloned') => void;
    clonedVoices: Voice[];
    handleVoiceSelect: (id: string) => Promise<void>;
    previewPlayingId: string | null;
    toggleVoicePreview: (id: string) => void;
    isDraggingVoice: boolean;
    setIsDraggingVoice: (dragging: boolean) => void;
    onVoiceDrop: (e: React.DragEvent) => void;
    onVoiceFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    activePanelTab,
    setActivePanelTab,
    setShowRightPanel,
    isCreatingChar,
    setIsCreatingChar,
    renderForm,
    resetCharacterForm,
    libraryCharacters,
    editingCharacterId,
    setEditingCharacterId,
    setNewCharName,
    setNewCharDesc,
    setFormImageUrl,
    project,
    toggleCharacterInProject,
    voiceCategory,
    setVoiceCategory,
    clonedVoices,
    handleVoiceSelect,
    previewPlayingId,
    toggleVoicePreview,
    isDraggingVoice,
    setIsDraggingVoice,
    onVoiceDrop,
    onVoiceFileChange,
}) => {
    return (
        <aside className="w-80 border-l border-border-color bg-[#0d0b1a] flex flex-col transition-all duration-300 animate-in slide-in-from-right h-full">
            <div className="flex items-center border-b border-white/5">
                <button
                    onClick={() => setActivePanelTab('cast')}
                    className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center justify-center gap-2 ${activePanelTab === 'cast' ? 'text-white border-primary' : 'text-text-muted border-transparent hover:text-white'}`}
                >
                    <Icons.User size={14} /> Cast
                </button>
                <button
                    onClick={() => setActivePanelTab('voice')}
                    className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center justify-center gap-2 ${activePanelTab === 'voice' ? 'text-white border-primary' : 'text-text-muted border-transparent hover:text-white'}`}
                >
                    <Icons.Mic size={14} /> Voice
                </button>
                <button onClick={() => setShowRightPanel(false)} className="px-4 text-text-muted hover:text-white border-b-2 border-transparent">
                    <Icons.X size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">

                {/* --- CAST TAB CONTENT --- */}
                {activePanelTab === 'cast' && (
                    <>
                        {isCreatingChar ? (
                            <div className="mb-4">{renderForm(false)}</div>
                        ) : (
                            <button
                                onClick={() => { resetCharacterForm(); setIsCreatingChar(true); }}
                                className="w-full py-3 mb-6 border-2 border-dashed border-white/10 hover:border-primary/50 hover:bg-primary/5 rounded-xl text-xs font-bold text-text-muted hover:text-primary transition-all flex items-center justify-center gap-2"
                            >
                                <Icons.Plus size={16} /> Create Character
                            </button>
                        )}
                        <div className="space-y-4">
                            {libraryCharacters.map((char) => {
                                if (editingCharacterId === char.id) return <div key={char.id}>{renderForm(true)}</div>;
                                const isInProject = project.characters?.some(c => c.id === char.id);
                                return (
                                    <div
                                        key={char.id}
                                        onClick={() => toggleCharacterInProject(char)}
                                        className={`group bg-card-bg border rounded-xl overflow-hidden transition-all cursor-pointer ${isInProject ? 'border-primary/50 opacity-60' : 'border-white/5 hover:border-white/20'}`}
                                    >
                                        <div className="h-40 bg-black relative">
                                            <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover" />
                                            {isInProject && (
                                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                                                    <div className="flex items-center gap-1 text-primary font-bold text-xs bg-black/50 px-3 py-1.5 rounded-full border border-primary/20"><Icons.CheckCircle size={12} /> Added</div>
                                                </div>
                                            )}
                                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={(e) => { e.stopPropagation(); setEditingCharacterId(char.id); setIsCreatingChar(false); setNewCharName(char.name); setNewCharDesc(char.description); setFormImageUrl(char.imageUrl); }} className="p-1.5 bg-black/50 text-white rounded hover:bg-primary"><Icons.Edit3 size={12} /></button>
                                            </div>
                                        </div>
                                        <div className="p-3">
                                            <h4 className="text-sm font-bold text-white flex justify-between">{char.name} {!isInProject && <Icons.Plus size={14} className="text-text-muted group-hover:text-primary" />}</h4>
                                            <p className="text-[10px] text-text-muted line-clamp-2 mt-1">{char.description}</p>
                                        </div>
                                    </div>
                                );
                            })}
                            {libraryCharacters.length === 0 && !isCreatingChar && <div className="text-center text-text-muted text-xs py-4">Your library is empty.</div>}
                        </div>
                    </>
                )}

                {/* --- VOICE TAB CONTENT --- */}
                {activePanelTab === 'voice' && (
                    <div className="flex flex-col gap-6">
                        <div className="flex p-1 bg-black/40 rounded-lg border border-white/5">
                            <button onClick={() => setVoiceCategory('platform')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${voiceCategory === 'platform' ? 'bg-white/10 text-white shadow-sm' : 'text-text-muted hover:text-white'}`}>Platform</button>
                            <button onClick={() => setVoiceCategory('cloned')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${voiceCategory === 'cloned' ? 'bg-white/10 text-white shadow-sm' : 'text-text-muted hover:text-white'}`}>Cloned</button>
                        </div>

                        <div className="space-y-3">
                            {(voiceCategory === 'platform' ? PLATFORM_VOICES : clonedVoices).map((voice) => (
                                <div
                                    key={voice.id}
                                    onClick={() => handleVoiceSelect(voice.id)}
                                    className={`group p-3 rounded-xl border transition-all cursor-pointer relative ${project.voiceId === voice.id ? 'bg-primary/10 border-primary' : 'bg-card-bg border-white/5 hover:border-white/20'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`size-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${project.voiceId === voice.id ? 'bg-primary' : 'bg-[#2a2440]'}`}>{voice.name.charAt(0)}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center">
                                                <h4 className={`text-xs font-bold truncate ${project.voiceId === voice.id ? 'text-white' : 'text-white/80'}`}>{voice.name}</h4>
                                                {project.voiceId === voice.id && <Icons.CheckCircle size={12} className="text-primary" />}
                                            </div>
                                            <p className="text-[10px] text-text-muted truncate">{voice.style} • {voice.gender}</p>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => { e.stopPropagation(); toggleVoicePreview(voice.id); }} className="text-[10px] flex items-center gap-1 text-primary font-bold hover:underline">
                                            {previewPlayingId === voice.id ? <Icons.Video size={10} className="animate-pulse" /> : <Icons.PlayCircle size={10} />} Preview Sample
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {voiceCategory === 'cloned' && clonedVoices.length === 0 && <div className="text-center text-xs text-text-muted italic py-2">No cloned voices yet.</div>}
                        </div>

                        {/* Clone CTA */}
                        <div
                            onDragOver={(e) => { e.preventDefault(); setIsDraggingVoice(true); }}
                            onDragLeave={() => setIsDraggingVoice(false)}
                            onDrop={onVoiceDrop}
                            className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all ${isDraggingVoice ? 'border-primary bg-primary/5' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                        >
                            <Icons.UploadCloud size={20} className="text-text-muted mb-2" />
                            <h4 className="text-white font-bold text-xs mb-1">Clone New Voice</h4>
                            <p className="text-[10px] text-text-muted mb-3">Drag audio file here</p>
                            <label className="cursor-pointer">
                                <input type="file" className="hidden" accept="audio/*" onChange={onVoiceFileChange} />
                                <span className="px-3 py-1.5 bg-white text-background-dark font-bold text-[10px] rounded-lg hover:bg-gray-200 transition-colors inline-block shadow-lg">Browse Files</span>
                            </label>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-white/5 bg-[#0d0b1a] text-[10px] text-text-muted">
                {activePanelTab === 'cast' ? "Click a character to toggle them in this project's active cast." : "Select a voice to apply it globally to your script."}
            </div>
        </aside>
    );
};
