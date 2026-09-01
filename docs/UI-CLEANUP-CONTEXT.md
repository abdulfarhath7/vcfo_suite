# Simplify & Clean — whole-app UI audit + cleanup context for Claude Code

**Mission:** Audit the entire VCFO Suite front end for clutter, redundancy, and self-explaining chrome, then clean it up so every screen is **simple, calm, and consistent**. This is a **presentation-only** pass — no behavior, data, routing, workflow, or IA changes.

**Work in two phases:** first **audit and report** (change nothing), then **fix** — safe/mechanical fixes proceed automatically, judgment calls wait for the owner. Maintain a progress file; this spans the whole app and should be resumable.

**North star — what "simple and clean" means here:**
> Say each thing once. Empty states are quieter than content, never louder. Sentence case, one plain voice. Decoration only where it aids scanning. A card should not need to explain what it is.

**Consistency anchor:** the Project Lead dashboard is canonical (`DESIGN-SYSTEM-INVENTORY.md`). When you simplify, converge on the canonical section header, empty state, and status pill — never invent a new variant.

---

## The eight anti-patterns to find and fix

Each has a heuristic to locate it and a fixed rule. Treat greppable heuristics as *candidate finders*, not proof — confirm by reading the screen.

**1. Duplicated / stacked headings.**
The page H1 says "Compliance calendar," then a card inside repeats "COMPLIANCE CALENDAR," then a line explains it. Three labels before any content.
→ *Find:* a card/section title string that matches the page H1/`PageHeader` on the same screen.
→ *Fix:* say it once. If the page has an H1, cards inside don't repeat it. Remove the redundant card title.

**2. ALL-CAPS tracked eyebrow labels.**
"WE NEED THIS FROM YOU", "WHOSE TURN IT IS", "COMPLIANCE RUNWAY", "COMPLIANCE CALENDAR". Uppercase + letter-spacing on every card is a generic-dashboard tell.
→ *Find:* `className` containing `uppercase` together with `tracking-` (wide/wider/widest), or literal all-caps title strings, especially on small text.
→ *Fix:* sentence-case section titles; drop the tracked-caps treatment. Keep a title only where the content isn't self-evident.

**3. Cards that explain themselves.**
A description sentence that just restates the card's title/purpose.
→ *Find:* card/panel where the body's first line paraphrases its own heading.
→ *Fix:* delete the restating sentence. Reserve description text for genuine guidance (e.g. the pre-COI calendar note), not self-definition.

**4. Over-built empty states.**
An empty state rendered as a decorated card — icon tile + heading + paragraph — when it should be quieter than real content.
→ *Find:* empty/`isEmpty`/`length === 0` branches that render a Card/Surface with an icon + title + description.
→ *Fix:* one muted, centered line in the content slot. No card wrapper, no icon tile, no eyebrow. Use the canonical empty-state component; if it's over-built too, simplify it once and reuse.

**5. Placeholder that competes with real content.**
The empty state sits in its own card that persists, instead of occupying the exact slot the real component fills.
→ *Fix:* empty state and the real component render in the **same** region — never both, never a leftover shell after data arrives. (Calendar: the pre-COI line lives where the calendar grid will render; post-COI the grid replaces it.)

**6. Icon tiles as default decoration.**
A coloured rounded-square icon beside every single card title.
→ *Find:* the same icon-tile wrapper repeated on most/all card headers.
→ *Fix:* keep icons where they aid scanning (nav, status, KPIs); drop them as blanket card ornament.

**7. Inconsistent / scolding copy.**
"Not provided yet" vs "—"; "0 Documents" vs "No certificates issued yet"; mixed casing and voice.
→ *Find:* grep for "Not provided yet", "No data", "None yet", "Nothing to show", and similar.
→ *Fix:* one voice — plain, sentence case. **Empty field value = "—"** (muted). **Empty region = one short human line.** Never a scolding or system-error tone.

**8. Duplicate-render / dead-link bugs surfaced during the audit.**
Anything shown twice (the calendar appearing twice), or controls that lead nowhere.
→ *Fix:* remove the duplicate render; flag any dead link/nav for a behavior fix (note it in the report — don't silently rewire logic in this presentation pass unless it's an obvious duplicate render).

**Also watch for (same spirit):** card-in-card-in-card nesting, redundant status text sitting next to a status chip, excessive dividers/borders, and two components doing the same job on one screen.

---

## Worked example (the screen that triggered this)

Compliance calendar, pre-COI. Current: page title "Compliance calendar" → card titled "COMPLIANCE CALENDAR" → sentence explaining it. Fix:
- Remove the redundant card title and the icon tile.
- Pre-COI: a single muted centered line where the calendar grid will render — "Your compliance calendar begins once your Certificate of Incorporation is issued." No card, no eyebrow.
- Post-COI: the calendar grid renders in that same slot. Empty state and grid never coexist.

That is the template for every empty/placeholder screen in the app.

---

## Do-not-break guardrails

- **Presentation only.** Do not change data, behavior, routes, workflow, the sequential gate, approvals, email/WhatsApp fan-out, or the repository seam.
- **Don't remove functionality** — buttons, nav, actions stay. Remove redundant *labels and decoration*, not features.
- **Don't delete genuine guidance copy** — simplify it (one line, no card), don't strip the meaning. The pre-COI calendar note stays, just calmer.
- **Reuse canonical components; invent nothing.** If simplifying reveals the canonical empty-state/header is itself over-built, fix it once and let every screen inherit.
- **Tokens only**, both light and dark; no hardcoded hex.
- **No IA changes, no screen merges, no redesign.** This is cleanup, not restructuring.
- **Don't fix clutter by adding more** — the answer is always *less*, never a new decorative element.

---

## How to work

1. Maintain **`UI-CLEANUP-PROGRESS.md`** at repo root; mirror the backlog below; log decisions. Resumable across sessions.
2. **Phase 1 (audit) changes nothing.** Walk the front end screen by screen and write **`CLEANUP-AUDIT-REPORT.md`** — a table:

   | Screen / file | Anti-pattern (#) | Current | Recommended fix | Risk |
   |---|---|---|---|---|

   Risk = **safe** (mechanical, no judgment) or **judgment** (wording/what-to-keep needs owner).
3. **Phase 2 (fix):** apply all **safe** fixes; leave `// TODO(owner):` + a report note on **judgment** ones. Fix one screen fully, verify, commit, continue.
4. Don't stop for permission on safe fixes; do stop (flag + continue) on judgment calls and on anything touching a guardrail.
5. Small, verified commits; keep the branch green.

---

## Build backlog

**P0 — audit**
- [ ] Walk every authenticated screen (all five roles) + public pages; write `CLEANUP-AUDIT-REPORT.md`. No code changes.
- [ ] Sanity-check the canonical empty-state / section-header / pill — note if they're over-built.

**P1 — safe fixes (mechanical)**
- [ ] Remove duplicated headings (#1) and self-explaining descriptions (#3).
- [ ] Replace tracked ALL-CAPS eyebrows with sentence case (#2).
- [ ] Normalize copy: empty value → "—", empty region → one line (#7).
- [ ] Simplify over-built empty states + place them in the content slot (#4, #5) — starting with the compliance calendar.
- [ ] Trim blanket icon-tile decoration (#6).

**P2 — judgment + bugs**
- [ ] Apply owner-reviewed judgment fixes from the report.
- [ ] Remove duplicate renders; flag dead links/nav for a separate behavior fix (#8).

**P3 — polish**
- [ ] Light/dark + responsive pass on every touched screen.
- [ ] Consistency audit vs. the lead dashboard; confirm no new variants were introduced.

---

## Verify (per screen)

- `npm run typecheck && npm run test` pass.
- The screen renders in both light and dark; nothing functional was removed.
- Each thing is said once; empty states are a single calm line in the content slot; copy is one voice with "—" for empty values.
- No new component variants; canonical components reused.

---

## What NOT to do

- Don't change behavior, data, routes, workflow, gate, approvals, or the repository seam.
- Don't remove buttons, nav, or features — only redundant labels/decoration.
- Don't restructure IA or merge screens.
- Don't invent new components or fix clutter by adding decoration.
- Don't silently delete guidance copy — simplify it.
- Don't rewire dead links in this pass — report them for a behavior fix.
- Don't declare done before the report exists and the P3 consistency pass is complete.
