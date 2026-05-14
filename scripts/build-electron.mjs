import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'dist-electron');

// Clean output
if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

// Mark electron + all native AI SDKs as external so they stay as require() calls.
// electron-builder will include them from node_modules (they're in "dependencies").
const external = [
  'electron',
  '@google/generative-ai',
  'openai',
  '@anthropic-ai/sdk',
];

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  external,
  format: 'cjs',
  sourcemap: false,
};

await Promise.all([
  esbuild.build({
    ...shared,
    entryPoints: [path.join(root, 'electron/main.ts')],
    outfile: path.join(outDir, 'main.js'),
  }),
  esbuild.build({
    ...shared,
    entryPoints: [path.join(root, 'electron/preload.ts')],
    outfile: path.join(outDir, 'preload.js'),
  }),
]);

console.log('✓ Electron bundles built (AI SDKs kept as external) → dist-electron/');
