# AWS EUM WhatsApp — build plan

Step 1 deliverable for `docs/AWS-EUM-WHATSAPP-CONTEXT.md`: add AWS End User
Messaging (Social) as a second WhatsApp transport behind a `WHATSAPP_PROVIDER`
switch, mirroring how email already switches between `resend` and `ses`.
Everything below is read from the repo at `421e5e6` and from the installed SDK,
not from the brief.

Baseline gate: `npm run typecheck` reports only the pre-existing
`drizzle.config.ts(1,10): TS2305 'defineConfig'` error (installed
`drizzle-kit@0.18.1` ships no `defineConfig`); `npm run test` 101 files / 902
tests green; `npm run lint` 0 errors, 528 pre-existing warnings.

## 1. File inventory — what exists and what moves

| File | Role today | Change |
|---|---|---|
| `src/lib/notify/types.ts` | `NOTIFY_EVENTS`, `NotifyRecipient`, `NotifyVariables`, `SkipReason`, `DeliveryStatus` | Comments only — generalise "Twilio Content Template" to "provider template". Types unchanged. |
| `src/lib/notify/phone.ts` | E.164 validation, `withWhatsAppPrefix`/`stripWhatsAppPrefix`, opt-out keywords | **Add** `toMetaPhone` (digits only, no `+`, no prefix). Twilio helpers untouched. |
| `src/lib/notify/channels.ts` | `resolveWhatsAppChannel` (pure guards), `isWhatsAppConfigured`, `readWhatsAppConfig`, `WhatsAppConfig` | Rename decision field `templateSid` → `templateRef`. Config gains a provider discriminator + an EUM branch; Twilio fields stay. `isWhatsAppConfigured` becomes provider-aware. Guard order unchanged. |
| `src/lib/notify/templates.ts` | `readTemplateSids`, `orderedVariables`, `buildContentVariables`, `sanitizeVariable`, `firstNameOf` | **Add** `readTemplateNames` (EUM, default = event name) and `buildTemplateComponents` (Meta components array) beside the Twilio builders. `orderedVariables` is the shared source of truth for both. |
| `src/lib/notify/send-whatsapp.ts` | `sendWhatsAppTemplate` (Twilio internals), `isRetryableTwilioCode`, `queueWhatsAppSend(s)` | Becomes a **dispatcher**: resolve provider → `sendViaTwilio` or `sendViaEum`. Signature and never-throws contract unchanged. Queue helpers unchanged. |
| `src/lib/notify/send-whatsapp-twilio.ts` | — | **New.** The current Twilio body, extracted byte-for-byte. |
| `src/lib/notify/send-whatsapp-eum.ts` | — | **New.** `sendViaEum` on `SendWhatsAppMessageCommand`. |
| `src/lib/notify/whatsapp-retry.ts` | — | **New.** `isRetryableWhatsAppError(provider, code)`, wrapping the existing Twilio code set and adding the EUM/Meta set. |
| `src/lib/notify/twilio-webhook.ts` | Twilio signature validation | Untouched. |
| `src/lib/notify/aws-sns-verify.ts` | — | **New.** SNS message signature verification + subscription-confirmation handling. |
| `src/jobs/whatsapp-send.ts` | Inngest `whatsapp/send.requested`, retries 3, re-reads consent, records delivery | One-line swap: `isRetryableTwilioCode` → provider-aware check. Structure, guards, consent re-read unchanged. |
| `app/api/webhooks/twilio/{status,inbound}/route.ts` | Twilio webhooks | Untouched, still selectable via `WHATSAPP_PROVIDER=twilio`. |
| `app/api/webhooks/aws-eum/route.ts` | — | **New.** SNS handshake + verified status/opt-out handling. |
| `src/db/repositories/notification-deliveries.ts` | `systemRecordDelivery`, `systemUpdateDeliveryByProviderId` | Untouched. `templateSid` / `providerMessageId` are text columns and are reused. |
| `src/db/repositories/profiles.ts` | `systemGetNotifyRecipient`, `systemMarkWhatsAppStatus`, `systemRecordWhatsAppOptOut` | Untouched. |
| `.env.example` | Twilio block | **Add** an EUM block; Twilio block left intact. |

Twilio really does appear in only four places, as the context doc predicted:
the transport internals, `twilio-webhook.ts`, the two webhook routes, and the
config/env reads. Everything else is already provider-neutral.

## 2. Diff surface — what a reviewer will see

- **Behaviour-preserving (Step 2):** one file split in two, one field renamed
  across three files. No test should change meaning; the existing 902 stay green.
- **Additive (Steps 3-5):** four new `src/lib/notify/*` files, one new route,
  one new dependency, new unit tests. Nothing existing is deleted.
- **Not touched at all:** `src/lib/email/*`, the six event call-sites
  (`app/api/engagements/route.ts`, `src/lib/email/notify-engagement-event.ts`,
  `src/jobs/compliance-generate.ts`), the notification contract, both
  repositories, the DB schema.

## 3. Verified SDK shapes

`@aws-sdk/client-socialmessaging@3.1127.0` is installed (with
`--legacy-peer-deps`, because the repo's pre-existing
`eslint-plugin-jsx-a11y` / `eslint@10` peer conflict blocks a plain install —
unrelated to this package). Checked against `dist-types`, the intended design
in the context doc is exactly right:

```
SendWhatsAppMessageInput {
  originationPhoneNumberId: string   // phone-number-id-0123...
  message: Uint8Array                // bytes of the Cloud API JSON payload
  metaApiVersion: string             // "v{N}", e.g. v21.0
}
SendWhatsAppMessageOutput { messageId?: string }   // the wamid
```

Exception classes available for the retry map: `AccessDeniedByMetaException`,
`AccessDeniedException`, `DependencyException`, `InvalidParametersException`,
`LimitExceededException`, `ThrottledRequestException`, `ValidationException`,
`InternalServiceException`, `ResourceNotFoundException`.

Retry decision, matching the context doc's intent:

| Non-retryable (return `failed`, stop) | Retryable (throw, let Inngest back off) |
|---|---|
| `ValidationException`, `InvalidParametersException`, `ResourceNotFoundException`, `AccessDeniedException`, `AccessDeniedByMetaException` | `ThrottledRequestException`, `LimitExceededException`, `InternalServiceException`, `DependencyException` |
| Meta codes: 131026 undeliverable / not a WhatsApp user, 131047 re-engagement window, 131049 per-user marketing limit, 132000-132015 template not found / paused / rejected / param mismatch, 100 invalid parameter | Meta codes: 130429 rate limit, 131048 spam rate limit, 133016 temporary block, 1 / 2 transient API error |

Unknown code → retryable, matching the existing Twilio default.

## 4. Env additions

Added under a new "AWS End User Messaging (Social)" block; the Twilio block is
left exactly as it is.

```
WHATSAPP_ENABLED=false
WHATSAPP_PROVIDER="twilio"        # "aws_eum" | "twilio"

SOCIAL_MESSAGING_REGION=""        # falls back to AWS_REGION
EUM_PHONE_NUMBER_ID=""            # origination phone number id
WHATSAPP_TEMPLATE_LANG="en"
META_API_VERSION="v21.0"
AWS_EUM_SNS_WEBHOOK_URL="https://your-host/api/webhooks/aws-eum"
AWS_EUM_SNS_TOPIC_ARN=""          # optional: pin the topic the route accepts
# WHATSAPP_TEMPLATE_NAME_<EVENT>  # only when a WABA template name differs from the event name
```

`WHATSAPP_PROVIDER` ships defaulting to `twilio`, not `aws_eum`. Until the
out-of-band setup below is done there is no registered EUM number, so
defaulting to EUM would turn every send into a `disabled` skip. Flip the
default in the same change that lands the phone number id.

## 5. Decisions taken on the open questions (§13 of the context doc)

Answered with defaults so the build could proceed; each is one line to change.

1. **Region** — not hardcoded. `SOCIAL_MESSAGING_REGION` falls back to
   `AWS_REGION`. It need not match `SES_REGION`. **Owner must confirm EUM Social
   is available in the chosen region.**
2. **SNS, not EventBridge** — as the context doc assumed. One HTTPS route.
3. **Twilio kept as a permanent fallback**, not retired. No date set.
4. **`en` only**, via `WHATSAPP_TEMPLATE_LANG`. Per-client regional variants
   would need a per-recipient language column; not built.
5. **Reuse `templateSid`** for the Meta template name rather than adding a
   `template_name` column. The column is text and provider-neutral in the
   repository; a migration would buy clarity but touches the schema and needs a
   cross-tenant read test, for no behavioural gain.

## 6. Out-of-band setup (owner — the code is inert until these are done)

1. Under the existing verified Meta Business portfolio, create/attach the
   **transactional WABA + phone number**, separate from the DoubleTick number.
2. In the AWS End User Messaging (Social) console, link that WABA and register
   the number → copy the **origination phone number id** into
   `EUM_PHONE_NUMBER_ID`.
3. Get the six templates approved in WhatsApp Manager under names matching
   `NOTIFY_EVENTS` (`welcome`, `coi_issued`, `document_delivered`,
   `compliance_due_monthly`, `compliance_due_quarterly`, `compliance_overdue`),
   category **utility**, language `en`. Body variable order must match §5 of the
   context doc.
4. Create the **SNS topic** EUM publishes to; subscribe the HTTPS endpoint
   `…/api/webhooks/aws-eum`; confirm the subscription (the route handles the
   handshake automatically once deployed).
5. Attach an IAM policy allowing `social-messaging:SendWhatsAppMessage` to the
   App Runner / ECS role. No static keys.
6. Confirm EUM Social region availability, then set `WHATSAPP_PROVIDER=aws_eum`
   and `WHATSAPP_ENABLED=true`.

## 7. Build steps

Each ends with `npm run typecheck && npm run test && npm run lint` and a commit.

| Step | Content |
|---|---|
| 1 | This plan. |
| 2 | Refactor to the provider switch. No behaviour change; Twilio path only. |
| 3 | EUM config branch + `buildTemplateComponents` + unit tests. |
| 4 | `sendViaEum`, provider-aware retry map, dispatcher wiring, transport tests. |
| 5 | `app/api/webhooks/aws-eum/route.ts` + SNS signature verification + tests. |
| 6 | `.env.example`, `CLAUDE.md`, `docs/context` notes. |

---

## 8. Build record (all steps complete)

| Step | Commit | Content |
|---|---|---|
| 1 | `7a7c80a` | This plan; SDK installed and command shape verified. |
| 2 | `1205b81` | Twilio transport extracted behind a dispatcher. No behaviour change. |
| 3 | `5a27885` | EUM config branch, `buildTemplateComponents`, provider-aware `isWhatsAppConfigured`. |
| 4 | `f7766e4` | `sendViaEum`, `isRetryableWhatsAppError`, dispatcher + job wiring. |
| 5 | `3d9d696` | `/api/webhooks/aws-eum` with real SNS signature verification. |
| 6 | this | `.env.example`, `CLAUDE.md`, `docs/context/{STATE,NOTES}.md`. |

### What landed

```
src/lib/notify/
  channels.ts               provider + EUM config branch, templateRefFor, guards (unchanged order)
  templates.ts              + readTemplateNames, buildTemplateComponents
  phone.ts                  + toMetaPhone, fromMetaPhone
  send-whatsapp.ts          dispatcher (was the Twilio transport)
  send-whatsapp-shared.ts   NEW  result/deps types, mirrors send-email-shared.ts
  send-whatsapp-twilio.ts   NEW  the old body, verbatim
  send-whatsapp-eum.ts      NEW  SendWhatsAppMessageCommand
  whatsapp-retry.ts         NEW  provider-aware retry decision
  aws-sns-verify.ts         NEW  SNS canonical string + RSA verification
  eum-events.ts             NEW  pure parser for the nested SNS payload
app/api/webhooks/aws-eum/route.ts   NEW
src/jobs/whatsapp-send.ts   one line: provider-aware retryable check
```

Seven test files, 60 tests, added alongside. The notify layer had none before.

### Acceptance criteria

| Criterion | Status |
|---|---|
| `typecheck && test && lint` green | Yes. Only the pre-existing `drizzle.config.ts` error; 108 files / 963 tests; 0 lint errors, 528 pre-existing warnings. |
| `WHATSAPP_PROVIDER=twilio` byte-for-byte unchanged | Yes. The transport body moved verbatim; the dispatcher adds only the guard call that was already there. Covered by `send-whatsapp.test.ts`. |
| `WHATSAPP_PROVIDER=aws_eum` sends all six events, records `queued` with the wamid | Yes, over an injected client — `send-whatsapp-eum.test.ts` asserts the exact Cloud API payload, and `templates.test.ts` proves both providers serialise the same ordered variables for all six events. Not yet exercised against real AWS: that needs §6. |
| SNS webhook advances delivered / read / failed | Yes — `aws-eum-route.test.ts`. |
| `WHATSAPP_ENABLED=false` records `skipped/disabled`, no provider call, either provider | Yes — one test per provider. |
| No new `db` import outside the repository layer | Yes. The route calls the two existing documented system writers; no repository was changed. |
| Email untouched and passing | Yes. No file under `src/lib/email/` was modified. |

### Still to do (owner)

The six out-of-band items in §6. Until the WABA number is registered and
`EUM_PHONE_NUMBER_ID` is set, the EUM path records `skipped/disabled` and makes
no AWS call — which is why `WHATSAPP_PROVIDER` ships as `twilio`.

Also worth deciding: whether `SOCIAL_MESSAGING_REGION` should match
`SES_REGION` (not required, simpler if it does), and whether to retire Twilio
once EUM is proven, or keep it indefinitely as this build assumes.
