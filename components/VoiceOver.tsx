import React, { useState } from 'react';
import * as Icons from './Icons';
import { Project, Voice } from '../types';

interface VoiceOverProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
  onNext: () => void;
}

// Mock Data for Platform Voices
const PLATFORM_VOICES: Voice[] = [
  { id: 'v_puck', name: 'Puck', category: 'platform', style: 'Energetic', gender: 'Male' },
  { id: 'v_kore', name: 'Kore', category: 'platform', style: 'Calm & Soothing', gender: 'Female' },
  { id: 'v_fenrir', name: 'Fenrir', category: 'platform', style: 'Deep & Authoritative', gender: 'Male' },
  { id: 'v_charon', name: 'Charon', category: 'platform', style: 'Narrative Storyteller', gender: 'Male' },
  { id: 'v_zephyr', name: 'Zephyr', category: 'platform', style: 'Friendly Assistant', gender: 'Female' },
];

const VoiceOver: React.FC<VoiceOverProps> = ({ project, onUpdateProject, onNext }) => {
  const [activeCategory, setActiveCategory] = useState<'platform' | 'cloned'>('platform');
  const [clonedVoices, setClonedVoices] = useState<Voice[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);

  const handleVoiceSelect = (voiceId: string) => {
    onUpdateProject({ ...project, voiceId });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Mock upload/cloning process
    const newVoice: Voice = {
      id: `v_clone_${Date.now()}`,
      name: `Cloned Voice ${clonedVoices.length + 1}`,
      category: 'cloned',
      style: 'Custom',
      gender: 'Male' // Mock inference
    };
    setClonedVoices([...clonedVoices, newVoice]);
    setActiveCategory('cloned');
    handleVoiceSelect(newVoice.id);
  };

  const togglePreview = (id: string) => {
    if (previewPlayingId === id) {
      setPreviewPlayingId(null);
    } else {
      setPreviewPlayingId(id);
      // Auto-stop preview mock after 3s
      setTimeout(() => setPreviewPlayingId(null), 3000);
    }
  };

  const displayVoices = activeCategory === 'platform' ? PLATFORM_VOICES : clonedVoices;

  return (
    <div className="flex-1 flex overflow-hidden font-display bg-background-dark">
      <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full p-8 overflow-y-auto custom-scrollbar">
        
        {/* Header */}
        <div className="mb-8 flex items-end justify-between">
            <div>
                <h2 className="text-3xl font-bold text-white mb-2">Voice Over Studio</h2>
                <p className="text-text-muted">Select a professional AI narrator or clone your own voice.</p>
            </div>
            <button 
                onClick={onNext}
                className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all"
            >
                Generate Storyboard <Icons.ChevronRight size={18} />
            </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
            
            {/* Left Column: Voice Library */}
            <div className="lg:col-span-2 flex flex-col gap-6">
                
                {/* Tabs */}
                <div className="flex border-b border-white/10">
                    <button 
                        onClick={() => setActiveCategory('platform')}
                        className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${activeCategory === 'platform' ? 'text-white border-primary' : 'text-text-muted border-transparent hover:text-white'}`}
                    >
                        Platform Voices
                    </button>
                    <button 
                         onClick={() => setActiveCategory('cloned')}
                        className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${activeCategory === 'cloned' ? 'text-white border-primary' : 'text-text-muted border-transparent hover:text-white'}`}
                    >
                        My Cloned Voices <span className="ml-2 bg-white/10 px-1.5 py-0.5 rounded text-[10px]">{clonedVoices.length}</span>
                    </button>
                </div>

                {/* Voice Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayVoices.length === 0 && activeCategory === 'cloned' ? (
                        <div className="col-span-2 py-12 flex flex-col items-center justify-center text-text-muted border border-dashed border-white/10 rounded-xl bg-white/5">
                            <Icons.Mic size={32} className="mb-3 opacity-50" />
                            <p className="text-sm">No cloned voices yet. Upload audio to create one.</p>
                        </div>
                    ) : (
                        displayVoices.map((voice) => (
                            <div 
                                key={voice.id}
                                onClick={() => handleVoiceSelect(voice.id)}
                                className={`group p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                                    project.voiceId === voice.id 
                                    ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(234,40,49,0.15)]' 
                                    : 'bg-card-bg border-border-color hover:border-white/20'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`size-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                            project.voiceId === voice.id ? 'bg-primary' : 'bg-[#2a2440]'
                                        }`}>
                                            {voice.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold text-sm">{voice.name}</h4>
                                            <p className="text-[10px] text-text-muted">{voice.gender} • {voice.style}</p>
                                        </div>
                                    </div>
                                    {project.voiceId === voice.id && (
                                        <div className="text-primary bg-primary/20 p-1 rounded-full">
                                            <Icons.CheckCircle size={16} />
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex items-center gap-3 bg-[#0d0b1a] p-2 rounded-lg border border-white/5">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); togglePreview(voice.id); }}
                                        className="size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                                    >
                                        {previewPlayingId === voice.id ? <Icons.Video size={14} className="animate-pulse text-primary"/> : <Icons.PlayCircle size={14} />}
                                    </button>
                                    <div className="flex-1 h-4 flex items-center gap-0.5 opacity-50">
                                         {Array.from({ length: 20 }).map((_, i) => (
                                            <div key={i} className={`flex-1 rounded-full ${previewPlayingId === voice.id ? 'bg-primary animate-pulse' : 'bg-white/30'}`} style={{ height: `${30 + Math.random() * 70}%` }}></div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right Column: Voice Lab / Cloning */}
            <div className="flex flex-col gap-6">
                <div className="bg-gradient-to-br from-card-bg to-[#1a162e] border border-border-color p-6 rounded-2xl">
                    <div className="flex items-center gap-2 mb-4">
                        <Icons.Wand2 className="text-primary" size={20} />
                        <h3 className="text-lg font-bold text-white">Voice Cloning Lab</h3>
                    </div>
                    <p className="text-xs text-text-muted mb-6 leading-relaxed">
                        Create a custom AI voice by uploading a clear audio sample (1-3 minutes) of the speaker. We'll generate a high-fidelity clone for your videos.
                    </p>

                    <div 
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all ${
                            isDragging 
                            ? 'border-primary bg-primary/5 scale-[1.02]' 
                            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                        }`}
                    >
                        <div className="size-16 rounded-full bg-[#1e1933] flex items-center justify-center mb-4 text-text-muted">
                            <Icons.UploadCloud size={32} />
                        </div>
                        <h4 className="text-white font-bold text-sm mb-1">Drag & Drop Audio</h4>
                        <p className="text-[10px] text-text-muted mb-4">MP3, WAV, or M4A (Max 10MB)</p>
                        
                        <label className="cursor-pointer">
                            <input type="file" className="hidden" accept="audio/*" onChange={(e) => { if (e.target.files?.length) handleDrop(e as any); }} />
                            <span className="px-4 py-2 bg-white text-background-dark font-bold text-xs rounded-lg hover:bg-gray-200 transition-colors">
                                Browse Files
                            </span>
                        </label>
                    </div>

                    <div className="mt-6 pt-6 border-t border-white/5">
                        <h4 className="text-[10px] font-bold text-text-muted uppercase mb-3">Voice Settings</h4>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] text-white block mb-1">Stability</label>
                                <input type="range" className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary" />
                            </div>
                            <div>
                                <label className="text-[10px] text-white block mb-1">Similarity Boost</label>
                                <input type="range" className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default VoiceOver;