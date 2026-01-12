
import React, { useState, useEffect, useRef } from 'react';
import * as Icons from './Icons';
import { Project, TextOverlay, AudioTrack, AudioClip } from '../types';

interface VideoPreviewProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
}

type ToolType = 'none' | 'text' | 'music' | 'trim' | 'sfx';

const VideoPreview: React.FC<VideoPreviewProps> = ({ project, onUpdateProject }) => {
  const [activeTool, setActiveTool] = useState<ToolType>('none');
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Timeline State
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(60); // Default fallback
  const [isScrubbing, setIsScrubbing] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [timelineHeight, setTimelineHeight] = useState(350); // Increased default height for tracks
  
  // Local state for editing text before saving to project
  const [newText, setNewText] = useState('New Overlay');

  // Calculate duration from last scene's timestamp or default
  useEffect(() => {
      if (project.scenes.length > 0) {
          const lastScene = project.scenes[project.scenes.length - 1];
          if (lastScene.timestamp) {
              const parts = lastScene.timestamp.split('-');
              if (parts.length > 1) {
                  const endStr = parts[1].trim();
                  const [m, s] = endStr.split(':').map(Number);
                  setDuration(m * 60 + s);
                  return;
              }
          }
      }
      setDuration(60); // Fallback
  }, [project.scenes]);

  // Ensure audioTracks exists if not present (migration)
  useEffect(() => {
    if (!project.audioTracks) {
        // Fallback initialization if project was created before this feature
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
                    startTime: i * 25, // Rough approximation if data missing
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
  }, [project.audioTracks, project.script, project.musicTrack, onUpdateProject, project]);


  // Playback Loop
  useEffect(() => {
    let animationFrame: number;
    let lastTime = performance.now();

    const animate = (time: number) => {
      if (!isPlaying) return;
      
      const deltaTime = (time - lastTime) / 1000;
      lastTime = time;

      setCurrentTime(prev => {
        const next = prev + deltaTime;
        if (next >= duration) {
          setIsPlaying(false);
          return duration;
        }
        return next;
      });
      animationFrame = requestAnimationFrame(animate);
    };

    if (isPlaying) {
        animationFrame = requestAnimationFrame(animate);
    } else {
        lastTime = performance.now();
    }

    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying, duration]);

  // Determine current scene based on time
  const getCurrentScene = () => {
      if (!project.scenes.length) return null;
      
      const found = project.scenes.find(scene => {
          const parts = scene.timestamp.split('-');
          if (parts.length < 2) return false;
          const startStr = parts[0].trim();
          const endStr = parts[1].trim();
          
          const [startM, startS] = startStr.split(':').map(Number);
          const [endM, endS] = endStr.split(':').map(Number);
          
          const start = startM * 60 + startS;
          const end = endM * 60 + endS;
          
          return currentTime >= start && currentTime < end;
      });

      return found || project.scenes[0];
  };

  const currentScene = getCurrentScene();
  const progressPercent = Math.min(100, Math.max(0, (currentTime / duration) * 100));

  // Timeline Handlers
  const handleScrub = (clientX: number) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percentage = x / rect.width;
      setCurrentTime(percentage * duration);
  };

  const handleTimelineMouseDown = (e: React.MouseEvent) => {
      setIsScrubbing(true);
      const wasPlaying = isPlaying;
      if (wasPlaying) setIsPlaying(false);
      handleScrub(e.clientX);

      const handleMouseMove = (ev: MouseEvent) => handleScrub(ev.clientX);
      const handleMouseUp = () => {
          setIsScrubbing(false);
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
  };

  const handleResizeStart = (e: React.MouseEvent) => {
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
  };

  const formatTime = (time: number) => {
      const mins = Math.floor(time / 60);
      const secs = Math.floor(time % 60);
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleAddText = () => {
    const newOverlay: TextOverlay = {
      id: `txt_${Date.now()}`,
      text: newText,
      x: 50,
      y: 50,
      fontSize: 24,
      color: '#ffffff',
      startTime: currentTime // Set to current scrub time
    };
    onUpdateProject({
      ...project,
      textOverlays: [...(project.textOverlays || []), newOverlay]
    });
  };

  const handleRemoveText = (id: string) => {
    onUpdateProject({
        ...project,
        textOverlays: (project.textOverlays || []).filter(t => t.id !== id)
    });
  };

  // Generic function to add a clip to the first available track of that type, or create a new track
  const addAudioClip = (trackType: 'music' | 'sfx', clipName: string, duration: number = 10) => {
      const tracks = project.audioTracks || [];
      // Find the last track of this type
      const existingTrackIndex = tracks.findIndex(t => t.type === trackType);
      
      let newTracks = [...tracks];

      if (existingTrackIndex !== -1) {
          const track = { ...newTracks[existingTrackIndex] };
          track.clips = [...track.clips, {
              id: `clip_${Date.now()}`,
              name: clipName,
              startTime: currentTime,
              duration: duration
          }];
          newTracks[existingTrackIndex] = track;
      } else {
          // Create new track
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
                  duration: duration
              }]
          });
      }
      onUpdateProject({ ...project, audioTracks: newTracks });
  };

  const addNewTrack = (type: 'music' | 'sfx') => {
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
  };

  const removeTrack = (trackId: string) => {
      if (!confirm("Delete this track?")) return;
      const tracks = project.audioTracks || [];
      onUpdateProject({ ...project, audioTracks: tracks.filter(t => t.id !== trackId) });
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0d0b1a] font-display overflow-hidden">
        {/* Top Toolbar */}
        <div className="h-14 border-b border-border-color flex items-center justify-between px-6 bg-background-dark/80 shrink-0">
            <div className="flex items-center gap-4">
                <h3 className="text-white font-bold text-sm">Final Render Editor</h3>
                <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${project.status === 'completed' ? 'bg-green-500/20 text-green-500 border-green-500/30' : 'bg-blue-500/20 text-blue-500 border-blue-500/30'}`}>
                    {project.status === 'completed' ? 'EXPORT READY' : 'EDIT MODE'}
                </span>
            </div>
            <div className="flex items-center gap-2">
                <button 
                  onClick={() => onUpdateProject({...project, status: 'completed'})}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all border border-white/10"
                >
                    <Icons.Save size={14} /> Save Project
                </button>
                <button className="px-4 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-primary/20">
                    <Icons.Download size={14} /> Export Video
                </button>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
            {/* Left Tools Sidebar */}
            <div className="w-16 border-r border-border-color bg-card-bg flex flex-col items-center py-4 gap-4 z-10">
                <button 
                  onClick={() => setActiveTool(activeTool === 'trim' ? 'none' : 'trim')}
                  className={`p-3 rounded-xl transition-all ${activeTool === 'trim' ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-text-muted hover:bg-white/5 hover:text-white'}`}
                  title="Trim Clip"
                >
                    <Icons.Scissors size={20} />
                </button>
                <button 
                  onClick={() => setActiveTool(activeTool === 'text' ? 'none' : 'text')}
                  className={`p-3 rounded-xl transition-all ${activeTool === 'text' ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-text-muted hover:bg-white/5 hover:text-white'}`}
                  title="Add Text"
                >
                    <Icons.Type size={20} />
                </button>
                <button 
                  onClick={() => setActiveTool(activeTool === 'music' ? 'none' : 'music')}
                  className={`p-3 rounded-xl transition-all ${activeTool === 'music' ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-text-muted hover:bg-white/5 hover:text-white'}`}
                  title="Background Music"
                >
                    <Icons.Music size={20} />
                </button>
                 <button 
                  onClick={() => setActiveTool(activeTool === 'sfx' ? 'none' : 'sfx')}
                  className={`p-3 rounded-xl transition-all ${activeTool === 'sfx' ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-text-muted hover:bg-white/5 hover:text-white'}`}
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
                                <video src={currentScene.videoUrl} className="w-full h-full object-cover" autoPlay muted loop />
                            ) : (
                                <img src={currentScene.imageUrl} className="w-full h-full object-cover opacity-90" alt="Video Preview" />
                            )
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-text-muted">No Scene Data</div>
                        )}
                        
                        {/* Text Overlays Layer */}
                        <div className="absolute inset-0 pointer-events-none">
                            {(project.textOverlays || []).filter(o => currentTime >= o.startTime && currentTime < o.startTime + 5).map(overlay => (
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
                        <div className={`absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity ${isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
                             <button 
                                onClick={() => {
                                    if (currentTime >= duration) setCurrentTime(0);
                                    setIsPlaying(!isPlaying);
                                }}
                                className="size-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:scale-110 transition-transform pointer-events-auto shadow-2xl"
                             >
                                {isPlaying ? <Icons.Maximize2 size={24} fill="white" className="ml-1 opacity-0" /> : <Icons.PlayCircle size={32} fill="white" className="ml-1" />}
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
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2"><Icons.Type size={16}/> Text Overlay</h4>
                                    <div className="flex gap-2">
                                        <input 
                                            value={newText}
                                            onChange={(e) => setNewText(e.target.value)}
                                            className="flex-1 bg-black/20 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                        />
                                        <button onClick={handleAddText} className="px-3 bg-primary rounded text-white font-bold text-xs">Add</button>
                                    </div>
                                    <p className="text-[10px] text-text-muted">Will be added at current time: {formatTime(currentTime)}</p>
                                </div>
                                <div className="flex-1 border-l border-white/5 pl-6 overflow-y-auto">
                                    <h5 className="text-[10px] font-bold text-text-muted uppercase mb-3">Active Layers</h5>
                                    <div className="space-y-2">
                                        {(project.textOverlays || []).map(layer => (
                                            <div key={layer.id} className="flex items-center justify-between bg-white/5 p-2 rounded border border-white/5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-white">{layer.text}</span>
                                                    <span className="text-[10px] text-text-muted bg-black/20 px-1 rounded">{formatTime(layer.startTime)}</span>
                                                </div>
                                                <button onClick={() => handleRemoveText(layer.id)} className="text-red-400 hover:text-red-300"><Icons.Trash2 size={14}/></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTool === 'music' && (
                            <div className="flex-1">
                                <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-4"><Icons.Music size={16}/> Background Music</h4>
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
                                                <div className="bg-current h-full w-2/3"></div>
                                            </div>
                                            <div className="mt-2 text-[10px] text-primary flex justify-end font-bold opacity-0 group-hover:opacity-100">+ Add to Timeline</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTool === 'sfx' && (
                             <div className="flex-1">
                                <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-4"><Icons.Volume2 size={16}/> Sound Effects</h4>
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
                                                <div className="bg-orange-500 h-full w-1/3"></div>
                                            </div>
                                             <div className="mt-2 text-[10px] text-primary flex justify-end font-bold opacity-0 group-hover:opacity-100">+ Add</div>
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
               <div className="w-12 h-1 bg-white/20 rounded-full group-hover:bg-primary transition-colors"></div>
            </div>

            {/* Timeline Scrub Bar */}
            <div className="h-10 border-b border-white/5 flex items-center px-4 justify-between bg-black/20 shrink-0">
                <div className="flex items-center gap-4 text-xs font-bold text-text-muted w-full select-none">
                    <button 
                        className="hover:text-white shrink-0 outline-none" 
                        onClick={() => {
                            if (currentTime >= duration) setCurrentTime(0);
                            setIsPlaying(!isPlaying);
                        }}
                    >
                        {isPlaying ? <div className="flex gap-0.5"><div className="w-1 h-3 bg-current rounded-sm"></div><div className="w-1 h-3 bg-current rounded-sm"></div></div> : <Icons.PlayCircle size={16}/>}
                    </button>
                    <span className="font-mono text-[10px] w-10 text-right">{formatTime(currentTime)}</span>
                    
                    {/* Interactive Slider */}
                    <div 
                        ref={timelineRef}
                        onMouseDown={handleTimelineMouseDown}
                        className="flex-1 h-8 flex items-center cursor-pointer group relative"
                    >
                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                        <div className="absolute h-3 w-3 bg-white rounded-full shadow-lg border border-black/10 transform -translate-x-1/2 group-hover:scale-125 transition-transform z-20" style={{ left: `${progressPercent}%` }}></div>
                    </div>

                    <span className="font-mono text-[10px] w-10">{formatTime(duration)}</span>
                </div>
            </div>

            {/* Tracks Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar relative">
                {/* Playhead Line Overlay */}
                <div 
                    className="absolute top-0 bottom-0 w-px bg-primary z-10 pointer-events-none"
                    style={{ left: `calc(1rem + ${progressPercent}% - ${(progressPercent/100) * 2}rem + 6rem)` }}
                >
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-primary">
                        <Icons.ChevronDown size={10} fill="currentColor"/>
                    </div>
                </div>

                {/* Video Track */}
                <div className="flex gap-4">
                    <div className="w-24 shrink-0 text-[10px] font-bold text-text-muted flex items-center gap-2 h-10"><Icons.Video size={12}/> VIDEO</div>
                    <div className="flex-1 bg-white/5 rounded h-10 relative overflow-hidden flex gap-[1px]">
                        {project.scenes.map((scene) => (
                             <div key={scene.id} className="h-full bg-primary/20 border-l border-primary/30 flex-1 relative group overflow-hidden">
                                {scene.videoUrl ? (
                                    <video src={scene.videoUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" muted />
                                ) : (
                                    <div className="absolute inset-0 bg-cover bg-center opacity-40 grayscale group-hover:grayscale-0 transition-all" style={{backgroundImage: `url(${scene.imageUrl})`}}></div>
                                )}
                                <span className="absolute bottom-1 left-1 text-[8px] text-white font-bold opacity-0 group-hover:opacity-100 truncate w-full px-1 z-10">{scene.narration.substring(0, 15)}...</span>
                             </div>
                        ))}
                    </div>
                </div>
                
                {/* Dynamic Audio Tracks */}
                {(project.audioTracks || []).map((track) => (
                    <div key={track.id} className="flex gap-4 group/track">
                        <div className="w-24 shrink-0 flex flex-col justify-center h-10">
                             <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-text-muted flex items-center gap-2 truncate">
                                    {track.type === 'voice' && <Icons.Mic size={12} className="text-purple-400"/>}
                                    {track.type === 'music' && <Icons.Music size={12} className="text-blue-400"/>}
                                    {track.type === 'sfx' && <Icons.Volume2 size={12} className="text-orange-400"/>}
                                    <span className="truncate">{track.name}</span>
                                </span>
                             </div>
                             {track.type !== 'voice' && (
                                 <button onClick={() => removeTrack(track.id)} className="text-[9px] text-red-500/50 hover:text-red-500 opacity-0 group-hover/track:opacity-100 transition-opacity self-start ml-5">
                                     Remove
                                 </button>
                             )}
                        </div>

                        <div className="flex-1 bg-[#1e1933] rounded h-10 relative overflow-hidden border border-transparent group-hover/track:border-white/10 transition-colors">
                            {/* Render Clips */}
                            {track.clips.map((clip) => {
                                const startP = (clip.startTime / duration) * 100;
                                const widthP = (clip.duration / duration) * 100;
                                
                                let colorClass = "bg-gray-500";
                                if (track.type === 'voice') colorClass = "bg-purple-500/40 border-purple-500 text-purple-200";
                                if (track.type === 'music') colorClass = "bg-blue-500/40 border-blue-500 text-blue-200";
                                if (track.type === 'sfx') colorClass = "bg-orange-500/40 border-orange-500 text-orange-200";

                                return (
                                    <div 
                                        key={clip.id}
                                        className={`absolute top-1 bottom-1 border rounded px-1 flex items-center overflow-hidden cursor-pointer hover:brightness-125 transition-all ${colorClass}`}
                                        style={{ left: `${startP}%`, width: `${widthP}%` }}
                                        title={`${clip.name} (${clip.duration}s)`}
                                    >
                                        <span className="text-[9px] font-bold truncate">{clip.name}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
                
                {/* Add Track Actions */}
                <div className="flex gap-4 pl-28 pt-2">
                     <button onClick={() => addNewTrack('music')} className="text-[10px] font-bold text-text-muted hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded border border-dashed border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10 transition-all">
                        <Icons.Plus size={10} /> Add Music Track
                     </button>
                     <button onClick={() => addNewTrack('sfx')} className="text-[10px] font-bold text-text-muted hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded border border-dashed border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10 transition-all">
                        <Icons.Plus size={10} /> Add SFX Track
                     </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default VideoPreview;
