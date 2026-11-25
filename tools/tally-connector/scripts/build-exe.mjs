// Builds dist/vcfo-tally-connector.exe as a Node Single Executable Application.
//
// Steps: esbuild bundle -> node --experimental-sea-config -> copy a node binary -> postject.
// On Windows the running node.exe is used. On Linux or macOS, set NODE_WIN_EXE to a Windows
// node.exe of the SAME Node version as the one running this script (download it from
// https://nodejs.org/dist/v<version>/win-x64/node.exe); without it the script builds a
// binary for the current platform instead, which is only useful as a smoke test.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

run(process.execPath, ['scripts/bundle.mjs']);

fs.writeFileSync(
  'dist/sea-config.json',
  JSON.stringify({
    main: 'dist/connector.cjs',
    output: 'dist/sea-prep.blob',
    disableExperimentalSEAWarning: true,
    useCodeCache: false,
    useSnapshot: false,
  }),
);
run(process.execPath, ['--experimental-sea-config', 'dist/sea-config.json']);

const winSource = process.platform === 'win32' ? process.execPath : process.env.NODE_WIN_EXE;
const forWindows = Boolean(winSource);
const source = winSource || process.execPath;
const out = path.join('dist', forWindows ? 'vcfo-tally-connector.exe' : 'vcfo-tally-connector');
fs.copyFileSync(source, out);
fs.chmodSync(out, 0o755);

if (process.platform === 'win32') {
  // The copied node.exe carries Node's signature, which injection invalidates. Remove it when
  // signtool is available (Windows SDK); otherwise postject only prints a warning.
  try {
    run('signtool', ['remove', '/s', out]);
  } catch {
    console.warn('signtool not found; continuing with the original signature in place.');
  }
}

const postjectArgs = [
  'postject', out, 'NODE_SEA_BLOB', 'dist/sea-prep.blob',
  '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
];
if (process.platform === 'darwin' && !forWindows) postjectArgs.push('--macho-segment-name', 'NODE_SEA');
run(npx, postjectArgs);

console.log(`Built ${out}${forWindows ? '' : ' (host platform only: set NODE_WIN_EXE for the Windows .exe)'}`);
