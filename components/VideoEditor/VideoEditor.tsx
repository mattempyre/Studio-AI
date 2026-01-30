import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as Icons from '../Icons';
import { Project, Scene, TextOverlay, AudioTrack, TimelineState } from '../../types';
import { ToolType } from './types';
import Timeline from './Timeline';
import PlaybackControls from './PlaybackControls';
import ZoomControls from './ZoomControls';
import { useTimelinePlayback } from './hooks/useTimelinePlayback';
import { useDragDrop } from './hooks/useDragDrop';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { exportApi, ExportJob } from '../../services/backendApi';

interface VideoEditorProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
}

const VideoEditor: React.FC<VideoEditorProps> = ({ project, onUpdateProject }) => {
  const [activeTool, setActiveTool] = useState<ToolType>('none');
  const [timelineState, setTimelineState] = useState<TimelineState>({
    zoomLevel: 100,
    scrollOffset: 0,
    selectedClipId: null,
    isDragging: false,
    dragClipId: null
  });
  const [timelineHeight, setTimelineHeight] = useState(350);
  const [newText, setNewText] = useState('New Overlay');

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportDownloadUrl, setExportDownloadUrl] = useState<string | null>(null);

  // Initialize scenes with timeline data
  const scenesWithTimeline = useMemo(() => {
    let currentStart = 0;
    return project.scenes.map(scene => {
      const videoDuration = scene.videoDuration ?? 5;
      const trimStart = scene.trimStart ?? 0;
      const trimEnd = scene.trimEnd ?? 0;
      const effectiveDuration = videoDuration - trimStart - trimEnd;

      const updatedScene = {
        ...scene,
        videoDuration,
        timelineStart: scene.timelineStart ?? currentStart,
        effectiveDuration
      };

      currentStart += effectiveDuration;
      return updatedScene;
    });
  }, [project.scenes]);

  // Calculate total duration
  const duration = useMemo(() => {
    if (scenesWithTimeline.length === 0) return 60;
    const lastScene = scenesWithTimeline[scenesWithTimeline.length - 1];
    return (lastScene.timelineStart ?? 0) + (lastScene.effectiveDuration ?? 5);
  }, [scenesWithTimeline]);

  // Playback hook
  const {
    currentTime,
    setCurrentTime,
    isPlaying,
    togglePlayback,
    stepForward,
    stepBackward,
    jumpToNextClip,
    jumpToPrevClip,
    shuttle,
    getCurrentScene,
    registerVideoRef,
    registerAudioRef
  } = useTimelinePlayback({
    scenes: scenesWithTimeline,
    audioTracks: project.audioTracks,
    duration
  });

  // Drag-drop hook
  const {
    isDragging,
    dropTargetIndex,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDrop
  } = useDragDrop({
    scenes: scenesWithTimeline,
    onReorder: (newScenes) => {
      onUpdateProject({ ...project, scenes: newScenes });
    },
    pixelsPerSecond: timelineState.zoomLevel
  });

  // Handle trim updates
  const handleTrimStart = useCallback((sceneId: string, newTrimStart: number) => {
    const updatedScenes = project.scenes.map(scene => {
      if (scene.id === sceneId) {
        const videoDuration = scene.videoDuration ?? 5;
        const trimEnd = scene.trimEnd ?? 0;
        const effectiveDuration = videoDuration - newTrimStart - trimEnd;

        return {
          ...scene,
          trimStart: newTrimStart,
          effectiveDuration
        };
      }
      return scene;
    });

    // Recalculate timeline starts
    let currentStart = 0;
    const recalculatedScenes = updatedScenes.map(scene => {
      const effectiveDur = scene.effectiveDuration ?? (scene.videoDuration ?? 5) - (scene.trimStart ?? 0) - (scene.trimEnd ?? 0);
      const updated = { ...scene, timelineStart: currentStart };
      currentStart += effectiveDur;
      return updated;
    });

    onUpdateProject({ ...project, scenes: recalculatedScenes });
  }, [project, onUpdateProject]);

  const handleTrimEnd = useCallback((sceneId: string, newTrimEnd: number) => {
    const updatedScenes = project.scenes.map(scene => {
      if (scene.id === sceneId) {
        const videoDuration = scene.videoDuration ?? 5;
        const trimStart = scene.trimStart ?? 0;
        const effectiveDuration = videoDuration - trimStart - newTrimEnd;

        return {
          ...scene,
          trimEnd: newTrimEnd,
          effectiveDuration
        };
      }
      return scene;
    });

    // Recalculate timeline starts
    let currentStart = 0;
    const recalculatedScenes = updatedScenes.map(scene => {
      const effectiveDur = scene.effectiveDuration ?? (scene.videoDuration ?? 5) - (scene.trimStart ?? 0) - (scene.trimEnd ?? 0);
      const updated = { ...scene, timelineStart: currentStart };
      currentStart += effectiveDur;
      return updated;
    });

    onUpdateProject({ ...project, scenes: recalculatedScenes });
  }, [project, onUpdateProject]);

  // Handle slip offset changes (adjusts which portion of source video plays)
  const handleSlipOffsetChange = useCallback((sceneId: string, newSlipOffset: number) => {
    const updatedScenes = project.scenes.map(scene => {
      if (scene.id === sceneId) {
        return {
          ...scene,
          slipOffset: newSlipOffset
        };
      }
      return scene;
    });

    onUpdateProject({ ...project, scenes: updatedScenes });
  }, [project, onUpdateProject]);

  // Set in/out points (trim at current playhead)
  const handleSetInPoint = useCallback(() => {
    if (!timelineState.selectedClipId) return;
    const scene = scenesWithTimeline.find(s => s.id === timelineState.selectedClipId);
    if (!scene) return;

    const clipStart = scene.timelineStart ?? 0;
    const localTime = currentTime - clipStart;
    if (localTime > 0) {
      handleTrimStart(scene.id, localTime);
    }
  }, [timelineState.selectedClipId, scenesWithTimeline, currentTime, handleTrimStart]);

  const handleSetOutPoint = useCallback(() => {
    if (!timelineState.selectedClipId) return;
    const scene = scenesWithTimeline.find(s => s.id === timelineState.selectedClipId);
    if (!scene) return;

    const clipStart = scene.timelineStart ?? 0;
    const clipEnd = clipStart + (scene.effectiveDuration ?? 5);
    const trimFromEnd = clipEnd - currentTime;
    if (trimFromEnd > 0) {
      handleTrimEnd(scene.id, trimFromEnd);
    }
  }, [timelineState.selectedClipId, scenesWithTimeline, currentTime, handleTrimEnd]);

  // Zoom handlers
  const handleZoomChange = useCallback((level: number) => {
    setTimelineState(prev => ({ ...prev, zoomLevel: level }));
  }, []);

  const handleZoomIn = useCallback(() => {
    setTimelineState(prev => ({
      ...prev,
      zoomLevel: Math.min(prev.zoomLevel + 25, 400)
    }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setTimelineState(prev => ({
      ...prev,
      zoomLevel: Math.max(prev.zoomLevel - 25, 25)
    }));
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onTogglePlayback: togglePlayback,
    onStepForward: stepForward,
    onStepBackward: stepBackward,
    onJumpToNextClip: jumpToNextClip,
    onJumpToPrevClip: jumpToPrevClip,
    onShuttle: shuttle,
    onSetInPoint: handleSetInPoint,
    onSetOutPoint: handleSetOutPoint,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    isEnabled: true
  });

  // Clip selection
  const handleSelectClip = useCallback((sceneId: string) => {
    setTimelineState(prev => ({
      ...prev,
      selectedClipId: prev.selectedClipId === sceneId ? null : sceneId
    }));
  }, []);

  // Timeline resize handler
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = timelineHeight;

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      const newHeight = Math.max(160, Math.min(window.innerHeight * 0.8, startHeight + delta));
      setTimelineHeight(newHeight);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'row-resize';
  }, [timelineHeight]);

  // Text overlay handlers
  const handleAddText = useCallback(() => {
    const newOverlay: TextOverlay = {
      id: `txt_${Date.now()}`,
      text: newText,
      x: 50,
      y: 50,
      fontSize: 24,
      color: '#ffffff',
      startTime: currentTime
    };
    onUpdateProject({
      ...project,
      textOverlays: [...(project.textOverlays || []), newOverlay]
    });
  }, [newText, currentTime, project, onUpdateProject]);

  const handleRemoveText = useCallback((id: string) => {
    onUpdateProject({
      ...project,
      textOverlays: (project.textOverlays || []).filter(t => t.id !== id)
    });
  }, [project, onUpdateProject]);

  // Audio track handlers
  const addAudioClip = useCallback((trackType: 'music' | 'sfx', clipName: string, clipDuration: number = 10) => {
    const tracks = project.audioTracks || [];
    const existingTrackIndex = tracks.findIndex(t => t.type === trackType);
    let newTracks = [...tracks];

    if (existingTrackIndex !== -1) {
      const track = { ...newTracks[existingTrackIndex] };
      track.clips = [...track.clips, {
        id: `clip_${Date.now()}`,
        name: clipName,
        startTime: currentTime,
        duration: clipDuration
      }];
      newTracks[existingTrackIndex] = track;
    } else {
      newTracks.push({
        id: `track_${trackType}_${Date.now()}`,
        type: trackType,
        name: trackType === 'music' ? 'Music Track' : 'SFX Track',
        volume: 0.8,
        isMuted: false,
        clips: [{
          id: `clip_${Date.now()}`,
          name: clipName,
          startTime: currentTime,
          duration: clipDuration
        }]
      });
    }
    onUpdateProject({ ...project, audioTracks: newTracks });
  }, [currentTime, project, onUpdateProject]);

  const addNewTrack = useCallback((type: 'music' | 'sfx') => {
    const tracks = project.audioTracks || [];
    const count = tracks.filter(t => t.type === type).length;
    const newTrack: AudioTrack = {
      id: `track_${type}_${Date.now()}`,
      type: type,
      name: `${type === 'music' ? 'Music' : 'SFX'} Track ${count + 1}`,
      volume: 0.7,
      isMuted: false,
      clips: []
    };
    onUpdateProject({ ...project, audioTracks: [...tracks, newTrack] });
  }, [project, onUpdateProject]);

  // Export handler
  const handleExport = useCallback(async () => {
    if (isExporting) return;

    setIsExporting(true);
    setExportProgress(0);
    setExportError(null);
    setExportDownloadUrl(null);

    try {
      // Include timeline data in scenes for export
      const projectWithTimeline = {
        ...project,
        scenes: scenesWithTimeline
      };

      const result = await exportApi.start(projectWithTimeline, {
        format: '1080p',
        codec: 'h264'
      });

      // Poll for completion
      const completedJob = await exportApi.pollUntilComplete(
        result.jobId,
        (job: ExportJob) => {
          setExportProgress(job.progress);
        }
      );

      setExportDownloadUrl(exportApi.getDownloadUrl(result.jobId));
      setExportProgress(100);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, project, scenesWithTimeline]);

  const currentScene = getCurrentScene();
  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Ensure audioTracks exists
  useEffect(() => {
    if (!project.audioTracks) {
      const tracks: AudioTrack[] = [
        {
          id: 'track_vo_default',
          type: 'voice',
          name: 'Voice Over',
          volume: 1.0,
          isMuted: false,
          clips: project.script.map((s, i) => ({
            id: `vo_clip_${i}`,
            name: s.title,
            startTime: i * 25,
            duration: 25
          }))
        },
        {
          id: 'track_music_default',
          type: 'music',
          name: 'Background Music',
          volume: 0.8,
          isMuted: false,
          clips: project.musicTrack ? [{ id: 'm_clip_1', name: project.musicTrack, startTime: 0, duration: 60 }] : []
        }
      ];
      onUpdateProject({ ...project, audioTracks: tracks });
    }
  }, [project, onUpdateProject]);

  return (
    <div className="flex-1 flex flex-col bg-[#0d0b1a] font-display overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-14 border-b border-border-color flex items-center justify-between px-6 bg-background-dark/80 shrink-0">
        <div className="flex items-center gap-4">
          <h3 className="text-white font-bold text-sm">Video Editor</h3>
          <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
            project.status === 'completed'
              ? 'bg-green-500/20 text-green-500 border-green-500/30'
              : 'bg-blue-500/20 text-blue-500 border-blue-500/30'
          }`}>
            {project.status === 'completed' ? 'EXPORT READY' : 'EDIT MODE'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ZoomControls
            zoomLevel={timelineState.zoomLevel}
            onZoomChange={handleZoomChange}
          />

          <button
            onClick={() => onUpdateProject({ ...project, status: 'completed' })}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all border border-white/10"
          >
            <Icons.Save size={14} /> Save
          </button>
          {exportDownloadUrl ? (
            <a
              href={exportDownloadUrl}
              download
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-green-600/20"
            >
              <Icons.Download size={14} /> Download Video
            </a>
          ) : isExporting ? (
            <div className="px-4 py-2 bg-primary/80 text-white text-xs font-bold rounded-lg flex items-center gap-2 min-w-[140px]">
              <Icons.Loader2 size={14} className="animate-spin" />
              <span>Exporting {exportProgress}%</span>
            </div>
          ) : (
            <button
              onClick={handleExport}
              disabled={project.scenes.length === 0}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icons.Download size={14} /> Export Video
            </button>
          )}

          {exportError && (
            <div className="px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] rounded flex items-center gap-1">
              <Icons.AlertCircle size={12} />
              {exportError}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Tools Sidebar */}
        <div className="w-16 border-r border-border-color bg-card-bg flex flex-col items-center py-4 gap-4 z-10">
          <button
            onClick={() => setActiveTool(activeTool === 'trim' ? 'none' : 'trim')}
            className={`p-3 rounded-xl transition-all ${
              activeTool === 'trim'
                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                : 'text-text-muted hover:bg-white/5 hover:text-white'
            }`}
            title="Trim Clip ([/] to set in/out points)"
          >
            <Icons.Scissors size={20} />
          </button>
          <button
            onClick={() => setActiveTool(activeTool === 'text' ? 'none' : 'text')}
            className={`p-3 rounded-xl transition-all ${
              activeTool === 'text'
                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                : 'text-text-muted hover:bg-white/5 hover:text-white'
            }`}
            title="Add Text"
          >
            <Icons.Type size={20} />
          </button>
          <button
            onClick={() => setActiveTool(activeTool === 'music' ? 'none' : 'music')}
            className={`p-3 rounded-xl transition-all ${
              activeTool === 'music'
                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                : 'text-text-muted hover:bg-white/5 hover:text-white'
            }`}
            title="Background Music"
          >
            <Icons.Music size={20} />
          </button>
          <button
            onClick={() => setActiveTool(activeTool === 'sfx' ? 'none' : 'sfx')}
            className={`p-3 rounded-xl transition-all ${
              activeTool === 'sfx'
                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                : 'text-text-muted hover:bg-white/5 hover:text-white'
            }`}
            title="Sound Effects"
          >
            <Icons.Volume2 size={20} />
          </button>
        </div>

        {/* Main Player Area */}
        <div className="flex-1 flex flex-col bg-black/50 relative">
          <div className="flex-1 flex items-center justify-center relative p-8">
            <div className="aspect-video w-full max-w-4xl bg-black rounded-xl overflow-hidden shadow-2xl relative border border-white/10 group">
              {/* Video/Image Content */}
              {currentScene ? (
                currentScene.videoUrl ? (
                  <video
                    ref={(el) => {
                      if (el && currentScene.id) {
                        // Sync video to timeline position
                        const clipStart = currentScene.timelineStart ?? 0;
                        const trimOffset = currentScene.trimStart ?? 0;
                        const localTime = currentTime - clipStart + trimOffset;

                        // Set the video time to match playhead position
                        if (Math.abs(el.currentTime - localTime) > 0.1) {
                          el.currentTime = Math.max(0, localTime);
                        }

                        // Play or pause based on timeline state
                        if (isPlaying && el.paused) {
                          el.play().catch(() => {});
                        } else if (!isPlaying && !el.paused) {
                          el.pause();
                        }
                      }
                    }}
                    src={currentScene.videoUrl}
                    className="w-full h-full object-cover"
                    muted
                  />
                ) : currentScene.imageUrl ? (
                  <img
                    src={currentScene.imageUrl}
                    className="w-full h-full object-cover opacity-90"
                    alt="Video Preview"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-muted">
                    No Media
                  </div>
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-muted">
                  No Scene Data
                </div>
              )}

              {/* Text Overlays Layer */}
              <div className="absolute inset-0 pointer-events-none">
                {(project.textOverlays || [])
                  .filter(o => currentTime >= o.startTime && currentTime < o.startTime + 5)
                  .map(overlay => (
                    <div
                      key={overlay.id}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 text-white font-bold drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]"
                      style={{
                        left: `${overlay.x}%`,
                        top: `${overlay.y}%`,
                        fontSize: `${overlay.fontSize}px`,
                        color: overlay.color
                      }}
                    >
                      {overlay.text}
                    </div>
                  ))}
              </div>

              {/* Controls Overlay */}
              <div className={`absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity ${
                isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'
              }`}>
                <button
                  onClick={togglePlayback}
                  className="size-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:scale-110 transition-transform pointer-events-auto shadow-2xl"
                >
                  {isPlaying ? (
                    <div className="flex gap-0.5">
                      <div className="w-1.5 h-6 bg-white rounded-sm" />
                      <div className="w-1.5 h-6 bg-white rounded-sm" />
                    </div>
                  ) : (
                    <Icons.PlayCircle size={32} fill="white" className="ml-1" />
                  )}
                </button>
              </div>

              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm border border-white/10 px-3 py-1.5 rounded-lg text-xs font-bold text-white/80 pointer-events-none">
                {currentScene?.id ? `Scene: ${currentScene.id}` : 'Intro'}
              </div>
            </div>
          </div>

          {/* Editor Panels */}
          {activeTool !== 'none' && (
            <div className="h-48 bg-panel-bg border-t border-border-color p-6 flex gap-8 animate-in slide-in-from-bottom duration-300">
              {activeTool === 'text' && (
                <div className="flex-1 flex gap-6">
                  <div className="w-64 space-y-4">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Icons.Type size={16} /> Text Overlay
                    </h4>
                    <div className="flex gap-2">
                      <input
                        value={newText}
                        onChange={(e) => setNewText(e.target.value)}
                        className="flex-1 bg-black/20 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                      />
                      <button
                        onClick={handleAddText}
                        className="px-3 bg-primary rounded text-white font-bold text-xs"
                      >
                        Add
                      </button>
                    </div>
                    <p className="text-[10px] text-text-muted">
                      Will be added at current time: {formatTime(currentTime)}
                    </p>
                  </div>
                  <div className="flex-1 border-l border-white/5 pl-6 overflow-y-auto">
                    <h5 className="text-[10px] font-bold text-text-muted uppercase mb-3">
                      Active Layers
                    </h5>
                    <div className="space-y-2">
                      {(project.textOverlays || []).map(layer => (
                        <div
                          key={layer.id}
                          className="flex items-center justify-between bg-white/5 p-2 rounded border border-white/5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white">{layer.text}</span>
                            <span className="text-[10px] text-text-muted bg-black/20 px-1 rounded">
                              {formatTime(layer.startTime)}
                            </span>
                          </div>
                          <button
                            onClick={() => handleRemoveText(layer.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Icons.Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTool === 'trim' && (
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                    <Icons.Scissors size={16} /> Trim Mode
                  </h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <p className="text-xs text-text-muted">
                        Select a clip in the timeline, then drag the edges to trim or use keyboard shortcuts:
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs">
                          <kbd className="px-2 py-1 bg-white/10 rounded text-white font-mono">[</kbd>
                          <span className="text-text-muted">Set in point (trim start)</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <kbd className="px-2 py-1 bg-white/10 rounded text-white font-mono">]</kbd>
                          <span className="text-text-muted">Set out point (trim end)</span>
                        </div>
                      </div>
                    </div>
                    {timelineState.selectedClipId && (
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <h5 className="text-xs font-bold text-white mb-2">Selected Clip</h5>
                        {(() => {
                          const scene = scenesWithTimeline.find(s => s.id === timelineState.selectedClipId);
                          if (!scene) return null;
                          return (
                            <div className="space-y-1 text-[10px] text-text-muted">
                              <p>Duration: {scene.effectiveDuration?.toFixed(1)}s</p>
                              <p>Trim Start: {(scene.trimStart ?? 0).toFixed(1)}s</p>
                              <p>Trim End: {(scene.trimEnd ?? 0).toFixed(1)}s</p>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTool === 'music' && (
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                    <Icons.Music size={16} /> Background Music
                  </h4>
                  <div className="grid grid-cols-4 gap-4">
                    {['Epic Rise', 'Lo-Fi Chill', 'Corporate Upbeat', 'Cinematic Ambience'].map(track => (
                      <div
                        key={track}
                        onClick={() => addAudioClip('music', track, 60)}
                        className="p-3 rounded-lg border bg-white/5 border-transparent hover:border-white/20 text-text-muted cursor-pointer hover:bg-white/10 transition-all"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Icons.Music size={14} />
                          <span className="text-xs font-bold">{track}</span>
                        </div>
                        <div className="w-full bg-black/50 h-1 rounded-full overflow-hidden">
                          <div className="bg-current h-full w-2/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTool === 'sfx' && (
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                    <Icons.Volume2 size={16} /> Sound Effects
                  </h4>
                  <div className="grid grid-cols-4 gap-4">
                    {['Whoosh', 'Glitch', 'Impact', 'Click', 'Ambient Rain'].map(sfx => (
                      <div
                        key={sfx}
                        onClick={() => addAudioClip('sfx', sfx, 3)}
                        className="p-3 rounded-lg border bg-white/5 border-transparent hover:border-white/20 text-text-muted cursor-pointer hover:bg-white/10 transition-all"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Icons.Volume2 size={14} />
                          <span className="text-xs font-bold">{sfx}</span>
                        </div>
                        <div className="w-full bg-black/50 h-1 rounded-full overflow-hidden">
                          <div className="bg-orange-500 h-full w-1/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Timeline Area */}
      <div
        style={{ height: timelineHeight }}
        className="border-t border-border-color bg-[#131022] flex flex-col shrink-0 relative"
      >
        {/* Resizer Handle */}
        <div
          onMouseDown={handleResizeStart}
          className="absolute -top-1.5 left-0 right-0 h-3 cursor-row-resize z-50 flex items-center justify-center group hover:bg-white/5 transition-colors"
        >
          <div className="w-12 h-1 bg-white/20 rounded-full group-hover:bg-primary transition-colors" />
        </div>

        {/* Playback Controls */}
        <PlaybackControls
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onTogglePlayback={togglePlayback}
          onSeek={setCurrentTime}
        />

        {/* Timeline */}
        <Timeline
          scenes={scenesWithTimeline}
          audioTracks={project.audioTracks || []}
          currentTime={currentTime}
          duration={duration}
          pixelsPerSecond={timelineState.zoomLevel}
          selectedClipId={timelineState.selectedClipId}
          isDragging={isDragging}
          dropTargetIndex={dropTargetIndex}
          onSelectClip={handleSelectClip}
          onTrimStart={handleTrimStart}
          onTrimEnd={handleTrimEnd}
          onSlipOffsetChange={handleSlipOffsetChange}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDrop={handleDrop}
          registerVideoRef={registerVideoRef}
          registerAudioRef={registerAudioRef}
        />

        {/* Add Track Actions */}
        <div className="flex gap-4 px-4 pb-4 pl-28">
          <button
            onClick={() => addNewTrack('music')}
            className="text-[10px] font-bold text-text-muted hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded border border-dashed border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10 transition-all"
          >
            <Icons.Plus size={10} /> Add Music Track
          </button>
          <button
            onClick={() => addNewTrack('sfx')}
            className="text-[10px] font-bold text-text-muted hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded border border-dashed border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10 transition-all"
          >
            <Icons.Plus size={10} /> Add SFX Track
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoEditor;
