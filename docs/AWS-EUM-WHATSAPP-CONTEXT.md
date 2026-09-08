# AWS-EUM-WHATSAPP-CONTEXT.md — build the AWS End User Messaging (Social) WhatsApp transport

**For:** Claude Code, running inside the `vcfo_suite` repo (Next.js 16 · React 19 · Drizzle/Postgres · Auth.js · S3/MinIO · Inngest · Vitest · ESLint).
**Task type:** transport migration + provider switch. **Not** a rebuild, **not** new product surface.
**One-line goal:** add AWS End User Messaging (Social) as a WhatsApp transport alongside the existing Twilio transport, gated by a `WHATSAPP_PROVIDER` switch — mirroring exactly how email already switches between `resend` and `ses`.

Read this whole file before writing code. The seam already exists; your job is to slot a second transport into it without touching the notification contract, the email path, or any of the six event call-sites.

---

## 0. Why this exists (the decision — do not relitigate)

The finance requirement is **one consolidated bill**. Email is already moving Resend → **Amazon SES** (`@aws-sdk/client-sesv2` is installed; `EMAIL_PROVIDER=ses`). WhatsApp transactional should land on the **same AWS invoice** as SES + RDS + S3 + App Runner.

- **AWS End User Messaging (Social)** sends WhatsApp on Meta's official Cloud API and bills the Meta message fee + a small AWS per-message fee **on the AWS invoice**. Chosen for transactional/compliance notifications.
- **DoubleTick** stays exactly as-is on its **own owned number** for marketing/conversational. It is out of scope here — do not touch, reference, or route through it.
- **Twilio** scaffolding is **preserved as a fallback provider**, not deleted. The email layer keeps both `resend` and `ses`; we do the same for WhatsApp.
- WhatsApp remains a **nudge channel**. Email is the system of record. A WhatsApp skip/failure must never touch, slow, or downgrade the email path.

The transactional WhatsApp number is a **separate WABA phone number under the existing verified Meta Business portfolio** — distinct from the DoubleTick number. A number attaches to exactly one integration; this one attaches to EUM.

---

## 1. Global rules (apply to every step)

1. **Verification gate after every step:** `npm run typecheck && npm run test && npm run lint`. All three must pass before the commit for that step. Token/transport changes should not touch domain tests.
2. **Repository seam is sacred.** Only `src/db/repositories/*` imports `db`. The two documented system writers (`systemRecordDelivery`, `systemUpdateDeliveryByProviderId`) and the recipient/profile readers stay in the repository layer. Do not add a new `db` import anywhere else.
3. **Do not change the notification contract.** `src/lib/notify/types.ts` (`NOTIFY_EVENTS`, `NotifyEvent`, `NotifyRecipient`, `NotifyVariables`, `SkipReason`, `DeliveryStatus`) is transport-agnostic and stays the source of truth. The six events do not change. Comments that say "Twilio" get generalised to "WhatsApp provider"; the types themselves do not.
4. **Do not touch the email path.** `src/lib/email/*` is untouched except that you may read `send-email.ts` / `send-via-ses.ts` as the pattern to copy.
5. **Do not touch the six event call-sites.** They already call `queueWhatsAppSend(s)` with the correct event + variables. They must keep compiling and behaving identically:
   - `app/api/engagements/route.ts` → `welcome` (on project creation)
   - `src/lib/email/notify-engagement-event.ts` → `coi_issued`, `document_delivered`
   - `src/jobs/compliance-generate.ts` → `compliance_due_monthly`, `compliance_due_quarterly`, `compliance_overdue`
6. **Never throw from a transport.** Every outcome (sent / skipped / failed) is a value the caller writes to `notification_deliveries`. Missing config = console-skip, exactly like `sendViaSes` when `EMAIL_FROM` is empty.
7. **Consent is re-read at send time** in the Inngest job (`whatsappOptInAt` / `whatsappOptOutAt`). Do not trust the queued payload for consent. Do not weaken the guard order.
8. **DPDP:** consent timestamps and purpose limitation are the firm's own legal obligation, not a vendor feature. Keep the opt-in/opt-out re-read and the outbound-only posture. Never put sensitive values (CIN/PAN/TAN, filing numbers, passwords, OTPs, document contents) into a template variable — the existing `sanitizeVariable` clamp (collapse whitespace, 120-char cap) stays.
9. **Outbound-only.** The inbound webhook handles exactly one thing: opt-out keywords → stamp `whatsapp_opt_out_at`. No chat, no threading, no persisting inbound bodies.
10. **Kill switch preserved.** `WHATSAPP_ENABLED=false` (default) keeps the entire feature inert regardless of provider — every attempt recorded as `skipped/disabled`, no AWS or Twilio call made.
11. **Report before large edits.** Steps that refactor shared files (Step 2) commit on their own so a diff is reviewable before the EUM transport lands.

---

## 2. Current state — what already exists (read these first)

The Twilio WhatsApp feature is complete and well-factored. Map it before changing it:

| File | Role | Transport-specific? |
|---|---|---|
| `src/lib/notify/types.ts` | Events, recipient shape, variables, statuses | **No — keep as-is** (generalise Twilio wording in comments only) |
| `src/lib/notify/phone.ts` | E.164 validation, opt-out keyword, `withWhatsAppPrefix`/`stripWhatsAppPrefix` | Mostly agnostic; the `whatsapp:` prefix is Twilio-shaped (see §6) |
| `src/lib/notify/channels.ts` | `resolveWhatsAppChannel` (**pure guards**), `isWhatsAppConfigured`, `readWhatsAppConfig`, `WhatsAppConfig` | Guards agnostic; **config shape + env reads are Twilio-specific** |
| `src/lib/notify/templates.ts` | Event → template ref + ordered variables (`buildContentVariables`) | Twilio Content API positional JSON — **needs an EUM variant** |
| `src/lib/notify/send-whatsapp.ts` | `sendWhatsAppTemplate` (**Twilio transport**), `queueWhatsAppSend(s)` | Queue helpers agnostic (**keep**); transport internals Twilio (**extract + add EUM**) |
| `src/lib/notify/twilio-webhook.ts` | Twilio signature validation | Twilio-only (**keep for Twilio; add SNS verifier for EUM**) |
| `src/jobs/whatsapp-send.ts` | Inngest fn `whatsapp/send.requested`, retries 3, re-reads consent, records delivery | **Keep structure**; only the transport call + retryable-code check swap |
| `app/api/webhooks/twilio/status/route.ts` | Twilio status → update delivery, mark number | Twilio-only (**keep; add EUM webhook route**) |
| `app/api/webhooks/twilio/inbound/route.ts` | Twilio inbound → opt-out only | Twilio-only (**keep; add EUM webhook route**) |
| `src/db/repositories/notification-deliveries.ts` | `systemRecordDelivery`, `systemUpdateDeliveryByProviderId`, `RecordDeliveryInput` | Agnostic — `templateSid`/`providerMessageId` columns are text (**reuse; see §6 note**) |
| `src/db/repositories/profiles.ts` | `systemGetNotifyRecipient`, `systemMarkWhatsAppStatus`, `systemRecordWhatsAppOptOut` | **Agnostic — keep** |

The insight: Twilio appears in only **four** places — `send-whatsapp.ts` (transport internals), `twilio-webhook.ts`, the two `app/api/webhooks/twilio/*` routes, and the config/env in `channels.ts` + `.env.example`. Everything else is provider-neutral.

---

## 3. Target architecture — mirror the email provider switch

`src/lib/email/send-email.ts` resolves `EMAIL_PROVIDER` and dispatches to `sendViaSes` or `sendViaResend`. Do the identical thing for WhatsApp:

```
WHATSAPP_PROVIDER = "aws_eum" (default once ready) | "twilio"
```

- Extract the current Twilio body of `sendWhatsAppTemplate` into `src/lib/notify/send-whatsapp-twilio.ts` (`sendViaTwilio`). Behaviour unchanged.
- Add `src/lib/notify/send-whatsapp-eum.ts` (`sendViaEum`) — the new AWS transport.
- `sendWhatsAppTemplate` in `send-whatsapp.ts` becomes a thin dispatcher: resolve provider, call the right transport. It keeps its exact current signature and its never-throws contract, so `whatsapp-send.ts` and the queue helpers do not change.
- `queueWhatsAppSend` / `queueWhatsAppSends` are unchanged (provider-neutral).

`resolveWhatsAppChannel` stays a pure guard and keeps returning a **provider-neutral template reference**. Today it returns `templateSid`; generalise the returned field to a neutral name (e.g. `templateRef`) that:
- for Twilio = the Content Template SID (from `WHATSAPP_TEMPLATE_<EVENT>`),
- for EUM = the approved Meta **template name** (default to the event name itself; see §5).

Keep the guard **order** identical: `disabled → no_template → no_phone → no_consent → opted_out`.

Delivery events for EUM arrive via **Amazon SNS** (EUM publishes WhatsApp message-status and inbound events to an SNS topic). Add one route, `app/api/webhooks/aws-eum/route.ts`, that:
1. handles the SNS `SubscriptionConfirmation` handshake,
2. **verifies the SNS message signature** (do not trust the body unverified),
3. maps Meta message status → `DeliveryStatus` and calls `systemUpdateDeliveryByProviderId(wamid, …)`,
4. detects opt-out (STOP/UNSUBSCRIBE) inbound messages → `systemRecordWhatsAppOptOut(fromE164)`,
5. never persists inbound message bodies.

---

## 4. AWS EUM technical notes (verify against installed SDK types before relying on shapes)

- **SDK:** add `@aws-sdk/client-socialmessaging`. Client `SocialMessagingClient`; command `SendWhatsAppMessageCommand`. **Confirm exact input/output field names against `node_modules/@aws-sdk/client-socialmessaging` types** and adjust — treat the shapes below as the intended design, not gospel.
- **Send call (intended shape):**
  ```
  new SendWhatsAppMessageCommand({
    originationPhoneNumberId,      // EUM-registered phone number id for the transactional WABA number
    metaApiVersion: "v21.0",       // pin a version; make it env-configurable
    message: <bytes of the WhatsApp Cloud API JSON payload>,
  })
  ```
  Response carries the Meta message id (**wamid**) → store as `providerMessageId`.
- **The `message` payload** is the standard WhatsApp Cloud API **template** body, serialised to bytes:
  ```json
  {
    "messaging_product": "whatsapp",
    "to": "919876543210",
    "type": "template",
    "template": {
      "name": "compliance_due_monthly",
      "language": { "code": "en" },
      "components": [
        { "type": "body", "parameters": [
          { "type": "text", "text": "Acme Pvt Ltd" },
          { "type": "text", "text": "GSTR-3B" },
          { "type": "text", "text": "20 Apr 2026" }
        ] }
      ]
    }
  }
  ```
- **Credentials:** IAM via the App Runner / ECS instance role — same chain as `sendViaSes`, **no static keys in the bundle**. Required action: `social-messaging:SendWhatsAppMessage` (least-privilege policy on that role). SNS subscription confirmation needs the route reachable; no extra app credentials.
- **Region:** set `SOCIAL_MESSAGING_REGION` (fall back to `AWS_REGION`). **Confirm EUM Social is available in the chosen region** — it need not match `SES_REGION`, but the WABA registration and the SNS topic must be in the same region as the EUM client. Flag to the owner if the preferred region is unsupported.
- **Retryable vs non-retryable:** replace `isRetryableTwilioCode` usage with a provider-aware `isRetryableWhatsAppError`. For EUM/Meta, treat as **non-retryable**: template not found/paused/rejected, invalid recipient / not a WhatsApp user, recipient opted out, re-engagement outside allowed window. Treat as **retryable** (throw so Inngest backs off): rate-limit, transient/internal, throttling. Keep Twilio's existing code set for the Twilio path.
- **`to` formatting:** Meta expects digits with country code and **no `+` and no `whatsapp:` prefix** (e.g. `919876543210`). Do **not** apply Twilio's `withWhatsAppPrefix` on the EUM path. Add an EUM-specific formatter (strip `+`/prefix, keep digits) in `phone.ts` or the EUM transport; keep `withWhatsAppPrefix` for Twilio.

---

## 5. The six messages (unchanged set — this is what gets sent)

All six are Meta category **utility**, all **outbound-only**, all pre-approved templates. The event names double as the EUM template names (approve them in WhatsApp Manager under these exact names). Variable order below is the source of truth and must match each approved template body.

| Event | Fires when | Recipient | Body variables (in order) |
|---|---|---|---|
| `welcome` | Project/engagement created | Client | 1 first name · 2 company name |
| `coi_issued` | Certificate of Incorporation delivered (Pre-12) | Client | 1 company name |
| `document_delivered` | A staff "Deliver" releases a document/step to the client | Client | 1 company name · 2 step title |
| `compliance_due_monthly` | Monthly obligation approaching (from compliance calendar) | Client | 1 company name · 2 obligation name · 3 due date |
| `compliance_due_quarterly` | Quarterly obligation approaching | Client | 1 company name · 2 obligation name · 3 due date |
| `compliance_overdue` | Obligation past due | Client | 1 company name · 2 obligation name |

Rules that carry over verbatim:
- No template configured for an event → **skip with `no_template`**, never a free-form fallback.
- Variables are short, non-sensitive strings only. Keep `sanitizeVariable` (collapse whitespace, clamp 120 chars). First-name greeting uses `firstNameOf`.
- Build the EUM `components` array from the **same** `orderedVariables(event, vars)` you already have in `templates.ts` — add a `buildTemplateComponents(event, vars)` beside `buildContentVariables` (Twilio) rather than replacing it. Same ordered values, different serialisation (Meta components array vs Twilio positional JSON).

---

## 6. Notes on reused pieces

- **`notification_deliveries` columns are text**, not enums. Reuse them: store the Meta template name in the existing `templateSid` column (or add a nullable `template_name` column via a Drizzle migration if you prefer clarity — if you add a column, migration + a cross-tenant read test, and keep `templateSid` working for Twilio). Store the **wamid** in `providerMessageId`. The status webhook already keys updates off `providerMessageId` — EUM's wamid flows through the same path.
- **`DeliveryStatus`** (`queued|sent|delivered|read|failed|skipped`) already covers Meta's statuses. Map `sent`→sent, `delivered`→delivered, `read`→read, `failed`→failed.
- **Opt-out** reuses `systemRecordWhatsAppOptOut` and `isOptOutKeyword`. **Failed/verified number marking** reuses `systemMarkWhatsAppStatus`.

---

## 7. Out-of-band setup (cannot be done in code — list for the owner, do not attempt)

Produce these as a checklist in the PR description; the app changes are inert until they're done:
1. Under the **existing verified Meta Business portfolio**, create/attach the **transactional WABA + phone number** (separate from the DoubleTick number).
2. In the **AWS End User Messaging (Social)** console, link that WABA and register the phone number → obtain the **origination phone number id**.
3. Get the six templates **approved** in WhatsApp Manager under names matching `NOTIFY_EVENTS` (`welcome`, `coi_issued`, …), category **utility**, language `en` (or set `WHATSAPP_TEMPLATE_LANG`).
4. Create the **SNS topic** EUM publishes events to; subscribe the HTTPS endpoint `…/api/webhooks/aws-eum`; confirm the subscription.
5. Attach the **IAM policy** (`social-messaging:SendWhatsAppMessage`) to the App Runner/ECS role.
6. Confirm **EUM Social region availability** for the chosen region.

---

## 8. Ordered build steps (each ends with the gate + a commit)

**Step 1 — Report.** Produce `AWS-EUM-WHATSAPP-PLAN.md`: the file inventory (from §2), the exact diff surface, the env additions, and the out-of-band checklist (§7). No code yet. Commit. *(Stop-and-confirm: let the owner read the plan before transport code lands.)*

**Step 2 — Refactor to a provider switch (no behaviour change).**
- Extract Twilio transport → `send-whatsapp-twilio.ts` (`sendViaTwilio`), keep byte-for-byte behaviour.
- Add `resolveWhatsAppProvider()` + make `sendWhatsAppTemplate` a dispatcher (Twilio path only, for now).
- Generalise `resolveWhatsAppChannel` return field `templateSid` → `templateRef` (update `channels.ts`, `send-whatsapp.ts`, and tests). Twilio still passes; EUM not added yet.
- Generalise Twilio-specific wording in `types.ts` comments.
- Gate. Commit. **All existing tests must still pass** — this step changes structure, not behaviour.

**Step 3 — EUM config + template components.**
- Extend `WhatsAppConfig`/`readWhatsAppConfig` with an EUM branch: `provider`, `phoneNumberId`, `templateLanguage`, `metaApiVersion`, `region`, plus a template-name map (default = event name). Keep Twilio fields intact.
- `isWhatsAppConfigured` becomes provider-aware (EUM configured = enabled + provider=aws_eum + phoneNumberId set + at least one template name resolvable).
- Add `buildTemplateComponents(event, vars)` in `templates.ts` beside `buildContentVariables`. Unit tests for both (variable order, sanitisation, clamp).
- Gate. Commit.

**Step 4 — EUM transport.**
- Add `@aws-sdk/client-socialmessaging`. Implement `sendViaEum` in `send-whatsapp-eum.ts`: build the Cloud API template payload, serialise to bytes, `SendWhatsAppMessageCommand`, map result → `{ ok, status:'queued', providerMessageId:wamid, templateRef, toPhone }`; map errors → `failed` with a Meta error code; never throw; console-skip when unconfigured (mirror `sendViaSes`).
- Add `isRetryableWhatsAppError` (provider-aware). Wire the dispatcher to select `sendViaEum` when `WHATSAPP_PROVIDER=aws_eum`.
- Update `whatsapp-send.ts` to call the provider-aware retryable check (structure otherwise unchanged).
- Unit tests with an injected client stub (mirror the existing `deps.createClient` injection pattern): success, invalid recipient (non-retryable), rate-limit (retryable), unconfigured (skip).
- Gate. Commit.

**Step 5 — EUM SNS webhook.**
- Add `app/api/webhooks/aws-eum/route.ts`: SNS subscription-confirmation handshake, **SNS signature verification**, status mapping → `systemUpdateDeliveryByProviderId(wamid, …)`, opt-out detection → `systemRecordWhatsAppOptOut`, number marking via `systemMarkWhatsAppStatus`. No inbound body persisted. Returns 200 on unrecognised events (do not trigger SNS retries); 403 on bad signature.
- Add a shared `aws-sns-verify.ts` verifier (or reuse a maintained lib) — do **not** hand-roll HMAC that silently accepts forged messages. Tests: valid signature accepted, bad signature 403, status update, opt-out path.
- Gate. Commit.

**Step 6 — Env + docs.**
- Add the EUM keys to `.env.example` (§9) under a new "AWS End User Messaging (Social)" block; leave Twilio block intact.
- Update `CLAUDE.md` / relevant progress doc: WhatsApp now has two providers (`twilio` legacy, `aws_eum` default); billing lands on AWS. Note the out-of-band checklist.
- Gate. Commit.

---

## 9. Env additions (keep Twilio block untouched)

```
# ---------- WhatsApp notifications ----------
WHATSAPP_ENABLED=false
# Transport: "aws_eum" (bills on AWS invoice, default once registered) | "twilio" (legacy fallback)
WHATSAPP_PROVIDER="aws_eum"

# --- AWS End User Messaging (Social) [WHATSAPP_PROVIDER=aws_eum] ---
# Prefer the App Runner/ECS IAM role (social-messaging:SendWhatsAppMessage); no static keys.
SOCIAL_MESSAGING_REGION=""            # confirm EUM Social is available here
EUM_PHONE_NUMBER_ID=""                # origination phone number id from the EUM console
WHATSAPP_TEMPLATE_LANG="en"
META_API_VERSION="v21.0"
AWS_EUM_SNS_WEBHOOK_URL="https://your-host/api/webhooks/aws-eum"
# Template names default to the event name; override only if a WABA template is named differently:
# WHATSAPP_TEMPLATE_WELCOME="welcome"  (etc.)

# --- Twilio (legacy) [WHATSAPP_PROVIDER=twilio] ---
# ...existing TWILIO_* and WHATSAPP_TEMPLATE_* (SID) keys unchanged...
```

---

## 10. Preserve — do not break

- Email path (`src/lib/email/*`) — untouched.
- Twilio transport + both `app/api/webhooks/twilio/*` routes — kept, working, selectable via `WHATSAPP_PROVIDER=twilio`.
- The six event call-sites and their events/variables — unchanged.
- Repository seam and the two documented system writers — unchanged.
- Consent re-read, guard order, kill switch, never-throws contract, outbound-only posture — unchanged.
- `NOTIFY_EVENTS` and the notification contract types — unchanged.

## 11. Anti-patterns (reject these in review)

1. Deleting the Twilio transport or webhooks instead of keeping them behind the switch.
2. Letting a WhatsApp failure/skip throw into, block, or alter the email path.
3. Building the message body from anything other than `orderedVariables` — no new free-form text, no fallback body.
4. Putting a CIN/PAN/TAN, filing number, OTP, password, or document content into a variable.
5. Trusting the queued payload for consent instead of re-reading it in the job.
6. Importing `db` outside `src/db/repositories/*`, or adding a second un-scoped system writer outside that file.
7. Hand-rolled SNS signature verification that can accept forged events; skipping the subscription-confirmation handshake.
8. Applying Twilio's `whatsapp:` prefix on the EUM `to`, or sending `+`-prefixed numbers to Meta.
9. Static AWS keys in the app/bundle instead of the instance role.
10. Adding a fifth top-level nav, an inbox, or any inbound chat handling — this is outbound-only.

## 12. Acceptance criteria

- `npm run typecheck && npm run test && npm run lint` all green.
- With `WHATSAPP_PROVIDER=twilio`, behaviour is byte-for-byte the current behaviour.
- With `WHATSAPP_PROVIDER=aws_eum` and config present, each of the six events sends via `SendWhatsAppMessageCommand`, records a `queued` delivery with the wamid, and the SNS webhook advances it to delivered/read/failed.
- With `WHATSAPP_ENABLED=false`, every attempt records `skipped/disabled` and makes no AWS/Twilio call, regardless of provider.
- No new `db` import outside the repository layer; email tests unchanged and passing.

## 13. Open questions for the owner

1. Confirm the AWS region for EUM Social (and that it's supported there). Does it need to match `SES_REGION`? (No, but simpler if it does.)
2. SNS **or** EventBridge for EUM delivery events? This plan assumes SNS HTTPS subscription; say if you prefer EventBridge.
3. Keep Twilio as a permanent fallback, or set a date to retire it once EUM is proven in production?
4. Template language — `en` only, or add `en_US`/regional variants per client?
5. Add a dedicated `template_name` column to `notification_deliveries`, or reuse `templateSid` for the Meta template name?
