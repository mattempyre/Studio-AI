import React, { useState } from 'react';
import * as Icons from '../Icons';
import { VisualStyle, GenerationModel } from '../../types';
import { Button } from '../ui/button';

interface StyleFormData {
  name: string;
  description?: string;
  styleType: 'prompt' | 'lora';
  promptPrefix?: string;
  loraFile?: string;
  loraStrength?: number;
  compatibleModels?: string[];
  requiresCharacterRef?: boolean;
}

interface StyleFormProps {
  style?: VisualStyle;
  models: GenerationModel[];
  onClose: () => void;
  onSave: (data: StyleFormData) => void;
  onDelete?: () => void;
}

const StyleForm: React.FC<StyleFormProps> = ({ style, models, onClose, onSave, onDelete }) => {
  const [name, setName] = useState(style?.name || '');
  const [description, setDescription] = useState(style?.description || '');
  const [styleType, setStyleType] = useState<'prompt' | 'lora'>(style?.styleType || 'prompt');
  const [promptPrefix, setPromptPrefix] = useState(style?.promptPrefix || '');
  const [loraFile, setLoraFile] = useState(style?.loraFile || '');
  const [loraStrength, setLoraStrength] = useState(style?.loraStrength?.toString() || '1.0');
  const [compatibleModels, setCompatibleModels] = useState<string[]>(style?.compatibleModels || []);
  const [requiresCharacterRef, setRequiresCharacterRef] = useState(style?.requiresCharacterRef || false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Validate based on style type
    if (styleType === 'prompt' && !promptPrefix.trim()) {
      alert('Prompt prefix is required for prompt-based styles');
      return;
    }
    if (styleType === 'lora' && !loraFile.trim()) {
      alert('LoRA file is required for LoRA-based styles');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        styleType,
        promptPrefix: styleType === 'prompt' ? promptPrefix.trim() : undefined,
        loraFile: styleType === 'lora' ? loraFile.trim() : undefined,
        loraStrength: styleType === 'lora' ? parseFloat(loraStrength) : undefined,
        compatibleModels: compatibleModels.length > 0 ? compatibleModels : undefined,
        requiresCharacterRef,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleModel = (modelId: string) => {
    setCompatibleModels((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-panel-bg border border-border-color rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border-color flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {style ? 'Edit Style' : 'Add New Style'}
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
              placeholder="e.g., Cinematic"
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
              placeholder="Brief description of this style..."
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-text-muted focus:border-accent-blue focus:outline-none resize-none"
            />
          </div>

          {/* Style Type */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">Style Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="styleType"
                  value="prompt"
                  checked={styleType === 'prompt'}
                  onChange={() => setStyleType('prompt')}
                  className="w-4 h-4 text-accent-blue"
                />
                <span className="text-white">Prompt Prefix</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="styleType"
                  value="lora"
                  checked={styleType === 'lora'}
                  onChange={() => setStyleType('lora')}
                  className="w-4 h-4 text-accent-blue"
                />
                <span className="text-white">LoRA</span>
              </label>
            </div>
          </div>

          {/* Prompt Style Options */}
          {styleType === 'prompt' && (
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Prompt Prefix <span className="text-red-400">*</span>
              </label>
              <textarea
                value={promptPrefix}
                onChange={(e) => setPromptPrefix(e.target.value)}
                placeholder="e.g., Cinematic photograph, dramatic lighting, shallow depth of field..."
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-text-muted focus:border-accent-blue focus:outline-none resize-none"
                required={styleType === 'prompt'}
              />
              <p className="mt-2 text-xs text-text-muted">
                This text will be prepended to the user's prompt when generating images.
              </p>
            </div>
          )}

          {/* LoRA Style Options */}
          {styleType === 'lora' && (
            <>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  LoRA File <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={loraFile}
                  onChange={(e) => setLoraFile(e.target.value)}
                  placeholder="e.g., ms_paint_lora_v1.safetensors"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-text-muted focus:border-accent-blue focus:outline-none"
                  required={styleType === 'lora'}
                />
                <p className="mt-2 text-xs text-text-muted">
                  The LoRA filename as it appears in ComfyUI's loras folder.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">LoRA Strength</label>
                <input
                  type="number"
                  value={loraStrength}
                  onChange={(e) => setLoraStrength(e.target.value)}
                  step={0.1}
                  min={0}
                  max={2}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-accent-blue focus:outline-none"
                />
              </div>
            </>
          )}

          {/* Compatible Models */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">Compatible Models</label>
            <p className="text-xs text-text-muted mb-3">
              Select which models this style works with. Leave empty for all models.
            </p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {models.map((model) => (
                <label
                  key={model.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={compatibleModels.includes(model.id)}
                    onChange={() => toggleModel(model.id)}
                    className="w-4 h-4 text-accent-blue rounded"
                  />
                  <span className="text-white flex-1">{model.name}</span>
                  <span className="text-xs text-text-muted">
                    {model.workflowType === 'text-to-image' ? 'T2I' : 'I2I'}
                  </span>
                </label>
              ))}
              {models.length === 0 && (
                <p className="text-text-muted text-sm p-3">
                  No models available. Add models first to set compatibility.
                </p>
              )}
            </div>
          </div>

          {/* Requires Character Reference */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresCharacterRef}
                onChange={(e) => setRequiresCharacterRef(e.target.checked)}
                className="w-4 h-4 text-accent-blue rounded"
              />
              <span className="text-white">Requires character reference image</span>
            </label>
            <p className="mt-2 text-xs text-text-muted ml-7">
              Enable if this style needs a reference image (e.g., for character consistency).
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-border-color flex items-center justify-between">
          <div>
            {style && onDelete && (
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
                  {style ? 'Save Changes' : 'Create Style'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StyleForm;
