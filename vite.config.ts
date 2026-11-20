import { defineConfig } from 'vite';

// The game ships as a standalone Windows desktop app (Electron); the bilingual strategy wiki in
// wiki/ is deployed separately to GitHub Pages and bundled into the app as an offline fallback.
export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173 },
  build: { outDir: 'dist', target: 'es2020', chunkSizeWarningLimit: 4000, assetsInlineLimit: 0 },
});
