import { defineConfig, type Plugin } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Dev-only helper: the in-game `__aetheria.shot(name)` hook posts a frame here and it is written to
// node_modules/.cache/shots/<name>.jpg, so automated visual checks do not depend on window capture.
function shotSink(): Plugin {
  return {
    name: 'aetheria-shot-sink',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__shot', (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const name = (url.searchParams.get('name') ?? 'shot').replace(/[^a-z0-9_-]/gi, '_');
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString('utf8');
            const b64 = body.slice(body.indexOf(',') + 1);
            const dir = join(process.cwd(), 'node_modules', '.cache', 'shots');
            mkdirSync(dir, { recursive: true });
            writeFileSync(join(dir, name + '.jpg'), Buffer.from(b64, 'base64'));
            res.statusCode = 200;
            res.end('ok');
          } catch (err) {
            res.statusCode = 500;
            res.end(String(err));
          }
        });
      });
    },
  };
}

// The game ships as a standalone Windows desktop app (Electron) and as a web build on GitHub Pages
// (served from a sub-path, hence the relative base). The codex in wiki/ is deployed next to it.
export default defineConfig({
  base: './',
  plugins: [shotSink()],
  optimizeDeps: { entries: ['index.html'] },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173 },
  build: { outDir: 'dist', target: 'es2020', chunkSizeWarningLimit: 4000, assetsInlineLimit: 0 },
});
