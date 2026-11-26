// Builds the live browser service into dist/:
//   dist/inpage.js   the VCFO Assist portal agent (guards, scanner, filler, overlay) as one IIFE
//                    the broker injects into every portal page;
//   dist/server.mjs  the broker itself (Node, ESM), with playwright and ws left as packages.
// The engine, guards and heal ladder come from extensions/vcfo-assist/src and the Suite contract
// from src/lib/live-browser/contract.ts; both are bundled in, so the image needs neither folder at
// run time (the Dockerfile still copies them, because the build runs inside the image).
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.join(here, 'src/inpage/entry.ts')],
  outfile: path.join(here, 'dist/inpage.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome120'],
  minify: false,
  legalComments: 'none',
  logLevel: 'warning',
  tsconfig: path.join(here, 'tsconfig.json'),
});

await build({
  entryPoints: [path.join(here, 'src/main.ts')],
  outfile: path.join(here, 'dist/server.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['node22'],
  packages: 'external',
  logLevel: 'warning',
  tsconfig: path.join(here, 'tsconfig.json'),
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});

console.log('built dist/inpage.js and dist/server.mjs');
