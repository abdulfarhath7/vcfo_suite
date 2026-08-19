/**
 * Pure fan-out rules for process emails + in-app notifications.
 * Kept free of `db` / Resend so tests can lock recipient targeting.
 */

export type FanoutParty = {
  userId: string;
  email: string;
  name: string;
};

export type FanoutRecipients = {
  client: FanoutParty | null;
  clients: FanoutParty[];
  lead: FanoutParty | null;
  leads: FanoutParty[];
  manager: FanoutParty | null;
  /** All PMs (membership + primary). Prefer this over `manager` alone. */
  managers: FanoutParty[];
  /** Firm admins / super admins. */
  admins: FanoutParty[];
  /** Extra CC from the engagement / env (client-facing mail). */
  progressCc?: string[];
};

export type EngagementProcessEvent =
  | 'client_submitted'
  | 'client_uploaded'
  | 'lead_requested_review'
  | 'review_accepted'
  | 'review_rejected'
  | 'delivered'
  | 'unlocked'
  | 'docs_shared'
  | 'board_resolution_shared'
  | 'request_created';

export type StaffEmailTarget = {
  email: string;
  href: string;
  label: 'lead' | 'manager';
};

function uniqueParties(parties: Array<FanoutParty | null | undefined>): FanoutParty[] {
  const out: FanoutParty[] = [];
  const seen = new Set<string>();
  for (const party of parties) {
    if (!party?.userId || seen.has(party.userId)) continue;
    seen.add(party.userId);
    out.push(party);
  }
  return out;
}

export function collectLeadParties(recipients: FanoutRecipients): FanoutParty[] {
  return uniqueParties(
    recipients.leads.length > 0
      ? recipients.leads
      : recipients.lead
        ? [recipients.lead]
        : [],
  );
}

export function collectManagerParties(recipients: FanoutRecipients): FanoutParty[] {
  return uniqueParties(
    recipients.managers.length > 0
      ? recipients.managers
      : recipients.manager
        ? [recipients.manager]
        : [],
  );
}

export function collectAdminParties(recipients: FanoutRecipients): FanoutParty[] {
  return uniqueParties(recipients.admins ?? []);
}

function clientEmailSet(recipients: FanoutRecipients): Set<string> {
  const emails = [
    ...recipients.clients.map((c) => c.email.trim().toLowerCase()),
    recipients.client?.email?.trim().toLowerCase(),
  ].filter((e): e is string => Boolean(e));
  return new Set(emails);
}

/** CC on manager → client approval: firm admins + project leads (not the client). */
export function approvalCcEmails(
  recipients: FanoutRecipients,
  opts?: { excludeEmails?: string[] },
): string[] {
  const exclude = new Set(
    [
      ...clientEmailSet(recipients),
      ...(opts?.excludeEmails ?? []).map((e) => e.trim().toLowerCase()),
    ].filter(Boolean),
  );
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (party: FanoutParty | null | undefined) => {
    const addr = party?.email?.trim();
    if (!addr) return;
    const key = addr.toLowerCase();
    if (exclude.has(key) || seen.has(key)) return;
    seen.add(key);
    out.push(addr);
  };
  for (const admin of collectAdminParties(recipients)) push(admin);
  for (const lead of collectLeadParties(recipients)) push(lead);
  for (const extra of recipients.progressCc ?? []) {
    const addr = extra.trim();
    if (!addr) continue;
    const key = addr.toLowerCase();
    if (exclude.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(addr);
  }
  return out;
}

/** Client → staff Resend (not Graph). */
export function emailsStaffViaResend(event: EngagementProcessEvent): boolean {
  return (
    event === 'client_submitted' ||
    event === 'client_uploaded' ||
    event === 'lead_requested_review'
  );
}

/** Lead/manager → client: in-app compose + Graph Mail.Send. */
export function opensClientOutgoingDraft(event: EngagementProcessEvent): boolean {
  return (
    event === 'review_accepted' ||
    event === 'review_rejected' ||
    event === 'delivered' ||
    event === 'unlocked' ||
    event === 'docs_shared' ||
    event === 'board_resolution_shared' ||
    event === 'request_created'
  );
}

/**
 * Who should receive Resend process mail.
 * Client submit/upload → every lead + every manager.
 * Intern request-approval → managers only (never Graph, never the client).
 */
export function staffEmailTargetsForEvent(
  event: EngagementProcessEvent,
  recipients: FanoutRecipients,
  hrefs: { leadHref: string; managerHref: string },
): StaffEmailTarget[] {
  if (!emailsStaffViaResend(event)) return [];

  const clientEmails = clientEmailSet(recipients);
  const targets: StaffEmailTarget[] = [];
  const seen = new Set<string>();

  const push = (party: FanoutParty | null | undefined, href: string, label: 'lead' | 'manager') => {
    const addr = party?.email?.trim();
    if (!addr) return;
    const key = addr.toLowerCase();
    if (clientEmails.has(key) || seen.has(key)) return;
    seen.add(key);
    targets.push({ email: addr, href, label });
  };

  if (event !== 'lead_requested_review') {
    for (const lead of collectLeadParties(recipients)) {
      push(lead, hrefs.leadHref, 'lead');
    }
  }
  for (const manager of collectManagerParties(recipients)) {
    push(manager, hrefs.managerHref, 'manager');
  }

  return targets;
}
