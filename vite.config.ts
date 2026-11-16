/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    // The Cnmbuck Orb, copied unchanged from the brand kit (see src/brand/README.md).
    alias: {
      '@cnmbuck/orb': fileURLToPath(new URL('./src/brand/cnmbuck-orb.ts', import.meta.url)),
    },
  },
  // `single` mode bundles everything into one script so the build can be shared as one page.
  build:
    mode === 'single'
      ? { outDir: 'dist-single', rollupOptions: { output: { inlineDynamicImports: true } } }
      : {},
  test: {
    include: ['tests/**/*.test.ts'],
  },
}));
