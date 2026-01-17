import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@tanstack/react-router': path.resolve(__dirname, 'tests/helpers/tanstack-router-mock.tsx'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/components/**/*.test.ts', 'tests/components/**/*.test.tsx'],
    setupFiles: ['./tests/components/setup.ts'],
  },
});
