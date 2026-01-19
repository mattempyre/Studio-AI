import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Support custom port via VITE_PORT for worktree development
    const port = env.VITE_PORT ? parseInt(env.VITE_PORT, 10) : 3000;

    // Backend server port (default 3001, or from env)
    const backendPort = env.PORT ? parseInt(env.PORT, 10) : 3001;

    return {
      server: {
        port,
        host: '0.0.0.0',
        proxy: {
          '/api/v1': {
            target: `http://localhost:${backendPort}`,
            changeOrigin: true,
          },
          '/media': {
            target: `http://localhost:${backendPort}`,
            changeOrigin: true,
          },
        },
      },
      plugins: [react(), tailwindcss()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
