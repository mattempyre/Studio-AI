import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteConfirmation } from '../../../components/CharacterLibrary/DeleteConfirmation';

describe('DeleteConfirmation', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders character name in confirmation message', () => {
    render(
      <DeleteConfirmation
        characterName="Test Character"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(/"Test Character"/)).toBeInTheDocument();
  });

  it('has delete button disabled initially', () => {
    render(
      <DeleteConfirmation
        characterName="Test Character"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    expect(deleteButton).toBeDisabled();
  });

  it('enables delete button when correct name is typed', () => {
    render(
      <DeleteConfirmation
        characterName="Test Character"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByPlaceholderText('Test Character');
    fireEvent.change(input, { target: { value: 'Test Character' } });

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    expect(deleteButton).not.toBeDisabled();
  });

  it('keeps delete button disabled when wrong name is typed', () => {
    render(
      <DeleteConfirmation
        characterName="Test Character"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByPlaceholderText('Test Character');
    fireEvent.change(input, { target: { value: 'Wrong Name' } });

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    expect(deleteButton).toBeDisabled();
  });

  it('calls onConfirm when delete button is clicked with correct name', () => {
    render(
      <DeleteConfirmation
        characterName="Test Character"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByPlaceholderText('Test Character');
    fireEvent.change(input, { target: { value: 'Test Character' } });

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(
      <DeleteConfirmation
        characterName="Test Character"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when backdrop is clicked', () => {
    render(
      <DeleteConfirmation
        characterName="Test Character"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const backdrop = screen.getByText(/delete character/i).closest('.fixed')?.querySelector('.bg-black\\/70');
    if (backdrop) fireEvent.click(backdrop);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('shows loading state when isDeleting is true', () => {
    render(
      <DeleteConfirmation
        characterName="Test Character"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isDeleting={true}
      />
    );

    expect(screen.getByText('Deleting...')).toBeInTheDocument();
  });

  it('disables buttons when isDeleting is true', () => {
    render(
      <DeleteConfirmation
        characterName="Test Character"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isDeleting={true}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    expect(cancelButton).toBeDisabled();
  });
});
