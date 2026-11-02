import { describe, expect, it } from 'vitest';
import type { NocState } from '@/lib/noc/state';
import { canUploadSigned, nocPhase, nocStageRows, nocStatus, nocVariantLabel, signedCopyChip } from './noc';

const day = (ts?: string | null) => (ts ? `${Number(ts.slice(8, 10))} Oct` : undefined);
const opts = { company: 'Northwind', day, firstName: (n?: string | null) => (n ?? '').split(' ')[0] ?? '' };

function foreign(over: Partial<NocState> = {}): NocState {
  return {
    variant: 'foreign-parent',
    variantLabel: 'NOC — Foreign subsidiary',
    resolvedVariant: 'foreign-parent',
    answers: { ownershipType: 'subsidiary', companyType: 'foreign', parentIndianRelationship: null },
    parentName: 'Northwind Inc',
    foreignParent: true,
    notaryStepsOff: false,
    track: [
      { key: 'drafted', label: 'Drafted', done: true, at: '2026-10-02T05:00:00Z' },
      { key: 'released', label: 'Released', done: true, at: '2026-10-04T05:00:00Z', byName: 'Anita Rao' },
      { key: 'signed', label: 'Signed', done: true, at: '2026-10-09T05:00:00Z', byName: 'Rahul Khanna' },
      { key: 'notarised', label: 'Notarised', done: false },
      { key: 'apostilled', label: 'Apostilled', done: false },
      { key: 'accepted', label: 'Accepted', done: false },
    ],
    accepted: false,
    sentBack: null,
    version: 2,
    ...over,
  };
}

describe('nocStageRows', () => {
  it('draws six rows for a foreign parent from the route, with who and when on done steps', () => {
    const rows = nocStageRows(foreign(), {}, opts);
    expect(rows.map((r) => r.label)).toEqual(['Drafted', 'Released', 'Signed', 'Notarised', 'Apostilled', 'Accepted']);
    expect(rows[0]).toMatchObject({ done: true, sub: 'SBC · 2 Oct', now: false });
    expect(rows[1]!.sub).toBe('Anita · 4 Oct');
    expect(rows[2]!.sub).toBe('Rahul · 9 Oct');
    expect(rows[3]).toMatchObject({ done: false, now: true, sub: 'A notary stamps the signed copy' });
    expect(rows[4]).toMatchObject({ done: false, now: false });
  });

  it('draws four rows for an Indian parent, and names the company when the signer is unnamed', () => {
    const noc = foreign({
      variant: 'indian-investing',
      foreignParent: false,
      track: [
        { key: 'drafted', label: 'Drafted', done: true },
        { key: 'released', label: 'Released', done: true, at: '2026-10-04T05:00:00Z' },
        { key: 'signed', label: 'Signed', done: true, at: '2026-10-09T05:00:00Z' },
        { key: 'accepted', label: 'Accepted', done: false },
      ],
    });
    const rows = nocStageRows(noc, {}, opts);
    expect(rows).toHaveLength(4);
    expect(rows[0]!.sub).toBe('SBC');
    expect(rows[2]!.sub).toBe('Northwind · 9 Oct');
    expect(rows[3]!.now).toBe(true);
  });

  it('falls back to the board-resolution dates when the route has nothing', () => {
    const rows = nocStageRows(null, { onFile: true, released: '4 Oct', signed: '9 Oct', signedBy: 'Rahul Khanna' }, opts);
    expect(rows.map((r) => r.key)).toEqual(['drafted', 'released', 'signed', 'accepted']);
    expect(rows[0]).toMatchObject({ done: true, sub: 'SBC' });
    expect(rows[1]!.sub).toBe('SBC · 4 Oct');
    expect(rows[2]!.sub).toBe('Rahul · 9 Oct');
    expect(rows[3]).toMatchObject({ done: false, now: true });
  });

  it('shows nothing done before the draft', () => {
    const rows = nocStageRows(null, {}, opts);
    expect(rows.every((r) => !r.done)).toBe(true);
    expect(rows[0]!.now).toBe(true);
    expect(rows.filter((r) => r.now)).toHaveLength(1);
  });
});

describe('phase, status and upload rule', () => {
  it('reads the phase from the rows and the send back', () => {
    const rows = nocStageRows(foreign(), {}, opts);
    expect(nocPhase(rows, false)).toBe('sent');
    expect(nocPhase(rows, true)).toBe('sent_back');
    const acceptedRows = nocStageRows(foreign({ track: foreign().track.map((s) => ({ ...s, done: true, at: s.at ?? '2026-10-12T05:00:00Z' })) }), {}, opts);
    expect(nocPhase(acceptedRows, true)).toBe('accepted');
    expect(nocPhase(nocStageRows(null, { onFile: true }, opts), false)).toBe('released');
    expect(nocPhase(nocStageRows(null, {}, opts), false)).toBe('drafting');
  });

  it('gives the status words with the date of the step they name', () => {
    const rows = nocStageRows(foreign(), {}, opts);
    expect(nocStatus('sent', rows)).toEqual({ kind: 'up', icon: 'clock', text: 'Signed copy sent 9 Oct' });
    expect(nocStatus('sent_back', rows, '11 Oct')).toEqual({ kind: 'over', icon: 'alert', text: 'Sent back 11 Oct' });
    expect(nocStatus('released', rows)).toMatchObject({ kind: 'due', text: 'Waiting for the signed copy' });
    expect(nocStatus('drafting', rows)).toBeNull();
    const acceptedRows = nocStageRows(foreign({ track: foreign().track.map((s) => ({ ...s, done: true, at: s.at ?? '2026-10-12T05:00:00Z' })) }), {}, opts);
    expect(nocStatus('accepted', acceptedRows)).toEqual({ kind: 'ok', icon: 'check', text: 'Accepted 12 Oct' });
  });

  it('lets the client upload from release until acceptance, and labels the signed copy', () => {
    expect(canUploadSigned('drafting')).toBe(false);
    expect(canUploadSigned('released')).toBe(true);
    expect(canUploadSigned('sent')).toBe(true);
    expect(canUploadSigned('sent_back')).toBe(true);
    expect(canUploadSigned('accepted')).toBe(false);
    expect(signedCopyChip('accepted')).toEqual({ kind: 'done', text: 'Accepted' });
    expect(signedCopyChip('sent_back')).toEqual({ kind: 'over', text: 'Sent back' });
    expect(signedCopyChip('sent')).toEqual({ kind: 'up', text: 'Sent' });
  });
});

describe('nocVariantLabel', () => {
  it('prefers the route, then the answers, then says what is missing', () => {
    expect(nocVariantLabel(foreign(), {})).toBe('NOC — Foreign subsidiary');
    expect(nocVariantLabel(null, { ownershipType: 'subsidiary', companyType: 'domestic', parentIndianRelationship: 'name_only' })).toBe('NOC — Indian subsidiary (name use)');
    expect(nocVariantLabel(null, { ownershipType: 'independent' })).toBe('No NOC · standalone company');
    expect(nocVariantLabel(null, { ownershipType: 'subsidiary', companyType: 'domestic' })).toBe('NOC · parent’s role not chosen yet');
  });
});
