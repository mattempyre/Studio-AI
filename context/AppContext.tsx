import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Project, Character, Voice, User, BackendCharacter } from '../types';
import { INITIAL_PROJECT } from '../constants';
import { projectsApi } from '../services/backendApi';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Helper to convert BackendCharacter to Character format
function mapBackendCharacterToCharacter(bc: BackendCharacter): Character {
  // referenceImages contains relative paths like "/uploads/characters/..."
  // Need to prepend API_BASE to make them absolute URLs
  const firstImage = bc.referenceImages?.[0];
  const imageUrl = firstImage
    ? `${API_BASE}${firstImage}`
    : `https://picsum.photos/seed/${bc.id}/200/200`;

  return {
    id: bc.id,
    name: bc.name,
    description: bc.description || '',
    imageUrl,
    stylePrompt: bc.styleLora || undefined,
  };
}

// Layout projects (simplified for sidebar dropdown)
interface LayoutProject {
  id: string;
  name: string;
}

interface AppContextType {
  // Auth
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;

  // Projects
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;

  // Layout projects (for sidebar dropdown - synced with backend)
  layoutProjects: LayoutProject[];
  refreshLayoutProjects: () => Promise<void>;

  // Characters
  libraryCharacters: Character[];
  setLibraryCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  refreshLibraryCharacters: () => Promise<void>;

  // Voices
  clonedVoices: Voice[];
  setClonedVoices: React.Dispatch<React.SetStateAction<Voice[]>>;

  // Handlers
  handleProjectUpdate: (updatedProject: Project) => void;
  handleLayoutProjectUpdate: (id: string, updates: { name: string }) => Promise<void>;
  handleAddCharacterToLibrary: (character: Character) => void;
  handleUpdateLibraryCharacter: (updatedChar: Character) => void;
  handleAddClonedVoice: (voice: Voice) => void;
  handleCreateProject: () => string; // Returns new project ID
  handleCreateLayoutProject: () => Promise<string>; // Returns new project ID (async)
}

const AppContext = createContext<AppContextType | null>(null);

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return ctx;
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  // Auth State - Initialized with mock user to bypass login
  const [user, setUser] = useState<User | null>({
    id: 'test_user',
    name: 'Test User',
    email: 'test@example.com',
    avatar: 'https://picsum.photos/seed/user/200/200'
  });

  // Projects State
  const [projects, setProjects] = useState<Project[]>([INITIAL_PROJECT]);

  // Layout projects (for sidebar dropdown - synced with backend)
  const [layoutProjects, setLayoutProjects] = useState<LayoutProject[]>([]);

  // Workspace Level State
  const [libraryCharacters, setLibraryCharacters] = useState<Character[]>([]);
  const [clonedVoices, setClonedVoices] = useState<Voice[]>([]);

  // Fetch library characters from backend
  const refreshLibraryCharacters = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/characters`);
      if (!response.ok) {
        throw new Error(`Failed to fetch characters: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        const mapped = data.data.map(mapBackendCharacterToCharacter);
        setLibraryCharacters(mapped);
      }
    } catch (error) {
      console.error('Failed to load library characters:', error);
    }
  }, []);

  // Fetch layout projects from backend
  const refreshLayoutProjects = useCallback(async () => {
    try {
      const result = await projectsApi.list();
      setLayoutProjects(result.projects.map(p => ({ id: p.id, name: p.name })));
    } catch (error) {
      console.error('Failed to load projects for layout:', error);
    }
  }, []);

  // Load layout projects on mount
  useEffect(() => {
    refreshLayoutProjects();
  }, [refreshLayoutProjects]);

  // Load library characters on mount
  useEffect(() => {
    refreshLibraryCharacters();
  }, [refreshLibraryCharacters]);

  // Handlers
  const handleProjectUpdate = (updatedProject: Project) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
  };

  // Update a project name via API and refresh layout projects
  const handleLayoutProjectUpdate = async (id: string, updates: { name: string }) => {
    try {
      await projectsApi.update(id, updates);
      await refreshLayoutProjects();
    } catch (error) {
      console.error('Failed to update project:', error);
    }
  };

  // Create a project via API and refresh layout projects
  const handleCreateLayoutProject = async (): Promise<string> => {
    try {
      const newProject = await projectsApi.create({
        name: 'Untitled Project',
        targetDuration: 8,
        visualStyle: 'cinematic',
      });
      await refreshLayoutProjects();
      return newProject.id;
    } catch (error) {
      console.error('Failed to create project:', error);
      return `proj_${Date.now()}`;
    }
  };

  const handleAddCharacterToLibrary = (character: Character) => {
    setLibraryCharacters(prev => [...prev, character]);
  };

  const handleAddClonedVoice = (voice: Voice) => {
    setClonedVoices(prev => [...prev, voice]);
  };

  const handleUpdateLibraryCharacter = (updatedChar: Character) => {
    // Update Global Library
    setLibraryCharacters(prev => prev.map(c => c.id === updatedChar.id ? updatedChar : c));

    // Update Active Project Cast if present to reflect changes immediately
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

  const handleCreateProject = (): string => {
    const newProjectId = `proj_${Date.now()}`;
    const newProject: Project = {
      ...INITIAL_PROJECT,
      id: newProjectId,
      name: 'Untitled Project',
      lastEdited: 'Just now',
      createdAt: new Date().toLocaleDateString(),
      status: 'draft',
      progress: 0,
      textOverlays: [],
      thumbnail: undefined,
      scenes: [],
      script: [],
      characters: [],
      visualStyle: 'Cinematic'
    };
    setProjects(prev => [newProject, ...prev]);
    return newProjectId;
  };

  const value: AppContextType = {
    user,
    setUser,
    projects,
    setProjects,
    layoutProjects,
    refreshLayoutProjects,
    libraryCharacters,
    setLibraryCharacters,
    refreshLibraryCharacters,
    clonedVoices,
    setClonedVoices,
    handleProjectUpdate,
    handleLayoutProjectUpdate,
    handleAddCharacterToLibrary,
    handleUpdateLibraryCharacter,
    handleAddClonedVoice,
    handleCreateProject,
    handleCreateLayoutProject,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};
