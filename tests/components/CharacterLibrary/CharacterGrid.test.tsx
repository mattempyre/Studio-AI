import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CharacterGrid } from '../../../components/CharacterLibrary/CharacterGrid';
import { BackendCharacter } from '../../../types';

describe('CharacterGrid', () => {
  const mockCharacters: BackendCharacter[] = [
    {
      id: 'char_1',
      name: 'Character One',
      description: 'First character',
      referenceImages: [],
      styleLora: null,
      createdAt: '2024-01-01',
    },
    {
      id: 'char_2',
      name: 'Character Two',
      description: 'Second character',
      referenceImages: ['/img.jpg'],
      styleLora: 'lora-v1',
      createdAt: '2024-01-02',
    },
  ];

  const mockOnSelect = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnCreate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all character cards', () => {
    render(
      <CharacterGrid
        characters={mockCharacters}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
        onCreate={mockOnCreate}
      />
    );

    expect(screen.getByText('Character One')).toBeInTheDocument();
    expect(screen.getByText('Character Two')).toBeInTheDocument();
  });

  it('renders "New Character" button', () => {
    render(
      <CharacterGrid
        characters={mockCharacters}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
        onCreate={mockOnCreate}
      />
    );

    expect(screen.getByText('New Character')).toBeInTheDocument();
  });

  it('calls onCreate when "New Character" is clicked', () => {
    render(
      <CharacterGrid
        characters={mockCharacters}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
        onCreate={mockOnCreate}
      />
    );

    const newCharButton = screen.getByText('New Character');
    fireEvent.click(newCharButton);

    expect(mockOnCreate).toHaveBeenCalledTimes(1);
  });

  it('renders empty grid with create button when no characters', () => {
    render(
      <CharacterGrid
        characters={[]}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
        onCreate={mockOnCreate}
      />
    );

    expect(screen.getByText('New Character')).toBeInTheDocument();
    expect(screen.queryByText('Character One')).not.toBeInTheDocument();
  });
});
