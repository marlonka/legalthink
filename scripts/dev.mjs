import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!existsSync(path.join(root, 'frontend', 'node_modules', 'vite'))) {
  console.error(
    'Frontend dependencies are missing. Run: npm --prefix frontend ci && uv sync --project backend --frozen',
  );
  process.exit(1);
}
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } else child.kill('SIGTERM');
  }
  process.exitCode = code;
}

function start(command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.on('error', (error) => {
    console.error(`Could not start ${command}: ${error.message}`);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stop(code || 0);
  });
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
start(
  'uv',
  [
    'run',
    '--project',
    'backend',
    'uvicorn',
    'app.main:app',
    '--app-dir',
    'backend',
    '--host',
    '127.0.0.1',
    '--port',
    '8000',
    '--reload',
    '--reload-dir',
    'backend/app',
  ],
  root,
);
start(
  process.execPath,
  [
    path.join(root, 'frontend/node_modules/vite/bin/vite.js'),
    '--host',
    '127.0.0.1',
    '--port',
    '5175',
    '--strictPort',
  ],
  path.join(root, 'frontend'),
);
