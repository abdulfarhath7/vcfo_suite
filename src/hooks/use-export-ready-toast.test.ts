import { describe, expect, it } from 'vitest';
import type { AppNotification } from '@/lib/checklist/checklist-notifications';
import { exportNoticeFor } from './use-export-ready-toast';

const notice = (over: Partial<AppNotification>): AppNotification =>
  ({
    id: 'n1',
    kind: 'docs.share',
    title: 'The Excel file of Audit log is ready',
    body: 'Audit-log_11-11-2026.xlsx is ready to download.',
    engagementId: '',
    companyName: '',
    href: '/api/exports/abc',
    createdAt: '2026-11-11T06:00:10Z',
    read: false,
    ...over,
  }) as AppNotification;

describe('GL-06 / PR-02 export toast', () => {
  const since = Date.parse('2026-11-11T06:00:00Z');

  it('finds the ready notice of the export that was started', () => {
    const hit = exportNoticeFor([notice({})], 'Audit-log_11-11-2026.xlsx', since);
    expect(hit?.ready).toBe(true);
    expect(hit?.notice.href).toBe('/api/exports/abc');
  });

  it('reads a failed export as not ready', () => {
    const failed = notice({ title: 'The Excel file of Audit log did not finish', body: 'Audit-log_11-11-2026.xlsx did not finish. Try again.', href: '#' });
    expect(exportNoticeFor([failed], 'Audit-log_11-11-2026.xlsx', since)?.ready).toBe(false);
  });

  it('ignores another file and an older notice of the same name', () => {
    expect(exportNoticeFor([notice({ body: 'Projects_11-11-2026.xlsx is ready to download.' })], 'Audit-log_11-11-2026.xlsx', since)).toBeNull();
    expect(exportNoticeFor([notice({ createdAt: '2026-11-11T05:00:00Z' })], 'Audit-log_11-11-2026.xlsx', since)).toBeNull();
  });
});
