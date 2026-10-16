# Client portal v7 — open questions, assumptions and decisions

Built autonomously from `docs/specs/client-pages/prototype/vcfo-client-portal-FINAL.html`.
Every choice the owner may want to change is one row: **area · question · what was decided · how to change it**.

<!-- area:shell -->
## Shell and shared

| Area | Question | Decided | How to change |
|---|---|---|---|
| Shell | Who gets the new portal chrome? | Only signed-in **clients**. A super admin opening `/app/client/**` keeps the existing staff-style `AppShell` (the portal's data routes read the client's own engagement). | `src/components/client-portal/ClientPortalGate.tsx` |
| Shell | Before / After pill: a real state or a toggle? | Both. It shows the **real** COI state by default (`viewState = auto`); the client can flip it to look at the other layout, remembered per client in the NEW `client_portal_prefs.view_state`. Choosing the side that matches reality goes back to `auto`. | `effectiveAfter()` in `src/lib/client-portal/types.ts`; to hide the pill remove `<BeforeAfterPill>` from `TopBar.tsx` / `Sidebar.tsx` |
| Shell | Sidebar label "Library" vs DECISIONS.md "Knowledge Bank" | **"Library"**, exactly as FINAL shows it (route stays `/library`). The page heading follows FINAL too. | `useNav()` in `Sidebar.tsx`, `PORTAL_TITLES` in `routes.ts` |
| Shell | Sidebar logo: `vcfo-logo-on-dark` (CHANGES.md) or `vcfo-logo-on-black` (FINAL bundle)? | **on-black**, as FINAL renders it. Both files are in `public/client-portal/`. | `LogoLink` in `Sidebar.tsx` |
| Shell | Documents nav badge — what does the number count? | Open document requests (`document_requests.status = pending`) on the client's engagement. | `getClientPortalShell` in `src/db/repositories/client-portal.ts` |
| Shell | Updates badge | Unread notifications (red when > 0). Unread announcements show as the gold dot on the top-bar megaphone (NEW `announcement_reads`). | `Sidebar.tsx` `useNav()`; `TopBar.tsx` |
| Shell | Incorporation badge "6/14" | SPICe+ steps done / total = Phase 1 + Phase 2 of the real checklist, from the client-visible (redacted) state. | `getClientPortalShell` |
| Shell | Contact buttons (WhatsApp / Call / Email / Teams) | Real deep links: `wa.me/<phone>`, `tel:`, `mailto:`, Teams chat by email. Phone = staff `profiles.phone_e164` (else `phone`). A channel with no number/email toasts "… is not set up for … yet". | `contactUrl()` in `Sidebar.tsx` |
| Shell | Customer support row | From env: `CLIENT_SUPPORT_NAME`, `CLIENT_SUPPORT_EMAIL`, `CLIENT_SUPPORT_PHONE_E164`, `CLIENT_SUPPORT_WHATSAPP_E164`. Label "SBC help desk" as in FINAL. | `supportContact()` in `client-portal.ts`; set the env vars (Terraform for AWS) |
| Shell | Sign out | Real sign-out (the prototype only toasts). | `SignOutBtn` in `Sidebar.tsx` |
| Shell | Theme | Light / dark ("True black") toggle in the top bar, remembered per client (`client_portal_prefs.theme`, also localStorage to avoid a flash). The portal uses its own `data-theme` on the `.cp` root, independent of the staff app's next-themes class. | `PortalProvider.tsx` |
| Shell | Search ⌘K | The prototype only toasts. Built a real palette: pages, every incorporation step, and the client's own documents and filings (NEW `/api/client/portal/search`). Styled like the drill-down pop-up. | `SearchPalette.tsx` |
| Shell | CSS isolation | Prototype CSS copied verbatim and scoped under `.cp` by `scripts/cp-css.mjs`; inside the portal the Tailwind preflight is reverted so prototype markup renders on browser defaults. Existing Tailwind widgets reused inside a page sit in a `.cp-tw` island. | `src/components/client-portal/css-src/00-tokens.css` |
| Ask VCFO | Which chat design? | The **runtime** chat FINAL users see (`#vp-chat`: header, peek, suggestions, What's this? card, hand-off). 👍/👎 (DECISIONS: keep) added under answers from the Ask VCFO model. | `AskLauncher.tsx` |
| Ask VCFO | Suggested questions must work even when the Ask VCFO model is switched off | They are answered from the client's own data by NEW `/api/client/portal/answer` (no model). Typed questions go to Ask VCFO when it is on; otherwise the bot says it cannot answer and offers hand-off. | `src/lib/client-portal/answers.ts` |
| Ask VCFO | Hand-off to the lead | NEW `/api/client/handoff` reuses the Ask VCFO T5 record (task on the lead + bell) but works with Ask VCFO off. The prototype's toast "Undo" is not offered: a sent question cannot be recalled. | `app/api/client/handoff/route.ts` |
| Ask VCFO | 👍/👎 storage | NEW table `ask_answer_feedback` (vote, question, answer, optional own message id) via `/api/client/portal/feedback`. Nobody reads it in the UI yet. | `src/db/repositories/ask-feedback.ts`; add an admin report if wanted |
| Ask VCFO | First-visit note | The board `v7chat_launcher` bubble ("Hello. Ask me anything…" + 2 questions) shows above the launcher until the client dismisses it or opens the chat — once per client (`client_portal_prefs.bot_note_seen_at`). | `showNote` in `AskLauncher.tsx` |
| Shell | Not built on purpose (prototype-only) | N-02 fallback toasts on dead controls, R-08 the floating PROTOTYPE bar, S-20 phone fallback menu band, L-07 hiding robots drawn inside boards: they exist only to make the static prototype clickable; in the app every control is real and the top bar always has the phone menu button. | — |
| Ask VCFO | "Expand to side panel" button (chat design boards only) | Not built: FINAL's runtime chat has no expand button. The staff app's push side panel stays staff-only. | add a button in `AskLauncher.tsx` header if wanted |
<!-- /area:shell -->

<!-- area:home -->
## Home
| Area | Question | Decided | How to change |
|---|---|---|---|
<!-- /area:home -->

<!-- area:incorporation -->
## Incorporation
| Area | Question | Decided | How to change |
|---|---|---|---|
| Incorporation | The prototype shows several steps "in progress" at once; the real gate allows one active step | The real gate (`src/lib/checklist-step-gate.ts`, LIFTed code) is **not changed**. Display status is derived per step from its own status + the gate: done, waiting on Northwind (gate active), with SBC / MCA (in progress or under review), upcoming (locked), late (overdue). | status mapping in `client-portal/pages/incorporation` |
| Incorporation | "Approve & submit" with Undo, while the real approve sends e-mails at once | The POST is deferred: the toast offers Undo for its 3.2 s life; the request is sent only when the toast closes without Undo. | step page in `client-portal/pages/incorporation` |
<!-- /area:incorporation -->

<!-- area:compliances -->
## Compliances
| Area | Question | Decided | How to change |
|---|---|---|---|
<!-- /area:compliances -->

<!-- area:documents -->
## Documents and Library
| Area | Question | Decided | How to change |
|---|---|---|---|
<!-- /area:documents -->

<!-- area:team -->
## Team, Updates, Audit, Settings
| Area | Question | Decided | How to change |
|---|---|---|---|
<!-- /area:team -->

<!-- area:credentials -->
## Credentials and intro
| Area | Question | Decided | How to change |
|---|---|---|---|
<!-- /area:credentials -->
