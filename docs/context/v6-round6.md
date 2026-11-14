# v6 — Round 6: P0 Clean · merge plan + RDS check

```
 STAMP   branch claude/nice-babbage-ny1h0f · commit b384a2b · main a4b9495 · 2026-11-14
         mode: DRAFT only · NO command below was run · no branch deleted
         legend [F] code/git · [A] assumption
 METHOD  conflicts predicted with `git merge-tree --write-tree origin/main origin/<b>`
         (read-only, writes no ref) [F]
```

---

## P0.1 · Branch triage (predicted conflicts vs main)

```
+-----+----------------------------------------------+------+--------------------------+
| Wave| Branch (one of each identical pair)          | Conf.| Action                   |
+-----+----------------------------------------------+------+--------------------------+
| W1  | claude/focused-lovelace-8ni8yg  (GST brief)  | 0    | merge                    |
| W1  | claude/festive-keller-ktdn9c   (collateral)  | 0    | merge                    |
| W1  | claude/keen-newton-8s24vl      (landing)     | 0    | merge                    |
| W1  | claude/inspiring-hamilton-uzyq6j (prompts)   | 0    | merge                    |
| W1  | ccr-d59597fb-kd9b9f            (CR doc)      | 0    | merge                    |
| W2  | kyc-and-registers-after-coi-eshwar           | 0    | merge                    |
| W2  | step-lock-staff-reminders-eshwar             | 0    | merge                    |
| W2  | client-calendar-before-incorporation-eshwar  | 0    | merge                    |
| W2  | board-meetings-after-coi-eshwar              | 0    | merge                    |
| W2  | registrations-before-coi-eshwar              | 0    | merge                    |
| W2  | locked-steps-not-late-eshwar                 | 0    | merge                    |
| W2  | client-sidebar-back-to-main-page-eshwar      | 0    | merge                    |
| W2  | client-phase-remove-journey-card-eshwar      | 0    | merge                    |
| W2  | board-resolution-signature-block-alignment-e.| 0    | merge                    |
| W3  | segmented-switch-design-system-eshwar        | 1    | rebase, merge            |
| W3  | no-filings-before-incorporation-eshwar       | 1    | rebase, merge            |
| W3  | remove-payroll-module-eshwar                 | 1    | OWNER: payroll? then     |
| W3  | cr/spice-forms                               | 2    | rebase, merge            |
| W3  | client-fixes-stage-checks-farhath            | 2    | rebase, merge            |
| W3  | docs-download-single-button-eshwar           | 2    | rebase, merge            |
| W3  | landing-hero-fixes-eshwar                    | 2    | rebase, merge            |
| W4  | cr-2026-11-gap-fixes-eshwar                  | 4    | author rebases           |
| W4  | excel-exports-server-side-eshwar  ┐ pick ONE | 5    | author picks + rebases   |
| W4  | exports-file-names-eshwar         ┘ (overlap)| 15   |                          |
| W4  | step-pages-panel-email-eshwar   ┐ overlap    | 6    | author rebases           |
| W4  | whatsapp-after-email-eshwar     ┘ (GL-07)    | 5    |                          |
| W4  | client-portal-breadcrumb-links-eshwar        | 5    | author rebases           |
| W4  | cr/board-resolution                          | 5    | author rebases           |
| W4  | checklist-rules-srn-expiry-eshwar            | 8    | author rebases           |
| W4  | board-resolution-panels-lead-queue-eshwar    | 8    | author rebases           |
| W4  | claude/relaxed-gates-iry9wm                  | 8    | author rebases           |
| W4  | e2e-failures-role-links-eshwar               | 9    | author rebases           |
| W4  | part-b-mca-display-order-eshwar              | 11   | author rebases           |
| W4  | docs-download-picker-eshwar ┐ overlap        | 11   | pick ONE                 |
| W4  | cr/document-downloads       ┘                | 11   |                          |
| W4  | toasts-tabs-breadcrumbs-eshwar               | 12   | author rebases           |
| W4  | docs-attachment-preview-download-eshwar      | 13   | author rebases           |
| W5  | claude/modest-rubin-tk62mr                   | 15   | likely superseded (main  |
|     |                                              |      | has 0056) → verify, close|
| W5  | chatbot · feat/ask-feeds-whatsapp            | many | archive; salvage gazette |
|     |                                              |      | feeds into reg-sources   |
+-----+----------------------------------------------+------+--------------------------+
 [!] High conflict counts on W4 suggest parts already reached main as squash
     merges [A]. Each author checks "is this already on main?" before rebasing.
```

---

## P0.2 · Exact commands (DO NOT RUN until owner says "build P0")

```bash
git fetch origin
git switch -c consolidate/p0 origin/main
```

```bash
for b in claude/focused-lovelace-8ni8yg claude/festive-keller-ktdn9c claude/keen-newton-8s24vl claude/inspiring-hamilton-uzyq6j ccr-d59597fb-kd9b9f; do git merge --no-ff --no-edit "origin/$b" || break; done
```

```bash
for b in kyc-and-registers-after-coi-eshwar step-lock-staff-reminders-eshwar client-calendar-before-incorporation-eshwar board-meetings-after-coi-eshwar registrations-before-coi-eshwar locked-steps-not-late-eshwar client-sidebar-back-to-main-page-eshwar client-phase-remove-journey-card-eshwar board-resolution-signature-block-alignment-eshwar; do git merge --no-ff --no-edit "origin/$b" || break; done
```

```bash
npm run check
```

```bash
npm run e2e:smoke
```

```
 W3, W4: each author runs, on their own branch:
   git fetch origin && git rebase origin/consolidate/p0   → fix → npm run check → PR
 Branch deletion: NOT in this plan (hard limit). Owner deletes after merge.
```

---

## P0.3 · RDS migration check (read only · DO NOT RUN here)

Prereq: SSM port forward per `docs/context/AWS-DEPLOY.md` [F drizzle.config].
Drizzle records applied migrations in `drizzle.__drizzle_migrations` (default) [A].

```sql
-- read only: how many migrations RDS has applied, and the last one
SELECT count(*) AS applied, max(created_at) AS last_applied_ms
FROM drizzle.__drizzle_migrations;
```

```sql
-- read only: do the tables of 0050-0057 exist?
SELECT t AS expected_table, to_regclass('public.' || t) IS NOT NULL AS present
FROM unnest(ARRAY['ask_attachments','assist_agent_runs','assist_recipe_patches',
  'assist_run_attestations','assist_filings','assist_filing_packets',
  'statutory_calendars','receivable_sheet_editors']) AS t;
```

```sql
-- read only: removed by 0056 (should be ABSENT after it)
SELECT t, to_regclass('public.' || t) IS NOT NULL AS still_present
FROM unnest(ARRAY['notice_cases','company_events','client_health_scores','sla_escalations']) AS t;
```

```
 Expected on a fully migrated RDS: applied = 58 (journal has 58 tags) [F]
 Table names in the 2nd query checked against src/db/schema*.ts [F].
```

---

## P0.4 · Other P0 items

```
+----+------------------------------------------------+--------+-------+
| #  | Item                                           | Effort | Owner |
+----+------------------------------------------------+--------+-------+
| C1 | Extension repo → private; host_permissions →   | 0.5 d  | Owner |
|    | mock hosts only until CS clears MCA            |        | + Dev |
| C2 | Purge seeded demo passwords on RDS             | 0.5 d  | Dev   |
|    | (clients:reset:prod exists [F])                |        |       |
| C3 | Apply pending migrations (after P0.3 check)    | 0.5 d  | Dev   |
| C4 | Store SBC-STD-AI-02 text in docs/policy/       | 0.5 d  | Owner |
| C5 | Send CS letter (CS-QUESTIONS.md + Part E L1-20)| 0.5 d  | Owner |
| C6 | Record date sent in ROADMAP.md phase 0         | 0.1 d  | Dev   |
+----+------------------------------------------------+--------+-------+
 P0 total ≈ 8-10 dev days (most in W4 rebases).
```

---

## Plan deltas

```
 D6.1  P0 = 5 waves. W4 (14 branches, 4-15 conflicts each) is the real cost.
 D6.2  Two overlap pairs (exports; download picker) need a pick, not a merge.
```

## Needs owner / CA

```
 Payroll keep or remove (W3) · say "build P0" to run P0.2 · RDS access for P0.3
```
