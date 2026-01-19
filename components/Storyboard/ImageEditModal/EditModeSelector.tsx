import React from 'react';
import * as Icons from '../../Icons';
import type { EditMode, EditModeSelectorProps } from './types';

const EditModeSelector: React.FC<EditModeSelectorProps> = ({
  mode,
  onModeChange,
}) => {
  const modes: { value: EditMode; label: string; icon: React.ReactNode; description: string }[] = [
    {
      value: 'full',
      label: 'Full Edit',
      icon: <Icons.Wand2 size={16} />,
      description: 'Modify entire image with prompt',
    },
    {
      value: 'inpaint',
      label: 'Selective Edit',
      icon: <Icons.Scissors size={16} />,
      description: 'Paint area to edit',
    },
  ];

  return (
    <div className="flex gap-2">
      {modes.map((m) => (
        <button
          key={m.value}
          onClick={() => onModeChange(m.value)}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all ${
            mode === m.value
              ? 'bg-primary/20 border-primary text-white'
              : 'bg-surface-1 border-white/10 text-text-muted hover:text-white hover:border-white/20'
          }`}
          title={m.description}
        >
          {m.icon}
          <span className="text-sm font-medium">{m.label}</span>
        </button>
      ))}
    </div>
  );
};

export default EditModeSelector;
