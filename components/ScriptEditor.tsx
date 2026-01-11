
import React, { useState, useEffect, useRef } from 'react';
import * as Icons from './Icons';
import { Project, ScriptSection, Character } from '../types';
import { generateScript } from '../services/geminiService';

interface ScriptEditorProps {
  project: Project;
  libraryCharacters: Character[];
  onAddCharacterToLibrary: (char: Character) => void;
  onUpdateLibraryCharacter: (char: Character) => void;
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


const ScriptEditor: React.FC<ScriptEditorProps> = ({ project, libraryCharacters, onAddCharacterToLibrary, onUpdateLibraryCharacter, onUpdateProject, onNext }) => {
  const [concept, setConcept] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [targetDuration, setTargetDuration] = useState<number>(15);
  const [showCharacterPanel, setShowCharacterPanel] = useState(false);
  
  // Script Editing State
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  // Character Creation/Editing State
  const [isCreatingChar, setIsCreatingChar] = useState(false);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [newCharName, setNewCharName] = useState('');
  const [newCharDesc, setNewCharDesc] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  
  // Drag and Drop State
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

  const handleGenerateScript = async () => {
    setIsGenerating(true);
    
    try {
      // Pass characters to the generation service
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

  // Drag Handlers
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

  // Character Management
  const toggleCharacterInProject = (character: Character) => {
     // If we are editing, don't toggle
     if (editingCharacterId) return;

     const exists = project.characters?.some(c => c.id === character.id);
     
     if (exists) {
         // Remove
         onUpdateProject({
             ...project,
             characters: (project.characters || []).filter(c => c.id !== character.id)
         });
     } else {
         // Add
         onUpdateProject({
             ...project,
             characters: [...(project.characters || []), character]
         });
     }
  };

  const resetCharacterForm = () => {
      setNewCharName('');
      setNewCharDesc('');
      setFormImageUrl('');
      setEditingCharacterId(null);
      setIsCreatingChar(false);
  };

  const startCreating = () => {
    resetCharacterForm();
    setIsCreatingChar(true);
  };

  const handleGenerateCharacterImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    // Generate a new random image based on name + timestamp to force refresh
    const seed = `${newCharName.trim() || 'character'}_${Date.now()}`;
    setFormImageUrl(`https://picsum.photos/seed/${seed}/200/200`);
  };

  const handleSaveCharacter = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!newCharName.trim()) return;

    if (editingCharacterId) {
        // UPDATE EXISTING
        const updatedChar: Character = {
            id: editingCharacterId,
            name: newCharName,
            description: newCharDesc,
            imageUrl: formImageUrl // Use current form image (which might be newly generated)
        };
        onUpdateLibraryCharacter(updatedChar);
    } else {
        // CREATE NEW
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

  const handleEditClick = (e: React.MouseEvent, character: Character) => {
      e.stopPropagation();
      setIsCreatingChar(false); // Disable create mode if active
      setEditingCharacterId(character.id);
      setNewCharName(character.name);
      setNewCharDesc(character.description);
      setFormImageUrl(character.imageUrl);
      setShowCharacterPanel(true);
  };

  const removeCharacterFromProject = (charId: string) => {
      onUpdateProject({
          ...project,
          characters: (project.characters || []).filter(c => c.id !== charId)
      });
  };

  useEffect(() => {
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(ta => {
        ta.style.height = 'auto';
        ta.style.height = `${ta.scrollHeight}px`;
    });
  }, [project.script, editingSectionId]);

  const DURATION_PRESETS = [8, 15, 30, 60, 90, 120];

  // Helper to render the inline form
  const renderForm = (isEdit: boolean) => (
    <div 
        className={`bg-[#1e1933] rounded-xl border p-5 space-y-4 cursor-default animate-in fade-in zoom-in-95 duration-200 shadow-2xl relative overflow-hidden ${isEdit ? 'border-primary' : 'border-dashed border-white/20'}`} 
        onClick={e => e.stopPropagation()}
    >
        {/* Background gradient for depth */}
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-black/20 to-transparent pointer-events-none" />

        <div className="flex items-center justify-between relative z-10">
            <h4 className="text-xs font-bold text-primary uppercase tracking-widest">{isEdit ? 'Edit Character' : 'New Character'}</h4>
            <button onClick={resetCharacterForm} className="text-text-muted hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors"><Icons.X size={14}/></button>
        </div>

        <div className="flex flex-col gap-4 relative z-10">
             {/* Image Section */}
             <div className="flex items-start gap-4">
                 <div className="flex flex-col gap-2">
                     <div className="size-20 shrink-0 bg-black rounded-lg border border-white/20 overflow-hidden relative shadow-inner">
                        {formImageUrl ? (
                            <img src={formImageUrl} className="w-full h-full object-cover" alt="Preview"/>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-white/5">
                                <Icons.User className="text-text-muted opacity-50" size={24}/>
                            </div>
                        )}
                     </div>
                 </div>
                 
                 <div className="flex-1">
                     <label className="text-[9px] font-bold text-text-muted uppercase mb-1 block">Character Name</label>
                     <input 
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none placeholder:text-text-muted/30 focus:bg-black/60 transition-colors"
                        placeholder="e.g. Cyber Samurai"
                        value={newCharName}
                        onChange={(e) => setNewCharName(e.target.value)}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                    />
                    <button 
                        onClick={handleGenerateCharacterImage}
                        className="mt-2 text-[10px] font-bold text-primary hover:text-primary/80 flex items-center gap-1.5 transition-colors"
                    >
                        <Icons.RefreshCw size={12} />
                        Generate New Look
                    </button>
                 </div>
             </div>
             
             {/* Description */}
             <div>
                <label className="text-[9px] font-bold text-text-muted uppercase mb-1 block">Visual Description</label>
                <textarea 
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/90 focus:border-primary focus:outline-none resize-none placeholder:text-text-muted/30 min-h-[80px] focus:bg-black/60 transition-colors leading-relaxed"
                    placeholder="Describe their appearance, style, and distinctive features..."
                    value={newCharDesc}
                    onChange={(e) => setNewCharDesc(e.target.value)}
                    onClick={e => e.stopPropagation()}
                />
             </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 pt-2 border-t border-white/5 relative z-10">
             <button onClick={resetCharacterForm} className="flex-1 py-2 rounded-lg text-xs font-bold text-text-muted hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
             <button onClick={handleSaveCharacter} className="flex-1 py-2 bg-primary hover:bg-primary/90 rounded-lg text-xs font-bold text-white shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                 <Icons.Save size={14} />
                 {isEdit ? 'Save Changes' : 'Create'}
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
                        onClick={() => setShowCharacterPanel(true)}
                        className="text-xs font-bold flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-[#1e1933] text-text-muted border-white/10 hover:text-white hover:border-primary/50 transition-all"
                    >
                        <Icons.User size={14} /> Open Character Library
                    </button>
                 </div>
            </div>

            {/* Active Project Cast Strip */}
            {(project.characters || []).length > 0 && (
                <div className="flex gap-3 mb-4 overflow-x-auto pb-2 custom-scrollbar">
                    {project.characters?.map(char => (
                        <div key={char.id} className="relative group shrink-0">
                            <div className="flex items-center gap-3 bg-[#1e1933] border border-white/10 rounded-full pr-4 pl-1 py-1 group-hover:border-primary/30 transition-colors cursor-pointer" onClick={(e) => handleEditClick(e, char)}>
                                <img src={char.imageUrl} alt={char.name} className="size-8 rounded-full object-cover border border-white/10" />
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-white leading-none">{char.name}</span>
                                    <span className="text-[9px] text-text-muted leading-none mt-0.5 max-w-[100px] truncate">{char.description}</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => removeCharacterFromProject(char.id)}
                                className="absolute -top-1 -right-1 bg-background-dark border border-white/10 text-text-muted hover:text-red-400 hover:border-red-400/50 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow-lg z-10"
                                title="Remove from script cast"
                            >
                                <Icons.X size={10} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            
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

                <button 
                  onClick={handleGenerateScript}
                  disabled={isGenerating}
                  className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50 transition-all"
                >
                  {isGenerating ? (
                     <Icons.RefreshCw className="animate-spin" size={14} />
                  ) : (
                     <Icons.Wand2 size={14} />
                  )}
                  {isGenerating ? 'Generating...' : 'Generate Initial Script'}
                </button>
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
                          <a 
                              key={idx} 
                              href={source.uri} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-xs text-white/70 hover:text-primary transition-colors truncate p-1.5 hover:bg-white/5 rounded"
                          >
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

            {project.script.map((section, idx) => (
              <div 
                key={section.id} 
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`group bg-card-bg border rounded-2xl overflow-hidden transition-all flex flex-col ${
                  draggedItemIndex === idx ? 'opacity-50 border-primary border-dashed' : 'border-border-color hover:border-primary/40'
                } ${
                  dragOverIndex === idx ? 'border-t-2 border-t-primary transform translate-y-2' : ''
                }`}
              >
                <div className="flex items-center justify-between px-3 py-3 border-b border-white/5 bg-white/5 cursor-move">
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

                <div className="px-5 pb-5 flex items-center gap-3 pt-4 border-t border-white/5">
                    <div className="flex-1 relative">
                      <Icons.Wand2 className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" size={14} />
                      <input 
                        className="w-full bg-[#1e1933] border border-white/5 rounded-lg py-2 pl-10 pr-4 text-xs text-text-muted focus:text-white focus:border-primary focus:outline-none" 
                        placeholder="Ask AI to adjust this section... (e.g., 'Make it more dramatic')" 
                        type="text"
                        onMouseDown={(e) => e.stopPropagation()} 
                      />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap">
                      <Icons.RefreshCw size={14} />
                      Regenerate
                    </button>
                  </div>
              </div>
            ))}
            
            <button className="flex items-center justify-center gap-2 py-8 border-2 border-dashed border-white/5 hover:border-primary/40 hover:bg-primary/5 rounded-2xl transition-all group text-text-muted hover:text-primary">
              <Icons.Plus size={20} />
              <span className="text-sm font-bold">Add New Script Section</span>
            </button>
          </div>
        </div>
      </div>

      {/* Character Library Sidebar */}
      {showCharacterPanel && (
          <aside className="w-80 border-l border-border-color bg-[#0d0b1a] flex flex-col transition-all duration-300 animate-in slide-in-from-right h-full">
            <div className="px-5 py-4 border-b border-border-color flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2 text-white">
                    <Icons.User className="text-primary" size={18} />
                    Global Library
                </h3>
                <button onClick={() => setShowCharacterPanel(false)} className="text-text-muted hover:text-white">
                    <Icons.X size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                
                {/* Creation Form (New Card) or Button */}
                {isCreatingChar ? (
                   <div className="mb-4">
                       {renderForm(false)}
                   </div>
                ) : (
                    <button 
                        onClick={startCreating}
                        className="w-full py-3 mb-6 border-2 border-dashed border-white/10 hover:border-primary/50 hover:bg-primary/5 rounded-xl text-xs font-bold text-text-muted hover:text-primary transition-all flex items-center justify-center gap-2"
                    >
                        <Icons.Plus size={16}/> Create Character
                    </button>
                )}

                <div className="space-y-4">
                    {libraryCharacters.map((char) => {
                        // If we are editing this specific character, render the form instead of the card
                        if (editingCharacterId === char.id) {
                            return (
                                <div key={char.id}>
                                    {renderForm(true)}
                                </div>
                            );
                        }

                        const isInProject = project.characters?.some(c => c.id === char.id);
                        return (
                            <div 
                                key={char.id} 
                                onClick={() => toggleCharacterInProject(char)}
                                className={`group bg-card-bg border rounded-xl overflow-hidden transition-all cursor-pointer ${
                                    isInProject ? 'border-primary/50 opacity-60' : 'border-white/5 hover:border-white/20'
                                }`}
                            >
                                <div className="h-40 bg-black relative">
                                    <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover" />
                                    {isInProject && (
                                        <div className="absolute inset-0 bg-black/60 group-hover:bg-black/40 transition-colors flex items-center justify-center backdrop-blur-sm">
                                            <div className="flex items-center gap-1 text-primary font-bold text-xs bg-black/50 px-3 py-1.5 rounded-full border border-primary/20">
                                                <Icons.CheckCircle size={12}/> Added to Cast
                                            </div>
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={(e) => handleEditClick(e, char)}
                                            className="p-1.5 bg-black/50 text-white rounded hover:bg-primary"
                                        >
                                            <Icons.Edit3 size={12}/>
                                        </button>
                                    </div>
                                </div>
                                <div className="p-3">
                                    <h4 className="text-sm font-bold text-white flex justify-between">
                                        {char.name}
                                        {!isInProject && <Icons.Plus size={14} className="text-text-muted group-hover:text-primary"/>}
                                    </h4>
                                    <p className="text-[10px] text-text-muted line-clamp-2 mt-1">{char.description}</p>
                                </div>
                            </div>
                        );
                    })}
                    
                    {libraryCharacters.length === 0 && !isCreatingChar && (
                        <div className="text-center text-text-muted text-xs py-4">
                            Your library is empty.
                        </div>
                    )}
                </div>
            </div>
            
            <div className="p-4 border-t border-white/5 bg-[#0d0b1a] text-[10px] text-text-muted">
                 Click a character to toggle them in this project's active cast.
            </div>
          </aside>
      )}

    </div>
  );
};

export default ScriptEditor;
