import React, { useState, useRef, useCallback } from 'react';
import * as Icons from '../Icons';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const MAX_IMAGES = 5;
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

interface ImageUploaderProps {
  images: string[];
  onUpload: (file: File) => Promise<void>;
  onRemove: (index: number) => Promise<void>;
  disabled?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  images,
  onUpload,
  onRemove,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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
    const available = MAX_IMAGES - images.length;

    if (available <= 0) {
      setError(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const filesToUpload = fileArray.slice(0, available);

      for (const file of filesToUpload) {
        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          continue;
        }
        await onUpload(file);
      }
    } finally {
      setIsUploading(false);
    }
  }, [images.length, onUpload, validateFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    handleFiles(files);
  }, [disabled, handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
    // Reset input so same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [handleFiles]);

  const handleRemove = async (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await onRemove(index);
  };

  return (
    <div className="space-y-4">
      {/* Image Grid Preview */}
      {images.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {images.map((imageUrl, index) => (
            <div key={index} className="relative group aspect-square">
              <img
                src={`${API_BASE}${imageUrl}`}
                alt={`Reference ${index + 1}`}
                className="w-full h-full object-cover rounded-lg border border-white/10"
              />
              <button
                onClick={(e) => handleRemove(index, e)}
                disabled={disabled}
                className="absolute -top-1.5 -right-1.5 size-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50 shadow-lg"
              >
                <Icons.X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Dropzone */}
      {images.length < MAX_IMAGES && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-primary bg-primary/10'
              : 'border-white/10 hover:border-white/30 hover:bg-white/5'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={handleInputChange}
            disabled={disabled}
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Icons.RefreshCw className="animate-spin text-primary" size={24} />
              <p className="text-sm text-text-muted">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="size-12 rounded-full bg-white/5 flex items-center justify-center">
                <Icons.UploadCloud className="text-text-muted" size={20} />
              </div>
              <div>
                <p className="text-sm text-white font-medium">
                  Drop images here or click to browse
                </p>
                <p className="text-xs text-text-muted mt-1">
                  {images.length} of {MAX_IMAGES} images • PNG, JPG, WebP up to {MAX_SIZE_MB}MB
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 px-3 py-2 rounded-lg">
          <Icons.AlertCircle size={14} />
          {error}
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
