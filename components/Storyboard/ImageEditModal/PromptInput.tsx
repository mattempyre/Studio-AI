import React from 'react';
import type { PromptInputProps } from './types';

const PromptInput: React.FC<PromptInputProps> = ({
  value,
  onChange,
  placeholder = 'Describe what you want to change...',
  maxLength = 500,
}) => {
  const charCount = value.length;
  const isNearLimit = charCount >= maxLength * 0.9;
  const isAtLimit = charCount >= maxLength;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
          Edit Prompt
        </label>
        <span
          className={`text-[10px] ${
            isAtLimit
              ? 'text-error'
              : isNearLimit
              ? 'text-warning'
              : 'text-text-muted'
          }`}
        >
          {charCount}/{maxLength}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        placeholder={placeholder}
        className="w-full bg-[#1e1933] border border-white/10 rounded-lg p-3 text-sm text-white/90 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50 leading-relaxed min-h-[80px] resize-none"
        rows={3}
      />
      <p className="text-[10px] text-text-muted">
        Describe the changes you want to make to the image
      </p>
    </div>
  );
};

export default PromptInput;
