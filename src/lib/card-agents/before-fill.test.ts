import { describe, expect, it } from 'vitest';
import type { GstMissing } from '@/lib/registrations/gst-profile';
import {
  beforeFillStorageKey,
  beforeFillSummary,
  buildGstBeforeFill,
  buildMcaBeforeFill,
  choicesFor,
  clientRequestItems,
  displayValue,
  fieldLabel,
  fillNowState,
  groupBeforeFill,
  loadChoices,
  profileSection,
  reconcileChoices,
  saveChoices,
  suggestedChoice,
  type BeforeFillItem,
} from './before-fill';

const gstCtx = { sharepoint: true, zohoLinked: false };
const mcaCtx = { sharepoint: false, zohoLinked: false };

const miss = (over: Partial<GstMissing>): GstMissing => ({
  key: 'k',
  label: 'K',
  kind: 'value',
  source: 'client',
  where: 'GST step',
  stepId: 'reg-4',
  required: true,
  ...over,
});

const gstRead = {
  fields: { 'partA.legalName': 'KESTREL ROBOTICS PVT LTD', 'partA.pan': 'AAKCK1234F', 'bank.accountNumber': '123456789012', 'meta.subjectKind': 'x', 'business.compositionOpted': false },
  documents: [{ key: 'place.proof', label: 'Address proof', fileName: 'rent-agreement.pdf', source: 'sharepoint' }],
  view: { confirm: [{ key: 'trade-name', label: 'Trade name' }] },
  missing: [
    miss({ key: 'principalPlace.address.district', label: 'District', source: 'sharepoint' }),
    miss({ key: 'goods.1.hsn', label: 'HSN codes', source: 'client' }),
    miss({ key: 'promoter.1.photo', label: 'Signatory photo', kind: 'document', source: 'client' }),
    miss({ key: 'business.jurisdiction.ward', label: 'Jurisdiction', source: 'portal', reason: 'Looked up on the portal' }),
    miss({ key: 'principalPlace.website', label: 'Website', source: 'tool', required: false }),
  ],
};

describe('before I fill: building the list', () => {
  it('turns the GST read into ready, confirm and missing items', () => {
    const items = buildGstBeforeFill(gstRead);
    const g = groupBeforeFill(items);
    expect(g.ready.map((i) => i.label)).toEqual(['Legal name', 'PAN', 'Bank account number', 'Composition opted', 'Address proof']);
    expect(g.ready.find((i) => i.key === 'bank.accountNumber')!.value).toBe('•••• 9012');
    expect(g.ready.find((i) => i.key === 'doc:place.proof')).toMatchObject({ kind: 'document', value: 'rent-agreement.pdf', source: 'sharepoint' });
    expect(g.confirm.map((i) => i.label)).toEqual(['Trade name']);
    expect(g.missingRequired.map((i) => i.label)).toEqual(['District', 'HSN codes', 'Jurisdiction', 'Signatory photo']);
    expect(g.missingOptional.map((i) => i.label)).toEqual(['Website']);
    expect(items.find((i) => i.label === 'Jurisdiction')!.portalOnly).toBe(true);
  });

  it('counts what the form needs, what Suite has and what is missing', () => {
    const s = beforeFillSummary(buildGstBeforeFill(gstRead));
    expect(s.values).toEqual({ need: 9, have: 5, missing: 4 });
    expect(s.documents).toEqual({ need: 2, have: 1, missing: 1 });
    expect(s.requiredMissing).toBe(4);
    expect(s.pct).toBe(54);
    expect(beforeFillSummary([]).pct).toBe(100);
  });

  it('reads the MCA profile and its missing list', () => {
    const items = buildMcaBeforeFill({
      profile: {
        mcaLogin: { userId: '' },
        company: { proposedNames: ['ORBIT LABS PRIVATE LIMITED', 'ORBIT TECH LABS'], nicCode: '62011' },
        directors: [{ firstName: 'Asha', din: '01234567' } as never],
        subscribers: [],
        agile: {},
        moa: {},
        aoa: {},
      },
      missing: [
        { key: 'directors.0.photo', label: 'Director 1 photo', stepId: 'pre-2' },
        { key: 'company.significance', label: 'Significance of the name', stepId: 'pre-4' },
        { key: 'mca.login', label: 'MCA login', stepId: 'pre-4', reason: 'Suite never holds a portal login' },
      ],
    });
    const g = groupBeforeFill(items);
    expect(g.ready.map((i) => `${i.label}: ${i.value}`)).toEqual([
      'Proposed names: ORBIT LABS PRIVATE LIMITED, ORBIT TECH LABS',
      'NIC code: 62011',
      'Director 1 first name: Asha',
      'Director 1 DIN: 01234567',
    ]);
    expect(g.missingRequired.map((i) => [i.label, i.kind, i.portalOnly])).toEqual([
      ['Significance of the name', 'value', false],
      ['MCA login', 'value', true],
      ['Director 1 photo', 'document', false],
    ]);
  });

  it('keeps only the sections the form’s recipe fills', () => {
    const result = {
      profile: { mcaLogin: { userId: '' as const }, company: { nicCode: '62011' }, directors: [{ din: '01234567' } as never], subscribers: [], agile: {}, moa: {}, aoa: {} },
      missing: [
        { key: 'company.proposedName2', label: 'Proposed name 2', stepId: 'pre-1' },
        { key: 'director.1.photo', label: 'Director 1 photo', stepId: 'pre-2' },
        { key: 'agile.bank', label: 'AGILE-PRO-S: bank', stepId: 'pre-10', reason: 'not collected' },
      ],
    };
    expect(buildMcaBeforeFill(result, ['company']).map((i) => i.key)).toEqual(['company.nicCode', 'company.proposedName2']);
    expect(buildMcaBeforeFill(result, ['company', 'director']).map((i) => i.key)).toEqual(['company.nicCode', 'directors.1.din', 'company.proposedName2', 'director.1.photo']);
    expect(buildMcaBeforeFill(result, [])).toHaveLength(5);
    expect(profileSection('directors[0].din')).toBe('director');
    expect(profileSection('registeredOffice.pincode')).toBe('registeredOffice');
  });

  it('writes plain labels and hides account numbers', () => {
    expect(fieldLabel('promoters.2.fatherFirstName')).toBe('Promoter 2 father first name');
    expect(fieldLabel('signatory.address.pincode')).toBe('Signatory address pincode');
    expect(fieldLabel('services.1.sac')).toBe('Services 1 SAC');
    expect(displayValue('bank.accountNumber', '12')).toBe('••••');
    expect(displayValue('x', '  ')).toBeNull();
    expect(displayValue('x', true)).toBe('Yes');
  });
});

describe('before I fill: choices', () => {
  const items = buildGstBeforeFill(gstRead);
  const item = (label: string) => items.find((i) => i.label === label)!;

  it('offers only the actions that make sense for each item', () => {
    expect(choicesFor(item('District'), gstCtx)).toEqual(['sharepoint', 'client', 'type-now', 'portal']);
    expect(choicesFor(item('Signatory photo'), gstCtx)).toEqual(['sharepoint', 'client', 'type-now', 'portal']);
    expect(choicesFor(item('Jurisdiction'), gstCtx)).toEqual(['portal']);
    expect(choicesFor(item('Website'), gstCtx)).toEqual(['client', 'type-now', 'portal', 'skip']);
    expect(choicesFor(item('Legal name'), gstCtx)).toEqual([]);
    expect(choicesFor(item('Trade name'), gstCtx)).toEqual([]);
    // SharePoint only where the card has a reading path; Zoho only when the client's org is linked.
    expect(choicesFor(item('District'), mcaCtx)).toEqual(['client', 'type-now', 'portal']);
    const zohoItem: BeforeFillItem = { key: 'z', label: 'Z', kind: 'value', status: 'missing', required: true, source: 'zoho' };
    expect(choicesFor(zohoItem, gstCtx)).not.toContain('zoho');
    expect(choicesFor(zohoItem, { ...gstCtx, zohoLinked: true })).toContain('zoho');
    expect(suggestedChoice(zohoItem, { ...gstCtx, zohoLinked: true })).toBe('zoho');
  });

  it('suggests the item’s own source, Skip for optional items, and the portal when Suite cannot hold it', () => {
    expect(suggestedChoice(item('District'), gstCtx)).toBe('sharepoint');
    expect(suggestedChoice(item('District'), mcaCtx)).toBe('client');
    expect(suggestedChoice(item('HSN codes'), gstCtx)).toBe('client');
    expect(suggestedChoice(item('Jurisdiction'), gstCtx)).toBe('portal');
    expect(suggestedChoice(item('Website'), gstCtx)).toBe('skip');
    expect(suggestedChoice(item('Legal name'), gstCtx)).toBeNull();
  });

  it('keeps saved choices that are still allowed and drops items that arrived', () => {
    const choices = reconcileChoices(items, { 'goods.1.hsn': 'portal', 'principalPlace.address.district': 'skip', gone: 'client' }, gstCtx);
    expect(choices).toEqual({
      'principalPlace.address.district': 'sharepoint',
      'goods.1.hsn': 'portal',
      'business.jurisdiction.ward': 'portal',
      'doc:promoter.1.photo': 'client',
      'principalPlace.website': 'skip',
    });
  });

  it('unlocks Fill now only when every required item is present or left for the portal', () => {
    const start = reconcileChoices(items, {}, gstCtx);
    const locked = fillNowState(items, start);
    expect(locked.unlocked).toBe(false);
    expect(locked.blocking.map((i) => i.label)).toEqual(['District', 'HSN codes', 'Signatory photo']);
    expect(locked.typeOnPortal).toEqual(['business.jurisdiction.ward']);
    expect(locked.skipped).toEqual(['principalPlace.website']);

    const all = { ...start, 'principalPlace.address.district': 'portal', 'goods.1.hsn': 'portal', 'doc:promoter.1.photo': 'portal' } as const;
    const open = fillNowState(items, all);
    expect(open.unlocked).toBe(true);
    expect(open.typeOnPortal).toHaveLength(4);
    // An optional item never blocks, whatever its choice.
    expect(fillNowState(items, { ...all, 'principalPlace.website': 'client' }).unlocked).toBe(true);
    // Nothing missing: open at once.
    expect(fillNowState(items.filter((i) => i.status !== 'missing'), {}).unlocked).toBe(true);
  });

  it('drafts the request list from the items set to Ask the client', () => {
    const choices = reconcileChoices(items, {}, gstCtx);
    expect(clientRequestItems(items, choices, 'GST REG-01')).toEqual([
      { kind: 'answer', label: 'HSN codes', help: 'Needed for GST REG-01.' },
      { kind: 'document', label: 'Signatory photo (upload)', help: 'Needed for GST REG-01.' },
    ]);
  });
});

describe('before I fill: saved choices', () => {
  it('saves and loads per engagement and task, and survives blocked or bad storage', () => {
    const key = beforeFillStorageKey('eng-1', 'gst-reg-01');
    expect(key).toBe('vcfo.card-agent.before-fill.eng-1.gst-reg-01');
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    expect(saveChoices(storage, key, { a: 'portal', b: 'client' })).toBe(true);
    expect(loadChoices(storage, key)).toEqual({ a: 'portal', b: 'client' });
    mem.set(key, JSON.stringify({ v: 1, choices: { a: 'portal', b: 'hack' } }));
    expect(loadChoices(storage, key)).toEqual({ a: 'portal' });
    mem.set(key, '{not json');
    expect(loadChoices(storage, key)).toEqual({});
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadChoices(blocked, key)).toEqual({});
    expect(saveChoices(blocked, key, {})).toBe(false);
    expect(saveChoices(null, key, {})).toBe(false);
  });
});
