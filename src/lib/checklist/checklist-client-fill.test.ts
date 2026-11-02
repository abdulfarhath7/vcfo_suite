import { describe, expect, it } from 'vitest';
import {
  buildClientFillRequest,
  canRequestClientFill,
  clientFillLabel,
  decideClientFillRequest,
  fulfillClientFillRequest,
  isClientFillAwaitingClient,
  isClientFillPending,
} from './checklist-client-fill';

const NOW = '2026-08-31T10:00:00.000Z';
const LATER = '2026-09-02T09:00:00.000Z';

function pending() {
  return buildClientFillRequest({
    requestedBy: 'lead-1',
    requestedByName: 'Lead',
    note: '  Need the parent entity papers  ',
    now: NOW,
  });
}

describe('buildClientFillRequest', () => {
  it('starts pending on the manager and trims the note', () => {
    const request = pending();
    expect(request.status).toBe('pending_manager');
    expect(request.requestedAt).toBe(NOW);
    expect(request.note).toBe('Need the parent entity papers');
    expect(request.sentToClientAt).toBeUndefined();
  });

  it('drops an empty note rather than storing blanks', () => {
    expect(buildClientFillRequest({ requestedBy: 'lead-1', note: '   ', now: NOW }).note)
      .toBeUndefined();
  });
});

describe('decideClientFillRequest', () => {
  it('approval stamps the send time so the client mail is accounted for', () => {
    const approved = decideClientFillRequest(pending(), {
      decision: 'approve',
      decidedBy: 'mgr-1',
      decidedByName: 'PM',
      now: LATER,
    });
    expect(approved.status).toBe('approved');
    expect(approved.sentToClientAt).toBe(LATER);
    expect(approved.decidedBy).toBe('mgr-1');
    // The lead's note survives the decision — it goes into the client email.
    expect(approved.note).toBe('Need the parent entity papers');
  });

  it('decline keeps the reason and never marks it sent', () => {
    const declined = decideClientFillRequest(pending(), {
      decision: 'decline',
      decidedBy: 'mgr-1',
      note: 'Ask after the KYC lands',
      now: LATER,
    });
    expect(declined.status).toBe('declined');
    expect(declined.decisionNote).toBe('Ask after the KYC lands');
    expect(declined.sentToClientAt).toBeUndefined();
  });
});

describe('canRequestClientFill', () => {
  it('allows a first ask and re-asking after a decline or a submit', () => {
    expect(canRequestClientFill(undefined)).toBe(true);
    expect(
      canRequestClientFill(
        decideClientFillRequest(pending(), {
          decision: 'decline',
          decidedBy: 'mgr-1',
          now: LATER,
        }),
      ),
    ).toBe(true);
    const approved = decideClientFillRequest(pending(), {
      decision: 'approve',
      decidedBy: 'mgr-1',
      now: LATER,
    });
    expect(canRequestClientFill(fulfillClientFillRequest(approved, LATER))).toBe(true);
  });

  it('blocks a duplicate ask while one is pending or with the client', () => {
    expect(canRequestClientFill(pending())).toBe(false);
    expect(
      canRequestClientFill(
        decideClientFillRequest(pending(), {
          decision: 'approve',
          decidedBy: 'mgr-1',
          now: LATER,
        }),
      ),
    ).toBe(false);
  });
});

describe('fulfillClientFillRequest', () => {
  it('closes an approved request when the client submits', () => {
    const approved = decideClientFillRequest(pending(), {
      decision: 'approve',
      decidedBy: 'mgr-1',
      now: NOW,
    });
    expect(fulfillClientFillRequest(approved, LATER)?.fulfilledAt).toBe(LATER);
  });

  it('leaves a pending or declined request untouched', () => {
    const stillPending = pending();
    expect(fulfillClientFillRequest(stillPending, LATER)).toBe(stillPending);
    expect(fulfillClientFillRequest(undefined, LATER)).toBeUndefined();
  });
});

describe('state readers', () => {
  it('labels each stage of the lifecycle', () => {
    expect(clientFillLabel(undefined)).toBeNull();
    expect(clientFillLabel(pending())).toBe('Awaiting manager approval');
    const approved = decideClientFillRequest(pending(), {
      decision: 'approve',
      decidedBy: 'mgr-1',
      now: NOW,
    });
    expect(clientFillLabel(approved)).toBe('Awaiting client');
    expect(clientFillLabel(fulfillClientFillRequest(approved, LATER))).toBe('Client submitted');
    expect(
      clientFillLabel(
        decideClientFillRequest(pending(), {
          decision: 'decline',
          decidedBy: 'mgr-1',
          now: NOW,
        }),
      ),
    ).toBe('Request declined');
  });

  it('separates pending-on-manager from waiting-on-client', () => {
    const request = pending();
    expect(isClientFillPending(request)).toBe(true);
    expect(isClientFillAwaitingClient(request)).toBe(false);
    const approved = decideClientFillRequest(request, {
      decision: 'approve',
      decidedBy: 'mgr-1',
      now: NOW,
    });
    expect(isClientFillPending(approved)).toBe(false);
    expect(isClientFillAwaitingClient(approved)).toBe(true);
    expect(isClientFillAwaitingClient(fulfillClientFillRequest(approved, LATER))).toBe(false);
  });
});
