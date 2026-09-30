import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import type { Engagement } from '@/data/engagements';
import { reminderComposeHref } from '@/lib/ask/reminder';
import { staffQueryAnswer } from '@/lib/ask/suggestions';
import { firmPulse, waitingOnClient, type StaffData } from '@/lib/ask/tools/staff';

const listEngagements = vi.fn();
const listChecklistIndex = vi.fn();
const getFilings = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  listEngagements: (...a: unknown[]) => listEngagements(...a),
  listChecklistIndex: (...a: unknown[]) => listChecklistIndex(...a),
  toAppEngagement: (row: { id: string; companyName: string; managerId: string }) => ({
    id: row.id,
    slug: row.id,
    companyName: row.companyName,
    stage: 'Pre-Incorporation',
    health: 'on-track',
    managerId: row.managerId,
  }),
}));
vi.mock('@/db/repositories/filings', () => ({ getFilings: (...a: unknown[]) => getFilings(...a) }));

const { loadStaffData } = await import('@/lib/ask/tools/staff-data');

const admin: AuthContext = { userId: 'u-admin', email: 'a@x.test', name: 'Admin', role: 'admin' };

function eng(id: string, managerId: string): StaffData['engagements'][number] {
  return {
    dbId: id,
    engagement: { id, slug: id, companyName: `Company ${id}`, stage: 'Pre-Incorporation', health: 'on-track', managerId } as Engagement,
    // pre-1 is the client's first step: waiting on the client.
    state: {},
  };
}

beforeEach(() => vi.clearAllMocks());

describe('admin scope is firm-wide, through the scoped repositories', () => {
  it('loads every engagement the admin context can see and drops deleted ones', async () => {
    listEngagements.mockResolvedValue([
      { id: 'e1', companyName: 'One', managerId: 'm1', deletedAt: null },
      { id: 'e2', companyName: 'Two', managerId: 'm2', deletedAt: null },
      { id: 'e3', companyName: 'Gone', managerId: 'm2', deletedAt: new Date() },
    ]);
    listChecklistIndex.mockResolvedValue({});
    getFilings.mockResolvedValue({ rows: [], companies: [] });
    const data = await loadStaffData(admin);
    expect(listEngagements).toHaveBeenCalledWith(admin);
    expect(listChecklistIndex).toHaveBeenCalledWith(admin);
    expect(getFilings).toHaveBeenCalledWith(admin);
    expect(data.engagements.map((e) => e.dbId)).toEqual(['e1', 'e2']);
  });

  it('lists projects across managers', () => {
    const data: StaffData = { engagements: [eng('e1', 'm1'), eng('e2', 'm2')], filings: [], now: new Date('2026-10-01') };
    expect(waitingOnClient(data).map((r) => r.engagementId)).toEqual(['e1', 'e2']);
    expect(firmPulse(data)).toMatchObject({ activeProjects: 2, waitingOnClients: 2 });
  });

  it('templated query answers carry live-data citations and no model text', () => {
    const data: StaffData = { engagements: [eng('e1', 'm1')], filings: [], now: new Date('2026-10-01') };
    const answer = staffQueryAnswer('waitingOnClient', data);
    expect(answer.origin).toBe('deterministic');
    expect(answer.line).toBe('1 project is waiting on client action.');
    expect(answer.actions).toEqual(['openProject', 'draftReminder']);
    expect(answer.citations[0]!.id).toBe('listWaitingOnClient');
  });
});

describe('draft reminder', () => {
  const data: StaffData = { engagements: [eng('e1', 'm1')], filings: [], now: new Date('2026-10-01') };
  const answer = staffQueryAnswer('waitingOnClient', data);

  it('opens compose pre-filled — a link, not a send', () => {
    const href = reminderComposeHref('/app/admin', answer);
    const url = new URL(href, 'http://x');
    expect(url.pathname).toBe('/app/admin/mail');
    expect(url.searchParams.get('subject')).toContain('Company e1');
    expect(url.searchParams.get('body')).toContain('waiting on you');
  });

  it('sends super admin to the firm admin compose page', () => {
    expect(reminderComposeHref('/app/super', answer)).toMatch(/^\/app\/admin\/mail\?/);
  });

  it('no Ask VCFO module can reach an email or Outlook sender', () => {
    const roots = ['src/lib/ask', 'src/components/ask', 'app/api/ask', 'src/hooks/ask'];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name) && !name.includes('.test.')) files.push(full);
      }
    };
    roots.forEach(walk);
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/lib\/email|send-email|api\/outlook\/send|send-whatsapp/);
    }
  });
});
