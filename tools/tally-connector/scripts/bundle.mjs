// Bundles src/cli.ts and its one dependency into dist/connector.cjs (CommonJS, as Node SEA requires).
import { build } from 'esbuild';

await build({
  entryPoints: ['src/cli.ts'],
  outfile: 'dist/connector.cjs',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  legalComments: 'none',
  logLevel: 'info',
});
