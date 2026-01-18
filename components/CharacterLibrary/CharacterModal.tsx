import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Icons from '../Icons';
import { BackendCharacter } from '../../types';
import ImageUploader from './ImageUploader';
import DeleteConfirmation from './DeleteConfirmation';
import { Button } from '../ui/button';

const MAX_IMAGES = 5;
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// Component for handling pending images during character creation
interface PendingImageUploaderProps {
  pendingImages: File[];
  pendingImageUrls: string[];
  onUpload: (file: File) => Promise<void>;
  onRemove: (index: number) => Promise<void>;
}

const PendingImageUploader: React.FC<PendingImageUploaderProps> = ({
  pendingImages,
  pendingImageUrls,
  onUpload,
  onRemove,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (!file.type.startsWith('image/')) {
      return 'Please upload an image file';
    }
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return 'Only PNG, JPG, and WebP images are supported';
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `Image must be smaller than ${MAX_SIZE_MB}MB`;
    }
    return null;
  }, []);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const available = MAX_IMAGES - pendingImages.length;

    if (available <= 0) {
      setError(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }

    setError(null);
    const filesToUpload = fileArray.slice(0, available);

    for (const file of filesToUpload) {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        continue;
      }
      await onUpload(file);
    }
  }, [pendingImages.length, onUpload, validateFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [handleFiles]);

  return (
    <div className="space-y-4">
      {/* Image Grid Preview */}
      {pendingImageUrls.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {pendingImageUrls.map((url, index) => (
            <div key={index} className="relative group aspect-square">
              <img
                src={url}
                alt={`Reference ${index + 1}`}
                className="w-full h-full object-cover rounded-lg border border-border-subtle"
              />
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(index); }}
                className="absolute -top-1.5 -right-1.5 size-5 bg-error text-text-primary rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-error/80 shadow-lg"
              >
                <Icons.X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Dropzone */}
      {pendingImages.length < MAX_IMAGES && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-primary bg-primary/10'
              : 'border-border-color hover:border-border-strong hover:bg-surface-2/50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={handleInputChange}
          />
          <div className="flex flex-col items-center gap-2">
            <div className="size-12 rounded-full bg-surface-3 flex items-center justify-center">
              <Icons.UploadCloud className="text-text-muted" size={20} />
            </div>
            <div>
              <p className="text-sm text-text-primary font-medium">
                Drop images here or click to browse
              </p>
              <p className="text-xs text-text-muted mt-1">
                {pendingImages.length} of {MAX_IMAGES} images • PNG, JPG, WebP up to {MAX_SIZE_MB}MB
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-error text-xs bg-error/10 px-3 py-2 rounded-lg">
          <Icons.AlertCircle size={14} />
          {error}
        </div>
      )}
    </div>
  );
};

interface CharacterModalProps {
  character?: BackendCharacter;
  onClose: () => void;
  onSave: (data: CharacterFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  onUploadImage?: (file: File) => Promise<void>;
  onRemoveImage?: (index: number) => Promise<void>;
  // For creation mode: queue images to upload after character is created
  pendingImages?: File[];
  onPendingImagesChange?: (files: File[]) => void;
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
  pendingImages = [],
  onPendingImagesChange,
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

  // Handle pending image upload for creation mode
  const handlePendingUpload = async (file: File) => {
    if (onPendingImagesChange) {
      onPendingImagesChange([...pendingImages, file]);
    }
  };

  // Handle pending image removal for creation mode
  const handlePendingRemove = async (index: number) => {
    if (onPendingImagesChange) {
      onPendingImagesChange(pendingImages.filter((_, i) => i !== index));
    }
  };

  // Generate preview URLs for pending images
  const pendingImageUrls = pendingImages.map(file => URL.createObjectURL(file));

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-surface-0/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-surface-2 border border-border-color rounded-2xl w-full max-w-lg mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border-subtle">
            <div>
              <h2 className="text-lg font-bold text-text-primary">
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
              className="p-2 text-text-muted hover:text-text-primary hover:bg-surface-3 rounded-lg transition-colors"
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
                  Character Name <span className="text-error">*</span>
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
                  className={`w-full bg-surface-1 border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:bg-surface-2 transition-colors ${
                    errors.name
                      ? 'border-error/50 focus:border-error/50 focus:ring-error/30'
                      : 'border-border-color focus:border-primary/50 focus:ring-primary/30'
                  }`}
                />
                {errors.name && (
                  <p className="text-error text-xs mt-2 flex items-center gap-1">
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
                  className="w-full bg-surface-1 border border-border-color rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:bg-surface-2 transition-colors resize-none"
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
                  className="w-full bg-surface-1 border border-border-color rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:bg-surface-2 transition-colors"
                />
                <p className="text-xs text-text-muted mt-2">
                  Optional identifier for a trained LoRA model for visual consistency
                </p>
              </div>

              {/* Reference Images - Edit mode: use actual uploader */}
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

              {/* Reference Images - Creation mode: queue images for upload after creation */}
              {!isEditing && onPendingImagesChange && (
                <div>
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 block">
                    Reference Images <span className="text-text-muted/50">(optional)</span>
                  </label>
                  <PendingImageUploader
                    pendingImages={pendingImages}
                    pendingImageUrls={pendingImageUrls}
                    onUpload={handlePendingUpload}
                    onRemove={handlePendingRemove}
                  />
                </div>
              )}
            </div>
          </form>

          {/* Footer */}
          <div className="p-6 border-t border-border-subtle bg-surface-1/50">
            <div className="flex items-center gap-3">
              {isEditing && onDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-error hover:text-error/80 hover:bg-error/10"
                >
                  <Icons.Trash2 size={16} />
                  Delete
                </Button>
              )}

              <div className="flex-1" />

              <Button variant="ghost" type="button" onClick={onClose}>
                Cancel
              </Button>

              <Button onClick={handleSubmit} disabled={isSaving}>
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
              </Button>
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
