import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = path.join(root, 'artifacts');
mkdirSync(artifacts, { recursive: true });
// Separate runs never share pytest's user-wide temporary directory or cache.
const run = mkdtempSync(path.join(artifacts, 'api-tests-'));
const child = spawn(
  'uv',
  [
    'run',
    '--project',
    'backend',
    '--extra',
    'dev',
    'pytest',
    'backend/tests',
    '--basetemp',
    path.join(run, 'tmp'),
    '-o',
    `cache_dir=${path.join(run, 'cache')}`,
    ...process.argv.slice(2),
  ],
  { cwd: root, stdio: 'inherit', windowsHide: true, env: { ...process.env, OPENAI_API_KEY: '' } },
);
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
