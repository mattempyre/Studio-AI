import React, { useState } from 'react';
import * as Icons from './Icons';
import type { BackendSection } from '../types';

interface AIExpansionModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: BackendSection;
  onGenerate: (params: {
    mode: 'quick' | 'guided';
    prompt?: string;
    sentenceCount: number;
  }) => void;
  isGenerating: boolean;
}

const SENTENCE_COUNT_OPTIONS = [1, 2, 3, 5];

const PROMPT_SUGGESTIONS = [
  { label: 'Add detail', description: 'Expand on existing content with more specifics' },
  { label: 'Add example', description: 'Include a concrete example' },
  { label: 'Add transition', description: 'Create smooth flow between ideas' },
  { label: 'Add fun fact', description: 'Include an engaging piece of information' },
];

export const AIExpansionModal: React.FC<AIExpansionModalProps> = ({
  isOpen,
  onClose,
  section,
  onGenerate,
  isGenerating,
}) => {
  const [mode, setMode] = useState<'quick' | 'guided'>('quick');
  const [prompt, setPrompt] = useState('');
  const [sentenceCount, setSentenceCount] = useState(2);

  if (!isOpen) return null;

  const handleGenerate = () => {
    onGenerate({
      mode,
      prompt: mode === 'guided' ? prompt : undefined,
      sentenceCount,
    });
  };

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt((prev) => (prev ? `${prev} ${suggestion}` : suggestion));
  };

  const sentencesSummary = section.sentences?.length
    ? `${section.sentences.length} sentences about ${section.sentences[0]?.text?.slice(0, 50)}...`
    : 'No sentences yet';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative bg-[#1a1625] border border-white/10 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={`AI Expansion dialog for section ${section.title}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/20">
              <Icons.Sparkles className="text-primary" size={20} />
            </div>
            <h3 className="text-lg font-bold text-white">Expand with AI</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <Icons.X size={18} />
          </button>
        </div>

        {/* Section Context */}
        <div className="mb-5 p-3 bg-white/5 rounded-lg border border-white/10">
          <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
            Section Context
          </div>
          <div className="text-sm text-white font-medium">{section.title}</div>
          <div className="text-xs text-text-muted mt-1">{sentencesSummary}</div>
        </div>

        {/* Mode Toggle */}
        <div className="mb-5">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
            Generation Mode
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setMode('quick')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
                mode === 'quick'
                  ? 'bg-primary text-white shadow-lg shadow-primary/20'
                  : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white border border-white/10'
              }`}
            >
              <Icons.Zap size={16} />
              Quick Generate
            </button>
            <button
              onClick={() => setMode('guided')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
                mode === 'guided'
                  ? 'bg-primary text-white shadow-lg shadow-primary/20'
                  : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white border border-white/10'
              }`}
            >
              <Icons.MessageSquare size={16} />
              Guided
            </button>
          </div>
        </div>

        {/* Guided Mode Prompt */}
        {mode === 'guided' && (
          <div className="mb-5">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
              What should the AI focus on?
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Add more detail about X, Explain the process of Y, Include a fun fact about Z"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-text-muted/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              rows={3}
            />
            {/* Prompt Suggestions */}
            <div className="flex flex-wrap gap-2 mt-2">
              {PROMPT_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion.label}
                  onClick={() => handleSuggestionClick(suggestion.label)}
                  className="px-2.5 py-1 text-[10px] font-bold text-text-muted bg-white/5 hover:bg-primary/10 hover:text-primary border border-white/10 hover:border-primary/30 rounded-full transition-all"
                  title={suggestion.description}
                >
                  + {suggestion.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sentence Count */}
        <div className="mb-6">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
            Number of sentences
          </div>
          <div className="flex gap-2">
            {SENTENCE_COUNT_OPTIONS.map((count) => (
              <button
                key={count}
                onClick={() => setSentenceCount(count)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-all ${
                  sentenceCount === count
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white border border-white/10'
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-bold text-text-muted hover:text-white transition-colors"
            disabled={isGenerating}
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || (mode === 'guided' && !prompt.trim())}
            className="px-4 py-2 bg-primary hover:bg-primary/80 rounded-lg text-sm font-bold text-white transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
          >
            {isGenerating ? (
              <>
                <Icons.RefreshCw className="animate-spin" size={16} />
                Generating...
              </>
            ) : (
              <>
                <Icons.Sparkles size={16} />
                Generate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIExpansionModal;
