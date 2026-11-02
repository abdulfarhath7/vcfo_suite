# Brief for the diff agents (closing PROTOTYPE-DIFF.md)

Read this file, then `docs/ui-port/AGENT-BRIEF.md` (sources, class-name table, hard rules) and the
rows of `docs/ui-port/PROTOTYPE-DIFF.md` that your task names. The owner asked for every ✗ and ◐
row to become ✓.

## Sources

- Prototype, latest (2c978c5), extracted read-only at
  `/tmp/claude-1000/-home-farhath-Documents-vcfo-suite/895f3440-56fb-4fe3-bfa8-5ecbbb985771/scratchpad/proto`.
  `docs/RULES.md` (R-01 to R-49) is the design authority. Its `src/data/*` is fake sample data:
  never copy it into the real tool.
- Real tool: `/home/farhath/Documents/vcfo-suite`, branch `ui/spectrum`.

## How to close a row

1. Read the prototype part and the real part named in the row. Look at the actual markup, classes
   and CSS values. A row can be wrong; if the real tool already matches, say so in your report.
2. Make the real part match the prototype: layout, sizes, colours (tokens only, never hex in a
   component), icons, words, states (empty, loading, error), phone layout, dark mode, keys.
3. Keep every real feature, route, permission check and data source. A row marked "real only"
   or "Extra" stays as it is.
4. A row marked "no data": build the data path when the stored data can give it, through a
   repository that takes an AuthContext and scopes by role, with a cross-tenant test. When the
   data needs a new column or table, do not edit `src/db/schema*.ts` or migrations; write the
   exact column you need in your report and leave that part out.
   Migration 0027 (already applied locally) added `tasks.completed_at`,
   `document_requests.closed_at` and `engagement_step_events.review_status`; write them where
   tasks finish, requests close and reviews change, if your area owns that code.
5. Never show sample numbers. A part with no real data shows its real empty state.

## Shared files

- The foundations agent owns `src/components/{ui,dash,common}/*`, `app/globals.css`,
  `tailwind.config.ts`, `docs/design/*`, `src/lib/ui/*`.
- The shell agent owns `src/components/shell/*`, `src/components/ask/*`, and the client portal
  shell (`ClientPortalShell.tsx`, `Sidebar.tsx`, `TopBar.tsx`, `SearchPalette.tsx`) with their
  css-src files.
- Everyone else edits only the files of their own screens. When you need a change in a shared
  file, add a local part inside your own folder only if the shared part cannot take it, and
  write the request in your report. `DashHero` stats already take `of`, `note`, `trend`,
  `trendTone`, `bar`, `how`, `href`, `onClick`, and the card takes `scope`.
- The staff record agent builds the shared Gantt in `src/components/timeline/`. Other agents may
  import it once the file exists.

## Rules

- No git commands that change state; the hub commits. No dependencies. No browser.
- Client portal CSS: edit `css-src/*.css`, then run `node scripts/cp-css.mjs`.
- Next.js 16: read `node_modules/next/dist/docs/` before writing a route.
- Writing on screen: sentence case, plain dates, no helper sentences under buttons, no "please".
- Before you finish: `npm run typecheck` (other agents work at the same time; ignore errors in
  files you do not own and say so), `npx vitest run` on tests near your files (update tests for
  markup changes, never delete them), `npx eslint` on your files with 0 errors.

## Report

Write your result rows to `/tmp/claude-1000/-home-farhath-Documents-vcfo-suite/895f3440-56fb-4fe3-bfa8-5ecbbb985771/scratchpad/fix-<your-area>.md`
as a table: `| No. | New status | What you did, or why it stays |`, one row per diff row you own.
Then end with: files changed, new routes, schema needs, requests for shared files, and decisions.
