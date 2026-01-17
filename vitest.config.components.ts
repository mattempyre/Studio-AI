import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/components/**/*.test.ts', 'tests/components/**/*.test.tsx'],
    setupFiles: ['./tests/components/setup.ts'],
  },
});
