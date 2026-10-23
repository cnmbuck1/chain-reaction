/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // `single` mode bundles everything into one script so the build can be shared as one page.
  build:
    mode === 'single'
      ? { outDir: 'dist-single', rollupOptions: { output: { inlineDynamicImports: true } } }
      : {},
  test: {
    include: ['tests/**/*.test.ts'],
  },
}));
