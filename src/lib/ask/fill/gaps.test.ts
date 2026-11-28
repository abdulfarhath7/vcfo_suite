import { describe, expect, it } from 'vitest';
import { askClientItems, clientKnows, fillGaps, overlayState } from './gaps';

/**
 * The gaps ladder on synthetic Client Details: what the card holds is not a gap, what follows from
 * it is suggested, what only the client knows is asked of the client, and the lead's fields are
 * left with a reason.
 */

const card = {
  'pre-1': {
    businessDescription: 'The company will develop and license logistics software in India.',
    proposedName1: 'Northwind India Private Limited',
    proposedName2: 'Northwind Software India Private Limited',
    parentEntityName: 'Northwind LLC',
    parentEntityAddress: '100 Main Street, Austin, Texas, United States',
    authorisedShareCapital: '1000000',
    paidUpShareCapital: '100000',
    signatoryFirstName: 'Jordan',
    signatoryLastName: 'Lee',
    signatoryDesignation: 'Director',
  },
};

describe('fillGaps', () => {
  const gaps = fillGaps({ stepIds: ['pre-1', 'pre-13'], state: {}, engagement: { ownershipType: 'foreign' }, cardValues: card });
  const byKey = (stepId: string, key: string) => gaps.find((g) => g.stepId === stepId && g.key === key);

  it('does not count a value the card holds', () => {
    expect(byKey('pre-1', 'businessDescription')).toBeUndefined();
    expect(byKey('pre-1', 'proposedName1')).toBeUndefined();
  });

  it('suggests what follows from what is known, with the reason', () => {
    expect(byKey('pre-1', 'parentEntityCountry')).toMatchObject({ rung: 'suggested', suggestion: { value: 'United States of America' } });
    // Phase 2: the usual INR 10 face value, then 1,00,000 / 10 shares.
    expect(byKey('pre-13', 'equityNominalValue')).toMatchObject({ rung: 'suggested', suggestion: { value: '10' } });
    expect(byKey('pre-13', 'equityQuantity')).toMatchObject({ rung: 'suggested', suggestion: { value: '10000' } });
    expect(byKey('pre-13', 'equityShares')).toMatchObject({ rung: 'suggested', suggestion: { value: 'yes' } });
  });

  it('asks the client for what only the client knows, and leaves the lead\'s fields with a reason', () => {
    expect(byKey('pre-1', 'boardResolutionDate')).toMatchObject({ rung: 'ask_client', kind: 'answer' });
    expect(byKey('pre-1', 'passportUrl')).toMatchObject({ rung: 'ask_client', kind: 'document' });
    expect(byKey('pre-1', 'nicCode')).toMatchObject({ rung: 'left', reason: expect.stringMatching(/project lead/) });
    expect(askClientItems(gaps).map((i) => i.label)).toContain('Client Details: Date of Board Resolution');
  });

  it('passes over a step that is complete', () => {
    const done = fillGaps({ stepIds: ['pre-1'], state: { 'pre-1': { status: 'completed', responses: {} } as never }, cardValues: {} });
    expect(done).toEqual([]);
  });
});

describe('overlayState', () => {
  it('adds a new list entry the card makes to the list ids', () => {
    const state = overlayState({ 'pre-15': { status: 'in-progress', responses: { directors: 'd1' } } as never }, { 'pre-15': { 'directors.ask1.firstName': 'Asha' } });
    expect(state['pre-15']?.responses?.directors).toBe('d1,ask1');
  });
});

describe('clientKnows', () => {
  it('is true for a client step answer and false for a lead-only field or a lead step', () => {
    expect(clientKnows('pre-1', 'proposedName1')).toBe(true);
    expect(clientKnows('pre-1', 'nicCode')).toBe(false);
    expect(clientKnows('pre-4', 'nameApplicationAcknowledgementUrl')).toBe(false);
  });
});
