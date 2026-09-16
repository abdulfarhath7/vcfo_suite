# AWS-EUM-GO-ALL-IN-CONTEXT.md — remove Twilio, collapse WhatsApp to EUM only

**For:** Claude Code, in the `vcfo_suite` repo.
**Task type:** deletion + collapse refactor. **No new behaviour.** After this, WhatsApp has exactly one transport — AWS End User Messaging (Social) — and no provider switch.
**Why:** the EUM transport is already built and is the chosen path (transactional WhatsApp on the AWS invoice next to SES). Twilio was kept as a fallback we will never use; a fallback nobody runs is dead weight. Remove it so there is one code path to reason about.

Read the whole file first. This is surgical: delete the Twilio-only files, strip Twilio out of the shared files, and make `sendViaEum` the only transport — without touching the notification contract, the six event call-sites, the repository seam, or the EUM code itself.

---

## 1. Global rules (every step)

1. **Gate after every step:** `npm run typecheck && npm run test && npm run lint`. All green before the step's commit.
2. **Behaviour is unchanged for EUM.** This refactor only removes the Twilio alternative. A message that would send via EUM before must send identically after.
3. **Never-throws contract holds.** `sendWhatsAppTemplate` still returns a value for every outcome and never throws / never blocks email. The Inngest job, queue helpers, and consent re-read are untouched in behaviour.
4. **Do not touch the six events or their call-sites.** `app/api/engagements/route.ts` (`welcome`), `src/lib/email/notify-engagement-event.ts` (`coi_issued`, `document_delivered`), `src/jobs/compliance-generate.ts` (`compliance_due_monthly|quarterly`, `compliance_overdue`). They call `queueWhatsAppSend(s)`; that signature does not change.
5. **Repository seam sacred.** Only `src/db/repositories/*` imports `db`. The two documented system writers stay; only their comments change (they're now driven by the EUM SNS webhook, not Twilio).
6. **Do not touch the EUM implementation** except to remove now-dead parameters (e.g. a `provider` argument that only ever resolves to `aws_eum`). Files to leave functionally intact: `send-whatsapp-eum.ts`, `aws-sns-verify.ts`, `app/api/webhooks/aws-eum/route.ts`.
7. **Zero Twilio references at the end.** `grep -rniE "twilio" src app package.json .env.example` returns nothing but, at most, incidental history. Comments count — reword them.
8. **Kill switch + outbound-only + DPDP consent** posture unchanged.

---

## 2. Delete outright

| Path | Why |
|---|---|
| `src/lib/notify/send-whatsapp-twilio.ts` | Twilio transport + `isRetryableTwilioCode` — gone |
| `src/lib/notify/twilio-webhook.ts` | Twilio signature validation — replaced long ago by `aws-sns-verify.ts` |
| `app/api/webhooks/twilio/status/route.ts` | Twilio status webhook — EUM uses `/api/webhooks/aws-eum` |
| `app/api/webhooks/twilio/inbound/route.ts` | Twilio inbound/opt-out webhook — same |
| `twilio` dependency in `package.json` | currently `^6.1.0` — remove, then `npm install` to update the lockfile |

Also remove the now-empty `app/api/webhooks/twilio/` directory.

---

## 3. Strip Twilio from shared files (keep the file, cut the Twilio parts)

**`src/lib/notify/send-whatsapp.ts`** — collapse the dispatcher.
- Remove the `import { sendViaTwilio }` and the `WHATSAPP_PROVIDER` branch. `sendWhatsAppTemplate` calls `sendViaEum(shared)` directly, keeping its exact current signature and never-throws contract.
- Remove the re-exports `resolveWhatsAppProvider` and `isRetryableTwilioCode`.

**`src/lib/notify/channels.ts`** — EUM-only config.
- Delete `WhatsAppProvider` type and `resolveWhatsAppProvider`.
- Delete the Twilio fields from `WhatsAppConfig` (`accountSid`, `authToken`, `from`, `messagingServiceSid`, `statusCallbackUrl`, `inboundCallbackUrl`) and the `provider` field. `WhatsAppConfig` becomes `{ enabled, eum }`.
- In `readWhatsAppConfig`, drop all `TWILIO_*` env reads and the `provider` line; keep `enabled` and the `eum` block.
- `resolveWhatsAppChannel`: remove the `provider === 'aws_eum'` guard — it always resolves the EUM template name now. Keep it pure (no db, no SDK, no env).
- `isWhatsAppConfigured`: `enabled && eum.phoneNumberId.trim() !== ''`.

**`src/lib/notify/whatsapp-retry.ts`** — one classifier.
- Remove `import { isRetryableTwilioCode }` and the `provider` parameter/branch. `isRetryableEumCode` is the only classifier; export it as the retry check the job uses.

**`src/lib/notify/send-whatsapp-shared.ts`** — remove `resolveWhatsAppProvider` and any Twilio-only shared helper; keep the provider-neutral send-input assembly.

**`src/lib/notify/templates.ts`** — Meta-only template shaping.
- Remove `buildContentVariables`, `TemplateSidMap`, `readTemplateSids` (the Twilio Content API positional path).
- Keep `buildTemplateComponents` and `TemplateNameMap`. Update the file header comment to drop the Twilio bullet.

**`src/jobs/whatsapp-send.ts`** — retry call.
- Update the retryable check to the single EUM classifier (drop any `provider` argument). The `templateSid: result.templateRef` write stays (see §4). No structural change.

**`src/lib/notify/phone.ts`** — drop the Twilio wire format.
- Remove `withWhatsAppPrefix` / `stripWhatsAppPrefix` (the `whatsapp:` prefix is Twilio-only; EUM sends bare digits). **First confirm** nothing on the EUM path imports them; if something does, it shouldn't — fix the caller to use the bare-number formatter.
- Keep E.164 validation and the opt-out keyword set. Reword the Twilio comments.

**`src/lib/notify/types.ts`** — comments only. Drop "AWS EUM and Twilio, chosen by `WHATSAPP_PROVIDER`" and "a Twilio Content SID or a Meta template name" → the identifier is now just the Meta template name / wamid. No type changes.

**Comment-only rewording** (no logic change) in: `src/db/schema.ts` (the `whatsapp status … set by the Twilio status webhook` note → EUM SNS webhook), `src/db/repositories/notification-deliveries.ts` and `src/db/repositories/profiles.ts` (the "SYSTEM WRITER — Twilio … webhook" headers → EUM SNS webhook; the deviation itself stays), `src/lib/email/notify-engagement-event.ts` (the "a Twilio timeout can never…" note → "a WhatsApp send").

---

## 4. The `template_sid` column — decide, don't guess

`src/db/schema.ts` has `templateSid: text('template_sid')`; the job writes the Meta template name into it. It's text and, per the existing code comment, "has never meant Twilio specifically." Two clean options — this is an **owner decision**, so ask before doing the rename:

- **(A) Keep the column** `template_sid`, keep storing the template name in it. Zero migration, zero risk. Slightly misleading name.
- **(B) Rename** to `template_name` via a Drizzle migration (rename column, preserve data) + update `RecordDeliveryInput`, the writer, and any reader; add/adjust a cross-tenant test.

**Default to (A)** unless the owner asks for the rename. If (B), it is its own final step with its own migration + gate, never bundled into the deletion commits.

---

## 5. Env + tests

**`.env.example`** — delete the entire "Twilio (legacy)" block, the `WHATSAPP_PROVIDER` line, and the commented `WHATSAPP_TEMPLATE_*` Content-SID keys. Keep `WHATSAPP_ENABLED` and the whole "AWS End User Messaging (Social)" block. Update the `WHATSAPP_ENABLED` comment so it no longer mentions a provider switch. Since there's no second provider, the EUM template-name overrides can drop the "Twilio fallback has both configured" caveat.

**Tests** — remove the Twilio cases, keep/great-en the EUM coverage:
- `src/lib/notify/send-whatsapp.test.ts` — drop Twilio dispatch cases; keep dispatcher-calls-EUM + never-throws.
- `src/lib/notify/channels.test.ts` — drop Twilio config/provider cases; keep EUM config + `isWhatsAppConfigured`.
- `src/lib/notify/templates.test.ts` — drop `buildContentVariables` cases; keep `buildTemplateComponents`.
- Keep `src/lib/notify/send-whatsapp-eum.test.ts` as-is (adjust only if a removed shared export was imported).
- Delete any test file dedicated to `twilio-webhook.ts`.

---

## 6. Ordered steps (each ends with the gate + a commit)

1. **Delete Twilio files** (§2) + remove the `twilio` dep + `npm install`. Fix the immediate import breaks in `send-whatsapp.ts`, `whatsapp-retry.ts`, `send-whatsapp-shared.ts` so it compiles (point them straight at EUM). Gate. Commit.
2. **Collapse config + shared** (`channels.ts`, `send-whatsapp-shared.ts`, `send-whatsapp.ts`, `whatsapp-retry.ts`, `templates.ts`, `whatsapp-send.ts` retry call). Gate. Commit.
3. **Phone + comments + env** (`phone.ts`, comment rewordings, `.env.example`). Gate. Commit.
4. **Tests** (§5). Gate. Commit.
5. **Sweep:** `grep -rniE "twilio" src app package.json .env.example` → nothing meaningful. `npm run build`. Gate. Commit.
6. **(Only if owner chose 4B)** column rename migration. Its own gate + commit.

---

## 7. Preserve — do not break
- The EUM transport, SNS webhook, signature verification, retry classifier.
- The six events + their call-sites + `queueWhatsAppSend(s)` signatures.
- Repository seam + the two system writers (comments change, behaviour doesn't).
- Consent re-read in the job, never-throws contract, outbound-only, kill switch, delivery recording.
- `types.ts` types (comments only), the `phone_e164` / opt-in fields, `buildTemplateComponents`.

## 8. Anti-patterns (reject in review)
1. Removing Twilio by leaving a dead `provider` field/param "just in case" — collapse it fully.
2. Changing `sendWhatsAppTemplate`'s signature or its never-throws contract.
3. Touching a call-site, an event name, or the EUM payload shaping.
4. Silently renaming `template_sid` without the owner's yes (that's §4B, a migration).
5. Importing `db` outside repositories, or dropping a system-writer deviation because its comment mentioned Twilio.
6. Deleting E.164 validation or the opt-out keyword set along with the Twilio prefix helpers.
7. Leaving `WHATSAPP_PROVIDER` referenced anywhere after the collapse.

## 9. Acceptance criteria
- `npm run typecheck && npm run test && npm run lint && npm run build` all green.
- No `twilio` in `src`, `app`, `package.json`, `.env.example`, or the lockfile's direct deps.
- `WhatsAppConfig` is `{ enabled, eum }`; `sendWhatsAppTemplate` calls `sendViaEum` with no provider branch.
- With `WHATSAPP_ENABLED=false`, every attempt still records `skipped/disabled`, no AWS call.
- Email path and all six event behaviours unchanged; EUM tests pass.

## 10. Open questions
1. `template_sid` column: keep as-is (A) or rename to `template_name` (B)? Default A.
2. Delete the `app/api/webhooks/twilio/` route folder entirely (yes, assumed) — confirm nothing external still points at those URLs (Twilio console can be torn down separately).
3. Keep `META_API_VERSION` pinned at `v21.0`, or bump while we're here?
