import { defineConfig } from 'vite';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
  build: {
    emptyOutDir: false,
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true },
      mangle: true,
    },
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content-scripts/index.ts'),
      },
      output: {
        format: 'iife',
        entryFileNames: 'content.js',
        assetFileNames: '[name][extname]',
      },
    },
  },
});
