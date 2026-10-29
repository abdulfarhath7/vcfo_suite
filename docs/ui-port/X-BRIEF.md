# Brief for the ✗ agents (30 Oct 2026)

The owner asked for every remaining ✗ row in `docs/ui-port/PROTOTYPE-DIFF.md` to be built. Read
this file, then `docs/ui-port/DIFF-BRIEF.md` (sources, how to close a row), `docs/ui-port/AGENT-BRIEF.md`,
the project `CLAUDE.md`, and your area's report in `docs/ui-port/fixes/` (it says why each row was
left ✗). The prototype is extracted read-only at
`/tmp/claude-1000/-home-farhath-Documents-vcfo-suite/895f3440-56fb-4fe3-bfa8-5ecbbb985771/scratchpad/proto`.

## Rules for this round

1. Some ✗ rows in the table are stale: a later round already built them. Check the code first; if
   it matches, mark the row ✓ and say so.
2. "No data" is no longer a reason to stop. Build the data path: schema, repository (AuthContext,
   role-scoped, cross-tenant test), route, UI.
3. **Schema:** you may add columns and tables, by `Edit` only (never rewrite a schema file), in
   `src/db/schema*.ts`, with a one-line comment per column. **Do not run `db:generate` or
   `db:migrate`, and do not write migration files.** The hub writes one migration (0029) for all
   agents at the end. List every schema change in your report under "Schema added".
4. External services (AWS, Microsoft, VCFO Assist extension): use only packages already in
   `package.json`, read settings from env vars, and add each new env var to `.env.example` with a
   comment. When the env var is not set, the part shows a clear "not set up" state, never fake data.
5. No sample numbers. No dependencies. No git commands that change state. No sub-agents.
6. Other agents work at the same time. Edit only the files your task owns; ask for shared changes in
   your report. Shared parts: `src/components/{ui,dash,common}/*` belong to the foundations agent.
7. Write your report to `docs/ui-port/fixes/xfix-<area>.md` after each screen, as
   `| No. | New status | What you did, or why it stays |`, then: files changed, new routes,
   schema added, env vars, requests, decisions.
8. Before you finish: `npx tsc --noEmit -p .` (ignore errors in files you do not own and say so),
   `npx vitest run` on tests near your files, `npx eslint` on your files with 0 errors.
