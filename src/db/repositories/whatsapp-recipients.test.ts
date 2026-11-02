import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db/client', () => ({ db: {} }));
vi.mock('@/db/repositories/email-directory', () => ({ listEmailDirectory: vi.fn() }));
const { toWhatsAppPeople } = await import('./whatsapp-recipients');

const person = (userId: string, status: 'active' | 'inactive' = 'active') => ({
  userId,
  name: userId,
  email: `${userId}@x.in`,
  role: 'client' as const,
  kind: 'client' as const,
  status,
  reportsToManagerId: null,
  managerName: null,
  projects: [],
});

describe('toWhatsAppPeople', () => {
  it('adds the masked number and state, never the full number, and drops inactive people', () => {
    const out = toWhatsAppPeople(
      [person('a'), person('b'), person('c', 'inactive')],
      [{ id: 'a', phoneE164: '+919876543210', whatsappOptInAt: new Date(), whatsappOptOutAt: null }],
    );
    expect(out.map((p) => [p.userId, p.state, p.phoneMasked])).toEqual([
      ['a', 'ready', '•••• 3210'],
      ['b', 'no_phone', ''],
    ]);
    expect(JSON.stringify(out)).not.toContain('9876543210');
  });
});
