import { describe, expect, it } from 'vitest';
import type { AppNotification } from '@/lib/checklist/checklist-notifications';
import type { FilingRow } from '@/lib/compliance/filings';
import {
  annMark,
  annStripe,
  bellDay,
  clearCopy,
  consoleHref,
  dLabel,
  dayTile,
  decidable,
  isImportantKind,
  matchesNoteFilters,
  needsPolling,
  nextDeadline,
  noteMeta,
  openLabel,
  overdueFilings,
  publishedLabel,
  stampLabel,
  stillReading,
  tLabel,
  typeCountsThisMonth,
  whenLabel,
  canSeeRegulatory,
} from './model';

/** Thu 29 Oct 2026, 3:00 pm in India (09:30 UTC). */
const NOW = Date.parse('2026-10-29T09:30:00Z');

function note(id: string, extra: Partial<AppNotification> = {}): AppNotification {
  return {
    id,
    kind: 'checklist.submit',
    title: 'Client submission',
    body: 'Northwind submitted Registered office address for review.',
    engagementId: 'e1',
    companyName: 'Northwind',
    href: '/app/manager/projects/northwind/step/registered-office',
    createdAt: '2026-10-29T08:00:00Z',
    read: false,
    ...extra,
  };
}

function filing(id: string, particular: string, dueDate: string, companyName: string, filedOn: string | null = null): FilingRow {
  return {
    id,
    engagementId: `e-${companyName}`,
    companyName,
    compliance: 'GST',
    particular,
    authority: 'GSTN',
    frequency: 'Monthly',
    dueDate,
    filedOn,
    periodLabel: 'Sep 2026',
    fyLabel: 'FY 2026-27',
    rawStatus: filedOn ? 'filed' : 'pending',
    obligationId: `o-${id}`,
    windowFrom: null,
    windowTo: null,
  };
}

describe('India-time labels', () => {
  it('reads times and days in India time', () => {
    expect(tLabel('2026-10-29T09:30:00Z')).toBe('3:00 pm');
    expect(tLabel('2026-10-28T19:00:00Z')).toBe('12:30 am');
    expect(dLabel('2026-10-16', '2026-10-29')).toBe('16 Oct');
    expect(dLabel('2025-10-16', '2026-10-29')).toBe('16 Oct 2025');
    expect(stampLabel('2026-10-29T09:30:00Z')).toBe('Thu 29 Oct 2026, 3:00 pm IST');
    expect(dayTile('2026-10-28T20:00:00Z')).toEqual({ d: '29', mon: 'Oct' });
  });

  it('labels a row by how long ago it arrived', () => {
    expect(whenLabel('2026-10-29T09:29:40Z', NOW)).toBe('Just now');
    expect(whenLabel('2026-10-29T09:18:00Z', NOW)).toBe('12m ago');
    expect(whenLabel('2026-10-29T04:00:00Z', NOW)).toBe('9:30 am');
    expect(whenLabel('2026-10-28T04:00:00Z', NOW)).toBe('Yesterday');
    expect(whenLabel('2026-10-20T04:00:00Z', NOW)).toBe('20 Oct');
    expect(whenLabel('not a date', NOW)).toBe('');
  });

  it('groups the bell by India day, not the browser day', () => {
    // 28 Oct 19:00 UTC is 29 Oct 00:30 in India.
    expect(bellDay('2026-10-28T19:00:00Z', NOW)).toBe('Today');
    expect(bellDay('2026-10-28T10:00:00Z', NOW)).toBe('Yesterday');
    expect(bellDay('2026-10-20T10:00:00Z', NOW)).toBe('Earlier');
  });
});

describe('notification kinds and filters', () => {
  it('gives every kind a type, an icon and a meaning', () => {
    expect(noteMeta('regulatory.review')).toMatchObject({ type: 'official', tone: 'due' });
    expect(noteMeta('email.failed')).toMatchObject({ type: 'email', tone: 'over' });
    expect(noteMeta('request.uploaded').type).toBe('docs');
    expect(noteMeta('team.assigned').type).toBe('team');
    expect(noteMeta('something.new').icon).toBe('bell');
  });

  it('filters like the live history page plus unread and type', () => {
    const now = new Date(NOW);
    const today = note('a');
    const sentEarlier = note('b', { kind: 'email.sent', read: true, createdAt: '2026-10-01T08:00:00Z' });
    const docThisWeek = note('c', { kind: 'request.uploaded', createdAt: '2026-10-27T08:00:00Z' });
    const all = [today, sentEarlier, docThisWeek];
    const f = (tab: 'all' | 'unread' | 'received' | 'sent', type: 'any' | 'docs' = 'any', range: 'any' | 'today' | 'week' | 'earlier' = 'any') =>
      all.filter((n) => matchesNoteFilters(n, { tab, type, range }, now)).map((n) => n.id);
    expect(f('all')).toEqual(['a', 'b', 'c']);
    expect(f('unread')).toEqual(['a', 'c']);
    expect(f('received')).toEqual(['a', 'c']);
    expect(f('sent')).toEqual(['b']);
    expect(f('all', 'docs')).toEqual(['c']);
    expect(f('all', 'any', 'today')).toEqual(['a']);
    expect(f('all', 'any', 'week')).toEqual(['a', 'c']);
    expect(f('all', 'any', 'earlier')).toEqual(['b']);
  });

  it('counts this month by type', () => {
    const counts = typeCountsThisMonth(
      [note('a'), note('b', { kind: 'regulatory.approved' }), note('c', { createdAt: '2026-09-30T08:00:00Z' })],
      NOW,
    );
    expect(counts.steps.map((n) => n.id)).toEqual(['a']);
    expect(counts.official.map((n) => n.id)).toEqual(['b']);
  });

  it('keeps the live clear wording', () => {
    expect(clearCopy('today', 1, 'received')).toBe('Notification cleared');
    expect(clearCopy('week', 4, 'received')).toBe('Cleared 4 from this week');
    expect(clearCopy('all', 3, 'sent')).toBe('Cleared 3 sent notifications');
  });
});

describe('old staff links in the console', () => {
  it('sends the approved-update link (admin board) to this seat', () => {
    expect(consoleHref('/app/admin/announcements', '/app/manager')).toBe('/app/manager/announcements');
    expect(consoleHref('/app/admin/announcements', '/app/intern')).toBe('/app/intern/announcements');
  });

  it('keeps a link that already belongs to the seat', () => {
    expect(consoleHref('/app/manager/regulatory-updates', '/app/manager')).toBe('/app/manager/regulatory-updates');
    expect(consoleHref('/app/manager/projects/northwind/step/kyc', '/app/manager')).toBe('/app/manager/projects/northwind/step/kyc');
  });

  it('moves project pages between a lead and a manager seat', () => {
    expect(consoleHref('/app/intern/engagements/northwind/step/kyc', '/app/manager')).toBe('/app/manager/projects/northwind/step/kyc');
    expect(consoleHref('/app/admin/projects/northwind?tab=docs', '/app/intern')).toBe('/app/intern/engagements/northwind?tab=docs');
    expect(consoleHref('/app/super/projects/x', '/app/manager')).toBe('/app/manager/projects/x');
  });

  it('turns an absolute app link into a path and leaves other sites alone', () => {
    expect(consoleHref('https://app.sbctrack.in/app/manager/projects/acme', '/app/manager')).toBe('/app/manager/projects/acme');
    expect(consoleHref('https://www.gst.gov.in/newsandupdates', '/app/manager')).toBe('https://www.gst.gov.in/newsandupdates');
  });

  it('has nowhere to go for empty links', () => {
    expect(consoleHref('', '/app/manager')).toBeNull();
    expect(consoleHref('#', '/app/manager')).toBeNull();
    expect(consoleHref(undefined, '/app/manager')).toBeNull();
    expect(consoleHref('/app/managerial', '/app/manager')).toBe('/app/managerial');
  });

  it('names where a link goes', () => {
    expect(openLabel('/app/manager/projects/a/step/kyc')).toBe('Open the step');
    expect(openLabel('/app/manager/projects/a')).toBe('Open the client');
    expect(openLabel('/app/manager/regulatory-updates')).toBe('Open the review queue');
    expect(openLabel('/app/manager/announcements')).toBe('Open announcements');
    expect(openLabel('https://example.gov.in/x')).toBe('Open the page');
  });
});

describe('announcements', () => {
  it('treats Deadline and Compliance as important', () => {
    expect(isImportantKind('deadline')).toBe(true);
    expect(isImportantKind('compliance')).toBe(true);
    expect(isImportantKind('gst')).toBe(false);
  });

  it('marks laws with their law colour and the rest by importance', () => {
    expect(annMark('gst', 'GST')).toEqual({ law: 'GST', text: 'GST' });
    expect(annMark('tax', 'Tax')).toEqual({ law: 'IT', text: 'Tax' });
    expect(annMark('deadline', 'Deadline')).toEqual({ tone: 'due', text: 'Deadline' });
    expect(annMark('general', 'General')).toEqual({ tone: 'mut', text: 'General' });
    expect(annStripe('mca')).toBe('var(--law-MCA)');
    expect(annStripe('compliance')).toBe('var(--due)');
  });

  it('finds the next filing still to be made', () => {
    const rows = [
      filing('1', 'GSTR-1', '2026-10-11', 'Brightwave', '2026-10-10'),
      filing('2', 'GSTR-3B', '2026-11-20', 'Brightwave'),
      filing('3', 'GSTR-3B', '2026-11-20', 'Tidewater'),
      filing('4', 'PF ECR', '2026-11-15', 'Halcyon'),
      filing('5', 'TDS challan', '2026-10-07', 'Kestrel'),
    ];
    expect(nextDeadline(rows, '2026-10-29')).toEqual({ due: '2026-11-15', days: 17, name: 'PF ECR', period: 'Sep 2026', companies: ['Halcyon'] });
    expect(nextDeadline(rows.filter((r) => r.particular !== 'PF ECR'), '2026-10-29')?.companies).toEqual(['Brightwave', 'Tidewater']);
    expect(overdueFilings(rows, '2026-10-29').map((r) => r.id)).toEqual(['5']);
    expect(nextDeadline([], '2026-10-29')).toBeNull();
  });
});

describe('regulatory review queue', () => {
  const base = { status: 'ready', hasReviewPdf: true, reviewStatus: 'pending' as const };

  it('follows the live rules for reading, deciding and polling', () => {
    expect(stillReading({ status: 'processing', hasReviewPdf: false })).toBe(true);
    expect(stillReading({ status: 'ready', hasReviewPdf: false })).toBe(true);
    expect(stillReading(base)).toBe(false);
    expect(decidable(base, true)).toBe(true);
    expect(decidable(base, false)).toBe(false);
    expect(decidable({ ...base, reviewStatus: 'approved' }, true)).toBe(false);
    expect(decidable({ ...base, status: 'failed' }, true)).toBe(false);
    expect(needsPolling([base, { status: 'processing', hasReviewPdf: false }])).toBe(true);
    expect(needsPolling([base])).toBe(false);
  });

  it('labels the published day and who may read the queue', () => {
    expect(publishedLabel('2026-10-16', NOW)).toBe('16 Oct');
    expect(publishedLabel('Oct 2026', NOW)).toBe('Oct 2026');
    expect(publishedLabel(null, NOW)).toBe('');
    expect(canSeeRegulatory('manager')).toBe(true);
    expect(canSeeRegulatory('super_admin')).toBe(true);
    expect(canSeeRegulatory('intern')).toBe(false);
    expect(canSeeRegulatory('client')).toBe(false);
  });
});
