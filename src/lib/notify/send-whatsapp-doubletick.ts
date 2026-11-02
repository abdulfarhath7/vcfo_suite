import 'server-only';

import { randomUUID } from 'node:crypto';
import type { WhatsAppConfig } from '@/lib/notify/channels';
import { toMetaPhone } from '@/lib/notify/phone';
import { buildTemplatePlaceholders } from '@/lib/notify/templates';
import type {
  SendWhatsAppDeps,
  WhatsAppSendResult,
} from '@/lib/notify/send-whatsapp-shared';
import type { NotifyEvent, NotifyVariables } from '@/lib/notify/types';

/**
 * DOUBLETICK WhatsApp transport.
 *
 * Sends one approved template from SBC's existing WhatsApp Business number
 * (the one the staff shared inbox already uses) through DoubleTick's public
 * API: `POST /whatsapp/message/template`, key in the `Authorization` header
 * with no "Bearer". https://docs.doubletick.io
 *
 * Contract: NEVER throws. Every outcome comes back as a value the caller
 * writes to `notification_deliveries`. The API key is never logged.
 *
 * We choose the `messageId` (a UUID v4) and send it, so the delivery row holds
 * the id DoubleTick's status webhook will report even if the response body is
 * empty.
 *
 * Error codes this returns (classified in `whatsapp-retry.ts`):
 *   doubletick_http_<status> — the API refused the request (401 bad key, 400
 *                              bad payload, 429 rate limit, 5xx outage…)
 *   doubletick_failed        — accepted, but DoubleTick marked the message FAILED
 *   doubletick_network       — no answer (timeout, DNS, connection reset)
 */

const TIMEOUT_MS = 15_000;

type DoubleTickMessageResult = {
  status?: string;
  messageId?: string;
  errorMessage?: string;
};

/** The request body: one message, one template, ordered placeholders. */
export function buildDoubleTickPayload(input: {
  config: WhatsAppConfig;
  event: NotifyEvent;
  variables: NotifyVariables;
  toPhone: string;
  templateRef: string;
  messageId: string;
}): Record<string, unknown> {
  const placeholders = buildTemplatePlaceholders(input.event, input.variables);
  return {
    messages: [
      {
        from: input.config.doubletick.fromNumber,
        // Bare digits with country code: 919876543210, 14155550123.
        to: toMetaPhone(input.toPhone),
        messageId: input.messageId,
        content: {
          templateName: input.templateRef,
          language: input.config.doubletick.templateLanguage,
          ...(placeholders.length > 0
            ? { templateData: { body: { placeholders } } }
            : {}),
        },
      },
    ],
  };
}

/** Reads `{status, messageId}` from either documented response shape. */
function firstMessageResult(body: unknown): DoubleTickMessageResult | null {
  if (!body || typeof body !== 'object') return null;
  const list = Array.isArray(body)
    ? body
    : Array.isArray((body as { messages?: unknown }).messages)
      ? (body as { messages: unknown[] }).messages
      : [body];
  const first = list[0];
  return first && typeof first === 'object' ? (first as DoubleTickMessageResult) : null;
}

/** A short, key-free reason from an error body: `message` may be a string or a list. */
function errorTextOf(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim().slice(0, 300);
    if (Array.isArray(message)) {
      const joined = message.filter((m) => typeof m === 'string').join('; ');
      if (joined.trim()) return joined.trim().slice(0, 300);
    }
    const reason = (body as { reason?: unknown }).reason;
    if (typeof reason === 'string' && reason.trim()) return reason.trim().slice(0, 300);
  }
  return fallback;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    return text.trim() ? (JSON.parse(text) as unknown) : null;
  } catch {
    return null;
  }
}

export async function sendViaDoubleTick(input: {
  config: WhatsAppConfig;
  event: NotifyEvent;
  variables: NotifyVariables;
  toPhone: string;
  templateRef: string;
  deps?: SendWhatsAppDeps;
}): Promise<WhatsAppSendResult> {
  const { config, toPhone, templateRef } = input;
  const dt = config.doubletick;

  // Belt and braces: the dispatcher's guards already skip an unconfigured
  // provider, so reaching here without a key or number is a wiring bug.
  if (!dt.apiKey.trim() || !dt.fromNumber.trim()) {
    console.log('[whatsapp:doubletick] skipped — no API key or business number', input.event);
    return { ok: false, status: 'skipped', skipReason: 'disabled', templateRef, toPhone };
  }

  const messageId = (input.deps?.newMessageId ?? randomUUID)();
  const doFetch = input.deps?.fetch ?? fetch;

  // A plain controller rather than AbortSignal.timeout, which not every
  // runtime (or test environment) provides.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await doFetch(`${dt.baseUrl}/whatsapp/message/template`, {
      method: 'POST',
      headers: {
        Authorization: dt.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(buildDoubleTickPayload({ ...input, messageId })),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const error = err instanceof Error ? err.message : 'network_error';
    console.error('[whatsapp:doubletick] no response', input.event, error);
    return { ok: false, status: 'failed', error, errorCode: 'doubletick_network', templateRef, toPhone };
  }

  const body = await readJson(response);
  clearTimeout(timer);

  if (!response.ok) {
    const errorCode = `doubletick_http_${response.status}`;
    const error = errorTextOf(body, `HTTP ${response.status}`);
    console.error('[whatsapp:doubletick] send refused', input.event, errorCode, error);
    return { ok: false, status: 'failed', error, errorCode, templateRef, toPhone };
  }

  const result = firstMessageResult(body);
  if (result?.status?.toUpperCase() === 'FAILED') {
    const error = result.errorMessage?.trim().slice(0, 300) || 'DoubleTick marked the message FAILED';
    console.error('[whatsapp:doubletick] message failed', input.event, error);
    return { ok: false, status: 'failed', error, errorCode: 'doubletick_failed', templateRef, toPhone };
  }

  return {
    ok: true,
    status: 'queued',
    providerMessageId: result?.messageId?.trim() || messageId,
    templateRef,
    toPhone,
  };
}
