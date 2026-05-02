import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import pkg from './package.json';

const APP_VERSION_DEFINE = { __APP_VERSION__: JSON.stringify(pkg.version) };

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      lib: { entry: resolve(__dirname, 'src/main/index.ts') },
    },
    define: APP_VERSION_DEFINE,
  },
  preload: {
    build: {
      outDir: 'out/preload',
      lib: { entry: resolve(__dirname, 'src/preload/index.ts') },
    },
    define: APP_VERSION_DEFINE,
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    base: './',
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') },
    },
    plugins: [react()],
    define: APP_VERSION_DEFINE,
  },
});
