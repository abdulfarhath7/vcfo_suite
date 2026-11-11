import { ASSIST_AGENT_RUN_CLOSED, type AssistAgentRunView, type AssistAttestationCheck, type AssistAttestationChecks } from './types';

/**
 * THE CERTIFIER'S DUE-DILIGENCE GATE (SAFETY.md G17). Pure rules, shared by the route, the
 * repository and the staff page.
 *
 * Before the VCFO Assist side panel shows "You do this: Submit and Pay", a staff member who can
 * reach the engagement records, in Suite, the checks the certifying professional made personally.
 * The legal review (docs/specs/mca-connect/reports/VCFO Assist legal review.md, risk 1) found that
 * firms are disciplined for ticking "personally visited" or "signed in my presence" because a tool
 * made filing fast, so nothing here ticks a box by itself: every check arrives from a person's own
 * click in the dialog, and the server only checks that the required ones are present.
 *
 * Which checks a run needs depends on its form. Every form needs the field check. SPICe+ Part B
 * (the incorporation form, which carries the registered office and the subscribers) also needs the
 * registered-office check and the subscriber-signature check.
 */

export interface AttestationCheckSpec {
  id: AssistAttestationCheck;
  /** The sentence the certifier confirms. */
  label: string;
  /** For a check with two ways to satisfy it: the choices, each a full sentence. */
  options?: ReadonlyArray<{ value: string; label: string }>;
}

export const ATTESTATION_CHECK_SPECS: Readonly<Record<AssistAttestationCheck, AttestationCheckSpec>> = {
  fieldsCheckedAgainstRecords: {
    id: 'fieldsCheckedAgainstRecords',
    label: 'I checked every filled field against the original records.',
  },
  registeredOffice: {
    id: 'registeredOffice',
    label: 'Registered office',
    options: [
      { value: 'visited', label: 'I personally visited the registered office.' },
      { value: 'owner_noc', label: "I hold the owner's NOC for the registered office." },
    ],
  },
  subscriberSignatures: {
    id: 'subscriberSignatures',
    label: 'Subscriber signatures',
    options: [
      { value: 'in_presence', label: 'Each subscriber signed in my presence.' },
      { value: 'video_kyc', label: 'Each subscriber signed through a recorded video-KYC.' },
    ],
  },
};

/** The sub-agents whose form carries the registered office and the subscribers (Part B). */
const INCORPORATION_FORMS = new Set(['spice-b']);

/** The checks a run of this sub-agent must carry before its Submit card may appear. */
export function requiredAttestationChecks(subAgent: string): AssistAttestationCheck[] {
  return INCORPORATION_FORMS.has(subAgent)
    ? ['fieldsCheckedAgainstRecords', 'registeredOffice', 'subscriberSignatures']
    : ['fieldsCheckedAgainstRecords'];
}

/** The required checks that are not satisfied, in order; empty means the attestation is complete. */
export function missingAttestationChecks(subAgent: string, checks: AssistAttestationChecks): AssistAttestationCheck[] {
  return requiredAttestationChecks(subAgent).filter((id) => {
    if (id === 'fieldsCheckedAgainstRecords') return checks.fieldsCheckedAgainstRecords !== true;
    return !checks[id];
  });
}

/**
 * Run states in which the form has been filled and Submit has not happened yet. An attestation
 * before the fill would confirm a form nobody has seen, so it is refused outside these.
 */
export const ATTESTABLE_STATES: ReadonlySet<string> = new Set(['CHECK', 'DOWNLOAD', 'WAIT_DSC', 'ATTACH', 'RECHECK', 'WAIT_SUBMIT_PAY']);

/**
 * The certifier rule. By default the person who ran the agent may also record the certifier's
 * checks (a small firm often has one CA doing both, and the checks are still that person's own
 * acts). When the firm setting `assistCertifierMustDiffer` is on, the certifier must be a
 * different Suite user from the filer.
 */
export function certifierAllowed(input: { certifierId: string; filerId: string | null; mustDiffer: boolean }): boolean {
  if (!input.mustDiffer) return true;
  return input.certifierId !== input.filerId;
}

/** True while the run is filled, still open and has no certifier's checks: the side panel is waiting. */
export function runAwaitsAttestation(run: Pick<AssistAgentRunView, 'attestation' | 'status' | 'state'>): boolean {
  return !run.attestation && !ASSIST_AGENT_RUN_CLOSED.has(run.status) && ATTESTABLE_STATES.has(run.state);
}
