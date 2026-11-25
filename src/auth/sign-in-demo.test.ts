// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * PLAN H2 sign-in routing (src/auth/config.ts `authorizeCredentials`): an email on the demo
 * domain is looked up only in the demo database and gets a `demo: true` token; any other email
 * only in the main database. Every repository call records the scope it ran in.
 */
const scopes: Array<{ fn: string; demo: boolean }> = [];
let candidate: Record<string, unknown> | null = null;

vi.mock('@/db/client', () => ({ db: {} }));
vi.mock('next-auth', () => ({
  default: () => ({ handlers: {}, auth: async () => null }),
  CredentialsSignin: class CredentialsSignin extends Error {},
}));
vi.mock('next-auth/providers/credentials', () => ({ default: (cfg: unknown) => cfg }));
vi.mock('@/auth/microsoft', () => ({
  MICROSOFT_PROVIDER_ID: 'microsoft-entra-id',
  microsoftEmailOf: () => null,
  microsoftProviders: async () => [],
  onMicrosoftSignInError: () => undefined,
}));
const record = async (fn: string) => {
  const { isDemoScope } = await import('@/db/demo-scope');
  scopes.push({ fn, demo: await isDemoScope() });
};
vi.mock('@/lib/sign-in-throttle', () => ({ takeSignInAttempt: async () => (await record('throttle'), true) }));
vi.mock('@/db/repositories/profiles', () => ({
  systemSignInTwoStep: async () => (await record('twoStep'), null),
  systemCheckSignInPassword: async () => (await record('password'), candidate),
}));
vi.mock('@/db/repositories/user-sessions', () => ({
  systemCreateUserSession: async () => (await record('session'), 'sid-1'),
  systemIsSessionActive: async () => true,
  systemRevokeSession: async () => undefined,
}));
vi.mock('@/db/repositories/client-audit', () => ({ systemRecordSignIn: async () => record('audit') }));
vi.mock('@/db/repositories/sign-in-links', () => ({ systemResolveExternalSignIn: async () => ({ ok: false, reason: 'no_profile' }) }));

const { authorizeCredentials } = await import('./config');

const person = (email: string, isDemo: boolean, role = 'intern') => ({
  id: '11111111-1111-4111-8111-111111111111',
  email,
  name: 'Someone',
  role,
  internId: role === 'intern' ? 'k1' : null,
  clientId: null,
  avatarObjectKey: null,
  updatedAt: new Date(0),
  twoStepOn: false,
  totpSecretEnc: null,
  isDemo,
});
const req = new Request('http://localhost/api/auth/callback/credentials', { headers: { 'user-agent': 'test' } });

beforeEach(() => {
  scopes.length = 0;
  delete process.env.DEMO_DB_NAME;
});

describe('sign-in routing by email domain', () => {
  it.each(['admin', 'manager', 'intern', 'client'])('a demo %s email is checked only in the demo database and gets a demo token', async (role) => {
    candidate = person(`${role}@vcfosuite.com`, true, role);
    const user = await authorizeCredentials({ email: `${role}@VCFOSUITE.com`, password: 'x' }, req);
    expect(user).toMatchObject({ role, demo: true, sid: 'sid-1' });
    expect(scopes.length).toBeGreaterThanOrEqual(4);
    expect(scopes.every((s) => s.demo)).toBe(true);
  });

  it('any other email is checked only in the main database and gets no demo flag', async () => {
    candidate = person('admin@sbcllp.in', false, 'admin');
    const user = await authorizeCredentials({ email: 'admin@sbcllp.in', password: 'x' }, req);
    expect(user).toMatchObject({ role: 'admin' });
    expect(user).not.toHaveProperty('demo');
    expect(scopes.every((s) => !s.demo)).toBe(true);
  });

  it('a demo row found in the main database is refused (second fence)', async () => {
    candidate = person('x@sbcllp.in', true);
    expect(await authorizeCredentials({ email: 'x@sbcllp.in', password: 'x' }, req)).toBeNull();
  });

  it('a real row found in the demo database is refused', async () => {
    candidate = person('lead@vcfosuite.com', false);
    expect(await authorizeCredentials({ email: 'lead@vcfosuite.com', password: 'x' }, req)).toBeNull();
  });

  it('demo logins switched off: a demo email is refused without touching any database', async () => {
    process.env.DEMO_DB_NAME = 'off';
    candidate = person('lead@vcfosuite.com', true);
    expect(await authorizeCredentials({ email: 'lead@vcfosuite.com', password: 'x' }, req)).toBeNull();
    expect(scopes).toEqual([]);
  });
});
