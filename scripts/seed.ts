/**
 * Seed script for the pilot.
 *
 *   npm run db:seed
 *
 * Creates firm admin, project manager, project lead, and client + sample engagement.
 * Safe to re-run (upserts by email).
 */
import './load-env';

import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { profiles } from '../src/db/schema';

async function upsertUser(input: {
  email: string;
  password: string;
  name: string;
  role: 'super_admin' | 'admin' | 'manager' | 'intern' | 'client';
  internId?: string;
  clientId?: string;
  reportsToManagerId?: string;
}) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  const [existing] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.email, input.email))
    .limit(1);

  if (existing) {
    await db
      .update(profiles)
      .set({
        passwordHash,
        name: input.name,
        role: input.role,
        internId: existing.internId ?? input.internId,
        clientId: input.clientId,
        reportsToManagerId: input.reportsToManagerId,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, existing.id));
    return existing.id;
  }

  const [row] = await db
    .insert(profiles)
    .values({
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role,
      internId: input.internId,
      clientId: input.clientId,
      reportsToManagerId: input.reportsToManagerId,
    })
    .returning();
  return row.id;
}

async function main() {
  console.log('Seeding VCFO Suite demo data…');

  await upsertUser({
    email: 'super@vcfo.local',
    password: 'super123',
    name: 'Super Admin',
    role: 'super_admin',
  });

  await upsertUser({
    email: 'admin@vcfo.local',
    password: 'admin123',
    name: 'Admin',
    role: 'admin',
  });

  const managerId = await upsertUser({
    email: 'manager@vcfo.local',
    password: 'manager123',
    name: 'Project Manager',
    role: 'manager',
  });

  await upsertUser({
    email: 'intern@vcfo.local',
    password: 'intern123',
    name: 'Project Lead',
    role: 'intern',
    internId: 'intern-1',
    reportsToManagerId: managerId,
  });

  const clientUserId = await upsertUser({
    email: 'client@vcfo.local',
    password: 'client123',
    name: 'Client',
    role: 'client',
    clientId: 'client-1',
  });

  // Sample engagement intentionally not created — keep seed logins only.
  void clientUserId;
  void managerId;

  console.log('\nDemo logins (CHANGE THESE before real use):');
  console.log('  super@vcfo.local   / super123   (Super Admin)');
  console.log('  admin@vcfo.local   / admin123   (Firm Admin)');
  console.log('  manager@vcfo.local / manager123 (Project Manager)');
  console.log('  intern@vcfo.local  / intern123  (Project Lead)');
  console.log('  client@vcfo.local  / client123  (Client)');
  console.log('\nNo sample project created.');
  console.log('\nDone.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
