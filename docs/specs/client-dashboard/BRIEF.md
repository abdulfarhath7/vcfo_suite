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

| Before | After |
|---|---|
| A tall hero with a greeting ("Good morning …") and the metric cards inside it | **A slim bar of very low height**: the **company name** (no greeting), the stage chip and a few status chips. The metric cards sit outside it. |

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
