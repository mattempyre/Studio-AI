import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Run test files sequentially to prevent database race conditions
    fileParallelism: false,
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/backend/**/*.ts'],
      exclude: [
        'src/backend/**/*.test.ts',
        'src/backend/types/**',
        'src/backend/server.ts',    // Infrastructure - not unit testable
        'src/backend/api/index.ts', // Re-exports only
      ],
    },
    setupFiles: ['./tests/setup.ts'],
  },
});
