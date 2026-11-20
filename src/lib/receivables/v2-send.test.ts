import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Approval before any automatic email (owner, 20 Nov 2026): a due roll-up is saved as `awaiting`,
 * replaces an older one still waiting for the same partner, and nothing is sent through Outlook.
 */
vi.mock('server-only', () => ({}));
vi.mock('next/server', () => ({ after: () => undefined }));
const startLog = vi.fn();
const replaceAwaiting = vi.fn();
const sendOutlook = vi.fn();
const sendSystem = vi.fn();
vi.mock('@/db/repositories/receivables', () => ({
  systemLastRollupDate: async () => null,
  systemSheetPartners: async () => [{ id: 'p1', name: 'Ravi Kumar', email: 'ravi@x.in', active: true, notifyRollup: true, notifyNewInvoice: true }],
  systemOpenInvoices: async () => [{ id: 'i1', clientName: 'Acme', invoiceNo: 'INV-1', invoiceDate: '2026-10-01', dueDate: '2026-11-01', amountInr: 1000, partnerId: 'p1', clientId: null }],
  systemStaffName: async () => 'Krishna',
  systemCoPartnerLinks: async () => [],
  systemTemplatesFor: async () => ({}),
  systemStartEmailLog: (...a: unknown[]) => startLog(...a),
  systemReplaceAwaiting: (...a: unknown[]) => replaceAwaiting(...a),
  systemFinishEmailLog: async () => undefined,
  systemGetEmailLog: async () => null,
  systemSetEmailWhatsApp: async () => undefined,
  systemDigestRecipients: async () => [],
  systemInvoicesById: async () => [],
  systemSheetEmailSettings: async () => null,
}));
vi.mock('@/db/repositories/outlook-connections', () => ({
  sendMailViaOutlookWithLink: (...a: unknown[]) => sendOutlook(...a),
  systemSendMailAsResult: (...a: unknown[]) => sendSystem(...a),
}));

const { sendSheetRollups } = await import('./v2-send');

const SHEET = {
  id: 's1',
  clientOrgName: 'Summit',
  managerUserId: 'u1',
  emailRollupEnabled: true,
  rollupWeekdays: [5],
  rollupEveryDays: 7,
  sendHourIst: 10,
  digestEnabled: false,
  digestWeekday: 1,
  digestHourIst: 9,
  emailNewInvoiceEnabled: true,
  emailRevisedEnabled: true,
} as unknown as Parameters<typeof sendSheetRollups>[0];

beforeEach(() => {
  vi.clearAllMocks();
  startLog.mockResolvedValue({ id: 'log-1' });
});

describe('automatic emails wait for approval', () => {
  it('saves a due roll-up as awaiting, replaces the older one and sends nothing', async () => {
    // Friday 20 Nov 2026, 11:00 IST.
    const out = await sendSheetRollups(SHEET, new Date('2026-11-20T05:30:00Z'));
    expect(out.sent).toBe(1);
    expect(startLog).toHaveBeenCalledWith(expect.objectContaining({ kind: 'rollup', partnerId: 'p1', status: 'awaiting', dedupeKey: 'rollup:p1:2026-11-20' }));
    expect(replaceAwaiting).toHaveBeenCalledWith('s1', 'rollup', 'p1', 'log-1');
    expect(sendOutlook).not.toHaveBeenCalled();
    expect(sendSystem).not.toHaveBeenCalled();
  });

  it('prepares nothing before the hour', async () => {
    await sendSheetRollups(SHEET, new Date('2026-11-20T03:00:00Z'));
    expect(startLog).not.toHaveBeenCalled();
  });
});
