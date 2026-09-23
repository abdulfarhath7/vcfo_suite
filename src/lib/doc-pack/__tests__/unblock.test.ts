import { describe, expect, it } from 'vitest';

import { evaluateDocPack } from '@/lib/doc-pack/evaluate';
import { docsFedByStep } from '@/lib/doc-pack/step-strip';
import { fastestUnblock, missingInputLabel } from '@/lib/doc-pack/unblock';
import { FINALIZED_BR, director, fullState } from '@/lib/doc-pack/__tests__/fixtures';

const NR = director('e1', 'no', 'Alpha');

describe('fastestUnblock', () => {
  it('returns null when nothing needs inputs', () => {
    const summary = evaluateDocPack({ state: fullState([NR, director('e2', 'yes', 'Beta')]), brRow: FINALIZED_BR });
    expect(fastestUnblock(summary)).toBeNull();
  });

  it('picks the input that releases the most documents', () => {
    // Director 2 is missing only PAN → three documents released by one field.
    // Registered office is missing → releases only the MOA.
    const state = fullState([NR, director('e2', 'yes', 'Beta', { panNumber: '' })]);
    state['pre-14'] = { status: 'not-started', responses: {} };
    const hint = fastestUnblock(evaluateDocPack({ state, brRow: FINALIZED_BR }));
    expect(hint?.input.key).toBe('director.2.pan');
    expect(hint?.releases).toBe(3);
  });

  it('prefers an input on the current step', () => {
    const state = fullState([NR, director('e2', 'yes', 'Beta', { panNumber: '' })]);
    state['pre-14'] = { status: 'not-started', responses: {} };
    const summary = evaluateDocPack({ state, brRow: FINALIZED_BR });
    expect(fastestUnblock(summary, 'pre-14')?.input.key).toBe('company.registeredOffice');
    expect(fastestUnblock(summary, 'pre-9')?.input.key).toBe('director.2.pan');
  });

  it('falls back to the input that appears most when none fully releases a document', () => {
    const state = fullState([
      NR,
      director('e2', 'yes', 'Beta', { panNumber: '', fatherName: '', utilityBillAddress: '' }),
    ]);
    const hint = fastestUnblock(evaluateDocPack({ state, brRow: FINALIZED_BR }));
    expect(hint?.releases).toBe(0);
    // DIR-2, DIR-8, INC-9 and the deposit declaration all need the father's name and address.
    expect(hint?.appearsIn).toBe(4);
  });
});

describe('missingInputLabel', () => {
  it('prefixes the director', () => {
    expect(missingInputLabel({ label: 'PAN', directorIndex: 2 })).toBe('Director 2 · PAN');
    expect(missingInputLabel({ label: 'Registered office address' })).toBe('Registered office address');
  });
});

describe('docsFedByStep', () => {
  it('lists the documents that read a step', () => {
    const summary = evaluateDocPack({ state: fullState([NR, director('e2', 'yes', 'Beta')]), brRow: FINALIZED_BR });
    const pre14 = docsFedByStep(summary, 'pre-14');
    expect(pre14.items.map((i) => i.docId)).toEqual(['moa']);
    const pre15 = docsFedByStep(summary, 'pre-15');
    expect(pre15.total).toBeGreaterThan(5);
    expect(pre15.counts.ready).toBe(pre15.total);
    expect(docsFedByStep(summary, 'pre-9').total).toBe(0);
  });
});
