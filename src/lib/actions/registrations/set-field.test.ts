import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import type { ActionContext } from '../types';

class InputsForbiddenError extends Error {
  readonly status = 403;
}
const getSubjectInputs = vi.fn();
const saveSubjectFields = vi.fn();
const recordAuditEvent = vi.fn();
const getEngagementById = vi.fn();
vi.mock('@/db/repositories/compliance-inputs', () => ({
  InputsForbiddenError,
  getSubjectInputs: (...a: unknown[]) => getSubjectInputs(...a),
  saveSubjectFields: (...a: unknown[]) => saveSubjectFields(...a),
}));
vi.mock('@/db/repositories/audit-events', () => ({ recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a) }));
vi.mock('@/db/repositories/engagements', () => ({
  getEngagementById: (...a: unknown[]) => getEngagementById(...a),
  checklistStateFromRow: (row: { checklistState: unknown }) => row.checklistState,
}));
vi.mock('@/db/repositories/engagement-recipients', () => ({ resolveEngagementRecipients: vi.fn() }));
vi.mock('@/db/repositories/ask-attachments', () => ({ getOwnAskAttachments: vi.fn() }));
vi.mock('@/storage/s3', () => ({ getObjectBuffer: vi.fn() }));

const { setField } = await import('./set-field');

const lead: AuthContext = { userId: 'u-lead', email: 'lead@x.test', name: 'Lead', role: 'intern' };
const manager: AuthContext = { ...lead, userId: 'u-mgr', role: 'manager' };
const actx = (auth: AuthContext): ActionContext => ({ auth, engagementId: null, conversationId: 'c1', runId: 'r1', now: new Date('2026-11-25T10:00:00Z'), via: 'ask' });
const ENG = '11111111-1111-4111-8111-111111111111';

let saved: Record<string, string | null>;
beforeEach(() => {
  vi.clearAllMocks();
  saved = { district: null, 'promoter-2-address': null };
  getSubjectInputs.mockImplementation(async () => ({
    client: [{ key: 'district', label: 'District of the principal place', value: saved.district }],
    sbc: [{ key: 'promoter-2-address', label: 'Residential address of director 2 (GST copy)', value: saved['promoter-2-address'] }],
  }));
  saveSubjectFields.mockImplementation(async (_ctx: AuthContext, i: { values: Record<string, string | null> }) => {
    Object.assign(saved, i.values);
    return true;
  });
  getEngagementById.mockResolvedValue({ id: ENG, companyName: 'Halcyon', checklistState: { 'pre-15': { responses: { 'directors.e2.utilityBillAddress': 'Old address' } } } });
});

const district = { engagementId: ENG, kind: 'registration' as const, key: 'reg-4', side: 'client' as const, fieldKey: 'district', catalogKey: 'gst.district', value: 'Hyderabad' };
const copy = { engagementId: ENG, kind: 'registration' as const, key: 'reg-4', side: 'sbc' as const, fieldKey: 'promoter-2-address', catalogKey: 'director.address', homeStep: 'pre-15', homeField: 'directors.e2.utilityBillAddress', value: 'House 9, Madhapur' };

describe('registrations.setField', () => {
  it('is a T2 staff action in the registry', async () => {
    const { getAction } = await import('../registry');
    expect((await getAction('registrations.setField'))?.tier).toBe('T2');
  });

  it('saves the field through saveSubjectFields as the person, audits it, and undoes it', async () => {
    const out = await setField.execute(actx(lead), district);
    expect(out.ok).toBe(true);
    expect(saveSubjectFields).toHaveBeenCalledWith(lead, { engagementId: ENG, kind: 'registration', key: 'reg-4', side: 'client', values: { district: 'Hyderabad' } });
    expect(recordAuditEvent).toHaveBeenCalledWith(lead, expect.objectContaining({ engagementId: ENG, action: 'registration.field.saved' }));
    const undo = await setField.undo!(actx(lead), out.ok ? out.undo! : null);
    expect(undo.ok).toBe(true);
    expect(saved.district).toBeNull();
  });

  it('leaves a value someone changed since alone on undo', async () => {
    const out = await setField.execute(actx(lead), district);
    saved.district = 'Medchal';
    const undo = await setField.undo!(actx(lead), out.ok ? out.undo! : null);
    expect(undo).toEqual({ ok: false, error: expect.stringMatching(/changed after/) });
  });

  it('shows the finished step’s value on recheck and writes only the GST copy', async () => {
    const checked = await setField.recheck!(actx(lead), copy, {});
    expect(checked.canApply).toBe(true);
    expect(checked.checks).toContainEqual(expect.objectContaining({ rule: 'other_step', ok: false, message: expect.stringContaining('Old address') }));
    await setField.execute(actx(lead), copy);
    expect(saveSubjectFields).toHaveBeenCalledWith(lead, expect.objectContaining({ side: 'sbc', values: { 'promoter-2-address': 'House 9, Madhapur' } }));
  });

  it('holds the GST tracker side for a manager and never writes it', async () => {
    const checked = await setField.recheck!(actx(manager), copy, {});
    expect(checked.canApply).toBe(false);
    expect(checked.heldReason).toMatch(/project lead records/);
    const out = await setField.execute(actx(manager), copy);
    expect(out.ok).toBe(false);
    expect(saveSubjectFields).not.toHaveBeenCalled();
  });

  it('reads an engagement out of scope as unavailable', async () => {
    getSubjectInputs.mockResolvedValue(null);
    expect((await setField.recheck!(actx(lead), district, {})).canApply).toBe(false);
    expect(await setField.execute(actx(lead), district)).toEqual({ ok: false, error: 'This project is not available.' });
  });
});
