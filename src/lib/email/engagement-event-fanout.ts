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

function clientEmailSet(recipients: FanoutRecipients): Set<string> {
  const emails = [
    ...recipients.clients.map((c) => c.email.trim().toLowerCase()),
    recipients.client?.email?.trim().toLowerCase(),
  ].filter((e): e is string => Boolean(e));
  return new Set(emails);
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
