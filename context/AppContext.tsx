import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Project, Character, Voice, User } from '../types';
import { INITIAL_PROJECT } from '../constants';

// Initial library data
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

interface AppContextType {
  // Auth
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;

  // Projects
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;

  // Characters
  libraryCharacters: Character[];
  setLibraryCharacters: React.Dispatch<React.SetStateAction<Character[]>>;

  // Voices
  clonedVoices: Voice[];
  setClonedVoices: React.Dispatch<React.SetStateAction<Voice[]>>;

  // Handlers
  handleProjectUpdate: (updatedProject: Project) => void;
  handleAddCharacterToLibrary: (character: Character) => void;
  handleUpdateLibraryCharacter: (updatedChar: Character) => void;
  handleAddClonedVoice: (voice: Voice) => void;
  handleCreateProject: () => string; // Returns new project ID
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

  // Workspace Level State
  const [libraryCharacters, setLibraryCharacters] = useState<Character[]>(INITIAL_LIBRARY);
  const [clonedVoices, setClonedVoices] = useState<Voice[]>([]);

  // Handlers
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
    libraryCharacters,
    setLibraryCharacters,
    clonedVoices,
    setClonedVoices,
    handleProjectUpdate,
    handleAddCharacterToLibrary,
    handleUpdateLibraryCharacter,
    handleAddClonedVoice,
    handleCreateProject,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};
