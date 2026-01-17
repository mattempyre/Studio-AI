import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CharacterCard } from '../../../components/CharacterLibrary/CharacterCard';
import { BackendCharacter } from '../../../types';

describe('CharacterCard', () => {
  const mockCharacter: BackendCharacter = {
    id: 'char_1',
    name: 'Test Character',
    description: 'A test character description',
    referenceImages: ['/uploads/characters/char_1/image1.jpg'],
    styleLora: 'test-lora',
    createdAt: '2024-01-01',
  };

  const mockOnSelect = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders character name', () => {
    render(
      <CharacterCard
        character={mockCharacter}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('Test Character')).toBeInTheDocument();
  });

  it('renders character description', () => {
    render(
      <CharacterCard
        character={mockCharacter}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('A test character description')).toBeInTheDocument();
  });

  it('displays "No description" when description is null', () => {
    const charWithoutDesc: BackendCharacter = {
      ...mockCharacter,
      description: null,
    };

    render(
      <CharacterCard
        character={charWithoutDesc}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('No description')).toBeInTheDocument();
  });

  it('displays image count', () => {
    render(
      <CharacterCard
        character={mockCharacter}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('1 image')).toBeInTheDocument();
  });

  it('displays plural image count', () => {
    const charWithMultipleImages: BackendCharacter = {
      ...mockCharacter,
      referenceImages: ['/img1.jpg', '/img2.jpg', '/img3.jpg'],
    };

    render(
      <CharacterCard
        character={charWithMultipleImages}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('3 images')).toBeInTheDocument();
  });

  it('calls onSelect when card is clicked', () => {
    render(
      <CharacterCard
        character={mockCharacter}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
      />
    );

    const card = screen.getByText('Test Character').closest('div[class*="cursor-pointer"]');
    if (card) fireEvent.click(card);

    expect(mockOnSelect).toHaveBeenCalledWith(mockCharacter);
  });

  it('calls onDelete when delete button is clicked', () => {
    render(
      <CharacterCard
        character={mockCharacter}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
      />
    );

    const deleteButton = screen.getByTitle('Delete character');
    fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledWith(mockCharacter);
    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it('renders placeholder when no images', () => {
    const charWithoutImages: BackendCharacter = {
      ...mockCharacter,
      referenceImages: [],
    };

    render(
      <CharacterCard
        character={charWithoutImages}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('0 images')).toBeInTheDocument();
  });
});
