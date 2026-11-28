/**
 * Whether a fill should generate the draft board resolution (pre-2), as plain code over what is
 * known, so the trigger can be tested without storage. The generator's own validator
 * (`validateBoardResolutionGeneration`) needs Client Details submitted and every input present; a
 * fill only saves drafts, so when Client Details is not submitted yet the answer says so.
 */

export type BoardResolutionOutcome =
  | { kind: 'exists' }
  | { kind: 'generated' }
  /** Every input is there, but this run does not render it (a Manual run): use Generate on the step. */
  | { kind: 'ready' }
  | { kind: 'missing'; missing: string[]; needsSubmit: boolean }
  | { kind: 'skipped'; reason: string };

export function boardResolutionDecision(input: { hasDraft: boolean; pre1Submitted: boolean; missing: readonly string[] }): { kind: 'exists' } | { kind: 'generate' } | { kind: 'missing'; missing: string[]; needsSubmit: boolean } {
  if (input.hasDraft) return { kind: 'exists' };
  if (input.missing.length === 0 && input.pre1Submitted) return { kind: 'generate' };
  return { kind: 'missing', missing: [...input.missing], needsSubmit: !input.pre1Submitted };
}

/** The sentence for the closing chat message. */
export function boardResolutionLine(outcome: BoardResolutionOutcome): string {
  switch (outcome.kind) {
    case 'exists':
      return 'Draft Board Resolution: a draft already exists, so I left it as it is.';
    case 'generated':
      return 'Draft Board Resolution: I generated the draft from the filled values; review it on the step.';
    case 'ready':
      return 'Draft Board Resolution: every input is there; press Generate on the step.';
    case 'skipped':
      return `Draft Board Resolution: ${outcome.reason}`;
    case 'missing': {
      const parts: string[] = [];
      if (outcome.missing.length > 0) parts.push(`it still needs ${outcome.missing.join(', ')}`);
      if (outcome.needsSubmit) parts.push('Client Details must be submitted first (a fill never submits)');
      return `Draft Board Resolution: not generated yet; ${parts.join('; ')}.`;
    }
  }
}
