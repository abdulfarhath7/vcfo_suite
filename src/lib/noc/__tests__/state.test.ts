import { describe, expect, it } from 'vitest';
import { buildNocState, nocMayAccept, type NocRowInput } from '@/lib/noc/state';

const foreign = { ownershipType: 'subsidiary', companyType: 'foreign', parentIndianRelationship: null, parentEntityName: 'Parent Inc.' };
const indian = { ownershipType: 'subsidiary', companyType: 'domestic', parentIndianRelationship: 'investing', parentEntityName: 'Parent Ltd' };
const names = new Map([['u1', 'Asha'], ['u2', 'Ravi']]);

const signedRow: NocRowInput = {
  status: 'finalized',
  storagePath: 'br/x.docx',
  draftedAt: '2026-10-01T00:00:00.000Z',
  finalizedAt: '2026-10-02T00:00:00.000Z',
  finalizedBy: 'u1',
  signedStoragePath: 'br/signed.pdf',
  signedUploadedAt: '2026-10-03T00:00:00.000Z',
  signedUploadedBy: 'u2',
};

describe('buildNocState', () => {
  it('a client gets the track and the variant, never the staff block or the internal file name', () => {
    const s = buildNocState({ row: signedRow, answers: foreign, names, viewer: { staff: false, canChangeTemplate: false } });
    expect(s.staff).toBeUndefined();
    expect(JSON.stringify(s)).not.toContain('.docx');
    expect(s.variantLabel).toBe('NOC — Foreign subsidiary');
    expect(s.track.map((t) => t.key)).toHaveLength(6);
    expect(s.track.find((t) => t.key === 'released')).toMatchObject({ done: true, byName: 'Asha' });
    expect(s.track.find((t) => t.key === 'notarised')?.done).toBe(false);
  });

  it('an Indian parent has four steps and four checks', () => {
    const s = buildNocState({ row: signedRow, answers: indian, names, viewer: { staff: true, canChangeTemplate: true } });
    expect(s.track).toHaveLength(4);
    expect(s.staff?.checks).toHaveLength(4);
    expect(s.staff?.templateFileName).toBe('noc-indian-investing.docx');
  });

  it('a staff override wins over the answers', () => {
    const s = buildNocState({
      row: { ...signedRow, templateVariant: 'indian-name-only', templateChangedAt: '2026-10-04T00:00:00.000Z', templateChangedBy: 'u1', templateChangeReason: 'Name use only' },
      answers: foreign,
      names,
      viewer: { staff: true, canChangeTemplate: true },
    });
    expect(s.variant).toBe('indian-name-only');
    expect(s.resolvedVariant).toBe('foreign-parent');
    expect(s.staff?.override).toMatchObject({ variant: 'indian-name-only', reason: 'Name use only', byName: 'Asha' });
  });

  it('marks the draft out of date when an answer changed after release', () => {
    const s = buildNocState({
      row: signedRow,
      answers: foreign,
      names,
      latestVersion: { version: 2, fields: { __variant: 'foreign-parent', PARENT_ENTITY_NAME: 'Old' } },
      currentFields: { __variant: 'foreign-parent', PARENT_ENTITY_NAME: 'New' },
      viewer: { staff: true, canChangeTemplate: false },
    });
    expect(s.version).toBe(2);
    expect(s.staff?.outOfDate?.changes).toEqual([{ key: 'PARENT_ENTITY_NAME', label: 'Parent name', before: 'Old', after: 'New' }]);
  });

  it('shows a send back with its reason until Accept', () => {
    const row = { ...signedRow, sentBackAt: '2026-10-05T00:00:00.000Z', sentBackBy: 'u1', sentBackReason: 'No stamp' };
    expect(buildNocState({ row, answers: indian, names, viewer: { staff: false, canChangeTemplate: false } }).sentBack).toEqual({
      at: '2026-10-05T00:00:00.000Z',
      byName: 'Asha',
      reason: 'No stamp',
    });
    const accepted = { ...row, acceptedAt: '2026-10-06T00:00:00.000Z' };
    const s = buildNocState({ row: accepted, answers: indian, names, viewer: { staff: false, canChangeTemplate: false } });
    expect(s.sentBack).toBeNull();
    expect(s.accepted).toBe(true);
  });
});

describe('nocMayAccept', () => {
  const ticks = { director_signature: { at: 'x' }, date_place: { at: 'x' }, letterhead: { at: 'x' }, names_match: { at: 'x' } };
  it('needs every check: four ticks are enough for an Indian parent, not for a foreign one', () => {
    expect(nocMayAccept({ ...signedRow, receiveChecks: ticks }, indian)).toBe(true);
    expect(nocMayAccept({ ...signedRow, receiveChecks: ticks }, foreign)).toBe(false);
    expect(nocMayAccept({ ...signedRow, receiveChecks: { ...ticks, notary_stamp: {}, apostille: {} } }, foreign)).toBe(true);
  });
  it('needs a signed copy and is refused once accepted', () => {
    expect(nocMayAccept({ ...signedRow, signedStoragePath: null, receiveChecks: ticks }, indian)).toBe(false);
    expect(nocMayAccept({ ...signedRow, acceptedAt: 'x', receiveChecks: ticks }, indian)).toBe(false);
  });
});
