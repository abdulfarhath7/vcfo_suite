# 06 — Domain: incorporation catalog

Source of truth: `src/data/checklist.ts`. Do **not** invent steps, MCA form names, or unlock rules in a UI brainstorm. You may propose **how they look**, grouping, and which are intern-only vs client-visible.

Buckets in data: `pre-inc` | `post-inc` | `fema` | `statutory`.  
UI phases for intern: **SPICe+ Part A**, **SPICe+ Part B**, **Post-incorporation**, **Registration** (FEMA nested).  
Catalog titles still say “Phase 1 — Name Application” etc.

Each item: `id`, `slug`, `title`, `responsibleRole` (`client` | `intern`), forms, info required, deadline rule, optional `fields[]`, notes, expectedTimeline (intern UI **hides** “working days” SLA copy).

**Sequential gate** (`src/lib/checklist-step-gate.ts`): client cannot open step N until previous **active catalog** item is terminal. Intern can open any. Rejected/unlocked-for-correction re-locks everything after.

Statuses: `not-started` | `in-progress` | `awaiting-client` | `completed` | `overdue` | `not-applicable`.

---

## Phase 1 — SPICe+ Part A (Name Application) — 5 steps

| # | id | Title | Owner | What happens |
|---|---|---|---|---|
| 1 | pre-1 | Client Details | Client | Foreign/parent entity, KYC, 2 proposed names (*India Private Limited*), directors (≥2, ≥1 India resident), share capital, board resolution date, files. Unlocks BR generation. |
| 2 | pre-2 | Draft Board Resolution | Lead | Generate/edit docx, **finalize** = release to client + marks delivered + notify. Only finalize shares; re-click Send reopens compose, no duplicate in-app rows. |
| 3 | pre-3 | Signed Board Resolution | Client | Download finalized draft, sign on letterhead, upload. Unlocked only after Pre-2 finalized. |
| 4 | pre-4 | Name Application | Lead | File RUN/name with ROC, share acknowledgement. |
| 5 | pre-5 | Name Approval | Lead | Deliver approved name, dates (20-day validity), MCA letter. |

## Phase 2 — SPICe+ Part B (Incorporation) — 7 steps

| # | id | Title | Owner | What happens |
|---|---|---|---|---|
| 6 | pre-6 | Director KYC | Client | NR + resident directors, shareholders, registered office — Spice Part B / INC-35 Agile-Pro-S. |
| 7 | pre-7 | KYC Review & DSC | Lead | Review KYC, eMudhra DSC, draft DIR-2 / DIR-8 / INC-9, MOA/AOA sheets; generate panel. |
| 8 | pre-8 | Document Execution | Client | Apostille/notarise/sign; upload executed set. |
| 9 | pre-9 | SPICe+ Confirmation | Client | Review shared Part B, confirm or request changes. |
| 10 | pre-10 | SPICe+ Filing | Lead | File SPICe+ Part B + AGILE-PRO-S on MCA. |
| 11 | pre-11 | MCA Remarks | Lead | Remarks, clarification letter, resubmit. |
| 12 | pre-12 | Certificate of Incorporation | Lead | Share COI, CIN, PAN, TAN, PF, ESI + attachments. |

## Phase 3 — Post-incorporation — 11 steps (sheet order)

Owner: **Lead** on all of these.

1. First Board Meeting (30 days from inc.)  
2. Company Letterhead  
3. Bank Account Opening  
4. Share Capital Infusion (180 days)  
5. Share Certificates SH-1 (60 days)  
6. Commencement INC-20A (180 days)  
7. Auditor Appointment ADT-1 (30 days)  
8. FC-GPR Filing (FDI, 30 days from issue of shares)  
9. Nominee Shareholder MGT-4/5/6  
10. Registered Office INC-22  
11. Name Board at registered office  

IDs are not sequential (`post-9` is letterhead, etc.). UI must use **phase itemIds order**, not `order` alone.

## Phase 4 — Registration — 23 active steps

Mostly lead-owned statutory registrations. Intern UI groups by title matching:

| Group | Examples |
|---|---|
| General | PF, PAN/TAN, ESI, GST, PT, LEI, MSME |
| Customs | IEC, LUT, ICEGATE |
| Foreign Trade | Non-STPI |
| Labour | Shops & Establishment, CLRA, POSH / SHE Box |
| Local Compliance | Trade Licence |
| IP/Brand | Trademark, renewal, Patent, ICDR |
| FEMA | FCGPR (reg), FDI reporting, ODI, FLA, FCTRS |

`reg-2` PAN/TAN is **legacy-only** (not in phase itemIds). Do not surface as a current step.

FEMA-bucket extras nest under Registration for intern; they are not a fifth top-level phase.

## Review / email semantics (do not “simplify away”)

- Intern **Request manager approval** / **Submit** / **Email manager again** → `reviewSource=lead_manager_request` (or `resendManagerEmail`). Emails **managers only**.
- Intern **autosave** = `{ responses }` only — **no** email.
- Manager **Accept** → compose **to client**, CC firm admins + leads + progress CC.
- Client submit / document upload → Resend to **lead + every project manager**, From `{sanitized-company}@sbctrack.in`.
- Intern deliver / “Update client portal”: green toast + Received bell; first deliver opens Graph compose; re-deliver in-app only.

Copy for locked client steps: “This opens after {title} is complete.” / “Waiting on the client…” — never “access denied”.

## Adjacent domain (not the 34 steps)

- **Compliance calendar**: recurring GST, TDS, PF, ROC, FLA, etc. Generated from obligations + incorporation date. Separate from the checklist.
- **Create project wizard fields**: company type domestic/foreign, legal form company|llp|partnership|proprietorship, start stage (Pre-Inc vs later → subsidiary fields).
- **Legacy OnboardingWizard**: parallel questionnaire UI; not the live catalog. Restyle or retire; do not treat as a second source of steps.
