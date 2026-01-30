
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import ScriptEditorV2 from './components/ScriptEditorV2';
import Storyboard from './components/Storyboard';
import { VideoEditor } from './components/VideoEditor';
import CharacterLibrary from './components/CharacterLibrary';
import { ViewState, Project, User, Character, Voice } from './types';
import { projectsApi } from './services/backendApi';

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

// Simplified project type for dashboard display (from backend)
interface DashboardProject {
  id: string;
  name: string;
  topic: string | null;
  targetDuration: number;
  visualStyle: string;
  status: string;
  sectionCount: number;
  sentenceCount: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

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
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Workspace Level State
  const [libraryCharacters, setLibraryCharacters] = useState<Character[]>(INITIAL_LIBRARY);
  const [clonedVoices, setClonedVoices] = useState<Voice[]>([]);

  // Load projects from backend on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      const data = await projectsApi.list();
      setProjects(data.projects as DashboardProject[]);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleAddCharacterToLibrary = (character: Character) => {
    setLibraryCharacters(prev => [...prev, character]);
  };

  const handleAddClonedVoice = (voice: Voice) => {
    setClonedVoices(prev => [...prev, voice]);
  };

  const handleUpdateLibraryCharacter = (updatedChar: Character) => {
    setLibraryCharacters(prev => prev.map(c => c.id === updatedChar.id ? updatedChar : c));
  };

  const handleCreateProject = async () => {
    try {
      const newProject = await projectsApi.create({
        name: 'Untitled Project',
        targetDuration: 8,
        visualStyle: 'cinematic',
      });

      // Reload projects list and navigate to the new project
      await loadProjects();
      setActiveProjectId(newProject.id);
      setCurrentView('script');
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleSelectProject = (projectId: string) => {
    setActiveProjectId(projectId);
    if (currentView === 'dashboard') {
      setCurrentView('script');
    }
  };

  const handleScriptNext = () => {
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
            isLoading={isLoading}
            onNavigate={handleNavigate}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
            onRefresh={loadProjects}
          />
        );
      case 'script':
        if (!activeProjectId) {
          return (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-text-muted">No project selected</p>
            </div>
          );
        }
        return (
          <ScriptEditorV2
            projectId={activeProjectId}
            libraryCharacters={libraryCharacters}
            clonedVoices={clonedVoices}
            onNext={handleScriptNext}
          />
        );
      case 'storyboard':
        // TODO: Update Storyboard to use backend data model
        return (
          <div className="flex-1 flex items-center justify-center flex-col gap-4">
            <p className="text-white font-bold">Storyboard</p>
            <p className="text-text-muted text-sm">Coming soon - needs backend integration</p>
            <button
              onClick={() => handleNavigate('script')}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm"
            >
              Back to Script Editor
            </button>
          </div>
        );
      case 'video':
        // TODO: Update VideoPreview to use backend data model
        return (
          <div className="flex-1 flex items-center justify-center flex-col gap-4">
            <p className="text-white font-bold">Video Preview</p>
            <p className="text-text-muted text-sm">Coming soon - needs backend integration</p>
            <button
              onClick={() => handleNavigate('script')}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm"
            >
              Back to Script Editor
            </button>
          </div>
        );
      case 'characters':
        return <CharacterLibrary />;
      default:
        return (
          <Dashboard
            user={user}
            projects={projects}
            isLoading={isLoading}
            onNavigate={handleNavigate}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
            onRefresh={loadProjects}
          />
        );
    }
  };

  // Create a minimal Project object for Layout compatibility
  const layoutProjects: Project[] = projects.map(p => ({
    id: p.id,
    name: p.name,
    type: 'Video',
    status: p.status as 'draft' | 'rendering' | 'completed',
    lastEdited: p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : 'Never',
    createdAt: p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '',
    script: [],
    scenes: [],
    textOverlays: [],
    progress: 0,
  }));

  return (
    <Layout
      currentView={currentView}
      onNavigate={handleNavigate}
      user={user}
      onLogout={handleLogout}
      projects={layoutProjects}
      activeProjectId={activeProjectId}
      onSelectProject={handleSelectProject}
      onUpdateProject={() => {}} // Not used with backend
      onCreateProject={handleCreateProject}
    >
      {renderView()}
    </Layout>
  );
};

export default App;
