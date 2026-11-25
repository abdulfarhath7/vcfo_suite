import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface Config {
  baseUrl: string;
  token?: string;
  sheetName?: string;
  tallyPort: number;
  pairedAt?: string;
}

export const DEFAULT_URL = 'https://app.sbctrack.in';
export const DEFAULT_TALLY_PORT = 9000;

/** %APPDATA%\VCFO Tally Connector on Windows, ~/.config/vcfo-tally-connector elsewhere (dev). */
export function configDir(): string {
  if (process.env.VCFO_TALLY_CONFIG_DIR) return process.env.VCFO_TALLY_CONFIG_DIR;
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'VCFO Tally Connector');
  }
  return path.join(os.homedir(), '.config', 'vcfo-tally-connector');
}

export const configPath = () => path.join(configDir(), 'config.json');

export function loadConfig(): Config {
  try {
    const raw = JSON.parse(fs.readFileSync(configPath(), 'utf8')) as Partial<Config>;
    return {
      baseUrl: raw.baseUrl || DEFAULT_URL,
      token: raw.token || undefined,
      sheetName: raw.sheetName,
      tallyPort: Number(raw.tallyPort) || DEFAULT_TALLY_PORT,
      pairedAt: raw.pairedAt,
    };
  } catch {
    return { baseUrl: DEFAULT_URL, tallyPort: DEFAULT_TALLY_PORT };
  }
}

export function saveConfig(cfg: Config): void {
  fs.mkdirSync(configDir(), { recursive: true });
  const tmp = configPath() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, configPath());
}
