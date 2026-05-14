// Clears ELECTRON_RUN_AS_NODE before spawning Electron so the app
// runs as a GUI app, not as a Node.js CLI tool.
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import * as path from 'path';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const appDir = path.dirname(fileURLToPath(import.meta.url)).replace(/scripts$/, '');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;   // critical — must not be set for GUI mode

const child = spawn(electronPath, [appDir], {
  stdio: 'inherit',
  env,
});

child.on('close', code => process.exit(code ?? 0));
