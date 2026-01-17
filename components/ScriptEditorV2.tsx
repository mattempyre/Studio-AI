import React, { useState, useEffect, useRef, useCallback, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import * as Icons from './Icons';
import type { BackendProject, BackendSection, BackendSentence, Character, Voice } from '../types';
import { projectsApi, sectionsApi, sentencesApi, scriptsApi, type GeneratedSentence, type AIExpandResult } from '../services/backendApi';
import { AIExpansionModal } from './AIExpansionModal';
import { AIPreviewModal } from './AIPreviewModal';

// Import extracted components and utils
import {
  STATUS_COLORS,
  VISUAL_STYLES,
  DURATION_PRESETS,
  formatDuration,
  debounce,
  PLATFORM_VOICES,
} from './ScriptEditorV2/utils';
import { ScriptEditorErrorBoundary } from './ScriptEditorV2/ErrorBoundary';
import { SentenceRow } from './ScriptEditorV2/SentenceRow';
import { SectionCard } from './ScriptEditorV2/SectionCard';
import { ConfirmModal } from './ScriptEditorV2/ConfirmModal';
import { DirtyIndicator } from './ScriptEditorV2/DirtyIndicator';
import { Header } from './ScriptEditorV2/Header';
import { PromptsPanel } from './ScriptEditorV2/PromptsPanel';
import { Sidebar } from './ScriptEditorV2/Sidebar';

interface ScriptEditorV2Props {
  projectId: string;
  projectName?: string; // Optional override from parent for real-time sync
  onUpdateProjectName?: () => Promise<void>; // Callback to refresh layout projects after name change
  libraryCharacters: Character[];
  clonedVoices: Voice[];
  onNext: () => void;
}


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

  // Sidebar / Cast / Voice State
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [activePanelTab, setActivePanelTab] = useState<'cast' | 'voice'>('cast');
  const [voiceCategory, setVoiceCategory] = useState<'platform' | 'cloned'>('platform');
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);
  const [isDraggingVoice, setIsDraggingVoice] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Character Form (Inline)
  const [isCreatingChar, setIsCreatingChar] = useState(false);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [newCharName, setNewCharName] = useState('');
  const [newCharDesc, setNewCharDesc] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

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

  // --- Cast & Voice Handlers ---

  const toggleVoicePreview = (id: string) => {
    if (previewPlayingId === id) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      setPreviewPlayingId(null);
    } else {
      setPreviewPlayingId(id);
      // MOCK preview logic - in real app would play src
      setTimeout(() => setPreviewPlayingId(null), 3000);
    }
  };

  const handleVoiceSelect = async (voiceId: string) => {
    if (!project) return;
    try {
      setIsSaving(true);
      await projectsApi.update(project.id, { voiceId });
      setProject({ ...project, voiceId });
    } catch (e) { console.error("Failed to update voice", e); } finally { setIsSaving(false); }
  };

  const toggleCharacterInProject = async (character: Character) => {
    if (!project) return;
    const exists = (project.characters || []).some(c => c.id === character.id);
    try {
      setIsSaving(true);
      if (exists) {
        await projectsApi.removeCast(project.id, character.id);
        setProject({ ...project, characters: (project.characters || []).filter(c => c.id !== character.id) });
      } else {
        const updatedCast = await projectsApi.addCast(project.id, character.id);
        setProject({ ...project, characters: updatedCast });
      }
    } catch (e) {
      console.error(e);
      setToast({ message: 'Failed to update cast', type: 'error' });
    } finally { setIsSaving(false); }
  };

  const resetCharacterForm = () => {
    setNewCharName('');
    setNewCharDesc('');
    setFormImageUrl('');
    setEditingCharacterId(null);
    setIsCreatingChar(false);
  };

  const handleSaveCharacter = () => {
    // Stub for creating character since prop is missing
    setToast({ message: 'Character creation not supported in V2 yet', type: 'error' });
    resetCharacterForm();
  };

  const renderForm = (isEdit: boolean) => (
    <div
      className={`bg-[#1e1933] rounded-xl border p-5 space-y-4 cursor-default animate-in fade-in zoom-in-95 duration-200 shadow-2xl relative overflow-hidden ${isEdit ? 'border-primary' : 'border-dashed border-white/20'}`}
      onClick={e => e.stopPropagation()}
    >
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-black/20 to-transparent pointer-events-none" />
      <div className="flex items-center justify-between relative z-10">
        <h4 className="text-xs font-bold text-primary uppercase tracking-widest">{isEdit ? 'Edit Character' : 'New Character'}</h4>
        <button onClick={resetCharacterForm} className="text-text-muted hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors"><Icons.X size={14} /></button>
      </div>
      <div className="flex flex-col gap-4 relative z-10">
        <div className="flex items-start gap-4">
          <div className="flex flex-col gap-2">
            <div className="size-20 shrink-0 bg-black rounded-lg border border-white/20 overflow-hidden relative shadow-inner">
              {formImageUrl ? (
                <img src={formImageUrl} className="w-full h-full object-cover" alt="Preview" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/5"><Icons.User className="text-text-muted opacity-50" size={24} /></div>
              )}
            </div>
          </div>
          <div className="flex-1">
            <label className="text-[9px] font-bold text-text-muted uppercase mb-1 block">Character Name</label>
            <input
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none placeholder:text-text-muted/30 focus:bg-black/60 transition-colors"
              value={newCharName}
              onChange={(e) => setNewCharName(e.target.value)}
              autoFocus
            />
            <button
              onClick={(e) => { e.stopPropagation(); setFormImageUrl(`https://picsum.photos/seed/${newCharName}_${Date.now()}/200/200`); }}
              className="mt-2 text-[10px] font-bold text-primary hover:text-primary/80 flex items-center gap-1.5 transition-colors"
            >
              <Icons.RefreshCw size={12} /> Generate New Look
            </button>
          </div>
        </div>
        <div>
          <label className="text-[9px] font-bold text-text-muted uppercase mb-1 block">Visual Description</label>
          <textarea
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/90 focus:border-primary focus:outline-none resize-none placeholder:text-text-muted/30 min-h-[80px] focus:bg-black/60 transition-colors leading-relaxed"
            value={newCharDesc}
            onChange={(e) => setNewCharDesc(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-3 pt-2 border-t border-white/5 relative z-10">
        <button onClick={resetCharacterForm} className="flex-1 py-2 rounded-lg text-xs font-bold text-text-muted hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
        <button onClick={handleSaveCharacter} className="flex-1 py-2 bg-primary hover:bg-primary/90 rounded-lg text-xs font-bold text-white shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
          <Icons.Save size={14} /> {isEdit ? 'Save Changes' : 'Create'}
        </button>
      </div>
    </div>
  );

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
      <div className="flex-1 flex overflow-hidden font-display bg-background-dark h-full">
        <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar">
          <ConfirmModal
            isOpen={confirmModal?.isOpen ?? false}
            title={confirmModal?.title ?? ''}
            message={confirmModal?.message ?? ''}
            onConfirm={confirmModal?.onConfirm ?? (() => { })}
            onCancel={() => setConfirmModal(null)}
          />

          <Header
            displayName={displayName}
            isEditingName={isEditingName}
            editNameValue={editNameValue}
            setEditNameValue={setEditNameValue}
            onKeyDownName={handleNameKeyDown}
            onBlurName={saveNameEdit}
            onClickName={startEditingName}
            onUpdateProjectName={onUpdateProjectName}
            sectionCount={(project.sections || []).length}
            sentenceCount={(project.sections || []).reduce((sum, s) => sum + (s.sentences || []).length, 0)}
            isSaving={isSaving}
            onNext={onNext}
          />

          <PromptsPanel
            charactersCount={(project.characters || []).length}
            showRightPanel={showRightPanel}
            activePanelTab={activePanelTab}
            setShowRightPanel={setShowRightPanel}
            setActivePanelTab={setActivePanelTab}
            concept={concept}
            setConcept={setConcept}
            onUpdateTopic={(topic) => handleUpdateProjectSettings({ topic })}
            targetDuration={targetDuration}
            setTargetDuration={setTargetDuration}
            onUpdateTargetDuration={(targetDuration) => handleUpdateProjectSettings({ targetDuration })}
            visualStyle={visualStyle}
            setVisualStyle={setVisualStyle}
            onUpdateVisualStyle={(visualStyle) => handleUpdateProjectSettings({ visualStyle })}
            projectCharacters={project.characters || []}
            useSearch={useSearch}
            setUseSearch={setUseSearch}
            isGenerating={isGenerating}
            onGenerate={handleGenerateScript}
          />

          <div className="p-8">
            <div className="max-w-4xl mx-auto flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                  <span className="w-8 h-[1px] bg-white/10" />
                  Script Sections
                  <span className="flex-1 h-[1px] bg-white/10" />
                </h2>
              </div>

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

          {toast && (
            <div
              className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-slide-up ${toast.type === 'error'
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

        {showRightPanel && (
          <Sidebar
            activePanelTab={activePanelTab}
            setActivePanelTab={setActivePanelTab}
            setShowRightPanel={setShowRightPanel}
            isCreatingChar={isCreatingChar}
            setIsCreatingChar={setIsCreatingChar}
            renderForm={renderForm}
            resetCharacterForm={resetCharacterForm}
            libraryCharacters={libraryCharacters}
            editingCharacterId={editingCharacterId}
            setEditingCharacterId={setEditingCharacterId}
            setNewCharName={setNewCharName}
            setNewCharDesc={setNewCharDesc}
            setFormImageUrl={setFormImageUrl}
            project={project}
            toggleCharacterInProject={toggleCharacterInProject}
            voiceCategory={voiceCategory}
            setVoiceCategory={setVoiceCategory}
            clonedVoices={clonedVoices}
            handleVoiceSelect={handleVoiceSelect}
            previewPlayingId={previewPlayingId}
            toggleVoicePreview={toggleVoicePreview}
            isDraggingVoice={isDraggingVoice}
            setIsDraggingVoice={setIsDraggingVoice}
            onVoiceDrop={(e) => { e.preventDefault(); setIsDraggingVoice(false); setToast({ message: 'Voice cloning not implemented in V2 demo', type: 'error' }); }}
            onVoiceFileChange={(e) => setToast({ message: 'Voice cloning not implemented in V2 demo', type: 'error' })}
          />
        )}
      </div>
    </ScriptEditorErrorBoundary>
  );
};

export default ScriptEditorV2;
