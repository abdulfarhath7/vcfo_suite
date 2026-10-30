# Overnight M8: report

Branch `ovn/m6`. Date: 30 Oct 2026. Written in ASD-STE100. ✓ = done. ✗ = not done.

## Next actions

| No. | Action | Who |
|---|---|---|
| 1 | Run `npm run db:seed-demo` with MinIO on. Then open a client Documents page and download a demo file. | Owner |
| 2 | Open a staff engagement page. Make sure that the SPICe+ attachments card shows under the Pre-Incorporation steps. | Owner |
| 3 | Open Filings as admin. Click Activities. Edit one activity. | Owner |
| 4 | Give the holiday calendar (X-20), the retention periods (X-22) and the Meta template (X-24). | Owner |

## Item 1: open ✗ rows in PROTOTYPE-DIFF.md

| Row | Status | Note |
|---|---|---|
| X-23 Activity master edit screen | ✓ | Commit 0ae8e94. Admin page `/app/admin/compliances/activities`. Super admin page `/app/super/practice/activities`. |
| X-23 entry point | ✓ | The Activities button is on Filings. Only admin and super admin see it. |
| X-23 edits | ✓ | Notify days (0 to 120), owner role, reviewer role, visibility (non-statutory only), confirm of an open point. |
| X-23 data | ✓ | Uses the existing GET and PATCH routes. The repository checks the role and writes the audit row. No schema change. |
| X-20 Holidays | ✗ | Skipped. It waits for the owner's holiday calendar. |
| X-22 Retention rules | ✗ | Skipped. It needs the owner's retention periods. |
| X-24 WhatsApp reminders | ✗ | Skipped. It needs an approved Meta template. |
| P-304, P-305, P-312 | ✗ | Skipped. The dev console agent owns them. |
| R-51 Practice block | ✓ | Row added. Commit b4c9b34. |
| R-52 Board resolution (NOC) | ✓ | Row added. Commit 5053b56. T6 in 6c673c5. |
| R-53 Landing v2 | ✓ | Row added. Commit f4f15c0. |

## Item 2: demo seed files

| Part | Status | Note |
|---|---|---|
| Placeholder for each demo document | ✓ | Commit ae762c9. `scripts/seed-demo.ts` uploads a one-page PDF for each row it writes to `documents`. |
| Placeholder for each request file | ✓ | `scripts/seed-demo-extras.ts` does the same for `document_request_files`. The client Documents page also reads these. |
| Storage helpers | ✓ | `src/storage/s3.ts` has `objectExists`. `src/storage/demo-placeholders.ts` has the key mapping and the upload. |
| Skip an existing object | ✓ | The seed does a HEAD first. It does not overwrite a file. |
| Demo seed only | ✓ | Only the two demo seed scripts call the helpers. |
| Storage down | ✓ | The seed writes one warning and continues. |
| Tests | ✓ | `src/storage/demo-placeholders.test.ts`, 7 tests. |

## Item 3: SPICe+ attachments list (T6)

| Part | Status | Note |
|---|---|---|
| Derivation | ✓ | Commit 6c673c5. `src/lib/spice-attachments/derive.ts`. Pure. No schema change. |
| Items | ✓ | Board resolution (NOC), parent entity certificate, registered office proof, director KYC, DIR-2, INC-9, MOA, AOA. |
| Status from records | ✓ | Step status, document pack readiness and NOC state give Not started, Waiting or Done. |
| NOC accepted | ✓ | The board resolution row shows Done. It links to the Vault copy (`/app/{role}/vault/view/{id}`). |
| SPICe+ filed | ✓ | When step SPICe+ Filing is complete, all rows show Done. |
| No board resolution | ✓ | When the board resolution steps are not applicable, the list leaves out that row and the parent proof. |
| Repository and scope | ✓ | `src/db/repositories/spice-attachments.ts` takes `AuthContext`. Staff only. Scope comes from `getDocPackInputs`. |
| Route | ✓ | `GET /api/engagements/:id/spice-attachments`. Documented in `docs/ui-port/BR-NOC-API.md`. |
| Screen | ✓ | `SpiceAttachmentsCard` uses `DashSection` and `DashDataTable`. Lead, manager and admin see it under the SPICe+ steps. Super admin sees it on the Steps tab. |
| Tests | ✓ | `derive.test.ts` (10 tests) and `spice-attachments.test.ts` (4 tests). |
| Browser check | ✗ | Not done. The owner rule forbids it. |

## Checks

| Check | Status | Note |
|---|---|---|
| `npx tsc --noEmit -p .` | ✓ | 0 errors. |
| `npx eslint` on changed files | ✓ | 0 errors. Only warnings that were there before, and the usual `metadata` export warning. |
| `npx vitest run` on related tests | ✓ | All pass. |
| App, browser, Playwright | ✗ | Not run. The owner rule forbids it. |
| Push | ✗ | Not done. The brief says do not push. |
