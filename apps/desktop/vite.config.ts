import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

function viteDevServerPort(env: Record<string, string>): number {
  const raw = env.VITE_DEV_PORT;
  if (!raw || !/^\d+$/.test(raw)) return 5173;
  const n = Number(raw);
  return n >= 1 && n <= 65535 ? n : 5173;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const port = viteDevServerPort(env);

  return {
    plugins: [react()],
    base: './',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port,
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        external: ['electron'],
      },
    },
    optimizeDeps: {
      exclude: ['electron'],
    },
  };
});
