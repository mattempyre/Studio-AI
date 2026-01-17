import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  Navigate,
  redirect,
} from '@tanstack/react-router';
import React from 'react';
import Layout from './components/Layout';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import ScriptEditor from './components/ScriptEditor';
import Storyboard from './components/Storyboard';
import VideoPreview from './components/VideoPreview';
import CharacterLibrary from './components/CharacterLibrary';
import { useAppContext, AppProvider } from './context/AppContext';
import { Scene } from './types';

// Root Layout Component - wraps all routes with AppProvider and Layout
function RootLayout() {
  return (
    <AppProvider>
      <AuthGuard>
        <LayoutWrapper />
      </AuthGuard>
    </AppProvider>
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
  const { user, setUser, projects, handleProjectUpdate, handleCreateProject } = useAppContext();

  if (!user) return null;

  return (
    <Layout
      user={user}
      onLogout={() => setUser(null)}
      projects={projects}
      onUpdateProject={handleProjectUpdate}
      onCreateProject={handleCreateProject}
    >
      <Outlet />
    </Layout>
  );
}

// Page Components that extract params and provide to existing components

function DashboardPage() {
  const { user, projects, handleCreateProject } = useAppContext();

  if (!user) return null;

  return (
    <Dashboard
      user={user}
      projects={projects}
      onCreateProject={handleCreateProject}
    />
  );
}

function ScriptEditorPage() {
  const { projectId } = scriptRoute.useParams();
  const {
    projects,
    libraryCharacters,
    clonedVoices,
    handleAddCharacterToLibrary,
    handleUpdateLibraryCharacter,
    handleAddClonedVoice,
    handleProjectUpdate,
  } = useAppContext();
  const navigate = scriptRoute.useNavigate();

  const project = projects.find((p) => p.id === projectId);

  if (!project) {
    return <Navigate to="/" />;
  }

  const handleScriptNext = () => {
    // Process script and generate scenes
    const newScenes: Scene[] = [];
    const visualStyle = project.visualStyle || 'Cinematic';

    const characters = project.characters || [];
    let characterContext = '';
    if (characters.length > 0) {
      characterContext =
        ' CAST VISUALS: ' +
        characters.map((c) => `${c.name} looks like (${c.description})`).join('. ');
    }

    project.script.forEach((section) => {
      const sentences = section.content.match(/[^\.!\?]+[\.!\?]+/g) || [section.content];

      for (let i = 0; i < sentences.length; i += 1) {
        const chunk = sentences[i].trim();
        if (!chunk) continue;

        const sceneId = `sc_${section.id}_${i}`;
        const existingScene = project.scenes.find((s) => s.id === sceneId);

        const imagePrompt = `${visualStyle} shot representing: ${chunk.substring(0, 50)}... ${characterContext}`;

        if (existingScene) {
          newScenes.push({
            ...existingScene,
            narration: chunk,
          });
        } else {
          newScenes.push({
            id: sceneId,
            scriptSectionId: section.id,
            timestamp: '00:00',
            narration: chunk,
            imagePrompt: imagePrompt,
            videoPrompt: `${visualStyle} video of ${imagePrompt}, ${chunk.substring(0, 30)}. High motion, 4k.`,
            imageUrl: `https://picsum.photos/seed/${section.id}_${i}/800/450`,
            cameraMovement: 'Static',
            visualStyle: visualStyle,
          });
        }
      }
    });

    handleProjectUpdate({
      ...project,
      scenes: newScenes,
    });

    navigate({
      to: '/project/$projectId/storyboard',
      params: { projectId },
    });
  };

  return (
    <ScriptEditor
      project={project}
      libraryCharacters={libraryCharacters}
      clonedVoices={clonedVoices}
      onAddCharacterToLibrary={handleAddCharacterToLibrary}
      onUpdateLibraryCharacter={handleUpdateLibraryCharacter}
      onAddClonedVoice={handleAddClonedVoice}
      onUpdateProject={handleProjectUpdate}
      onNext={handleScriptNext}
    />
  );
}

function StoryboardPage() {
  const { projectId } = storyboardRoute.useParams();
  const { projects, handleProjectUpdate } = useAppContext();
  const navigate = storyboardRoute.useNavigate();

  const project = projects.find((p) => p.id === projectId);

  if (!project) {
    return <Navigate to="/" />;
  }

  return (
    <Storyboard
      project={project}
      onUpdateProject={handleProjectUpdate}
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
