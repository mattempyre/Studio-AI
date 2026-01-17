import React, { useState, useEffect, useRef } from 'react';
import * as Icons from '../Icons';
import { BackendCharacter } from '../../types';
import ImageUploader from './ImageUploader';
import DeleteConfirmation from './DeleteConfirmation';

interface CharacterModalProps {
  character?: BackendCharacter;
  onClose: () => void;
  onSave: (data: CharacterFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  onUploadImage?: (file: File) => Promise<void>;
  onRemoveImage?: (index: number) => Promise<void>;
}

export interface CharacterFormData {
  name: string;
  description: string;
  styleLora: string;
}

export const CharacterModal: React.FC<CharacterModalProps> = ({
  character,
  onClose,
  onSave,
  onDelete,
  onUploadImage,
  onRemoveImage,
}) => {
  const isEditing = !!character;
  const [name, setName] = useState(character?.name || '');
  const [description, setDescription] = useState(character?.description || '');
  const [styleLora, setStyleLora] = useState(character?.styleLora || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus name input on mount
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showDeleteConfirm) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showDeleteConfirm]);

  const validate = (): boolean => {
    const newErrors: { name?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Character name is required';
    } else if (name.trim().length > 100) {
      newErrors.name = 'Name must be 100 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        styleLora: styleLora.trim(),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (onUploadImage) {
      await onUploadImage(file);
    }
  };

  const handleRemoveImage = async (index: number) => {
    if (onRemoveImage) {
      await onRemoveImage(index);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-card-bg border border-border-color rounded-2xl w-full max-w-lg mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/5">
            <div>
              <h2 className="text-lg font-bold text-white">
                {isEditing ? 'Edit Character' : 'Create Character'}
              </h2>
              <p className="text-xs text-text-muted mt-1">
                {isEditing
                  ? 'Update character details and reference images'
                  : 'Add a new character to your library'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-text-muted hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <Icons.X size={20} />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-6 space-y-6">
              {/* Name Input */}
              <div>
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">
                  Character Name <span className="text-red-400">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors({});
                  }}
                  placeholder="e.g., Dr. Sarah Chen"
                  className={`w-full bg-black/40 border rounded-lg px-4 py-3 text-white placeholder:text-text-muted/30 focus:outline-none focus:ring-1 transition-colors ${
                    errors.name
                      ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/30'
                      : 'border-white/10 focus:border-primary/50 focus:ring-primary/30'
                  }`}
                />
                {errors.name && (
                  <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                    <Icons.AlertCircle size={12} />
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Description Input */}
              <div>
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">
                  Visual Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the character's appearance for consistent visual generation..."
                  rows={4}
                  maxLength={2000}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-text-muted/30 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors resize-none"
                />
                <p className="text-xs text-text-muted mt-1 text-right">
                  {description.length} / 2000
                </p>
              </div>

              {/* LoRA Identifier */}
              <div>
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">
                  Style LoRA <span className="text-text-muted/50">(optional)</span>
                </label>
                <input
                  type="text"
                  value={styleLora}
                  onChange={(e) => setStyleLora(e.target.value)}
                  placeholder="e.g., realistic_portrait_v2"
                  maxLength={100}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-text-muted/30 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
                />
                <p className="text-xs text-text-muted mt-2">
                  Optional identifier for a trained LoRA model for visual consistency
                </p>
              </div>

              {/* Reference Images (only in edit mode) */}
              {isEditing && character && onUploadImage && onRemoveImage && (
                <div>
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 block">
                    Reference Images
                  </label>
                  <ImageUploader
                    images={character.referenceImages}
                    onUpload={handleUpload}
                    onRemove={handleRemoveImage}
                  />
                </div>
              )}
            </div>
          </form>

          {/* Footer */}
          <div className="p-6 border-t border-white/5 bg-black/20">
            <div className="flex items-center gap-3">
              {isEditing && onDelete && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                >
                  <Icons.Trash2 size={16} />
                  Delete
                </button>
              )}

              <div className="flex-1" />

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-text-muted hover:text-white hover:bg-white/5 rounded-lg text-sm font-bold transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
              >
                {isSaving ? (
                  <>
                    <Icons.RefreshCw className="animate-spin" size={16} />
                    Saving...
                  </>
                ) : (
                  <>
                    <Icons.Save size={16} />
                    {isEditing ? 'Save Changes' : 'Create Character'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && character && (
        <DeleteConfirmation
          characterName={character.name}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          isDeleting={isDeleting}
        />
      )}
    </>
  );
};

export default CharacterModal;
