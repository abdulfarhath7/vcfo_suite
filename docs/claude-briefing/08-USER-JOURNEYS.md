# 08 — User journeys

Happy paths to keep in mind when changing UI. If a redesign hides a step in these chains, call it out.

## 0. Firm boots a project

1. Admin (or PM) opens **New project**.
2. Fills company + client email + temp password + lead(s) + manager(s) + start stage.
3. POST `/api/engagements` creates engagement + client profile; welcome email (or console skip).
4. Lands on project detail. Client can log in.

**UI risk:** Create Project is long; a prettier wizard is fine. Do not drop subsidiary fields when stage is Registration/Compliance.

## 1. Client first week (Pre-1 → signed BR)

1. Login → **Inbox** (may be empty) → **Incorporation**.
2. Only **Client Details** is open. Fills questionnaire + uploads. Submit.
3. Lead is emailed (Resend). Client waits (“Waiting on the client” is a **staff** phrase; client sees locked later steps).
4. Lead drafts board resolution, **finalizes**. Client gets notified / compose.
5. Client opens Pre-3, downloads, signs, uploads signed copy.
6. Inbox may also show **document requests** from the lead.

**UI risk:** Don’t put Pre-2 draft in the client portal. Don’t add a second Progress nav.

## 2. Lead’s day (Today → step)

1. **Today**: companies with unlocked work (done / in progress / awaiting client).
2. Opens a company → four phase rows → clicks into current step.
3. Form autosaves. Files upload immediately to object storage.
4. When ready: **Request manager approval** or last-tab **Submit** (emails managers, not on every keystroke).
5. If no reply: **Email manager again**.
6. After manager Accept, lead may **Deliver** / update client portal (toast + bell; first time opens Outlook compose).

**UI risk:** Don’t restore a 4-column phase stepper that duplicates the tick track. Don’t show working-days SLA on intern. Don’t collapse the phase-scoped rail into “all 34 steps” on one page.

## 3. Manager accept loop

1. **Approvals** (or email) → open step.
2. Accept → in-app Graph compose **to client**, CC admin + lead.
3. Reject / unlock → client can edit again; later steps re-lock.

**UI risk:** Approvals empty state needs “you’re clear” guidance. Accept must remain an email moment, not a silent DB tick — unless the owner explicitly wants silent accept.

## 4. Name → COI (compressed)

Client Pre-1 → Lead Pre-2 finalize → Client Pre-3 → Lead Pre-4 file name → Lead Pre-5 approval → Client Pre-6 KYC → Lead Pre-7 DSC/docs → Client Pre-8 execute → Client Pre-9 confirm → Lead Pre-10 file SPICe+ → Lead Pre-11 remarks → Lead Pre-12 COI package.

Each client-owned step is a **portal form**; each lead-owned step is a **workspace + deliver**.

## 5. Post-inc and registrations

Mostly lead-owned. Client may still receive requests, shared docs, and emails. Intern Registration groups (GST vs IEC vs FEMA) are **navigation**, not separate products.

## 6. Client invites finance teammate

`/app/client/team` → invite email → member joins same engagement. Substitute replaces a person (self-substitute signs the actor out). Audited as `client.invite` / `client.substitute`.

## 7. Recurring compliance (after COI)

Inngest generates instances from obligations + incorporation date. Staff calendar + client Compliances. Digest email not fully wired — UI should not promise a weekly digest until it exists.

## 8. Super Admin inspects

Overview → jump into **firm console** or **client portal** without changing the underlying role-scoped data (middleware lets super enter segments). Gold is a badge, not a theme.

## Emotional beats (for visual tone)

| Beat | Current expression | Redesign caution |
|---|---|---|
| Precision / trust | Cool blue, mono metadata, flowchart | Don’t go playful on MCA filings |
| Waiting | Amber clock icon, muted gold chip | Don’t paint whole pages yellow |
| Done | Teal check, pulse once | Celebrate phase completion (`PhaseCelebration` exists) without modal spam |
| Blocked | Rose overdue on **current** step only | Never overdue-badge the future |
| Lead flow | Quiet, dense, autosave | Don’t add dashboard chrome on the step page |
| Client flow | Inbox + one catalog | Don’t expose firm analytics |
