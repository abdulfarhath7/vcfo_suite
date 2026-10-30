# Deploy report, 30 Oct 2026

- **Live:** https://app.sbctrack.in, App Runner service `vcfo-suite`, deploy SUCCEEDED at 12:03 IST.
- **Code:** `main` = 34169d0 (fast-forward from `ui/spectrum`). Image `vcfo-suite:34169d0`, also `:latest`.
- **Database:** RDS snapshot `vcfo-suite-db-pre-0030-20261030-1154` taken first, then migrations 0027 to 0030 applied (all additive). RDS now has 31 migrations.
- **Rollback:** image `vcfo-suite:rollback-72d2d7f` (the image that was live before). Retag it as `:latest` to roll back; the snapshot restores the database.
- **Checks before deploy:** typecheck clean, lint 0 errors, 3391 tests, `npm run build`, browser smoke on a production build 123 of 124 (the one failure is a demo file missing from local MinIO).
- **Live check:** public pages 200, app pages redirect to sign-in, no errors in the application log. A signed-in live smoke was not run: RDS has no test accounts.
- **Diff table** (`docs/ui-port/PROTOTYPE-DIFF.md`): 2043 ✓, 702 ◐, 5 ✗ of 2750, plus the Compliances section (24 rows: 19 ✓, 1 ◐, 4 ✗). Every ✗ has a reason or an owner decision.
- **Still to set on App Runner** for features that stay off until then: `CREDENTIALS_ENCRYPTION_KEY`, `RDS_INSTANCE_ID`, `VCFO_ASSIST_ENABLED`, `AUTH_MICROSOFT_ENTRA_ID_*`, `WHATSAPP_TEMPLATE_NAME_VERIFY_CODE`, and the IAM permissions listed in `docs/ui-port/fixes/xfix-dev.md`.
