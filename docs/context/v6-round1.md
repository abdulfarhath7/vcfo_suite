# v6 — Round 1: ground truth

```
 STAMP
   Branch    claude/nice-babbage-ny1h0f
   Commit    a4b9495f27102c4fa3bcb648128753ae7587e13e  (= origin/main, PR #69)
   Analyzed  2026-11-14
   Mode      analysis only · no code changed · not committed
   Legend    [F] fact, read in code/git   [A] assumption, not verified
```

---

## Q18 · Branch inventory

```
 SUMMARY
   86 remote branches · 63 ahead of main · PRITHISH = merged [F]
   Migrations on main: 0000 → 0057 [F]
   Migrations off main [F]: B1 0050_ask_row_edited (clashes with main
   0050_ask_drop) · B2 0041_portal_redesign_merge (clashes with main
   0041_receivables_send_status) · B16 0056 (same name as main's 0056)
   RDS level: unknown from here [A]. CLAUDE.md says 0026 (10-29),
   STATE.md lists 0034, 0050-0057 as "apply before deploy".
```

```
+----+------------------------------------------+-------+------------------------------+------+
| #  | Branch (unmerged commits / ahead)        | Files | What                         | Do   |
+----+------------------------------------------+-------+------------------------------+------+
| B1 | chatbot (109/115)                        | 249   | Old Ask VCFO line, 11-09     | ARCH |
| B2 | feat/ask-feeds-whatsapp (32/36)          | 675   | MCA gazette feeds, 11-05     | ARCH?|
|    |                                          |       | multiple merge bases         |      |
| B3 | cr-2026-11-gap-fixes-eshwar (16/26)      | 267   | CR-2026-11 gap fixes         | MERGE|
| B4 | e2e-failures-role-links-eshwar (14/21)   | 228   | E2E fixes, role links        | MERGE|
| B5 | excel-exports-server-side-eshwar (13/20) | 244   | GL-06 server exports         | MERGE|
| B6 | exports-file-names-eshwar (6/7)          | 117   | GL-06/08 overlaps B5         | PICK1|
| B7 | part-b-mca-display-order-eshwar (13/20)  | 219   | SB-01 Part B order           | MERGE|
| B8 | client-fixes-stage-checks-farhath (14/24)| 144   | Stage checks                 | MERGE|
| B9 | client-portal-breadcrumb-links (10/14)   | 103   | NV-03                        | MERGE|
| B10| toasts-tabs-breadcrumbs-eshwar (6/7)     | 67    | Toasts, tabs                 | MERGE|
| B11| checklist-rules-srn-expiry-eshwar (6/7)  | 65    | Client-only answers, SRN     | MERGE|
| B12| step-pages-panel-email-eshwar (6/7)      | 55    | GL-05, DR-03, GL-07          | MERGE|
| B13| board-resolution-panels-lead-queue (6/7) | 49    | BR-01/02/05                  | MERGE|
| B14| whatsapp-after-email-eshwar (6/7)        | 44    | GL-07 overlaps B12           | PICK1|
| B15| claude/relaxed-gates-iry9wm (5/5)        | 39    | NV-01/02/04                  | MERGE|
| B16| claude/modest-rubin-tk62mr (4/5)         | 151   | Health/notices removal; 0056 | CHECK|
|    |                                          |       | already on main [F]          |      |
| B17| claude/keen-newton-8s24vl (11/18)        | 13    | Landing                      | MERGE|
| B18| claude/festive-keller-ktdn9c (7/7)       | 20    | Collateral docs              | MERGE|
| B19| remove-payroll-module (1/1) x2           | 28    | Owner: remove Payroll        | DECID|
| B20| 9 "-eshwar"/"-farhath" PAIRS, 1 commit   | 1-25  | COI gating, step lock, etc.  | MERGE|
|    | each — pairs are byte-identical [F]      |       |                              | ONE  |
| B21| cr/spice-forms = spice-part-b-...-eshwar | 13    | Identical [F]                | ONE  |
| B22| cr/board-resolution = br-client-names    | 15    | Identical [F]                | ONE  |
| B23| 13 branches with 0 unique commits        | -     | Squash-merged already [F]    | DEL  |
| B24| 6 docs-only (focused-lovelace = GST      | 1-29  | Research, prompts, CR doc    | MERGE|
|    | legal brief, inspiring-hamilton, ccr-*)  |       |                              | DOCS |
+----+------------------------------------------+-------+------------------------------+------+
```

```
 MERGE ORDER (proposal)
   1 Delete B23 (0 unique)        2 Merge B20-B22 (one of each pair)
   3 B11 → B12 → B14? → B10       (checklist + step pages, small)
   4 B5 vs B6: pick one, rebase other
   5 B3 · B4 · B7 · B8 · B9 · B13 · B15   (large CR-2026-11, conflicts likely)
   6 B16 check vs main 0056       7 B19 after owner decision
   8 B1, B2: archive or salvage gazette feeds into reg-sources
```

```
 [!] FINDINGS
   F18.1  Payroll: owner asked to REMOVE it (B19). Round-0 table said "fix
          D-T16-01 first" — that advice is void if B19 merges.
   F18.2  ~30 commits of CR-2026-11 work sit outside main. Facts below
          describe main only.
   F18.3  RDS migration level must be read on RDS (drizzle journal table).
```

---

## Q19 · Firm rules + guards vs v5

Sources: `docs/specs/vcfo-assist-agents/SAFETY.md` (rules 1-3, G1-G18),
`src/lib/registrations/gst-tracker.ts:8`, `docs/context/notes/checklist-workflow.md:233`.
[F] The SBC-STD-AI-02 policy text itself is NOT in the repo; only references.

```
+-----+----------------------------------+----------------------------+--------+
| v5  | v5 claim                         | Rule / guard               | Result |
+-----+----------------------------------+----------------------------+--------+
| §3  | AI plans, scripts act            | G10 AI picks index only    | MATCH  |
| §5  | Extraction LLM: no tools,        | masked-provider.ts         | MATCH  |
|     | schema, cannot approve           | askChangesets + approval   |        |
| §5  | Images to zero-retention LLM     | ASK_ID_DOC_READING flag;   | MATCH  |
|     |                                  | Bedrock India only         | [A]prod|
| §6  | Route 1 Income Tax API           | Rule 1 (unclear=banned),   | GATED  |
|     |                                  | pack mock-only             |        |
| §6  | Route 2 GSTZen API (GST)         | SBC-STD-AI-02: no machine  | CONFL  |
|     |                                  | portal access on GST;      |        |
|     |                                  | owner ask declined 11-11   |        |
| §6  | Route 3 file upload server-side  | G7 no portal calls (ext.); | CONFL  |
|     |                                  | server-side = new; Rule 1  | (part) |
| §6  | Ext. opens tab, user logs in     | G1, G12                    | MATCH  |
| §6  | Pauses for OTP/captcha/DSC       | G2, G3, G6                 | MATCH  |
| §6  | Human clicks Submit              | G4, G17 certifier gate     | MATCH+ |
| §6  | Server never stores passwords    | G8 says same; BUT          | CONFL  |
|     |                                  | engagement_credentials     | (code) |
|     |                                  | stores ID+password [F]     |        |
| §6  | AI finishes step live, token     | G9 values never to AI;     | CONFL  |
|     | injector swaps value             | G10 no value/selector out; |        |
|     |                                  | G13 fill table approved    |        |
| §6  | AI drafts recipe fix, approved   | assistRecipePatches + G15  | MATCH  |
| §6  | Sandbox test on dummy data       | G11 mock only; G16 no      | MATCH  |
|     |                                  | placeholder values LIVE    |        |
| §6  | Temporal, UNKNOWN → check_status | Inngest; filing-state.ts   | DIFF   |
| §7  | Drift watch: canary on dummy     | G11 OK on mock; live canary| CONFL  |
|     |                                  | = test data live (Rule 3)  | (live) |
| §7  | Rule watch reads CBIC/MCA/CBDT   | reg-sources, reg-updates   | MATCH  |
| §8  | AI sees masked tokens only       | G9 + masker                | MATCH  |
| §9  | Ext. Chrome MV3                  | WXT, signed recipes (G15)  | MATCH  |
| §9  | Org IT may force-install         | G18 force-install ONLY,    | MATCH  |
|     |                                  | never Web Store            |        |
| §11 | Fields encrypted PAN/Aadhaar/bank| checklist_state jsonb plain| GAP    |
|     |                                  | (RDS-level KMS only) [F]   |        |
| §13 | Append-only tamper-evident log   | audit_events FK actor      | GAP    |
|     |                                  | ON DELETE CASCADE [F]      |        |
| §12 | RPO≈0, RTO<1h, Hyd replica,      | 7d PITR + 30d AWS Backup,  | GAP    |
|     | Multi-AZ, 3-2-1                  | multi_az=false, 1 region   |        |
| §5  | S3 Object Lock                   | S3 versioning + KMS, no    | GAP    |
|     |                                  | Object Lock [F]            |        |
+-----+----------------------------------+----------------------------+--------+
 Counts: MATCH 13 · CONFL 6 · GAP 4 · DIFF 1 · GATED 1
```

```
 [!] FINDINGS
   F19.1  G8 vs engagement_credentials: the guard and the code disagree today.
          src/db/schema-portal-credentials.ts:36 (login sheet, secret cols).
   F19.2  v5 "AI mode" breaks G9, G10, G13. Drop it or write a new guard.
   F19.3  v5 live canary breaks Rule 3 (test data on a public register).
          Canary = mock only; live drift = passive DOM diff on real runs.
   F19.4  SBC-STD-AI-02 is cited in code but not stored. Add it to docs/.
```

---

## Q24 · Data model: v5 entities vs schema

164 tables in `src/db/schema*.ts` [F].

```
+---------------------+-------------------------------------------+--------+
| v5 entity           | Tool today                                | Action |
+---------------------+-------------------------------------------+--------+
| tenant              | NONE. firm_settings id='firm' (1 row)     | ADD    |
|                     | schema-firm.ts:44                         | (E1)   |
| client master       | engagements + checklist_state jsonb +     | KEEP   |
|                     | engagementClients; assist-profile builds  | +VIEW  |
| mailbox (N/tenant)  | outlookConnections (1 per user, delegated)| CHANGE |
|                     | + mailGroups (send side)                  |        |
| inbound message     | NONE (no mail ingest queue)               | ADD    |
| evidence object     | documents + S3 (versioned) + packet-hash  | CHANGE |
|                     |                                           | (lock) |
| extraction staging  | askAttachments + askChangesets            | REUSE  |
|                     | (content_hash, decided_by) [F]            |        |
| exception queue     | NONE as table (low-confidence rows)       | ADD    |
| maker-checker       | step approvals; askChangesets decide;     | REUSE  |
|                     | BR approval                               |        |
| forms-as-data       | PARTIAL: complianceObligations.due_rule   | CHANGE |
|                     | (jsonb), statutoryCalendars/Deadlines.    |        |
|                     | Checklist = CODE (src/data/checklist.ts)  |        |
| recipe              | JSON files in assist-agents/recipes (code,| KEEP   |
|                     | signed) + assistRecipePatches             |        |
| capability registry | assist-agents/catalog.ts, registry.ts,    | EXTEND |
|                     | packs/*.json (9 portals)                  |        |
| agent run           | assistAgentRuns, assistRuns               | MERGE? |
|                     | (2 tables, 2 schema files) [F]            |        |
| filing / receipt    | assistFilings, Documents, Signers,        | REUSE  |
|                     | Packets; filing-state.ts                  |        |
| attestation         | assistRunAttestations (G17)               | REUSE  |
| audit log           | auditEvents (cascade on actor delete)     | FIX    |
| consent registry    | NONE. Only WhatsApp consent column        | ADD    |
|                     | (schema.ts:92)                            |        |
| retention / purge   | NONE. soft delete on 4 tables only        | ADD    |
| bank change request | NONE                                      | ADD    |
| due-date / late fee | src/data/late-fee-rules.ts (code)         | KEEP   |
+---------------------+-------------------------------------------+--------+
 ADD 6 · CHANGE 4 · FIX 1 · REUSE 5 · KEEP 4 · EXTEND 1
```

```
 [!] FINDINGS
   F24.1  No tenant concept anywhere. Every repository scopes by role +
          engagement, not by firm. E1 decides the cost.
   F24.2  Two run tables (assist_runs in schema-portal-compliances.ts:149,
          assist_agent_runs in schema-assist.ts:39). Check overlap.
   F24.3  The 34-step checklist is code. "Forms as data" (v5 §9) is true
          for obligations, false for the checklist. Golden rule 3 protects it.
```

---

## Q21 · PII inventory

```
+-----------------------+-------------------------------+-------+-----------+------+--------+
| Field                 | Where [F]                     | Enc.  | To AI?    | Ret. | Purge  |
+-----------------------+-------------------------------+-------+-----------+------+--------+
| Director PAN, DIN,    | engagements.checklist_state   | RDS   | Masked    | none | none   |
| Aadhaar (auth. sign.),| (jsonb) schema.ts:166         | KMS   | (mask.ts) |      |        |
| passport, DOB, addr.  |                               | only  |           |      |        |
| Bank account          | checklist_state; receivables  | RDS   | Masked?   | none | none   |
|                       | .bank schema-receivables:469  | only  | [A]       |      |        |
| Director DIN/email/   | companyDirectors              | RDS   | Masked    | none | none   |
| phone                 | schema-board-meetings.ts:34   | only  |           |      |        |
| Portal ID + password, | engagement_credentials        | AES-  | No        | none | none   |
| mobile, DOB, PAN,     | .secret_ciphertext :47        | GCM   |           |      |        |
| Aadhaar               | key CREDENTIALS_ENCRYPTION_KEY| [!]key|           |      |        |
|                       |                               | unset |           |      |        |
| Portal OTPs           | credentialOtps :64            | ?[A]  | No        | ?    | ?      |
| Staff/client email,   | profiles schema.ts:83,89      | RDS   | Masked    | none | delete |
| phone                 |                               | only  |           |      | (prof.)|
| Password              | profiles.password_hash        | bcrypt| No        | -    | -      |
| TOTP secret           | profiles.totp_secret_enc :116 | enc.  | No        | -    | -      |
| Outlook tokens        | outlookConnections :949-950   | enc.  | No        | -    | -      |
| ID document images    | S3 documents                  | SSE-  | YES, raw  | none | none   |
|                       |                               | KMS   | if ASK_ID_|      |        |
|                       |                               |       | DOC_READ. |      |        |
| Uploaded docs (text)  | askDocuments / askChunks      | RDS   | Masked    | none | none   |
| Prospects / demo req. | prospects, demoRequests       | RDS   | No        | none | none   |
|                       | schema-firm.ts:149,196        | only  |           |      |        |
| Certifier/user email  | assistAgentRuns, Attestations | RDS   | No (G14)  | ≥1y  | none   |
| Mail recipients       | failedEmails, emailSendLog    | RDS   | No        | none | none   |
| WhatsApp consent      | profiles (schema.ts:92)       | -     | -         | -    | -      |
+-----------------------+-------------------------------+-------+-----------+------+--------+
```

```
 [!] FINDINGS
   F21.1  No field-level encryption for PAN/Aadhaar/bank in checklist_state.
          v5 §11 claim is false today.
   F21.2  Aadhaar stored in full in plain jsonb (+ credentials vault).
          UIDAI rules may require a vault or masked storage. → Q15 legal.
   F21.3  No retention period or purge job for any PII table. DPDP gap.
   F21.4  Images/PDFs go to Bedrock unmasked when ASK_ID_DOC_READING=true
          (.env.example:271). Prod value unknown [A]. Disclose + consent.
   F21.5  Per-field RBAC: not found. Access is per engagement + role.
   F21.6  audit_events cascade on actor delete removes audit history
          when a profile is deleted (migration 0000:269).
```

---

## Feeds the next rounds

```
+--------+-------------------------------------------+------------+
| Item   | Goes to                                   | Round      |
+--------+-------------------------------------------+------------+
| F19.1  | E3 decision (credentials vault)           | 2 · Q1     |
| F19.2  | E4 decision (AI live fill)                | 2 · Q1     |
| F24.1  | E1 decision (tenancy)                     | 2 · Q1     |
| F21.2  | Aadhaar storage question                  | 2 · Q15    |
| F21.4  | Image-to-LLM consent question             | 2 · Q15    |
| F19.4  | Store SBC-STD-AI-02 text                  | 2 · owner  |
| F21.6  | Audit cascade = go-live blocker           | 3 · Q2     |
| F21.3  | Retention + purge                         | 4 · Q34    |
| §12gap | DR (multi_az, 1 region, no Object Lock)   | 4 · Q28    |
| F18.*  | Merge order before any new build          | 3 · Q9     |
+--------+-------------------------------------------+------------+
```
