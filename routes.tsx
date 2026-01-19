import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  Navigate,
  redirect,
} from '@tanstack/react-router';
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import ScriptEditorV2 from './components/ScriptEditorV2';
import Storyboard from './components/Storyboard';
import VideoPreview from './components/VideoPreview';
import CharacterLibrary from './components/CharacterLibrary';
import { StyleBuilder } from './components/StyleBuilder';
import { useAppContext, AppProvider } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { AudioPlayerProvider } from './context/AudioPlayerContext';
import { projectsApi } from './services/backendApi';
import type { BackendProject } from './types';

// Root Layout Component - wraps all routes with ThemeProvider, AppProvider, AudioPlayerProvider and Layout
function RootLayout() {
  return (
    <ThemeProvider>
      <AppProvider>
        <AudioPlayerProvider>
          <AuthGuard>
            <LayoutWrapper />
          </AuthGuard>
        </AudioPlayerProvider>
      </AppProvider>
    </ThemeProvider>
  );
}

// Auth guard component
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useAppContext();

  if (!user) {
    return (
      <Auth
        onLogin={(loggedInUser) => {
          setUser(loggedInUser);
        }}
      />
    );
  }

  return <>{children}</>;
}

// Layout wrapper that provides navigation context
function LayoutWrapper() {
  const { user, setUser, layoutProjects, handleLayoutProjectUpdate, handleCreateLayoutProject } = useAppContext();

  if (!user) return null;

  return (
    <Layout
      user={user}
      onLogout={() => setUser(null)}
      projects={layoutProjects}
      onUpdateProject={handleLayoutProjectUpdate}
      onCreateProject={handleCreateLayoutProject}
    >
      <Outlet />
    </Layout>
  );
}

// Page Components that extract params and provide to existing components

function DashboardPage() {
  const { user } = useAppContext();
  const [backendProjects, setBackendProjects] = useState<BackendProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch projects from backend
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setIsLoading(true);
        const result = await projectsApi.list();
        setBackendProjects(result.projects);
      } catch (error) {
        console.error('Failed to load projects:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadProjects();
  }, []);

  const handleRefresh = async () => {
    try {
      setIsLoading(true);
      const result = await projectsApi.list();
      setBackendProjects(result.projects);
    } catch (error) {
      console.error('Failed to refresh projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async (): Promise<string> => {
    try {
      const newProject = await projectsApi.create({
        name: 'Untitled Project',
        targetDuration: 8,
        visualStyle: 'cinematic',
      });
      // Refresh the list
      const result = await projectsApi.list();
      setBackendProjects(result.projects);
      return newProject.id;
    } catch (error) {
      console.error('Failed to create project:', error);
      // Generate a fallback ID
      return `proj_${Date.now()}`;
    }
  };

  if (!user) return null;

  // Transform backend projects to Dashboard's expected format
  const dashboardProjects = backendProjects.map(p => ({
    id: p.id,
    name: p.name,
    topic: p.topic,
    targetDuration: p.targetDuration,
    visualStyle: p.visualStyle || 'cinematic',
    status: p.status,
    sectionCount: p.sectionCount || 0,
    sentenceCount: p.sentenceCount || 0,
    createdAt: p.createdAt ? new Date(p.createdAt) : null,
    updatedAt: p.updatedAt ? new Date(p.updatedAt) : null,
  }));

  return (
    <Dashboard
      user={user}
      projects={dashboardProjects}
      isLoading={isLoading}
      onCreateProject={handleCreateProject}
      onRefresh={handleRefresh}
    />
  );
}

function ScriptEditorPage() {
  const { projectId } = scriptRoute.useParams();
  const { layoutProjects, libraryCharacters, clonedVoices, refreshLayoutProjects } = useAppContext();
  const navigate = scriptRoute.useNavigate();

  // Get project name from layout projects (backend-synced)
  const project = layoutProjects.find((p) => p.id === projectId);

  const handleScriptNext = () => {
    navigate({
      to: '/project/$projectId/storyboard',
      params: { projectId },
    });
  };

  return (
    <ScriptEditorV2
      projectId={projectId}
      projectName={project?.name}
      onUpdateProjectName={refreshLayoutProjects}
      libraryCharacters={libraryCharacters}
      clonedVoices={clonedVoices}
      onNext={handleScriptNext}
    />
  );
}

function StoryboardPage() {
  const { projectId } = storyboardRoute.useParams();
  const navigate = storyboardRoute.useNavigate();
  const [backendProject, setBackendProject] = useState<BackendProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // API base URL for constructing media URLs
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  /**
   * Convert a file path to a proper media URL.
   * Handles both new format (/media/projects/...) and legacy format (data/projects/...).
   * Optionally adds a cache-busting timestamp parameter.
   */
  const toMediaUrl = (filePath: string | null | undefined, cacheBuster?: string | Date | null): string | undefined => {
    if (!filePath) return undefined;

    let url: string;

    // Already a media URL
    if (filePath.startsWith('/media/')) {
      url = `${API_BASE}${filePath}`;
    } else {
      // Legacy filesystem path - convert to media URL
      // Normalize backslashes to forward slashes
      const normalized = filePath.replace(/\\/g, '/');

      // Extract the part after 'projects/'
      const projectsMatch = normalized.match(/projects\/(.+)$/);
      if (projectsMatch) {
        url = `${API_BASE}/media/projects/${projectsMatch[1]}`;
      } else {
        // Fallback - try to use as-is
        url = `${API_BASE}${filePath}`;
      }
    }

    // Add cache-busting parameter if provided
    if (cacheBuster) {
      const timestamp = cacheBuster instanceof Date ? cacheBuster.getTime() : new Date(cacheBuster).getTime();
      url = `${url}?t=${timestamp}`;
    }

    return url;
  };

  // Load project data from backend
  // showLoading: if false, don't show loading spinner (used for background refresh)
  const loadProject = async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      setError(null);
      const data = await projectsApi.get(projectId);
      setBackendProject(data);
    } catch (err) {
      console.error('Failed to load project:', err);
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  // Fetch project data from backend on mount
  useEffect(() => {
    loadProject(true);
  }, [projectId]);

  // Callback when an individual image completes - update local state immediately
  const handleImageComplete = (sentenceId: string, imageFile: string) => {
    setBackendProject((prev) => {
      if (!prev) return prev;
      // Update imageFile, status, and updatedAt (for cache busting)
      return {
        ...prev,
        sections: prev.sections.map((section) => ({
          ...section,
          sentences: section.sentences.map((sentence) =>
            sentence.id === sentenceId
              ? { ...sentence, imageFile, status: 'completed' as const, updatedAt: new Date().toISOString() }
              : sentence
          ),
        })),
      };
    });
  };

  // Callback when an individual video completes - update local state immediately
  const handleVideoComplete = (sentenceId: string, videoFile: string) => {
    setBackendProject((prev) => {
      if (!prev) return prev;
      // Update videoFile, status, and updatedAt (for cache busting)
      return {
        ...prev,
        sections: prev.sections.map((section) => ({
          ...section,
          sentences: section.sentences.map((sentence) =>
            sentence.id === sentenceId
              ? { ...sentence, videoFile, status: 'completed' as const, updatedAt: new Date().toISOString() }
              : sentence
          ),
        })),
      };
    });
  };

  // Callback when all generation completes - refresh from backend to ensure consistency
  const handleGenerationComplete = () => {
    loadProject(false); // Don't show loading spinner for background refresh
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-muted">Loading storyboard...</p>
        </div>
      </div>
    );
  }

  if (error || !backendProject) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-4">
        <p className="text-red-400">{error || 'Project not found'}</p>
        <button
          onClick={() => navigate({ to: '/' })}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Transform backend data to Project format for Storyboard component
  // Flatten all sentences from all sections into scenes
  // Use updatedAt as cache buster to force browser to reload images when they change
  const scenes = backendProject.sections.flatMap((section) =>
    section.sentences.map((sentence) => ({
      id: sentence.id,
      scriptSectionId: sentence.sectionId,
      timestamp: '',
      narration: sentence.text,
      imagePrompt: sentence.imagePrompt || '',
      videoPrompt: sentence.videoPrompt || undefined,
      imageUrl: toMediaUrl(sentence.imageFile, sentence.updatedAt),
      videoUrl: toMediaUrl(sentence.videoFile, sentence.updatedAt),
      cameraMovement: sentence.cameraMovement || 'static',
      visualStyle: backendProject.visualStyle || 'cinematic',
    }))
  );

  // Create a Project-like object for the Storyboard component
  const project = {
    id: backendProject.id,
    name: backendProject.name,
    type: 'Video' as const,
    status: backendProject.status as 'draft' | 'rendering' | 'completed',
    lastEdited: backendProject.updatedAt ? new Date(backendProject.updatedAt).toLocaleDateString() : 'Never',
    createdAt: backendProject.createdAt ? new Date(backendProject.createdAt).toLocaleDateString() : '',
    script: backendProject.sections.map((s) => ({
      id: s.id,
      title: s.title,
      content: s.sentences.map((sen) => sen.text).join(' '),
    })),
    scenes,
    textOverlays: [],
    progress: 0,
    visualStyle: backendProject.visualStyle || 'cinematic',
  };

  const handleProjectUpdate = (updatedProject: typeof project) => {
    // TODO: Implement actual backend update for storyboard changes
    console.log('Storyboard update:', updatedProject);
  };

  return (
    <Storyboard
      project={project}
      onUpdateProject={handleProjectUpdate}
      onImageComplete={handleImageComplete}
      onVideoComplete={handleVideoComplete}
      onGenerationComplete={handleGenerationComplete}
      onNext={() =>
        navigate({
          to: '/project/$projectId/video',
          params: { projectId },
        })
      }
    />
  );
}

function VideoPreviewPage() {
  const { projectId } = videoRoute.useParams();
  const { projects, handleProjectUpdate } = useAppContext();

  const project = projects.find((p) => p.id === projectId);

  if (!project) {
    return <Navigate to="/" />;
  }

  return <VideoPreview project={project} onUpdateProject={handleProjectUpdate} />;
}


function CharacterLibraryPage() {
  return <CharacterLibrary />;
}

function StyleBuilderPage() {
  return <StyleBuilder />;
}

// Route Definitions

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
});

const charactersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/characters',
  component: CharacterLibraryPage,
});

const styleBuilderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/style-builder',
  component: StyleBuilderPage,
});

const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/project/$projectId',
});

const scriptRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: '/script',
  component: ScriptEditorPage,
});

const storyboardRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: '/storyboard',
  component: StoryboardPage,
});

const videoRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: '/video',
  component: VideoPreviewPage,
});

// Redirect /project/:id to /project/:id/script
const projectIndexRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: '/',
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/project/$projectId/script',
      params: { projectId: params.projectId },
    });
  },
});

// Catch-all route
const catchAllRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '*',
  component: () => <Navigate to="/" />,
});

// Build route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  charactersRoute,
  styleBuilderRoute,
  projectRoute.addChildren([projectIndexRoute, scriptRoute, storyboardRoute, videoRoute]),
  catchAllRoute,
]);

// Create and export router
export const router = createRouter({ routeTree });

// Type declaration for router
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
