import React, { useState } from 'react';
import * as Icons from './Icons';
import { Project, TextOverlay } from '../types';

interface VideoPreviewProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
}

type ToolType = 'none' | 'text' | 'music' | 'trim';

const VideoPreview: React.FC<VideoPreviewProps> = ({ project, onUpdateProject }) => {
  const [activeTool, setActiveTool] = useState<ToolType>('none');
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Local state for editing text before saving to project
  const [newText, setNewText] = useState('New Overlay');

  const handleAddText = () => {
    const newOverlay: TextOverlay = {
      id: `txt_${Date.now()}`,
      text: newText,
      x: 50,
      y: 50,
      fontSize: 24,
      color: '#ffffff',
      startTime: 0
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

  const updateMusic = (track: string) => {
      onUpdateProject({ ...project, musicTrack: track });
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
            </div>

            {/* Main Player Area */}
            <div className="flex-1 flex flex-col bg-black/50 relative">
                <div className="flex-1 flex items-center justify-center relative p-8">
                    <div className="aspect-video w-full max-w-4xl bg-black rounded-xl overflow-hidden shadow-2xl relative border border-white/10 group">
                        {/* Video Content */}
                        <img src={project.scenes[0]?.imageUrl} className="w-full h-full object-cover opacity-80" alt="Video Preview" />
                        
                        {/* Text Overlays Layer */}
                        <div className="absolute inset-0 pointer-events-none">
                            {(project.textOverlays || []).map(overlay => (
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
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button 
                                onClick={() => setIsPlaying(!isPlaying)}
                                className="size-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:scale-110 transition-transform pointer-events-auto"
                             >
                                <Icons.PlayCircle size={32} fill="white" className="ml-1" />
                             </button>
                        </div>
                    </div>
                </div>

                {/* Editor Panels (Contextual) */}
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
                                    <p className="text-[10px] text-text-muted">Overlays are draggable in a full implementation.</p>
                                </div>
                                <div className="flex-1 border-l border-white/5 pl-6 overflow-y-auto">
                                    <h5 className="text-[10px] font-bold text-text-muted uppercase mb-3">Active Layers</h5>
                                    <div className="space-y-2">
                                        {(project.textOverlays || []).map(layer => (
                                            <div key={layer.id} className="flex items-center justify-between bg-white/5 p-2 rounded border border-white/5">
                                                <span className="text-xs text-white">{layer.text}</span>
                                                <button onClick={() => handleRemoveText(layer.id)} className="text-red-400 hover:text-red-300"><Icons.Trash2 size={14}/></button>
                                            </div>
                                        ))}
                                        {(project.textOverlays || []).length === 0 && <p className="text-xs text-text-muted italic">No text layers added.</p>}
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
                                            onClick={() => updateMusic(track)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all ${project.musicTrack === track ? 'bg-primary/20 border-primary text-white' : 'bg-white/5 border-transparent hover:border-white/20 text-text-muted'}`}
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <Icons.Music size={14} />
                                                <span className="text-xs font-bold">{track}</span>
                                            </div>
                                            <div className="w-full bg-black/50 h-1 rounded-full overflow-hidden">
                                                <div className="bg-current h-full w-2/3"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTool === 'trim' && (
                            <div className="flex-1">
                                <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-4"><Icons.Scissors size={16}/> Trim Clip</h4>
                                <div className="bg-black/40 rounded-lg p-4 border border-white/10 relative">
                                    <div className="h-12 bg-primary/20 rounded relative overflow-hidden flex">
                                        {/* Mock Filmstrip */}
                                        {Array.from({length: 10}).map((_, i) => (
                                            <div key={i} className="flex-1 border-r border-white/5 opacity-50 bg-cover bg-center" style={{ backgroundImage: `url(${project.scenes[0]?.imageUrl})` }}></div>
                                        ))}
                                    </div>
                                    
                                    {/* Trim Handles */}
                                    <div className="absolute top-0 bottom-0 left-12 w-4 bg-white/20 border-l-2 border-white cursor-ew-resize flex items-center justify-center">
                                        <Icons.MoreVertical size={12} className="text-white"/>
                                    </div>
                                    <div className="absolute top-0 bottom-0 right-24 w-4 bg-white/20 border-r-2 border-white cursor-ew-resize flex items-center justify-center">
                                        <Icons.MoreVertical size={12} className="text-white"/>
                                    </div>
                                    
                                    <div className="flex justify-between mt-2 text-[10px] text-text-muted font-mono">
                                        <span>Start: 00:02.5</span>
                                        <span>Duration: 00:05.0</span>
                                        <span>End: 00:07.5</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* Timeline (Always visible) */}
        <div className="h-40 border-t border-border-color bg-[#131022] flex flex-col shrink-0">
            <div className="h-8 border-b border-white/5 flex items-center px-4 justify-between">
                <div className="flex items-center gap-4 text-xs font-bold text-text-muted">
                    <button className="hover:text-white" onClick={() => setIsPlaying(!isPlaying)}>
                        {isPlaying ? <Icons.Maximize2 size={14}/> : <Icons.PlayCircle size={14}/>}
                    </button>
                    <span>00:00:00</span>
                    <div className="w-64 h-1 bg-white/10 rounded-full relative">
                        <div className="absolute left-0 top-0 bottom-0 w-1/3 bg-primary rounded-full"></div>
                        <div className="absolute left-1/3 top-1/2 -translate-y-1/2 size-3 bg-white rounded-full shadow cursor-pointer"></div>
                    </div>
                    <span>00:00:30</span>
                </div>
            </div>

            {/* Tracks */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {/* Text Track (If overlays exist) */}
                {(project.textOverlays || []).length > 0 && (
                     <div className="flex gap-2">
                        <div className="w-24 shrink-0 text-[10px] font-bold text-text-muted flex items-center gap-2"><Icons.Type size={12}/> TEXT</div>
                        <div className="flex-1 bg-white/5 rounded h-6 relative overflow-hidden">
                            {(project.textOverlays || []).map((overlay, i) => (
                                <div key={overlay.id} className="absolute top-1 bottom-1 bg-purple-500/50 border border-purple-500 rounded text-[9px] px-1 truncate flex items-center text-white" style={{ left: `${i * 15}%`, width: '15%' }}>
                                    {overlay.text}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Video Track */}
                <div className="flex gap-2">
                    <div className="w-24 shrink-0 text-[10px] font-bold text-text-muted flex items-center gap-2"><Icons.Video size={12}/> VIDEO</div>
                    <div className="flex-1 bg-white/5 rounded h-10 relative overflow-hidden flex gap-[1px]">
                        {project.scenes.map((scene) => (
                             <div key={scene.id} className="h-full bg-primary/20 border-l border-primary/30 flex-1 relative group">
                                <div className="absolute inset-0 bg-cover bg-center opacity-40" style={{backgroundImage: `url(${scene.imageUrl})`}}></div>
                                <span className="absolute bottom-1 left-1 text-[8px] text-white font-bold opacity-0 group-hover:opacity-100 truncate w-full px-1">{scene.imagePrompt}</span>
                             </div>
                        ))}
                    </div>
                </div>

                {/* Audio Track */}
                <div className="flex gap-2">
                    <div className="w-24 shrink-0 text-[10px] font-bold text-text-muted flex items-center gap-2"><Icons.Music size={12}/> AUDIO</div>
                    <div className="flex-1 bg-[#1e1933] rounded h-8 relative overflow-hidden group cursor-pointer border border-transparent hover:border-white/10">
                        {project.musicTrack ? (
                             <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center text-[10px] font-bold text-blue-300">
                                {project.musicTrack}
                             </div>
                        ) : null}
                        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-4 flex items-center gap-0.5 px-2 opacity-50">
                            {Array.from({ length: 60 }).map((_, i) => (
                                <div key={i} className="flex-1 bg-blue-400 rounded-full" style={{ height: `${Math.random() * 100}%` }}></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default VideoPreview;