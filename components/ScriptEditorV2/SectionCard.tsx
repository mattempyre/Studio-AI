import React, { useState, useEffect, useRef } from 'react';
import * as Icons from '../Icons';
import { BackendSection } from '../../types';
import { SentenceRow } from './SentenceRow';
import type { SentenceAudioState } from '../../hooks/useAudioGeneration';

export const SectionCard: React.FC<{
    section: BackendSection;
    sectionIndex: number;
    editingSentenceId: string | null;
    onSetEditingSentenceId: (id: string | null) => void;
    onUpdateSectionTitle: (title: string) => void;
    onDeleteSection: () => void;
    onUpdateSentence: (sentenceId: string, text: string) => void;
    onDeleteSentence: (sentenceId: string, skipConfirmation?: boolean) => void;
    onAddSentence: (afterIndex?: number) => void;
    onReorderSentences: (sentenceIds: string[]) => void;
    onAIExpand: (afterSentenceId?: string) => void;
    getSentenceAudioState?: (sentenceId: string) => SentenceAudioState | undefined;
    onPlayAudio?: (audioUrl: string, label?: string, sectionId?: string) => void;
    onRegenerateAudio?: (sectionId: string) => void;
    // Karaoke sync props
    currentAudioTimeMs?: number;
    isAudioPlaying?: boolean;
    activeSectionId?: string | null;
}> = ({
    section,
    sectionIndex,
    editingSentenceId,
    onSetEditingSentenceId,
    onUpdateSectionTitle,
    onDeleteSection,
    onUpdateSentence,
    onDeleteSentence,
    onAddSentence,
    onReorderSentences,
    onAIExpand,
    getSentenceAudioState,
    onPlayAudio,
    onRegenerateAudio,
    // Karaoke sync
    currentAudioTimeMs = 0,
    isAudioPlaying = false,
    activeSectionId = null,
}) => {
        const [isEditingTitle, setIsEditingTitle] = useState(false);
        const [titleInput, setTitleInput] = useState(section.title);
        const [isCollapsed, setIsCollapsed] = useState(false);
        const [draggedSentenceIndex, setDraggedSentenceIndex] = useState<number | null>(null);
        const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
        const titleInputRef = useRef<HTMLInputElement>(null);

        useEffect(() => {
            setTitleInput(section.title);
        }, [section.title]);

        useEffect(() => {
            if (isEditingTitle && titleInputRef.current) {
                titleInputRef.current.focus();
                titleInputRef.current.select();
            }
        }, [isEditingTitle]);

        const handleTitleSave = () => {
            if (titleInput.trim() && titleInput.trim() !== section.title) {
                onUpdateSectionTitle(titleInput.trim());
            }
            setIsEditingTitle(false);
        };

        const handleTitleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter') {
                handleTitleSave();
            } else if (e.key === 'Escape') {
                setTitleInput(section.title);
                setIsEditingTitle(false);
            }
        };

        // Sentence drag and drop handlers
        const handleSentenceDragStart = (index: number) => (e: React.DragEvent) => {
            setDraggedSentenceIndex(index);
            e.dataTransfer.effectAllowed = 'move';
        };

        const handleSentenceDragOver = (index: number) => (e: React.DragEvent) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (draggedSentenceIndex === index) return;
            setDragOverIndex(index);
        };

        const handleSentenceDrop = (index: number) => (e: React.DragEvent) => {
            e.preventDefault();
            if (draggedSentenceIndex === null || draggedSentenceIndex === index) {
                setDragOverIndex(null);
                return;
            }

            const newSentences = [...(section.sentences || [])];
            const [draggedItem] = newSentences.splice(draggedSentenceIndex, 1);
            newSentences.splice(index, 0, draggedItem);

            onReorderSentences(newSentences.map(s => s.id));

            setDraggedSentenceIndex(null);
            setDragOverIndex(null);
        };

        const handleSentenceDragEnd = () => {
            setDraggedSentenceIndex(null);
            setDragOverIndex(null);
        };

        const sentences = section.sentences || [];

        return (
            <div className="bg-card-bg border border-border-color rounded-2xl overflow-hidden transition-all hover:border-primary/30">
                {/* Section Header */}
                <div
                    className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/5 cursor-pointer"
                    onClick={() => !isEditingTitle && setIsCollapsed(!isCollapsed)}
                >
                    <div className="flex items-center gap-3">
                        {/* Collapse toggle */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsCollapsed(!isCollapsed);
                            }}
                            className="p-1 text-text-muted hover:text-white transition-colors"
                        >
                            <Icons.ChevronRight
                                size={16}
                                className={`transform transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                            />
                        </button>

                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                            SECTION {String(sectionIndex + 1).padStart(2, '0')}
                        </span>

                        {isEditingTitle ? (
                            <input
                                ref={titleInputRef}
                                value={titleInput}
                                onChange={(e) => setTitleInput(e.target.value)}
                                onBlur={handleTitleSave}
                                onKeyDown={handleTitleKeyDown}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-black/40 border border-primary/50 rounded px-2 py-1 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        ) : (
                            <h3
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditingTitle(true);
                                }}
                                className="text-sm font-bold text-white cursor-text hover:text-primary transition-colors"
                            >
                                {section.title}
                            </h3>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-text-muted">
                            {sentences.length} sentence{sentences.length !== 1 ? 's' : ''}
                        </span>
                        {onRegenerateAudio && sentences.length > 0 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRegenerateAudio(section.id);
                                }}
                                className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded transition-colors"
                                title="Regenerate section audio"
                            >
                                <Icons.RefreshCw size={14} />
                            </button>
                        )}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSection();
                            }}
                            className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                            title="Delete section"
                        >
                            <Icons.Trash2 size={14} />
                        </button>
                    </div>
                </div>

                {/* Sentences List - Collapsible */}
                {!isCollapsed && (
                    <div className="p-2">
                        {/* AI Expand Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAIExpand(undefined);
                            }}
                            className="w-full mb-3 py-2 px-4 border border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 rounded-lg text-xs font-bold text-primary/70 hover:text-primary transition-all flex items-center justify-center gap-2"
                        >
                            <Icons.Sparkles size={14} />
                            Expand with AI
                        </button>

                        {sentences.length === 0 ? (
                            <div className="text-center py-8 text-text-muted text-sm">
                                No sentences yet. Add your first sentence below.
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {sentences.map((sentence, index) => (
                                    <React.Fragment key={sentence.id}>
                                        {/* Add sentence button between sentences */}
                                        {index > 0 && (
                                            <div className="group/add flex justify-center gap-2 py-1">
                                                <button
                                                    onClick={() => onAddSentence(index - 1)}
                                                    className="opacity-0 group-hover/add:opacity-100 px-3 py-0.5 text-[10px] font-bold text-text-muted hover:text-white bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/20 rounded-full transition-all flex items-center gap-1"
                                                    title="Add blank sentence here"
                                                >
                                                    <Icons.Plus size={10} />
                                                    Add
                                                </button>
                                                <button
                                                    onClick={() => onAIExpand(sentences[index - 1].id)}
                                                    className="opacity-0 group-hover/add:opacity-100 px-3 py-0.5 text-[10px] font-bold text-primary/70 hover:text-primary bg-primary/5 hover:bg-primary/10 border border-transparent hover:border-primary/30 rounded-full transition-all flex items-center gap-1"
                                                    title="Generate sentence with AI"
                                                >
                                                    <Icons.Sparkles size={10} />
                                                    Add with AI
                                                </button>
                                            </div>
                                        )}
                                        <SentenceRow
                                            sentence={sentence}
                                            index={index}
                                            isEditing={editingSentenceId === sentence.id}
                                            onStartEdit={() => onSetEditingSentenceId(sentence.id)}
                                            onSave={(text) => {
                                                onUpdateSentence(sentence.id, text);
                                                onSetEditingSentenceId(null);
                                            }}
                                            onAutoSave={(text) => onUpdateSentence(sentence.id, text)}
                                            onCancel={() => {
                                                // If canceling a new sentence with default text, delete it
                                                if (sentence.text === 'New sentence...' || sentence.text.trim() === '') {
                                                    onDeleteSentence(sentence.id, true); // skip confirmation
                                                    onSetEditingSentenceId(null);
                                                } else {
                                                    onSetEditingSentenceId(null);
                                                }
                                            }}
                                            onDelete={() => onDeleteSentence(sentence.id)}
                                            onDragStart={handleSentenceDragStart(index)}
                                            onDragOver={handleSentenceDragOver(index)}
                                            onDrop={handleSentenceDrop(index)}
                                            onDragEnd={handleSentenceDragEnd}
                                            isDragging={draggedSentenceIndex === index}
                                            isDragOver={dragOverIndex === index}
                                            audioState={getSentenceAudioState?.(sentence.id)}
                                            onPlayAudio={onPlayAudio}
                                            // Karaoke sync
                                            currentAudioTimeMs={currentAudioTimeMs}
                                            isAudioPlaying={isAudioPlaying}
                                            activeSectionId={activeSectionId}
                                        />
                                    </React.Fragment>
                                ))}
                            </div>
                        )}

                        {/* Add Sentence Buttons at end */}
                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={() => onAddSentence()}
                                className="flex-1 py-2 border border-dashed border-white/10 hover:border-white/30 hover:bg-white/5 rounded-lg text-xs font-bold text-text-muted hover:text-white transition-all flex items-center justify-center gap-2"
                            >
                                <Icons.Plus size={14} />
                                Add Sentence
                            </button>
                            <button
                                onClick={() => onAIExpand(sentences.length > 0 ? sentences[sentences.length - 1].id : undefined)}
                                className="flex-1 py-2 border border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 rounded-lg text-xs font-bold text-primary/70 hover:text-primary transition-all flex items-center justify-center gap-2"
                            >
                                <Icons.Sparkles size={14} />
                                Add with AI
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };
