import React, { useState, useRef } from 'react';
import * as Icons from '../Icons';
import { GenerationModel } from '../../types';
import { Button } from '../ui/button';

interface ModelFormData {
  name: string;
  description?: string;
  workflowCategory?: 'image' | 'video';
  workflowType: 'text-to-image' | 'image-to-image' | 'image-to-video';
  defaultSteps?: number;
  defaultCfg?: number;
  defaultFrames?: number;
  defaultFps?: number;
}

interface ModelFormProps {
  model?: GenerationModel;
  onClose: () => void;
  onSave: (data: ModelFormData, workflowFile?: File) => void;
  onDelete?: () => void;
}

const ModelForm: React.FC<ModelFormProps> = ({ model, onClose, onSave, onDelete }) => {
  const [name, setName] = useState(model?.name || '');
  const [description, setDescription] = useState(model?.description || '');
  const [workflowCategory, setWorkflowCategory] = useState<'image' | 'video'>(
    model?.workflowCategory || 'image'
  );
  const [workflowType, setWorkflowType] = useState<'text-to-image' | 'image-to-image' | 'image-to-video'>(
    model?.workflowType || 'text-to-image'
  );
  const [defaultSteps, setDefaultSteps] = useState(model?.defaultSteps?.toString() || '4');
  const [defaultCfg, setDefaultCfg] = useState(model?.defaultCfg?.toString() || '1.0');
  const [defaultFrames, setDefaultFrames] = useState(model?.defaultFrames?.toString() || '81');
  const [defaultFps, setDefaultFps] = useState(model?.defaultFps?.toString() || '16');
  const [workflowFile, setWorkflowFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-set workflow type based on category
  const handleCategoryChange = (category: 'image' | 'video') => {
    setWorkflowCategory(category);
    if (category === 'video') {
      setWorkflowType('image-to-video');
    } else if (workflowType === 'image-to-video') {
      setWorkflowType('text-to-image');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      await onSave(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          workflowCategory,
          workflowType,
          defaultSteps: defaultSteps ? parseInt(defaultSteps, 10) : undefined,
          defaultCfg: defaultCfg ? parseFloat(defaultCfg) : undefined,
          defaultFrames: workflowCategory === 'video' && defaultFrames ? parseInt(defaultFrames, 10) : undefined,
          defaultFps: workflowCategory === 'video' && defaultFps ? parseInt(defaultFps, 10) : undefined,
        },
        workflowFile || undefined
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        setWorkflowFile(file);
      } else {
        alert('Please select a JSON file');
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        setWorkflowFile(file);
      } else {
        alert('Please drop a JSON file');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-panel-bg border border-border-color rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border-color flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {model ? 'Edit Model' : 'Add New Model'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-white transition-colors"
          >
            <Icons.X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Z-Image Turbo"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-text-muted focus:border-accent-blue focus:outline-none"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this model..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-text-muted focus:border-accent-blue focus:outline-none resize-none"
            />
          </div>

          {/* Model Category */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">Model Category</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="workflowCategory"
                  value="image"
                  checked={workflowCategory === 'image'}
                  onChange={() => handleCategoryChange('image')}
                  className="w-4 h-4 text-accent-blue"
                />
                <span className="text-white flex items-center gap-1.5">
                  <Icons.ImageIcon size={14} />
                  Image Model
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="workflowCategory"
                  value="video"
                  checked={workflowCategory === 'video'}
                  onChange={() => handleCategoryChange('video')}
                  className="w-4 h-4 text-accent-blue"
                />
                <span className="text-white flex items-center gap-1.5">
                  <Icons.Film size={14} />
                  Video Model
                </span>
              </label>
            </div>
          </div>

          {/* Workflow Type */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">Workflow Type</label>
            <div className="flex gap-4 flex-wrap">
              {workflowCategory === 'image' && (
                <>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="workflowType"
                      value="text-to-image"
                      checked={workflowType === 'text-to-image'}
                      onChange={() => setWorkflowType('text-to-image')}
                      className="w-4 h-4 text-accent-blue"
                    />
                    <span className="text-white">Text-to-Image</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="workflowType"
                      value="image-to-image"
                      checked={workflowType === 'image-to-image'}
                      onChange={() => setWorkflowType('image-to-image')}
                      className="w-4 h-4 text-accent-blue"
                    />
                    <span className="text-white">Image-to-Image</span>
                  </label>
                </>
              )}
              {workflowCategory === 'video' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="workflowType"
                    value="image-to-video"
                    checked={workflowType === 'image-to-video'}
                    onChange={() => setWorkflowType('image-to-video')}
                    className="w-4 h-4 text-accent-blue"
                  />
                  <span className="text-white">Image-to-Video</span>
                </label>
              )}
            </div>
          </div>

          {/* Default Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Default Steps</label>
              <input
                type="number"
                value={defaultSteps}
                onChange={(e) => setDefaultSteps(e.target.value)}
                min={1}
                max={100}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-accent-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Default CFG</label>
              <input
                type="number"
                value={defaultCfg}
                onChange={(e) => setDefaultCfg(e.target.value)}
                step={0.1}
                min={0.1}
                max={30}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-accent-blue focus:outline-none"
              />
            </div>
          </div>

          {/* Video-specific Settings */}
          {workflowCategory === 'video' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Default Frames</label>
                <input
                  type="number"
                  value={defaultFrames}
                  onChange={(e) => setDefaultFrames(e.target.value)}
                  min={1}
                  max={1000}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-accent-blue focus:outline-none"
                />
                <p className="text-xs text-text-muted mt-1">Number of frames to generate</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Default FPS</label>
                <input
                  type="number"
                  value={defaultFps}
                  onChange={(e) => setDefaultFps(e.target.value)}
                  min={1}
                  max={120}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-accent-blue focus:outline-none"
                />
                <p className="text-xs text-text-muted mt-1">Frames per second for output</p>
              </div>
            </div>
          )}

          {/* Workflow File Upload */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              ComfyUI Workflow JSON
              {model?.workflowFile && (
                <span className="ml-2 text-green-400 text-xs font-normal">
                  (Current: {model.workflowFile.split('/').pop()})
                </span>
              )}
            </label>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:border-accent-blue/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelect}
                className="hidden"
              />
              {workflowFile ? (
                <div className="flex items-center justify-center gap-3">
                  <Icons.FileJson className="text-accent-blue" size={24} />
                  <span className="text-white">{workflowFile.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setWorkflowFile(null);
                    }}
                    className="p-1 rounded hover:bg-white/10"
                  >
                    <Icons.X size={16} className="text-text-muted" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Icons.Upload className="mx-auto text-text-muted" size={32} />
                  <p className="text-text-muted">
                    Click or drag & drop a JSON workflow file
                  </p>
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-border-color flex items-center justify-between">
          <div>
            {model && onDelete && (
              <Button
                type="button"
                variant="ghost"
                onClick={onDelete}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Icons.Trash2 size={16} />
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!name.trim() || isSaving}>
              {isSaving ? (
                <>
                  <Icons.Loader2 className="animate-spin" size={16} />
                  Saving...
                </>
              ) : (
                <>
                  <Icons.Check size={16} />
                  {model ? 'Save Changes' : 'Create Model'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelForm;
