---
description: Run the gate (typecheck, lint, test) and summarise failures
---

Run `npm run check` from the repository root. It runs `npm run typecheck`, then `npm run lint`,
then `npm run test`, and stops at the first step that fails.

Then report in a few lines:

1. Which step failed, or "all green" with the test count.
2. For typecheck: each error as `path:line` and the message, grouped by file.
3. For lint: the error count and warning count, then each error as `path:line rule`. Say which
   errors are the known `jsx-a11y` errors in `src/components/client-portal/` (listed in
   `docs/STATUS.md`) and which are new.
4. For tests: each failing test name with its file and the first line of the assertion message.

If a step failed, run the later steps separately (`npm run lint`, `npm run test`) so the summary
covers all three. Do not fix anything unless asked; suggest the smallest fix for each failure.
