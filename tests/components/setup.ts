import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Mock fetch globally
global.fetch = vi.fn();

// Mock environment variables
vi.stubEnv('VITE_API_URL', 'http://localhost:3001');

// Reset mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});
