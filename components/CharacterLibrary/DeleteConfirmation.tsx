import React, { useState, useEffect, useRef } from 'react';
import * as Icons from '../Icons';
import { Button } from '../ui/button';

interface DeleteConfirmationProps {
  characterName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export const DeleteConfirmation: React.FC<DeleteConfirmationProps> = ({
  characterName,
  onConfirm,
  onCancel,
  isDeleting = false,
}) => {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const canDelete = input === characterName;

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canDelete && !isDeleting) {
      onConfirm();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-card-bg border border-red-500/30 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Warning Icon */}
        <div className="flex items-center justify-center mb-4">
          <div className="size-16 rounded-full bg-red-500/10 flex items-center justify-center">
            <Icons.AlertCircle className="text-red-500" size={32} />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white text-center mb-2">
          Delete Character?
        </h3>

        {/* Description */}
        <p className="text-text-muted text-center mb-6 leading-relaxed">
          This will permanently delete <span className="text-white font-semibold">"{characterName}"</span> and all of their reference images. This action cannot be undone.
        </p>

        {/* Confirmation Input */}
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="text-xs text-text-muted font-medium block mb-2">
              Type the character name to confirm:
            </label>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={characterName}
              disabled={isDeleting}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-text-muted/30 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/30 transition-colors disabled:opacity-50"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onCancel}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="flex-1"
              disabled={!canDelete || isDeleting}
            >
              {isDeleting ? (
                <>
                  <Icons.RefreshCw className="animate-spin" size={16} />
                  Deleting...
                </>
              ) : (
                <>
                  <Icons.Trash2 size={16} />
                  Delete
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeleteConfirmation;
