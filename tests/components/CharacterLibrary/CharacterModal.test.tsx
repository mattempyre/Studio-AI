import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CharacterModal } from '../../../components/CharacterLibrary/CharacterModal';
import { BackendCharacter } from '../../../types';

describe('CharacterModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnUploadImage = vi.fn();
  const mockOnRemoveImage = vi.fn();

  const mockCharacter: BackendCharacter = {
    id: 'char_1',
    name: 'Test Character',
    description: 'A test description',
    referenceImages: ['/img1.jpg'],
    styleLora: 'test-lora',
    createdAt: '2024-01-01',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
    mockOnDelete.mockResolvedValue(undefined);
    mockOnUploadImage.mockResolvedValue(undefined);
    mockOnRemoveImage.mockResolvedValue(undefined);
  });

  describe('Create Mode', () => {
    it('renders create mode title', () => {
      render(
        <CharacterModal
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByRole('heading', { name: 'Create Character' })).toBeInTheDocument();
    });

    it('has empty form fields in create mode', () => {
      render(
        <CharacterModal
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const nameInput = screen.getByPlaceholderText(/e\.g\., Dr\. Sarah Chen/i);
      expect(nameInput).toHaveValue('');
    });

    it('shows validation error when saving without name', async () => {
      render(
        <CharacterModal
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const saveButton = screen.getByRole('button', { name: /create character/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Character name is required')).toBeInTheDocument();
      });
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('calls onSave with form data when valid', async () => {
      render(
        <CharacterModal
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const nameInput = screen.getByPlaceholderText(/e\.g\., Dr\. Sarah Chen/i);
      fireEvent.change(nameInput, { target: { value: 'New Character' } });

      const descInput = screen.getByPlaceholderText(/describe the character/i);
      fireEvent.change(descInput, { target: { value: 'A new description' } });

      const saveButton = screen.getByRole('button', { name: /create character/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          name: 'New Character',
          description: 'A new description',
          styleLora: '',
        });
      });
    });
  });

  describe('Edit Mode', () => {
    it('renders edit mode title', () => {
      render(
        <CharacterModal
          character={mockCharacter}
          onClose={mockOnClose}
          onSave={mockOnSave}
          onDelete={mockOnDelete}
          onUploadImage={mockOnUploadImage}
          onRemoveImage={mockOnRemoveImage}
        />
      );

      expect(screen.getByText('Edit Character')).toBeInTheDocument();
    });

    it('pre-fills form with character data', () => {
      render(
        <CharacterModal
          character={mockCharacter}
          onClose={mockOnClose}
          onSave={mockOnSave}
          onDelete={mockOnDelete}
          onUploadImage={mockOnUploadImage}
          onRemoveImage={mockOnRemoveImage}
        />
      );

      const nameInput = screen.getByPlaceholderText(/e\.g\., Dr\. Sarah Chen/i);
      expect(nameInput).toHaveValue('Test Character');

      const descInput = screen.getByPlaceholderText(/describe the character/i);
      expect(descInput).toHaveValue('A test description');
    });

    it('shows delete button in edit mode', () => {
      render(
        <CharacterModal
          character={mockCharacter}
          onClose={mockOnClose}
          onSave={mockOnSave}
          onDelete={mockOnDelete}
          onUploadImage={mockOnUploadImage}
          onRemoveImage={mockOnRemoveImage}
        />
      );

      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('calls onSave with updated data', async () => {
      render(
        <CharacterModal
          character={mockCharacter}
          onClose={mockOnClose}
          onSave={mockOnSave}
          onDelete={mockOnDelete}
          onUploadImage={mockOnUploadImage}
          onRemoveImage={mockOnRemoveImage}
        />
      );

      const nameInput = screen.getByPlaceholderText(/e\.g\., Dr\. Sarah Chen/i);
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          name: 'Updated Name',
          description: 'A test description',
          styleLora: 'test-lora',
        });
      });
    });
  });

  describe('Modal Behavior', () => {
    it('calls onClose when close button is clicked', () => {
      render(
        <CharacterModal
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const closeButtons = screen.getAllByRole('button');
      const xButton = closeButtons.find(btn => btn.querySelector('svg'));
      if (xButton) fireEvent.click(xButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when cancel button is clicked', () => {
      render(
        <CharacterModal
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('shows character count for description', () => {
      render(
        <CharacterModal
          character={mockCharacter}
          onClose={mockOnClose}
          onSave={mockOnSave}
          onDelete={mockOnDelete}
          onUploadImage={mockOnUploadImage}
          onRemoveImage={mockOnRemoveImage}
        />
      );

      expect(screen.getByText('18 / 2000')).toBeInTheDocument();
    });
  });
});
