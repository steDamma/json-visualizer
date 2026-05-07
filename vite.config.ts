import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ command }) => ({
  // In build mode (Electron), use relative paths so index.html
  // works when loaded via file:// protocol.
  base: command === 'build' ? './' : '/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    outDir: 'dist',
  },
}));
