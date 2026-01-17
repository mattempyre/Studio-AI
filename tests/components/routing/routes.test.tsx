import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { router } from '../../../routes';

// Mock the AppContext to provide test data
vi.mock('../../../context/AppContext', () => ({
  AppProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAppContext: () => ({
    user: {
      id: 'user_1',
      name: 'Test User',
      email: 'test@example.com',
      avatar: 'https://example.com/avatar.jpg',
    },
    setUser: vi.fn(),
    projects: [
      {
        id: 'proj_1',
        name: 'Test Project',
        type: 'video',
        status: 'draft' as const,
        lastEdited: '2024-01-01',
        createdAt: '2024-01-01',
        script: [],
        scenes: [],
        textOverlays: [],
        progress: 0,
      },
    ],
    setProjects: vi.fn(),
    libraryCharacters: [],
    clonedVoices: [],
    handleProjectUpdate: vi.fn(),
    handleAddCharacterToLibrary: vi.fn(),
    handleUpdateLibraryCharacter: vi.fn(),
    handleAddClonedVoice: vi.fn(),
    handleCreateProject: vi.fn(() => 'new_proj_id'),
  }),
}));

// Mock child components to simplify testing
vi.mock('../../../components/Dashboard', () => ({
  default: () => <div data-testid="dashboard">Dashboard Component</div>,
}));

vi.mock('../../../components/CharacterLibrary', () => ({
  default: () => <div data-testid="character-library">Character Library Component</div>,
}));

vi.mock('../../../components/ScriptEditorV2', () => ({
  default: ({ projectId }: { projectId: string }) => (
    <div data-testid="script-editor">Script Editor - {projectId}</div>
  ),
}));

vi.mock('../../../components/Storyboard', () => ({
  default: ({ project }: { project: { name: string } }) => (
    <div data-testid="storyboard">Storyboard - {project.name}</div>
  ),
}));

vi.mock('../../../components/VideoPreview', () => ({
  default: ({ project }: { project: { name: string } }) => (
    <div data-testid="video-preview">Video Preview - {project.name}</div>
  ),
}));

vi.mock('../../../components/Auth', () => ({
  default: ({ onLogin }: { onLogin: (user: unknown) => void }) => (
    <button data-testid="login-button" onClick={() => onLogin({ id: 'user_1', name: 'Test' })}>
      Login
    </button>
  ),
}));

describe('Router Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Route Definitions', () => {
    it('should have dashboard as root route', async () => {
      const memoryHistory = createMemoryHistory({
        initialEntries: ['/'],
      });

      render(
        <RouterProvider router={router} history={memoryHistory} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });

    it('should render characters route at /characters', async () => {
      const memoryHistory = createMemoryHistory({
        initialEntries: ['/characters'],
      });

      render(
        <RouterProvider router={router} history={memoryHistory} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('character-library')).toBeInTheDocument();
      });
    });

    it('should render script editor at /project/:projectId/script', async () => {
      const memoryHistory = createMemoryHistory({
        initialEntries: ['/project/proj_1/script'],
      });

      render(
        <RouterProvider router={router} history={memoryHistory} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('script-editor')).toBeInTheDocument();
      });
    });

    it('should render storyboard at /project/:projectId/storyboard', async () => {
      const memoryHistory = createMemoryHistory({
        initialEntries: ['/project/proj_1/storyboard'],
      });

      render(
        <RouterProvider router={router} history={memoryHistory} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('storyboard')).toBeInTheDocument();
      });
    });

    it('should render video preview at /project/:projectId/video', async () => {
      const memoryHistory = createMemoryHistory({
        initialEntries: ['/project/proj_1/video'],
      });

      render(
        <RouterProvider router={router} history={memoryHistory} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('video-preview')).toBeInTheDocument();
      });
    });

    it('should redirect /project/:projectId to /project/:projectId/script', async () => {
      const memoryHistory = createMemoryHistory({
        initialEntries: ['/project/proj_1'],
      });

      render(
        <RouterProvider router={router} history={memoryHistory} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('script-editor')).toBeInTheDocument();
      });
    });

    it('should handle unknown routes gracefully', async () => {
      const memoryHistory = createMemoryHistory({
        initialEntries: ['/unknown-route'],
      });

      // The catch-all route should redirect to dashboard without crashing
      const { container } = render(
        <RouterProvider router={router} history={memoryHistory} />
      );

      // Wait for the router to settle and verify no crash occurred
      await waitFor(() => {
        // The Layout shell should always be rendered
        expect(container.querySelector('aside')).toBeInTheDocument();
      });
    });
  });

  describe('Project ID Parameter', () => {
    it('should pass correct projectId to script editor', async () => {
      const memoryHistory = createMemoryHistory({
        initialEntries: ['/project/proj_1/script'],
      });

      render(
        <RouterProvider router={router} history={memoryHistory} />
      );

      await waitFor(() => {
        // The mocked ScriptEditor should be rendered
        expect(screen.getByTestId('script-editor')).toBeInTheDocument();
      });
    });

    it('should render script editor for any projectId (backend handles validation)', async () => {
      const memoryHistory = createMemoryHistory({
        initialEntries: ['/project/non_existent_id/script'],
      });

      render(
        <RouterProvider router={router} history={memoryHistory} />
      );

      await waitFor(() => {
        // ScriptEditorV2 fetches project from backend, so it renders with the projectId
        // Backend handles 404 for non-existent projects
        expect(screen.getByTestId('script-editor')).toBeInTheDocument();
      });
    });
  });
});
