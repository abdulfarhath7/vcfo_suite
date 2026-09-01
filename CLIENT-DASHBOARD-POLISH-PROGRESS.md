# Client dashboard — polish progress log

Source of truth: `docs/CLIENT-DASHBOARD-POLISH-CONTEXT.md`. Shares the
subtraction north star in `docs/UI-CLEANUP-CONTEXT.md`; the app-wide findings
live in `CLEANUP-AUDIT-REPORT.md`.

**Presentation + composition only.** No gate, approval, workflow, routing, data
or seam changes in this pass.

---

## P0 — subtraction

- [x] Tracked ALL-CAPS eyebrows → sentence case; blanket icon tiles trimmed.
- [x] Hero: filler subcopy and the duplicated `%` removed.
- [x] "Whose turn it is" cut pre-COI.
- [x] Activity feed: consecutive duplicates collapsed, quiet styling.
- [x] Documents + compliance runway: one calm line, in the content slot.

## P1 — composition

- [x] "Where we are" + "Your journey" merged into one progressive card.
- [x] Next-action card elevated as the focal point.

## P2 — adaptive

- [x] Pre/post-COI adaptation verified in the browser (§3 table).

## P3 — polish

- [x] Light + dark pass on the client home.
- [ ] Responsive/mobile pass.
- [ ] Consistency audit vs. the lead dashboard (see the open question below).

---

## What changed, zone by zone

**One edit did most of the work.** All eight client cards share `ClientCard`,
which is client-only — so making its `title` and `icon` optional and switching
the heading from `text-[11.5px] font-extrabold uppercase tracking-[0.06em]` to
`text-[13px] font-semibold` removed every tracked-caps eyebrow and every icon
tile on the page at once. No other role's dashboard is touched.

| Zone | Before → after |
|---|---|
| Hero | "We are getting Emburse started." → "Incorporation not started — the first step is yours." The `Complete %` stat is gone from the strip; the ring already owns it. |
| Next action | Eyebrow + icon tile removed; the step title now leads at `1.35rem` with a quiet label above it. Deep-link and target unchanged. |
| Progress | Two cards → one. Phase bars, then **See every step** expands the milestone track in place. Title is aspirational pre-COI ("Your path to an incorporated India entity"), factual post-COI ("Where we are"). The colour-key legend was dropped — it repeated all four phase names under bars that already carry them. |
| Whose turn it is | Hidden pre-COI (it restated the hero and the next-action card); returns post-COI. |
| Documents | Empty state is one line, and the **donut no longer renders when there are no documents** — a ring reading "1 document" above a line saying there are none was the two fighting each other. |
| Compliance runway | "Your compliance calendar begins once your Certificate of Incorporation is issued." — one line, no chrome. |
| Activity | Consecutive identical events collapse to the latest plus `×N`. The three-in-a-row "Client asked for a change on Client Details" now reads as one row with `×3`. |
| Team | Kept as-is apart from the sentence-case title. No SLA promise added. |

**Copy normalisation:** empty regions are now one short line in one voice
("Nothing yet.", "Your certificates will appear here as they are issued.").

---

## Verified

- `npm run typecheck` clean; `npm run test` 96 files / 872 tests pass, including
  4 new ones covering the run-collapsing and the merged progressive card.
- 0 eslint warnings across `src/components/client/overview`.
- **Pre-COI**, as `bharath@sbcllp.in` in the browser: filler subcopy gone, honest
  status line present, whose-turn hidden, one progress card, journey collapsed,
  no tracked-caps titles. Light and dark both clean.
- **Post-COI**, simulated by rewriting the scoped read in the browser (no DB
  writes): entity ID card, whose-turn returns, progress title flips to "Where we
  are", documents donut + deliverables, upcoming filings, and the
  "Certificate of Incorporation issued" status line. The page visibly enriches.
- No console or page errors in either mood.

---

## Open / flagged

- **`PhaseCelebration` still shows a tracked-caps "PHASE COMPLETE".** It is a
  shared component — `ChecklistClientWizard` uses it too — so changing it
  reaches beyond the client home and beyond this doc's scope. It belongs in the
  app-wide cleanup (`CLEANUP-AUDIT-REPORT.md` S2). Left alone deliberately.
- **Consistency audit is genuinely open, not skipped.** This pass moved the
  client home *away* from the lead dashboard's card anatomy: the lead still uses
  `DashSection` with its mandatory icon tile and tracked-caps title. Judged by
  the polish doc the client home is now correct; judged by
  `DESIGN-SYSTEM-INVENTORY.md` it has diverged from the canonical header. The
  cleanup report's **S1** resolves this properly — make `DashSection`'s icon
  optional and sentence-case its title, so the lead converges on the client
  rather than the client drifting. `// TODO(owner):` — confirm that direction
  before the two surfaces are compared again.
- Responsive/mobile pass not yet done.
