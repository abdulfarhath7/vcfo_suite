import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db/client', () => ({ db: {} }));
vi.mock('@/db/repositories/engagement-managers-membership', () => ({ listManagerIdsForEngagement: async () => [] }));

const { toRecipients } = await import('@/db/repositories/staff-alerts');

const row = (patch: Record<string, unknown>) => ({
  id: 'p1',
  email: 'ravi@sbc.in',
  name: 'Ravi',
  role: 'manager',
  status: 'active',
  removedAt: null,
  prefsEmail: null,
  quietHours: null,
  quietStart: null,
  quietEnd: null,
  tz: null,
  ...patch,
});

describe('staff alert recipients', () => {
  it('keeps active people of the right role with the switch on, with default quiet hours', () => {
    const out = toRecipients([row({})] as never, ['manager'], 'approvalsWaiting');
    expect(out).toEqual([
      { profileId: 'p1', email: 'ravi@sbc.in', name: 'Ravi', role: 'manager', quiet: { quietHours: true, quietStart: '21:00', quietEnd: '08:00', tz: 'Asia/Kolkata' } },
    ]);
  });

  it('drops the switched off, the removed, the wrong role and no address', () => {
    const rows = [
      row({ id: 'off', prefsEmail: { approvalsWaiting: false } }),
      row({ id: 'gone', removedAt: new Date() }),
      row({ id: 'client', role: 'client' }),
      row({ id: 'none', email: ' ' }),
    ];
    expect(toRecipients(rows as never, ['manager'], 'approvalsWaiting')).toEqual([]);
  });

  it('uses the escalations switch for admins', () => {
    const rows = [row({ id: 'a1', role: 'admin', prefsEmail: { escalations: false } }), row({ id: 's1', role: 'super_admin' })];
    expect(toRecipients(rows as never, ['admin', 'super_admin'], 'escalations').map((r) => r.profileId)).toEqual(['s1']);
  });
});
