
import React, { useState } from 'react';
import Layout from './components/Layout';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import ScriptEditor from './components/ScriptEditor';
import Storyboard from './components/Storyboard';
import VideoPreview from './components/VideoPreview';
import CharacterLibrary from './components/CharacterLibrary';
import { ViewState, Project, User, Scene, Character, Voice } from './types';
import { INITIAL_PROJECT } from './constants';

// Mock Initial Global Library
const INITIAL_LIBRARY: Character[] = [
  {
    id: 'char_1',
    name: 'Dr. Ada',
    description: 'A futuristic AI architect with glowing blue cybernetic implants.',
    imageUrl: 'https://picsum.photos/seed/ada/200/200',
  },
  {
    id: 'char_2',
    name: 'Kai',
    description: 'A rebellious cyberpunk hacker with neon green hair and AR goggles.',
    imageUrl: 'https://picsum.photos/seed/kai/200/200',
  },
  {
    id: 'char_3',
    name: 'The narrator',
    description: 'A shadowy figure in a trench coat, face obscured by smoke.',
    imageUrl: 'https://picsum.photos/seed/narrator/200/200',
  }
];

const App: React.FC = () => {
  // Auth State - Initialized with mock user to bypass login
  const [user, setUser] = useState<User | null>({
    id: 'test_user',
    name: 'Test User',
    email: 'test@example.com',
    avatar: 'https://picsum.photos/seed/user/200/200'
  });

  // App State
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [projects, setProjects] = useState<Project[]>([INITIAL_PROJECT]);
  const [activeProjectId, setActiveProjectId] = useState<string>(INITIAL_PROJECT.id);
  
  // Workspace Level State
  const [libraryCharacters, setLibraryCharacters] = useState<Character[]>(INITIAL_LIBRARY);
  const [clonedVoices, setClonedVoices] = useState<Voice[]>([]);

  // Derived state
  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
  };

  const handleNavigate = (view: ViewState) => {
    setCurrentView(view);
  };

  const handleProjectUpdate = (updatedProject: Project) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
  };

  const handleAddCharacterToLibrary = (character: Character) => {
    setLibraryCharacters(prev => [...prev, character]);
  };

  const handleAddClonedVoice = (voice: Voice) => {
      setClonedVoices(prev => [...prev, voice]);
  };

  const handleUpdateLibraryCharacter = (updatedChar: Character) => {
    // 1. Update Global Library
    setLibraryCharacters(prev => prev.map(c => c.id === updatedChar.id ? updatedChar : c));
    
    // 2. Update Active Project Cast if present to reflect changes immediately
    setProjects(prevProjects => prevProjects.map(proj => {
      const hasChar = proj.characters?.some(c => c.id === updatedChar.id);
      if (hasChar) {
        return {
          ...proj,
          characters: proj.characters?.map(c => c.id === updatedChar.id ? updatedChar : c)
        };
      }
      return proj;
    }));
  };

  const handleCreateProject = () => {
    const newProject: Project = {
      ...INITIAL_PROJECT,
      id: `proj_${Date.now()}`,
      name: 'Untitled Project',
      lastEdited: 'Just now',
      createdAt: new Date().toLocaleDateString(),
      status: 'draft',
      progress: 0,
      textOverlays: [],
      thumbnail: undefined,
      scenes: [], // Start empty, will be generated
      script: [],
      characters: [], // Empty cast for new project
      visualStyle: 'Cinematic'
    };
    setProjects([newProject, ...projects]);
    setActiveProjectId(newProject.id);
    setCurrentView('script');
  };

  const handleSelectProject = (projectId: string) => {
    setActiveProjectId(projectId);
    if (currentView === 'dashboard') {
      setCurrentView('script'); 
    }
  };

  // Logic to parse script and generate scenes
  const handleScriptNext = () => {
    // 1. Process the current script sections
    const newScenes: Scene[] = [];
    const visualStyle = activeProject.visualStyle || 'Cinematic';
    
    // Create a prompt suffix that includes character details
    const characters = activeProject.characters || [];
    let characterContext = "";
    if (characters.length > 0) {
      characterContext = " CAST VISUALS: " + characters.map(c => `${c.name} looks like (${c.description})`).join(". ");
    }
    
    activeProject.script.forEach((section) => {
      // Split content into sentences (rough approximation)
      const sentences = section.content.match(/[^\.!\?]+[\.!\?]+/g) || [section.content];
      
      // Group sentences into chunks of 1 (High density for more scenes)
      for (let i = 0; i < sentences.length; i += 1) {
        const chunk = sentences[i].trim();
        if (!chunk) continue;

        // Check if a scene already exists for this logic to preserve images if re-running
        const sceneId = `sc_${section.id}_${i}`;
        const existingScene = activeProject.scenes.find(s => s.id === sceneId);
        
        // Include visual style AND character context in prompt
        const imagePrompt = `${visualStyle} shot representing: ${chunk.substring(0, 50)}... ${characterContext}`;

        if (existingScene) {
          // Update narration in case text changed, keep image
          newScenes.push({
            ...existingScene,
            narration: chunk
          });
        } else {
          // Create new scene
          newScenes.push({
            id: sceneId,
            scriptSectionId: section.id,
            timestamp: '00:00', // Mock timestamp calculation
            narration: chunk,
            imagePrompt: imagePrompt,
            videoPrompt: `${visualStyle} video of ${imagePrompt}, ${chunk.substring(0, 30)}. High motion, 4k.`, // Auto-generated video prompt
            imageUrl: `https://picsum.photos/seed/${section.id}_${i}/800/450`, // Mock distinct seed
            cameraMovement: 'Static',
            visualStyle: visualStyle
          });
        }
      }
    });

    handleProjectUpdate({
      ...activeProject,
      scenes: newScenes
    });

    handleNavigate('storyboard');
  };

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard 
            user={user}
            projects={projects}
            onNavigate={handleNavigate} 
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
          />
        );
      case 'script':
        return (
          <ScriptEditor 
            project={activeProject} 
            libraryCharacters={libraryCharacters}
            clonedVoices={clonedVoices}
            onAddCharacterToLibrary={handleAddCharacterToLibrary}
            onUpdateLibraryCharacter={handleUpdateLibraryCharacter}
            onAddClonedVoice={handleAddClonedVoice}
            onUpdateProject={handleProjectUpdate}
            onNext={handleScriptNext} 
          />
        );
      case 'storyboard':
        return (
          <Storyboard 
            project={activeProject}
            onUpdateProject={handleProjectUpdate}
            onNext={() => handleNavigate('video')}
          />
        );
      case 'video':
        return <VideoPreview project={activeProject} onUpdateProject={handleProjectUpdate} />;
      case 'characters':
        return <CharacterLibrary />;
      default:
        return (
            <Dashboard 
              user={user}
              projects={projects}
              onNavigate={handleNavigate} 
              onSelectProject={handleSelectProject}
              onCreateProject={handleCreateProject}
            />
          );
    }
  };

  return (
    <Layout 
      currentView={currentView} 
      onNavigate={handleNavigate} 
      user={user} 
      onLogout={handleLogout}
      projects={projects}
      activeProjectId={activeProjectId}
      onSelectProject={handleSelectProject}
      onUpdateProject={handleProjectUpdate}
      onCreateProject={handleCreateProject}
    >
      {renderView()}
    </Layout>
  );
};

export default App;
