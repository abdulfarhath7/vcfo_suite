'use client';

import type { EmailDraftView } from '@/lib/email/email-edits';

/**
 * GL-07: open the "Send email" pop-up for a card action and resolve when the person sends or
 * cancels. The action's URL answers `{ draft }` to `{ ...body, preview: true }` and does the
 * action (and sends the edited email) for `{ ...body, email }`. Cancel sends nothing.
 */
export const SEND_EMAIL_EVENT = 'vcfo:send-email';

export interface SendEmailRequest {
  url: string;
  body?: Record<string, unknown>;
  /** The pop-up title, e.g. "Send the request list". */
  title?: string;
  /** The Send button's label. */
  sendLabel?: string;
  /** A draft the caller already fetched (to read a refusal itself); the pop-up then skips its own. */
  draft?: EmailDraftView;
}

export interface SendEmailOutcome<T = unknown> {
  sent: boolean;
  result?: T;
}

export interface SendEmailEventDetail {
  request: SendEmailRequest;
  resolve: (outcome: SendEmailOutcome) => void;
}

export function requestEmailSend<T = unknown>(request: SendEmailRequest): Promise<SendEmailOutcome<T>> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve({ sent: false });
    window.dispatchEvent(
      new CustomEvent<SendEmailEventDetail>(SEND_EMAIL_EVENT, { detail: { request, resolve: resolve as (o: SendEmailOutcome) => void } }),
    );
  });
}

export type { EmailDraftView };
