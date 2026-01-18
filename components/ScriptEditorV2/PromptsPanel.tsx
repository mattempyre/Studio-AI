import React from 'react';
import * as Icons from '../Icons';
import { Character } from '../../types';
import { VISUAL_STYLES, DURATION_PRESETS, formatDuration } from './utils';

// Generation progress state for long-form scripts
export interface GenerationProgress {
    isActive: boolean;
    currentSection: number;
    totalSections: number;
    currentSectionTitle: string;
    percentComplete: number;
    sectionsCompleted: string[];
}

interface PromptsPanelProps {
    charactersCount: number;
    showRightPanel: boolean;
    activePanelTab: 'cast' | 'voice';
    setShowRightPanel: (show: boolean) => void;
    setActivePanelTab: (tab: 'cast' | 'voice') => void;
    concept: string;
    setConcept: (concept: string) => void;
    onUpdateTopic: (topic: string) => void;
    targetDuration: number;
    setTargetDuration: (duration: number) => void;
    onUpdateTargetDuration: (duration: number) => void;
    visualStyle: string;
    setVisualStyle: (style: string) => void;
    onUpdateVisualStyle: (style: string) => void;
    projectCharacters: Character[];
    useSearch: boolean;
    setUseSearch: (use: boolean) => void;
    isGenerating: boolean;
    generationProgress?: GenerationProgress | null;
    onGenerate: () => void;
}

export const PromptsPanel: React.FC<PromptsPanelProps> = ({
    charactersCount,
    showRightPanel,
    activePanelTab,
    setShowRightPanel,
    setActivePanelTab,
    concept,
    setConcept,
    onUpdateTopic,
    targetDuration,
    setTargetDuration,
    onUpdateTargetDuration,
    visualStyle,
    setVisualStyle,
    onUpdateVisualStyle,
    projectCharacters,
    useSearch,
    setUseSearch,
    isGenerating,
    generationProgress,
    onGenerate,
}) => {
    return (
        <div className="p-8 border-b border-border-color bg-background-dark/40">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-3">
                    <label className="block text-[10px] text-primary font-bold uppercase tracking-[0.2em]">Script Ideas & Prompts</label>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-text-muted">
                            Cast: {charactersCount}
                        </span>
                        <button
                            onClick={() => {
                                if (showRightPanel && activePanelTab === 'cast') setShowRightPanel(false);
                                else { setShowRightPanel(true); setActivePanelTab('cast'); }
                            }}
                            className="text-xs font-bold flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-surface-2 text-text-muted border-border-color hover:text-text-primary hover:border-primary transition-all"
                        >
                            <Icons.User size={14} /> Character Library
                        </button>
                        <button
                            onClick={() => {
                                if (showRightPanel && activePanelTab === 'voice') setShowRightPanel(false);
                                else { setShowRightPanel(true); setActivePanelTab('voice'); }
                            }}
                            className="text-xs font-bold flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-surface-2 text-text-muted border-border-color hover:text-text-primary hover:border-primary transition-all"
                        >
                            <Icons.Mic size={14} /> Voice Settings
                        </button>
                    </div>
                </div>

                {/* Concept Input */}
                <textarea
                    className="w-full bg-surface-2 border border-border-color rounded-xl p-5 text-sm text-white/90 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 leading-relaxed shadow-2xl transition-all resize-none mb-3"
                    placeholder="Enter your core video concept, themes, or specific instructions here..."
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    onBlur={() => {
                        if (concept.trim()) {
                            onUpdateTopic(concept);
                        }
                    }}
                    rows={3}
                />

                {/* Duration & Style Controls */}
                <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Target Duration */}
                    <div className="bg-surface-3 border border-border-color rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Icons.Clock size={14} className="text-primary" />
                                <span className="text-xs font-bold text-white uppercase tracking-wider">Target Duration</span>
                            </div>
                            <span className="text-sm font-bold text-white bg-white/10 px-2 py-0.5 rounded">
                                {formatDuration(targetDuration)}
                            </span>
                        </div>
                        <div className="flex flex-col gap-4">
                            <input
                                type="range"
                                min="1"
                                max="120"
                                value={targetDuration}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value);
                                    setTargetDuration(value);
                                }}
                                onMouseUp={() => onUpdateTargetDuration(targetDuration)}
                                onTouchEnd={() => onUpdateTargetDuration(targetDuration)}
                                className="w-full h-1.5 bg-white/10 rounded-full appearance-none accent-primary cursor-pointer"
                            />
                            <div className="flex flex-wrap gap-2">
                                {DURATION_PRESETS.map((mins) => (
                                    <button
                                        key={mins}
                                        onClick={() => {
                                            setTargetDuration(mins);
                                            onUpdateTargetDuration(mins);
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${targetDuration === mins
                                            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                                            : 'bg-white/5 text-text-muted border-transparent hover:bg-white/10 hover:text-white'
                                            }`}
                                    >
                                        {formatDuration(mins)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Visual Style */}
                    <div className="bg-surface-3 border border-border-color rounded-xl p-4 flex flex-col">
                        <div className="flex items-center gap-2 mb-3">
                            <Icons.ImageIcon size={14} className="text-primary" />
                            <span className="text-xs font-bold text-white uppercase tracking-wider">Visual Style</span>
                        </div>
                        <div className="relative flex-1">
                            <select
                                value={visualStyle}
                                onChange={(e) => {
                                    setVisualStyle(e.target.value);
                                    onUpdateVisualStyle(e.target.value);
                                }}
                                className="w-full h-full bg-surface-1 border border-border-color rounded-lg pl-4 pr-10 text-sm text-white appearance-none focus:border-primary focus:outline-none cursor-pointer"
                            >
                                {VISUAL_STYLES.map((style) => (
                                    <option key={style} value={style}>
                                        {style}
                                    </option>
                                ))}
                            </select>
                            <Icons.ChevronDown
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                                size={16}
                            />
                        </div>
                    </div>
                </div>

                {/* Active Project Cast Strip */}
                {projectCharacters.length > 0 && (
                    <div className="mb-4">
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2 block pl-1">Cast to Include</label>
                        <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                            {projectCharacters.map(char => (
                                <div key={char.id} className="relative group shrink-0">
                                    <div className="flex items-center gap-3 bg-[#1e1933] border border-white/10 rounded-full pr-4 pl-1 py-1 group-hover:border-primary/30 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowRightPanel(true); setActivePanelTab('cast'); }}>
                                        <img src={char.imageUrl} alt={char.name} className="size-8 rounded-full object-cover border border-white/10" />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-white leading-none">{char.name}</span>
                                            <span className="text-[9px] text-text-muted leading-none mt-0.5 max-w-[100px] truncate">{char.description}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Generation Progress Bar (for long-form scripts) */}
                {generationProgress?.isActive && (
                    <div className="mb-4 bg-surface-3 border border-primary/30 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Icons.RefreshCw className="animate-spin text-primary" size={14} />
                                <span className="text-xs font-bold text-white">
                                    Generating Long-Form Script
                                </span>
                            </div>
                            <span className="text-xs text-text-muted">
                                Section {generationProgress.currentSection} of {generationProgress.totalSections}
                            </span>
                        </div>
                        <div className="mb-2">
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-500"
                                    style={{ width: `${generationProgress.percentComplete}%` }}
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-primary font-medium">
                                {generationProgress.currentSectionTitle}
                            </span>
                            <span className="text-[10px] text-text-muted">
                                {generationProgress.percentComplete}% complete
                            </span>
                        </div>
                        {generationProgress.sectionsCompleted.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                                {generationProgress.sectionsCompleted.map((title, i) => (
                                    <span key={i} className="text-[9px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                                        ✓ {title}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setUseSearch(!useSearch)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${useSearch
                                ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                                : 'bg-white/5 text-text-muted border-transparent hover:bg-white/10'
                                }`}
                        >
                            <Icons.Globe size={14} />
                            {useSearch ? 'Google Search Enabled' : 'Enable Search Grounding'}
                        </button>
                        {targetDuration > 15 && !isGenerating && (
                            <span className="text-[10px] text-amber-400/80 flex items-center gap-1">
                                <Icons.Clock size={12} />
                                Long-form (async)
                            </span>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onGenerate}
                            disabled={isGenerating || !concept.trim()}
                            className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50 transition-all"
                        >
                            {isGenerating ? (
                                <Icons.RefreshCw className="animate-spin" size={14} />
                            ) : (
                                <Icons.Wand2 size={14} />
                            )}
                            {isGenerating ? 'Generating...' : 'Generate Initial Script'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
