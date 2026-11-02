# Overnight M2 and M3 (2026-10-30)

Branch `ovn/m2`. Checks: `npx tsc --noEmit -p .`, `npx eslint` on the changed files, `npx vitest run`.
No schema change. No migration. Do not run `db:generate`.

## Next actions

| Next action | Owner |
|---|---|
| Look at the client home and the Incorporation page in a browser. | Owner |
| Merge `ovn/m2` after the review. | Owner |
| Tell us if "Steps done" must count all steps, not SPICe+ steps. | Owner |

## B1: five fixed home tiles

| Item | Status |
|---|---|
| Before the COI: Waiting on you · Overdue · With SBC · Documents in · Steps done | ✓ |
| After the COI: Waiting on you · Overdue · Due soon · Registrations · Incorporated | ✓ |
| An empty value shows "0" or "Not yet" | ✓ |
| Each tile keeps its click or drill | ✓ |
| Phone strip has the same tiles in the same order | ✓ |

| Files | Decisions |
|---|---|
| `src/components/client-portal/pages/home/CardsA.tsx` | No tile is conditional on data now. |
| `src/components/client-portal/pages/home/useMobileHome.tsx` | "Steps done" shows SPICe+ steps (done / total). The SPICe+ steps end at the COI. |
| | "Steps done" opens the steps drill. On the phone it opens the Done tab. |
| | "Expected COI" left the tile row. The days to the COI show as the note of "Steps done". |
| | "Documents in" shows the answered count and "/ total". The old value was the text "n/m". |

## B2: sparklines from real records

| Item | Status |
|---|---|
| Past points come from step events, requests, first uploads and filings | ✓ |
| Data goes through the repository with AuthContext scope | ✓ |
| A tile with no history shows a flat line and "No history yet" | ✓ |
| No number is invented | ✓ |

| Files | Decisions |
|---|---|
| `src/lib/metrics/client-home-history.ts` (new, pure) | The state of a past day is the current state with later step events undone. |
| `src/db/repositories/home-trends.ts` | A request closes at `closed_at`. If that is empty, it closes at its first file. |
| `src/hooks/use-home-trends.ts` (`tileTrend`, `NO_HISTORY`) | Unknown day: the line stops there (`trailingKnown`). |
| `src/components/dash/DashHero.tsx` (`trendEmpty` prop) | Overdue after the COI adds the overdue filings, point by point. |
| Tests: `client-home-history.test.ts`, `home-trends.test.ts`, `use-home-trends.test.ts`, `DashHero.test.tsx` | The "Incorporated" date tile has no line. A date has no count. |
| | Limit: answers and approvals in a step are read as they are now. Only status and review state are undone. |
| | Limit: a request that was cancelled before migration 0027 and has no file stops the request lines. |
| | While the trends load, a tile shows no line and no label. |

## C1: Recent activity

| Item | Status |
|---|---|
| Client home card: latest 5 rows, fixed height, "View all" opens Audit | ✓ |
| Phone card: latest 5 rows, fixed height, "View all" opens Audit | ✓ |
| `ClientActivityFeed`: latest 5 rows, fixed height, "View all" opens Audit | ✓ |
| Staff dashboards | ✓ (no "Recent activity" card exists there) |

| Files | Decisions |
|---|---|
| `src/components/client-portal/pages/home/CardsA.tsx` (`ACTIVITY_ROWS`) | Rows are 44 px and truncate the label. The full label is the tooltip. |
| `src/components/client-portal/pages/home/MobileCardsB.tsx` | Below 768 px the actor column is hidden, so each row stays one line. |
| `src/components/client/overview/ClientActivityFeed.tsx` | "Full log" became "View all". |
| Tests: `client-overview-modules.test.tsx`, `views/client/Overview.test.tsx` | |

## D1: no Registration section on Incorporation

| Item | Status |
|---|---|
| Phase 4 (Registration) left the client Incorporation page | ✓ |
| Registrations keep their own page | ✓ |

| Files | Decisions |
|---|---|
| `src/components/client-portal/pages/incorporation/data.ts` (`withoutRegistration`) | The page uses the model without phase 4: timeline, ST5 card, This week, status bars, step counts. |
| `src/components/client-portal/pages/incorporation/Landing.tsx` | The Status brief still gets the full model. |
| Test: `without-registration.test.ts` | |

## D2: timeline at the top

| Item | Status |
|---|---|
| Timeline card is under the page head and above the steps | ✓ |

| Files | Decisions |
|---|---|
| `Landing.tsx` | Order: page head, stat cards, timeline, ST5 card with This week and status. |

## D3: "Days to COI" stat card

| Item | Status |
|---|---|
| "Days to COI" is a `StatCard` in a top card row | ✓ |
| No floating text in the page head | ✓ |

| Files | Decisions |
|---|---|
| `Landing.tsx` | Row: Days to COI (or Incorporated after the COI), SPICe+ steps, All steps. |
| | The page title is "Incorporation". |
| | The early or late chip moved into the hint of the Incorporated card. |
| | Each card opens the same drill as before. |

## D4: hide the Before/After switch

| Item | Status |
|---|---|
| A client with a COI date sees no switch | ✓ |
| The view then shows After by itself | ✓ |
| Staff who preview keep the switch | ✓ (rule is in code, see note) |

| Files | Decisions |
|---|---|
| `src/lib/client-portal/types.ts` (`coiDate`, `viewer`, `showsBeforeAfterSwitch`) | The rule uses the incorporation date, not the CIN. |
| `src/db/repositories/client-portal.ts` | `effectiveAfter` returns After when the switch is hidden, also if an old "before" choice is stored. |
| `src/components/client-portal/Sidebar.tsx`, `TopBar.tsx` | The top bar, rail and drawer hide the switch and its slot. |
| Test: `src/lib/client-portal/before-after.test.ts` | Note: the portal shell is for clients only today, so `viewer` is always "client". A staff preview must set `viewer: 'staff'`. |

## Not done

| Item | Status | Reason |
|---|---|---|
| Browser, smoke and screenshot checks | ✗ | Owner testing rule. |
