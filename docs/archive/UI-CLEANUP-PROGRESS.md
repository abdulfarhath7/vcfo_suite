# UI cleanup — progress log

Source of truth: `docs/UI-CLEANUP-CONTEXT.md`. Report: `CLEANUP-AUDIT-REPORT.md`.
Read both on restart, then continue at the first unchecked item.

**Presentation only.** No behaviour, data, routing, workflow, gate, approval or
seam changes in this pass.

---

## P0 — audit

- [x] Sanity-check the canonical empty state / section header / pill.
      **All three findings are in the canonical components themselves** — see S1,
      S2, S3 in the report. Fixing them is the highest-leverage work here.
- [~] Walk every authenticated screen + public pages; write `CLEANUP-AUDIT-REPORT.md`.
      Report written. **Coverage is partial and the report says so:** 87
      authenticated routes exist; I read the high-traffic screens and every
      component the heuristics flagged, but most admin/super, knowledge bank,
      vault, mail, settings, announcements and the marketing pages have not been
      walked by eye. Their screen-specific rows are missing; the systemic
      findings almost certainly still apply to them.

## P1 — safe fixes

> The **client home** portion of #1/#2/#3/#4/#5/#6/#7 is now done under
> `docs/CLIENT-DASHBOARD-POLISH-CONTEXT.md` — see `CLIENT-DASHBOARD-POLISH-PROGRESS.md`.
> `ClientCard` already has an optional icon and a sentence-case title, so S1's
> shape is proven; applying it to `DashSection` makes the lead dashboard match.

- [ ] S1: `DashSection` icon optional + sentence-case title; fold `ClientCard` into it.
- [ ] S2: restyle `.eyebrow` to sentence case at normal tracking.
- [ ] Compliance calendar screen (#1, #3, #4, #5) — the worked example.
- [ ] Filings duplicate titles (#1).
- [ ] Copy normalisation (#7): one voice, `—` for empty values.
- [ ] Trim blanket icon tiles (#6) — falls out of S1.

## P2 — judgment + bugs

- [ ] The 36 `EmptyStateIllustrated` uses (S3): decide full-page vs in-panel per use.
- [ ] `views/admin/Compliance.tsx`: second table style; two calendar components.
- [ ] Delete the orphaned `views/client/Compliances.tsx`.
- [ ] Staff form "Not provided yet" → `—`.

## P3 — polish

- [ ] Light/dark + responsive pass on every touched screen.
- [ ] Consistency audit vs. the lead dashboard; confirm no new variants.

---

## Decisions / notes

- **Nothing has been changed yet.** Phase 1 is audit-only per the context doc, so
  this session produced the report and this log and no code edits.
- **The two duplicated-heading screens are mine.** `ComplianceCalendarView` and
  `FilingsView` came out of the filings build in the previous session and are
  exactly the worked example the context doc calls out. Fixing them is first in
  the P1 queue after the two component-level fixes.
- **`views/admin/Compliance.tsx` does not have the duplicate-calendar bug.** The
  two calendars sit on mutually exclusive tabs. Recorded so the audit does not
  "rediscover" it.
- **No dead links or dead nav were found.** The only #8-class item is an
  orphaned file.
- **S1/S2 are deliberately component-level.** Doing them first means no
  screen-by-screen churn for #2 and #6 — 35 and 49 call sites inherit the fix.
