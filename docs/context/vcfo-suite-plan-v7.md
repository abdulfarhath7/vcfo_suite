# VCFO Suite — Plan v7 (complete)

```
 STAMP    branch claude/nice-babbage-ny1h0f · code analysed = main a4b9495 · 2026-11-14
 REPLACES context v5 (it did not know the tool) and the v6 rounds
 BUILT ON docs/context/v6-round1.md … v6-round11.md (evidence, citations)
 LEGEND   [F] read in code/git · [W] web, not primary · [A] assumption · ⚖️ waits for CA
 STATUS   decisions E1-E5 = PROPOSED (owner has not signed) · not legal advice
```

---

## 0 · Read this first

```
 1  The tool is real and deployed (app.sbctrack.in). v7 extends it; it does not restart.
 2  Nothing touches a live portal until the CS opinion is in writing (firm rule 2).
 3  One live risk exists TODAY: the public extension repo can run on live MCA. Fix in P0.
 4  The critical path is legal, not code: send the CS letter this week.
```

---

## 1 · Pitch (unchanged, now true to the design)

```
 VCFO Suite = AI agents that plan, check, prepare and explain every registration
 and compliance filing; verified tools act; a named person logs in, signs,
 submits and pays.
```

---

## 2 · What exists today [F]

```
+-------------------------+--------------------------------------------------+
| Area                    | Built                                            |
+-------------------------+--------------------------------------------------+
| Stack                   | Next.js 16 · Postgres/Drizzle · Inngest · S3 ·   |
|                         | App Runner + RDS (Mumbai) · Terraform            |
| Roles                   | super_admin · admin · manager · intern (lead) ·  |
|                         | client · developer                               |
| Incorporation           | 34-step SPICe+ checklist · MCA docs · BRs        |
| Compliance              | obligations · statutory calendar import · late   |
|                         | fees · reminders · expiries · labour registers · |
|                         | board meetings · receivables · budgets           |
| Registrations           | GST + LUT trackers (manual, policy-bound)        |
| Ask VCFO                | masked Bedrock (India) · 27 actions T1-T3 ·      |
|                         | T4 prepare-only · changesets · drop (bulk files) |
| VCFO Assist (Suite side)| catalog 21 tasks · 9 portal packs (mock-only) ·  |
|                         | 5 signed recipes · runs · patches · attestations |
| VCFO Assist (extension) | v0.1.0, PUBLIC repo, live MCA host, no G11/G15/  |
|                         | G18, 0 tests [!]                                 |
| Outlook                 | send mail + calendar only — reads NO mail [!]    |
+-------------------------+--------------------------------------------------+
```

---

## 3 · Decisions (sign these)

```
+----+---------------------------+------------------------------------+---------+
| E  | Pick (PROPOSED)           | Why                                | Sign    |
+----+---------------------------+------------------------------------+---------+
| E1 | One stack per tenant now; | 0 seam change; strongest isolation;| [ ]     |
|    | pooled tenant_id later    | reversible                         |         |
| E2 | GST returns via GSP       | Policy already allows GSP          | [ ]     |
|    | (GSTZen); REG-01 + LUT    | (checklist-workflow.md:237);       |         |
|    | stay manual; no extension | extension banned on GST            |         |
| E3 | No stored portal          | Guard G8; GST brief row 7; ICAI    | [ ]     |
|    | passwords: export → purge |                                    |         |
| E4 | No AI live fill; T0-T4    | Guards G9, G10, G13                | [ ]     |
|    | heal, AI returns an index |                                    |         |
| E5 | New Pvt Ltd sells;        | ICAI Reg 190A ⚖️ L1-L3              | [ ]     |
|    | SBC = tenant #1           |                                    |         |
+----+---------------------------+------------------------------------+---------+
 Also proposed: keep Inngest · keep access control in repositories · Bedrock India
 only · KMS field encryption · every task keeps a manual path (ADR-06 … ADR-10).
```

---

## 4 · Roles (v5 → tool)

```
+---------------------+-------------------------+-----------------------------------+
| v5 role             | Tool role               | Gate it holds                     |
+---------------------+-------------------------+-----------------------------------+
| Org admin           | admin / super_admin     | connect mailboxes, settings       |
| Lead (maker)        | intern                  | decide changesets, run Assist     |
| Checker (CA)        | manager / admin         | 2nd decision, ATTEST (G17)        |
| Filer               | permission on any staff | LOGIN · OTP · SUBMIT on own ID    |
|                     | role (new flag)         |                                   |
| Signer              | person with DSC         | DSC (G6)                          |
| Client              | client                  | own data, OTP on own phone, DSC   |
| Developer           | developer               | dev console only                  |
+---------------------+-------------------------+-----------------------------------+
```

---

## 5 · Agent model

```
 🤖 AGENT = 🧠 Ask VCFO (plan · preflight · prepare · explain)
          + 🔧 verified tools (actions T0-T4, recipes, GSP, file builders)
          + 🧑 human gates

 ACTION TIERS [F src/lib/actions/types.ts]
   T0 read · T1 draft (undo) · T2 record (person approves) ·
   T3 outward (person confirms recipients) · T4 legal (prepare only, never execute)

 HEAL TIERS (extension) [F ROADMAP]
   T0 recipe · T1 rules · T2 on-device · T3 small model, labels only · T4 teach mode
   AI returns one index from an enumerated list, or "none" (G10)

 AGENT LOOP
   understand ─▶ plan (catalog) ─▶ preflight (readiness) ─▶ prepare (changesets)
     ─▶ hand off ("You do this") ─▶ watch ─▶ record SRN ─▶ explain
```

```
 HUMAN GATES
+---------+------------------------+------------------------------+
| Gate    | Who                    | Proof                        |
+---------+------------------------+------------------------------+
| LOGIN   | filer, own user ID     | run.mca_login_label          |
| CAPTCHA | filer                  | run.refusals                 |
| OTP     | phone holder           | run.refusals                 |
| FILL OK | filer (G13 table)      | sha256(table) on run (new)   |
| ATTEST  | certifier (G17)        | assist_run_attestations      |
| DSC     | each signer            | run.dsc_signers              |
| SUBMIT  | filer (G4)             | run.state                    |
| PAY     | firm or client ⚖️ CS Q9 | assist_filings.paid_at       |
| EVC     | taxpayer               | run.refusals                 |
+---------+------------------------+------------------------------+
```

---

## 6 · Target architecture

```
 ┌──────── per tenant: own AWS account / Terraform workspace (E1) ─────────────────┐
 │ INBOUND  M365 app (Mail.Read, scoped) ─▶ webhook + delta ─▶ inbound_messages   │
 │          ─▶ sender check ─▶ evidence (Object Lock) ─▶ malware scan             │
 │          ─▶ ask-drop ─▶ masked LLM ─▶ changesets ─▶ maker ▸ checker ─▶ apply    │
 │ CORE     Next.js ─▶ repositories (AuthContext) ─▶ RDS Multi-AZ                  │
 │          pii_vault · step_field_history · audit hash chain                     │
 │ AGENT    Ask VCFO ─▶ action registry ─▶ capability registry (catalog)          │
 │          ├─ route 2 GSP (GSTZen)       server-side                             │
 │          ├─ route 3 file builder (FVU) server-side, person uploads              │
 │          └─ route 4 VCFO Assist        user's own tab, G1-G18                  │
 │ OPS      alarms → SNS → on-call · WAF · logs 180 d · backup copy → Hyderabad   │
 └────────────────────────────────────────────────────────────────────────────────┘
 Vendor co. (E5): code, signed releases, extension policy URL, recipe signing key
```

---

## 7 · Part 1 — Inbound

```
+----------------------+------------------------------+------------------------+
| Step                 | Reuse                        | New                    |
+----------------------+------------------------------+------------------------+
| Connect mailboxes    | -                            | Entra app, Mail.Read,  |
|                      |                              | app access policy      |
| Receive              | Inngest ✓                    | webhook + delta,       |
|                      |                              | inbound_messages       |
| Sender check         | engagement recipients ✓      | SPF/DKIM/DMARC from    |
|                      |                              | headers, quarantine    |
| Store + scan         | S3 ✓                         | evidence bucket (lock),|
|                      |                              | GuardDuty malware scan |
| Sort + extract       | ask-drop ✓, masked provider ✓| checksums PAN/GSTIN/   |
|                      |                              | CIN/IFSC               |
| Stage + exceptions   | askChangesets ✓, heldReason ✓| exception queue view   |
| Maker → checker      | changeset decide ✓           | 2nd decision           |
| Apply                | changeset apply ✓            | field history          |
| Bank change          | -                            | call-back flow         |
+----------------------+------------------------------+------------------------+
 Two Entra apps: existing (send, calendar) stays; new one reads only chosen boxes.
```

---

## 8 · Part 2 — Outbound (routes and capability map)

```
 ROUTES (capability registry = catalog.ts × packs/*.json)
   1 Official API (ERI for income tax)  ⚖️ L6     server
   2 GSP API (GSTZen) for GST returns   ⚖️ L4-L5  server
   3 Official file (FVU for 24Q/26Q)    ⚖️ CS Q27 server builds, person uploads
   4 VCFO Assist extension              ⚖️ CS Q1-19 user's tab, attended
   M Manual + tracker                   always available
```

```
+-------------------+--------+--------+--------+--------+---------------------+
| Task              | Portal | Route  | Status | Legal  | Next                |
+-------------------+--------+--------+--------+--------+---------------------+
| SPICe+ A          | MCA    | 4      | beta   | mock   | P4 first live       |
| SPICe+ B, AGILE,  | MCA    | 4      | beta   | mock   | after A             |
| e-MoA, e-AoA      |        |        |        |        |                     |
| INC-9, INC-20A,   | MCA    | 4      | later  | mock   | P7 recipes          |
| ADT-1, DIR-3 KYC, |        |        |        |        |                     |
| AOC-4, MGT-7      |        |        |        |        |                     |
| GST REG-01, LUT   | GST    | M      | built  | OK     | data sheet + copy   |
| GSTR-1, GSTR-3B   | GST    | 2      | none   | ⚖️      | P5                  |
| Udyam             | Udyam  | 4      | later  | ⚖️ L18  | hold                |
| IEC               | DGFT   | 4      | later  | ⚖️      | hold                |
| PT, S&E           | State  | 4/M    | later  | none   | per state, later    |
| Challan 280/281   | IT     | 4      | later  | ⚖️ Q26  | after CS            |
| TDS 24Q/26Q       | Protean| 3      | later  | ⚖️ Q27  | after CS            |
| Form 16/16A       | TRACES | 4      | later  | ⚖️ Q28  | after CS            |
| ITR               | IT     | 1 / 4  | later  | ⚖️ L6   | after ERI decision  |
| EPFO, ESIC        | EPFO.. | 4      | packs  | ⚖️      | add tasks later     |
+-------------------+--------+--------+--------+--------+---------------------+
```

```
 SELF-HEALING (corrected from v5)
   recipe vN runs ── ok ─▶ done (0 tokens)
       │ field missing
       ▼
   T1 rules ─▶ T2 on-device ─▶ T3 small model (labels only, index answer)
       ─▶ T4 teach mode (person points)
       ─▶ patch proposal ─▶ mock test ─▶ staff approves ─▶ signed vN+1 (rollback)
   No "AI mode", no token injector, no AI-written values.
```

---

## 9 · Registrations and compliances: what changes

```
+--------------------+-----------------------------------------------------------+
| Item               | Change in v7                                              |
+--------------------+-----------------------------------------------------------+
| Incorporation      | First live filing = SPICe+ A, supervised, after CS (P4)   |
| GST registration   | Stays manual; add copy-value buttons + deep links         |
| GST returns        | GSP route (P5); person files with EVC/DSC                 |
| Income tax / TDS   | Prepare challans and FVU files; person pays/uploads       |
| ROC annual         | Recipes AOC-4, MGT-7, DIR-3 KYC (P7); data from board     |
|                    | meetings + FS                                             |
| Labour             | Registers map to the 4 labour codes ⚖️ L16                 |
| Payroll            | Owner decides keep/remove (branch exists)                 |
| Calendar           | AI drafts due-date changes from reg-sources; person OKs   |
| Interest on tax    | Phase 2 of late fees (needs amount due)                   |
+--------------------+-----------------------------------------------------------+
```

---

## 10 · AI use and cost tiering

```
+------------------+-------------------------------+------------------+
| Use              | Model                         | Gate             |
+------------------+-------------------------------+------------------+
| Routine filling  | none (recipe)                 | -                |
| Field heal       | small, labels only            | patch review     |
| Triage / sort    | fast                          | -                |
| Extraction       | document, masked text         | changeset        |
| ID images        | document vision, flag+consent | ⚖️ L9             |
| Plan / explain   | smart                         | -                |
| Rule watch       | smart                         | person approves  |
+------------------+-------------------------------+------------------+
 ≈ $0.70 per client per month [A] · prompt caching · per-tenant token cap.
```

---

## 11 · PII rules

```
 In app      plain only to roles allowed per class (pii_vault) · audit each plain read
 To any AI   masked only (masked-provider.ts) · images only behind flag + consent
 At portal   values go browser → field; never via the AI; never through Suite logs
 Aadhaar     own key; may not be stored at all ⚖️ L7-L8
 Retention   per class ⚖️ L11 → purge job · soft delete first
```

---

## 12 · Security (top threats → control)

```
+----+--------------------------------------+---------------------------+-------+
| #  | Threat                               | Control                   | Phase |
+----+--------------------------------------+---------------------------+-------+
| 1  | Public extension, live MCA host      | private, mock hosts       | P0    |
| 2  | Demo passwords on RDS                | purge                     | P0    |
| 3  | Stored client portal passwords       | export → purge (E3)       | P2    |
| 4  | PAN/Aadhaar plain in jsonb           | pii_vault                 | P2    |
| 5  | Audit rows deleted with profile      | SET NULL + hash chain     | P2    |
| 6  | No WAF, 1 alarm                      | WAF + alarms + SNS        | P2    |
| 7  | Unsigned recipe / no kill switch     | G15, G18 in extension     | P4    |
| 8  | Spoofed client email (bank change)   | sender check + call-back  | P3    |
| 9  | Malware attachment                   | scan before parse         | P3    |
| 10 | Prompt injection                     | index-only AI, approvals  | done  |
+----+--------------------------------------+---------------------------+-------+
 Full STRIDE (20 threats): v6-round5.md.
```

---

## 13 · Never lose data (honest)

```
+---------------+-------------------------+-------------------------------+
| Item          | Today                   | v7                            |
+---------------+-------------------------+-------------------------------+
| DB            | single-AZ, 7 d PITR,    | Multi-AZ, 35 d PITR, copy to  |
|               | 30 d snapshots          | Hyderabad                     |
| Files         | versioned, KMS          | + evidence bucket Object Lock |
|               |                         | + replication                 |
| Records       | status history only     | field history                 |
| Restore       | never drilled           | monthly drill, measured RTO   |
| Promise       | v5 "RPO≈0, RTO<1h" ✗    | publish measured numbers only |
+---------------+-------------------------+-------------------------------+
```

---

## 14 · Audit and defensibility

```
 Every filed value ─▶ field history (old, new, who, via, source doc)
                  ─▶ approval (step event / changeset decision)
                  ─▶ run (recipe id + version, fill-table hash, evidence)
                  ─▶ attestation (certifier, evidence docs)
                  ─▶ SRN + receipt (Object Lock)
 Audit log: append-only, hash-chained, nightly anchor outside the DB.
```

---

## 15 · Legal

```
 HARD RULES   1 unclear = prohibited · 2 no live MCA before written CS opinion ·
              3 no captcha/OTP bypass, no signing for others, no other's login,
                no test data on portals, no private endpoints  (SAFETY.md)
 SEND NOW     CS-QUESTIONS.md (31) + Part E L1-L20 (v6-round2.md)
 ORDER        L1-L3 (who sells) · L4-L5 (GSP) · L7-L9 (Aadhaar, images) ·
              CS Q1-Q19 (MCA live) · rest
 PORTAL ToS   read 2 of 14 from source; 3 are s.70 protected systems
              (GST, Income Tax Systems, ICEGATE) → v6-round2.md Q33
 DATES        DPDP core duties ~May 2027 [W] · CERT-In 6 h ⚖️ L14
```

---

## 16 · Roadmap

```
+----+---------------------------+------------------+-------+------------------------------+
| P  | Phase                     | Depends on       | Days  | Exit                         |
+----+---------------------------+------------------+-------+------------------------------+
| P0 | Clean: merge waves W1-W4, | -                | 9     | main green; RDS at 58;       |
|    | RDS migs, demo pw, ext.   |                  |       | ext. private + mock hosts    |
|    | private, CS letter        |                  |       |                              |
| P1 | Legal (external)          | letter sent      | 0     | written answers filed        |
| P2 | Safety: pii_vault, audit, | P0, E3           | 21    | tests in v6-round11 pass;    |
|    | secrets purge, DR, WAF,   |                  |       | restore drill done           |
|    | alarms, field history     |                  |       |                              |
| P3 | Inbound mailboxes         | P0, P2           | 22    | 1 mailbox → approved data    |
| P4 | Agent front door + ext.   | P1 (CS), P2      | 28    | N supervised live Part A,    |
|    | hardening + first live    |                  |       | 0 guard breaks               |
| P5 | GST via GSP               | L4-L5, contract  | 18    | GSTR-1/3B prepared by API    |
| P6 | Tenant #2                 | P0, E5 company   | 10    | tenant:new < 1 day           |
| P7 | More recipes              | P4               | 5 ea. | mock run, 0 AI calls         |
+----+---------------------------+------------------+-------+------------------------------+
 TOTAL ≈ 108 dev days + recipes
```

```
 2 devs [A]       weeks
 Week   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17
 P0     ███████
 P1     ████████████████████████████████
 P2         ███████████████
 P3                    ████████████████
 P4                              ░░░░██████████████
 P5                                    ░░░░██████████
 P6                                                 ███████
 P7                                                        ████████▶
 ░ waiting on legal
 CRITICAL PATH  CS letter ─▶ CS opinion ─▶ P4 first live filing
 1 DEV          P0 → P2 → P4 → P3 (~26 wks); drop P5, P6, P7
```

---

## 17 · First live filing: blockers

```
+----+---------------------------------------------+----+-------+
| #  | Blocker                                     | Sev| Phase |
+----+---------------------------------------------+----+-------+
| 1  | CS letter not sent; no opinion              | S1 | P1    |
| 2  | mca-v3 pack mock-only; ASSIST_LIVE_PACKS    | S1 | P4    |
| 3  | Extension lacks G11, G15, G18; 0 tests      | S1 | P4    |
| 4  | No force-install / 2-person release (G18)   | S1 | P4    |
| 5  | Prod recipe signing key set?                | S1 | P4    |
| 6  | Assist migrations on RDS?                   | S1 | P0    |
| 7  | Demo passwords on RDS                       | S1 | P0    |
| 8  | Public extension repo                       | S2 | P0    |
| 9  | Audit cascade                               | S2 | P2    |
| 10 | Unmerged SPICe+ step changes                | S2 | P0    |
| 11 | Authority-to-file proof per client          | S2 | P1    |
| 12 | Fill table not hashed                       | S3 | P2    |
+----+---------------------------------------------+----+-------+
```

---

## 18 · Cost and team (estimates [A])

```
 Per tenant / month   10 clients ~$100-130 · 50 ~$140-180 · 200 ~$320-400  (+ GSP fees)
 Team                 1 dev ~26 wks (cut P5-P7) · 2 devs ~15 wks · 3 devs ~11 wks
 Budget alarm         $25 today → ~$150 per tenant
```

---

## 19 · Owner actions (this week)

```
 [ ] Sign E1-E5                       [ ] Send CS letter (+ Part E)
 [ ] Make vcfo_assist private          [ ] Decide payroll keep/remove
 [ ] Name security contact + on-call   [ ] Give Q11 load + Q35 team numbers
 [ ] Say "build P0" to start merges    [ ] Ask GSTZen for a quote + contract
```

---

## 20 · Retire (owner acts)

```
 0-unique branches (13) · "-farhath" twins (11) · chatbot, feat/ask-feeds-whatsapp (salvage) ·
 portal secret columns + OTP relay (E3) · v5 text: AI mode, Temporal, RLS, RPO≈0,
 "VCFO Companion" · CLAUDE.md "RDS on 0026" · one of assist_runs / assist_agent_runs
```

---

## 21 · Evidence index

```
+---------------+-----------------------------------------------------------+
| File          | Holds                                                     |
+---------------+-----------------------------------------------------------+
| v6-round1.md  | branches · policy vs v5 · data model · PII inventory      |
| v6-round2.md  | E1-E5 options · legal pack L1-L20 · portal ToS map        |
| v6-round3.md  | blockers · capability map · gates · trace · Part 1 gap    |
| v6-round4.md  | as-is / to-be · roadmap × 2                               |
| v6-round5.md  | STRIDE · failure playbook · DR · observability · breach   |
| v6-round6.md  | merge waves + commands (not run) · RDS check SQL          |
| v6-round7.md  | pii_vault · audit chain · secrets purge · field history   |
| v6-round8.md  | agent front door · tools · guards · UX · extension work   |
| v6-round9.md  | shared mailboxes · schemas · sender check · bank guard    |
| v6-round10.md | cost · tenant #2 · build vs buy · team                    |
| v6-round11.md | ADRs · retire list · acceptance tests                     |
+---------------+-----------------------------------------------------------+
```
