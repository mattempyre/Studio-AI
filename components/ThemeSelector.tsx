import React, { useState, useRef, useEffect } from 'react';
import { useTheme, THEMES, ThemeId } from '../context/ThemeContext';
import * as Icons from './Icons';

const ThemeSelector: React.FC = () => {
  const { theme, setTheme, themeConfig } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const themeEntries = Object.entries(THEMES) as [ThemeId, typeof THEMES[ThemeId]][];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-white transition-colors"
        title="Change theme"
      >
        {themeConfig.isDark ? (
          <Icons.Moon size={20} />
        ) : (
          <Icons.Sun size={20} />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-surface-2 border border-border-color rounded-xl shadow-lg overflow-hidden z-50">
          <div className="p-2">
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider px-2 py-1">
              Theme
            </p>
            {themeEntries.map(([id, config]) => (
              <button
                key={id}
                onClick={() => {
                  setTheme(id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  theme === id
                    ? 'bg-primary/20 text-white'
                    : 'text-text-secondary hover:bg-white/5 hover:text-white'
                }`}
              >
                {/* Color preview */}
                <div
                  className="size-5 rounded-md border border-white/20 flex-shrink-0"
                  style={{ backgroundColor: config.colors.primary }}
                />
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">{config.name}</p>
                  <p className="text-[10px] text-text-muted">{config.description}</p>
                </div>
                {theme === id && (
                  <Icons.CheckCircle size={16} className="text-primary flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeSelector;
