import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { AppProvider, useAppContext } from '../../../context/AppContext';

describe('AppContext', () => {
  describe('useAppContext', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAppContext());
      }).toThrow('useAppContext must be used within AppProvider');

      consoleSpy.mockRestore();
    });

    it('should provide context when used within provider', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider>{children}</AppProvider>
      );

      const { result } = renderHook(() => useAppContext(), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current.user).toBeDefined();
      expect(result.current.projects).toBeDefined();
      expect(result.current.libraryCharacters).toBeDefined();
    });
  });

  describe('Initial State', () => {
    it('should initialize with a default user', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider>{children}</AppProvider>
      );

      const { result } = renderHook(() => useAppContext(), { wrapper });

      expect(result.current.user).not.toBeNull();
      expect(result.current.user?.name).toBe('Test User');
      expect(result.current.user?.email).toBe('test@example.com');
    });

    it('should initialize with at least one project', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider>{children}</AppProvider>
      );

      const { result } = renderHook(() => useAppContext(), { wrapper });

      expect(result.current.projects.length).toBeGreaterThanOrEqual(1);
    });

    it('should initialize with library characters', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider>{children}</AppProvider>
      );

      const { result } = renderHook(() => useAppContext(), { wrapper });

      expect(result.current.libraryCharacters.length).toBeGreaterThan(0);
    });

    it('should initialize with empty cloned voices', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider>{children}</AppProvider>
      );

      const { result } = renderHook(() => useAppContext(), { wrapper });

      expect(result.current.clonedVoices).toEqual([]);
    });
  });

  describe('handleCreateProject', () => {
    it('should create a new project and return its ID', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider>{children}</AppProvider>
      );

      const { result } = renderHook(() => useAppContext(), { wrapper });
      const initialProjectCount = result.current.projects.length;

      let newProjectId: string;
      act(() => {
        newProjectId = result.current.handleCreateProject();
      });

      expect(newProjectId!).toMatch(/^proj_\d+$/);
      expect(result.current.projects.length).toBe(initialProjectCount + 1);
    });

    it('should add new project at the beginning of the list', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider>{children}</AppProvider>
      );

      const { result } = renderHook(() => useAppContext(), { wrapper });

      let newProjectId: string;
      act(() => {
        newProjectId = result.current.handleCreateProject();
      });

      expect(result.current.projects[0].id).toBe(newProjectId!);
    });

    it('should create project with default values', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider>{children}</AppProvider>
      );

      const { result } = renderHook(() => useAppContext(), { wrapper });

      act(() => {
        result.current.handleCreateProject();
      });

      const newProject = result.current.projects[0];
      expect(newProject.name).toBe('Untitled Project');
      expect(newProject.status).toBe('draft');
      expect(newProject.progress).toBe(0);
      expect(newProject.scenes).toEqual([]);
      expect(newProject.script).toEqual([]);
    });
  });

  describe('handleProjectUpdate', () => {
    it('should update an existing project', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider>{children}</AppProvider>
      );

      const { result } = renderHook(() => useAppContext(), { wrapper });
      const projectToUpdate = result.current.projects[0];
      const updatedName = 'Updated Project Name';

      act(() => {
        result.current.handleProjectUpdate({
          ...projectToUpdate,
          name: updatedName,
        });
      });

      const updatedProject = result.current.projects.find(p => p.id === projectToUpdate.id);
      expect(updatedProject?.name).toBe(updatedName);
    });

    it('should not modify other projects when updating one', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider>{children}</AppProvider>
      );

      const { result } = renderHook(() => useAppContext(), { wrapper });

      // Create a second project
      act(() => {
        result.current.handleCreateProject();
      });

      const firstProject = result.current.projects[1]; // Original project
      const secondProject = result.current.projects[0]; // Newly created

      // Update only the second project
      act(() => {
        result.current.handleProjectUpdate({
          ...secondProject,
          name: 'Modified Name',
        });
      });

      // First project should be unchanged
      const unchangedProject = result.current.projects.find(p => p.id === firstProject.id);
      expect(unchangedProject?.name).toBe(firstProject.name);
    });
  });

  describe('handleAddCharacterToLibrary', () => {
    it('should add a new character to the library', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider>{children}</AppProvider>
      );

      const { result } = renderHook(() => useAppContext(), { wrapper });
      const initialCount = result.current.libraryCharacters.length;

      const newCharacter = {
        id: 'new_char',
        name: 'New Character',
        description: 'A new test character',
        imageUrl: 'https://example.com/image.jpg',
      };

      act(() => {
        result.current.handleAddCharacterToLibrary(newCharacter);
      });

      expect(result.current.libraryCharacters.length).toBe(initialCount + 1);
      expect(result.current.libraryCharacters.find(c => c.id === 'new_char')).toEqual(newCharacter);
    });
  });

  describe('handleUpdateLibraryCharacter', () => {
    it('should update an existing character in the library', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider>{children}</AppProvider>
      );

      const { result } = renderHook(() => useAppContext(), { wrapper });
      const charToUpdate = result.current.libraryCharacters[0];

      act(() => {
        result.current.handleUpdateLibraryCharacter({
          ...charToUpdate,
          name: 'Updated Character Name',
        });
      });

      const updatedChar = result.current.libraryCharacters.find(c => c.id === charToUpdate.id);
      expect(updatedChar?.name).toBe('Updated Character Name');
    });
  });

  describe('handleAddClonedVoice', () => {
    it('should add a new cloned voice', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider>{children}</AppProvider>
      );

      const { result } = renderHook(() => useAppContext(), { wrapper });

      const newVoice = {
        id: 'voice_1',
        name: 'Test Voice',
        category: 'cloned' as const,
        style: 'Natural',
        gender: 'Male' as const,
      };

      act(() => {
        result.current.handleAddClonedVoice(newVoice);
      });

      expect(result.current.clonedVoices.length).toBe(1);
      expect(result.current.clonedVoices[0]).toEqual(newVoice);
    });
  });

  describe('setUser', () => {
    it('should allow logging out by setting user to null', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider>{children}</AppProvider>
      );

      const { result } = renderHook(() => useAppContext(), { wrapper });
      expect(result.current.user).not.toBeNull();

      act(() => {
        result.current.setUser(null);
      });

      expect(result.current.user).toBeNull();
    });
  });
});
