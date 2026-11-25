/**
 * npm run db:remove-demo-from-main [-- --yes]
 *
 * PLAN H2 cleanup (docs/context/notes/demo-data.md, "Demo logins"). Before H2 the demo logins
 * and their companies lived in the MAIN database, flagged `is_demo`. They now live in the demo
 * database, so this script takes them out of the main one.
 *
 * What it touches, and nothing else:
 *   - engagements with `is_demo = true`, and the rows that hang off them;
 *   - receivables sheets whose manager is a demo profile (the demo sheet), with their invoices;
 *   - profiles with `is_demo = true` (all on the demo mailbox domain), and the rows that hang off
 *     them (their sessions, Ask questions, tasks, activity…).
 *
 * Child rows: a foreign key with ON DELETE CASCADE or SET NULL is left to Postgres. A foreign key
 * without one (NO ACTION / RESTRICT) is handled here: a nullable column is set to null, so the
 * row itself stays; a required column means the row only exists for the demo row, so it is
 * deleted. Everything runs in one transaction; any error rolls all of it back.
 *
 * Dry run by default: it prints the counts and changes nothing. `--yes` deletes. A profile on the
 * demo mailbox domain that is NOT flagged `is_demo` is reported and never touched.
 *
 * Production: `npm run db:remove-demo-from-main:prod` (dry run) and then with `-- --yes`, through
 * the SSM tunnel (scripts/demo-prod.mjs). Take a snapshot first; the deploy runbook says when.
 */
import './load-env';

import { Pool, type PoolClient } from 'pg';
import { poolConfig } from '../src/db/client';
import { DEMO_EMAIL_DOMAIN } from '../src/lib/demo-logins';
import { describeTarget } from './demo-db';

type Fk = { table: string; column: string; rule: 'a' | 'r' | 'c' | 'n' | 'd'; nullable: boolean };

const RULE_NAME: Record<Fk['rule'], string> = { a: 'no action', r: 'restrict', c: 'cascade', n: 'set null', d: 'set default' };
const quote = (ident: string) => `"${ident.replace(/"/g, '""')}"`;

async function foreignKeysTo(client: PoolClient, table: 'profiles' | 'engagements' | 'receivable_sheets'): Promise<Fk[]> {
  const { rows } = await client.query<{ tbl: string; col: string; rule: Fk['rule']; notnull: boolean }>(
    `SELECT c.conrelid::regclass::text AS tbl, a.attname AS col, c.confdeltype AS rule, a.attnotnull AS notnull
       FROM pg_constraint c
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.contype = 'f' AND c.confrelid = $1::regclass AND array_length(c.conkey, 1) = 1
      ORDER BY 1, 2`,
    [table],
  );
  // Two constraints on one column (an old and a new name) count once.
  const seen = new Set<string>();
  return rows
    .filter((r) => !seen.has(`${r.tbl}.${r.col}`) && Boolean(seen.add(`${r.tbl}.${r.col}`)))
    .map((r) => ({ table: r.tbl, column: r.col, rule: r.rule, nullable: !r.notnull }));
}

async function countRefs(client: PoolClient, fk: Fk, ids: string[]): Promise<number> {
  const { rows } = await client.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM ${fk.table} WHERE ${quote(fk.column)} = ANY ($1::uuid[])`,
    [ids],
  );
  return Number(rows[0]?.n ?? 0);
}

/** Clear the references Postgres would refuse: null a nullable column, delete a required one. */
async function clearBlockingRefs(client: PoolClient, fks: Fk[], ids: string[], dry: boolean, log: string[]): Promise<void> {
  for (const fk of fks) {
    const n = await countRefs(client, fk, ids);
    if (!n) continue;
    const blocking = fk.rule === 'a' || fk.rule === 'r';
    const action = !blocking ? RULE_NAME[fk.rule] : fk.nullable ? 'set to null' : 'deleted';
    log.push(`    ${fk.table}.${fk.column}: ${n} row(s), ${action}`);
    if (dry || !blocking) continue;
    if (fk.nullable) {
      await client.query(`UPDATE ${fk.table} SET ${quote(fk.column)} = NULL WHERE ${quote(fk.column)} = ANY ($1::uuid[])`, [ids]);
    } else {
      await client.query(`DELETE FROM ${fk.table} WHERE ${quote(fk.column)} = ANY ($1::uuid[])`, [ids]);
    }
  }
}

async function main() {
  const yes = process.argv.includes('--yes');
  const dry = !yes;
  const pool = new Pool({ ...poolConfig(), max: 1 });
  const client = await pool.connect();
  console.log(`Main database: ${describeTarget()}`);
  console.log(dry ? 'Dry run: nothing is changed. Add --yes to delete.\n' : 'Deleting (one transaction).\n');
  try {
    await client.query('BEGIN');
    const eng = await client.query<{ id: string; slug: string; company_name: string | null }>(
      'SELECT id, slug, company_name FROM engagements WHERE is_demo = true ORDER BY slug',
    );
    const prof = await client.query<{ id: string; email: string; role: string }>(
      'SELECT id, email, role FROM profiles WHERE is_demo = true ORDER BY email',
    );
    const stray = await client.query<{ email: string }>(
      'SELECT email FROM profiles WHERE is_demo IS NOT TRUE AND lower(email) LIKE $1',
      [`%@${DEMO_EMAIL_DOMAIN}`],
    );
    const nonDemoDomain = prof.rows.filter((p) => !p.email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`));

    console.log(`Demo projects (is_demo): ${eng.rows.length}`);
    for (const e of eng.rows) console.log(`  ${e.slug}  ${e.company_name ?? ''}`);
    console.log(`Demo profiles (is_demo): ${prof.rows.length}`);
    for (const p of prof.rows) console.log(`  ${p.email}  ${p.role}`);
    if (stray.rows.length) {
      console.log(`\nNOT touched: ${stray.rows.length} profile(s) on @${DEMO_EMAIL_DOMAIN} without is_demo: ${stray.rows.map((r) => r.email).join(', ')}`);
    }
    if (nonDemoDomain.length) {
      throw new Error(`Refusing: is_demo profiles outside @${DEMO_EMAIL_DOMAIN}: ${nonDemoDomain.map((p) => p.email).join(', ')}. Check them by hand.`);
    }

    const engIds = eng.rows.map((r) => r.id);
    const profIds = prof.rows.map((r) => r.id);
    const log: string[] = [];
    if (engIds.length) {
      log.push('  rows on the demo projects:');
      await clearBlockingRefs(client, await foreignKeysTo(client, 'engagements'), engIds, dry, log);
      if (!dry) await client.query('DELETE FROM engagements WHERE is_demo = true AND id = ANY ($1::uuid[])', [engIds]);
    }
    if (profIds.length) {
      // A sheet's manager column is SET NULL, which would leave the demo sheet behind ownerless.
      const sheets = await client.query<{ id: string; name: string }>(
        'SELECT id, name FROM receivable_sheets WHERE manager_user_id = ANY ($1::uuid[])',
        [profIds],
      );
      if (sheets.rows.length) {
        log.push(`  receivables sheets owned by demo people: ${sheets.rows.map((r) => `"${r.name}"`).join(', ')}, deleted with their rows`);
        const sheetIds = sheets.rows.map((r) => r.id);
        await clearBlockingRefs(client, await foreignKeysTo(client, 'receivable_sheets'), sheetIds, dry, log);
        if (!dry) await client.query('DELETE FROM receivable_sheets WHERE id = ANY ($1::uuid[])', [sheetIds]);
      }
      log.push('  rows of the demo people (after the projects are gone):');
      await clearBlockingRefs(client, await foreignKeysTo(client, 'profiles'), profIds, dry, log);
      if (!dry) await client.query('DELETE FROM profiles WHERE is_demo = true AND id = ANY ($1::uuid[])', [profIds]);
    }
    if (log.length) console.log(`\n${log.join('\n')}`);

    if (dry) {
      await client.query('ROLLBACK');
      console.log(`\nDry run done. ${engIds.length} project(s) and ${profIds.length} profile(s) would be deleted.`);
    } else {
      await client.query('COMMIT');
      console.log(`\nDeleted ${engIds.length} demo project(s) and ${profIds.length} demo profile(s) from the main database.`);
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
