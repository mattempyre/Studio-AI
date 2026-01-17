import { Voice } from '../../types';

// Debounce utility
export function debounce<T extends (...args: Parameters<T>) => void>(
    func: T,
    wait: number
): T & { cancel: () => void } {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const debounced = (...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            func(...args);
            timeoutId = null;
        }, wait);
    };

    debounced.cancel = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };

    return debounced as T & { cancel: () => void };
}

// Sentence status indicator colors
export const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    generating: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
};

// Visual style options
export const VISUAL_STYLES = [
    'Cinematic',
    'Photorealistic',
    'Anime',
    '3D Render',
    'Minimalist Sketch',
    'Comic Book',
    'Pixel Art',
    'MS Paint Explainer',
    'Stickman',
    'Cyberpunk',
    'Watercolor',
];

// Duration presets in minutes
export const DURATION_PRESETS = [8, 15, 30, 60, 90, 120];

// Format duration for display
export const formatDuration = (mins: number): string => {
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remaining = mins % 60;
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
};

// Mock Data for Platform Voices
export const PLATFORM_VOICES: Voice[] = [
    { id: 'v_puck', name: 'Puck', category: 'platform', style: 'Energetic', gender: 'Male' },
    { id: 'v_kore', name: 'Kore', category: 'platform', style: 'Calm & Soothing', gender: 'Female' },
    { id: 'v_fenrir', name: 'Fenrir', category: 'platform', style: 'Deep & Authoritative', gender: 'Male' },
    { id: 'v_charon', name: 'Charon', category: 'platform', style: 'Narrative Storyteller', gender: 'Male' },
    { id: 'v_zephyr', name: 'Zephyr', category: 'platform', style: 'Friendly Assistant', gender: 'Female' },
];
