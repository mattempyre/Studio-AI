
import React, { useState, useEffect, useRef } from 'react';
import * as Icons from './Icons';
import { Project, Voice, ScriptSection } from '../types';

interface VoiceOverProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
  onNext: () => void;
}

// Platform Voices - these match the Chatterbox TTS server predefined voices
const PLATFORM_VOICES: Voice[] = [
  { id: 'Emily', name: 'Emily', category: 'platform', style: 'Calm & Natural', gender: 'Female' },
  { id: 'Michael', name: 'Michael', category: 'platform', style: 'Confident & Clear', gender: 'Male' },
  { id: 'Olivia', name: 'Olivia', category: 'platform', style: 'Warm & Friendly', gender: 'Female' },
  { id: 'Thomas', name: 'Thomas', category: 'platform', style: 'Narrative Storyteller', gender: 'Male' },
  { id: 'Alexander', name: 'Alexander', category: 'platform', style: 'Deep & Authoritative', gender: 'Male' },
];

type SectionAudioStatus = 'idle' | 'generating' | 'completed';

interface SectionState {
    status: SectionAudioStatus;
    isPlaying: boolean;
    progress: number;
    duration: number; // in seconds
}

const VoiceOver: React.FC<VoiceOverProps> = ({ project, onUpdateProject, onNext }) => {
  const [activeCategory, setActiveCategory] = useState<'platform' | 'cloned'>('platform');
  const [clonedVoices, setClonedVoices] = useState<Voice[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);

  // State to track audio status for each script section
  const [sectionStates, setSectionStates] = useState<Record<string, SectionState>>({});
  
  // Global preview state
  const [globalPlayingIndex, setGlobalPlayingIndex] = useState<number | null>(null);

  // Initialize section states
  useEffect(() => {
      const initialStates: Record<string, SectionState> = {};
      project.script.forEach(section => {
          // Preserve existing state if re-rendering, otherwise init
          if (!sectionStates[section.id]) {
              initialStates[section.id] = {
                  status: 'idle',
                  isPlaying: false,
                  progress: 0,
                  duration: Math.max(5, section.content.length / 15) // Rough estimation: 15 chars per sec
              };
          }
      });
      if (Object.keys(initialStates).length > 0) {
          setSectionStates(prev => ({ ...prev, ...initialStates }));
      }
  }, [project.script]);

  // Playback Simulation Effect
  useEffect(() => {
    let interval: any;
    
    // Find if any section is playing
    const playingSectionId = Object.keys(sectionStates).find(id => sectionStates[id].isPlaying);

    if (playingSectionId) {
      interval = setInterval(() => {
        setSectionStates(prev => {
            const current = prev[playingSectionId];
            if (!current) return prev;

            if (current.progress >= 100) {
                // Stop playing
                const newState = { ...prev, [playingSectionId]: { ...current, isPlaying: false, progress: 0 } };
                
                // If in global play mode, trigger next
                if (globalPlayingIndex !== null) {
                    const nextIndex = globalPlayingIndex + 1;
                    if (nextIndex < project.script.length) {
                        // We need to trigger the next one in the next tick/effect, 
                        // but setting state here works if we manage the index logic externally or via a timeout.
                        // For simplicity, we'll just stop global play here or handle it via a separate effect watching playing states.
                        setTimeout(() => playSection(project.script[nextIndex].id, true, nextIndex), 50);
                    } else {
                        setGlobalPlayingIndex(null);
                    }
                }
                
                return newState;
            }

            // Advance progress
            const step = 100 / (current.duration * 10); // 10 ticks per second (100ms interval)
            return {
                ...prev,
                [playingSectionId]: { ...current, progress: Math.min(100, current.progress + step) }
            };
        });
      }, 100);
    }

    return () => clearInterval(interval);
  }, [sectionStates, globalPlayingIndex]);

  const handleVoiceSelect = (voiceId: string) => {
    onUpdateProject({ ...project, voiceId });
    // Note: In a real app, changing voice might invalidate generated audio.
    // For now, we'll keep the generated status but user can regenerate if they want.
  };

  const generateSection = async (sectionId: string) => {
      setSectionStates(prev => ({
          ...prev,
          [sectionId]: { ...prev[sectionId], status: 'generating' }
      }));

      // Simulate API delay unique to section length
      const delay = 1000 + Math.random() * 2000;
      await new Promise(resolve => setTimeout(resolve, delay));

      setSectionStates(prev => ({
          ...prev,
          [sectionId]: { ...prev[sectionId], status: 'completed' }
      }));
  };

  const generateAll = async () => {
      const idsToGenerate = project.script.filter(s => sectionStates[s.id]?.status !== 'completed').map(s => s.id);
      
      // Start all loaders
      setSectionStates(prev => {
          const next = { ...prev };
          idsToGenerate.forEach(id => {
              if (next[id]) next[id] = { ...next[id], status: 'generating' };
          });
          return next;
      });

      // Process strictly one by one or all at once? Let's simulate parallel with different finish times
      idsToGenerate.forEach(async (id) => {
          const delay = 1000 + Math.random() * 2000;
          await new Promise(resolve => setTimeout(resolve, delay));
          setSectionStates(prev => ({
            ...prev,
            [id]: { ...prev[id], status: 'completed' }
        }));
      });
  };

  const playSection = (sectionId: string, isGlobalSequence: boolean = false, index: number = -1) => {
      // Stop all others
      setSectionStates(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(key => {
              next[key] = { ...next[key], isPlaying: false, progress: 0 };
          });
          // Start target
          if (next[sectionId]) {
              next[sectionId] = { ...next[sectionId], isPlaying: true };
          }
          return next;
      });

      if (isGlobalSequence) {
          setGlobalPlayingIndex(index);
      } else {
          setGlobalPlayingIndex(null);
      }
  };

  const togglePreview = (id: string) => {
    if (previewPlayingId === id) {
      setPreviewPlayingId(null);
    } else {
      setPreviewPlayingId(id);
      setTimeout(() => setPreviewPlayingId(null), 3000);
    }
  };

  const createClonedVoice = () => {
      const newVoice: Voice = {
        id: `v_clone_${Date.now()}`,
        name: `Cloned Voice ${clonedVoices.length + 1}`,
        category: 'cloned',
        style: 'Custom',
        gender: 'Male'
      };
      setClonedVoices(prev => [...prev, newVoice]);
      setActiveCategory('cloned');
      handleVoiceSelect(newVoice.id);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    createClonedVoice();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          createClonedVoice();
      }
  };

  const displayVoices = activeCategory === 'platform' ? PLATFORM_VOICES : clonedVoices;
  const allCompleted = project.script.every(s => sectionStates[s.id]?.status === 'completed');

  return (
    <div className="flex-1 flex overflow-hidden font-display bg-background-dark">
      <div className="flex-1 flex flex-col w-full h-full overflow-hidden">
        
        {/* Header Area */}
        <div className="p-8 border-b border-white/5 bg-background-dark/50 shrink-0">
            <div className="max-w-6xl mx-auto w-full flex items-end justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2">Voice Over Studio</h2>
                    <p className="text-text-muted">Generate and refine audio for each section of your script.</p>
                </div>
                <div className="flex gap-3">
                     <button 
                        onClick={generateAll}
                        disabled={allCompleted}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-bold rounded-lg border border-white/10 transition-all disabled:opacity-50"
                    >
                        <Icons.Wand2 size={16} /> {allCompleted ? 'All Generated' : 'Generate All Audio'}
                    </button>
                    <button 
                        onClick={onNext}
                        className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg shadow-lg shadow-primary/20 transition-all"
                    >
                        Continue to Storyboard <Icons.ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>

        {/* Content Columns */}
        <div className="flex-1 flex overflow-hidden max-w-[1600px] mx-auto w-full">
            
            {/* Left Column: Script Sections List (Main Focus) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Icons.List size={18} className="text-primary"/>
                        Script Audio Sections
                    </h3>
                    {allCompleted && (
                        <button 
                            onClick={() => playSection(project.script[0].id, true, 0)}
                            className="text-xs font-bold text-primary hover:text-white flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-all"
                        >
                            <Icons.PlayCircle size={14} /> Preview Full Audio
                        </button>
                    )}
                </div>

                <div className="space-y-4 pb-20">
                    {project.script.map((section, idx) => {
                        const state = sectionStates[section.id] || { status: 'idle', isPlaying: false, progress: 0 };
                        
                        return (
                            <div 
                                key={section.id} 
                                className={`bg-[#1e1933] border rounded-xl p-5 transition-all ${
                                    state.isPlaying ? 'border-primary shadow-lg shadow-primary/10' : 'border-white/5 hover:border-white/10'
                                }`}
                            >
                                <div className="flex gap-4">
                                    {/* Section Number */}
                                    <div className="flex flex-col items-center pt-1">
                                        <span className="text-[10px] font-bold text-text-muted bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                            #{String(idx + 1).padStart(2, '0')}
                                        </span>
                                    </div>

                                    {/* Content & Controls */}
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="text-sm font-bold text-white">{section.title}</h4>
                                            <div className="flex items-center gap-2">
                                                {state.status === 'completed' && (
                                                     <span className="text-[10px] font-mono text-text-muted bg-black/30 px-2 py-0.5 rounded">
                                                         {Math.floor(state.duration)}s
                                                     </span>
                                                )}
                                            </div>
                                        </div>

                                        <p className="text-sm text-text-muted leading-relaxed mb-4 line-clamp-2">
                                            {section.content}
                                        </p>

                                        {/* Audio Player / Generator Area */}
                                        <div className="bg-black/30 rounded-lg p-3 border border-white/5 flex items-center justify-between min-h-[56px]">
                                            
                                            {state.status === 'idle' && (
                                                <div className="flex items-center justify-between w-full">
                                                    <span className="text-xs text-text-muted italic flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-white/20"></div>
                                                        Ready to generate
                                                    </span>
                                                    <button 
                                                        onClick={() => generateSection(section.id)}
                                                        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-primary hover:text-white border border-white/10 hover:border-primary text-xs font-bold text-text-muted rounded-lg transition-all"
                                                    >
                                                        <Icons.Wand2 size={12} /> Generate Audio
                                                    </button>
                                                </div>
                                            )}

                                            {state.status === 'generating' && (
                                                <div className="flex items-center justify-center w-full gap-3 py-1">
                                                     <Icons.RefreshCw className="animate-spin text-primary" size={16} />
                                                     <span className="text-xs font-bold text-white">Synthesizing Voice...</span>
                                                </div>
                                            )}

                                            {state.status === 'completed' && (
                                                <div className="flex items-center gap-3 w-full">
                                                    <button 
                                                        onClick={() => state.isPlaying 
                                                            ? setSectionStates(prev => ({ ...prev, [section.id]: { ...prev[section.id], isPlaying: false } })) 
                                                            : playSection(section.id)
                                                        }
                                                        className="size-8 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center text-white shrink-0 transition-transform hover:scale-105"
                                                    >
                                                        {state.isPlaying ? <Icons.Video size={14} /> : <Icons.PlayCircle size={14} />}
                                                    </button>

                                                    {/* Waveform / Progress */}
                                                    <div className="flex-1 h-8 flex items-center gap-[2px] opacity-80">
                                                        {Array.from({ length: 40 }).map((_, i) => (
                                                            <div 
                                                                key={i} 
                                                                className={`w-1 rounded-full transition-all duration-150 ${
                                                                    (i / 40) * 100 < state.progress ? 'bg-primary' : 'bg-white/20'
                                                                }`}
                                                                style={{ height: `${30 + Math.random() * 70}%` }}
                                                            ></div>
                                                        ))}
                                                    </div>

                                                    <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                                                        <button 
                                                            onClick={() => generateSection(section.id)}
                                                            className="flex items-center gap-2 px-2 py-1.5 text-xs font-bold text-text-muted hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/10"
                                                            title="Regenerate"
                                                        >
                                                            <Icons.RefreshCw size={12} /> Regenerate
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Right Column: Voice Selection Sidebar */}
            <div className="w-96 border-l border-white/5 bg-[#131022] flex flex-col overflow-y-auto custom-scrollbar">
                <div className="p-6 border-b border-white/5">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                        <Icons.Mic size={16} className="text-primary"/> 
                        Global Voice Settings
                    </h3>
                    <p className="text-[10px] text-text-muted">Changes apply to all sections upon regeneration.</p>
                </div>

                <div className="p-6 flex flex-col gap-6">
                    {/* Voice Tabs */}
                    <div className="flex p-1 bg-black/40 rounded-lg border border-white/5">
                        <button 
                            onClick={() => setActiveCategory('platform')}
                            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${activeCategory === 'platform' ? 'bg-white/10 text-white shadow-sm' : 'text-text-muted hover:text-white'}`}
                        >
                            Platform
                        </button>
                        <button 
                             onClick={() => setActiveCategory('cloned')}
                             className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${activeCategory === 'cloned' ? 'bg-white/10 text-white shadow-sm' : 'text-text-muted hover:text-white'}`}
                        >
                            Cloned
                        </button>
                    </div>

                    <div className="space-y-3">
                        {displayVoices.map((voice) => (
                            <div 
                                key={voice.id}
                                onClick={() => handleVoiceSelect(voice.id)}
                                className={`group p-3 rounded-xl border transition-all cursor-pointer relative ${
                                    project.voiceId === voice.id 
                                    ? 'bg-primary/10 border-primary' 
                                    : 'bg-card-bg border-white/5 hover:border-white/20'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`size-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                                        project.voiceId === voice.id ? 'bg-primary' : 'bg-[#2a2440]'
                                    }`}>
                                        {voice.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center">
                                            <h4 className={`text-xs font-bold truncate ${project.voiceId === voice.id ? 'text-white' : 'text-white/80'}`}>{voice.name}</h4>
                                            {project.voiceId === voice.id && <Icons.CheckCircle size={12} className="text-primary"/>}
                                        </div>
                                        <p className="text-[10px] text-text-muted truncate">{voice.style} • {voice.gender}</p>
                                    </div>
                                </div>
                                <div className="mt-2 flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); togglePreview(voice.id); }}
                                        className="text-[10px] flex items-center gap-1 text-primary font-bold hover:underline"
                                    >
                                        {previewPlayingId === voice.id ? <Icons.Video size={10} className="animate-pulse"/> : <Icons.PlayCircle size={10} />}
                                        Preview Sample
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Clone CTA */}
                    <div 
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all ${
                            isDragging 
                            ? 'border-primary bg-primary/5' 
                            : 'border-white/10 bg-white/5 hover:border-white/20'
                        }`}
                    >
                        <Icons.UploadCloud size={20} className="text-text-muted mb-2" />
                        <h4 className="text-white font-bold text-xs mb-1">Clone New Voice</h4>
                        <p className="text-[10px] text-text-muted mb-3">Drag audio file here</p>
                        
                        <label className="cursor-pointer">
                            <input 
                                type="file" 
                                className="hidden" 
                                accept="audio/*" 
                                onChange={handleFileSelect} 
                            />
                            <span className="px-3 py-1.5 bg-white text-background-dark font-bold text-[10px] rounded-lg hover:bg-gray-200 transition-colors inline-block shadow-lg">
                                Browse Files
                            </span>
                        </label>
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default VoiceOver;
