import { defineConfig, type Plugin } from 'vite';
import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Copies the standalone bilingual wiki (plain HTML/CSS/JS, no bundling) into dist/wiki. */
function copyWiki(): Plugin {
  return {
    name: 'aetheria-copy-wiki',
    apply: 'build',
    closeBundle() {
      const src = resolve(process.cwd(), 'wiki');
      const dest = resolve(process.cwd(), 'dist', 'wiki');
      if (existsSync(src)) cpSync(src, dest, { recursive: true });
    },
  };
}

export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173 },
  build: { outDir: 'dist', target: 'es2020', chunkSizeWarningLimit: 4000, assetsInlineLimit: 0 },
  plugins: [copyWiki()],
});
