# fix-b2-trends: 30-day trend lines on the home tiles (owner item B2)

Branch `fix/b2`, 31 Oct 2026. This fix continues commit 295ef1e.

## Result

| No. | Item | Status | What changed |
|---|---|---|---|
| 1 | Each count tile on the client home shows the last 30 days. Each day has one point. | ✓ | `pastDays` gives 30 India days (`TREND_DAYS`). The line has 30 past points and the live count. |
| 2 | The rebuild uses real records only. | ✓ | The rebuild reads step events, document requests, first uploads, filings and needs. No value is estimated. |
| 3 | A stored snapshot wins over the rebuild for the same day. | ✓ | `withSnapshots` puts the stored value on its day. The rebuilt value fills the other days. |
| 4 | Each metric uses one scoped query for the window. | ✓ | The client home uses 5 queries. The developer "Denied" tile now uses 1 query with counts per day. Before, it used 1 query per day. |
| 5 | The line starts on the engagement creation day when that day is less than 30 days ago. | ✓ | A day before the creation day is unknown. `trailingKnown` starts the line after it. |
| 6 | A tile with fewer than 2 real points shows the flat dashed line and "No history yet". | ✓ | No change was necessary. One past point and the live count make 2 points. |
| 7 | The sparkline stays 64 × 26 in the tile. | ✓ | No change to `DashHero`. |
| 8 | The tooltip shows the date and the value. | ✗ | The sparkline has no tooltip. The tile tooltip tells how the number is counted. No tooltip was added. |
| 9 | The staff homes use the same window. | ✓ | Lead, manager, admin and developer homes use 30 days. Tile order and meaning did not change. |
| 10 | The super admin home keeps month ends. | ✓ | Its tiles compare with last month. Daily points would change that meaning. It keeps 4 month ends (`TREND_MONTHS`). |

## Snapshots

| Home | Stored snapshots | Result |
|---|---|---|
| Client | None. No code writes a snapshot for a client tile. | The rebuild alone makes the line. |
| Lead, manager, admin | `kpi_snapshots` rows `tile:<home>:<tile>`, under the person's profile id. | The trends repository reads them in 1 query. A stored day wins over the rebuilt day. |
| Super admin, developer | None. | The rebuild alone makes the line. |

## Files

| File | Change |
|---|---|
| `src/lib/metrics/home-trends.ts` | `TREND_DAYS = 30`, `TREND_MONTHS = 4`, `withSnapshots`, `rollingDaySum`. |
| `src/lib/metrics/home-tile-stamps.ts` | `stampDays` gives 30 days. New `stampsByDay`. |
| `src/db/repositories/home-tile-stamps.ts` | `getHomeTileStampDays` replaces `getHomeTileTrends`. It reads only the caller's rows. |
| `src/db/repositories/home-trends.ts` | 30-day window. Snapshot merge per day for lead, manager and admin. One "Denied" query per window. |
| `app/api/metrics/home-trends/route.ts` | The route no longer merges the snapshots. The repository does it. |
| `src/components/client-portal/pages/home/CardsA.tsx`, `src/views/dev/DevOverview.tsx` | Comments only. |
| Tests | `home-trends.test.ts` (lib and repository), `home-tile-stamps.test.ts`, `client-home-history.test.ts`, `use-home-trends.test.ts`. Older pure tests use `pastDays(NOW, 4)`. |

## Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit -p .` | ✓ 0 errors |
| `npx eslint <changed files>` | ✓ 0 errors. 2 old warnings in `CardsA.tsx`. |
| `npx vitest run <related tests>` | ✓ 17 files, 176 tests |
| App or browser run | ✗ Not done. The owner rule does not permit it. |

## Open items

| No. | Item | Next action |
|---|---|---|
| 1 | The sparkline has no tooltip with a date and a value. | Ask the owner if a tooltip is necessary. |
| 2 | No code writes snapshots for client tiles. | Ask the owner if the client home must store its tile values each day. |
