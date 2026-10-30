# Landing page v2 (R-53)

Spec: the prototype's `docs/LANDING-V2.md` at 5633d95 (rule R-53 in its `docs/RULES.md`). Branch `feat/br-noc`, 30 Oct 2026. Nothing is committed.

## Spec items

| Spec item | Status | What I did |
|---|---|---|
| R1/R2 one visual, one headline, one sentence per section (D1) | Done | Every section head is one h2 and one sentence. The hero lead, the section bodies and the tab lines are one sentence each, and a unit test checks this. Captions, legends, story-step text and the tab bullet lists are gone. |
| R3 labels inside the diagrams | Done | Rail, chart, ring (track labels plus one centre label), timeline and Gantt carry their own labels. |
| R4 two pinned, scroll-played diagrams | Done | `#incorporate` and `#comply` are `data-pin` tracks, 150vh tall with a sticky stage. `landing-motion.ts` maps the scroll to step 1 to 16, or to the ring turn and month. |
| R5 nothing starts hidden | Done | No `opacity: 0` rest states remain. Entrances are keyframes that end on the resting state and run only after `.in`. Reveals only move (`.rv`, 22 px), and only for blocks below the fold at load. Numbers are printed in full. Pinned diagrams play only once their top is in the upper half of the screen. Steps not reached yet stay at 0.55 opacity. |
| R6 plays once, replays on scroll back or click, reduced motion still | Done | `[data-play]` drops `.in` when it leaves the viewport and replays on return. A click on a diagram (not on a click-through item) replays it through `replay()`. Under reduced motion nothing is armed, played or pinned. |
| R7 / T3 height | Done | 1440×900: 8,135 px, which is 7.89 screens plus 1,036 px of pinned scroll. 390×844: 9,437 px. |
| 1 Hero on the first paint, two buttons (D11), logo still (F3), V2, V3 | Done | `.enter` animates transform only. The logo reveal no longer plays on load; it replays when you click the nav logo (kept, not removed). "See how it works" is removed from the hero. V2 `HeroStatus` switches "Name approval: In progress" to "Done" once after 2.2 s (at once under reduced motion). V3 `RegulatorRibbon` shows six token-coloured bands with a sheen. |
| 2 Number strip | Done | Kept 25 · 23 · 6 · 1 with one line each. It counts up in 0.8 s and now sits inside the hero section. |
| 3 `#journey` removed (D6) | Done | Its stage line is now a vertical rail beside the chart in section 4, with the same classes and animations: line draw, node rise, certificate pulse. `id="journey"` sits on the rail, so `/#journey` links from MarketingNav, the footer and /roles still land. |
| 4 `#incorporate` pinned, step list deleted (D2), V1, ≤1.5 screens | Done | The swimlane gains a row of 16 step dots, each titled with its checklist step name (pre-1 to pre-12, in order), plus a live "Step n of 16 · name" label. V1 adds a "NOC check" row: Ownership → Subsidiary → Foreign subsidiary → NOC, lit as one group with step 3 (signed board resolution). The rail highlights stage 1, stage 2 or the certificate as you scroll. |
| 5 `#after` one label per marker (D3), V4 | Done | Each pin is a day label plus one bold label; the descriptions and the five-item list are gone. V4 is a Gantt on the same 0 to 180 scale: board meeting / ADT-1 / INC-22 by day 30, SH-1 by day 60, FC-GPR as a dashed 30-day window after allotment, INC-20A by day 180. |
| 6 `#register` (D4) | Done | The diagram is unchanged. Tile colours come from `--lp-d*` via `color-mix`, and each cluster has a coloured top rule. The caption under the hub is deleted. The registration chips stay, as the labels inside the diagram. |
| 7 `#comply` pinned, one screenshot (D5), V5, D7 label | Done | The ring hand follows the scroll, and months not yet reached dim. V5 `BusyWeeks` is a 12×5 heat map counted from `ringItems()` (statutory dates only), and its months dim with the ring. One screenshot (the client calendar) remains. The centre label reads "each filing: owner · date · proof". The reminder strip (due date → reminder → filed) is kept with one label per box. |
| 8 `#record` removed (D7) | Done | Its idea is now the ring label. |
| 9 Comparison C2 | Done | Unchanged table, real logo, six rows. The ticks fill row by row once (`--r` stagger); the row text never moves. The "See how it works" link now points to `#incorporate`. |
| 10 `#portals` one screenshot, 5 tabs, D8 | Done | The headline is "One record, every role." Each tab has one line. On the client tab, the `AskBubble` asks "Where is my incorporation now?" and types "Your name application is with MCA. Expected 28 Oct." once when seen. The page holds the full answer, and a screen-reader copy is included. |
| 11 `#ask` removed (D8) | Done | Moved into section 10. |
| 12 `#trust` icon tiles | Done | Four tiles in one row (icon plus title). |
| 13 FAQ, 4 closed (D10) | Done | The four specified questions, each with a one-sentence answer, in two columns on wide screens. They sit under the trust row in the same section, as `#faq`. |
| 14 CTA and footer | Done | Kept. The footer's "#ask" link now goes to `#portals`. |
| D12 extra space | Done | Section padding 112 → 64 px (48 on phones), head margin 56 → 32 px, two-column heads on wide screens. |
| Book a demo, Ask guide, data-app click-through | Kept | The guide's "Show me" for the first question now targets `#incorporate`. A unit test checks that every guide `sec` and every `#` link resolves. |
| T1 first paint | Pass | Playwright with script off: h1, Book a demo and Try it live are visible at full opacity. With script on, no `#reveal` overlay appears. |
| T2 no blank section | Pass | Playwright, script on and off: no content block below 0.5 opacity. Full-page captures are attached to the test. Screenshots are no longer lazy-loaded, so the capture is not blank. |
| T3 height | Pass | Reported by the test. |
| T4 reduced motion | Pass | No running animations after scrolling the whole page, every diagram complete, no pin, chip shows "Done". |
| T5 390 px | Pass | No sideways scroll; pin stages are static and never play. |
| T6 Lighthouse | Not run | The machine is out of memory (swap full). earlyoom killed my dev server five times, so a Lighthouse run was not possible. To be done on a production build. |
| T7 unit tests | Pass | `LandingScreen.test.tsx` updated: 16 tests (was 6). |

## Files

- `src/components/marketing/landing/LandingScreen.tsx`: rewritten for the 9 sections.
- `src/components/marketing/landing/LandingParts.tsx`: ring (month data, track labels, D7 label), plus new `BusyWeeks` (V5), `HeroStatus` (V2), `RegulatorRibbon` (V3) and `AskBubble` (D8); the comparison row stagger.
- `src/components/marketing/landing/landing-motion.ts`: the new motion model (armed reveals, `[data-play]`, pinned tracks, `replay`, `PIN_QUERY`).
- `src/components/marketing/landing/content.ts`: `MONTHS`, `busyWeeks()`, `INC_STEPS`, `REGULATORS`, `ASK_Q`/`ASK_A`; the guide `sec` changed from journey to incorporate.
- `src/components/marketing/landing/landing.css`: rest states made visible, dead CSS for #record / #ask / legend / cal-two removed, and a v2 block added.
- `src/components/marketing/landing/LandingScreen.test.tsx`: updated and extended.
- `e2e/landing.spec.ts`: new. T1 to T5, the R4 scroll-play check and the height report. It is a new file outside `src/components/marketing`, written as the brief asked for a Playwright check. `app/page.tsx` is unchanged.

## Decisions for the owner

1. **Logo reveal (F3 against "never remove animations")**: it no longer plays on load, which was the cause of the 2 to 4 s blank hero. It replays when you click the nav logo instead, so the animation survives.
2. **9 sections**: the spec lists 11 surviving rows but targets 9. To reach 9, the number strip sits inside the hero section and the FAQ sits under the trust row in `#trust` (`#faq` still exists).
3. **Animations lost with removed sections**: the `#record` lane animation (lp-drop / lp-out) went with `#record` (D7). The hover pill on the old Ask panel went with `#ask` (D8). Every animation on a kept visual is still there, re-keyed so that it adds motion instead of revealing hidden content.
4. **"16 steps light up"**: the chart has six groups, so I added 16 step dots under it, named from `src/data/checklist.ts`, each lighting its group. The NOC row lights with step 3.
5. **D4 "text under each group"**: I read this as the hub caption and deleted it. The registration chips are the diagram's labels, so they stay.
6. **Sample data**: the only new sample values are the ones the spec gives ("Expected 28 Oct", "Name approval" on the demo company). The heat map is computed from the statutory ring dates. The FC-GPR window is drawn as a dashed "after allotment" window, not as a fixed date.
7. **Portals**: the per-tab bullet lists and "See the … portal" buttons are gone (R2). The screenshot and the bubble still open Book a demo.

## Before and after

| | Before | After |
|---|---|---|
| Sections (`main > section`) | 14 | 9 |
| Height at 1440×900 | 15,196 px (16.9 screens) | 8,135 px: 7.89 screens plus 1,036 px of pinned scroll |
| Height at 390×844 | 16,572 px | 9,437 px |

"Before" was measured on the already-running production server (`next start -p 3201`, old code). "After" was measured on a temporary dev server on port 3207, which is now stopped.

Gates: `npx tsc --noEmit -p .` clean. `npx vitest run src/components/marketing`: 20 of 20 pass. `npx eslint src/components/marketing e2e/landing.spec.ts`: 0 problems. Playwright `e2e/landing.spec.ts`: 8 of 8 pass, run with one worker against port 3207.
