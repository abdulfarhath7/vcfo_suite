# UI cleanup — audit report (Phase 1)

Per `docs/UI-CLEANUP-CONTEXT.md` §"How to work" step 2. **Phase 1 changes no
code.** This report is the input to Phase 2.

---

## Method and coverage — read this before trusting the table

The app has **87 authenticated routes** over five roles and **81 view
components**. I did not eyeball all 87. What I did:

1. Ran the doc's greppable heuristics across `src/` and `app/` as *candidate
   finders*.
2. Read the components the candidates pointed at, and read the highest-traffic
   screens end to end (client overview, client incorporation + step, client
   compliances/filings, lead Today + engagement detail, staff compliance).
3. Confirmed every row below by reading the code. Nothing here is grep-only.

**Not yet walked by eye:** most admin/super-admin screens, knowledge bank, vault,
mail/compose, settings, announcements, invites, and the public marketing pages.
The three systemic findings below almost certainly cover them (they are
component-level, and those screens use the same components), but their
screen-specific rows are missing. Finish that sweep before ticking P0.

---

## The three systemic findings (fix these first — everything else inherits)

These are the case the context doc anticipates: *"If simplifying reveals the
canonical empty-state/header is itself over-built, fix it once and let every
screen inherit."* All three are in canonical components, so one edit each fixes
dozens of screens and **no screen-by-screen churn is needed**.

### S1 — The canonical section header is anti-patterns #2 and #6, by construction

`DashSection` — the inventory's "Section header / title" — hardcodes both a
mandatory coloured icon tile and tracked ALL-CAPS:

```
src/components/dash/DashSection.tsx:41  grid h-7 w-7 … rounded-lg text-white   ← #6, not optional
src/components/dash/DashSection.tsx:49  text-[11.5px] font-extrabold uppercase tracking-[0.06em]   ← #2
```

`ClientCard` (`src/components/client/overview/ClientCard.tsx:62`) is a second
spelling of the same header with the identical classes — *two components doing
the same job*, which the doc also flags.

**Reach:** `DashSection` 27 uses across 18 files; `ClientCard` 8 uses.
**Fix (safe):** make the icon optional and default the title to sentence case in
both; then delete the duplicate by having `ClientCard` render `DashSection`.
**Risk:** safe — presentation-only, no API change if `icon` becomes optional.

### S2 — `.eyebrow` is a tracked-caps mono label, used 49×

```
app/globals.css:643   .eyebrow { @apply mono uppercase; letter-spacing: 0.18em; font-size: 10.5px }
```

Every `<Eyebrow>` is anti-pattern #2. Heaviest in `src/views/admin` (23) and
`src/views/client` (5). Separately, **174 hand-rolled `uppercase` + `tracking-*`
pairs** exist across 96 files — heaviest in `src/components/incorporation` (35),
`src/views/admin` (24), `src/components/client` (12).

**Fix (safe for the component, judgment for the 174 hand-rolled):** restyle
`.eyebrow` once to sentence case at normal tracking; sweep the hand-rolled ones
per screen afterwards.
**Risk:** safe (component) / judgment (per-screen sweep — some are table headers
where caps genuinely aid scanning, see S3).

### S3 — The canonical empty state is anti-pattern #4, used 36×

`EmptyStateIllustrated` renders a dashed, tinted `Surface` + a 64px icon circle
(or an illustration) + serif `<h3>` + paragraph + optional button:

```
src/components/noir/EmptyStateIllustrated.tsx:26-45
```

That is louder than the content it replaces. There are also **three different
empty-state spellings** in the codebase at once — this one, the inventory's
"in-panel one-liner", and `DashDataTable`'s `empty` prop default.

**Reach:** 36 uses. Worst concentrations: `FirmPeople` (9), `DocumentVaultPage`
(5), `AuditLog` (3).
**Fix:** keep the illustrated variant for genuinely full-page "you have nothing
at all" states; switch in-panel uses to the one-line form. Consolidate to two
spellings, not three.
**Risk:** judgment — deciding which of the 36 are full-page vs in-panel needs a
per-use call.

---

## Screen findings

| Screen / file | # | Current | Recommended fix | Risk |
|---|---|---|---|---|
| `src/views/compliances/ComplianceCalendarView.tsx` | 1, 3, 4, 5 | The doc's worked example, verbatim: page `<h1>Compliance calendar</h1>`, then a `DashSection` **titled "Compliance calendar"** with an icon tile, then a sentence explaining what a compliance calendar is. Pre-COI it is a card that persists in its own slot. | Drop the card title + icon tile. Render the pre-COI line as one muted centred line **in the slot the calendar grid occupies**, so the two never coexist. | safe |
| `src/views/compliances/FilingsView.tsx` | 1 | `<h1>Filings</h1>` and the error-branch `DashSection title="Filings"`. Tab sections are additionally titled "Monthly · Sep 2026" / "Quarterly" / "Annual", repeating the segmented picker directly above them. | Remove the duplicate "Filings" title; let the tab strip name the cadence and drop the section titles to the period only (or nothing). | safe |
| `src/components/client/overview/ClientActivityFeed.tsx:33` | 3, 7 | Empty copy is two sentences that define the card: *"Nothing recorded yet. Every action on your file — a document delivered, a filing made — shows up here as it happens."* | One line: "Nothing yet." | safe |
| `src/components/client/overview/ClientDeliverables.tsx:50` | 3, 4 | Empty state is a dashed tinted box + illustration + serif "No certificates issued yet" + a sentence listing what will appear. | One muted line in the tile slot. | safe |
| `src/components/client/overview/*` (8 cards) | 2, 6 | Every card carries a solid icon tile + tracked-caps title ("YOUR TEAM", "WHOSE TURN IT IS", "COMPLIANCE RUNWAY", "YOUR JOURNEY", "RECENT ACTIVITY", "YOUR DOCUMENTS", "WHERE WE ARE"). Eight tiles on one page. | Inherit from S1: sentence case, icons only where they aid scanning. | safe |
| `src/views/admin/Compliance.tsx` | — | **Checked, NOT a bug.** The two calendars (`StatutoryCalendar` L82, `ComplianceCalendar` L116) are on mutually exclusive tabs and never coexist. | No fix. Recorded so it is not "found" again. | — |
| `src/views/admin/Compliance.tsx:120` | — | Rolls its own table header (`text-[11px] uppercase tracking-wider`, hand-built grid) rather than `DashDataTable` (`text-[10.5px] font-extrabold tracking-[0.07em]`). A second table style. | Converge on `DashDataTable`. | judgment |
| `src/views/admin/Compliance.tsx` | — | Two different calendar components serve the same purpose across the two tabs. | Pick one; out of scope for a presentation pass. | judgment |
| `src/views/client/Compliances.tsx` | 8 | **Dead file.** Nothing imports it since the Compliances route became a group. Still ships 2 `EmptyStateIllustrated` uses that inflate the S3 count. | Delete. | judgment (deletion is not presentation) |
| `src/views/incorporation/useMilestoneResponseFormState.tsx:1075` | 7 | Two empty-value spellings coexist deliberately: the client record shows `—`, the staff form shows italic "Not provided yet". | Converge on `—` once it is confirmed the staff form does not rely on the wording. | judgment |
| `src/components/dash/DashDataTable.tsx:35` | 7 | Default empty copy is "Nothing here yet." — a third voice alongside "No filings recorded…" and "Nothing recorded yet." | One voice across all three. | safe |

---

## Counts

| Anti-pattern | Confirmed instances |
|---|---|
| #1 duplicated headings | 2 screens (both introduced by the recent filings build) |
| #2 tracked ALL-CAPS | 2 canonical components + 49 `Eyebrow` + 174 hand-rolled pairs / 96 files |
| #3 self-explaining copy | 3 confirmed (client overview cards) |
| #4 over-built empty states | 36 `EmptyStateIllustrated` uses |
| #5 placeholder competing with content | 1 confirmed (compliance calendar) |
| #6 blanket icon tiles | 35 icon-tile wrappers; mandatory in `DashSection` + `ClientCard` |
| #7 inconsistent empty copy | 5 distinct strings for the same idea |
| #8 duplicate render / dead link | 0 duplicate renders. 1 dead file (`views/client/Compliances.tsx`) |

**No dead links or dead nav found.** The one #8-class item is an orphaned file,
not a broken control.

---

## Recommended Phase 2 order

1. **S1** — make the icon optional + sentence-case titles in `DashSection`, and
   fold `ClientCard` into it. One edit, 35 call sites inherit.
2. **S2** — restyle `.eyebrow`. One edit, 49 call sites inherit.
3. The **compliance calendar** screen (the worked example) end to end.
4. **Filings** duplicate titles.
5. Copy normalisation (#7) — one voice, `—` for empty values.
6. **S3** — the 36 empty states, per-use judgment.

Steps 1–5 are safe. Step 6 and the table's `judgment` rows wait for the owner.
