import fs from 'node:fs';
import path from 'node:path';
import { configDir } from './config';

/**
 * A console + file logger. The file is connector.log in the config folder and rotates at
 * 1 MB, keeping three files (connector.log, connector.log.1, connector.log.2).
 * Never pass the token or voucher values here; log counts only.
 */
const MAX_BYTES = 1024 * 1024;
const KEEP = 3;

export const logPath = () => path.join(configDir(), 'connector.log');

function rotateIfNeeded(file: string): void {
  try {
    if (fs.statSync(file).size < MAX_BYTES) return;
  } catch {
    return;
  }
  for (let i = KEEP - 1; i >= 1; i--) {
    const src = i === 1 ? file : `${file}.${i - 1}`;
    try {
      fs.renameSync(src, `${file}.${i}`);
    } catch {
      /* missing file: nothing to rotate */
    }
  }
}

function write(level: string, msg: string): void {
  const line = `${new Date().toISOString()} ${level} ${msg}`;
  (level === 'ERROR' ? console.error : console.log)(line);
  try {
    fs.mkdirSync(configDir(), { recursive: true });
    const file = logPath();
    rotateIfNeeded(file);
    fs.appendFileSync(file, line + '\n');
  } catch {
    /* logging must never crash the connector */
  }
}

export const log = {
  info: (m: string) => write('INFO', m),
  warn: (m: string) => write('WARN', m),
  error: (m: string) => write('ERROR', m),
};
export type Logger = typeof log;
