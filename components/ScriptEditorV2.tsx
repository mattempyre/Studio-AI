import React, { useState, useEffect, useRef, useCallback, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import * as Icons from './Icons';
import type { BackendProject, BackendSection, BackendSentence, Character, Voice } from '../types';
import { projectsApi, sectionsApi, sentencesApi, scriptsApi, type GeneratedSentence, type AIExpandResult } from '../services/backendApi';
import { AIExpansionModal } from './AIExpansionModal';
import { AIPreviewModal } from './AIPreviewModal';

// Debounce utility
function debounce<T extends (...args: Parameters<T>) => void>(
  func: T,
  wait: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, wait);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced as T & { cancel: () => void };
}

// Error Boundary to catch render errors
interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ScriptEditorErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ScriptEditor] React Error Boundary caught error:', error);
    console.error('[ScriptEditor] Component stack:', errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center bg-background-dark p-8">
          <div className="max-w-lg bg-red-500/10 border border-red-500/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Icons.AlertCircle className="text-red-400" size={24} />
              <h2 className="text-lg font-bold text-red-400">Rendering Error</h2>
            </div>
            <p className="text-white mb-4">An error occurred while rendering the script editor:</p>
            <pre className="bg-black/40 rounded-lg p-4 text-xs text-red-300 overflow-auto max-h-48 mb-4">
              {this.state.error?.message || 'Unknown error'}
              {this.state.error?.stack && (
                <>
                  {'\n\n'}
                  {this.state.error.stack}
                </>
              )}
            </pre>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                this.props.onReset?.();
              }}
              className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface ScriptEditorV2Props {
  projectId: string;
  projectName?: string; // Optional override from parent for real-time sync
  onUpdateProjectName?: () => Promise<void>; // Callback to refresh layout projects after name change
  libraryCharacters: Character[];
  clonedVoices: Voice[];
  onNext: () => void;
}

// Sentence status indicator colors
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  generating: 'bg-blue-500/20 text-blue-400',
  completed: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
};

// Visual style options
const VISUAL_STYLES = [
  'Cinematic',
  'Photorealistic',
  'Anime',
  '3D Render',
  'Minimalist Sketch',
  'Comic Book',
  'Pixel Art',
  'MS Paint Explainer',
  'Stickman',
  'Cyberpunk',
  'Watercolor',
];

// Duration presets in minutes
const DURATION_PRESETS = [8, 15, 30, 60, 90, 120];

// Format duration for display
const formatDuration = (mins: number): string => {
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remaining = mins % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
};

// Dirty indicator component
const DirtyIndicator: React.FC<{ isAudioDirty: boolean; isImageDirty: boolean; isVideoDirty: boolean }> = ({
  isAudioDirty,
  isImageDirty,
  isVideoDirty,
}) => {
  if (!isAudioDirty && !isImageDirty && !isVideoDirty) return null;

  return (
    <div className="flex items-center gap-1">
      {isAudioDirty && (
        <span className="size-1.5 rounded-full bg-orange-400" title="Audio needs regeneration" />
      )}
      {isImageDirty && (
        <span className="size-1.5 rounded-full bg-warning" title="Image needs regeneration" />
      )}
      {isVideoDirty && (
        <span className="size-1.5 rounded-full bg-pink-400" title="Video needs regeneration" />
      )}
    </div>
  );
};

// Inline editable sentence component
const SentenceRow: React.FC<{
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
      className={`group flex items-start gap-3 p-3 rounded-lg border transition-all ${
        isDragging ? 'opacity-50 border-primary border-dashed bg-primary/5' : 'border-transparent hover:border-white/10 hover:bg-white/5'
      } ${isDragOver ? 'border-t-2 border-t-primary' : ''}`}
    >
      {/* Drag handle - this is the draggable element */}
      <div
        ref={dragHandleRef}
        draggable={!isEditing}
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        className={`mt-1 cursor-grab active:cursor-grabbing text-text-muted hover:text-white transition-opacity ${
          isEditing ? 'opacity-30 cursor-not-allowed' : 'opacity-0 group-hover:opacity-100'
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
            className="text-sm text-white/90 leading-relaxed cursor-text hover:text-white transition-colors"
          >
            {sentence.text}
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
            {sentence.audioDuration && (
              <span className="text-[10px] text-text-muted flex items-center gap-1">
                <Icons.Clock size={10} />
                {(sentence.audioDuration / 1000).toFixed(1)}s
              </span>
            )}
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

// Confirmation Modal component
const ConfirmModal: React.FC<{
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}> = ({
  isOpen,
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  danger = true,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-surface-2 border border-border-color rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-full ${danger ? 'bg-red-500/20' : 'bg-primary/20'}`}>
            <Icons.AlertTriangle className={danger ? 'text-red-400' : 'text-primary'} size={20} />
          </div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>

        <p className="text-text-muted mb-6">{message}</p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-bold text-text-muted hover:text-white transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              danger
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-primary hover:bg-primary/80 text-white'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// Section component
const SectionCard: React.FC<{
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

// Main ScriptEditorV2 Component
const ScriptEditorV2: React.FC<ScriptEditorV2Props> = ({
  projectId,
  projectName,
  onUpdateProjectName,
  libraryCharacters,
  clonedVoices,
  onNext,
}) => {
  const [project, setProject] = useState<BackendProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSentenceId, setEditingSentenceId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Script generation state
  const [concept, setConcept] = useState('');
  const [targetDuration, setTargetDuration] = useState(8);
  const [visualStyle, setVisualStyle] = useState('Cinematic');
  const [useSearch, setUseSearch] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Project name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // AI Expansion state
  const [aiExpandSection, setAiExpandSection] = useState<BackendSection | null>(null);
  const [aiExpandAfterSentenceId, setAiExpandAfterSentenceId] = useState<string | undefined>(undefined);
  const [aiExpandResult, setAiExpandResult] = useState<AIExpandResult | null>(null);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [isAIAccepting, setIsAIAccepting] = useState(false);

  // Load project data with proper normalization
  const loadProject = useCallback(async () => {
    console.log('[ScriptEditor] loadProject called');
    try {
      setLoading(true);
      setError(null);
      console.log('[ScriptEditor] Fetching project...');
      const data = await projectsApi.get(projectId);
      console.log('[ScriptEditor] Got project data:', { id: data?.id, sections: data?.sections?.length });

      // Validate the response
      if (!data || !data.id) {
        throw new Error('Project not found or invalid response from server');
      }

      // Normalize the data to ensure arrays are always defined
      const normalizedProject: BackendProject = {
        ...data,
        sections: (data.sections || []).map(section => ({
          ...section,
          sentences: section.sentences || [],
        })),
      };

      setProject(normalizedProject);
    } catch (err) {
      console.error('[ScriptEditor] loadProject error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      console.log('[ScriptEditor] loadProject finally, setting loading=false');
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // Focus name input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Project name editing handlers
  const displayName = projectName || project?.name || '';

  const startEditingName = () => {
    setEditNameValue(displayName);
    setIsEditingName(true);
  };

  const saveNameEdit = async () => {
    const trimmedName = editNameValue.trim();
    if (trimmedName && project) {
      try {
        // Update backend
        await projectsApi.update(project.id, { name: trimmedName });
        // Update local state
        setProject({ ...project, name: trimmedName });
        // Refresh layout projects to sync sidebar
        if (onUpdateProjectName) {
          await onUpdateProjectName();
        }
      } catch (err) {
        console.error('Failed to update project name:', err);
      }
    }
    setIsEditingName(false);
  };

  const cancelNameEdit = () => {
    setIsEditingName(false);
    setEditNameValue(displayName);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveNameEdit();
    } else if (e.key === 'Escape') {
      cancelNameEdit();
    }
  };

  // Sync project settings to local state when project loads
  useEffect(() => {
    if (project) {
      setTargetDuration(project.targetDuration || 8);
      setVisualStyle(project.visualStyle || 'Cinematic');
      setConcept(project.topic || '');
    }
  }, [project?.id]);

  // Update project settings on backend
  const handleUpdateProjectSettings = async (updates: { targetDuration?: number; visualStyle?: string; topic?: string }) => {
    if (!project) return;

    try {
      setIsSaving(true);
      await projectsApi.update(project.id, updates);

      setProject({
        ...project,
        ...updates,
      });
    } catch (err) {
      console.error('Failed to update project settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle script generation using Deepseek backend API
  const handleGenerateScript = async () => {
    if (!project || !concept.trim()) return;

    const currentProjectId = project.id;

    try {
      setIsGenerating(true);
      console.log('[ScriptEditor] Starting script generation for project:', currentProjectId);

      // Call backend API to generate script (uses Deepseek)
      await scriptsApi.quickGenerate(currentProjectId, {
        topic: concept,
        targetDurationMinutes: targetDuration,
        visualStyle: visualStyle.toLowerCase(),
        useSearchGrounding: useSearch,
      });

      console.log('[ScriptEditor] Script generation completed, fetching updated project...');

      // Reload the project to get the newly generated sections/sentences
      const updatedProject = await projectsApi.get(currentProjectId);
      console.log('[ScriptEditor] Received updated project:', {
        id: updatedProject?.id,
        sectionCount: updatedProject?.sections?.length,
        sentenceCount: updatedProject?.sections?.reduce((acc, s) => acc + (s.sentences?.length || 0), 0),
      });

      // Validate the project data structure before updating state
      if (!updatedProject || !updatedProject.id) {
        console.error('[ScriptEditor] Invalid project data received:', updatedProject);
        throw new Error('Invalid project data received from server');
      }

      // Ensure sections and sentences arrays are always defined
      const normalizedProject: BackendProject = {
        ...updatedProject,
        sections: (updatedProject.sections || []).map(section => ({
          ...section,
          sentences: section.sentences || [],
        })),
      };

      console.log('[ScriptEditor] Setting normalized project with', normalizedProject.sections.length, 'sections');

      // Directly update state - no setTimeout needed
      // React will batch these updates properly
      setProject(normalizedProject);
      setToast({ message: 'Script generated successfully!', type: 'success' });
      setTimeout(() => setToast(null), 5000);

    } catch (err) {
      console.error('[ScriptEditor] Failed to generate script:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setToast({ message: `Failed to generate script: ${errorMessage}`, type: 'error' });
      setTimeout(() => setToast(null), 8000);
    } finally {
      setIsGenerating(false);
    }
  };

  // Update section title
  const handleUpdateSectionTitle = async (sectionId: string, title: string) => {
    if (!project) return;

    try {
      setIsSaving(true);
      await sectionsApi.update(sectionId, { title });

      // Update local state
      setProject({
        ...project,
        sections: (project.sections || []).map(s =>
          s.id === sectionId ? { ...s, title } : s
        ),
      });
    } catch (err) {
      console.error('Failed to update section title:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete section (actual deletion logic)
  const performDeleteSection = async (sectionId: string) => {
    if (!project) return;

    try {
      setIsSaving(true);
      await sectionsApi.delete(sectionId);

      // Update local state
      setProject({
        ...project,
        sections: (project.sections || []).filter(s => s.id !== sectionId),
      });
    } catch (err) {
      console.error('Failed to delete section:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete section with confirmation modal
  const handleDeleteSection = (sectionId: string) => {
    if (!project) return;

    setConfirmModal({
      isOpen: true,
      title: 'Delete Section',
      message: 'Are you sure you want to delete this section and all its sentences? This action cannot be undone.',
      onConfirm: () => {
        performDeleteSection(sectionId);
        setConfirmModal(null);
      },
    });
  };

  // Add new section
  const handleAddSection = async () => {
    if (!project) return;

    try {
      setIsSaving(true);
      const newSection = await sectionsApi.create({
        projectId: project.id,
        title: `Section ${(project.sections || []).length + 1}`,
        order: (project.sections || []).length,
      });

      // Update local state
      setProject({
        ...project,
        sections: [...(project.sections || []), { ...newSection, sentences: [] }],
      });
    } catch (err) {
      console.error('Failed to add section:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Update sentence text
  const handleUpdateSentence = async (sentenceId: string, text: string) => {
    if (!project) return;

    try {
      setIsSaving(true);
      const updated = await sentencesApi.update(sentenceId, { text });

      // Update local state
      setProject({
        ...project,
        sections: (project.sections || []).map(section => ({
          ...section,
          sentences: (section.sentences || []).map(s =>
            s.id === sentenceId ? updated : s
          ),
        })),
      });
    } catch (err) {
      console.error('Failed to update sentence:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete sentence (actual deletion logic)
  const performDeleteSentence = async (sentenceId: string) => {
    if (!project) return;

    try {
      setIsSaving(true);
      await sentencesApi.delete(sentenceId);

      // Update local state
      setProject({
        ...project,
        sections: (project.sections || []).map(section => ({
          ...section,
          sentences: (section.sentences || []).filter(s => s.id !== sentenceId),
        })),
      });
    } catch (err) {
      console.error('Failed to delete sentence:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete sentence with optional confirmation modal
  const handleDeleteSentence = (sentenceId: string, skipConfirmation?: boolean) => {
    if (!project) return;

    if (skipConfirmation) {
      // Skip confirmation (e.g., when canceling a new empty sentence)
      performDeleteSentence(sentenceId);
    } else {
      // Show confirmation modal
      setConfirmModal({
        isOpen: true,
        title: 'Delete Sentence',
        message: 'Are you sure you want to delete this sentence? This action cannot be undone.',
        onConfirm: () => {
          performDeleteSentence(sentenceId);
          setConfirmModal(null);
        },
      });
    }
  };

  // Add sentence to section (optionally after a specific index)
  const handleAddSentence = async (sectionId: string, afterIndex?: number) => {
    if (!project) return;

    const section = (project.sections || []).find(s => s.id === sectionId);
    if (!section) return;

    const sentences = section.sentences || [];
    // If afterIndex is provided, insert after that index; otherwise append at end
    const insertIndex = afterIndex !== undefined ? afterIndex + 1 : sentences.length;

    try {
      setIsSaving(true);
      const newSentence = await sentencesApi.create({
        sectionId,
        text: '',
        order: insertIndex,
      });

      // Update local state - insert at the correct position
      const updatedSentences = [...sentences];
      updatedSentences.splice(insertIndex, 0, newSentence);

      setProject({
        ...project,
        sections: (project.sections || []).map(s =>
          s.id === sectionId
            ? { ...s, sentences: updatedSentences }
            : s
        ),
      });
      setEditingSentenceId(newSentence.id);
    } catch (err) {
      console.error('Failed to add sentence:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Reorder sentences within a section
  const handleReorderSentences = async (sectionId: string, sentenceIds: string[]) => {
    if (!project) return;

    try {
      setIsSaving(true);
      await sentencesApi.reorder(sectionId, sentenceIds);

      // Update local state
      const section = (project.sections || []).find(s => s.id === sectionId);
      if (section) {
        const reorderedSentences = sentenceIds
          .map(id => (section.sentences || []).find(s => s.id === id))
          .filter((s): s is BackendSentence => s !== undefined)
          .map((s, idx) => ({ ...s, order: idx }));

        setProject({
          ...project,
          sections: (project.sections || []).map(s =>
            s.id === sectionId ? { ...s, sentences: reorderedSentences } : s
          ),
        });
      }
    } catch (err) {
      console.error('Failed to reorder sentences:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // AI Expansion: Open modal for a section
  const handleOpenAIExpand = (section: BackendSection, afterSentenceId?: string) => {
    setAiExpandSection(section);
    setAiExpandAfterSentenceId(afterSentenceId);
    setAiExpandResult(null);
  };

  // AI Expansion: Generate sentences
  const handleAIGenerate = async (params: { mode: 'quick' | 'guided'; prompt?: string; sentenceCount: number }) => {
    if (!aiExpandSection) return;

    try {
      setIsAIGenerating(true);
      const result = await sectionsApi.aiExpand(aiExpandSection.id, {
        ...params,
        insertAfterSentenceId: aiExpandAfterSentenceId,
      });
      setAiExpandResult(result);
    } catch (err) {
      console.error('[AI Expand] Generation failed:', err);
      setToast({ message: `AI generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`, type: 'error' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setIsAIGenerating(false);
    }
  };

  // AI Expansion: Accept and save generated sentences
  const handleAIAccept = async (sentences: GeneratedSentence[]) => {
    if (!project || !aiExpandSection || !aiExpandResult) return;

    try {
      setIsAIAccepting(true);
      const result = await sectionsApi.aiExpandAccept(aiExpandSection.id, {
        generatedSentences: sentences,
        insertAfterSentenceId: aiExpandAfterSentenceId,
      });

      // Reload the project to get the updated sentences
      const updatedProject = await projectsApi.get(project.id);
      const normalizedProject: BackendProject = {
        ...updatedProject,
        sections: (updatedProject.sections || []).map(section => ({
          ...section,
          sentences: section.sentences || [],
        })),
      };
      setProject(normalizedProject);

      // Close modals and show success
      setAiExpandSection(null);
      setAiExpandAfterSentenceId(undefined);
      setAiExpandResult(null);
      setToast({ message: `Added ${result.insertedCount} sentence${result.insertedCount !== 1 ? 's' : ''} to section`, type: 'success' });
      setTimeout(() => setToast(null), 5000);
    } catch (err) {
      console.error('[AI Expand] Accept failed:', err);
      setToast({ message: `Failed to add sentences: ${err instanceof Error ? err.message : 'Unknown error'}`, type: 'error' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setIsAIAccepting(false);
    }
  };

  // AI Expansion: Regenerate (go back to generation modal)
  const handleAIRegenerate = () => {
    setAiExpandResult(null);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <Icons.RefreshCw className="animate-spin text-primary" size={32} />
          <p className="text-text-muted">Loading project...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background-dark">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <Icons.AlertCircle className="text-red-400" size={32} />
          <p className="text-white font-bold">Failed to load project</p>
          <p className="text-text-muted text-sm">{error}</p>
          <button
            onClick={loadProject}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  console.log('[ScriptEditor] Render state:', { loading, error: !!error, project: !!project, projectId: project?.id, sections: project?.sections?.length });

  // If project is null without an error (shouldn't happen, but defensive)
  // Show a proper UI instead of returning null (which causes black screen)
  if (!project) {
    console.warn('[ScriptEditor] No project and no error - unexpected state');
    return (
      <div className="flex-1 flex items-center justify-center bg-background-dark">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <Icons.AlertCircle className="text-yellow-400" size={32} />
          <p className="text-white font-bold">Project not available</p>
          <p className="text-text-muted text-sm">
            The project data could not be loaded. This may be a temporary issue.
          </p>
          <button
            onClick={loadProject}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            Reload Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <ScriptEditorErrorBoundary onReset={loadProject}>
    <div className="flex-1 flex flex-col h-full overflow-y-auto font-display bg-background-dark custom-scrollbar">
      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal?.isOpen ?? false}
        title={confirmModal?.title ?? ''}
        message={confirmModal?.message ?? ''}
        onConfirm={confirmModal?.onConfirm ?? (() => {})}
        onCancel={() => setConfirmModal(null)}
      />

      {/* Header */}
      <div className="px-8 py-6 border-b border-border-color bg-background-dark/60">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="group">
            {isEditingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onKeyDown={handleNameKeyDown}
                onBlur={saveNameEdit}
                className="text-xl font-bold text-white bg-transparent border-b border-primary focus:outline-none w-full"
                aria-label="Project name"
              />
            ) : (
              <div className="flex items-center gap-2">
                <h1
                  className="text-xl font-bold text-white cursor-pointer hover:text-primary transition-colors"
                  onClick={startEditingName}
                  title="Click to edit project name"
                >
                  {displayName}
                </h1>
                {onUpdateProjectName && (
                  <button
                    onClick={startEditingName}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-primary transition-all p-1"
                    title="Rename Project"
                    aria-label="Rename project"
                  >
                    <Icons.Edit3 size={14} />
                  </button>
                )}
              </div>
            )}
            <p className="text-sm text-text-muted mt-1">
              {(project.sections || []).length} section{(project.sections || []).length !== 1 ? 's' : ''} •{' '}
              {(project.sections || []).reduce((sum, s) => sum + (s.sentences || []).length, 0)} sentences
            </p>
          </div>

          <div className="flex items-center gap-4">
            {isSaving && (
              <span className="text-xs text-text-muted flex items-center gap-2">
                <Icons.RefreshCw className="animate-spin" size={12} />
                Saving...
              </span>
            )}
            <button
              onClick={onNext}
              className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              Continue to Storyboard
              <Icons.ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Script Ideas & Prompts Section */}
      <div className="p-8 border-b border-border-color bg-background-dark/40">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-[10px] text-primary font-bold uppercase tracking-[0.2em]">
              Script Ideas & Prompts
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-muted">Cast: {libraryCharacters.length}</span>
            </div>
          </div>

          {/* Concept Input */}
          <textarea
            className="w-full bg-surface-2 border border-border-color rounded-xl p-5 text-sm text-white/90 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 leading-relaxed shadow-2xl transition-all resize-none mb-3"
            placeholder="Enter your core video concept, themes, or specific instructions here..."
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            onBlur={() => {
              if (concept !== project?.topic) {
                handleUpdateProjectSettings({ topic: concept });
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
                  onMouseUp={() => handleUpdateProjectSettings({ targetDuration })}
                  onTouchEnd={() => handleUpdateProjectSettings({ targetDuration })}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none accent-primary cursor-pointer"
                />
                <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS.map((mins) => (
                    <button
                      key={mins}
                      onClick={() => {
                        setTargetDuration(mins);
                        handleUpdateProjectSettings({ targetDuration: mins });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                        targetDuration === mins
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
            <div className="bg-surface-2/50 border border-border-subtle rounded-xl p-4 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <Icons.ImageIcon size={14} className="text-primary" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Visual Style</span>
              </div>
              <div className="relative flex-1">
                <select
                  value={visualStyle}
                  onChange={(e) => {
                    setVisualStyle(e.target.value);
                    handleUpdateProjectSettings({ visualStyle: e.target.value });
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

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setUseSearch(!useSearch)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  useSearch
                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                    : 'bg-white/5 text-text-muted border-transparent hover:bg-white/10'
                }`}
              >
                <Icons.Globe size={14} />
                {useSearch ? 'Google Search Enabled' : 'Enable Search Grounding'}
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleGenerateScript}
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

      {/* Main Content */}
      <div className="p-8">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          {/* Section List Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
              <span className="w-8 h-[1px] bg-white/10" />
              Script Sections
              <span className="flex-1 h-[1px] bg-white/10" />
            </h2>
          </div>

          {/* Sections */}
          {(project.sections || []).length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-2xl">
              <Icons.FileText className="mx-auto text-text-muted mb-4" size={40} />
              <p className="text-white font-bold mb-2">No sections yet</p>
              <p className="text-text-muted text-sm mb-6">
                Start building your script by adding sections
              </p>
              <button
                onClick={handleAddSection}
                className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
              >
                <Icons.Plus size={16} />
                Add First Section
              </button>
            </div>
          ) : (
            <>
              {(project.sections || []).map((section, index) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  sectionIndex={index}
                  editingSentenceId={editingSentenceId}
                  onSetEditingSentenceId={setEditingSentenceId}
                  onUpdateSectionTitle={(title) => handleUpdateSectionTitle(section.id, title)}
                  onDeleteSection={() => handleDeleteSection(section.id)}
                  onUpdateSentence={handleUpdateSentence}
                  onDeleteSentence={handleDeleteSentence}
                  onAddSentence={(afterIndex) => handleAddSentence(section.id, afterIndex)}
                  onReorderSentences={(ids) => handleReorderSentences(section.id, ids)}
                  onAIExpand={(afterSentenceId) => handleOpenAIExpand(section, afterSentenceId)}
                />
              ))}

              {/* Add Section Button */}
              <button
                onClick={handleAddSection}
                className="w-full py-8 border-2 border-dashed border-white/10 hover:border-primary/40 hover:bg-primary/5 rounded-2xl text-sm font-bold text-text-muted hover:text-primary transition-all flex items-center justify-center gap-2"
              >
                <Icons.Plus size={20} />
                Add New Section
              </button>
            </>
          )}
        </div>
      </div>

      {/* AI Expansion Modal */}
      {aiExpandSection && !aiExpandResult && (
        <AIExpansionModal
          isOpen={true}
          onClose={() => {
            setAiExpandSection(null);
            setAiExpandAfterSentenceId(undefined);
          }}
          section={aiExpandSection}
          onGenerate={handleAIGenerate}
          isGenerating={isAIGenerating}
        />
      )}

      {/* AI Preview Modal */}
      {aiExpandSection && aiExpandResult && (
        <AIPreviewModal
          isOpen={true}
          onClose={() => {
            setAiExpandSection(null);
            setAiExpandAfterSentenceId(undefined);
            setAiExpandResult(null);
          }}
          sectionTitle={aiExpandResult.sectionTitle}
          generatedSentences={aiExpandResult.generatedSentences}
          insertPosition={aiExpandResult.insertPosition}
          onAccept={handleAIAccept}
          onRegenerate={handleAIRegenerate}
          isAccepting={isAIAccepting}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-slide-up ${
            toast.type === 'error'
              ? 'bg-red-500/90 text-white'
              : 'bg-green-500/90 text-white'
          }`}
        >
          {toast.type === 'error' ? (
            <Icons.AlertTriangle size={18} />
          ) : (
            <Icons.Check size={18} />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 hover:opacity-70 transition-opacity"
          >
            <Icons.X size={16} />
          </button>
        </div>
      )}
    </div>
    </ScriptEditorErrorBoundary>
  );
};

export default ScriptEditorV2;
