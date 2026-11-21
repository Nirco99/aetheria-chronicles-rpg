// Packages the Windows desktop build with electron-builder without losing the player's saves.
//
// The game keeps its saves in release/win-unpacked/saves, next to the exe, and electron-builder
// empties release/win-unpacked before it writes a new build. So the saves are copied out first and
// put back afterwards. The dated copies stay in release/saves-backup (the five newest are kept) in
// case a build is interrupted half way.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'release', 'win-unpacked');
const saves = path.join(out, 'saves');
const backupRoot = path.join(root, 'release', 'saves-backup');
const KEEP = 5;

const hasFiles = (dir) => fs.existsSync(dir) && fs.readdirSync(dir).length > 0;

let backup = null;
if (hasFiles(saves)) {
  backup = path.join(backupRoot, new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(backupRoot, { recursive: true });
  fs.cpSync(saves, backup, { recursive: true });
  console.log(`[pack] saves backed up to ${path.relative(root, backup)}`);
}

const cli = path.join(root, 'node_modules', 'electron-builder', 'cli.js');
const result = spawnSync(process.execPath, [cli, '--win', '--dir'], { cwd: root, stdio: 'inherit' });

// Put the saves back even when packaging failed, unless they survived on their own.
if (backup && !hasFiles(saves)) {
  fs.mkdirSync(out, { recursive: true });
  fs.cpSync(backup, saves, { recursive: true });
  console.log('[pack] saves restored next to the exe');
}

if (fs.existsSync(backupRoot)) {
  const old = fs.readdirSync(backupRoot).sort().slice(0, -KEEP);
  for (const name of old) fs.rmSync(path.join(backupRoot, name), { recursive: true, force: true });
}

if (result.status !== 0) {
  console.error('[pack] electron-builder failed');
  process.exit(result.status ?? 1);
}

// The launcher compares this stamp with package.json to know when the exe is out of date.
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
fs.writeFileSync(path.join(out, 'build-version.txt'), `${version}\r\n`, 'ascii');
console.log(`[pack] Aetheria Chronicles ${version} is in release/win-unpacked`);
