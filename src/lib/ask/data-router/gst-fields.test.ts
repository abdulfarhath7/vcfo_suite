// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getActiveCatalogItems } from '@/data/checklist';
import { checkSubjectFieldRow } from '@/lib/actions/registrations/field-rules';
import { catalogEntry, isWritableUse } from '@/lib/ask/field-catalog';
import type { LlmProvider } from '@/lib/ask/provider';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { placeValues } from './place';
import { planRows, type PlacedValue, type PlanInput } from './plan';
import { readPaste, splitPersonLabel } from './read';

/**
 * GST REG-01 from the chat (owner brief, 25 Nov 2026): review cards target the GST step's own
 * fields (`reg-4`, client and SBC side), a value whose checklist step is finished goes to the GST
 * copy instead of a "reopen first" hold, and a line that fits nowhere is listed, never dropped.
 */

/** Every catalog step up to and including `lastDone` finished. */
function doneThrough(lastDone: string, responses: Record<string, Record<string, string>> = {}): PlanInput['state'] {
  const state: Record<string, ChecklistItemStateSlice> = {};
  for (const item of getActiveCatalogItems()) {
    state[item.id] = { status: 'completed', reviewStatus: 'accepted', responses: responses[item.id] ?? {} } as ChecklistItemStateSlice;
    if (item.id === lastDone) break;
  }
  return state;
}

/** Every step before `stepId` finished, so `stepId` is open. */
function openAt(stepId: string, responses: Record<string, Record<string, string>> = {}): PlanInput['state'] {
  const state: Record<string, ChecklistItemStateSlice> = {};
  for (const item of getActiveCatalogItems()) {
    if (item.id === stepId) break;
    state[item.id] = { status: 'completed', reviewStatus: 'accepted', responses: responses[item.id] ?? {} } as ChecklistItemStateSlice;
  }
  return { ...state, ...(responses[stepId] ? { [stepId]: { responses: responses[stepId] } as ChecklistItemStateSlice } : {}) };
}

const place = (key: string, value: string, person: string | null = null): PlacedValue => ({
  entry: catalogEntry(key)!,
  value: { label: catalogEntry(key)!.label, value, page: null, person, confidence: 1 },
  source: { kind: 'paste' },
});

const reg4 = (client: Record<string, string> = {}, sbc: Record<string, string> = {}): NonNullable<PlanInput['registration']> => ({ key: 'reg-4', client, sbc });

const input = (placed: PlacedValue[], state: PlanInput['state'], extra: Partial<PlanInput> = {}): PlanInput => ({
  role: 'intern',
  engagementId: 'eng-halcyon',
  companyName: 'Halcyon Payments India Pvt Ltd',
  engagement: { ownershipType: 'indian' },
  state,
  placed,
  instruction: '',
  registration: reg4(),
  ...extra,
});

const directors = {
  directors: 'e1,e2',
  'directors.e1.firstName': 'Emma',
  'directors.e1.lastName': 'Tan',
  'directors.e2.firstName': 'Kavya',
  'directors.e2.lastName': 'Bhat',
};

describe('the field catalog: the GST step is writable', () => {
  it('takes the GST step fields REG-01 needs, and never the tracker milestones', () => {
    expect(isWritableUse({ source: 'registration', ref: 'reg-4', field: 'district' })).toBe(true);
    expect(isWritableUse({ source: 'registration', ref: 'reg-4', field: 'place-state' })).toBe(true);
    expect(isWritableUse({ source: 'registration', ref: 'reg-4', field: 'promoter-#-address' })).toBe(true);
    for (const milestone of ['arn', 'filed-on', 'arn-date', 'number', 'outcome', 'srn']) {
      expect(isWritableUse({ source: 'registration', ref: 'reg-4', field: milestone })).toBe(false);
    }
    expect(isWritableUse({ source: 'registration', ref: 'reg-5', field: 'witnesses' })).toBe(false);
    expect(catalogEntry('gst.district')!.uses).toEqual([{ source: 'registration', ref: 'reg-4', field: 'district' }]);
    expect(catalogEntry('office.state')!.uses).toEqual(expect.arrayContaining([{ source: 'registration', ref: 'reg-4', field: 'place-state' }]));
    expect(catalogEntry('director.address')!.uses).toEqual(expect.arrayContaining([{ source: 'registration', ref: 'reg-4', field: 'promoter-#-address' }]));
  });
});

describe('planRows: the GST step', () => {
  it('puts a value only the GST step holds on its client-side field', () => {
    const { draft, questions } = planRows(input([place('gst.district', 'Hyderabad'), place('gst.sac', '998314 - IT design')], doneThrough('pre-16')));
    expect(questions).toEqual([]);
    expect(draft.rows.map((r) => [r.action, r.target.side, r.target.fieldKey, r.newValue])).toEqual([
      ['registrations.setField', 'client', 'district', 'Hyderabad'],
      ['registrations.setField', 'client', 'sac', '998314 - IT design'],
    ]);
    expect(draft.rows[0]!.target).toMatchObject({ engagementId: 'eng-halcyon', kind: 'registration', key: 'reg-4', catalogKey: 'gst.district' });
    expect(draft.rows.every((r) => !r.heldReason)).toBe(true);
  });

  it('skips a GST value the step already holds, and says when it replaces one', () => {
    const same = planRows(input([place('gst.district', 'Hyderabad')], doneThrough('pre-16'), { registration: reg4({ district: 'Hyderabad' }) }));
    expect(same.draft.rows).toEqual([]);
    const other = planRows(input([place('gst.district', 'Hyderabad')], doneThrough('pre-16'), { registration: reg4({ district: 'Rangareddy' }) }));
    expect(other.draft.rows[0]!.checks).toContainEqual(expect.objectContaining({ rule: 'conflict', ok: false }));
    expect(other.draft.rows[0]!.oldValue).toBe('Rangareddy');
  });

  it('sends a value whose checklist step is finished to the GST copy, not a "reopen first" hold', () => {
    const state = doneThrough('pre-16', { 'pre-14': { registeredOfficeState: 'Karnataka' } });
    const { draft } = planRows(input([place('office.state', 'Telangana')], state));
    expect(draft.rows).toHaveLength(1);
    const row = draft.rows[0]!;
    expect(row.action).toBe('registrations.setField');
    expect(row.target).toMatchObject({ side: 'client', fieldKey: 'place-state', homeStep: 'pre-14', homeField: 'registeredOfficeState' });
    expect(row.heldReason).toBeUndefined();
    expect(row.label).toContain('GST copy');
    // The finished step's own value is shown, not written.
    expect(row.checks).toContainEqual(expect.objectContaining({ rule: 'other_step', ok: false }));
    // Without the GST step the old hold stays.
    const held = planRows(input([place('office.state', 'Telangana')], state, { registration: undefined }));
    expect(held.draft.rows[0]!.heldReason).toMatch(/is finished/);
  });

  it("sends a director's address on a finished directors step to that director's GST copy", () => {
    const state = doneThrough('pre-16', { 'pre-15': directors });
    const { draft, questions } = planRows(input([place('director.address', 'House 9, Street 3, Madhapur, Hyderabad, Telangana 500081', 'Kavya Bhat')], state));
    expect(questions).toEqual([]);
    expect(draft.rows).toHaveLength(1);
    expect(draft.rows[0]!.target).toMatchObject({ side: 'sbc', fieldKey: 'promoter-2-address', homeStep: 'pre-15', homeField: 'directors.e2.utilityBillAddress' });
    expect(draft.rows[0]!.label).toBe('Director 2 · Director address (GST copy)');
    expect(draft.rows[0]!.heldReason).toBeUndefined();
  });

  it('holds a GST SBC-side field for a manager: the project lead records the GST step', () => {
    const { draft } = planRows(input([place('gst.district', 'Hyderabad')], doneThrough('pre-16'), { role: 'manager' }));
    // The client side is open to any staff member.
    expect(draft.rows[0]!.heldReason).toBeUndefined();
    const sbc = checkSubjectFieldRow({
      role: 'manager',
      target: { engagementId: 'e', kind: 'registration', key: 'reg-4', side: 'sbc', fieldKey: 'promoter-2-address' },
      value: 'House 9, Madhapur',
      oldValue: '',
    });
    expect(sbc.heldReason).toMatch(/project lead records/);
    const lead = checkSubjectFieldRow({ role: 'intern', target: { engagementId: 'e', kind: 'registration', key: 'reg-4', side: 'sbc', fieldKey: 'promoter-2-address' }, value: 'House 9', oldValue: '' });
    expect(lead.heldReason).toBeNull();
    const unknown = checkSubjectFieldRow({ role: 'intern', target: { engagementId: 'e', kind: 'registration', key: 'reg-4', side: 'client', fieldKey: 'nope' }, value: 'x', oldValue: '' });
    expect(unknown.heldReason).toMatch(/not on/);
    const date = checkSubjectFieldRow({ role: 'intern', target: { engagementId: 'e', kind: 'registration', key: 'reg-4', side: 'client', fieldKey: 'commencement-date', catalogKey: 'gst.commencement_date' }, value: '22/08/2026', oldValue: '' });
    expect(date.value).toBe('2026-08-22');
  });

  it('writes an open step as before, and uses the copy for a step not open yet only on a GST run', () => {
    const open = planRows(input([place('office.state', 'Telangana')], openAt('pre-14')));
    expect(open.draft.rows[0]!.action).toBe('checklist.setResponse');
    // The catalog runs pre-13 before pre-14, so with pre-13 open the registered office is not open yet.
    const early = openAt('pre-13');
    const notYet = planRows(input([place('office.state', 'Telangana')], early));
    expect(notYet.draft.rows[0]!.action).toBe('checklist.setResponse');
    // PLAN K: a step not open yet takes the value as a draft instead of holding it.
    expect(notYet.draft.rows[0]!.heldReason).toBeUndefined();
    const gstRun = planRows(input([place('office.state', 'Telangana')], early, { gst: true }));
    expect(gstRun.draft.rows[0]!.action).toBe('registrations.setField');
  });
});

describe('a director named inside the label', () => {
  it('reads "Director 2 Kavya Bhat residential address" as that person\'s address', async () => {
    expect(splitPersonLabel('Director 2 Kavya Bhat residential address')).toEqual({ label: 'residential address', person: 'Kavya Bhat' });
    expect(splitPersonLabel('Residential address of director Kavya Bhat')).toEqual({ label: 'Residential address', person: 'Kavya Bhat' });
    expect(splitPersonLabel('Residential address of director 2')).toEqual({ label: 'Residential address', person: 'Director 2' });
    expect(splitPersonLabel('Residential address')).toBeNull();
    expect(splitPersonLabel('Director PAN')).toBeNull();
    const noModel = async (): Promise<LlmProvider> => {
      throw new Error('The model must not be called');
    };
    const read = await readPaste(
      'Put these details into Halcyon Payments India Pvt Ltd:\nRegistered office state: Telangana\nDirector 2 Kavya Bhat residential address: House 9, Street 3, Madhapur, Hyderabad, Telangana 500081',
      { provider: noModel, model: 'm', idDocReading: true },
    );
    expect(read.values).toContainEqual(expect.objectContaining({ label: 'residential address', person: 'Kavya Bhat', value: 'House 9, Street 3, Madhapur, Hyderabad, Telangana 500081' }));
  });
});

describe('placeValues: nothing disappears', () => {
  const noModel = async (): Promise<LlmProvider> => {
    throw new Error('The model must not be called');
  };
  it('lists a line that fits no field as unplaced instead of dropping it', async () => {
    const out = await placeValues(
      [
        {
          result: {
            docType: 'other',
            company: null,
            values: [{ label: 'Favourite colour of the second promoter at the office', value: 'Teal', page: null, person: null, confidence: 1 }],
            parts: [],
            sensitive: false,
            usedModel: false,
          },
          attachment: null,
        },
      ],
      { instruction: '', provider: noModel, model: 'm' },
    );
    expect(out.placed).toEqual([]);
    expect(out.unplaced).toEqual(['Favourite colour of the second promoter at the office: Teal']);
  });

  it('masks an identity number on an unplaced line', async () => {
    const out = await placeValues(
      [{ result: { docType: 'other', company: null, values: [{ label: 'Zzq code', value: 'ABCDE1234F', page: null, person: null, confidence: 1 }], parts: [], sensitive: false, usedModel: false }, attachment: null }],
      { instruction: '', provider: noModel, model: 'm' },
    );
    expect(out.unplaced[0]).not.toContain('ABCDE1234F');
  });
});
