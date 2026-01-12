
import React, { useState, useEffect, useRef } from 'react';
import * as Icons from './Icons';
import { Project, ScriptSection, Character, Voice } from '../types';
import { generateScript, generateSpeech } from '../services/geminiService';

interface ScriptEditorProps {
  project: Project;
  libraryCharacters: Character[];
  clonedVoices: Voice[];
  onAddCharacterToLibrary: (char: Character) => void;
  onUpdateLibraryCharacter: (char: Character) => void;
  onAddClonedVoice: (voice: Voice) => void;
  onUpdateProject: (project: Project) => void;
  onNext: () => void;
}

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
    'Watercolor'
];

// Mock Data for Platform Voices (Moved from VoiceOver.tsx)
const PLATFORM_VOICES: Voice[] = [
  { id: 'v_puck', name: 'Puck', category: 'platform', style: 'Energetic', gender: 'Male' },
  { id: 'v_kore', name: 'Kore', category: 'platform', style: 'Calm & Soothing', gender: 'Female' },
  { id: 'v_fenrir', name: 'Fenrir', category: 'platform', style: 'Deep & Authoritative', gender: 'Male' },
  { id: 'v_charon', name: 'Charon', category: 'platform', style: 'Narrative Storyteller', gender: 'Male' },
  { id: 'v_zephyr', name: 'Zephyr', category: 'platform', style: 'Friendly Assistant', gender: 'Female' },
];

// Audio State Types
type SectionAudioStatus = 'idle' | 'generating' | 'completed';
interface SectionState {
    status: SectionAudioStatus;
    isPlaying: boolean;
    progress: number;
    duration: number; // in seconds
}

// -- Subcomponent for Character Popover --
const CharacterTooltip: React.FC<{ character: Character; children: React.ReactNode }> = ({ character, children }) => {
    const [isVisible, setIsVisible] = useState(false);
    
    return (
        <span 
            className="relative inline-block"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            <span className="text-primary font-bold cursor-pointer border-b border-primary/30 border-dashed hover:border-solid bg-primary/10 px-0.5 rounded">
                {children}
            </span>
            {isVisible && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-background-dark border border-white/10 rounded-xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
                     <div className="aspect-square w-full rounded-lg bg-black mb-2 overflow-hidden border border-white/5">
                        <img src={character.imageUrl} alt={character.name} className="w-full h-full object-cover" />
                     </div>
                     <p className="text-white font-bold text-xs">{character.name}</p>
                     <p className="text-[10px] text-text-muted line-clamp-2">{character.description}</p>
                </div>
            )}
        </span>
    );
};

// -- Subcomponent for Rendering Script Text with Highlights --
const ScriptContentRenderer: React.FC<{ 
    content: string; 
    characters: Character[]; 
    onEdit: () => void 
}> = ({ content, characters, onEdit }) => {
    
    // Simple parser to identify character names
    const renderContent = () => {
        if (!characters || characters.length === 0) return content;

        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        
        // Construct a regex to find all character names (case insensitive)
        // Sort by length desc to match longer names first
        const names = characters.map(c => c.name).sort((a,b) => b.length - a.length).join('|');
        if(!names) return content;

        const regex = new RegExp(`\\b(${names})\\b`, 'gi');
        
        let match;
        while ((match = regex.exec(content)) !== null) {
            // Push text before match
            if (match.index > lastIndex) {
                parts.push(content.substring(lastIndex, match.index));
            }

            const matchedName = match[0];
            const character = characters.find(c => c.name.toLowerCase() === matchedName.toLowerCase());

            if (character) {
                parts.push(
                    <CharacterTooltip key={match.index} character={character}>
                        {matchedName}
                    </CharacterTooltip>
                );
            } else {
                parts.push(matchedName);
            }

            lastIndex = regex.lastIndex;
        }

        // Push remaining text
        if (lastIndex < content.length) {
            parts.push(content.substring(lastIndex));
        }

        return parts;
    };

    return (
        <div 
            onClick={onEdit} 
            className="w-full min-h-[50px] p-5 text-sm leading-relaxed text-white/90 whitespace-pre-wrap cursor-text hover:bg-white/5 transition-colors rounded-lg border border-transparent hover:border-white/5"
        >
            {renderContent()}
        </div>
    );
};


const ScriptEditor: React.FC<ScriptEditorProps> = ({ 
    project, 
    libraryCharacters, 
    clonedVoices,
    onAddCharacterToLibrary, 
    onUpdateLibraryCharacter,
    onAddClonedVoice,
    onUpdateProject, 
    onNext 
}) => {
  const [concept, setConcept] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [targetDuration, setTargetDuration] = useState<number>(15);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [activePanelTab, setActivePanelTab] = useState<'cast' | 'voice'>('cast');
  
  // Script Editing State
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  // Audio / Voice State
  const [sectionStates, setSectionStates] = useState<Record<string, SectionState>>({});
  const [voiceCategory, setVoiceCategory] = useState<'platform' | 'cloned'>('platform');
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);
  const [isDraggingVoice, setIsDraggingVoice] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Keep a ref to the latest project to solve race conditions in async loops
  const projectRef = useRef(project);
  useEffect(() => {
      projectRef.current = project;
  }, [project]);

  // Character Creation/Editing State
  const [isCreatingChar, setIsCreatingChar] = useState(false);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [newCharName, setNewCharName] = useState('');
  const [newCharDesc, setNewCharDesc] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  
  // Drag and Drop State (Sections)
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Initialize section states for audio
  useEffect(() => {
      const initialStates: Record<string, SectionState> = {};
      project.script.forEach(section => {
          if (!sectionStates[section.id]) {
              initialStates[section.id] = {
                  status: section.audioUrl ? 'completed' : 'idle',
                  isPlaying: false,
                  progress: 0,
                  duration: Math.max(5, section.content.length / 15)
              };
          }
      });
      if (Object.keys(initialStates).length > 0) {
          setSectionStates(prev => ({ ...prev, ...initialStates }));
      }
  }, [project.script]);

  // Cleanup audio on unmount
  useEffect(() => {
      return () => {
          if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current = null;
          }
      };
  }, []);

  const handleAutoResize = (e: React.FormEvent<HTMLTextAreaElement> | HTMLTextAreaElement) => {
    const target = ((e as React.FormEvent<HTMLTextAreaElement>).currentTarget || e) as HTMLTextAreaElement;
    target.style.height = 'auto';
    target.style.height = `${target.scrollHeight}px`;
  };

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  };

  const updateVisualStyle = (style: string) => {
      onUpdateProject({ ...project, visualStyle: style });
  };

  // --- Voice Handlers ---
  const handleVoiceSelect = (voiceId: string) => {
    onUpdateProject({ ...project, voiceId });
  };

  const generateAudioSection = async (sectionId: string) => {
      setSectionStates(prev => ({
          ...prev,
          [sectionId]: { ...prev[sectionId], status: 'generating' }
      }));
      
      try {
          // Use projectRef to always get the latest state, even in a loop
          const currentProject = projectRef.current;
          const section = currentProject.script.find(s => s.id === sectionId);
          if (!section) throw new Error("Section not found");

          const selectedVoice = PLATFORM_VOICES.find(v => v.id === currentProject.voiceId);
          const voiceName = selectedVoice ? selectedVoice.name : 'Kore';

          const audioUrl = await generateSpeech(section.content, voiceName);

          // Update project with persisted audio URL using the REF to ensure we don't overwrite previous loop iterations
          const updatedScript = projectRef.current.script.map(s => 
            s.id === sectionId ? { ...s, audioUrl } : s
          );
          onUpdateProject({ ...projectRef.current, script: updatedScript });

          setSectionStates(prev => ({
              ...prev,
              [sectionId]: { ...prev[sectionId], status: 'completed', duration: 0 } // Duration will be set on load
          }));
      } catch (e) {
          console.error("Failed to generate audio", e);
          setSectionStates(prev => ({
              ...prev,
              [sectionId]: { ...prev[sectionId], status: 'idle' }
          }));
      }
  };

  const playAudioSection = (sectionId: string) => {
      // Use Ref to ensure we play the latest audioUrl even if it was just generated
      const section = projectRef.current.script.find(s => s.id === sectionId);
      if (!section?.audioUrl) return;

      // Stop currently playing if any
      if (audioRef.current) {
          audioRef.current.pause();
      } else {
          audioRef.current = new Audio();
      }

      // Reset states
      setSectionStates(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(key => {
              if (next[key].isPlaying) next[key] = { ...next[key], isPlaying: false, progress: 0 };
          });
          next[sectionId] = { ...next[sectionId], isPlaying: true };
          return next;
      });

      const audio = audioRef.current;
      audio.src = section.audioUrl;
      audio.load();
      
      audio.ontimeupdate = () => {
          if (audio.duration) {
             setSectionStates(prev => ({
                 ...prev,
                 [sectionId]: { 
                     ...prev[sectionId], 
                     progress: (audio.currentTime / audio.duration) * 100 
                 }
             }));
          }
      };

      audio.onended = () => {
          setSectionStates(prev => ({
              ...prev,
              [sectionId]: { ...prev[sectionId], isPlaying: false, progress: 0 }
          }));
      };

      audio.onloadedmetadata = () => {
          setSectionStates(prev => ({
              ...prev,
              [sectionId]: { ...prev[sectionId], duration: audio.duration }
          }));
      };

      audio.play().catch(e => console.error("Playback failed", e));
  };

  const generateAllAudio = async () => {
    // Determine IDs based on current state (Ref is safer but props usually OK for initial check)
    const idsToGenerate = project.script.filter(s => !s.audioUrl).map(s => s.id);
    if (idsToGenerate.length === 0) return;

    setSectionStates(prev => {
        const next = { ...prev };
        idsToGenerate.forEach(id => {
            if (next[id]) next[id] = { ...next[id], status: 'generating' };
        });
        return next;
    });

    // Sequential generation to avoid rate limits and ensure state updates propagate
    for (const id of idsToGenerate) {
        await generateAudioSection(id);
        // Small delay to ensure React state updates have time to propagate to the Ref
        await new Promise(r => setTimeout(r, 100));
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
      onAddClonedVoice(newVoice);
      setVoiceCategory('cloned');
      handleVoiceSelect(newVoice.id);
  };

  const handleVoiceDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingVoice(false);
    createClonedVoice();
  };

  const toggleVoicePreview = (id: string) => {
    if (previewPlayingId === id) {
      setPreviewPlayingId(null);
    } else {
      setPreviewPlayingId(id);
      setTimeout(() => setPreviewPlayingId(null), 3000);
    }
  };

  // --- Script Generation ---
  const handleGenerateScript = async () => {
    setIsGenerating(true);
    try {
      const { content, sources } = await generateScript(concept, useSearch, targetDuration, project.characters);
      
      let newSections: ScriptSection[] = [];
      try {
        const parsed = JSON.parse(content);
        if (parsed.sections && Array.isArray(parsed.sections)) {
          newSections = parsed.sections.map((s: any, i: number) => ({
            id: `s${Date.now()}_${i}`,
            title: s.title || `Section ${i+1}`,
            content: s.content || "",
            duration: '00:30' 
          }));
        }
      } catch (e) {
         newSections = [{
          id: `s${Date.now()}`,
          title: 'Generated Section',
          content: content || "AI generated content...",
          duration: '00:30'
        }];
      }

      onUpdateProject({
        ...project,
        script: [...project.script, ...newSections],
        sources: sources.length > 0 ? sources : project.sources
      });
      
    } catch (e) {
      console.error("Failed to generate", e);
    } finally {
      setIsGenerating(false);
      setConcept('');
    }
  };

  const updateSection = (id: string, field: keyof ScriptSection, value: string) => {
    const updatedScript = project.script.map(section => 
      section.id === id ? { ...section, [field]: value } : section
    );
    onUpdateProject({ ...project, script: updatedScript });
  };

  const removeSection = (id: string) => {
    const updatedScript = project.script.filter(section => section.id !== id);
    onUpdateProject({ ...project, script: updatedScript });
  };

  // --- Drag Handlers (Sections) ---
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === index) return;
    setDragOverIndex(index);
  };
  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) {
      setDragOverIndex(null);
      return;
    }
    const newScript = [...project.script];
    const itemToMove = newScript[draggedItemIndex];
    newScript.splice(draggedItemIndex, 1);
    newScript.splice(index, 0, itemToMove);
    onUpdateProject({ ...project, script: newScript });
    setDraggedItemIndex(null);
    setDragOverIndex(null);
  };
  const handleDragEnd = () => {
    setDraggedItemIndex(null);
    setDragOverIndex(null);
  };

  // --- Character Logic ---
  const toggleCharacterInProject = (character: Character) => {
     if (editingCharacterId) return;
     const exists = project.characters?.some(c => c.id === character.id);
     if (exists) {
         onUpdateProject({ ...project, characters: (project.characters || []).filter(c => c.id !== character.id) });
     } else {
         onUpdateProject({ ...project, characters: [...(project.characters || []), character] });
     }
  };

  const resetCharacterForm = () => {
      setNewCharName('');
      setNewCharDesc('');
      setFormImageUrl('');
      setEditingCharacterId(null);
      setIsCreatingChar(false);
  };

  const handleSaveCharacter = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!newCharName.trim()) return;

    if (editingCharacterId) {
        const updatedChar: Character = { id: editingCharacterId, name: newCharName, description: newCharDesc, imageUrl: formImageUrl };
        onUpdateLibraryCharacter(updatedChar);
    } else {
        const newCharacter: Character = {
            id: `char_${Date.now()}`,
            name: newCharName,
            description: newCharDesc,
            imageUrl: formImageUrl || `https://picsum.photos/seed/${newCharName}/200/200`
        };
        onAddCharacterToLibrary(newCharacter);
        toggleCharacterInProject(newCharacter);
    }
    resetCharacterForm();
  };

  useEffect(() => {
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(ta => {
        ta.style.height = 'auto';
        ta.style.height = `${ta.scrollHeight}px`;
    });
  }, [project.script, editingSectionId]);

  const DURATION_PRESETS = [8, 15, 30, 60, 90, 120];

  // Helper to render the inline character form
  const renderForm = (isEdit: boolean) => (
    <div 
        className={`bg-[#1e1933] rounded-xl border p-5 space-y-4 cursor-default animate-in fade-in zoom-in-95 duration-200 shadow-2xl relative overflow-hidden ${isEdit ? 'border-primary' : 'border-dashed border-white/20'}`} 
        onClick={e => e.stopPropagation()}
    >
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-black/20 to-transparent pointer-events-none" />
        <div className="flex items-center justify-between relative z-10">
            <h4 className="text-xs font-bold text-primary uppercase tracking-widest">{isEdit ? 'Edit Character' : 'New Character'}</h4>
            <button onClick={resetCharacterForm} className="text-text-muted hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors"><Icons.X size={14}/></button>
        </div>
        <div className="flex flex-col gap-4 relative z-10">
             <div className="flex items-start gap-4">
                 <div className="flex flex-col gap-2">
                     <div className="size-20 shrink-0 bg-black rounded-lg border border-white/20 overflow-hidden relative shadow-inner">
                        {formImageUrl ? (
                            <img src={formImageUrl} className="w-full h-full object-cover" alt="Preview"/>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-white/5"><Icons.User className="text-text-muted opacity-50" size={24}/></div>
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

  return (
    <div className="flex-1 flex overflow-hidden font-display bg-background-dark">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-panel-bg">
        
        {/* Input & Controls Header */}
        <div className="p-8 border-b border-border-color bg-background-dark/40 shrink-0 overflow-y-auto max-h-[50vh] custom-scrollbar">
          <div className="max-w-4xl mx-auto w-full">
            <div className="flex items-center justify-between mb-3">
                 <label className="block text-[10px] text-primary font-bold uppercase tracking-[0.2em]">Script Ideas & Prompts</label>
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-muted">
                        Cast: {project.characters?.length || 0}
                    </span>
                    <button 
                        onClick={() => { setShowRightPanel(true); setActivePanelTab('cast'); }}
                        className="text-xs font-bold flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-[#1e1933] text-text-muted border-white/10 hover:text-white hover:border-primary/50 transition-all"
                    >
                        <Icons.User size={14} /> Character Library
                    </button>
                     <button 
                        onClick={() => { setShowRightPanel(true); setActivePanelTab('voice'); }}
                        className="text-xs font-bold flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-[#1e1933] text-text-muted border-white/10 hover:text-white hover:border-primary/50 transition-all"
                    >
                        <Icons.Mic size={14} /> Voice Settings
                    </button>
                 </div>
            </div>

            <div className="relative group">
              <textarea 
                className="w-full bg-[#1e1933] border border-white/10 rounded-xl p-5 text-sm text-white/90 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 leading-relaxed shadow-2xl transition-all resize-none mb-3 overflow-hidden" 
                placeholder="Enter your core video concept, themes, or specific instructions here..."
                value={concept}
                onChange={(e) => {
                    setConcept(e.target.value);
                    handleAutoResize(e);
                }}
                onInput={handleAutoResize}
                rows={3}
              />
              
              <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#1e1933]/50 border border-white/5 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                              <Icons.Clock size={14} className="text-primary"/>
                              <span className="text-xs font-bold text-white uppercase tracking-wider">Target Duration</span>
                          </div>
                          <span className="text-sm font-bold text-white bg-white/10 px-2 py-0.5 rounded">{formatDuration(targetDuration)}</span>
                      </div>
                      
                      <div className="flex flex-col gap-4">
                          <input 
                              type="range" 
                              min="1" 
                              max="120" 
                              value={targetDuration} 
                              onChange={(e) => setTargetDuration(parseInt(e.target.value))}
                              className="w-full h-1.5 bg-white/10 rounded-full appearance-none accent-primary cursor-pointer"
                          />
                          <div className="flex flex-wrap gap-2">
                              {DURATION_PRESETS.map((mins) => (
                                  <button
                                  key={mins}
                                  onClick={() => setTargetDuration(mins)}
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

                  <div className="bg-[#1e1933]/50 border border-white/5 rounded-xl p-4 flex flex-col">
                      <div className="flex items-center gap-2 mb-3">
                          <Icons.ImageIcon size={14} className="text-primary"/>
                          <span className="text-xs font-bold text-white uppercase tracking-wider">Visual Style</span>
                      </div>
                      <div className="relative flex-1">
                           <select 
                              value={project.visualStyle || 'Cinematic'}
                              onChange={(e) => updateVisualStyle(e.target.value)}
                              className="w-full h-full bg-[#0d0b1a] border border-white/10 rounded-lg pl-4 pr-10 text-sm text-white appearance-none focus:border-primary focus:outline-none cursor-pointer"
                          >
                              {VISUAL_STYLES.map(style => (
                                  <option key={style} value={style}>{style}</option>
                              ))}
                          </select>
                          <Icons.ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={16} />
                      </div>
                  </div>
              </div>

              {/* Active Project Cast Strip */}
              {(project.characters || []).length > 0 && (
                <div className="mb-4">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2 block pl-1">Cast to Include</label>
                    <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                        {project.characters?.map(char => (
                            <div key={char.id} className="relative group shrink-0">
                                <div className="flex items-center gap-3 bg-[#1e1933] border border-white/10 rounded-full pr-4 pl-1 py-1 group-hover:border-primary/30 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowRightPanel(true); setActivePanelTab('cast'); }}>
                                    <img src={char.imageUrl} alt={char.name} className="size-8 rounded-full object-cover border border-white/10" />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-white leading-none">{char.name}</span>
                                        <span className="text-[9px] text-text-muted leading-none mt-0.5 max-w-[100px] truncate">{char.description}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
                      onClick={generateAllAudio}
                      className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-2"
                    >
                      <Icons.Mic size={14} /> Generate All Audio
                    </button>
                    <button 
                      onClick={handleGenerateScript}
                      disabled={isGenerating}
                      className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50 transition-all"
                    >
                      {isGenerating ? <Icons.RefreshCw className="animate-spin" size={14} /> : <Icons.Wand2 size={14} />}
                      {isGenerating ? 'Generating...' : 'Generate Initial Script'}
                    </button>
                </div>
              </div>
            </div>

            {project.sources && project.sources.length > 0 && (
               <div className="mt-4 p-4 bg-[#1e1933]/50 border border-white/5 rounded-xl">
                   <h4 className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Icons.Globe size={12} className="text-blue-400"/>
                      Sources Used
                   </h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {project.sources.map((source, idx) => (
                          <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-white/70 hover:text-primary transition-colors truncate p-1.5 hover:bg-white/5 rounded">
                              <span className="w-1 h-1 rounded-full bg-blue-400 shrink-0"></span>
                              <span className="truncate">{source.title}</span>
                          </a>
                      ))}
                   </div>
               </div>
            )}
          </div>
        </div>

        {/* Script Sections List */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto flex flex-col gap-6 pb-20">
            <h3 className="text-xs text-text-muted font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
              <span className="w-8 h-[1px] bg-white/10"></span>
              Script Sections
              <span className="flex-1 h-[1px] bg-white/10"></span>
            </h3>

            {project.script.map((section, idx) => {
              const audioState = sectionStates[section.id] || { status: 'idle', isPlaying: false, progress: 0 };
              
              return (
              <div 
                key={section.id} 
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`group bg-card-bg border rounded-2xl transition-all flex flex-col relative ${
                  draggedItemIndex === idx ? 'opacity-50 border-primary border-dashed' : 'border-border-color hover:border-primary/40'
                } ${
                  dragOverIndex === idx ? 'border-t-2 border-t-primary transform translate-y-2' : ''
                }`}
              >
                <div className="flex items-center justify-between px-3 py-3 border-b border-white/5 bg-white/5 cursor-move rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <div className="text-text-muted hover:text-white cursor-grab active:cursor-grabbing p-1">
                        <Icons.GripVertical size={16} />
                    </div>
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">SECTION {String(idx + 1).padStart(2, '0')}</span>
                    <input 
                        className="bg-transparent border-none focus:ring-0 text-xs font-bold text-white/70 focus:text-white p-0"
                        value={section.title}
                        onChange={(e) => updateSection(section.id, 'title', e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 text-text-muted hover:text-white transition-colors"><Icons.Copy size={16} /></button>
                    <button 
                        onClick={() => removeSection(section.id)}
                        className="p-1.5 text-text-muted hover:text-red-400 transition-colors"
                    >
                        <Icons.Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                {/* Content Area - Toggles between Edit and View */}
                {editingSectionId === section.id ? (
                    <div className="p-5 flex flex-col gap-4">
                        <textarea 
                            autoFocus
                            className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm leading-relaxed resize-none text-white/90 overflow-hidden" 
                            spellCheck={false}
                            value={section.content}
                            onChange={(e) => {
                                updateSection(section.id, 'content', e.target.value);
                                handleAutoResize(e);
                            }}
                            onInput={handleAutoResize}
                            onBlur={() => setEditingSectionId(null)}
                            rows={2}
                        />
                        <div className="flex justify-end">
                            <button onMouseDown={() => setEditingSectionId(null)} className="text-xs text-primary font-bold hover:underline">Done Editing</button>
                        </div>
                    </div>
                ) : (
                    <ScriptContentRenderer 
                        content={section.content} 
                        characters={project.characters || []} 
                        onEdit={() => setEditingSectionId(section.id)}
                    />
                )}

                {/* Section Controls Footer */}
                <div className="px-5 pb-4 pt-2 flex items-center justify-between border-t border-white/5 bg-black/10 rounded-b-2xl">
                     <div className="flex items-center gap-3 w-full">
                        {audioState.status === 'idle' && (
                             <button 
                                onClick={() => generateAudioSection(section.id)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-primary/20 hover:text-primary hover:border-primary/30 border border-white/10 text-xs font-bold text-text-muted rounded-lg transition-all"
                             >
                                <Icons.Mic size={12} /> Generate Voice
                             </button>
                        )}
                        
                        {audioState.status === 'generating' && (
                            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-text-muted">
                                <Icons.RefreshCw className="animate-spin text-primary" size={12} /> Synthesizing...
                            </div>
                        )}

                        {audioState.status === 'completed' && (
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <button 
                                    onClick={() => audioState.isPlaying 
                                        ? (() => { if(audioRef.current) audioRef.current.pause(); })()
                                        : playAudioSection(section.id)
                                    }
                                    className="size-8 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center text-white shrink-0 transition-transform"
                                >
                                    {audioState.isPlaying ? <Icons.Video size={14} /> : <Icons.PlayCircle size={14} />}
                                </button>
                                
                                <div className="flex-1 h-8 flex items-center gap-[2px] opacity-80 min-w-[60px]">
                                    {Array.from({ length: 40 }).map((_, i) => (
                                        <div 
                                            key={i} 
                                            className={`w-1 rounded-full transition-all duration-150 ${
                                                (i / 40) * 100 < audioState.progress ? 'bg-primary' : 'bg-white/20'
                                            }`}
                                            style={{ height: `${30 + Math.random() * 70}%` }}
                                        ></div>
                                    ))}
                                </div>
                                <button 
                                    onClick={() => generateAudioSection(section.id)}
                                    className="text-[10px] font-bold text-text-muted hover:text-white flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 shrink-0"
                                >
                                    <Icons.RefreshCw size={10} /> Regenerate
                                </button>
                            </div>
                        )}

                        {/* Text Refinement Input */}
                         <div className="flex-1 relative ml-4 min-w-[150px]">
                            <Icons.Wand2 className="absolute left-3 top-1/2 -translate-y-1/2 text-primary opacity-50" size={12} />
                            <input 
                                className="w-full bg-transparent border-b border-white/10 py-1.5 pl-8 text-[11px] text-text-muted focus:text-white focus:border-primary focus:outline-none placeholder:text-text-muted/50" 
                                placeholder="AI refine instruction..." 
                                type="text"
                            />
                         </div>
                     </div>
                </div>
              </div>
            )})}
            
            <button className="flex items-center justify-center gap-2 py-8 border-2 border-dashed border-white/5 hover:border-primary/40 hover:bg-primary/5 rounded-2xl transition-all group text-text-muted hover:text-primary">
              <Icons.Plus size={20} />
              <span className="text-sm font-bold">Add New Script Section</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar Panel (Combined Cast & Voice) */}
      {showRightPanel && (
          <aside className="w-80 border-l border-border-color bg-[#0d0b1a] flex flex-col transition-all duration-300 animate-in slide-in-from-right h-full">
            <div className="flex items-center border-b border-white/5">
                <button 
                    onClick={() => setActivePanelTab('cast')}
                    className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center justify-center gap-2 ${activePanelTab === 'cast' ? 'text-white border-primary' : 'text-text-muted border-transparent hover:text-white'}`}
                >
                    <Icons.User size={14}/> Cast
                </button>
                <button 
                    onClick={() => setActivePanelTab('voice')}
                    className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center justify-center gap-2 ${activePanelTab === 'voice' ? 'text-white border-primary' : 'text-text-muted border-transparent hover:text-white'}`}
                >
                    <Icons.Mic size={14}/> Voice
                </button>
                <button onClick={() => setShowRightPanel(false)} className="px-4 text-text-muted hover:text-white border-b-2 border-transparent">
                    <Icons.X size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                
                {/* --- CAST TAB CONTENT --- */}
                {activePanelTab === 'cast' && (
                    <>
                        {isCreatingChar ? (
                            <div className="mb-4">{renderForm(false)}</div>
                        ) : (
                            <button 
                                onClick={() => { resetCharacterForm(); setIsCreatingChar(true); }}
                                className="w-full py-3 mb-6 border-2 border-dashed border-white/10 hover:border-primary/50 hover:bg-primary/5 rounded-xl text-xs font-bold text-text-muted hover:text-primary transition-all flex items-center justify-center gap-2"
                            >
                                <Icons.Plus size={16}/> Create Character
                            </button>
                        )}
                        <div className="space-y-4">
                            {libraryCharacters.map((char) => {
                                if (editingCharacterId === char.id) return <div key={char.id}>{renderForm(true)}</div>;
                                const isInProject = project.characters?.some(c => c.id === char.id);
                                return (
                                    <div 
                                        key={char.id} 
                                        onClick={() => toggleCharacterInProject(char)}
                                        className={`group bg-card-bg border rounded-xl overflow-hidden transition-all cursor-pointer ${isInProject ? 'border-primary/50 opacity-60' : 'border-white/5 hover:border-white/20'}`}
                                    >
                                        <div className="h-40 bg-black relative">
                                            <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover" />
                                            {isInProject && (
                                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                                                    <div className="flex items-center gap-1 text-primary font-bold text-xs bg-black/50 px-3 py-1.5 rounded-full border border-primary/20"><Icons.CheckCircle size={12}/> Added</div>
                                                </div>
                                            )}
                                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={(e) => { e.stopPropagation(); setEditingCharacterId(char.id); setIsCreatingChar(false); setNewCharName(char.name); setNewCharDesc(char.description); setFormImageUrl(char.imageUrl); }} className="p-1.5 bg-black/50 text-white rounded hover:bg-primary"><Icons.Edit3 size={12}/></button>
                                            </div>
                                        </div>
                                        <div className="p-3">
                                            <h4 className="text-sm font-bold text-white flex justify-between">{char.name} {!isInProject && <Icons.Plus size={14} className="text-text-muted group-hover:text-primary"/>}</h4>
                                            <p className="text-[10px] text-text-muted line-clamp-2 mt-1">{char.description}</p>
                                        </div>
                                    </div>
                                );
                            })}
                            {libraryCharacters.length === 0 && !isCreatingChar && <div className="text-center text-text-muted text-xs py-4">Your library is empty.</div>}
                        </div>
                    </>
                )}

                {/* --- VOICE TAB CONTENT --- */}
                {activePanelTab === 'voice' && (
                     <div className="flex flex-col gap-6">
                        <div className="flex p-1 bg-black/40 rounded-lg border border-white/5">
                            <button onClick={() => setVoiceCategory('platform')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${voiceCategory === 'platform' ? 'bg-white/10 text-white shadow-sm' : 'text-text-muted hover:text-white'}`}>Platform</button>
                            <button onClick={() => setVoiceCategory('cloned')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${voiceCategory === 'cloned' ? 'bg-white/10 text-white shadow-sm' : 'text-text-muted hover:text-white'}`}>Cloned</button>
                        </div>

                        <div className="space-y-3">
                            {(voiceCategory === 'platform' ? PLATFORM_VOICES : clonedVoices).map((voice) => (
                                <div 
                                    key={voice.id}
                                    onClick={() => handleVoiceSelect(voice.id)}
                                    className={`group p-3 rounded-xl border transition-all cursor-pointer relative ${project.voiceId === voice.id ? 'bg-primary/10 border-primary' : 'bg-card-bg border-white/5 hover:border-white/20'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`size-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${project.voiceId === voice.id ? 'bg-primary' : 'bg-[#2a2440]'}`}>{voice.name.charAt(0)}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center">
                                                <h4 className={`text-xs font-bold truncate ${project.voiceId === voice.id ? 'text-white' : 'text-white/80'}`}>{voice.name}</h4>
                                                {project.voiceId === voice.id && <Icons.CheckCircle size={12} className="text-primary"/>}
                                            </div>
                                            <p className="text-[10px] text-text-muted truncate">{voice.style} • {voice.gender}</p>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => { e.stopPropagation(); toggleVoicePreview(voice.id); }} className="text-[10px] flex items-center gap-1 text-primary font-bold hover:underline">
                                            {previewPlayingId === voice.id ? <Icons.Video size={10} className="animate-pulse"/> : <Icons.PlayCircle size={10} />} Preview Sample
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {voiceCategory === 'cloned' && clonedVoices.length === 0 && <div className="text-center text-xs text-text-muted italic py-2">No cloned voices yet.</div>}
                        </div>

                        {/* Clone CTA */}
                        <div 
                            onDragOver={(e) => { e.preventDefault(); setIsDraggingVoice(true); }}
                            onDragLeave={() => setIsDraggingVoice(false)}
                            onDrop={handleVoiceDrop}
                            className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all ${isDraggingVoice ? 'border-primary bg-primary/5' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                        >
                            <Icons.UploadCloud size={20} className="text-text-muted mb-2" />
                            <h4 className="text-white font-bold text-xs mb-1">Clone New Voice</h4>
                            <p className="text-[10px] text-text-muted mb-3">Drag audio file here</p>
                            <label className="cursor-pointer">
                                <input type="file" className="hidden" accept="audio/*" onChange={(e) => { if(e.target.files?.length) createClonedVoice(); }} />
                                <span className="px-3 py-1.5 bg-white text-background-dark font-bold text-[10px] rounded-lg hover:bg-gray-200 transition-colors inline-block shadow-lg">Browse Files</span>
                            </label>
                        </div>
                     </div>
                )}
            </div>
            
            <div className="p-4 border-t border-white/5 bg-[#0d0b1a] text-[10px] text-text-muted">
                 {activePanelTab === 'cast' ? "Click a character to toggle them in this project's active cast." : "Select a voice to apply it globally to your script."}
            </div>
          </aside>
      )}

    </div>
  );
};

export default ScriptEditor;
