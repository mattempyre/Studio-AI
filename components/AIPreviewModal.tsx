import React, { useState } from 'react';
import * as Icons from './Icons';
import type { GeneratedSentence } from '../services/backendApi';

interface AIPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectionTitle: string;
  generatedSentences: GeneratedSentence[];
  insertPosition: number;
  onAccept: (sentences: GeneratedSentence[]) => void;
  onRegenerate: () => void;
  isAccepting: boolean;
}

export const AIPreviewModal: React.FC<AIPreviewModalProps> = ({
  isOpen,
  onClose,
  sectionTitle,
  generatedSentences: initialSentences,
  insertPosition,
  onAccept,
  onRegenerate,
  isAccepting,
}) => {
  const [sentences, setSentences] = useState<GeneratedSentence[]>(initialSentences);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  // Sync with prop changes (when regenerating)
  React.useEffect(() => {
    setSentences(initialSentences);
  }, [initialSentences]);

  if (!isOpen) return null;

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditText(sentences[index].text);
  };

  const handleConfirmEdit = () => {
    if (editingIndex === null) return;

    setSentences((prev) =>
      prev.map((s, i) =>
        i === editingIndex ? { ...s, text: editText.trim() } : s
      )
    );
    setEditingIndex(null);
    setEditText('');
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditText('');
  };

  const handleRemove = (index: number) => {
    setSentences((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAccept = () => {
    if (sentences.length > 0) {
      onAccept(sentences);
    }
  };

  const positionText = insertPosition === 0
    ? 'at the beginning'
    : `at position ${insertPosition + 1}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative bg-[#1a1625] border border-white/10 rounded-xl p-6 max-w-xl w-full mx-4 shadow-2xl max-h-[85vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Preview generated sentences"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-500/20">
              <Icons.Sparkles className="text-green-400" size={20} />
            </div>
            <h3 className="text-lg font-bold text-white">Generated Sentences</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <Icons.X size={18} />
          </button>
        </div>

        {/* Preview count */}
        <div className="mb-4 text-sm text-text-muted">
          Preview ({sentences.length} sentence{sentences.length !== 1 ? 's' : ''}):
        </div>

        {/* Sentences List */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-4 custom-scrollbar pr-2">
          {sentences.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <Icons.FileText className="mx-auto mb-2 opacity-50" size={32} />
              <p>All sentences removed. Regenerate or cancel.</p>
            </div>
          ) : (
            sentences.map((sentence, index) => (
              <div
                key={index}
                className="group bg-white/5 border border-white/10 rounded-lg p-4 hover:border-primary/30 transition-all"
              >
                {editingIndex === index ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full bg-black/40 border border-primary/50 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleConfirmEdit}
                        className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-xs font-bold hover:bg-green-500/30 transition-colors flex items-center gap-1"
                      >
                        <Icons.Check size={12} />
                        Confirm
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-1 bg-white/5 text-text-muted border border-white/10 rounded text-xs font-bold hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1"
                      >
                        <Icons.X size={12} />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 p-1.5 bg-primary/20 rounded">
                        <Icons.Sparkles className="text-primary" size={12} />
                      </div>
                      <p className="flex-1 text-sm text-white/90 leading-relaxed">
                        {sentence.text}
                      </p>
                    </div>
                    <div className="flex justify-end gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartEdit(index)}
                        className="px-2 py-1 text-[10px] font-bold text-text-muted hover:text-primary bg-white/5 hover:bg-primary/10 rounded transition-colors flex items-center gap-1"
                      >
                        <Icons.Edit3 size={10} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleRemove(index)}
                        className="px-2 py-1 text-[10px] font-bold text-text-muted hover:text-red-400 bg-white/5 hover:bg-red-400/10 rounded transition-colors flex items-center gap-1"
                      >
                        <Icons.Trash2 size={10} />
                        Remove
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Position info */}
        <div className="mb-4 text-xs text-text-muted">
          Will be added: {positionText} of "{sectionTitle}"
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onRegenerate}
            disabled={isAccepting}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-bold text-text-muted hover:text-white transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Icons.RefreshCw size={16} />
            Regenerate
          </button>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-bold text-text-muted hover:text-white transition-colors"
              disabled={isAccepting}
            >
              Cancel
            </button>
            <button
              onClick={handleAccept}
              disabled={isAccepting || sentences.length === 0}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-sm font-bold text-white transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/20"
            >
              {isAccepting ? (
                <>
                  <Icons.RefreshCw className="animate-spin" size={16} />
                  Adding...
                </>
              ) : (
                <>
                  <Icons.Check size={16} />
                  Accept & Add
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIPreviewModal;
