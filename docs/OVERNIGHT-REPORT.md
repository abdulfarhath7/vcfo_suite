# Deploy report, 30 Oct 2026

- **Live:** https://app.sbctrack.in, App Runner service `vcfo-suite`, deploy SUCCEEDED at 12:03 IST.
- **Code:** `main` = 34169d0 (fast-forward from `ui/spectrum`). Image `vcfo-suite:34169d0`, also `:latest`.
- **Database:** RDS snapshot `vcfo-suite-db-pre-0030-20261030-1154` taken first, then migrations 0027 to 0030 applied (all additive). RDS now has 31 migrations.
- **Rollback:** image `vcfo-suite:rollback-72d2d7f` (the image that was live before). Retag it as `:latest` to roll back; the snapshot restores the database.
- **Checks before deploy:** typecheck clean, lint 0 errors, 3391 tests, `npm run build`, browser smoke on a production build 123 of 124 (the one failure is a demo file missing from local MinIO).
- **Live check:** public pages 200, app pages redirect to sign-in, no errors in the application log. A signed-in live smoke was not run: RDS has no test accounts.
- **Diff table** (`docs/ui-port/PROTOTYPE-DIFF.md`): 2043 ✓, 702 ◐, 5 ✗ of 2750, plus the Compliances section (24 rows: 19 ✓, 1 ◐, 4 ✗). Every ✗ has a reason or an owner decision.
- **Still to set on App Runner** for features that stay off until then: `CREDENTIALS_ENCRYPTION_KEY`, `RDS_INSTANCE_ID`, `VCFO_ASSIST_ENABLED`, `AUTH_MICROSOFT_ENTRA_ID_*`, `WHATSAPP_TEMPLATE_NAME_VERIFY_CODE`, and the IAM permissions listed in `docs/ui-port/fixes/xfix-dev.md`.

## Deploy 2, 30 Oct 2026, 17:41 IST

- **Code:** `main` = 0f34763. It adds the practice block in every sidebar (R-51) with the staff Incorporation pages, the super admin Notifications bell, "Open page" on both bell popups, the announcement row that opens the fly-back popup again, and the rail fix.
- **Rail fix, root cause:** on the rail the plain rows' hidden label kept `relative flex-1` next to `sr-only`; `relative` wins in the built CSS, so the label stayed in the row and pushed the icon 11 px left. Group rows were centred. The rail label is now only `sr-only`. `e2e/rail.spec.ts` checks the icon column (±1 px) for admin, manager, lead and super admin at 1366 × 768. Screenshots: `docs/ui-port/shots/rail-before-admin.png`, `rail-after-admin.png`, `rail-after-super.png`.
- **Image:** `vcfo-suite:0f34763` = `:latest`. App Runner deploy SUCCEEDED 17:41 IST. No migration.
- **Rollback:** `vcfo-suite:rollback-34169d0`.
- **Note:** the earlier push of 1bf67ba never reached ECR; this deploy carries all of it.
- **Checks:** typecheck clean, lint 0 errors, 3415 tests, `npm run build`, smoke 126 of 127 plus 4 rail checks on a production build.
- **Live check:** public pages 200; the new Incorporation and Compliances routes redirect to sign-in when signed out; no errors in the application log.
