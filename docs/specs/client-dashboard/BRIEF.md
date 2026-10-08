# Client dashboard: owner brief

Recorded 2026-10-08 from the owner's direction. This brief drives the design of the client home (`/app/client/overview`).

## The rule

**Improve the existing application. Do not build a new one.**

| # | Rule | Meaning |
|---|---|---|
| 1 | Keep the app's character | Keep the same shell: the SBC logo at the top, the sidebar, the top bar and the existing routes. |
| 2 | Pages, not pop-ups | Every option opens its real page in the app (Incorporation, Compliances, Documents, Team, Settings, …). Do not use pop-ups or drawers in place of pages. |
| 3 | Add features, colour and design | Bring in the features the app lacks and add colour and visual character. |
| 4 | Users' taste | Bold, visual, colourful and high contrast. Use donuts, coloured bars, filled icon circles and coloured status chips. Keep text short. |
| 5 | No redundancy | Remove repeated or useless cards. |

## Greeting card

Updated 2026-10-08 (second pass):

| Item | Rule |
|---|---|
| Height | Low, simple, like the current app |
| Title | The **company name**. No greeting ("Good morning …"). |
| Metric cards | **Inside** the greeting card, simple, as in the current app |
| Chips at the top (entity type, subsidiary, SPICe+ phase, "Waiting on you") | **Removed** (redundant) |
| Top-right action | **Download report** button |

## Which cards

The client home shows **only** the cards in canvas **v3** ("v3 — owner's preferences, bold & visual") on
https://claude.ai/artifact/V5wFoBBsQ3E2FFebgQ4rvW. There are two layouts:

- Before incorporation
- After incorporation, switched automatically by `isIncorporated()`

## References

| Reference | Use |
|---|---|
| Canvas v3 (Before V3 / After V3) | Which cards to show |
| `reference/owner-liked-v18.html` | The look the owner liked: navy and gold finance theme, KPI cards with an accent strip, gold accents on section titles, a calendar with date tiles, a task checklist, motion. **Do not copy** its pop-ups, its drawers, its "Client View / Welcome" header or its tall banner. |
| The running app (`src/views/client/*`, `src/components/client/overview/*`, `src/components/shell/*`) | The app's character, its pages and its real data |
| Users' taste (design system README) | Colour rules, with one meaning per colour |

## Steps

1. Design: a canvas with the existing shell and the new client home (before and after). Owner approval.
2. Prototype with a Before / After switch. Owner approval.
3. Build into the existing components, keeping the routes and data hooks.

## Second-pass feedback (2026-10-08)

| # | Area | Owner feedback | Direction |
|---|---|---|---|
| 1 | Registrations card (after COI) | The "Tax" group shows PAN, TAN and GST as value blocks. It does not look good. | PAN and TAN are company identifiers. They appear once, in the company card, and not as registrations. Redesign the card: the designer shows options for the owner to pick. |
| 2 | Incorporation steps (after COI, 14 blocks) | Clicking a block opens a **pop-up** with that step's details | A deliberate exception to "pages, not pop-ups". The pop-up links to the full step page. |

### Step pop-up content

| Block | Content | Shown when |
|---|---|---|
| Header | Step n of 14 · Part A / Part B · title · status chip · owner chip (You / SBC / MCA) | Always |
| What this step is | One line from the catalog | Always |
| Timeline | Started → submitted → reviewed → completed, each with date and person | Always (pending steps show the stages not yet reached) |
| What was provided | The client-visible answers (read-only key facts, for example the office address and the directors) | The step has answers |
| Documents | Files uploaded and documents delivered, each with a download | The step has files (board-resolution drafts are never shown) |
| Outcome | For example the SRN, the name approval letter or the COI | The step has an output |
| Needed from you | Items, due date and the person who asked | A pending step |
| Actions | Open full step · Ask VCFO about this step · Message the lead | Always |

Visibility follows `checklistStateForViewer`. A lead's draft is never shown to the client.

### Company IDs: masked, password to reveal (2026-10-08)

| Item | Rule |
|---|---|
| Masked by default | PAN, TAN (and any director PAN shown), for example `AAKC••••1M` |
| Shown in clear | CIN and GSTIN (public on MCA / GST portals) — owner may override |
| Reveal | Eye button → **password pop-up** → on success the value shows for a short time (for example 60 s) or until the page is left, with copy button; eye again hides it |
| Pop-up | Title "Confirm it's you" · password field (show/hide) · Confirm / Cancel · error on wrong password · "Forgot password?" link |
| Build notes (later) | Server re-verifies the password (rate-limited), returns a short-lived unlock; the reveal is written to the audit trail. The value is never sent to the browser before the unlock. |
