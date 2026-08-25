/**
 * Purge demo / junk project + people data from the local DB.
 *
 *   npm run db:purge-demo
 *
 * Keeps seed staff logins (@vcfo.local) so you can still sign in.
 * Deletes all engagements (projects) and non-kept profiles.
 */
import './load-env';

import { eq, inArray, notInArray } from 'drizzle-orm';
import { db } from '../src/db/client';
import {
  activity,
  documentRequests,
  documentTemplates,
  documents,
  emailTemplates,
  engagements,
  knowledgeBankFiles,
  knowledgeBankFolders,
  profiles,
  tasks,
} from '../src/db/schema';

const KEEP_EMAILS = [
  'super@vcfo.local',
  'admin@vcfo.local',
  'manager@vcfo.local',
  'intern@vcfo.local',
];

async function main() {
  console.log('Purging projects (engagements)…');
  const deletedEng = await db.delete(engagements).returning({ id: engagements.id });
  console.log(`  deleted ${deletedEng.length} project(s)`);

  const keep = await db
    .select({ id: profiles.id, email: profiles.email, name: profiles.name })
    .from(profiles)
    .where(inArray(profiles.email, KEEP_EMAILS));
  const keepIds = keep.map((p) => p.id);
  const adminId =
    keep.find((p) => p.email === 'admin@vcfo.local')?.id ??
    keep.find((p) => p.email === 'super@vcfo.local')?.id ??
    keepIds[0];

  if (!adminId) {
    throw new Error('No seed admin profile found — run npm run db:seed first');
  }

  const doomed = await db
    .select({ id: profiles.id, email: profiles.email, role: profiles.role })
    .from(profiles)
    .where(notInArray(profiles.email, KEEP_EMAILS));

  console.log(`Purging ${doomed.length} non-seed profile(s)…`);

  for (const person of doomed) {
    await db.transaction(async (tx) => {
      await tx
        .update(profiles)
        .set({ reportsToManagerId: null, updatedAt: new Date() })
        .where(eq(profiles.reportsToManagerId, person.id));

      await tx
        .update(knowledgeBankFiles)
        .set({ uploadedBy: adminId })
        .where(eq(knowledgeBankFiles.uploadedBy, person.id));
      await tx
        .update(knowledgeBankFolders)
        .set({ createdBy: adminId })
        .where(eq(knowledgeBankFolders.createdBy, person.id));
      await tx
        .update(documentTemplates)
        .set({ uploadedBy: adminId })
        .where(eq(documentTemplates.uploadedBy, person.id));
      await tx
        .update(emailTemplates)
        .set({ createdBy: adminId })
        .where(eq(emailTemplates.createdBy, person.id));
      await tx
        .update(emailTemplates)
        .set({ updatedBy: adminId })
        .where(eq(emailTemplates.updatedBy, person.id));

      await tx
        .update(documents)
        .set({ uploadedBy: null })
        .where(eq(documents.uploadedBy, person.id));
      await tx.update(activity).set({ actorId: null }).where(eq(activity.actorId, person.id));
      await tx.update(tasks).set({ assignedTo: null }).where(eq(tasks.assignedTo, person.id));
      await tx
        .update(documentRequests)
        .set({ requestedBy: null })
        .where(eq(documentRequests.requestedBy, person.id));

      await tx.delete(profiles).where(eq(profiles.id, person.id));
    });
    console.log(`  deleted ${person.role} ${person.email}`);
  }

  for (const row of keep) {
    const next = (row.name ?? '').replace(/^Demo\s+/i, '').trim() || row.email;
    if (next !== row.name) {
      await db
        .update(profiles)
        .set({ name: next, updatedAt: new Date() })
        .where(eq(profiles.id, row.id));
      console.log(`  renamed ${row.email}: "${row.name}" → "${next}"`);
    }
  }

  console.log('\nDone. Seed logins still work:');
  console.log('  admin@vcfo.local / admin123');
  console.log('  manager@vcfo.local / manager123');
  console.log('  intern@vcfo.local / intern123');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
