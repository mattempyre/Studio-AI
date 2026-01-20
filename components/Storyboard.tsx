
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as Icons from './Icons';
import { Project, Scene } from '../types';
import { Button } from './ui/button';
import { BulkGenerationToolbar } from './Storyboard/BulkGenerationToolbar';
import { ImageEditModal } from './Storyboard/ImageEditModal';
import { MediaToggle, type MediaView } from './Storyboard/MediaToggle';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const JOB_POLL_INTERVAL = 2000; // 2 seconds

interface StoryboardProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
  onNext: () => void;
  /** Called when an image completes generating - for real-time UI updates */
  onImageComplete?: (sentenceId: string, imageFile: string) => void;
  /** Called when a video completes generating - for real-time UI updates */
  onVideoComplete?: (sentenceId: string, videoFile: string) => void;
  /** Called when all generation completes */
  onGenerationComplete?: () => void;
}

const Storyboard: React.FC<StoryboardProps> = ({ project, onUpdateProject, onNext, onImageComplete, onVideoComplete, onGenerationComplete }) => {
  const [selectedSceneId, setSelectedSceneId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [generatingImages, setGeneratingImages] = useState<Set<string>>(new Set());
  const [generatingVideos, setGeneratingVideos] = useState<Set<string>>(new Set());
  // Track expanded prompts by scene ID (format: "sceneId-image" or "sceneId-video")
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());
  // Image edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // Track jobIds for regenerating images (sceneId -> jobId)
  const [regeneratingJobs, setRegeneratingJobs] = useState<Map<string, string>>(new Map());
  // STORY-5-4: Track jobIds for regenerating videos (sceneId -> jobId)
  const [regeneratingVideoJobs, setRegeneratingVideoJobs] = useState<Map<string, string>>(new Map());
  // STORY-5-4: Per-scene media tab state (sceneId -> 'image' | 'video')
  const [activeMediaTabs, setActiveMediaTabs] = useState<Map<string, MediaView>>(new Map());
  // STORY-5-4: Global media view override (null = no override)
  const [globalMediaView, setGlobalMediaView] = useState<MediaView | null>(null);
  // STORY-5-4: Set of scene IDs that have been manually toggled (ignore global override)
  const [perCardOverrides, setPerCardOverrides] = useState<Set<string>>(new Set());

  const togglePromptExpanded = (sceneId: string, type: 'image' | 'video') => {
    const key = `${sceneId}-${type}`;
    setExpandedPrompts(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isPromptExpanded = (sceneId: string, type: 'image' | 'video') => {
    return expandedPrompts.has(`${sceneId}-${type}`);
  };

  // STORY-5-4: Get effective media view for a scene
  // Returns: 'video' if video exists (default), else 'image'
  // Respects: global override, then per-card state, then per-card manual override
  const getEffectiveMediaView = useCallback((scene: Scene): MediaView => {
    const hasImage = !!scene.imageUrl;
    const hasVideo = !!scene.videoUrl;
    const isVideoGenerating = generatingVideos.has(scene.id);

    // Check for per-card manual override (ignores global)
    if (perCardOverrides.has(scene.id)) {
      const perCardView = activeMediaTabs.get(scene.id);
      if (perCardView) {
        // Validate the view is available
        if (perCardView === 'video' && (hasVideo || isVideoGenerating)) return 'video';
        if (perCardView === 'image' && hasImage) return 'image';
      }
    }

    // Check global override
    if (globalMediaView !== null) {
      // Global view overrides, but fallback if content not available
      if (globalMediaView === 'video') {
        return (hasVideo || isVideoGenerating) ? 'video' : 'image';
      }
      return hasImage ? 'image' : 'video';
    }

    // Check per-card state (no override set)
    const perCardView = activeMediaTabs.get(scene.id);
    if (perCardView) {
      // Validate the view is available
      if (perCardView === 'video' && (hasVideo || isVideoGenerating)) return 'video';
      if (perCardView === 'image' && hasImage) return 'image';
    }

    // Default: show video if exists, otherwise image (AC: 9)
    if (hasVideo) return 'video';
    return 'image';
  }, [activeMediaTabs, globalMediaView, perCardOverrides, generatingVideos]);

  // STORY-5-4: Handle per-card media tab change
  const handleMediaTabChange = useCallback((sceneId: string, view: MediaView) => {
    // Set per-card state
    setActiveMediaTabs(prev => new Map(prev).set(sceneId, view));

    // If global override is set, add to per-card overrides (AC: 18)
    if (globalMediaView !== null) {
      setPerCardOverrides(prev => new Set(prev).add(sceneId));
    }
  }, [globalMediaView]);

  // STORY-5-4: Handle global media toggle
  const handleGlobalMediaToggle = useCallback((view: MediaView | null) => {
    setGlobalMediaView(view);
    // Clear per-card overrides when changing global toggle
    if (view !== null) {
      setPerCardOverrides(new Set());
    }
  }, []);

  // STORY-5-4: Debounced auto-save for video prompt (AC: 19-21)
  const debouncedVideoPromptSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savingVideoPrompt, setSavingVideoPrompt] = useState(false);

  // Use a ref to access the latest project state inside async functions without stale closures
  const projectRef = useRef(project);
  useEffect(() => {
      projectRef.current = project;
  }, [project]);

  // Refs for scene elements in the main content area (for smooth scrolling)
  const sceneRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Define activeScene and updateScene early so they can be used in callbacks below
  const activeScene = project.scenes.find(s => s.id === selectedSceneId) || project.scenes[0];

  const updateScene = useCallback((field: keyof Scene, value: any) => {
      const updatedScenes = project.scenes.map(s =>
          s.id === selectedSceneId ? { ...s, [field]: value } : s
      );
      onUpdateProject({ ...project, scenes: updatedScenes });
  }, [project, selectedSceneId, onUpdateProject]);

  // STORY-5-4: Debounced auto-save for video prompt (AC: 19-21)
  const handleVideoPromptChange = useCallback((value: string) => {
    if (!activeScene) return;

    // Update local state immediately for responsive UI
    updateScene('videoPrompt', value);

    // Clear any pending save
    if (debouncedVideoPromptSave.current) {
      clearTimeout(debouncedVideoPromptSave.current);
    }

    // Debounce the API call (500ms delay)
    debouncedVideoPromptSave.current = setTimeout(async () => {
      try {
        setSavingVideoPrompt(true);
        const response = await fetch(`${API_BASE}/api/v1/sentences/${activeScene.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoPrompt: value }),
        });

        if (!response.ok) {
          console.error('Failed to save video prompt');
        }
      } catch (err) {
        console.error('Error saving video prompt:', err);
      } finally {
        setSavingVideoPrompt(false);
      }
    }, 500);
  }, [activeScene, updateScene]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debouncedVideoPromptSave.current) {
        clearTimeout(debouncedVideoPromptSave.current);
      }
    };
  }, []);

  // Handle selecting a scene and scrolling to it smoothly
  const handleSelectScene = (sceneId: string) => {
    setSelectedSceneId(sceneId);
    const element = sceneRefs.current.get(sceneId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Set initial selected scene if not set
  useEffect(() => {
    if (!selectedSceneId && project.scenes.length > 0) {
      setSelectedSceneId(project.scenes[0].id);
    }
  }, [project.scenes, selectedSceneId]);

  // Helper to handle image generation completion
  const handleImageCompleteInternal = useCallback((sceneId: string, imageFile: string) => {
    // Clear generating state
    setGeneratingImages(prev => {
      const next = new Set(prev);
      next.delete(sceneId);
      return next;
    });
    // Clear job tracking
    setRegeneratingJobs(prev => {
      const next = new Map(prev);
      next.delete(sceneId);
      return next;
    });
    // Call parent's onImageComplete which updates backendProject state in routes.tsx
    // This triggers a re-render with the new imageUrl (with cache-busting timestamp)
    onImageComplete?.(sceneId, imageFile);
  }, [onImageComplete]);

  // Helper to handle image generation failure
  const handleImageFailed = useCallback((sceneId: string, error: string) => {
    setGeneratingImages(prev => {
      const next = new Set(prev);
      next.delete(sceneId);
      return next;
    });
    setRegeneratingJobs(prev => {
      const next = new Map(prev);
      next.delete(sceneId);
      return next;
    });
    console.error(`Image generation failed for ${sceneId}:`, error);
  }, []);

  // STORY-5-4: Helper to handle video generation completion
  const handleVideoCompleteInternal = useCallback((sceneId: string, videoFile: string) => {
    // Clear generating state
    setGeneratingVideos(prev => {
      const next = new Set(prev);
      next.delete(sceneId);
      return next;
    });
    // Clear job tracking
    setRegeneratingVideoJobs(prev => {
      const next = new Map(prev);
      next.delete(sceneId);
      return next;
    });
    // Call parent's onVideoComplete which updates backendProject state in routes.tsx
    onVideoComplete?.(sceneId, videoFile);
  }, [onVideoComplete]);

  // STORY-5-4: Helper to handle video generation failure
  const handleVideoFailed = useCallback((sceneId: string, error: string) => {
    setGeneratingVideos(prev => {
      const next = new Set(prev);
      next.delete(sceneId);
      return next;
    });
    setRegeneratingVideoJobs(prev => {
      const next = new Map(prev);
      next.delete(sceneId);
      return next;
    });
    console.error(`Video generation failed for ${sceneId}:`, error);
  }, []);

  // Poll for job completion (single image regeneration)
  useEffect(() => {
    if (regeneratingJobs.size === 0) return;

    const pollJobStatus = async () => {
      for (const [sceneId, jobId] of regeneratingJobs) {
        try {
          const response = await fetch(`${API_BASE}/api/v1/jobs/${jobId}`);
          if (!response.ok) continue;

          const data = await response.json();
          const job = data.data;

          if (job.status === 'completed' && job.resultFile) {
            handleImageCompleteInternal(sceneId, job.resultFile);
          } else if (job.status === 'failed') {
            handleImageFailed(sceneId, job.errorMessage || 'Image generation failed');
          }
        } catch (err) {
          console.error('Failed to poll job status:', err);
        }
      }
    };

    // Poll immediately, then at intervals
    pollJobStatus();
    const intervalId = setInterval(pollJobStatus, JOB_POLL_INTERVAL);
    return () => clearInterval(intervalId);
  }, [regeneratingJobs, handleImageCompleteInternal, handleImageFailed]);

  // STORY-5-4: Poll for video job completion
  useEffect(() => {
    if (regeneratingVideoJobs.size === 0) return;

    const pollVideoJobStatus = async () => {
      for (const [sceneId, jobId] of regeneratingVideoJobs) {
        try {
          const response = await fetch(`${API_BASE}/api/v1/jobs/${jobId}`);
          if (!response.ok) continue;

          const data = await response.json();
          const job = data.data;

          if (job.status === 'completed' && job.resultFile) {
            handleVideoCompleteInternal(sceneId, job.resultFile);
          } else if (job.status === 'failed') {
            handleVideoFailed(sceneId, job.errorMessage || 'Video generation failed');
          }
        } catch (err) {
          console.error('Failed to poll video job status:', err);
        }
      }
    };

    // Poll immediately, then at intervals
    pollVideoJobStatus();
    const intervalId = setInterval(pollVideoJobStatus, JOB_POLL_INTERVAL);
    return () => clearInterval(intervalId);
  }, [regeneratingVideoJobs, handleVideoCompleteInternal, handleVideoFailed]);

  // Regenerate image for the active scene using backend ComfyUI API
  const handleRegenerateImage = async () => {
      if (!activeScene || generatingImages.has(activeScene.id)) return;

      const sceneId = activeScene.id;
      setGeneratingImages(prev => new Set(prev).add(sceneId));
      try {
          const prompt = activeScene.imagePrompt || activeScene.narration;
          const response = await fetch(`${API_BASE}/api/v1/sentences/${sceneId}/generate-image`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  prompt,
                  style: activeScene.visualStyle || 'z-image-turbo',
                  useImageToImage: false, // Use text-to-image for regeneration
              }),
          });

          if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
              throw new Error(errorData.error?.message || 'Failed to start image generation');
          }

          // Get jobId from response for polling fallback
          const result = await response.json();
          const jobId = result.data?.jobId;
          if (jobId) {
              setRegeneratingJobs(prev => new Map(prev).set(sceneId, jobId));
          }

          // Job is queued - WebSocket or polling will handle completion
      } catch (e) {
          console.error("Image generation failed", e);
          alert(`Failed to generate image: ${e instanceof Error ? e.message : 'Unknown error'}`);
          // Only clear generating state on error - success is handled by WebSocket/polling
          setGeneratingImages(prev => {
              const next = new Set(prev);
              next.delete(sceneId);
              return next;
          });
      }
  };

  // STORY-5-4: Generate video using backend API (AC: 22-29)
  const handleGenerateVideo = async () => {
      if (!activeScene || generatingVideos.has(activeScene.id)) return;

      // AC: 23 - Button disabled if selected sentence has no imageFile
      if (!activeScene.imageUrl) {
          alert('Please generate an image first before generating video.');
          return;
      }

      const sceneId = activeScene.id;
      setGeneratingVideos(prev => new Set(prev).add(sceneId));

      try {
          const response = await fetch(`${API_BASE}/api/v1/sentences/${sceneId}/generate-video`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  prompt: activeScene.videoPrompt || activeScene.imagePrompt || activeScene.narration,
                  cameraMovement: activeScene.cameraMovement,
                  motionStrength: activeScene.motionStrength,
              }),
          });

          if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
              throw new Error(errorData.error?.message || 'Failed to start video generation');
          }

          // Get jobId from response for polling fallback
          const result = await response.json();
          const jobId = result.data?.jobId;
          if (jobId) {
              setRegeneratingVideoJobs(prev => new Map(prev).set(sceneId, jobId));
          }

          // Job is queued - WebSocket or polling will handle completion
          // Auto-switch to video tab to show generating state
          handleMediaTabChange(sceneId, 'video');
      } catch (e) {
          console.error("Video generation failed", e);
          alert(`Failed to generate video: ${e instanceof Error ? e.message : 'Unknown error'}`);
          // Only clear generating state on error - success is handled by WebSocket/polling
          setGeneratingVideos(prev => {
              const next = new Set(prev);
              next.delete(sceneId);
              return next;
          });
      }
  };

  // Group scenes by Script Section ID
  const scenesBySection = project.script.map(section => ({
    section,
    scenes: project.scenes.filter(scene => scene.scriptSectionId === section.id)
  })).filter(group => group.scenes.length > 0);

  const orphanedScenes = project.scenes.filter(
    scene => !project.script.find(s => s.id === scene.scriptSectionId)
  );

  return (
    <div className="flex-1 flex overflow-hidden font-display bg-background-dark">
      {/* Sidebar - Scene List */}
      <aside className="w-72 flex flex-col border-r border-border-color bg-[#0d0b1a] overflow-y-auto custom-scrollbar flex-shrink-0">
        <div className="p-4 border-b border-white/5">
          <Button variant="outline" className="w-full">
            <Icons.Wand2 size={16} />
            Generate Scenes From Script
          </Button>
        </div>
        
        <div className="p-4 flex flex-col gap-6">
            {scenesBySection.map((group, groupIdx) => (
                <div key={group.section.id} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 px-2">
                        <span className="text-[10px] font-bold bg-white/10 text-white/70 px-1.5 py-0.5 rounded">
                            {String(groupIdx + 1).padStart(2, '0')}
                        </span>
                        <h4 className="text-[10px] text-text-muted font-bold uppercase tracking-wider truncate">
                            {group.section.title}
                        </h4>
                    </div>

                    <div className="flex flex-col gap-1.5 pl-2 border-l border-white/5 ml-3">
                        {group.scenes.map((scene, idx) => (
                            <div
                                key={scene.id}
                                onClick={() => handleSelectScene(scene.id)}
                                className={`p-2 rounded-lg flex gap-3 cursor-pointer transition-colors border relative ${
                                    selectedSceneId === scene.id
                                    ? 'bg-primary/10 border-primary/30'
                                    : 'hover:bg-white/5 border-transparent'
                                }`}
                            >
                                <div 
                                    className="w-16 aspect-video bg-cover bg-center rounded-none border border-white/10 flex-shrink-0 relative overflow-hidden bg-black" 
                                >
                                    {scene.imageUrl ? (
                                        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${scene.imageUrl})` }} />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center bg-white/5">
                                            <Icons.RefreshCw size={12} className="text-white/20 animate-spin" />
                                        </div>
                                    )}
                                    {scene.videoUrl && (
                                         <div className="absolute top-0.5 right-0.5 bg-black/50 rounded-full p-0.5">
                                            <Icons.Video size={8} className="text-white"/>
                                         </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <p className={`text-[11px] leading-tight line-clamp-2 ${selectedSceneId === scene.id ? 'text-white font-medium' : 'text-text-muted'}`}>
                                        {scene.narration}
                                    </p>
                                </div>
                                {selectedSceneId === scene.id && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-6 bg-primary rounded-r-full"></div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {orphanedScenes.length > 0 && (
                <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-white/5">
                     <h4 className="text-[10px] text-text-muted font-bold uppercase tracking-wider px-2">Unassigned Scenes</h4>
                     {orphanedScenes.map((scene) => (
                        <div
                            key={scene.id}
                            onClick={() => handleSelectScene(scene.id)}
                            className={`p-2 rounded-lg flex items-center gap-3 cursor-pointer transition-colors border ${
                                selectedSceneId === scene.id
                                ? 'bg-primary/10 border-primary/30'
                                : 'hover:bg-white/5 border-transparent'
                            }`}
                        >
                            <div 
                                className="w-16 aspect-video bg-cover bg-center rounded-none border border-white/10 flex-shrink-0" 
                                style={{ backgroundImage: `url(${scene.imageUrl})` }}
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate text-white">Scene</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </aside>

      {/* Main Content - Preview Grid */}
      <section className="flex-1 flex flex-col bg-panel-bg overflow-hidden relative">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-color bg-background-dark/50 backdrop-blur-md z-10">
            <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold">Storyboard Flow</h3>
            <div className="flex items-center bg-[#1e1933] rounded-lg p-1 border border-white/5">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all ${viewMode === 'table' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-text-muted hover:bg-white/5 hover:text-white'}`}
                >
                  <Icons.List size={12}/> TABLE
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all ${viewMode === 'grid' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-text-muted hover:bg-white/5 hover:text-white'}`}
                >
                  <Icons.Grid size={12}/> GRID
                </button>
            </div>

            {/* STORY-5-4: Global Media Toggle (AC: 12-18) */}
            <div className="flex items-center bg-[#1e1933] rounded-lg p-1 border border-white/5">
                <button
                  onClick={() => handleGlobalMediaToggle(globalMediaView === 'image' ? null : 'image')}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all ${globalMediaView === 'image' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-text-muted hover:bg-white/5 hover:text-white'}`}
                  title="Show all images (override per-card tabs)"
                >
                  <Icons.ImageIcon size={12}/> IMAGES
                </button>
                <button
                  onClick={() => handleGlobalMediaToggle(globalMediaView === 'video' ? null : 'video')}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all ${globalMediaView === 'video' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-text-muted hover:bg-white/5 hover:text-white'}`}
                  title="Show all videos (override per-card tabs)"
                >
                  <Icons.Video size={12}/> VIDEOS
                </button>
            </div>
            </div>

            {/* Bulk Scene Generation Toolbar - STORY-4-4 */}
            <BulkGenerationToolbar
              projectId={project.id}
              onImageComplete={onImageComplete}
              onVideoComplete={onVideoComplete}
              onGenerationComplete={onGenerationComplete}
            />
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar">
            {scenesBySection.map((group) => (
                <div key={group.section.id}>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="h-px flex-1 bg-white/5"></div>
                        <span className="text-xs font-bold text-text-muted uppercase tracking-widest">{group.section.title}</span>
                        <div className="h-px flex-1 bg-white/5"></div>
                    </div>
                    
                    {viewMode === 'table' ? (
                      /* Table / List View */
                      <div className="flex flex-col gap-4">
                          {group.scenes.map((scene, idx) => (
                              <div
                                  key={scene.id}
                                  ref={(el) => {
                                    if (el) sceneRefs.current.set(scene.id, el);
                                    else sceneRefs.current.delete(scene.id);
                                  }}
                                  className={`flex gap-4 group transition-all duration-300 ${
                                      selectedSceneId === scene.id ? 'opacity-100' : 'opacity-80 hover:opacity-100'
                                  }`}
                              >
                                  <div className="w-8 flex flex-col items-center pt-2">
                                      <div 
                                          onClick={() => setSelectedSceneId(scene.id)}
                                          className={`size-6 rounded-full border flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors ${selectedSceneId === scene.id ? 'bg-primary border-primary text-white' : 'bg-[#1e1933] border-white/10 text-text-muted'}`}
                                      >
                                          {idx + 1}
                                      </div>
                                      <div className="flex-1 w-[1px] bg-white/5 mt-2"></div>
                                  </div>
                                  
                                  <div 
                                      onClick={() => setSelectedSceneId(scene.id)}
                                      className={`flex-1 flex bg-card-bg border rounded-xl overflow-hidden transition-all cursor-pointer ${selectedSceneId === scene.id ? 'border-primary/50 ring-2 ring-primary/20 shadow-2xl' : 'border-border-color hover:border-primary/30'}`}
                                  >
                                      <div className="flex-1 p-5 flex flex-col min-h-[180px]">
                                          <label className="text-[10px] text-text-muted font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                                              <Icons.Mic size={10} /> Narration
                                          </label>
                                          <textarea
                                              readOnly
                                              className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-sm leading-relaxed resize-none text-white/90"
                                              value={scene.narration}
                                          />

                                          {/* Prompt Display Section */}
                                          <div className="bg-[#1e1933]/50 rounded-md p-3 mt-3 space-y-2">
                                              {/* Image Prompt */}
                                              <div className="flex items-start gap-2">
                                                  <Icons.ImageIcon size={12} className="text-text-muted mt-0.5 shrink-0" />
                                                  <div className="flex-1 min-w-0">
                                                      <span className="text-text-muted text-[10px] uppercase tracking-wide mr-2">Image:</span>
                                                      {scene.imagePrompt ? (
                                                          <span
                                                              onClick={(e) => { e.stopPropagation(); togglePromptExpanded(scene.id, 'image'); }}
                                                              className={`text-white/70 text-xs font-mono cursor-pointer hover:text-white/90 transition-colors ${
                                                                  isPromptExpanded(scene.id, 'image') ? '' : 'line-clamp-2'
                                                              }`}
                                                              title={isPromptExpanded(scene.id, 'image') ? 'Click to collapse' : 'Click to expand'}
                                                          >
                                                              {scene.imagePrompt}
                                                          </span>
                                                      ) : (
                                                          <span className="text-text-muted italic text-xs">No prompt generated</span>
                                                      )}
                                                  </div>
                                              </div>

                                              {/* Video Prompt */}
                                              <div className="flex items-start gap-2">
                                                  <Icons.Video size={12} className="text-text-muted mt-0.5 shrink-0" />
                                                  <div className="flex-1 min-w-0">
                                                      <span className="text-text-muted text-[10px] uppercase tracking-wide mr-2">Video:</span>
                                                      {scene.videoPrompt ? (
                                                          <span
                                                              onClick={(e) => { e.stopPropagation(); togglePromptExpanded(scene.id, 'video'); }}
                                                              className={`text-white/70 text-xs font-mono cursor-pointer hover:text-white/90 transition-colors ${
                                                                  isPromptExpanded(scene.id, 'video') ? '' : 'line-clamp-2'
                                                              }`}
                                                              title={isPromptExpanded(scene.id, 'video') ? 'Click to collapse' : 'Click to expand'}
                                                          >
                                                              {scene.videoPrompt}
                                                          </span>
                                                      ) : (
                                                          <span className="text-text-muted italic text-xs">No prompt generated</span>
                                                      )}
                                                  </div>
                                              </div>

                                              {/* Camera Movement Badge */}
                                              <div className="flex items-center gap-2 pt-1">
                                                  <Icons.Camera size={10} className="text-text-muted" />
                                                  <span className="bg-[#1e1933] border border-white/10 px-2 py-0.5 rounded text-[10px] text-text-muted">
                                                      {scene.cameraMovement || 'static'}
                                                  </span>
                                              </div>
                                          </div>
                                      </div>
                                      {/* STORY-5-4: Media area with toggle */}
                                      <div className="w-80 border-l border-white/5 bg-black shrink-0 flex flex-col">
                                          <div className="aspect-video group/image relative flex items-center justify-center overflow-hidden">
                                              {(() => {
                                                  const effectiveView = getEffectiveMediaView(scene);
                                                  const showVideo = effectiveView === 'video' && scene.videoUrl;
                                                  const showImage = effectiveView === 'image' && scene.imageUrl;
                                                  const isVideoGen = generatingVideos.has(scene.id);

                                                  if (showVideo) {
                                                      return (
                                                          <video
                                                            src={scene.videoUrl}
                                                            className="w-full h-full object-cover"
                                                            controls={false}
                                                            muted
                                                            loop
                                                            onMouseEnter={(e) => e.currentTarget.play()}
                                                            onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                                                          />
                                                      );
                                                  } else if (showImage) {
                                                      return (
                                                          <>
                                                              <div className="absolute inset-0 bg-cover bg-center rounded-none" style={{ backgroundImage: `url(${scene.imageUrl})` }}></div>
                                                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover/image:opacity-100 transition-opacity flex items-end p-3">
                                                                  <p className="text-[10px] text-white/90 line-clamp-2">{scene.imagePrompt}</p>
                                                              </div>
                                                          </>
                                                      );
                                                  } else if (isVideoGen && effectiveView === 'video') {
                                                      return (
                                                          <div className="flex flex-col items-center gap-2 text-text-muted">
                                                              <Icons.RefreshCw className="animate-spin" size={24} />
                                                              <span className="text-[10px] font-bold uppercase tracking-wider">Generating Video...</span>
                                                          </div>
                                                      );
                                                  } else if (generatingImages.has(scene.id)) {
                                                      return (
                                                          <div className="flex flex-col items-center gap-2 text-text-muted">
                                                              <Icons.RefreshCw className="animate-spin" size={24} />
                                                              <span className="text-[10px] font-bold uppercase tracking-wider">Generating Image...</span>
                                                          </div>
                                                      );
                                                  } else {
                                                      return (
                                                          <div className="flex flex-col items-center gap-2 text-text-muted">
                                                              <Icons.ImageIcon size={24} />
                                                              <span className="text-[10px] font-bold uppercase tracking-wider">No Media</span>
                                                          </div>
                                                      );
                                                  }
                                              })()}
                                          </div>
                                          {/* Media Toggle Tabs (AC: 1-11) */}
                                          <div className="px-2 pb-2 flex justify-center">
                                              <MediaToggle
                                                  activeView={getEffectiveMediaView(scene)}
                                                  hasImage={!!scene.imageUrl}
                                                  hasVideo={!!scene.videoUrl}
                                                  isVideoGenerating={generatingVideos.has(scene.id)}
                                                  onViewChange={(view) => handleMediaTabChange(scene.id, view)}
                                                  size="sm"
                                              />
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                    ) : (
                      /* Grid View */
                      <div className="grid grid-cols-2 xl:grid-cols-3 gap-6">
                        {group.scenes.map((scene, idx) => (
                           <div
                              key={scene.id}
                              ref={(el) => {
                                if (el) sceneRefs.current.set(scene.id, el);
                                else sceneRefs.current.delete(scene.id);
                              }}
                              onClick={() => setSelectedSceneId(scene.id)}
                              className={`group relative flex flex-col bg-card-bg border rounded-xl overflow-hidden cursor-pointer transition-all ${
                                selectedSceneId === scene.id
                                ? 'border-primary ring-1 ring-primary shadow-lg shadow-primary/20 transform scale-[1.01]'
                                : 'border-border-color hover:border-primary/50 hover:shadow-xl'
                              }`}
                           >
                              {/* STORY-5-4: Image/Video Area with Toggle */}
                              <div className="bg-black flex flex-col">
                                  <div className="aspect-video relative flex items-center justify-center overflow-hidden">
                                      {(() => {
                                          const effectiveView = getEffectiveMediaView(scene);
                                          const showVideo = effectiveView === 'video' && scene.videoUrl;
                                          const showImage = effectiveView === 'image' && scene.imageUrl;
                                          const isVideoGen = generatingVideos.has(scene.id);

                                          if (showVideo) {
                                              return (
                                                  <video
                                                    src={scene.videoUrl}
                                                    className="w-full h-full object-cover"
                                                    muted
                                                    loop
                                                    onMouseEnter={(e) => e.currentTarget.play()}
                                                    onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                                                  />
                                              );
                                          } else if (showImage) {
                                              return (
                                                  <>
                                                      <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url(${scene.imageUrl})` }}></div>
                                                      <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                                                  </>
                                              );
                                          } else if (isVideoGen && effectiveView === 'video') {
                                              return (
                                                  <div className="flex flex-col items-center gap-2 text-text-muted z-10">
                                                      <Icons.RefreshCw className="animate-spin" size={24} />
                                                      <span className="text-[10px] font-bold uppercase tracking-wider">Generating Video...</span>
                                                  </div>
                                              );
                                          } else if (generatingImages.has(scene.id)) {
                                              return (
                                                  <div className="flex flex-col items-center gap-2 text-text-muted z-10">
                                                      <Icons.RefreshCw className="animate-spin" size={24} />
                                                      <span className="text-[10px] font-bold uppercase tracking-wider">Generating...</span>
                                                  </div>
                                              );
                                          } else {
                                              return (
                                                  <div className="flex flex-col items-center gap-2 text-text-muted z-10">
                                                      <Icons.ImageIcon size={24} />
                                                      <span className="text-[10px] font-bold uppercase tracking-wider">No Media</span>
                                                  </div>
                                              );
                                          }
                                      })()}

                                      {/* Badge */}
                                      <div className={`absolute top-2 left-2 size-6 rounded-full flex items-center justify-center text-[10px] font-bold z-10 ${
                                          selectedSceneId === scene.id ? 'bg-primary text-white' : 'bg-black/60 text-white backdrop-blur-md'
                                      }`}>
                                          {idx + 1}
                                      </div>

                                      {/* Overlay Controls */}
                                      {(scene.imageUrl || scene.videoUrl) && (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 backdrop-blur-[1px]">
                                            <button className="bg-black/50 hover:bg-primary text-white rounded-full p-2 transition-colors transform translate-y-2 group-hover:translate-y-0">
                                                <Icons.Maximize2 size={16} />
                                            </button>
                                        </div>
                                      )}
                                  </div>
                                  {/* Media Toggle Tabs (AC: 1-11) */}
                                  <div className="px-2 pb-1 flex justify-center">
                                      <MediaToggle
                                          activeView={getEffectiveMediaView(scene)}
                                          hasImage={!!scene.imageUrl}
                                          hasVideo={!!scene.videoUrl}
                                          isVideoGenerating={generatingVideos.has(scene.id)}
                                          onViewChange={(view) => handleMediaTabChange(scene.id, view)}
                                          size="sm"
                                      />
                                  </div>
                              </div>

                              {/* Content */}
                              <div className="p-4 flex flex-col gap-3 flex-1">
                                  <div className="flex items-center justify-between">
                                      <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
                                          <Icons.Mic size={10} /> Narration
                                      </span>
                                  </div>
                                  <p className="text-[12px] text-white/90 line-clamp-3 leading-relaxed font-medium">
                                      {scene.narration}
                                  </p>

                                  {/* Prompt Display Section */}
                                  <div className="bg-[#1e1933]/50 rounded-md p-2 space-y-1.5">
                                      {/* Image Prompt */}
                                      <div className="flex items-start gap-1.5">
                                          <Icons.ImageIcon size={10} className="text-text-muted mt-0.5 shrink-0" />
                                          {scene.imagePrompt ? (
                                              <p
                                                  onClick={(e) => { e.stopPropagation(); togglePromptExpanded(scene.id, 'image'); }}
                                                  className={`text-[11px] text-white/60 font-mono cursor-pointer hover:text-white/80 transition-colors ${
                                                      isPromptExpanded(scene.id, 'image') ? '' : 'line-clamp-2'
                                                  }`}
                                                  title={isPromptExpanded(scene.id, 'image') ? 'Click to collapse' : 'Click to expand'}
                                              >
                                                  {scene.imagePrompt}
                                              </p>
                                          ) : (
                                              <p className="text-[11px] italic text-text-muted">No prompt generated</p>
                                          )}
                                      </div>
                                      {/* Video Prompt */}
                                      <div className="flex items-start gap-1.5">
                                          <Icons.Video size={10} className="text-text-muted mt-0.5 shrink-0" />
                                          {scene.videoPrompt ? (
                                              <p
                                                  onClick={(e) => { e.stopPropagation(); togglePromptExpanded(scene.id, 'video'); }}
                                                  className={`text-[11px] text-white/60 font-mono cursor-pointer hover:text-white/80 transition-colors ${
                                                      isPromptExpanded(scene.id, 'video') ? '' : 'line-clamp-2'
                                                  }`}
                                                  title={isPromptExpanded(scene.id, 'video') ? 'Click to collapse' : 'Click to expand'}
                                              >
                                                  {scene.videoPrompt}
                                              </p>
                                          ) : (
                                              <p className="text-[11px] italic text-text-muted">No prompt generated</p>
                                          )}
                                      </div>
                                  </div>

                                  <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-text-muted">
                                     <div className="flex items-center gap-1.5">
                                        <Icons.Camera size={10} />
                                        <span>{scene.cameraMovement || 'static'}</span>
                                     </div>
                                     <div className="flex items-center gap-1.5">
                                        <Icons.Film size={10} />
                                        <span>{scene.visualStyle}</span>
                                     </div>
                                  </div>
                              </div>
                           </div>
                        ))}
                      </div>
                    )}
                </div>
            ))}
        </div>
      </section>

      {/* Right Panel - Inspector */}
      <aside className="w-80 border-l border-border-color bg-[#0d0b1a] flex flex-col h-full flex-shrink-0">
        <div className="px-6 py-4 border-b border-border-color flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2">
                <Icons.Settings className="text-primary" size={18} />
                Scene Inspector
            </h3>
        </div>
        
        {activeScene && (
            <>
                <div className="flex border-b border-white/5 px-6">
                    <button 
                        onClick={() => setActiveTab('image')}
                        className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'image' ? 'text-white border-primary' : 'text-text-muted border-transparent hover:text-white'}`}
                    >
                        Image
                    </button>
                    <button 
                        onClick={() => setActiveTab('video')}
                        className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'video' ? 'text-white border-primary' : 'text-text-muted border-transparent hover:text-white'}`}
                    >
                        Video
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {activeTab === 'image' ? (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Image Prompt</h4>
                                    <span className="text-[9px] text-text-muted flex items-center gap-1"><Icons.RefreshCw size={10}/> Auto-sync</span>
                                </div>
                                <div className="relative">
                                    <textarea 
                                        className="w-full bg-[#1e1933] border border-white/10 rounded-lg p-3 text-xs text-white/90 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50 leading-relaxed min-h-[100px]"
                                        value={activeScene.imagePrompt}
                                        onChange={(e) => updateScene('imagePrompt', e.target.value)}
                                    />
                                    <button className="absolute bottom-2 right-2 text-text-muted hover:text-white"><Icons.Wand2 size={14}/></button>
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full mt-3"
                                    onClick={handleRegenerateImage}
                                    disabled={generatingImages.has(activeScene.id)}
                                >
                                    {generatingImages.has(activeScene.id) ? <Icons.RefreshCw className="animate-spin" size={14}/> : <Icons.RefreshCw size={14} />}
                                    {generatingImages.has(activeScene.id) ? 'Generating...' : 'Regenerate Image'}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full mt-2"
                                    onClick={() => setIsEditModalOpen(true)}
                                    disabled={!activeScene.imageUrl || generatingImages.has(activeScene.id)}
                                >
                                    <Icons.Edit3 size={14} />
                                    Edit Image
                                </Button>
                            </div>

                            <div className="space-y-3">
                                <div className="p-3 bg-[#1e1933] border border-white/5 rounded-xl flex items-center justify-between">
                                    <div className="flex flex-col gap-1">
                                        <h4 className="text-[9px] text-text-muted font-bold uppercase">Visual Style</h4>
                                        <div className="flex items-center gap-2 text-xs font-bold">
                                            <Icons.Film size={14} className="text-primary"/>
                                            {activeScene.visualStyle}
                                        </div>
                                    </div>
                                    <Icons.ChevronRight size={14} className="text-text-muted" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Video Prompt</h4>
                                    {/* STORY-5-4: Auto-save indicator (AC: 20) */}
                                    <span className="text-[9px] text-text-muted flex items-center gap-1">
                                        {savingVideoPrompt ? (
                                            <>
                                                <Icons.RefreshCw size={10} className="animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Icons.RefreshCw size={10} />
                                                Auto-save
                                            </>
                                        )}
                                    </span>
                                </div>
                                <div className="relative">
                                    <textarea
                                        className="w-full bg-[#1e1933] border border-white/10 rounded-lg p-3 text-xs text-white/90 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50 leading-relaxed min-h-[100px]"
                                        value={activeScene.videoPrompt || ''}
                                        onChange={(e) => handleVideoPromptChange(e.target.value)}
                                        placeholder="Describe the video motion and details..."
                                    />
                                    <button className="absolute bottom-2 right-2 text-text-muted hover:text-white"><Icons.Wand2 size={14}/></button>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-3">Camera Movement</h4>
                                <div className="relative">
                                    <select 
                                        className="w-full bg-[#1e1933] border border-white/10 rounded-lg py-2.5 px-3 text-xs text-white appearance-none focus:border-primary focus:outline-none cursor-pointer"
                                        value={activeScene.cameraMovement}
                                        onChange={(e) => updateScene('cameraMovement', e.target.value)}
                                    >
                                        <option>Zoom In (Slow)</option>
                                        <option>Zoom Out</option>
                                        <option>Pan Left</option>
                                        <option>Pan Right</option>
                                        <option>Pan Up</option>
                                        <option>Orbit</option>
                                        <option>Static</option>
                                        <option>Truck Left</option>
                                    </select>
                                    <Icons.ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={14} />
                                </div>
                            </div>
                            <div>
                                <h4 className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-3">Motion Strength</h4>
                                <input type="range" className="w-full h-1.5 bg-white/10 rounded-full appearance-none accent-primary cursor-pointer" />
                            </div>
                            
                            {/* STORY-5-4: Generate Video button (AC: 22-29) */}
                            <Button
                                className="w-full"
                                onClick={handleGenerateVideo}
                                disabled={generatingVideos.has(activeScene.id) || !activeScene.imageUrl}
                                title={!activeScene.imageUrl ? 'Generate an image first' : undefined}
                            >
                                {generatingVideos.has(activeScene.id) ? <Icons.RefreshCw className="animate-spin" size={16}/> : <Icons.Video size={16} />}
                                {generatingVideos.has(activeScene.id) ? 'GENERATING VIDEO...' : 'GENERATE VIDEO'}
                            </Button>
                            {activeScene.videoUrl && (
                                <p className="text-[10px] text-green-400 font-bold text-center mt-2 flex items-center justify-center gap-1">
                                    <Icons.CheckCircle size={10}/> Video Generated
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </>
        )}

        <div className="p-6 mt-auto border-t border-white/5 bg-background-dark/50">
            <Button size="lg" className="w-full" onClick={onNext}>
                Preview Full Video
            </Button>
        </div>
      </aside>

      {/* Image Edit Modal */}
      {activeScene && (
        <ImageEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          imageUrl={activeScene.imageUrl || ''}
          imagePrompt={activeScene.imagePrompt}
          sceneId={activeScene.id}
          projectId={project.id}
          onEditComplete={(newImageUrl) => {
            // Update the scene with the new image URL
            updateScene('imageUrl', newImageUrl);
          }}
        />
      )}
    </div>
  );
};

export default Storyboard;
