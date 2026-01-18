import React, { useState, useCallback } from 'react';
import * as Icons from '../Icons';
import { GenerationModel, VisualStyle } from '../../types';
import { useModels } from '../../hooks/useModels';
import { useStyles } from '../../hooks/useStyles';
import { Button } from '../ui/button';
import ModelGallery from './ModelGallery';
import StyleGallery from './StyleGallery';
import ModelForm from './ModelForm';
import StyleForm from './StyleForm';

type Tab = 'models' | 'styles';
type ModelCategory = 'image' | 'video';

// Loading skeleton for grid items
const LoadingGrid: React.FC = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="animate-pulse">
        <div className="h-40 bg-white/5 rounded-xl mb-4" />
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
    <h3 className="text-xl font-bold text-white mb-2">Failed to Load</h3>
    <p className="text-text-muted text-center mb-6 max-w-md">
      {error.message || 'An unexpected error occurred.'}
    </p>
    <Button onClick={onRetry}>
      <Icons.RefreshCw size={16} />
      Try Again
    </Button>
  </div>
);

// Empty state component
const EmptyState: React.FC<{ type: 'models' | 'styles'; onCreate: () => void }> = ({ type, onCreate }) => (
  <div className="flex flex-col items-center justify-center py-16">
    <div className="size-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
      {type === 'models' ? (
        <Icons.Cpu className="text-text-muted" size={48} />
      ) : (
        <Icons.Palette className="text-text-muted" size={48} />
      )}
    </div>
    <h3 className="text-xl font-bold text-white mb-2">
      {type === 'models' ? 'No Models Yet' : 'No Styles Yet'}
    </h3>
    <p className="text-text-muted text-center mb-6 max-w-md">
      {type === 'models'
        ? 'Add generation models with their ComfyUI workflow files to enable image generation.'
        : 'Create visual styles with prompt prefixes or LoRA configurations to customize your outputs.'}
    </p>
    <Button size="lg" onClick={onCreate}>
      <Icons.Plus size={18} />
      {type === 'models' ? 'Add Your First Model' : 'Create Your First Style'}
    </Button>
  </div>
);

// Toast notification
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

export const StyleBuilder: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('models');
  const [modelCategory, setModelCategory] = useState<ModelCategory>('image');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Models state
  const {
    models,
    isLoading: modelsLoading,
    error: modelsError,
    refetch: refetchModels,
    createModel,
    updateModel,
    deleteModel,
    uploadWorkflow,
  } = useModels();

  // Styles state
  const {
    styles,
    isLoading: stylesLoading,
    error: stylesError,
    refetch: refetchStyles,
    createStyle,
    updateStyle,
    deleteStyle,
  } = useStyles();

  // Modal states
  const [isCreatingModel, setIsCreatingModel] = useState(false);
  const [editingModel, setEditingModel] = useState<GenerationModel | null>(null);
  const [isCreatingStyle, setIsCreatingStyle] = useState(false);
  const [editingStyle, setEditingStyle] = useState<VisualStyle | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Filter models by category
  const imageModels = models.filter(m => m.workflowCategory === 'image' || !m.workflowCategory);
  const videoModels = models.filter(m => m.workflowCategory === 'video');
  const filteredModels = modelCategory === 'image' ? imageModels : videoModels;

  // Model handlers
  const handleCreateModel = useCallback(
    async (data: { name: string; description?: string; workflowCategory?: 'image' | 'video'; workflowType: 'text-to-image' | 'image-to-image' | 'image-to-video'; defaultSteps?: number; defaultCfg?: number; defaultFrames?: number; defaultFps?: number }, workflowFile?: File) => {
      // Add the current category to the data if not specified
      const modelData = { ...data, workflowCategory: data.workflowCategory || modelCategory };
      const result = await createModel(modelData);
      if (result) {
        if (workflowFile) {
          await uploadWorkflow(result.id, workflowFile);
        }
        setIsCreatingModel(false);
        showToast(`Model "${result.name}" created successfully`, 'success');
      } else {
        showToast('Failed to create model', 'error');
      }
    },
    [createModel, uploadWorkflow, showToast, modelCategory]
  );

  const handleUpdateModel = useCallback(
    async (data: { name?: string; description?: string; workflowCategory?: 'image' | 'video'; workflowType?: 'text-to-image' | 'image-to-image' | 'image-to-video'; defaultSteps?: number; defaultCfg?: number; defaultFrames?: number; defaultFps?: number }, workflowFile?: File) => {
      if (!editingModel) return;
      const result = await updateModel(editingModel.id, data);
      if (result) {
        if (workflowFile) {
          await uploadWorkflow(result.id, workflowFile);
          await refetchModels();
        }
        setEditingModel(null);
        showToast(`Model "${result.name}" updated successfully`, 'success');
      } else {
        showToast('Failed to update model', 'error');
      }
    },
    [editingModel, updateModel, uploadWorkflow, refetchModels, showToast]
  );

  const handleDeleteModel = useCallback(
    async (model: GenerationModel) => {
      const success = await deleteModel(model.id);
      if (success) {
        showToast(`Model "${model.name}" deleted`, 'success');
      } else {
        showToast('Failed to delete model', 'error');
      }
    },
    [deleteModel, showToast]
  );

  // Style handlers
  const handleCreateStyle = useCallback(
    async (data: { name: string; description?: string; styleType: 'prompt' | 'lora'; promptPrefix?: string; loraFile?: string; loraStrength?: number; compatibleModels?: string[]; requiresCharacterRef?: boolean }) => {
      const result = await createStyle(data);
      if (result) {
        setIsCreatingStyle(false);
        showToast(`Style "${result.name}" created successfully`, 'success');
      } else {
        showToast('Failed to create style', 'error');
      }
    },
    [createStyle, showToast]
  );

  const handleUpdateStyle = useCallback(
    async (data: { name?: string; description?: string; styleType?: 'prompt' | 'lora'; promptPrefix?: string; loraFile?: string; loraStrength?: number; compatibleModels?: string[]; requiresCharacterRef?: boolean }) => {
      if (!editingStyle) return;
      const result = await updateStyle(editingStyle.id, data);
      if (result) {
        setEditingStyle(null);
        showToast(`Style "${result.name}" updated successfully`, 'success');
      } else {
        showToast('Failed to update style', 'error');
      }
    },
    [editingStyle, updateStyle, showToast]
  );

  const handleDeleteStyle = useCallback(
    async (style: VisualStyle) => {
      const success = await deleteStyle(style.id);
      if (success) {
        showToast(`Style "${style.name}" deleted`, 'success');
      } else {
        showToast('Failed to delete style', 'error');
      }
    },
    [deleteStyle, showToast]
  );

  const isLoading = activeTab === 'models' ? modelsLoading : stylesLoading;
  const error = activeTab === 'models' ? modelsError : stylesError;
  const refetch = activeTab === 'models' ? refetchModels : refetchStyles;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-panel-bg">
      {/* Header */}
      <div className="p-8 border-b border-border-color bg-background-dark/40 shrink-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Style Builder</h1>
            <p className="text-text-muted text-sm">
              Manage generation models and visual styles for image and video creation
            </p>
          </div>

          {!isLoading && !error && (
            <Button
              onClick={() => activeTab === 'models' ? setIsCreatingModel(true) : setIsCreatingStyle(true)}
            >
              <Icons.Plus size={18} />
              {activeTab === 'models' ? 'Add Model' : 'Add Style'}
            </Button>
          )}
        </div>

        {/* Main Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('models')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'models'
                ? 'bg-accent-blue text-white'
                : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Icons.Cpu size={16} />
              Models
              {!modelsLoading && (
                <span className="px-1.5 py-0.5 text-xs rounded bg-white/10">{models.length}</span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('styles')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'styles'
                ? 'bg-accent-blue text-white'
                : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Icons.Palette size={16} />
              Styles
              {!stylesLoading && (
                <span className="px-1.5 py-0.5 text-xs rounded bg-white/10">{styles.length}</span>
              )}
            </div>
          </button>
        </div>

        {/* Model Category Sub-Tabs (only shown when Models tab is active) */}
        {activeTab === 'models' && (
          <div className="flex gap-1 bg-white/5 p-1 rounded-lg w-fit">
            <button
              onClick={() => setModelCategory('image')}
              className={`px-3 py-1.5 rounded-md font-medium text-xs transition-all ${
                modelCategory === 'image'
                  ? 'bg-white/10 text-white'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Icons.ImageIcon size={14} />
                Image Models
                {!modelsLoading && (
                  <span className="px-1 py-0.5 text-[10px] rounded bg-white/10">{imageModels.length}</span>
                )}
              </div>
            </button>
            <button
              onClick={() => setModelCategory('video')}
              className={`px-3 py-1.5 rounded-md font-medium text-xs transition-all ${
                modelCategory === 'video'
                  ? 'bg-white/10 text-white'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Icons.Film size={14} />
                Video Models
                {!modelsLoading && (
                  <span className="px-1 py-0.5 text-[10px] rounded bg-white/10">{videoModels.length}</span>
                )}
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {isLoading && <LoadingGrid />}

        {error && !isLoading && <ErrorState error={error} onRetry={refetch} />}

        {!isLoading && !error && activeTab === 'models' && filteredModels.length === 0 && (
          <EmptyState type="models" onCreate={() => setIsCreatingModel(true)} />
        )}

        {!isLoading && !error && activeTab === 'styles' && styles.length === 0 && (
          <EmptyState type="styles" onCreate={() => setIsCreatingStyle(true)} />
        )}

        {!isLoading && !error && activeTab === 'models' && filteredModels.length > 0 && (
          <ModelGallery
            models={filteredModels}
            onSelect={setEditingModel}
            onDelete={handleDeleteModel}
            onCreate={() => setIsCreatingModel(true)}
          />
        )}

        {!isLoading && !error && activeTab === 'styles' && styles.length > 0 && (
          <StyleGallery
            styles={styles}
            models={models}
            onSelect={setEditingStyle}
            onDelete={handleDeleteStyle}
            onCreate={() => setIsCreatingStyle(true)}
          />
        )}
      </div>

      {/* Create Model Modal */}
      {isCreatingModel && (
        <ModelForm
          onClose={() => setIsCreatingModel(false)}
          onSave={handleCreateModel}
        />
      )}

      {/* Edit Model Modal */}
      {editingModel && (
        <ModelForm
          model={editingModel}
          onClose={() => setEditingModel(null)}
          onSave={handleUpdateModel}
          onDelete={() => handleDeleteModel(editingModel)}
        />
      )}

      {/* Create Style Modal */}
      {isCreatingStyle && (
        <StyleForm
          models={models}
          onClose={() => setIsCreatingStyle(false)}
          onSave={handleCreateStyle}
        />
      )}

      {/* Edit Style Modal */}
      {editingStyle && (
        <StyleForm
          style={editingStyle}
          models={models}
          onClose={() => setEditingStyle(null)}
          onSave={handleUpdateStyle}
          onDelete={() => handleDeleteStyle(editingStyle)}
        />
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default StyleBuilder;
