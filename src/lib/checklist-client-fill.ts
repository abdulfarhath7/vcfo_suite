import type { ClientFillRequest } from '@/lib/checklist-state-key';

/**
 * "Request client to fill" lifecycle, kept pure so the rules are testable
 * without a database:
 *
 *   lead requests  → pending_manager  (manager gets an approval email)
 *   manager approves → approved       (client gets the step link, from the
 *                                      manager's own mailbox)
 *   manager declines → declined       (lead hears back, client never does)
 *   client submits   → approved + fulfilledAt
 *
 * The client is only ever told about an approved request.
 */

export type ClientFillDecision = 'approve' | 'decline';

export function isClientFillPending(request?: ClientFillRequest | null): boolean {
  return request?.status === 'pending_manager';
}

/** Approved and still waiting on the client — a decline or a submit both end this. */
export function isClientFillAwaitingClient(request?: ClientFillRequest | null): boolean {
  return request?.status === 'approved' && !request.fulfilledAt;
}

export function clientFillLabel(request?: ClientFillRequest | null): string | null {
  if (!request) return null;
  if (request.status === 'pending_manager') return 'Awaiting manager approval';
  if (request.status === 'declined') return 'Request declined';
  if (request.fulfilledAt) return 'Client submitted';
  return 'Awaiting client';
}

/** A second request is only allowed once the previous one is finished. */
export function canRequestClientFill(request?: ClientFillRequest | null): boolean {
  if (!request) return true;
  if (request.status === 'declined') return true;
  return request.status === 'approved' && Boolean(request.fulfilledAt);
}

export function buildClientFillRequest(input: {
  requestedBy: string;
  requestedByName?: string;
  note?: string;
  now: string;
}): ClientFillRequest {
  return {
    status: 'pending_manager',
    requestedBy: input.requestedBy,
    requestedByName: input.requestedByName?.trim() || undefined,
    requestedAt: input.now,
    note: input.note?.trim() || undefined,
  };
}

export function decideClientFillRequest(
  request: ClientFillRequest,
  input: {
    decision: ClientFillDecision;
    decidedBy: string;
    decidedByName?: string;
    note?: string;
    now: string;
  },
): ClientFillRequest {
  const decided = {
    ...request,
    decidedBy: input.decidedBy,
    decidedByName: input.decidedByName?.trim() || undefined,
    decidedAt: input.now,
    decisionNote: input.note?.trim() || undefined,
  };
  if (input.decision === 'decline') {
    return { ...decided, status: 'declined' };
  }
  return { ...decided, status: 'approved', sentToClientAt: input.now };
}

/** Client submitted the step — close out an approved request that is still open. */
export function fulfillClientFillRequest(
  request: ClientFillRequest | undefined,
  now: string,
): ClientFillRequest | undefined {
  if (!isClientFillAwaitingClient(request) || !request) return request;
  return { ...request, fulfilledAt: now };
}
