# 05 — Acceptance checklist

For the human, after the build.

## Automated
- [ ] `npm run typecheck && npm run test` clean
- [ ] `npm run build` passes
- [ ] `src/lib/assist-profile/` imports no `db`, no S3, no React, no `fetch`
- [ ] No migration file was added
- [ ] `git diff` touches no gate, email, or board-resolution code
- [ ] The parity test fails if a profile key is renamed

## By hand
- [ ] A fully filled engagement at Pre-4 shows a zero missing count
- [ ] A half-filled engagement lists real fields, each linking to the right step and
      section tab
- [ ] The control is absent in the client shell
- [ ] A manager not assigned to the engagement gets 403 from the route
- [ ] A client account gets 403
- [ ] The copied JSON parses, and `mcaLogin.userId` is empty
- [ ] Reordering directors on pre-15 changes their positions in the profile — confirm
      this matches what you expect before relying on a generated profile

## End to end, with the extension
- [ ] Paste the copied profile into the extension popup, click Preview, and confirm
      the listed values match the engagement
- [ ] Fill a SPICe+ Part A page and confirm the fields land
- [ ] No console error mentions a profile key `mapping.js` does not know
