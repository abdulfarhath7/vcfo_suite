# v6 — Round 11: final (ADRs · delete list · acceptance tests)

```
 STAMP   branch claude/nice-babbage-ny1h0f · commit b384a2b · 2026-11-14
         mode: write · no code
         legend [F] code/git · [A] assumption · ⚖️ waits for CA
```

---

## Q32 · ADRs (status = PROPOSED until the owner signs)

```
+--------+--------------------------------+-----------+---------------------------------+
| ADR    | Decision                       | Status    | Revisit when                    |
+--------+--------------------------------+-----------+---------------------------------+
| ADR-01 | E1: one stack per tenant       | PROPOSED  | > 10 tenants or base cost hurts |
|        | (silo); pooled later           |           |                                 |
| ADR-02 | E2: GST returns via GSP        | PROPOSED  | GSTZen contract or ⚖️ L4-L5 no   |
|        | (GSTZen); REG-01, LUT manual;  |           |                                 |
|        | no extension on GST            |           |                                 |
| ADR-03 | E3: no stored portal passwords;| PROPOSED  | never (G8)                      |
|        | export then purge              |           |                                 |
| ADR-04 | E4: no AI live fill; T0-T4     | PROPOSED  | CS changes Q16 answer           |
|        | heal; AI returns index only    |           |                                 |
| ADR-05 | E5: new Pvt Ltd sells; SBC =   | PROPOSED  | ⚖️ L1-L3 answers                 |
|        | tenant #1                      |           |                                 |
| ADR-06 | Keep Inngest (not Temporal)    | PROPOSED  | job durability gap found        |
| ADR-07 | Keep access control in         | PROPOSED  | if pooled (ADR-01 revisit)      |
|        | repositories (no RLS)          |           |                                 |
| ADR-08 | Bedrock India regions only     | PROPOSED  | never without CS + DPDP check   |
| ADR-09 | Field encryption via KMS       | PROPOSED  | ⚖️ L7 demands an ADV product     |
|        | envelope (pii_vault)           |           |                                 |
| ADR-10 | Every task keeps a manual path | PROPOSED  | never                           |
+--------+--------------------------------+-----------+---------------------------------+
 Template per ADR: context · decision · options rejected · consequences · date · signer.
 File home: docs/adr/ADR-NN-<slug>.md (create when signed).
```

---

## Q30 · Delete / retire list (owner acts; nothing deleted by Claude)

```
+----+------------------------------------------+-------------------------------+
| #  | Item                                     | Why                           |
+----+------------------------------------------+-------------------------------+
| R1 | 13 remote branches with 0 unique commits | already squash-merged [F]     |
| R2 | 11 "-farhath" twins of "-eshwar" branches| byte-identical [F]            |
| R3 | chatbot, feat/ask-feeds-whatsapp         | stale; salvage gazette feeds  |
| R4 | engagement_credentials secret columns,   | ADR-03                        |
|    | credential_otps, credential_access_grants|                               |
| R5 | CREDENTIALS_ENCRYPTION_KEY secret        | ADR-03, after 30 days         |
| R6 | v5 §6 "AI mode" + token injector text    | ADR-04                        |
| R7 | v5 §6 "Temporal", §9 "Postgres RLS",     | ADR-06, ADR-07, D5.2          |
|    | §12 "RPO ≈ 0, RTO < 1 h"                 |                               |
| R8 | v5 "VCFO Companion" name                 | it is VCFO Assist [F]         |
| R9 | Payroll module (if owner confirms)       | branch remove-payroll-module  |
| R10| Seeded demo passwords on RDS             | security                      |
| R11| CLAUDE.md "RDS is on migration 0026"     | stale [F vs STATE.md]         |
| R12| One of assist_runs / assist_agent_runs   | overlap check first (F24.2)   |
+----+------------------------------------------+-------------------------------+
```

---

## Q31 · Acceptance tests per phase

```
+----+--------------------------------------------------+------------------------------+
| P  | Exit test                                        | How to run                   |
+----+--------------------------------------------------+------------------------------+
| P0 | main holds W1-W3; npm run check green; smoke     | npm run check;               |
|    | green; RDS applied = 58                          | npm run e2e:smoke; P0.3 SQL  |
| P0 | extension repo private; manifest hosts = mock    | GitHub settings; grep        |
|    |                                                  | manifest.json                |
| P1 | written answers to L1-L5 and CS Q1-Q19 filed     | docs/legal/ (new) + dates    |
| P2 | delete a profile → its audit rows remain         | vitest (repo test)           |
| P2 | edit one audit row → audit:verify fails          | npm run audit:verify         |
| P2 | no PAN/Aadhaar plain in checklist_state          | SQL scan on a seeded DB      |
| P2 | no route returns a portal password               | vitest + e2e                 |
| P2 | restore drill: PITR to new instance, timed       | runbook; record RTO          |
| P3 | 1 shared mailbox → approved data, end to end     | e2e with Graph mock          |
| P3 | spoofed / unknown / infected → quarantine        | vitest                       |
| P3 | bank change needs call-back                      | vitest                       |
| P4 | ext.: every SAFETY.md guard test passes          | ext. CI                      |
| P4 | ext. refuses unsigned recipe, honours kill switch| ext. CI                      |
| P4 | Ask plan for each catalog task = catalog data    | vitest (A4)                  |
| P4 | N supervised live Part A runs, 0 guard breaks,   | run records + reviewer       |
|    | 0 lockouts, SRN written back                     | sign-off                     |
| P5 | GSTR-1 draft via GSP matches books; human files  | sandbox GSP + 1 live client  |
| P6 | tenant:new creates a working stack in < 1 day;   | script + cross-tenant probe  |
|    | tenant A cannot read tenant B                    |                              |
| P7 | each recipe: mock run, 0 AI calls, 100% filled   | ext. CI                      |
+----+--------------------------------------------------+------------------------------+
```

## Plan deltas

```
 All deltas D4.1 … D10.2 are folded into docs/context/vcfo-suite-plan-v7.md.
```
