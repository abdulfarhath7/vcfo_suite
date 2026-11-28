import { describe, expect, it } from 'vitest';
import { boardResolutionDecision, boardResolutionLine } from './draft-br-decision';

describe('boardResolutionDecision: the draft board resolution trigger', () => {
  it('generates only when no draft exists, every input is there and Client Details is submitted', () => {
    expect(boardResolutionDecision({ hasDraft: false, pre1Submitted: true, missing: [] })).toEqual({ kind: 'generate' });
  });

  it('leaves an existing draft alone', () => {
    expect(boardResolutionDecision({ hasDraft: true, pre1Submitted: true, missing: [] })).toEqual({ kind: 'exists' });
  });

  it('lists exactly what is missing, and the submit a fill never does', () => {
    const decision = boardResolutionDecision({ hasDraft: false, pre1Submitted: false, missing: ['Date of Board Resolution', 'Main NIC code'] });
    expect(decision).toEqual({ kind: 'missing', missing: ['Date of Board Resolution', 'Main NIC code'], needsSubmit: true });
    expect(boardResolutionLine(decision as never)).toBe(
      'Draft Board Resolution: not generated yet; it still needs Date of Board Resolution, Main NIC code; Client Details must be submitted first (a fill never submits).',
    );
    expect(boardResolutionLine({ kind: 'missing', missing: [], needsSubmit: true })).toMatch(/not generated yet; Client Details must be submitted first/);
  });
});
