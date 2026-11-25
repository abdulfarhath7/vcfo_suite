import os from 'node:os';
import readline from 'node:readline/promises';
import { configPath, DEFAULT_TALLY_PORT, DEFAULT_URL, loadConfig, saveConfig } from './config';
import { log, logPath } from './log';
import { runLoop } from './runner';
import { readCompanyName, TallyError } from './tally';
import { UnauthorizedError, VcfoClient } from './vcfo';
import { VERSION } from './version';

const HELP = `VCFO Tally Connector ${VERSION}

Usage:
  vcfo-tally-connector pair <CODE> [--url ${DEFAULT_URL}] [--tally-port ${DEFAULT_TALLY_PORT}]
  vcfo-tally-connector run       wait for sync jobs from VCFO (the default once paired)
  vcfo-tally-connector status    show the saved connection
  vcfo-tally-connector test      check that TallyPrime answers and print the open company
`;

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, inline] = a.slice(2).split('=', 2);
      flags[k] = inline ?? argv[++i] ?? '';
    } else positional.push(a);
  }
  return { positional, flags };
}

async function cmdTest(port: number): Promise<number> {
  try {
    const company = await readCompanyName(port);
    console.log(`TallyPrime answered on port ${port}. Open company: ${company ?? '(none loaded)'}`);
    return company ? 0 : 1;
  } catch (e) {
    console.error(e instanceof TallyError ? e.message : String(e));
    return 1;
  }
}

async function cmdPair(code: string | undefined, flags: Record<string, string>): Promise<number> {
  if (!code) {
    console.error('Give the code from VCFO\'s "Connect Tally" dialog: vcfo-tally-connector pair <CODE>');
    return 1;
  }
  const cfg = loadConfig();
  const baseUrl = flags.url || cfg.baseUrl || DEFAULT_URL;
  const tallyPort = Number(flags['tally-port']) || cfg.tallyPort || DEFAULT_TALLY_PORT;

  let tallyCompany: string | null = null;
  try {
    tallyCompany = await readCompanyName(tallyPort);
  } catch (e) {
    console.warn(`Warning: ${(e as Error).message}. Pairing anyway.`);
  }
  try {
    const { token, sheetName } = await new VcfoClient(baseUrl).pair({
      code: code.trim(),
      name: os.hostname(),
      version: VERSION,
      tallyCompany,
    });
    saveConfig({ baseUrl, token, sheetName, tallyPort, pairedAt: new Date().toISOString() });
    log.info(`paired with ${baseUrl} for sheet "${sheetName}"`);
    console.log(`Paired. This PC now sends Tally data to "${sheetName}". Start it with: vcfo-tally-connector run`);
    return 0;
  } catch (e) {
    const msg = e instanceof UnauthorizedError ? 'The code was refused. Get a fresh code from VCFO.' : (e as Error).message;
    log.error(`pairing failed: ${msg}`);
    return 1;
  }
}

async function cmdStatus(): Promise<number> {
  const cfg = loadConfig();
  console.log(`Config file : ${configPath()}`);
  console.log(`Log file    : ${logPath()}`);
  console.log(`VCFO        : ${cfg.baseUrl}`);
  console.log(`Paired      : ${cfg.token ? `yes, sheet "${cfg.sheetName ?? ''}" since ${cfg.pairedAt ?? '?'}` : 'no'}`);
  console.log(`Tally port  : ${cfg.tallyPort}`);
  return cmdTest(cfg.tallyPort);
}

async function cmdRun(): Promise<number> {
  const cfg = loadConfig();
  if (!cfg.token) {
    console.error('Not paired yet. Run: vcfo-tally-connector pair <CODE>');
    return 1;
  }
  await runLoop(cfg, log);
  return 2; // only reached after a 401
}

/** When the .exe is double-clicked, keep the window open so the message can be read. */
async function pauseIfDoubleClicked(noArgs: boolean) {
  if (!noArgs || process.platform !== 'win32' || !process.stdin.isTTY) return;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await rl.question('Press Enter to close.');
  rl.close();
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const { positional, flags } = parseArgs(argv);
  let cmd = positional[0];
  if (!cmd) cmd = loadConfig().token ? 'run' : 'help';

  switch (cmd) {
    case 'pair':
      return cmdPair(positional[1], flags);
    case 'run':
      return cmdRun();
    case 'status':
      return cmdStatus();
    case 'test':
      return cmdTest(Number(flags['tally-port']) || loadConfig().tallyPort);
    case 'version':
    case '--version':
      console.log(VERSION);
      return 0;
    default:
      console.log(HELP);
      return cmd === 'help' ? 0 : 1;
  }
}

main()
  .then(async (code) => {
    await pauseIfDoubleClicked(process.argv.length <= 2);
    process.exit(code);
  })
  .catch((e) => {
    log.error(`fatal: ${(e as Error)?.stack ?? e}`);
    process.exit(1);
  });
