import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Icons from './Icons';
import type { BackendProject, BackendSection, BackendSentence, Character, Voice } from '../types';
import { projectsApi, sectionsApi, sentencesApi } from '../services/backendApi';

interface ScriptEditorV2Props {
  projectId: string;
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
        <span className="size-1.5 rounded-full bg-purple-400" title="Image needs regeneration" />
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
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  isDragOver,
}) => {
  const [editText, setEditText] = useState(sentence.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSave = () => {
    if (editText.trim() !== sentence.text) {
      onSave(editText.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditText(sentence.text);
      onSave(sentence.text); // Cancel edit
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  const handleAutoResize = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    target.style.height = 'auto';
    target.style.height = `${target.scrollHeight}px`;
  };

  return (
    <div
      draggable={!isEditing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group flex items-start gap-3 p-3 rounded-lg border transition-all ${
        isDragging ? 'opacity-50 border-primary border-dashed bg-primary/5' : 'border-transparent hover:border-white/10 hover:bg-white/5'
      } ${isDragOver ? 'border-t-2 border-t-primary' : ''}`}
    >
      {/* Drag handle */}
      <div className="mt-1 cursor-grab active:cursor-grabbing text-text-muted hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
        <Icons.GripVertical size={14} />
      </div>

      {/* Sentence number */}
      <div className="mt-1 shrink-0 text-[10px] font-mono text-text-muted bg-white/5 px-1.5 py-0.5 rounded">
        {String(index + 1).padStart(2, '0')}
      </div>

      {/* Content area */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={(e) => {
              setEditText(e.target.value);
              handleAutoResize(e);
            }}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-full bg-black/40 border border-primary/50 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            rows={1}
          />
        ) : (
          <div
            onClick={onStartEdit}
            className="text-sm text-white/90 leading-relaxed cursor-text hover:text-white transition-colors"
          >
            {sentence.text}
          </div>
        )}

        {/* Status and dirty indicators */}
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
      </div>

      {/* Actions */}
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
  onDeleteSentence: (sentenceId: string) => void;
  onAddSentence: () => void;
  onReorderSentences: (sentenceIds: string[]) => void;
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
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(section.title);
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
    if (draggedSentenceIndex === index) return;
    setDragOverIndex(index);
  };

  const handleSentenceDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedSentenceIndex === null || draggedSentenceIndex === index) {
      setDragOverIndex(null);
      return;
    }

    const newSentences = [...section.sentences];
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

  return (
    <div className="bg-card-bg border border-border-color rounded-2xl overflow-hidden transition-all hover:border-primary/30">
      {/* Section Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/5">
        <div className="flex items-center gap-3">
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
              className="bg-black/40 border border-primary/50 rounded px-2 py-1 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          ) : (
            <h3
              onClick={() => setIsEditingTitle(true)}
              className="text-sm font-bold text-white cursor-text hover:text-primary transition-colors"
            >
              {section.title}
            </h3>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted">
            {section.sentences.length} sentence{section.sentences.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={onDeleteSection}
            className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
            title="Delete section"
          >
            <Icons.Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Sentences List */}
      <div className="p-2">
        {section.sentences.length === 0 ? (
          <div className="text-center py-8 text-text-muted text-sm">
            No sentences yet. Add your first sentence below.
          </div>
        ) : (
          section.sentences.map((sentence, index) => (
            <SentenceRow
              key={sentence.id}
              sentence={sentence}
              index={index}
              isEditing={editingSentenceId === sentence.id}
              onStartEdit={() => onSetEditingSentenceId(sentence.id)}
              onSave={(text) => {
                onUpdateSentence(sentence.id, text);
                onSetEditingSentenceId(null);
              }}
              onDelete={() => onDeleteSentence(sentence.id)}
              onDragStart={handleSentenceDragStart(index)}
              onDragOver={handleSentenceDragOver(index)}
              onDrop={handleSentenceDrop(index)}
              onDragEnd={handleSentenceDragEnd}
              isDragging={draggedSentenceIndex === index}
              isDragOver={dragOverIndex === index}
            />
          ))
        )}

        {/* Add Sentence Button */}
        <button
          onClick={onAddSentence}
          className="w-full mt-2 py-2 border border-dashed border-white/10 hover:border-primary/40 hover:bg-primary/5 rounded-lg text-xs font-bold text-text-muted hover:text-primary transition-all flex items-center justify-center gap-2"
        >
          <Icons.Plus size={14} />
          Add Sentence
        </button>
      </div>
    </div>
  );
};

// Main ScriptEditorV2 Component
const ScriptEditorV2: React.FC<ScriptEditorV2Props> = ({
  projectId,
  libraryCharacters,
  clonedVoices,
  onNext,
}) => {
  const [project, setProject] = useState<BackendProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSentenceId, setEditingSentenceId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load project data
  const loadProject = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await projectsApi.get(projectId);
      setProject(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // Update section title
  const handleUpdateSectionTitle = async (sectionId: string, title: string) => {
    if (!project) return;

    try {
      setIsSaving(true);
      await sectionsApi.update(sectionId, { title });

      // Update local state
      setProject({
        ...project,
        sections: project.sections.map(s =>
          s.id === sectionId ? { ...s, title } : s
        ),
      });
    } catch (err) {
      console.error('Failed to update section title:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete section
  const handleDeleteSection = async (sectionId: string) => {
    if (!project) return;
    if (!confirm('Are you sure you want to delete this section and all its sentences?')) return;

    try {
      setIsSaving(true);
      await sectionsApi.delete(sectionId);

      // Update local state
      setProject({
        ...project,
        sections: project.sections.filter(s => s.id !== sectionId),
      });
    } catch (err) {
      console.error('Failed to delete section:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Add new section
  const handleAddSection = async () => {
    if (!project) return;

    try {
      setIsSaving(true);
      const newSection = await sectionsApi.create({
        projectId: project.id,
        title: `Section ${project.sections.length + 1}`,
        order: project.sections.length,
      });

      // Update local state
      setProject({
        ...project,
        sections: [...project.sections, { ...newSection, sentences: [] }],
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
        sections: project.sections.map(section => ({
          ...section,
          sentences: section.sentences.map(s =>
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

  // Delete sentence
  const handleDeleteSentence = async (sentenceId: string) => {
    if (!project) return;
    if (!confirm('Are you sure you want to delete this sentence?')) return;

    try {
      setIsSaving(true);
      await sentencesApi.delete(sentenceId);

      // Update local state
      setProject({
        ...project,
        sections: project.sections.map(section => ({
          ...section,
          sentences: section.sentences.filter(s => s.id !== sentenceId),
        })),
      });
    } catch (err) {
      console.error('Failed to delete sentence:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Add sentence to section
  const handleAddSentence = async (sectionId: string) => {
    if (!project) return;

    const section = project.sections.find(s => s.id === sectionId);
    if (!section) return;

    try {
      setIsSaving(true);
      const newSentence = await sentencesApi.create({
        sectionId,
        text: 'New sentence...',
        order: section.sentences.length,
      });

      // Update local state and immediately start editing
      setProject({
        ...project,
        sections: project.sections.map(s =>
          s.id === sectionId
            ? { ...s, sentences: [...s.sentences, newSentence] }
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
      const section = project.sections.find(s => s.id === sectionId);
      if (section) {
        const reorderedSentences = sentenceIds
          .map(id => section.sentences.find(s => s.id === id))
          .filter((s): s is BackendSentence => s !== undefined)
          .map((s, idx) => ({ ...s, order: idx }));

        setProject({
          ...project,
          sections: project.sections.map(s =>
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

  if (!project) return null;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden font-display bg-background-dark">
      {/* Header */}
      <div className="shrink-0 px-8 py-6 border-b border-border-color bg-background-dark/60">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">{project.name}</h1>
            <p className="text-sm text-text-muted mt-1">
              {project.sections.length} section{project.sections.length !== 1 ? 's' : ''} •{' '}
              {project.sections.reduce((sum, s) => sum + s.sentences.length, 0)} sentences
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

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
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
          {project.sections.length === 0 ? (
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
              {project.sections.map((section, index) => (
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
                  onAddSentence={() => handleAddSentence(section.id)}
                  onReorderSentences={(ids) => handleReorderSentences(section.id, ids)}
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
    </div>
  );
};

export default ScriptEditorV2;
