import React, { useState, useEffect, useRef, useCallback, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import * as Icons from './Icons';
import type { BackendProject, BackendSection, BackendSentence, Character, Voice, BackendCharacter } from '../types';
import { projectsApi, sectionsApi, sentencesApi, scriptsApi, type GeneratedSentence, type AIExpandResult, type GenerationProgressEvent } from '../services/backendApi';
import { AIExpansionModal } from './AIExpansionModal';
import { AIPreviewModal } from './AIPreviewModal';
import { useCharacters } from '../hooks/useCharacters';
import { useModels } from '../hooks/useModels';
import { useStyles } from '../hooks/useStyles';
import { useAudioGeneration } from '../hooks/useAudioGeneration';
import { CharacterFormData } from './CharacterLibrary/CharacterModal';

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
import { AudioToolbar } from './ScriptEditorV2/AudioToolbar';
import { useAudioPlayer } from '../context/AudioPlayerContext';

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

  // Async generation progress state (for scripts >15 min)
  const [generationProgress, setGenerationProgress] = useState<{
    isActive: boolean;
    currentSection: number;
    totalSections: number;
    currentSectionTitle: string;
    percentComplete: number;
    sectionsCompleted: string[];
  } | null>(null);
  const progressCleanupRef = useRef<(() => void) | null>(null);

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

  // Global audio player context for persistent playback across navigation
  const {
    audioUrl: currentAudioUrl,
    sectionId: activeSectionId,
    isPlaying: isAudioPlaying,
    currentTimeMs: audioCurrentTimeMs,
    playAudio,
    closePlayer: handleCloseAudioPlayer,
  } = useAudioPlayer();

  // Character management with useCharacters hook
  const {
    characters: backendCharacters,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    uploadImage,
    deleteImage,
    refetch: refetchCharacters,
  } = useCharacters();

  // Models and Styles hooks for generation settings
  const {
    models,
    isLoading: modelsLoading,
  } = useModels();

  const {
    styles,
    isLoading: stylesLoading,
  } = useStyles();

  // Audio generation hook for bulk audio generation
  const {
    sentenceStates: audioSentenceStates,
    isGenerating: isAudioGenerating,
    isLoading: isAudioLoading,
    totalPending: audioTotalPending,
    completedCount: audioCompletedCount,
    failedCount: audioFailedCount,
    overallProgress: audioOverallProgress,
    mode: audioMode,
    generateAll: generateAllAudio,
    cancelAll: cancelAllAudio,
    setMode: setAudioMode,
    getSentenceStatus: getAudioSentenceStatus,
    forceRegenerate: forceRegenerateAudio,
    generateSection: generateSectionAudio,
    error: audioError,
  } = useAudioGeneration(projectId, {
    onSentenceComplete: useCallback((sentenceId: string, audioFile: string, duration?: number) => {
      // Update local project state with new audio info
      setProject(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: prev.sections.map(section => ({
            ...section,
            sentences: section.sentences.map(sentence =>
              sentence.id === sentenceId
                ? { ...sentence, audioFile, audioDuration: duration || null, isAudioDirty: false }
                : sentence
            ),
          })),
        };
      });
    }, []),
    onSectionComplete: useCallback(async (sectionId: string) => {
      // Refetch project to get updated sentence data including wordTimings, sectionAudioFile, etc.
      // This is needed for karaoke highlighting and proper audio playback in section mode
      console.log('[ScriptEditor] Section audio completed, refetching project for wordTimings:', sectionId);
      try {
        const updatedProject = await projectsApi.get(projectId);
        // Map cast to characters format (same as loadProject)
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const castData = (updatedProject as any).cast || [];
        const mappedCharacters = castData.map((c: any) => {
          const firstImage = c.referenceImages?.[0];
          return {
            id: c.id,
            name: c.name,
            description: c.description || '',
            imageUrl: firstImage ? `${API_BASE}${firstImage}` : `https://picsum.photos/seed/${c.id}/200/200`,
            stylePrompt: c.styleLora || undefined,
          };
        });
        const normalizedProject: BackendProject = {
          ...updatedProject,
          sections: (updatedProject.sections || []).map(section => ({
            ...section,
            sentences: section.sentences || [],
          })),
          characters: mappedCharacters,
        };
        setProject(normalizedProject);
        console.log('[ScriptEditor] Project refetched with wordTimings for section:', sectionId);
      } catch (err) {
        console.error('[ScriptEditor] Failed to refetch project after section completion:', err);
      }
    }, [projectId]),
    onAllComplete: useCallback(() => {
      setToast({ message: 'All audio generation complete!', type: 'success' });
    }, []),
  });

  // Count dirty sentences for audio toolbar
  const dirtySentenceCount = useMemo(() => {
    if (!project?.sections) return 0;
    return project.sections.reduce((count, section) => {
      return count + (section.sentences?.filter(s => s.isAudioDirty && s.text?.trim()).length || 0);
    }, 0);
  }, [project?.sections]);

  // Handle audio playback - uses global AudioPlayerContext for persistent playback
  // Audio file paths from DB are like "./data/projects/{projectId}/audio/{sentenceId}.wav"
  // or on Windows: "data\projects\{projectId}\audio\{sentenceId}.wav"
  // We need to convert to URL: "{API_BASE}/media/projects/{projectId}/audio/{sentenceId}.wav"
  const handlePlayAudio = useCallback((audioFilePath: string, label?: string, sectionId?: string) => {
    // Normalize path separators (Windows backslashes to forward slashes)
    const normalizedPath = audioFilePath.replace(/\\/g, '/');

    // Convert file path to URL
    // Path formats: ./data/projects/... or data/projects/...
    // URL format: {API_BASE}/media/projects/{projectId}/audio/{sentenceId}.wav
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    let audioUrl = normalizedPath;

    // Match various path formats and extract the part after "data/projects/"
    const match = normalizedPath.match(/(?:\.\/)?data\/projects\/(.+)/);
    if (match) {
      audioUrl = `${API_BASE_URL}/media/projects/${match[1]}`;
    } else if (normalizedPath.startsWith('/')) {
      // If it's an absolute path starting with /, prepend API_BASE
      audioUrl = `${API_BASE_URL}${normalizedPath}`;
    }

    console.log('[Audio] Playing via context:', audioUrl, sectionId ? `(section: ${sectionId})` : '');
    // Use global audio player context for persistent playback across navigation
    playAudio(audioUrl, label, sectionId || null);
  }, [playAudio]);

  // Model/Style selection state
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);

  // Character modal state
  const [isCreatingChar, setIsCreatingChar] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<BackendCharacter | null>(null);
  const [pendingImages, setPendingImages] = useState<File[]>([]);

  // Cleanup voice preview audio on unmount (not footer player - that's global now)
  useEffect(() => {
    return () => {
      // Clean up voice preview audio only
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      // Note: We no longer clear the footer audio player state here
      // Audio playback now persists across navigation via AudioPlayerContext
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
      // Map cast (from API with referenceImages) to characters (frontend format with imageUrl)
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const castData = (data as any).cast || [];
      const mappedCharacters = castData.map((c: any) => {
        const firstImage = c.referenceImages?.[0];
        return {
          id: c.id,
          name: c.name,
          description: c.description || '',
          imageUrl: firstImage ? `${API_BASE}${firstImage}` : `https://picsum.photos/seed/${c.id}/200/200`,
          stylePrompt: c.styleLora || undefined,
        };
      });

      const normalizedProject: BackendProject = {
        ...data,
        sections: (data.sections || []).map(section => ({
          ...section,
          sentences: section.sentences || [],
        })),
        characters: mappedCharacters,
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
      // Set model/style from project, or defaults
      setSelectedModelId(project.modelId || 'z-image-turbo');
      setSelectedStyleId(project.styleId || 'cinematic');
    }
  }, [project?.id]);

  // Update project settings on backend
  const handleUpdateProjectSettings = async (updates: { targetDuration?: number; visualStyle?: string; topic?: string; modelId?: string; styleId?: string }) => {
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

  // Handle model selection change
  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModelId(modelId);
    handleUpdateProjectSettings({ modelId });
  }, []);

  // Handle style selection change
  const handleStyleChange = useCallback((styleId: string) => {
    setSelectedStyleId(styleId);
    // Also update legacy visualStyle field for backward compatibility
    const style = styles.find(s => s.id === styleId);
    handleUpdateProjectSettings({
      styleId,
      visualStyle: style?.name || styleId,
    });
  }, [styles]);

  // Handle script generation using Deepseek backend API
  // Uses sync API for scripts <=15 min, async Inngest for >15 min
  const handleGenerateScript = async () => {
    if (!project || !concept.trim()) return;

    const currentProjectId = project.id;
    const useAsyncGeneration = targetDuration > 15;

    try {
      setIsGenerating(true);
      console.log('[ScriptEditor] Starting script generation for project:', currentProjectId,
        useAsyncGeneration ? '(async via Inngest)' : '(sync)');

      if (useAsyncGeneration) {
        // Long-form generation via Inngest (>15 min)
        const jobResult = await scriptsApi.generateLong(currentProjectId, {
          topic: concept,
          targetDurationMinutes: targetDuration,
          visualStyle: visualStyle.toLowerCase(),
          mode: 'auto',
        });

        console.log('[ScriptEditor] Long-form job started:', jobResult.jobId);

        // Initialize progress state
        setGenerationProgress({
          isActive: true,
          currentSection: 0,
          totalSections: jobResult.totalSections,
          currentSectionTitle: 'Starting...',
          percentComplete: 0,
          sectionsCompleted: [],
        });

        // Track completed section count to detect new completions
        let lastCompletedCount = 0;

        // Subscribe to SSE progress updates
        const cleanup = scriptsApi.subscribeToProgress(currentProjectId, {
          onProgress: async (data) => {
            console.log('[ScriptEditor] Generation progress:', data);
            setGenerationProgress({
              isActive: true,
              currentSection: data.currentSection || 0,
              totalSections: data.totalSections || jobResult.totalSections,
              currentSectionTitle: data.currentSectionTitle || 'Generating...',
              percentComplete: data.percentComplete || 0,
              sectionsCompleted: data.sectionsCompleted || [],
            });

            // Refetch project data when a new section completes
            // This makes sections appear progressively as they're generated
            const completedCount = data.sectionsCompleted?.length || 0;
            if (completedCount > lastCompletedCount) {
              lastCompletedCount = completedCount;
              console.log('[ScriptEditor] New section completed, refetching project data...');
              try {
                const updatedProject = await projectsApi.get(currentProjectId);
                const normalizedProject: BackendProject = {
                  ...updatedProject,
                  sections: (updatedProject.sections || []).map(section => ({
                    ...section,
                    sentences: section.sentences || [],
                  })),
                };
                setProject(normalizedProject);
              } catch (err) {
                console.error('[ScriptEditor] Failed to refetch project during progress:', err);
              }
            }
          },
          onComplete: async (data) => {
            console.log('[ScriptEditor] Generation complete:', data);
            setGenerationProgress(null);
            progressCleanupRef.current = null;

            // Reload the project to get the generated content
            const updatedProject = await projectsApi.get(currentProjectId);
            const normalizedProject: BackendProject = {
              ...updatedProject,
              sections: (updatedProject.sections || []).map(section => ({
                ...section,
                sentences: section.sentences || [],
              })),
            };
            setProject(normalizedProject);
            setIsGenerating(false);
            setToast({ message: `Script generated: ${data.totalSections} sections, ${data.totalSentences} sentences!`, type: 'success' });
            setTimeout(() => setToast(null), 5000);
          },
          onError: (error) => {
            console.error('[ScriptEditor] Generation error:', error);
            setGenerationProgress(null);
            progressCleanupRef.current = null;
            setIsGenerating(false);
            setToast({ message: `Generation failed: ${error}`, type: 'error' });
            setTimeout(() => setToast(null), 8000);
          },
        });

        progressCleanupRef.current = cleanup;
        // Note: isGenerating stays true until onComplete/onError

      } else {
        // Short-form generation (<=15 min) - synchronous
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

        setProject(normalizedProject);
        setToast({ message: 'Script generated successfully!', type: 'success' });
        setTimeout(() => setToast(null), 5000);
        setIsGenerating(false);
      }

    } catch (err) {
      console.error('[ScriptEditor] Failed to generate script:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setToast({ message: `Failed to generate script: ${errorMessage}`, type: 'error' });
      setTimeout(() => setToast(null), 8000);
      setIsGenerating(false);
      setGenerationProgress(null);
    }
  };

  // Cleanup SSE subscription on unmount
  useEffect(() => {
    return () => {
      if (progressCleanupRef.current) {
        progressCleanupRef.current();
      }
    };
  }, []);

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
        await projectsApi.addCast(project.id, character.id);
        // Use the character passed in (already in correct format with imageUrl)
        // instead of relying on API response format
        setProject({ ...project, characters: [...(project.characters || []), character] });
      }
    } catch (e) {
      console.error(e);
      setToast({ message: 'Failed to update cast', type: 'error' });
    } finally { setIsSaving(false); }
  };

  // Character creation handler
  const handleCreateCharacter = useCallback(async (data: CharacterFormData) => {
    const result = await createCharacter({
      name: data.name,
      description: data.description || undefined,
      styleLora: data.styleLora || undefined,
    });

    if (result) {
      // Upload any pending images
      if (pendingImages.length > 0) {
        for (const file of pendingImages) {
          await uploadImage(result.id, file);
        }
        await refetchCharacters();
      }

      setIsCreatingChar(false);
      setPendingImages([]);
      setToast({ message: `"${result.name}" created successfully`, type: 'success' });
      setTimeout(() => setToast(null), 4000);
    } else {
      setToast({ message: 'Failed to create character', type: 'error' });
      setTimeout(() => setToast(null), 4000);
    }
  }, [createCharacter, pendingImages, uploadImage, refetchCharacters]);

  // Character update handler
  const handleUpdateCharacter = useCallback(async (data: CharacterFormData) => {
    if (!editingCharacter) return;

    const result = await updateCharacter(editingCharacter.id, {
      name: data.name,
      description: data.description || undefined,
      styleLora: data.styleLora || undefined,
    });

    if (result) {
      setEditingCharacter(null);
      setToast({ message: `"${result.name}" updated successfully`, type: 'success' });
      setTimeout(() => setToast(null), 4000);
    } else {
      setToast({ message: 'Failed to update character', type: 'error' });
      setTimeout(() => setToast(null), 4000);
    }
  }, [editingCharacter, updateCharacter]);

  // Character delete handler
  const handleDeleteCharacter = useCallback(async () => {
    if (!editingCharacter) return;

    const success = await deleteCharacter(editingCharacter.id);
    if (success) {
      const name = editingCharacter.name;
      setEditingCharacter(null);
      setToast({ message: `"${name}" deleted successfully`, type: 'success' });
      setTimeout(() => setToast(null), 4000);
    } else {
      setToast({ message: 'Failed to delete character', type: 'error' });
      setTimeout(() => setToast(null), 4000);
    }
  }, [editingCharacter, deleteCharacter]);

  // Character image upload handler
  const handleUploadCharacterImage = useCallback(async (file: File) => {
    if (!editingCharacter) return;

    const result = await uploadImage(editingCharacter.id, file);
    if (result) {
      await refetchCharacters();
      // Update editingCharacter with new image
      const updated = backendCharacters.find(c => c.id === editingCharacter.id);
      if (updated) {
        setEditingCharacter(updated);
      }
    } else {
      setToast({ message: 'Failed to upload image', type: 'error' });
      setTimeout(() => setToast(null), 4000);
    }
  }, [editingCharacter, uploadImage, refetchCharacters, backendCharacters]);

  // Character image remove handler
  const handleRemoveCharacterImage = useCallback(async (index: number) => {
    if (!editingCharacter) return;

    const success = await deleteImage(editingCharacter.id, index);
    if (success) {
      await refetchCharacters();
      const updated = backendCharacters.find(c => c.id === editingCharacter.id);
      if (updated) {
        setEditingCharacter(updated);
      }
    } else {
      setToast({ message: 'Failed to remove image', type: 'error' });
      setTimeout(() => setToast(null), 4000);
    }
  }, [editingCharacter, deleteImage, refetchCharacters, backendCharacters]);

  // Keep editingCharacter synced with backendCharacters list
  useEffect(() => {
    if (editingCharacter) {
      const updated = backendCharacters.find(c => c.id === editingCharacter.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(editingCharacter)) {
        setEditingCharacter(updated);
      }
    }
  }, [backendCharacters, editingCharacter]);

  // Convert backend characters to library format for display
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const libraryCharsFromBackend: Character[] = useMemo(() =>
    backendCharacters.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description || '',
      imageUrl: c.referenceImages?.[0] ? `${API_BASE}${c.referenceImages[0]}` : `https://picsum.photos/seed/${c.id}/200/200`,
      stylePrompt: c.styleLora || undefined,
    })), [backendCharacters]);

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
            // New model/style props
            models={models}
            styles={styles}
            selectedModelId={selectedModelId}
            selectedStyleId={selectedStyleId}
            onModelChange={handleModelChange}
            onStyleChange={handleStyleChange}
            modelsLoading={modelsLoading}
            stylesLoading={stylesLoading}
            // Legacy props
            visualStyle={visualStyle}
            setVisualStyle={setVisualStyle}
            onUpdateVisualStyle={(visualStyle) => handleUpdateProjectSettings({ visualStyle })}
            projectCharacters={project.characters || []}
            useSearch={useSearch}
            setUseSearch={setUseSearch}
            isGenerating={isGenerating}
            generationProgress={generationProgress}
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

              {/* Audio Generation Toolbar */}
              {(project.sections || []).length > 0 && (
                <AudioToolbar
                  isGenerating={isAudioGenerating}
                  isLoading={isAudioLoading}
                  dirtySentenceCount={dirtySentenceCount}
                  totalPending={audioTotalPending}
                  completedCount={audioCompletedCount}
                  failedCount={audioFailedCount}
                  overallProgress={audioOverallProgress}
                  mode={audioMode}
                  onModeChange={setAudioMode}
                  onGenerateAll={generateAllAudio}
                  onCancelAll={cancelAllAudio}
                  onForceRegenerate={forceRegenerateAudio}
                  error={audioError}
                />
              )}

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
                      getSentenceAudioState={getAudioSentenceStatus}
                      onPlayAudio={handlePlayAudio}
                      onRegenerateAudio={generateSectionAudio}
                      // Karaoke sync props
                      currentAudioTimeMs={audioCurrentTimeMs}
                      isAudioPlaying={isAudioPlaying}
                      activeSectionId={activeSectionId}
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
            libraryCharacters={libraryCharsFromBackend.length > 0 ? libraryCharsFromBackend : libraryCharacters}
            backendCharacters={backendCharacters}
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
            onCreateCharacter={handleCreateCharacter}
            pendingImages={pendingImages}
            onPendingImagesChange={setPendingImages}
            editingCharacter={editingCharacter}
            setEditingCharacter={setEditingCharacter}
            onUpdateCharacter={handleUpdateCharacter}
            onDeleteCharacter={handleDeleteCharacter}
            onUploadImage={handleUploadCharacterImage}
            onRemoveImage={handleRemoveCharacterImage}
          />
        )}

        {/* Audio player is now rendered globally in Layout.tsx for persistent playback */}
      </div>
    </ScriptEditorErrorBoundary>
  );
};

export default ScriptEditorV2;
