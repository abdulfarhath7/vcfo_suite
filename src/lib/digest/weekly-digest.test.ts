import { describe, expect, it } from 'vitest';
import {
  adminDigestSections,
  clientDigestSections,
  digestWeek,
  isEmptyDigest,
  staffDigestSections,
  type WeeklyDigest,
} from '@/lib/digest/weekly-digest';
import { buildWeeklyDigestEmail, DIGEST_SECTION_LIMIT } from '@/lib/digest/weekly-digest-email';

// Monday 2 Nov 2026, 08:00 IST.
const NOW = new Date('2026-11-02T02:30:00Z');
const TODAY = '2026-11-02';

function digest(sections: WeeklyDigest['sections'], audience: WeeklyDigest['audience'] = 'client'): WeeklyDigest {
  return { audience, recipientName: 'Asha Rao', week: digestWeek(NOW), sections, settingsHref: '/app/client/settings' };
}

const keys = (sections: WeeklyDigest['sections']) =>
  Object.fromEntries(sections.map((s) => [s.key, s.items.map((i) => i.id)]));

describe('digestWeek', () => {
  it('keys the IST week by ISO week and starts it on Monday 00:00 IST', () => {
    const w = digestWeek(NOW);
    expect(w.key).toBe('2026-W45');
    expect(w.mondayIso).toBe('2026-11-02');
    expect(w.startsAt.toISOString()).toBe('2026-11-01T18:30:00.000Z');
    expect(w.endsAt.toISOString()).toBe('2026-11-08T18:30:00.000Z');
  });

  it('gives every day of the week the same key, and Sunday night IST belongs to the old week', () => {
    expect(digestWeek(new Date('2026-11-08T18:00:00Z')).key).toBe('2026-W45'); // Sun 23:30 IST
    expect(digestWeek(new Date('2026-11-08T18:31:00Z')).key).toBe('2026-W46'); // Mon 00:01 IST
  });

  it('puts the first days of January in the ISO year of their Thursday', () => {
    expect(digestWeek(new Date('2027-01-01T06:00:00Z')).key).toBe('2026-W53');
    expect(digestWeek(new Date('2027-01-04T06:00:00Z')).key).toBe('2027-W01');
  });
});

describe('client sections', () => {
  const sections = clientDigestSections({
    today: TODAY,
    filings: [
      { id: 'late', name: 'GSTR-3B', period: 'Sep 2026', companyName: 'Acme', dueDate: '2026-10-20', filedOn: null },
      { id: 'soon', name: 'TDS payment', period: 'Oct 2026', companyName: 'Acme', dueDate: '2026-11-07', filedOn: null },
      { id: 'edge', name: 'GSTR-1', period: null, companyName: 'Acme', dueDate: '2026-11-16', filedOn: null },
      { id: 'far', name: 'AOC-4', period: null, companyName: 'Acme', dueDate: '2026-11-30', filedOn: null },
      { id: 'filed', name: 'PF', period: null, companyName: 'Acme', dueDate: '2026-10-15', filedOn: '2026-10-14' },
    ],
    needs: [{ id: 'n1', title: 'Rent agreement', companyName: 'Acme', dueDate: null }],
    activity: [
      { id: 'a1', label: 'Step accepted', at: '2026-10-30T09:00:00Z', actorName: 'Ravi', companyName: 'Acme' },
      { id: 'a2', label: 'Old change', at: '2026-10-20T09:00:00Z', actorName: 'Ravi', companyName: 'Acme' },
      { id: 'a3', label: 'GSTR-3B overdue', at: '2026-10-29T09:00:00Z', actorName: 'VCFO Suite', companyName: 'Acme', action: 'system.compliance_overdue' },
    ],
  });

  it('lists overdue filings, filings due in 14 days, open needs and last week’s changes', () => {
    expect(keys(sections)).toEqual({
      overdue: ['late'],
      due: ['soon', 'edge'],
      needs: ['n1'],
      changes: ['a1'],
    });
  });

  it('links into the client portal', () => {
    expect(sections.find((s) => s.key === 'overdue')!.href).toBe('/app/client/compliances/filings');
    expect(sections.find((s) => s.key === 'needs')!.href).toBe('/app/client/documents');
  });
});

describe('lead and manager sections', () => {
  const input = {
    today: TODAY,
    filings: [
      { id: 'f-late', name: 'GSTR-3B', period: 'Sep 2026', companyName: 'Acme', dueDate: '2026-10-20', filedOn: null },
      { id: 'f-week', name: 'TDS payment', period: null, companyName: 'Beta', dueDate: '2026-11-08', filedOn: null },
      { id: 'f-next', name: 'GSTR-1', period: null, companyName: 'Beta', dueDate: '2026-11-09', filedOn: null },
    ],
    steps: [
      { id: 'e1:pre-1', title: 'Name approval', companyName: 'Acme', status: 'overdue', href: '/app/intern/engagements/acme/step/name' },
      { id: 'e1:pre-2', title: 'KYC', companyName: 'Acme', status: 'awaiting-client', href: '/app/intern/engagements/acme/step/kyc' },
      { id: 'e1:pre-3', title: 'Drafts', companyName: 'Acme', status: 'in-progress', href: '/x' },
    ],
    tasks: [
      { id: 't-late', title: 'Call bank', companyName: 'Acme', status: 'in-progress', dueAt: '2026-10-31' },
      { id: 't-week', title: 'Send invoice', companyName: 'Beta', status: 'not-started', dueAt: '2026-11-04T10:00:00Z' },
      { id: 't-done', title: 'Old', companyName: 'Beta', status: 'completed', dueAt: '2026-10-01' },
    ],
    requests: [
      { id: 'r1', label: 'PAN copy', companyName: 'Beta', status: 'pending' },
      { id: 'r2', label: 'Photo', companyName: 'Beta', status: 'uploaded' },
    ],
  };

  it('splits overdue, due this week and waiting on clients', () => {
    expect(keys(staffDigestSections('intern', input))).toEqual({
      overdue: ['filing:f-late', 'task:t-late', 'step:e1:pre-1'],
      due: ['task:t-week', 'filing:f-week'],
      waiting: ['step:e1:pre-2', 'request:r1'],
    });
  });

  it('links a lead to Today and a manager to the dashboard', () => {
    expect(staffDigestSections('intern', input)[0]!.href).toBe('/app/intern/today');
    expect(staffDigestSections('manager', input)[0]!.href).toBe('/app/manager/dashboard');
  });
});

describe('admin sections', () => {
  const risks = [
    { id: 'filing:1', kind: 'filing', title: 'GSTR-3B · Sep 2026', engagementId: 'e1', companyName: 'Acme', href: '/app/super/projects/e1', ageDays: 13 },
    { id: 'stuck:2', kind: 'stuck', title: 'No move on KYC', engagementId: 'e2', companyName: 'Beta', href: '/app/super/projects/e2', ageDays: 20 },
    { id: 'step:3', kind: 'step', title: 'Name approval', engagementId: 'e3', companyName: 'Gamma', href: '/x', ageDays: 3 },
    { id: 'owner:4', kind: 'owner', title: 'No manager', engagementId: 'e4', companyName: 'Delta', href: '/x', ageDays: 5 },
  ];

  it('keeps only firm-wide overdue filings and stuck clients', () => {
    const sections = adminDigestSections('admin', { today: TODAY, risks });
    expect(keys(sections)).toEqual({ overdue: ['filing:1'], stuck: ['stuck:2'] });
    expect(sections[0]!.items[0]!.date).toBe('2026-10-20');
    expect(sections[1]!.items[0]!.date).toBe('2026-10-13');
  });

  it('sends a super admin to Risks and an admin to filings and projects', () => {
    expect(adminDigestSections('super_admin', { today: TODAY, risks }).map((s) => s.href)).toEqual(['/app/super/risks', '/app/super/risks']);
    expect(adminDigestSections('admin', { today: TODAY, risks }).map((s) => s.href)).toEqual([
      '/app/admin/compliances/filings',
      '/app/admin/projects',
    ]);
  });
});

describe('buildWeeklyDigestEmail', () => {
  it('returns null for an empty digest, so the job skips the person', () => {
    const empty = digest(clientDigestSections({ today: TODAY, filings: [], needs: [], activity: [] }));
    expect(isEmptyDigest(empty)).toBe(true);
    expect(buildWeeklyDigestEmail(empty)).toBeNull();
  });

  it('prints only the sections with items, plain dates and links', () => {
    const d = digest(
      clientDigestSections({
        today: TODAY,
        filings: [{ id: 'late', name: 'GSTR-3B', period: 'Sep 2026', companyName: 'Acme', dueDate: '2026-10-14', filedOn: null }],
        needs: [],
        activity: [],
      }),
    );
    const copy = buildWeeklyDigestEmail(d)!;
    expect(copy.subject).toBe('Your week from 2 Nov: 1 overdue');
    expect(copy.text).toContain('GSTR-3B · Sep 2026 · Acme · due 14 Oct');
    expect(copy.text).toContain('/app/client/compliances/filings');
    expect(copy.text).toContain('/app/client/settings');
    expect(copy.text).not.toContain('Documents we need from you');
    expect(copy.html).toContain('Overdue filings (1)');
    for (const out of [copy.subject, copy.text, copy.html]) {
      expect(out.toLowerCase()).not.toContain('please');
      expect(out.toLowerCase()).not.toContain('successfully');
    }
  });

  it('caps a long section and counts the rest', () => {
    const needs = Array.from({ length: DIGEST_SECTION_LIMIT + 3 }, (_, i) => ({
      id: `n${i}`,
      title: `Document ${String(i).padStart(2, '0')}`,
      companyName: 'Acme',
    }));
    const copy = buildWeeklyDigestEmail(digest(clientDigestSections({ today: TODAY, filings: [], needs, activity: [] })))!;
    expect(copy.text).toContain('and 3 more');
    expect(copy.text).not.toContain(`Document ${DIGEST_SECTION_LIMIT + 2}`);
    expect(copy.subject).toBe(`Your week from 2 Nov: ${DIGEST_SECTION_LIMIT + 3} documents needed`);
  });

  it('escapes names and titles in the HTML', () => {
    const copy = buildWeeklyDigestEmail(
      digest(clientDigestSections({ today: TODAY, filings: [], needs: [{ id: 'x', title: '<b>PAN</b>', companyName: 'A&B' }], activity: [] })),
    )!;
    expect(copy.html).toContain('&lt;b&gt;PAN&lt;/b&gt;');
    expect(copy.html).toContain('A&amp;B');
  });
});
