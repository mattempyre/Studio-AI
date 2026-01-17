import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CastPanel from '../../../components/ProjectSettings/CastPanel';
import { BackendProject, BackendCharacter } from '../../../types';

// Mock useCharacters hook
vi.mock('../../../hooks/useCharacters', () => ({
    useCharacters: () => ({
        characters: [
            { id: 'lib_1', name: 'Lib Char 1', referenceImages: [], description: 'Desc 1' }
        ],
        isLoading: false,
        error: null
    })
}));

// Mock icons to avoid rendering issues
vi.mock('../../../components/Icons', () => ({
    Plus: () => <div data-testid="icon-plus" />,
    User: () => <div data-testid="icon-user" />,
    Users: () => <div data-testid="icon-users" />,
    X: () => <div data-testid="icon-x" />,
    Search: () => <div data-testid="icon-search" />,
    RefreshCw: () => <div data-testid="icon-refresh" />,
    Check: () => <div data-testid="icon-check" />,
}));

describe('CastPanel', () => {
    const mockUpdate = vi.fn();

    const mockCast: BackendCharacter[] = [
        {
            id: 'char_1',
            name: 'Existing Char',
            description: 'Test Desc',
            referenceImages: [],
            createdAt: Date.now()
        }
    ];

    const mockProject: BackendProject = {
        id: 'proj_1',
        name: 'Test Project',
        status: 'draft',
        targetDuration: 10,
        visualStyle: 'cinematic',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sections: [],
        // @ts-ignore - Cast is fully populated in this context
        cast: mockCast
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset fetch mock
        global.fetch = vi.fn();
    });

    it('renders existing cast members', () => {
        render(<CastPanel project={mockProject} onUpdate={mockUpdate} />);

        expect(screen.getByText('Existing Char')).toBeInTheDocument();
        expect(screen.getByText('Test Desc')).toBeInTheDocument();
    });

    it('shows empty state when cast is empty', () => {
        const emptyProject = { ...mockProject, cast: [] };
        render(<CastPanel project={emptyProject} onUpdate={mockUpdate} />);

        expect(screen.getByText('No characters in cast')).toBeInTheDocument();
    });

    it('opens picker when Add Character is clicked', () => {
        render(<CastPanel project={mockProject} onUpdate={mockUpdate} />);

        const addButton = screen.getByText('Add Character').closest('button');
        expect(addButton).toBeInTheDocument();
        fireEvent.click(addButton!);

        // Picker should be visible (looking for title in CharacterPicker)
        expect(screen.getByText('Add Characters to Cast')).toBeInTheDocument();
    });

    // Note: Further interactions (adding/removing) involve fetch calls which are mocked but hard to test without full integration.
    // The integration tests cover the API endpoints.
});
