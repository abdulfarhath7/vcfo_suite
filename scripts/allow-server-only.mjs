/**
 * Preload for local scripts that import server modules (`import 'server-only'`) AND render
 * with React, such as the review PDF in `npm run ask:feeds:once`.
 *
 * The other scripts pass `--conditions=react-server` so that `server-only` does not throw. That
 * flag also swaps React for its server build, which has no client internals, and
 * @react-pdf/renderer then fails with "Cannot read properties of undefined (reading 'S')"
 * (found 2026-11-05: items captured by the scheduled task had no review PDF). This preload
 * resolves `server-only` to an empty module instead, as the Vitest stub does, and leaves React alone.
 *
 * Usage: node --import ./scripts/allow-server-only.mjs --import tsx <script>
 */
import { registerHooks } from 'node:module';

const EMPTY_MODULE = 'data:text/javascript,export {};';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') return { url: EMPTY_MODULE, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
