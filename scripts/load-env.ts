/**
 * Loads .env.local / .env into process.env for standalone CLI scripts.
 *
 * MUST be imported BEFORE anything that reads process.env at module scope —
 * notably src/db/client.ts, which builds its Pool from DATABASE_URL the moment
 * it is imported. ES module imports are hoisted and evaluated in source order,
 * so `import './load-env'` on the first line runs before the db import; an
 * inline loop in the consumer would NOT, because it executes after every
 * import has already been evaluated.
 *
 * process.loadEnvFile is built into Node (18.20+/20.6+/22) so this needs no
 * dotenv dependency, and it does not overwrite variables already present —
 * .env.local beats .env, and a real environment (CI, App Runner) beats both.
 */
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // No such file — fall through to the real environment.
  }
}

export {};
