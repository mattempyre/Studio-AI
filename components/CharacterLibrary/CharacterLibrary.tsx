import React, { useState, useCallback } from 'react';
import * as Icons from '../Icons';
import { BackendCharacter } from '../../types';
import { useCharacters } from '../../hooks/useCharacters';
import CharacterGrid from './CharacterGrid';
import CharacterModal, { CharacterFormData } from './CharacterModal';
import DeleteConfirmation from './DeleteConfirmation';

// Loading skeleton for grid items
const LoadingGrid: React.FC = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
    {[...Array(8)].map((_, i) => (
      <div key={i} className="animate-pulse">
        <div className="aspect-square bg-white/5 rounded-xl mb-4" />
        <div className="h-4 bg-white/5 rounded w-3/4 mb-2" />
        <div className="h-3 bg-white/5 rounded w-1/2" />
      </div>
    ))}
  </div>
);

// Error state component
const ErrorState: React.FC<{ error: Error; onRetry: () => void }> = ({ error, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-16">
    <div className="size-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
      <Icons.AlertCircle className="text-red-500" size={40} />
    </div>
    <h3 className="text-xl font-bold text-white mb-2">Failed to Load Characters</h3>
    <p className="text-text-muted text-center mb-6 max-w-md">
      {error.message || 'An unexpected error occurred while loading your character library.'}
    </p>
    <button
      onClick={onRetry}
      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
    >
      <Icons.RefreshCw size={16} />
      Try Again
    </button>
  </div>
);

// Empty state component
const EmptyState: React.FC<{ onCreate: () => void }> = ({ onCreate }) => (
  <div className="flex flex-col items-center justify-center py-16">
    <div className="size-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
      <Icons.User className="text-text-muted" size={48} />
    </div>
    <h3 className="text-xl font-bold text-white mb-2">No Characters Yet</h3>
    <p className="text-text-muted text-center mb-6 max-w-md">
      Build your character library to maintain visual consistency across your video projects.
    </p>
    <button
      onClick={onCreate}
      className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
    >
      <Icons.Plus size={18} />
      Create Your First Character
    </button>
  </div>
);

// Toast notification component
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

const ToastContainer: React.FC<{ toasts: Toast[]; onDismiss: (id: string) => void }> = ({
  toasts,
  onDismiss,
}) => (
  <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
    {toasts.map((toast) => (
      <div
        key={toast.id}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl animate-in slide-in-from-right duration-200 ${
          toast.type === 'success'
            ? 'bg-green-500/90 text-white'
            : 'bg-red-500/90 text-white'
        }`}
      >
        {toast.type === 'success' ? (
          <Icons.CheckCircle size={18} />
        ) : (
          <Icons.AlertCircle size={18} />
        )}
        <span className="text-sm font-medium">{toast.message}</span>
        <button
          onClick={() => onDismiss(toast.id)}
          className="ml-2 hover:opacity-70 transition-opacity"
        >
          <Icons.X size={14} />
        </button>
      </div>
    ))}
  </div>
);

export const CharacterLibrary: React.FC = () => {
  const {
    characters,
    isLoading,
    error,
    refetch,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    uploadImage,
    deleteImage,
  } = useCharacters();

  const [isCreating, setIsCreating] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<BackendCharacter | null>(null);
  const [deletingCharacter, setDeletingCharacter] = useState<BackendCharacter | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pendingImages, setPendingImages] = useState<File[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleCreate = useCallback(async (data: CharacterFormData) => {
    const result = await createCharacter({
      name: data.name,
      description: data.description || undefined,
      styleLora: data.styleLora || undefined,
    });

    if (result) {
      // Upload any pending images
      if (pendingImages.length > 0) {
        let uploadedCount = 0;
        for (const file of pendingImages) {
          const uploadResult = await uploadImage(result.id, file);
          if (uploadResult) {
            uploadedCount++;
          }
        }
        if (uploadedCount > 0) {
          await refetch(); // Refresh to get updated character with images
        }
      }

      setIsCreating(false);
      setPendingImages([]);
      showToast(`"${result.name}" created successfully`, 'success');
    } else {
      showToast('Failed to create character', 'error');
    }
  }, [createCharacter, pendingImages, uploadImage, refetch, showToast]);

  const handleUpdate = useCallback(async (data: CharacterFormData) => {
    if (!editingCharacter) return;

    const result = await updateCharacter(editingCharacter.id, {
      name: data.name,
      description: data.description || undefined,
      styleLora: data.styleLora || undefined,
    });

    if (result) {
      // Close modal after successful save
      setEditingCharacter(null);
      showToast(`"${result.name}" updated successfully`, 'success');
    } else {
      showToast('Failed to update character', 'error');
    }
  }, [editingCharacter, updateCharacter, showToast]);

  const handleDelete = useCallback(async () => {
    if (!deletingCharacter) return;

    setIsDeleting(true);
    const success = await deleteCharacter(deletingCharacter.id);
    setIsDeleting(false);

    if (success) {
      const name = deletingCharacter.name;
      setDeletingCharacter(null);
      setEditingCharacter(null);
      showToast(`"${name}" deleted successfully`, 'success');
    } else {
      showToast('Failed to delete character', 'error');
    }
  }, [deletingCharacter, deleteCharacter, showToast]);

  const handleDeleteFromModal = useCallback(async () => {
    if (!editingCharacter) return;
    setDeletingCharacter(editingCharacter);
  }, [editingCharacter]);

  const handleUploadImage = useCallback(async (file: File) => {
    if (!editingCharacter) return;

    const result = await uploadImage(editingCharacter.id, file);
    if (result) {
      // Refetch will update the character in state, we need to update editingCharacter
      const updatedCharacters = await refetch();
      // Find and update editing character
      const updated = characters.find((c) => c.id === editingCharacter.id);
      if (updated) {
        setEditingCharacter(updated);
      }
      showToast('Image uploaded successfully', 'success');
    } else {
      showToast('Failed to upload image', 'error');
    }
  }, [editingCharacter, uploadImage, refetch, characters, showToast]);

  const handleRemoveImage = useCallback(async (index: number) => {
    if (!editingCharacter) return;

    const success = await deleteImage(editingCharacter.id, index);
    if (success) {
      // Refetch and update editing character
      await refetch();
      const updated = characters.find((c) => c.id === editingCharacter.id);
      if (updated) {
        setEditingCharacter(updated);
      }
      showToast('Image removed', 'success');
    } else {
      showToast('Failed to remove image', 'error');
    }
  }, [editingCharacter, deleteImage, refetch, characters, showToast]);

  // Keep editingCharacter synced with characters list
  React.useEffect(() => {
    if (editingCharacter) {
      const updated = characters.find((c) => c.id === editingCharacter.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(editingCharacter)) {
        setEditingCharacter(updated);
      }
    }
  }, [characters, editingCharacter]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-panel-bg">
      {/* Header */}
      <div className="p-8 border-b border-border-color bg-background-dark/40 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Character Library</h1>
            <p className="text-text-muted text-sm">
              {isLoading
                ? 'Loading characters...'
                : `${characters.length} ${characters.length === 1 ? 'character' : 'characters'} in your library`}
            </p>
          </div>

          {!isLoading && !error && characters.length > 0 && (
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
            >
              <Icons.Plus size={18} />
              New Character
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {isLoading && <LoadingGrid />}

        {error && !isLoading && <ErrorState error={error} onRetry={refetch} />}

        {!isLoading && !error && characters.length === 0 && (
          <EmptyState onCreate={() => setIsCreating(true)} />
        )}

        {!isLoading && !error && characters.length > 0 && (
          <CharacterGrid
            characters={characters}
            onSelect={setEditingCharacter}
            onDelete={setDeletingCharacter}
            onCreate={() => setIsCreating(true)}
          />
        )}
      </div>

      {/* Create Modal */}
      {isCreating && (
        <CharacterModal
          onClose={() => { setIsCreating(false); setPendingImages([]); }}
          onSave={handleCreate}
          pendingImages={pendingImages}
          onPendingImagesChange={setPendingImages}
        />
      )}

      {/* Edit Modal */}
      {editingCharacter && (
        <CharacterModal
          character={editingCharacter}
          onClose={() => setEditingCharacter(null)}
          onSave={handleUpdate}
          onDelete={handleDeleteFromModal}
          onUploadImage={handleUploadImage}
          onRemoveImage={handleRemoveImage}
        />
      )}

      {/* Delete Confirmation */}
      {deletingCharacter && !editingCharacter && (
        <DeleteConfirmation
          characterName={deletingCharacter.name}
          onConfirm={handleDelete}
          onCancel={() => setDeletingCharacter(null)}
          isDeleting={isDeleting}
        />
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default CharacterLibrary;
