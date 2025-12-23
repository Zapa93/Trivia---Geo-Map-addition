import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    legacy({
      targets: ['chrome >= 69'], // Broad support for WebOS versions
      renderLegacyChunks: true,
      modernPolyfills: true,
    }),
  ],
});