#!/usr/bin/env node
import { spawn } from 'node:child_process';

const passthroughArgs = process.argv.slice(2).filter((arg) => arg !== '--runInBand');
const child = spawn('npx', ['vitest', 'run', ...passthroughArgs], {
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
