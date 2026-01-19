import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import Storyboard from '../../../components/Storyboard';
import { Project, Scene, ScriptSection } from '../../../types';

// Mock the geminiService
vi.mock('../../../services/geminiService', () => ({
  generateImage: vi.fn(),
  generateVideo: vi.fn(),
}));

describe('Storyboard - Prompt Display', () => {
  const mockSection: ScriptSection = {
    id: 'section_1',
    title: 'Test Section',
    content: 'Test content',
    duration: '10s',
  };

  const mockSceneWithPrompts: Scene = {
    id: 'scene_1',
    scriptSectionId: 'section_1',
    timestamp: '00:00',
    narration: 'Test narration text',
    imagePrompt: 'A cinematic shot of a person walking through a forest at sunset',
    videoPrompt: 'Slow zoom in with gentle camera movement',
    imageUrl: '/test-image.jpg',
    cameraMovement: 'Zoom In (Slow)',
    visualStyle: 'cinematic',
  };

  const mockSceneWithoutPrompts: Scene = {
    id: 'scene_2',
    scriptSectionId: 'section_1',
    timestamp: '00:10',
    narration: 'Another narration',
    imagePrompt: '',
    imageUrl: '/test-image-2.jpg',
    cameraMovement: 'static',
    visualStyle: 'cinematic',
  };

  const mockProject: Project = {
    id: 'project_1',
    name: 'Test Project',
    type: 'video',
    status: 'draft',
    lastEdited: '2024-01-01',
    createdAt: '2024-01-01',
    script: [mockSection],
    scenes: [mockSceneWithPrompts, mockSceneWithoutPrompts],
    textOverlays: [],
    progress: 50,
  };

  const mockOnUpdateProject = vi.fn();
  const mockOnNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Table View Prompt Display', () => {
    it('renders image prompt text in table view', () => {
      render(
        <Storyboard
          project={mockProject}
          onUpdateProject={mockOnUpdateProject}
          onNext={mockOnNext}
        />
      );

      // The image prompt text should appear multiple times (prompt display + inspector)
      // Use getAllByText to verify it exists
      const imagePromptElements = screen.getAllByText('A cinematic shot of a person walking through a forest at sunset');
      expect(imagePromptElements.length).toBeGreaterThan(0);
    });

    it('renders video prompt when present', () => {
      render(
        <Storyboard
          project={mockProject}
          onUpdateProject={mockOnUpdateProject}
          onNext={mockOnNext}
        />
      );

      // Video prompt should appear in the prompt display section
      const videoPromptElements = screen.getAllByText('Slow zoom in with gentle camera movement');
      expect(videoPromptElements.length).toBeGreaterThan(0);
    });

    it('renders "No prompt generated" placeholder for empty image prompt', () => {
      render(
        <Storyboard
          project={mockProject}
          onUpdateProject={mockOnUpdateProject}
          onNext={mockOnNext}
        />
      );

      // Empty prompt placeholder should appear
      const placeholders = screen.getAllByText('No prompt generated');
      expect(placeholders.length).toBeGreaterThan(0);
    });

    it('renders "No prompt generated" placeholder for missing video prompt', () => {
      render(
        <Storyboard
          project={mockProject}
          onUpdateProject={mockOnUpdateProject}
          onNext={mockOnNext}
        />
      );

      // The scene without video prompt should show placeholder
      const placeholders = screen.getAllByText('No prompt generated');
      expect(placeholders.length).toBeGreaterThan(0);
    });

    it('renders camera movement badge', () => {
      render(
        <Storyboard
          project={mockProject}
          onUpdateProject={mockOnUpdateProject}
          onNext={mockOnNext}
        />
      );

      // Camera movement text should appear in the badge
      const zoomBadges = screen.getAllByText('Zoom In (Slow)');
      expect(zoomBadges.length).toBeGreaterThan(0);

      const staticBadges = screen.getAllByText('static');
      expect(staticBadges.length).toBeGreaterThan(0);
    });

    it('displays Image and Video labels in prompt section', () => {
      render(
        <Storyboard
          project={mockProject}
          onUpdateProject={mockOnUpdateProject}
          onNext={mockOnNext}
        />
      );

      // Check for Image: and Video: labels
      const imageLabels = screen.getAllByText('Image:');
      expect(imageLabels.length).toBeGreaterThan(0);

      const videoLabels = screen.getAllByText('Video:');
      expect(videoLabels.length).toBeGreaterThan(0);
    });
  });

  describe('Prompt Truncation and Expansion', () => {
    const mockSceneWithLongPrompt: Scene = {
      id: 'scene_long',
      scriptSectionId: 'section_1',
      timestamp: '00:00',
      narration: 'Test narration',
      imagePrompt: 'This is a very long image prompt that should be truncated when displayed in the UI because it contains a lot of descriptive text about the scene including lighting, composition, camera angle, mood, and various other visual elements that make for a comprehensive prompt',
      imageUrl: '/test-image.jpg',
      cameraMovement: 'static',
      visualStyle: 'cinematic',
    };

    const projectWithLongPrompt: Project = {
      ...mockProject,
      scenes: [mockSceneWithLongPrompt],
    };

    it('renders prompt with truncation class initially', () => {
      render(
        <Storyboard
          project={projectWithLongPrompt}
          onUpdateProject={mockOnUpdateProject}
          onNext={mockOnNext}
        />
      );

      // Find the clickable prompt element (the one with cursor-pointer)
      const promptElements = screen.getAllByText(/This is a very long image prompt/);
      const clickablePrompt = promptElements.find(el =>
        el.classList.contains('cursor-pointer') && el.classList.contains('line-clamp-2')
      );

      expect(clickablePrompt).toBeTruthy();
    });

    it('expands prompt on click', () => {
      render(
        <Storyboard
          project={projectWithLongPrompt}
          onUpdateProject={mockOnUpdateProject}
          onNext={mockOnNext}
        />
      );

      // Find the clickable prompt element
      const promptElements = screen.getAllByText(/This is a very long image prompt/);
      const clickablePrompt = promptElements.find(el =>
        el.classList.contains('cursor-pointer')
      );

      expect(clickablePrompt).toBeTruthy();
      if (clickablePrompt) {
        // Initially truncated
        expect(clickablePrompt.classList.contains('line-clamp-2')).toBe(true);

        // Click to expand
        fireEvent.click(clickablePrompt);

        // Should no longer have the truncation class
        expect(clickablePrompt.classList.contains('line-clamp-2')).toBe(false);
      }
    });

    it('collapses prompt on second click', () => {
      render(
        <Storyboard
          project={projectWithLongPrompt}
          onUpdateProject={mockOnUpdateProject}
          onNext={mockOnNext}
        />
      );

      // Find the clickable prompt element
      const promptElements = screen.getAllByText(/This is a very long image prompt/);
      const clickablePrompt = promptElements.find(el =>
        el.classList.contains('cursor-pointer')
      );

      expect(clickablePrompt).toBeTruthy();
      if (clickablePrompt) {
        // Click to expand
        fireEvent.click(clickablePrompt);
        expect(clickablePrompt.classList.contains('line-clamp-2')).toBe(false);

        // Click again to collapse
        fireEvent.click(clickablePrompt);
        expect(clickablePrompt.classList.contains('line-clamp-2')).toBe(true);
      }
    });

    it('shows correct title tooltip for expand/collapse', () => {
      render(
        <Storyboard
          project={projectWithLongPrompt}
          onUpdateProject={mockOnUpdateProject}
          onNext={mockOnNext}
        />
      );

      // Find the clickable prompt element with title attribute
      const promptElements = screen.getAllByText(/This is a very long image prompt/);
      const clickablePrompt = promptElements.find(el =>
        el.getAttribute('title') === 'Click to expand'
      );

      expect(clickablePrompt).toBeTruthy();
      if (clickablePrompt) {
        // Initially shows expand tooltip
        expect(clickablePrompt.getAttribute('title')).toBe('Click to expand');

        // Click to expand
        fireEvent.click(clickablePrompt);

        // Now shows collapse tooltip
        expect(clickablePrompt.getAttribute('title')).toBe('Click to collapse');
      }
    });
  });

  describe('Grid View Prompt Display', () => {
    it('renders prompts in grid view', () => {
      render(
        <Storyboard
          project={mockProject}
          onUpdateProject={mockOnUpdateProject}
          onNext={mockOnNext}
        />
      );

      // Switch to grid view
      const gridButton = screen.getByText('GRID');
      fireEvent.click(gridButton);

      // Check that prompts are displayed (may appear multiple times)
      const imagePromptElements = screen.getAllByText('A cinematic shot of a person walking through a forest at sunset');
      expect(imagePromptElements.length).toBeGreaterThan(0);
    });

    it('renders empty state in grid view', () => {
      render(
        <Storyboard
          project={mockProject}
          onUpdateProject={mockOnUpdateProject}
          onNext={mockOnNext}
        />
      );

      // Switch to grid view
      const gridButton = screen.getByText('GRID');
      fireEvent.click(gridButton);

      const placeholders = screen.getAllByText('No prompt generated');
      expect(placeholders.length).toBeGreaterThan(0);
    });

    it('shows camera movement in grid view footer', () => {
      render(
        <Storyboard
          project={mockProject}
          onUpdateProject={mockOnUpdateProject}
          onNext={mockOnNext}
        />
      );

      // Switch to grid view
      const gridButton = screen.getByText('GRID');
      fireEvent.click(gridButton);

      const zoomElements = screen.getAllByText('Zoom In (Slow)');
      expect(zoomElements.length).toBeGreaterThan(0);
    });
  });

  describe('View Mode Toggle', () => {
    it('defaults to table view', () => {
      render(
        <Storyboard
          project={mockProject}
          onUpdateProject={mockOnUpdateProject}
          onNext={mockOnNext}
        />
      );

      const tableButton = screen.getByText('TABLE');
      // Check that TABLE button has the active styling (bg-primary)
      expect(tableButton.className).toContain('bg-primary');
    });

    it('can switch between table and grid views', () => {
      render(
        <Storyboard
          project={mockProject}
          onUpdateProject={mockOnUpdateProject}
          onNext={mockOnNext}
        />
      );

      const gridButton = screen.getByText('GRID');
      fireEvent.click(gridButton);

      // After clicking, GRID button should have bg-primary
      expect(gridButton.className).toContain('bg-primary');

      const tableButton = screen.getByText('TABLE');
      // TABLE button should not have bg-primary
      expect(tableButton.className).not.toContain('bg-primary');
    });
  });
});
