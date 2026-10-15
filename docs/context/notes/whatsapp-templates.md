# WhatsApp templates (submit on Meta)

Every WhatsApp message is one of these pre-approved templates — nothing else is
ever sent. Category **utility**, language **en**, for all of them. The Meta
template name defaults to the event name (`NOTIFY_EVENTS` in
`src/lib/notify/types.ts`); override with `WHATSAPP_TEMPLATE_NAME_<EVENT>` only
if Meta forced a different name. Variable order is fixed by `orderedVariables`
in `src/lib/notify/templates.ts` — if a body and the builder disagree, the
builder is wrong. Meta does not allow a variable at the very start or end of a
body.

Variables are short and non-sensitive: first name, company name, step title,
obligation name, due date. Never a CIN / PAN / TAN / DIN, filing number,
password, OTP, amount or document content.

## Message to client

| Meta template name | Sent when (process email) | Body | Variables |
|---|---|---|---|
| `step_awaiting_approval` | `step_awaiting_client_approval` — client, plus the admins / leads the email copies | Hello {{1}}, the step "{{3}}" for {{2}} is ready for your approval. Please sign in to VCFO Suite to review it. | 1 first name, 2 company name, 3 step title |
| `client_action_needed` | `client_fill_approved` — client, plus the admins / leads the email copies | Hello {{1}}, we need some details from you for "{{3}}" ({{2}}). Please sign in to VCFO Suite to fill them in. | 1 first name, 2 company name, 3 step title |
| `documents_shared` | `docs_shared` — client | Hello {{1}}, new documents for {{2}} have been shared with you. Please sign in to VCFO Suite to view them. | 1 first name, 2 company name |
| `document_delivered` * | `delivered` — client | A new document for {{1}} is ready on "{{2}}". Please sign in to VCFO Suite to view it. | 1 company name, 2 step title |
| `coi_issued` * | `review_accepted` on the COI step (pre-12) — client, plus the email CCs | Good news: the Certificate of Incorporation for {{1}} has been issued. You can download it in VCFO Suite. | 1 company name |
| `welcome` * | client welcome email | Hello {{1}}, welcome to VCFO Suite. Your workspace for {{2}} is ready, please sign in to get started. | 1 first name, 2 company name |
| `compliance_due_monthly` * | monthly compliance digest | Reminder for {{1}}: {{2}} is due on {{3}}. Please check VCFO Suite for details. | 1 company name, 2 obligation name, 3 due date |
| `compliance_due_quarterly` * | quarterly compliance digest | Reminder for {{1}}: {{2}} is due on {{3}}. Please check VCFO Suite for details. | 1 company name, 2 obligation name, 3 due date |
| `compliance_overdue` * | overdue compliance digest | Reminder for {{1}}: {{2}} is now overdue. Please check VCFO Suite for the next steps. | 1 company name, 2 obligation name |

## Message to firm

| Meta template name | Sent when (process email) | Body | Variables |
|---|---|---|---|
| `staff_client_submitted` | `client_submitted` — every lead and manager | Hello {{1}}, the client has submitted "{{3}}" for {{2}}. Please review it in VCFO Suite. | 1 first name, 2 company name, 3 step title |
| `staff_client_uploaded` | `client_uploaded` — every lead and manager | Hello {{1}}, the client uploaded a document for "{{3}}" ({{2}}). Please check it in VCFO Suite. | 1 first name, 2 company name, 3 step title |
| `staff_change_requested` | `client_change_requested` — every lead and manager | Hello {{1}}, the client asked for a change on "{{3}}" for {{2}}. Please look at it in VCFO Suite. | 1 first name, 2 company name, 3 step title |
| `phase_approved` | `phase_approved` — every lead and manager (the client gets no email for it, so no WhatsApp either) | Hello {{1}}, the step "{{3}}" for {{2}} has been approved. You can see the details in VCFO Suite. | 1 first name, 2 company name, 3 step title |

## Everything else

| Meta template name | Sent when | Body | Variables |
|---|---|---|---|
| `process_notice` * | every other process email (review accepted / rejected, unlocked, board resolution shared, document requested, lead asks for approval, client-fill asked / declined), to the same people as the email | Update for {{1}}: {{2}}. Please sign in to VCFO Suite for details. | 1 company name, 2 short notice (e.g. "Client Details needs a correction") |

\* Body proposed on 2026-10-14 — no approved body was on record. Check the
wording before submitting; the variable order is fixed.

The person who triggered an event never gets a WhatsApp about it.
