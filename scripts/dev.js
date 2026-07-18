const { spawn } = require('node:child_process');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const npmCmd = process.platform === 'win32' ? 'cmd.exe' : 'npm';

function startProcess(label, cwd, args) {
  const child = spawn(npmCmd, process.platform === 'win32' ? ['/c', 'npm', ...args] : args, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env }
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`${label} exited from signal ${signal}`);
      process.exit(1);
    }

    if (code !== 0) {
      console.error(`${label} exited with code ${code}`);
      process.exit(code || 1);
    }
  });

  return child;
}

console.log('Starting backend and frontend from the project root...');
const backend = startProcess('Backend', path.join(rootDir, 'Backend'), ['run', 'dev']);
const frontend = startProcess('Frontend', path.join(rootDir, 'Frontend'), ['run', 'dev']);

const shutdown = () => {
  backend.kill('SIGTERM');
  frontend.kill('SIGTERM');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
