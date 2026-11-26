import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The in-page script (`src/inpage/entry.ts`, the extension's portal agent) as source text. The
 * built image reads `dist/inpage.js`; tests and a first local run build it in memory with esbuild.
 */
let cached: string | null = null;

export async function agentScript(): Promise<string> {
  if (cached) return cached;
  const here = path.dirname(fileURLToPath(import.meta.url));
  // From dist/ (the image) the built file sits beside the server; from src/ (tests) it is built fresh.
  const built = path.join(here, 'inpage.js');
  if (existsSync(built)) {
    cached = readFileSync(built, 'utf8');
    return cached;
  }
  const { build } = await import('esbuild');
  const out = await build({
    entryPoints: [path.join(here, 'inpage/entry.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: ['chrome120'],
    logLevel: 'silent',
    tsconfig: path.join(here, '../tsconfig.json'),
  });
  cached = out.outputFiles[0]!.text;
  return cached;
}
