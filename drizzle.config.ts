import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit is a standalone CLI — unlike `next dev`, it does NOT read
 * .env.local automatically, so DATABASE_URL would be undefined without this.
 *
 * process.loadEnvFile is built into Node 18.20+/20.6+/22 — no dotenv needed.
 * Existing environment variables win, so `DATABASE_URL=... npm run db:migrate`
 * and AWS (where the value comes from the task environment, with no file on
 * disk) both keep working. The try/catch is for exactly that case.
 */
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // No such file — fall through to the real environment.
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env.local (see CLAUDE.md ' +
      'Setup), or export DATABASE_URL for this command.',
  );
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
