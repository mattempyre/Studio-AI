import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as Icons from '../Icons';
import { BackendSentence } from '../../types';
import { debounce, STATUS_COLORS } from './utils';
import { DirtyIndicator } from './DirtyIndicator';
import { SentenceAudioStatus } from './SentenceAudioStatus';
import { KaraokeText } from './KaraokeText';
import type { SentenceAudioState } from '../../hooks/useAudioGeneration';

export const SentenceRow: React.FC<{
    sentence: BackendSentence;
    index: number;
    isEditing: boolean;
    onStartEdit: () => void;
    onSave: (text: string) => void;
    onAutoSave: (text: string) => void;
    onCancel: () => void;
    onDelete: () => void;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onDragEnd: () => void;
    isDragging: boolean;
    isDragOver: boolean;
    audioState?: SentenceAudioState;
    onPlayAudio?: (audioUrl: string, label?: string, sectionId?: string) => void;
    // Karaoke sync props
    currentAudioTimeMs?: number;
    isAudioPlaying?: boolean;
    activeSectionId?: string | null;
}> = ({
    sentence,
    index,
    isEditing,
    onStartEdit,
    onSave,
    onAutoSave,
    onCancel,
    onDelete,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    isDragging,
    isDragOver,
    audioState,
    onPlayAudio,
    // Karaoke sync
    currentAudioTimeMs = 0,
    isAudioPlaying = false,
    activeSectionId = null,
}) => {
        const [editText, setEditText] = useState(sentence.text);
        const [isAutoSaving, setIsAutoSaving] = useState(false);
        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const dragHandleRef = useRef<HTMLDivElement>(null);

        // Create debounced auto-save function
        const debouncedAutoSave = useMemo(
            () =>
                debounce((text: string) => {
                    if (text.trim() && text.trim() !== sentence.text) {
                        setIsAutoSaving(true);
                        onAutoSave(text.trim());
                        // Reset auto-saving indicator after a brief delay
                        setTimeout(() => setIsAutoSaving(false), 500);
                    }
                }, 500),
            [sentence.text, onAutoSave]
        );

        // Cleanup debounce on unmount
        useEffect(() => {
            return () => {
                debouncedAutoSave.cancel();
            };
        }, [debouncedAutoSave]);

        useEffect(() => {
            if (isEditing && textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.style.height = 'auto';
                textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
            }
        }, [isEditing]);

        useEffect(() => {
            setEditText(sentence.text);
        }, [sentence.text]);

        const handleConfirm = () => {
            debouncedAutoSave.cancel(); // Cancel any pending auto-save
            if (editText.trim() !== sentence.text) {
                onSave(editText.trim());
            } else {
                onCancel();
            }
        };

        const handleCancelEdit = () => {
            debouncedAutoSave.cancel(); // Cancel any pending auto-save
            setEditText(sentence.text);
            onCancel();
        };

        const handleTextChange = (newText: string) => {
            setEditText(newText);
            debouncedAutoSave(newText);
        };

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleCancelEdit();
            }
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleConfirm();
            }
        };

        const handleAutoResize = (e: React.FormEvent<HTMLTextAreaElement>) => {
            const target = e.currentTarget;
            target.style.height = 'auto';
            target.style.height = `${target.scrollHeight}px`;
        };

        // Drag handlers that set proper data transfer
        const handleDragStart = (e: React.DragEvent) => {
            e.dataTransfer.setData('text/plain', sentence.id);
            e.dataTransfer.effectAllowed = 'move';
            onDragStart(e);
        };

        return (
            <div
                onDragOver={onDragOver}
                onDrop={onDrop}
                className={`group flex items-start gap-3 p-3 rounded-lg border transition-all ${isDragging ? 'opacity-50 border-primary border-dashed bg-primary/5' : 'border-transparent hover:border-white/10 hover:bg-white/5'
                    } ${isDragOver ? 'border-t-2 border-t-primary' : ''}`}
            >
                {/* Drag handle - this is the draggable element */}
                <div
                    ref={dragHandleRef}
                    draggable={!isEditing}
                    onDragStart={handleDragStart}
                    onDragEnd={onDragEnd}
                    className={`mt-1 cursor-grab active:cursor-grabbing text-text-muted hover:text-white transition-opacity ${isEditing ? 'opacity-30 cursor-not-allowed' : 'opacity-0 group-hover:opacity-100'
                        }`}
                    title={isEditing ? 'Finish editing to drag' : 'Drag to reorder'}
                >
                    <Icons.GripVertical size={14} />
                </div>

                {/* Sentence number */}
                <div className="mt-1 shrink-0 text-[10px] font-mono text-text-muted bg-white/5 px-1.5 py-0.5 rounded">
                    {String(index + 1).padStart(2, '0')}
                </div>

                {/* Content area */}
                <div className="flex-1 min-w-0">
                    {isEditing ? (
                        <div className="flex flex-col gap-2">
                            <textarea
                                ref={textareaRef}
                                value={editText}
                                onChange={(e) => {
                                    handleTextChange(e.target.value);
                                    handleAutoResize(e);
                                }}
                                onKeyDown={handleKeyDown}
                                placeholder="Enter your sentence here..."
                                className="w-full bg-black/40 border border-primary/50 rounded-lg px-3 py-2 text-sm text-white placeholder:text-text-muted/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                                rows={1}
                            />
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleConfirm}
                                    className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-xs font-bold hover:bg-green-500/30 transition-colors flex items-center gap-1"
                                >
                                    <Icons.Check size={12} />
                                    Confirm
                                </button>
                                <button
                                    onClick={handleCancelEdit}
                                    className="px-3 py-1 bg-white/5 text-text-muted border border-white/10 rounded text-xs font-bold hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1"
                                >
                                    <Icons.X size={12} />
                                    Cancel
                                </button>
                                {isAutoSaving ? (
                                    <span className="text-[10px] text-primary flex items-center gap-1 ml-2">
                                        <Icons.RefreshCw size={10} className="animate-spin" />
                                        Auto-saving...
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-text-muted ml-2">
                                        Auto-saves while typing • Enter to confirm
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div
                            onClick={onStartEdit}
                            className="text-sm leading-relaxed cursor-text hover:text-white transition-colors"
                        >
                            {/* Use KaraokeText when this section's audio is playing and we have word timings */}
                            {activeSectionId === sentence.sectionId &&
                             isAudioPlaying &&
                             sentence.wordTimings &&
                             sentence.wordTimings.length > 0 ? (
                                <KaraokeText
                                    text={sentence.text}
                                    wordTimings={sentence.wordTimings}
                                    currentTimeMs={currentAudioTimeMs}
                                    isPlaying={isAudioPlaying}
                                    sentenceStartMs={sentence.audioStartMs || 0}
                                    sentenceEndMs={sentence.audioEndMs || 0}
                                />
                            ) : (
                                <span className="text-white/90">{sentence.text}</span>
                            )}
                        </div>
                    )}

                    {/* Status and dirty indicators - only show when not editing */}
                    {!isEditing && (
                        <div className="flex items-center gap-3 mt-2">
                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${STATUS_COLORS[sentence.status]}`}>
                                {sentence.status}
                            </span>
                            <DirtyIndicator
                                isAudioDirty={sentence.isAudioDirty}
                                isImageDirty={sentence.isImageDirty}
                                isVideoDirty={sentence.isVideoDirty}
                            />
                            {/* Audio status with generation progress */}
                            <SentenceAudioStatus
                                audioState={audioState}
                                isAudioDirty={sentence.isAudioDirty}
                                existingAudioFile={sentence.audioFile}
                                existingDuration={sentence.audioDuration}
                                sectionAudioFile={sentence.sectionAudioFile}
                                sectionId={sentence.sectionId}
                                onPlayAudio={onPlayAudio}
                            />
                        </div>
                    )}
                </div>

                {/* Actions - only show when not editing */}
                {!isEditing && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={onStartEdit}
                            className="p-1.5 text-text-muted hover:text-white hover:bg-white/10 rounded transition-colors"
                            title="Edit sentence"
                        >
                            <Icons.Edit3 size={14} />
                        </button>
                        <button
                            onClick={onDelete}
                            className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                            title="Delete sentence"
                        >
                            <Icons.Trash2 size={14} />
                        </button>
                    </div>
                )}
            </div>
        );
    };
