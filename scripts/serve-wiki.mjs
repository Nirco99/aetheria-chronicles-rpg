// Minimal static file server for previewing the strategy wiki locally: node scripts/serve-wiki.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'wiki');
const port = Number(process.argv[2] ?? 4180);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let p = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!p.startsWith(root)) throw new Error('outside root');
    if ((await stat(p)).isDirectory()) p = join(p, 'index.html');
    const body = await readFile(p);
    res.writeHead(200, { 'Content-Type': TYPES[extname(p)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Strategy wiki: http://127.0.0.1:${port}/`));
