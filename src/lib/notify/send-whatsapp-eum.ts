import 'server-only';

import type { WhatsAppConfig } from '@/lib/notify/channels';
import { toMetaPhone } from '@/lib/notify/phone';
import { buildTemplateComponents } from '@/lib/notify/templates';
import type {
  EumSendMessage,
  SendWhatsAppDeps,
  WhatsAppSendResult,
} from '@/lib/notify/send-whatsapp-shared';
import type { NotifyEvent, NotifyVariables } from '@/lib/notify/types';

/**
 * AWS END USER MESSAGING (SOCIAL) WhatsApp transport.
 *
 * Sends on Meta's official Cloud API through AWS, so the Meta message fee and
 * the AWS per-message fee land on the same invoice as SES, RDS and S3. That
 * consolidated bill is the whole reason this transport exists.
 *
 * Contract, identical to the Twilio transport: NEVER throws. Every outcome
 * comes back as a value the caller writes to `notification_deliveries`.
 *
 * Credentials come from the App Runner / ECS instance role via the standard
 * AWS chain — the same way `sendViaSes` authenticates. No static keys, and the
 * client is constructed per call (injectable via `deps.createEumClient`) so
 * the SDK is never loaded until something actually sends.
 */

/** The Cloud API template payload EUM passes through to Meta verbatim. */
function buildMessagePayload(input: {
  config: WhatsAppConfig;
  event: NotifyEvent;
  variables: NotifyVariables;
  toPhone: string;
  templateRef: string;
}): Record<string, unknown> {
  const components = buildTemplateComponents(input.event, input.variables);
  return {
    messaging_product: 'whatsapp',
    // Meta wants bare digits: no '+', no 'whatsapp:' prefix.
    to: toMetaPhone(input.toPhone),
    type: 'template',
    template: {
      name: input.templateRef,
      language: { code: input.config.eum.templateLanguage },
      ...(components.length > 0 ? { components } : {}),
    },
  };
}

async function defaultCreateClient(config: WhatsAppConfig): Promise<EumSendMessage> {
  const { SocialMessagingClient, SendWhatsAppMessageCommand } = await import(
    '@aws-sdk/client-socialmessaging'
  );
  // Region omitted rather than blank so the standard AWS chain can resolve it.
  const client = new SocialMessagingClient(
    config.eum.region ? { region: config.eum.region } : {},
  );
  return async (params) => client.send(new SendWhatsAppMessageCommand(params));
}

/**
 * The classifier the retry map keys off. Prefers the SDK exception name, which
 * is stable across bundling, and falls back to a numeric Meta code when the
 * error carries one.
 */
function errorCodeOf(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;

  const candidate = err as { name?: unknown; code?: unknown; $metadata?: unknown };
  if (typeof candidate.code === 'number' || typeof candidate.code === 'string') {
    return String(candidate.code);
  }
  if (typeof candidate.name === 'string' && candidate.name !== 'Error') {
    return candidate.name;
  }
  return undefined;
}

export async function sendViaEum(input: {
  config: WhatsAppConfig;
  event: NotifyEvent;
  variables: NotifyVariables;
  toPhone: string;
  templateRef: string;
  deps?: SendWhatsAppDeps;
}): Promise<WhatsAppSendResult> {
  const { config, toPhone, templateRef } = input;

  // Belt and braces: the dispatcher's guards already skip an unconfigured
  // provider, so reaching here without a number id would be a wiring bug.
  // Mirrors `sendViaSes`'s console skip rather than throwing at the SDK.
  if (!config.eum.phoneNumberId.trim()) {
    console.log('[whatsapp:eum] skipped — no origination phone number id', input.event);
    return { ok: false, status: 'skipped', skipReason: 'disabled', templateRef, toPhone };
  }

  try {
    const send =
      (await input.deps?.createEumClient?.(config)) ?? (await defaultCreateClient(config));

    const result = await send({
      originationPhoneNumberId: config.eum.phoneNumberId,
      metaApiVersion: config.eum.metaApiVersion,
      message: new TextEncoder().encode(JSON.stringify(buildMessagePayload(input))),
    });

    const wamid = result?.messageId?.trim();
    if (!wamid) {
      // Accepted with no id means nothing to correlate the SNS status against.
      console.error('[whatsapp:eum] send returned no message id', input.event);
      return {
        ok: false,
        status: 'failed',
        error: 'eum_no_message_id',
        templateRef,
        toPhone,
      };
    }

    return {
      ok: true,
      status: 'queued',
      providerMessageId: wamid,
      templateRef,
      toPhone,
    };
  } catch (err) {
    const errorCode = errorCodeOf(err);
    const error = err instanceof Error ? err.message : 'whatsapp_send_failed';
    console.error('[whatsapp:eum] send failed', input.event, errorCode ?? '', error);
    return { ok: false, status: 'failed', error, errorCode, templateRef, toPhone };
  }
}
