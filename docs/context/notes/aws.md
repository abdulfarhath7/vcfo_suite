# AWS deploy and WhatsApp (End User Messaging)

Gotchas already paid for once. Append when something costs more than a minute to figure out.

## AWS deploy gotchas (2026-09-11)

- **`aws login` sessions are invisible to Terraform.** The CLI's browser login
  writes a `login_session` the Go SDK cannot read. `eval "$(aws configure
  export-credentials --profile vcfo --format env)"` immediately before every
  terraform command; the exported token expires in ~20 min, so a long apply
  started on a stale export dies mid-run (leaves `errored.tfstate` + a held
  S3 lock — `terraform force-unlock <id>` with the id from the `.tflock` object).
- **App Runner injects `HOSTNAME=<instance>`**, overriding the Dockerfile ENV.
  Next standalone binds to it and the health check never reaches port 3000
  (`CREATE_FAILED`). The CMD forces `HOSTNAME=0.0.0.0` at exec time. A
  `CREATE_FAILED` service cannot be redeployed — delete + recreate, and the
  service URL changes.
- **`pg` >= 8.16 treats `sslmode=require` as verify-full.** RDS chains to
  Amazon's private CA, so without `NODE_EXTRA_CA_CERTS=certs/rds-global-bundle.pem`
  every connection fails "self-signed certificate in certificate chain" — an
  explicit `ssl: { rejectUnauthorized: false }` does NOT override the URL.
  Applies to laptop `db:migrate` too.
- `npm ci` needs `legacy-peer-deps=true` (`.npmrc`) — eslint 10 vs
  eslint-plugin-jsx-a11y peer range. `drizzle-kit` had to move 0.18.1 → 0.31.x:
  the old one had no `defineConfig`, which only `next build` typechecks.
- `terraform -exclude` does not exist in 1.13; bootstrap order uses `-target`
  for everything except the App Runner service (needs an image first).
- `NEXT_PUBLIC_SITE_URL` is baked at build; server-side links read runtime
  `SITE_URL` first (`src/lib/site-url.ts`), so one image serves any hostname.

## WhatsApp — AWS EUM only (2026-09-08, collapsed 2026-09-16)

- One transport: `sendWhatsAppTemplate` (dispatcher, runs the guards) →
  `sendViaEum` in `send-whatsapp-eum.ts`, shared result/deps types in
  `send-whatsapp-shared.ts`. A Twilio sandbox transport was tried on
  2026-10-12 and removed again on 2026-10-14 (owner). Do not reintroduce a
  provider field "just in case".
- **Recipients match the email.** Each WhatsApp goes to the people on that
  mail (To, and CC where the mail copies someone), minus the person who
  triggered it (`mailHandlersForEvent`). A person with no phone number or no
  consent is skipped. Passwords stay in email only.
- **Events (LCC parity, 2026-10-14).** Message to client:
  `step_awaiting_approval`, `client_action_needed` (from
  `client_fill_approved`), `documents_shared`, `document_delivered`,
  `coi_issued`, `welcome`, the three compliance events. Message to firm:
  `staff_client_submitted`, `staff_client_uploaded`, `staff_change_requested`,
  `phase_approved` (its email goes to leads + managers only). Every other
  process email sends `process_notice`. Mapping: `whatsappEventFor` in
  `src/lib/notify/process-event-whatsapp.ts`; bodies and variable order:
  `notes/whatsapp-templates.md`. `inAppOnly` and `skipInAppNotifications`
  (re-opened compose) send nothing.
- **At most once a day.** Each queued send carries the Inngest event id
  `wa:<event>:<engagement>:<step>:<person>:<YYYY-MM-DD>`; Inngest drops a
  repeat, so a double click or a re-run cannot message twice that day.
- **Throttle:** the `whatsapp-send` function is throttled to 20 runs a minute
  (`throttle: { limit: 20, period: '1m' }`, inngest 3.54); excess runs wait.
- **Retries happen inside the `send` step.** A step that returns is memoised,
  so throwing after it only replayed the stored failure; the step now throws
  on a retryable code and the last attempt records the failure.
- **Status only moves forward** (`src/lib/notify/delivery-status.ts`):
  queued 0 → sent 1 → delivered 2 → read 3, failed 4 is final, skipped is
  final. The webhook update matches only rows a step behind, so a late or
  duplicate SNS event changes nothing.
- **Send log** (project page, admin + manager): `SendLogPanel` reads
  `GET /api/engagements/:id/notification-deliveries`; channel / status
  filters; phone masked `+91 98480 •••00` (`maskPhone`); reason column uses
  `skipReasonText` / `whatsappErrorText`. Email sends are not written to
  `notification_deliveries` yet, so the Email filter is empty.
- **Retry:** `POST …/notification-deliveries/:deliveryId/retry` (admin +
  manager, same scope as the GET) re-queues a failed WhatsApp row with dedupe
  id `retry:<deliveryId>:<attempt>`; the job re-reads consent. Needs migration
  **0024** (`variables` jsonb + `retry_of` on `notification_deliveries`) so the
  same message is resent — run `npm run db:migrate` (RDS: with the CA bundle).
- **The guards run once, in the dispatcher.** `resolveWhatsAppChannel` is pure
  and returns the approved Meta template name as `templateRef`; it lands in
  the text `template_sid` column (name kept, option A). Guard order is
  load-bearing: `disabled → no_template → no_phone → no_consent → opted_out`.
- **Meta wants bare digits.** `toMetaPhone` strips `+` for the EUM payload;
  `fromMetaPhone` adds the `+` back when a webhook reports a number, because
  profiles are keyed by E.164.
- **EUM template names default to the event name**, so the path needs no
  per-event env at all — approve the fourteen templates in WhatsApp Manager under
  `welcome`, `coi_issued`, … Overrides use `WHATSAPP_TEMPLATE_NAME_<EVENT>`.
- **EUM needs no credentials in config** — it authenticates through the App
  Runner / ECS instance role like `sendViaSes`, so `isWhatsAppConfigured`
  checks only `WHATSAPP_ENABLED` and `EUM_PHONE_NUMBER_ID`.
- **Retries:** `isRetryableWhatsAppError(code)` is the EUM classifier. Unknown
  codes stay retryable — a misclassified outage costs three attempts, a
  misclassified permanent error silently drops a real notice. Classifies on
  the SDK exception name (`ValidationException`, …) and on Meta's numeric
  codes.
- **The SNS webhook is the authentication.** `/api/webhooks/aws-eum` is public;
  `aws-sns-verify.ts` rebuilds the canonical string per message type, refuses
  any signing certificate that is not HTTPS on `sns.<region>.amazonaws.com`,
  and verifies RSA-SHA1/SHA256 per `SignatureVersion`. Set
  `AWS_EUM_SNS_TOPIC_ARN` to pin the topic: a valid signature proves the
  message came from SNS, not from *our* topic.
- The SNS `Message` holds `whatsAppWebhookEntry` as a JSON string *inside* the
  JSON body — parse twice. `eum-events.ts` is pure and tolerates both nesting
  forms; an unparseable event is acknowledged with 200, never a 500 (SNS would
  just retry a payload that can never parse).
- **Outbound-only still.** The parser returns the sender and an opt-out verdict
  and nothing else — no inbound body crosses that boundary, is logged, or is
  stored.
- `@aws-sdk/client-socialmessaging` had to be installed with
  `--legacy-peer-deps`: the repo has a pre-existing
  `eslint-plugin-jsx-a11y` / `eslint@10` peer conflict that blocks any plain
  `npm install`.

## WhatsApp — out-of-band setup (owner; the code is inert until this is done)

Carried over from the removed `AWS-EUM-WHATSAPP-PLAN.md` §6, updated for the
single EUM transport (there is no `WHATSAPP_PROVIDER` any more).

1. Under the existing verified Meta Business portfolio, create or attach the
   **transactional WABA + phone number**, separate from the DoubleTick number.
2. In the AWS End User Messaging (Social) console, link that WABA and register
   the number, then copy the **origination phone number id** into
   `EUM_PHONE_NUMBER_ID`.
3. Get the fourteen templates in `notes/whatsapp-templates.md` approved in
   WhatsApp Manager under names matching `NOTIFY_EVENTS`, category
   **utility**, language `en`. Body variable order must match that file.
4. Create the **SNS topic** EUM publishes to; subscribe the HTTPS endpoint
   `…/api/webhooks/aws-eum`; the route confirms the subscription itself once
   deployed. Set `AWS_EUM_SNS_TOPIC_ARN` to pin the topic.
5. Attach an IAM policy allowing `social-messaging:SendWhatsAppMessage` to the
   App Runner role. No static keys.
6. Confirm EUM Social is available in the chosen region
   (`SOCIAL_MESSAGING_REGION`, falling back to `AWS_REGION`), then set
   `WHATSAPP_ENABLED=true`.

Until the number is registered and `EUM_PHONE_NUMBER_ID` is set, every send is
recorded as `skipped/disabled` and no AWS call is made. Templates are `en`
only (`WHATSAPP_TEMPLATE_LANG`).

## WhatsApp — testing locally (2026-10-14)

- Nothing sends until `EUM_PHONE_NUMBER_ID` is set and AWS credentials can
  reach EUM; until then every attempt is recorded as `skipped/disabled`, which
  the Send log shows.
- Real notices are queued through Inngest. Under `next dev` the SDK is in dev
  mode and posts to `localhost:8288`; without `npm run inngest:dev` the enqueue
  throws, is logged as `[whatsapp] queue failed`, and nothing is recorded.
- Settings → **Send test message** (`POST /api/account/whatsapp-test`) sends
  directly, skipping Inngest, and records a `notification_deliveries` row.
- A recipient needs `phone_e164` and `whatsapp_opt_in_at` (Settings → Edit →
  tick consent); `.env.local` changes need a `npm run dev` restart.
