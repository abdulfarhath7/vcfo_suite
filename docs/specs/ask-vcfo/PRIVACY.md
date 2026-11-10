# Ask VCFO: what reaches the model

This note says exactly what Ask VCFO masks before a model call, what it does not mask, and how the
client data kill switch, the AI notice and "Ask my CA to confirm" work. It follows the legal review
in `docs/specs/mca-connect/reports/VCFO Assist legal review.md` (the Ask VCFO and AI data flow sections).
It does not replace client consent, a processor contract or the move to Bedrock India.

## One door to the model

Every Ask VCFO model call goes through `maskingProvider` (`src/lib/ask/masked-provider.ts`). It wraps
the configured provider, so a new prompt, tool result or history line cannot skip the masking:

- On the way out it masks the system blocks, every text message, every tool result and every tool
  input.
- On the way back it restores the placeholders in text replies, in JSON replies (value by value, so
  quoting stays valid) and in tool inputs. The person reads their own values in the answer.
- Thinking blocks pass through unchanged in both directions. The model wrote them from masked text,
  and their signature must not change.

The answer path (router and answer model) and the Do path (the data router's read and field-choice
calls) both use it. The embedding query for retrieval is masked too, because that call also leaves
the app.

## What is masked

The masker is `createAskMasker` in `src/lib/ask/mask.ts`. Each value becomes a numbered placeholder,
and the same value keeps the same placeholder for the whole conversation. The pipeline builds one
masker per turn and feeds it the conversation history in order first, so numbering is stable.

| Data | Placeholder | When | Restored in the answer as |
| --- | --- | --- | --- |
| Email address | `[EMAIL_n]` | Always | The real address |
| Indian mobile (with or without +91, 91 or 0) | `[PHONE_n]` | Always | The real number |
| Landline with an STD code (`022-24567890`, `(080) 2345 6789`, `+91 80 …`) | `[PHONE_n]` | Always | The real number |
| Bank account number | `[BANK_ACCOUNT_n]` | 9 to 18 digits after "account", "a/c" or "acct"; any bare run of 13 to 18 digits | The real number |
| Pincode | `[PINCODE_n]` | Only on a line with an address word (address, road, nagar, floor, pin, …) or within two lines below one | The real pincode |
| PAN | `[PAN_n]` | Always | Last four only (`XXXXXX234F`) |
| Aadhaar | `[AADHAAR_n]` | Always | Last four only (`XXXXXXXX0123`) |
| Passport | `[PASSPORT_n]` | Always | Last four only |
| DIN | `[DIN_n]` | After the word "DIN", or any 8-digit number on a line that mentions a director, subscriber, promoter, DIN or DIR-3 | Last four only |
| Director names the engagement holds (`pre-15`, or the legacy Part A slots) | `[DIRECTOR_n]` | Full name, and first plus last name | The full name |
| The signed-in client's own name (client shell) | `[CLIENT_n]` | As above | The full name |
| Names on labelled lines of a Do paste ("Name: …", "Director 2: …") | `[DIRECTOR_n]` or `[SUBSCRIBER_n]` | Do path only | The full name |

Identity numbers come back only in their last-four form. A full Aadhaar number therefore never
returns into a stored answer or a later prompt. The text a person types is also stored with identity
numbers already cut to the last four (`maskIdentityNumbers`), as before.

**IFSC stays visible.** An IFSC names a bank branch, not a person, and an answer about a bank account
often needs to know the bank. It is a public code like GSTIN and CIN, which also stay readable.

## What is not masked

- **Free-text names** the engagement does not already know. Ask VCFO cannot detect a name in prose
  reliably, so a name typed by staff about a person outside the engagement's director list reaches
  the model as written. Subscribers who are not directors are not yet in the known-people list.
- **Street addresses.** Only the pincode beside an address is masked; the street, area and city are
  sent as written.
- **Dates of birth**, gender, nationality and occupation.
- **Company names**, CIN, GSTIN, SRN and IFSC. These are public registry facts and the answers depend
  on them.
- **Images and scanned PDFs.** They cannot be masked. Only the identity-document reader sends them,
  and only when `ASK_ID_DOC_READING=true` (off by default).
- **The firm's own playbook** and reviewed topics. They hold no client data.

## The Do path writes only what the person gave

The data router still receives the raw message, because code reads the values from it on the
server. Every model call inside the Do path goes through the masker. A value the model returns from
a text source must appear in the original text before it reaches a review card
(`src/lib/ask/data-router/read.ts`), and a placeholder is restored from the server's own copy of
the text. A value the model invents, or a placeholder it makes up, never reaches the card. Nothing
is written until a person accepts the card. Tests: `src/lib/ask/do/privacy.test.ts` and
`src/lib/ask/__tests__/pipeline-privacy.test.ts` assert on the stub provider's input.

## Kill switch: `ASK_CLIENT_DATA_ENABLED`

Default `true`, which keeps local work unchanged. With `false`:

- The answer model gets no project snapshot, no data tools, no record cards, no page context and no
  conversation history. Retrieval searches the firm's knowledge documents only.
- A generated answer starts with: "This answer uses general knowledge only. Client data is switched
  off for Ask VCFO, so it does not reflect your project." Such answers are not saved for reuse.
- The Do path makes no model call. "Label: value" text is still read by code; anything else gets a
  plain message asking for labelled lines.
- Deterministic answers (suggestions, metrics, reviewed topics) still work, because no model sees them.

The owner may set it to `false` in production until written client consent exists (legal review,
action item 2). It is read in `src/lib/ask/client-data.ts`.

## AI notice and "Ask my CA to confirm"

Anthropic's Usage Policy (from 12 November 2026) treats personalised legal or tax advice as a
high-risk use: people must be told AI was used, and a qualified professional reviews the advice.

- Every model-written answer (`origin: 'generated'`) shows a small "AI-generated" label and the
  sentence "Prepared by AI. Your SBC team reviews advice about your own tax or legal position before
  you act on it." (the firm display name replaces SBC). It appears on the staff and client answer card
  (`src/components/ask/AiNotice.tsx`) and in the client portal chat (`AskLauncher`).
- A client sees "Ask my CA to confirm" under each AI answer. It sends the question and the answer as
  shown to the engagement's lead, reusing the "Ask my lead" task and bell (`createAskHandoff`); no new
  table. The status ("Sent to your CA", "Your CA is reviewing", "Reviewed by your CA") comes from
  `GET /api/ask/handoff/[id]`, which reads the task's status through `getTaskById` and answers only for
  hand-off tasks on the client's own engagement. Shared wording is in `src/lib/ask/ai-review.ts`.

## Not built: "Client AI answers need CA review before the client sees them"

A firm setting that holds every client AI answer until a CA approves it needs more than a toggle,
and the firm-settings store (`firm_settings` table and repository) was owned by another change at
the time. The design for a later change:

1. Add `askClientReviewRequired boolean not null default false` to `firm_settings`, with a migration,
   the patch schema field and the settings screen toggle (super admin and admin). Default off, so the
   current flow does not change.
2. When on, a client-shell answer with `origin: 'generated'` is stored as usual but emitted as a
   held line ("Your SBC team is checking this answer. You will see it here once they have.") with
   a `heldMessageId`, and a hand-off task is created for the lead with the question and answer.
3. The lead approves, edits or replaces the answer from the task (a small review panel on the task
   drawer). Approval marks the message released and reviewed (`origin: 'reviewed'`), notifies the
   client, and the client thread shows the released answer in place of the held line.
4. Saved answers are never reused for clients while the setting is on, unless the saved answer was
   itself released by a reviewer.
5. Tests: held answers never reach the client payload; release needs a staff role with access to the
   engagement; the setting defaults off.
