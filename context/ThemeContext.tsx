import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Theme definitions
export const THEMES = {
  'coral-glow': {
    name: 'Coral Glow',
    description: 'Vibrant coral on deep black',
    isDark: true,
    colors: {
      primary: '#f05a38',
      'primary-hover': '#ff6b4a',
      'primary-muted': '#d14a2c',
      secondary: '#a1887d',
      'secondary-hover': '#b09890',
      'surface-0': '#0a0a0a',
      'surface-1': '#121212',
      'surface-2': '#1a1a1a',
      'surface-3': '#222222',
      'surface-4': '#2a2a2a',
      'border-subtle': '#1f1f1f',
      'border-color': '#2d2d2d',
      'border-strong': '#3d3d3d',
      'text-primary': '#f5f5f5',
      'text-secondary': '#b8bcc4',
      'text-muted': '#8b9199',
    },
    glow: 'rgba(240, 90, 56, 0.25)',
  },
  'ocean-blue': {
    name: 'Ocean Blue',
    description: 'Cool blue on deep charcoal',
    isDark: true,
    colors: {
      primary: '#3b82f6',
      'primary-hover': '#60a5fa',
      'primary-muted': '#2563eb',
      secondary: '#64748b',
      'secondary-hover': '#94a3b8',
      'surface-0': '#0c0c0f',
      'surface-1': '#131318',
      'surface-2': '#1a1a21',
      'surface-3': '#22222b',
      'surface-4': '#2a2a35',
      'border-subtle': '#1e1e28',
      'border-color': '#2d2d3a',
      'border-strong': '#3d3d4a',
      'text-primary': '#f1f5f9',
      'text-secondary': '#b4c0d0',
      'text-muted': '#8a96a8',
    },
    glow: 'rgba(59, 130, 246, 0.25)',
  },
  'forest-green': {
    name: 'Forest Green',
    description: 'Fresh green on dark slate',
    isDark: true,
    colors: {
      primary: '#22c55e',
      'primary-hover': '#4ade80',
      'primary-muted': '#16a34a',
      secondary: '#6b7280',
      'secondary-hover': '#9ca3af',
      'surface-0': '#0a0c0a',
      'surface-1': '#121514',
      'surface-2': '#1a1e1c',
      'surface-3': '#222724',
      'surface-4': '#2a302c',
      'border-subtle': '#1e2420',
      'border-color': '#2d352f',
      'border-strong': '#3d453f',
      'text-primary': '#f0fdf4',
      'text-secondary': '#b5c0b8',
      'text-muted': '#8a958e',
    },
    glow: 'rgba(34, 197, 94, 0.25)',
  },
} as const;

export type ThemeId = keyof typeof THEMES;

interface ThemeContextType {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  themeConfig: typeof THEMES[ThemeId];
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    // Load from localStorage or default to coral-glow
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('studio-theme') as ThemeId;
      if (saved && THEMES[saved]) return saved;
    }
    return 'coral-glow';
  });

  const setTheme = (newTheme: ThemeId) => {
    setThemeState(newTheme);
    localStorage.setItem('studio-theme', newTheme);
  };

  // Apply CSS variables when theme changes
  useEffect(() => {
    const config = THEMES[theme];
    const root = document.documentElement;

    // Update CSS variables
    Object.entries(config.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
    root.style.setProperty('--glow-color', config.glow);

    // Update body background
    document.body.style.backgroundColor = config.colors['surface-0'];
    document.body.style.color = config.colors['text-primary'];

    // Update scrollbar colors
    const style = document.getElementById('theme-scrollbar') || document.createElement('style');
    style.id = 'theme-scrollbar';
    style.textContent = `
      ::-webkit-scrollbar-track { background: ${config.colors['surface-0']}; }
      ::-webkit-scrollbar-thumb { background: ${config.colors['border-color']}; }
      ::-webkit-scrollbar-thumb:hover { background: ${config.colors['border-strong']}; }
      ::selection { background: ${config.glow}; }
    `;
    if (!document.getElementById('theme-scrollbar')) {
      document.head.appendChild(style);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themeConfig: THEMES[theme] }}>
      {children}
    </ThemeContext.Provider>
  );
};
