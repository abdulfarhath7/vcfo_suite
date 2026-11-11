# VCFO Suite: prompts for the brochure, corporate deck and one-pager

These three prompts produce the VCFO Suite versions of the three Fixtag by SBC files. They are the A4 brochure (14 pages), the 16:9 corporate deck (14 slides) and the A4 one-pager. Each prompt describes the whole VCFO Suite tool and puts its unique features (U1 to U10) first.

How to use them:

1. Copy one prompt, including its shared product block.
2. Paste it into Claude, ChatGPT, Gamma, Canva or another deck tool.
3. Attach the matching Fixtag file as the layout reference.
4. Attach the VCFO logo from `docs/specs/brand/logo/`.

Each prompt is complete on its own.

## Before you publish

- **Shipped versus built.** Many modules are built but not yet deployed. Per STATE.md this includes automation wave 2, Ask VCFO drop, receivables phases 8–10, payroll and labour registers. Either drop them from external material until they are live, or label them "coming soon".
- **Numbers.** Unlike the Fixtag files, which use "illustrative" market figures, these prompts forbid invented numbers. SBC fills each placeholder from its own records.
- **Reference layout.** Attach the matching Fixtag file and the VCFO logo (`docs/specs/brand/logo/`) to each prompt.

---

## Prompt 1: Brochure (A4 portrait, 14 pages)

Attach `Fixtag_by_SBC_Brochure.pptx` and `vcfo-logo-on-white.png`.

```text
PRODUCT: VCFO Suite by SBC (Steadfast Business Consulting) — app.sbctrack.in
WHAT IT IS: one web app that takes an Indian company from "we want to incorporate"
to "every filing done, every year". SBC (a CA/CMA-led firm) uses it to set up a
client's company and then run its whole compliance life, with the client inside the
same app. Software + the SBC team in one engagement, not a tool you are left alone with.
TAGLINE OPTIONS: "Your complete compliance companion." / "From incorporation to every
filing — one cockpit." / "Your virtual CFO, in one app."

THE WHOLE TOOL (cover all of it, grouped like this):
1. Incorporation engine — 34-step SPICe+ checklist in MCA order (Part A name intake,
   Part B capital, registered office, proposed directors, subscribers, KYC + DSC);
   steps open in the right order; red marks show missing fields; client and project
   lead fill directly, auto-save.
2. Document generator — MCA drafts built from the checklist answers: MOA, AOA, DIR-2,
   DIR-8, subscription sheets, declarations, authorisation and acceptance letters,
   board resolution; one set per director; "download all" as one ZIP; document pack
   shows what is still blocking each document.
3. Registrations — GST registration laid out like the portal's REG-01 tabs, plus the
   other post-incorporation registrations, each with its own tracker.
4. Compliance calendar — every company's yearly calendar (GST, TDS, PF, ESI, ROC/MCA,
   FEMA events); due-date reminders; filings register with proof; "Mark filed";
   statutory and non-statutory obligations; one six-word status language for everyone.
5. Board meetings — notice drafted by the lead from a 224-item agenda library, approved
   by the manager, emailed with the Word notice, calendar invite and Teams link;
   directors reply Yes/No from the email without logging in; quorum forecast;
   MoM upload and signing loop; resolutions carried into the next notice.
6. Receivables — invoice sheet per manager, automatic reminders (5 and 3 days before,
   on the due date, daily after), partner logins with promise-to-pay, bank-statement
   import (ISO 20022 camt) with auto-matching, TDS and bank-charge tolerance,
   foreign-currency invoices in nine currencies with a forex desk, ageing and cash
   forecast reports.
7. Payroll and labour registers — salary updates, payroll summary, statutory labour
   registers generated per establishment.
8. Proactive automation — request lists that chase the client for files (email, then
   WhatsApp, then a call task); expiry alerts at T-60/T-30/T-7 for licences, DSCs and
   registrations with an automatic renewal task; tax-notice tracking with T-7/T-2
   escalation; nightly client-health score with an SLA ladder (lead → manager →
   partner); "My day" card and email for every staff member; weekly digest.
9. Ask VCFO — AI assistant inside the app: answers "where is my incorporation?",
   explains due dates and rules with citations, links to the right page; staff can
   drop files, folders or ZIPs (up to 50 files) and Ask VCFO sorts them into one review
   card per client and proposes the form fill — a person always approves.
10. Client portal — the client's own shell: journey map, company snapshot, next step,
    due dates, documents explorer, requests, messages, team, audit log, credentials
    vault. Works on a phone.
11. Firm cockpit — five roles (super admin, admin, manager, project lead, client) on one
    app; manager approval gate (drafts stay hidden until a manager approves, the client
    only sees approved work); approvals inbox; analytics, practice reports, team load,
    risks; Outlook mail inside the app.
12. Trust and security — role scoping on every query (a client never sees another
    client's data); append-only audit log of every action; encrypted credentials vault;
    two-step sign-in (TOTP) and session control; AWS Mumbai (ap-south-1) with RDS and S3;
    email is the system of record, WhatsApp is an extra nudge that never blocks email.

UNIQUE FEATURES — give these the most space, the biggest type and the "proof" slots:
 U1  Incorporation to compliance in ONE app — same record, no hand-over, no re-entry.
 U2  Documents write themselves from the checklist — MCA drafts per director, one ZIP.
 U3  Manager approval gate — nothing reaches the client unchecked; every action logged.
 U4  The client is inside the app, not on email threads — own portal, own phone.
 U5  The app chases for you — request lists, expiry, notice and health automation.
 U6  Ask VCFO — an AI assistant that knows the client's actual status and files.
 U7  Board meetings end to end — notice, Teams, director Yes/No, MoM, signed resolutions.
 U8  Receivables with bank matching and forex — cash collection for the CFO, not just compliance.
 U9  India-native — SPICe+, REG-01, GST/TDS/PF/ESI/ROC/FEMA built in, not adapted.
 U10 Platform + SBC's CA/CMA team in one accountable engagement.

PROBLEM TO OPEN WITH (founders, CFOs, foreign parents setting up Indian subsidiaries):
 - Incorporation runs on email, WhatsApp and Excel; the client never knows the status.
 - Same director data typed again into ten documents; one typo means a resubmission.
 - After the COI, compliance lives in a different tool or a diary; due dates are missed.
 - Licences, DSCs and registrations lapse silently; tax notices get answered late.
 - Board meetings: notices, replies, minutes and signatures scattered across inboxes.
 - Collections chased by hand; bank credits matched in spreadsheets.

AUDIENCE: founders and directors of new Indian companies; Indian subsidiaries of
foreign parents (dependent companies); CFOs and finance heads; CA/CS firms.

BRAND: navy #15263B (primary, dark panels), logo orange #E9792F (small highlights
only), logo gradient yellow #FFC517 → orange #F08A21 → #E76028 for one thin rule at
most; white and warm off-white #FBF7F1 surfaces; status colours green done, amber
due soon, red overdue, blue in progress, grey upcoming. Public Sans for text, IBM Plex
Mono for identifiers (CIN, DIN, GSTIN, SRN). Calm, professional, no glow or glass,
no mascots, sentence case, dates like "14 Oct". Use the attached VCFO logo; do not
draw a new one.

RULES:
 - Do not invent statistics, client names, testimonials or percentages. Use only the
   numbers above (34 steps, 5 roles, 224 agenda items, 9 currencies, 50 files,
   T-60/T-30/T-7, AWS Mumbai). Where a market number or outcome is wanted, write a
   clearly marked placeholder like [SBC to confirm: number of incorporations done].
 - Every feature claim maps to something in the list above.
 - Write in plain full sentences. No filler.
 - Contact: info@sbcllp.in · app.sbctrack.in · Steadfast Business Consulting.

TASK: Create a 14-page A4 portrait (8.27 × 11.69 in) brochure for VCFO Suite.
Use the attached "Fixtag by SBC Brochure" only as the reference for structure, grid
and density (eyebrow label in orange caps, 24pt bold navy headline over two lines,
10.5pt lede, 2–4 column cards with a coloured top bar and a small code badge,
page number bottom right, tinted call-out strip at the foot). Replace every word of
Fixtag content with VCFO Suite content. Unique features (U1–U10) must be visibly
the hero of pages 1, 2, 7, 10 and 13.

PAGES:
1 Cover (navy full bleed): pill "COMPLIANCE COCKPIT", headline "Your company,
  incorporated and compliant — in one app.", lede on platform + SBC team; four stat
  tiles: "34 SPICe+ steps" · "5 roles, 1 app" · "Incorporation → compliance" ·
  "2-in-1 platform + CA team". Footer "Powered by Steadfast Business Consulting".
2 About — "Where software meets a CA firm's practice." Why SBC built it (the same
  incorporation run by email and Excel at client after client). Four "what makes us
  different" cards: Built by practitioners · India-native · One app from day 0 to every
  filing · Client inside the app. Premise strip.
3 The problem — "Most incorporations and compliance calendars run on inboxes." Six
  finding cards from PROBLEM; right column "The consequences" (penalties, late fees,
  lapsed licences, director embarrassment, lost months) and "Who this affects".
4 Product overview — "One platform for the company's whole life." A 7-step lifecycle
  strip: Onboard → Checklist → Documents → Incorporate → Register → Comply → Grow
  (meetings, receivables, payroll). Module table (MODULE | WHAT IT DOES | KEY
  CAPABILITIES) covering groups 1–9. Tinted strip about five roles and one approval gate.
5 Incorporation engine and document generator (U1, U2) — the 34-step checklist, Part A
  and Part B, direct-flow filling, the document pack, per-director drafts, ZIP. Show a
  small "answers → documents" diagram.
6 Compliance calendar and registrations (U9) — GST REG-01, the yearly calendar, filings
  register, six status words, reminders; a table "Obligation | Who | When | Where it
  shows" for GST, TDS, PF, ESI, ROC, FEMA.
7 The app chases for you (U5) + Ask VCFO (U6) — four automation cards (request lists,
  expiry alerts, notice escalations, client health + SLA ladder) and an Ask VCFO panel
  with sample questions and the "drop 50 files → one review card per client" flow.
8 Board meetings (U7) — the eight-step loop as a numbered flow: draft → approve → send
  with Word + invite + Teams → director Yes/No → quorum → meeting → MoM signing →
  resolutions carried forward.
9 Receivables, payroll and labour registers (U8) — reminders schedule, partner login,
  bank camt import and auto-match, forex desk in nine currencies, reports; payroll and
  labour registers as a second card.
10 Client portal and firm cockpit (U3, U4) — split page: left "What the client sees"
  (journey map, next step, documents, requests, messages, credentials vault, phone);
  right "What the firm sees" (approvals inbox, My day, analytics, team load, risks).
  Role table: Feature × Super admin / Admin / Manager / Lead / Client with ticks.
11 Trust and security — role scoping, audit log, encrypted vault, two-step sign-in,
  AWS Mumbai, email as system of record. "Suitable for" list.
12 Onboarding — "From first call to live in [SBC to confirm] days." Four phases:
  Discovery & project setup · Client questionnaire & checklist · Documents, filing &
  COI · Registrations & compliance calendar live. Three stat tiles + ongoing strip.
13 Why VCFO Suite — "Not another tracker. A managed outcome." Six cards from U1–U10,
  then two comparison boxes: "Compared to email + Excel" and "Compared to generic
  practice-management or task tools".
14 Back cover (navy) — "Let's set up your company properly." Three options: Live demo ·
  Incorporation consultation · Compliance health check. Contact block.

OUTPUT: an editable .pptx (one slide per page, A4 portrait), plus a short list of every
placeholder left for SBC to confirm.
```

---

## Prompt 2: Corporate deck (16:9, 14 slides)

Attach `Fixtag_by_SBC_Corporate_Deck_v2.pptx` and `vcfo-logo-on-black.png`.

```text
PRODUCT: VCFO Suite by SBC (Steadfast Business Consulting) — app.sbctrack.in
WHAT IT IS: one web app that takes an Indian company from "we want to incorporate"
to "every filing done, every year". SBC (a CA/CMA-led firm) uses it to set up a
client's company and then run its whole compliance life, with the client inside the
same app. Software + the SBC team in one engagement, not a tool you are left alone with.
TAGLINE OPTIONS: "Your complete compliance companion." / "From incorporation to every
filing — one cockpit." / "Your virtual CFO, in one app."

THE WHOLE TOOL (cover all of it, grouped like this):
1. Incorporation engine — 34-step SPICe+ checklist in MCA order (Part A name intake,
   Part B capital, registered office, proposed directors, subscribers, KYC + DSC);
   steps open in the right order; red marks show missing fields; client and project
   lead fill directly, auto-save.
2. Document generator — MCA drafts built from the checklist answers: MOA, AOA, DIR-2,
   DIR-8, subscription sheets, declarations, authorisation and acceptance letters,
   board resolution; one set per director; "download all" as one ZIP; document pack
   shows what is still blocking each document.
3. Registrations — GST registration laid out like the portal's REG-01 tabs, plus the
   other post-incorporation registrations, each with its own tracker.
4. Compliance calendar — every company's yearly calendar (GST, TDS, PF, ESI, ROC/MCA,
   FEMA events); due-date reminders; filings register with proof; "Mark filed";
   statutory and non-statutory obligations; one six-word status language for everyone.
5. Board meetings — notice drafted by the lead from a 224-item agenda library, approved
   by the manager, emailed with the Word notice, calendar invite and Teams link;
   directors reply Yes/No from the email without logging in; quorum forecast;
   MoM upload and signing loop; resolutions carried into the next notice.
6. Receivables — invoice sheet per manager, automatic reminders (5 and 3 days before,
   on the due date, daily after), partner logins with promise-to-pay, bank-statement
   import (ISO 20022 camt) with auto-matching, TDS and bank-charge tolerance,
   foreign-currency invoices in nine currencies with a forex desk, ageing and cash
   forecast reports.
7. Payroll and labour registers — salary updates, payroll summary, statutory labour
   registers generated per establishment.
8. Proactive automation — request lists that chase the client for files (email, then
   WhatsApp, then a call task); expiry alerts at T-60/T-30/T-7 for licences, DSCs and
   registrations with an automatic renewal task; tax-notice tracking with T-7/T-2
   escalation; nightly client-health score with an SLA ladder (lead → manager →
   partner); "My day" card and email for every staff member; weekly digest.
9. Ask VCFO — AI assistant inside the app: answers "where is my incorporation?",
   explains due dates and rules with citations, links to the right page; staff can
   drop files, folders or ZIPs (up to 50 files) and Ask VCFO sorts them into one review
   card per client and proposes the form fill — a person always approves.
10. Client portal — the client's own shell: journey map, company snapshot, next step,
    due dates, documents explorer, requests, messages, team, audit log, credentials
    vault. Works on a phone.
11. Firm cockpit — five roles (super admin, admin, manager, project lead, client) on one
    app; manager approval gate (drafts stay hidden until a manager approves, the client
    only sees approved work); approvals inbox; analytics, practice reports, team load,
    risks; Outlook mail inside the app.
12. Trust and security — role scoping on every query (a client never sees another
    client's data); append-only audit log of every action; encrypted credentials vault;
    two-step sign-in (TOTP) and session control; AWS Mumbai (ap-south-1) with RDS and S3;
    email is the system of record, WhatsApp is an extra nudge that never blocks email.

UNIQUE FEATURES — give these the most space, the biggest type and the "proof" slots:
 U1  Incorporation to compliance in ONE app — same record, no hand-over, no re-entry.
 U2  Documents write themselves from the checklist — MCA drafts per director, one ZIP.
 U3  Manager approval gate — nothing reaches the client unchecked; every action logged.
 U4  The client is inside the app, not on email threads — own portal, own phone.
 U5  The app chases for you — request lists, expiry, notice and health automation.
 U6  Ask VCFO — an AI assistant that knows the client's actual status and files.
 U7  Board meetings end to end — notice, Teams, director Yes/No, MoM, signed resolutions.
 U8  Receivables with bank matching and forex — cash collection for the CFO, not just compliance.
 U9  India-native — SPICe+, REG-01, GST/TDS/PF/ESI/ROC/FEMA built in, not adapted.
 U10 Platform + SBC's CA/CMA team in one accountable engagement.

PROBLEM TO OPEN WITH (founders, CFOs, foreign parents setting up Indian subsidiaries):
 - Incorporation runs on email, WhatsApp and Excel; the client never knows the status.
 - Same director data typed again into ten documents; one typo means a resubmission.
 - After the COI, compliance lives in a different tool or a diary; due dates are missed.
 - Licences, DSCs and registrations lapse silently; tax notices get answered late.
 - Board meetings: notices, replies, minutes and signatures scattered across inboxes.
 - Collections chased by hand; bank credits matched in spreadsheets.

AUDIENCE: founders and directors of new Indian companies; Indian subsidiaries of
foreign parents (dependent companies); CFOs and finance heads; CA/CS firms.

BRAND: navy #15263B (primary, dark panels), logo orange #E9792F (small highlights
only), logo gradient yellow #FFC517 → orange #F08A21 → #E76028 for one thin rule at
most; white and warm off-white #FBF7F1 surfaces; status colours green done, amber
due soon, red overdue, blue in progress, grey upcoming. Public Sans for text, IBM Plex
Mono for identifiers (CIN, DIN, GSTIN, SRN). Calm, professional, no glow or glass,
no mascots, sentence case, dates like "14 Oct". Use the attached VCFO logo; do not
draw a new one.

RULES:
 - Do not invent statistics, client names, testimonials or percentages. Use only the
   numbers above (34 steps, 5 roles, 224 agenda items, 9 currencies, 50 files,
   T-60/T-30/T-7, AWS Mumbai). Where a market number or outcome is wanted, write a
   clearly marked placeholder like [SBC to confirm: number of incorporations done].
 - Every feature claim maps to something in the list above.
 - Write in plain full sentences. No filler.
 - Contact: info@sbcllp.in · app.sbctrack.in · Steadfast Business Consulting.

TASK: Create a 14-slide 16:9 (10 × 5.63 in) corporate presentation for VCFO Suite, for a
live pitch to founders, CFOs and foreign parent companies. Use the attached "Fixtag by
SBC Corporate Deck v2" only as the reference for rhythm and layout: alternating light
slides and navy "impact" slides, orange eyebrow label, 28pt headline, 11.5pt lede,
3–4 cards per slide with a coloured top bar, big-number slides with orange 36pt
figures. One idea per slide. Speaker notes on every slide (60–90 words, spoken tone).
Put the unique features (U1–U10) at the centre: slides 4, 6, 8 and 11 exist only for them.

SLIDES:
1 Title (navy) — pill "COMPLIANCE COCKPIT"; "Incorporation to every filing. One app.";
  sub "VCFO Suite · Powered by Steadfast Business Consulting"; "Confidential · 2026".
2 The problem — three cards: Incorporation on email and Excel · Same data typed ten times ·
  Compliance in a diary after the COI.
3 The cost of getting it wrong (navy) — three big-number tiles using placeholders
  ([SBC to confirm: late fee per day for ROC filings], [typical months lost],
  [penalty example]) — real sources only, cited in a footnote.
4 VCFO Suite — the whole tool on one slide: four quadrant cards (Set up the company ·
  Keep it compliant · Run the board and the money · See and trust everything).
5 Platform capabilities — six module cards (incorporation, documents, compliance
  calendar, board meetings, receivables, payroll + labour registers).
6 What makes it different — the 10 unique features as a 5 × 2 grid of short tiles,
  U1–U4 highlighted in orange.
7 How one step moves — the five-box approval flow: Lead or client fills → Lead submits
  (missing-field check) → Manager reviews → Client sees only approved work → Everyone is
  told (email, bell, WhatsApp).
8 The app works between meetings (navy) — automation and Ask VCFO: request lists, expiry
  T-60/T-30/T-7, notice escalations, client health, "drop 50 files".
9 Built for Indian compliance — six cards: Companies Act 2013 / SPICe+ · GST (REG-01,
  returns) · TDS · PF and ESI · ROC and FEMA events · Labour laws (registers).
  Footer strip: Five roles · Manager approval gate · Audit log · Encrypted vault ·
  Two-step sign-in · AWS Mumbai.
10 One app, five roles — role table (role, main job, what they see) + the client portal
  screenshot placeholder.
11 Proof in the platform — four stat tiles (34 SPICe+ steps · 224-item agenda library ·
  9 currencies · AWS Mumbai) and six proof cards: per-director drafts, approval gate,
  board meeting loop, bank auto-matching, Ask VCFO with citations, audit log. Line:
  "Every claim here is a shipped feature we can show live."
12 Why SBC + VCFO Suite — four cards: CA/CMA-led · India-native · Software + services in
  one engagement · Secure, multi-role platform.
13 Get started (navy) — three CTA cards: Schedule a demo · Start with one company ·
  Book a compliance health check. Contact line.
14 Appendix — module reference table (two columns of module | features) covering all
  12 groups.

OUTPUT: an editable .pptx with speaker notes, plus a list of screenshot placeholders
(which app page to capture for each) and every [SBC to confirm] item.
```

---

## Prompt 3: One-pager (A4 portrait, 1 page)

Attach `Fixtag_by_SBC_One_Pager.pptx` and `vcfo-logo-on-black.png`.

```text
PRODUCT: VCFO Suite by SBC (Steadfast Business Consulting) — app.sbctrack.in
WHAT IT IS: one web app that takes an Indian company from "we want to incorporate"
to "every filing done, every year". SBC (a CA/CMA-led firm) uses it to set up a
client's company and then run its whole compliance life, with the client inside the
same app. Software + the SBC team in one engagement, not a tool you are left alone with.
TAGLINE OPTIONS: "Your complete compliance companion." / "From incorporation to every
filing — one cockpit." / "Your virtual CFO, in one app."

THE WHOLE TOOL (cover all of it, grouped like this):
1. Incorporation engine — 34-step SPICe+ checklist in MCA order (Part A name intake,
   Part B capital, registered office, proposed directors, subscribers, KYC + DSC);
   steps open in the right order; red marks show missing fields; client and project
   lead fill directly, auto-save.
2. Document generator — MCA drafts built from the checklist answers: MOA, AOA, DIR-2,
   DIR-8, subscription sheets, declarations, authorisation and acceptance letters,
   board resolution; one set per director; "download all" as one ZIP; document pack
   shows what is still blocking each document.
3. Registrations — GST registration laid out like the portal's REG-01 tabs, plus the
   other post-incorporation registrations, each with its own tracker.
4. Compliance calendar — every company's yearly calendar (GST, TDS, PF, ESI, ROC/MCA,
   FEMA events); due-date reminders; filings register with proof; "Mark filed";
   statutory and non-statutory obligations; one six-word status language for everyone.
5. Board meetings — notice drafted by the lead from a 224-item agenda library, approved
   by the manager, emailed with the Word notice, calendar invite and Teams link;
   directors reply Yes/No from the email without logging in; quorum forecast;
   MoM upload and signing loop; resolutions carried into the next notice.
6. Receivables — invoice sheet per manager, automatic reminders (5 and 3 days before,
   on the due date, daily after), partner logins with promise-to-pay, bank-statement
   import (ISO 20022 camt) with auto-matching, TDS and bank-charge tolerance,
   foreign-currency invoices in nine currencies with a forex desk, ageing and cash
   forecast reports.
7. Payroll and labour registers — salary updates, payroll summary, statutory labour
   registers generated per establishment.
8. Proactive automation — request lists that chase the client for files (email, then
   WhatsApp, then a call task); expiry alerts at T-60/T-30/T-7 for licences, DSCs and
   registrations with an automatic renewal task; tax-notice tracking with T-7/T-2
   escalation; nightly client-health score with an SLA ladder (lead → manager →
   partner); "My day" card and email for every staff member; weekly digest.
9. Ask VCFO — AI assistant inside the app: answers "where is my incorporation?",
   explains due dates and rules with citations, links to the right page; staff can
   drop files, folders or ZIPs (up to 50 files) and Ask VCFO sorts them into one review
   card per client and proposes the form fill — a person always approves.
10. Client portal — the client's own shell: journey map, company snapshot, next step,
    due dates, documents explorer, requests, messages, team, audit log, credentials
    vault. Works on a phone.
11. Firm cockpit — five roles (super admin, admin, manager, project lead, client) on one
    app; manager approval gate (drafts stay hidden until a manager approves, the client
    only sees approved work); approvals inbox; analytics, practice reports, team load,
    risks; Outlook mail inside the app.
12. Trust and security — role scoping on every query (a client never sees another
    client's data); append-only audit log of every action; encrypted credentials vault;
    two-step sign-in (TOTP) and session control; AWS Mumbai (ap-south-1) with RDS and S3;
    email is the system of record, WhatsApp is an extra nudge that never blocks email.

UNIQUE FEATURES — give these the most space, the biggest type and the "proof" slots:
 U1  Incorporation to compliance in ONE app — same record, no hand-over, no re-entry.
 U2  Documents write themselves from the checklist — MCA drafts per director, one ZIP.
 U3  Manager approval gate — nothing reaches the client unchecked; every action logged.
 U4  The client is inside the app, not on email threads — own portal, own phone.
 U5  The app chases for you — request lists, expiry, notice and health automation.
 U6  Ask VCFO — an AI assistant that knows the client's actual status and files.
 U7  Board meetings end to end — notice, Teams, director Yes/No, MoM, signed resolutions.
 U8  Receivables with bank matching and forex — cash collection for the CFO, not just compliance.
 U9  India-native — SPICe+, REG-01, GST/TDS/PF/ESI/ROC/FEMA built in, not adapted.
 U10 Platform + SBC's CA/CMA team in one accountable engagement.

PROBLEM TO OPEN WITH (founders, CFOs, foreign parents setting up Indian subsidiaries):
 - Incorporation runs on email, WhatsApp and Excel; the client never knows the status.
 - Same director data typed again into ten documents; one typo means a resubmission.
 - After the COI, compliance lives in a different tool or a diary; due dates are missed.
 - Licences, DSCs and registrations lapse silently; tax notices get answered late.
 - Board meetings: notices, replies, minutes and signatures scattered across inboxes.
 - Collections chased by hand; bank credits matched in spreadsheets.

AUDIENCE: founders and directors of new Indian companies; Indian subsidiaries of
foreign parents (dependent companies); CFOs and finance heads; CA/CS firms.

BRAND: navy #15263B (primary, dark panels), logo orange #E9792F (small highlights
only), logo gradient yellow #FFC517 → orange #F08A21 → #E76028 for one thin rule at
most; white and warm off-white #FBF7F1 surfaces; status colours green done, amber
due soon, red overdue, blue in progress, grey upcoming. Public Sans for text, IBM Plex
Mono for identifiers (CIN, DIN, GSTIN, SRN). Calm, professional, no glow or glass,
no mascots, sentence case, dates like "14 Oct". Use the attached VCFO logo; do not
draw a new one.

RULES:
 - Do not invent statistics, client names, testimonials or percentages. Use only the
   numbers above (34 steps, 5 roles, 224 agenda items, 9 currencies, 50 files,
   T-60/T-30/T-7, AWS Mumbai). Where a market number or outcome is wanted, write a
   clearly marked placeholder like [SBC to confirm: number of incorporations done].
 - Every feature claim maps to something in the list above.
 - Write in plain full sentences. No filler.
 - Contact: info@sbcllp.in · app.sbctrack.in · Steadfast Business Consulting.

TASK: Create a single A4 portrait one-pager for VCFO Suite that a founder or CFO can
read in 60 seconds and that SBC can attach to an email. Use the attached "Fixtag by SBC
One Pager" as the layout reference: navy hero band on the top third with a thin orange
top rule, four stat tiles, then two columns, then a navy footer CTA band. Dense but
legible: nothing smaller than 7pt. The unique features (U1–U10) are the reason this page
exists; they get the "proof" chip row and the centre of the page.

LAYOUT (top to bottom):
1 Hero (navy): "STEADFAST BUSINESS CONSULTING" eyebrow; headline "Your company,
  incorporated and compliant — in one app."; one-sentence lede; four stat tiles:
  "34 · SPICe+ steps" · "5 · roles, one app" · "1 · record from day 0 to every filing" ·
  "2-in-1 · platform + CA team".
2 Left column "THE PROBLEM": four bullets from PROBLEM.
  Right column "THE VCFO ANSWER": five numbered chips in a row — Set up → Document →
  Incorporate → Comply → Grow — and two lines on how the platform and the SBC team share
  the work.
3 Full-width "WHAT MAKES IT DIFFERENT": six cards in a 3 × 2 grid with coloured top bars
  — U1 one app, U2 documents write themselves, U3 approval gate, U5 the app chases for
  you, U6 Ask VCFO, U7/U8 board meetings and receivables.
4 Left "WHAT'S INSIDE": compact list of the 12 groups, one line each.
  Right "WHAT YOU RECEIVE": incorporated company with every MCA document; live
  compliance calendar and filings register; client portal logins; board meeting and
  receivables workflows; SBC team with SLA support.
5 "PROVEN IN THE PLATFORM" chip row (navy pills): Per-director MCA drafts · Manager
  approval gate · Append-only audit log · Encrypted credentials vault · Two-step sign-in ·
  AWS Mumbai · Email + WhatsApp + Outlook · Bank auto-matching · 9 currencies.
6 Footer band (navy): "Let's set up your company properly." · "Live demo · Incorporation
  consultation · Compliance health check" · "info@sbcllp.in · app.sbctrack.in ·
  Steadfast Business Consulting".

OUTPUT: an editable one-slide .pptx (A4 portrait) and a print-ready PDF.
```
