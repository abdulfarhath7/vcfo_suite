import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * SA-01: an acknowledgement number saved on SPICe+ Part A (pre-4) or Part B (pre-10) is copied to
 * the MCA filing record, so the filing card and the step show one SRN.
 */

const getEngagementById = vi.fn();
const patchChecklistItem = vi.fn();
const updateFiling = vi.fn();

vi.mock('@/db/repositories/engagements', () => ({
  getEngagementById: (...a: unknown[]) => getEngagementById(...a),
  checklistStateFromRow: (row: { state: unknown }) => row.state,
  patchChecklistItem: (...a: unknown[]) => patchChecklistItem(...a),
}));
vi.mock('@/db/repositories/assist-filings', () => ({ updateFiling: (...a: unknown[]) => updateFiling(...a) }));
vi.mock('@/db/repositories/expiry-items', () => ({ syncExpiryItemsForEngagement: vi.fn(async () => undefined) }));
vi.mock('@/lib/email/send-after-response', () => ({ notifyEngagementEventSoon: vi.fn() }));

const { applyChecklistPatch } = await import('./apply-checklist-patch');

const LEAD: AuthContext = { userId: 'u-lead', email: 'lead@vcfo.local', name: 'Lead', role: 'intern' };
const CLIENT: AuthContext = { userId: 'u-client', email: 'c@vcfo.local', name: 'Client', role: 'client' };
const ENG = 'eng-1';

beforeEach(() => {
  vi.clearAllMocks();
  getEngagementById.mockResolvedValue({ id: ENG, state: { 'pre-10': { responses: {} } } });
  patchChecklistItem.mockResolvedValue({ 'pre-10': { responses: {} } });
  updateFiling.mockResolvedValue({ dbId: ENG, filing: {}, changed: ['srn'] });
});

describe('applyChecklistPatch SRN link', () => {
  it('copies a lead\'s Part B acknowledgement number to the filing record', async () => {
    await applyChecklistPatch(LEAD, ENG, 'pre-10', { responses: { acknowledgementNumber: ' AB1234567 ' } });
    expect(updateFiling).toHaveBeenCalledWith(LEAD, ENG, 'spice-part-b', { srn: 'AB1234567' });
  });

  it('copies nothing when the number did not change, the step files no SPICe+ form, or the client saved', async () => {
    getEngagementById.mockResolvedValueOnce({ id: ENG, state: { 'pre-10': { responses: { acknowledgementNumber: 'AB1234567' } } } });
    await applyChecklistPatch(LEAD, ENG, 'pre-10', { responses: { acknowledgementNumber: 'AB1234567' } });
    await applyChecklistPatch(LEAD, ENG, 'post-2', { responses: { acknowledgementNumber: 'AB1234567' } });
    await applyChecklistPatch(CLIENT, ENG, 'pre-4', { responses: { acknowledgementNumber: 'AB1234567' } });
    expect(updateFiling).not.toHaveBeenCalled();
  });

  it('keeps the checklist save when the filing record refuses the SRN', async () => {
    updateFiling.mockRejectedValueOnce(new Error('An SRN is 6 to 20 letters and digits.'));
    await expect(applyChecklistPatch(LEAD, ENG, 'pre-4', { responses: { acknowledgementNumber: 'x' } })).resolves.toBeDefined();
  });
});
