# v6 — Round 8: P4 Ask VCFO as the agent front door

```
 STAMP   branch claude/nice-babbage-ny1h0f · commit b384a2b · 2026-11-14
         mode: DESIGN only · no code
         legend [F] code/git · [A] assumption
 BASIS   E4 = a (no AI live fill) [A]
```

---

## What already exists [F]

```
+-----------------------------+-----------------------------------------------+
| Part                        | Where                                         |
+-----------------------------+-----------------------------------------------+
| Action tiers T0-T4          | src/lib/actions/types.ts (T4 = prepare only)  |
| 27 actions (T1 1·T2 18·T3 8)| src/lib/actions/* registry                    |
| Changesets + approval       | ask_changesets (content_hash, decided_by)     |
| Masked model door           | src/lib/ask/masked-provider.ts                |
| Scope guard                 | src/lib/ask/guard.ts                          |
| Token budget                | ASK_DAILY_TOKEN_BUDGET 2,000,000 (config.ts)  |
| Preflight (MCA)             | src/lib/mca-filing/readiness.ts (pure)        |
| Filing state                | src/lib/mca-filing/filing-state.ts            |
| Agent catalog + gates       | src/lib/assist-agents/catalog.ts              |
| Runs, patches, attest       | assist_agent_runs, _recipe_patches, _attest.  |
| Late fees                   | src/lib/compliance/late-fees.ts               |
+-----------------------------+-----------------------------------------------+
 → The agent is mostly assembly, not new machinery.
```

---

## Agent loop

```
 User: "File AOC-4 for <client>"
   │
   ▼
 1 UNDERSTAND   guard.ts → intent = task · engagement resolved (scope ✓)
   ▼
 2 PLAN         capability lookup: task × portal × route (catalog.ts)
   │            → plan card: steps · route · human gates · due date · late fee
   ▼
 3 PREFLIGHT    readiness: missing docs, signer DSC dates, mismatches
   │            → "3 things missing" + T3 request to client (existing action)
   ▼
 4 PREPARE      T2 changesets for data fixes → person approves
   ▼
 5 HAND OFF     route 4: "Open VCFO Assist" deep link (ext. run, G1-G18)
   │            route 2: GSP prepare (P5) · route 3: build file
   │            → "You do this" card: LOGIN · OTP · DSC · SUBMIT · PAY
   ▼
 6 WATCH        run status poll · UNKNOWN → check_status, never re-submit
   ▼
 7 RECORD       SRN → step field (record-srn.ts ✓) · receipt → evidence
   ▼
 8 EXPLAIN      "Why this value?" → field history + source doc (D5)
```

---

## Tool list (agent-visible)

```
+-------------------+------+----------------------------------+----------+------+
| Tool              | Tier | Does                             | Exists?  | Cost |
+-------------------+------+----------------------------------+----------+------+
| read_* (8 tools)  | T0   | project, steps, filings, calendar| YES [F]  | low  |
| plan_task         | T0   | catalog lookup → plan card       | NEW      | 0 AI |
| preflight_check   | T0   | readiness.ts + late fee          | WRAP     | 0 AI |
| explain_value     | T0   | field history + source doc       | NEW (D5) | low  |
| check_status      | T0   | filing-state + run state         | WRAP     | 0 AI |
| draft_*           | T1   | private drafts with undo         | YES      | low  |
| record_* (18)     | T2   | changeset → person approves      | YES      | low  |
| send_* (8)        | T3   | outward, exact recipients        | YES      | low  |
| request_documents | T3   | ask client for missing items     | YES [A]  | low  |
| start_assist_run  | T4   | PREPARE only: deep link + run id | NEW      | 0 AI |
| gsp_prepare_return| T4   | PREPARE only: GSTR-1/3B draft    | NEW (P5) | 0 AI |
| build_return_file | T4   | PREPARE only: 24Q/26Q for FVU    | NEW      | 0 AI |
+-------------------+------+----------------------------------+----------+------+
 No tool submits, signs, pays, logs in or reads an OTP. Ever.
```

---

## Prompt shape

```
 SYSTEM (cached)   role · scope definition (guard.ts) · tier rules ·
                   "never submit/sign/pay" · output schema for plan cards
 TOOLS  (cached)   tool list above, JSON schemas
 CONTEXT           masked engagement summary · catalog slice for the task
 USER              request
 Model tiers       router/guard = fast · plan + explain = smart ·
                   documents = document model (config.ts) [F]
```

---

## Guards (agent layer)

```
+-----+------------------------------------------------------------------+
| A1  | T4 tools return a prepared object + deep link. Never an action.  |
| A2  | Every T2/T3 needs a person; approval bound to content_hash ✓     |
| A3  | All model traffic through masked-provider ✓                      |
| A4  | Plan cards come from catalog data, not model text (no invented   |
|     | routes or portals)                                               |
| A5  | Unknown task or portal not in catalog → "not supported" + manual |
| A6  | Pack legalStatus ≠ cs-cleared → plan says "mock only / manual"   |
| A7  | Budget: per-tenant daily tokens; stop at cap, T0 tools still work|
| A8  | Every tool call logged on ask_runs / ask_run_steps ✓ [F]         |
+-----+------------------------------------------------------------------+
```

---

## UX states (Ask panel)

```
 IDLE ─▶ PLANNING ─▶ PLAN READY ─▶ PREFLIGHT ─┬─▶ BLOCKED (missing list, ask client)
                                              └─▶ READY ─▶ APPROVALS PENDING
   ─▶ HANDED OFF ("You do this") ─▶ WAITING PORTAL ─┬─▶ DONE (SRN, receipt)
                                                    ├─▶ UNKNOWN ─▶ CHECK STATUS
                                                    └─▶ FAILED ─▶ manual path
 Client portal: shows HANDED OFF only when the client holds a gate (OTP, DSC)
```

---

## Extension work needed before any live run (from Round 5 T1-T3)

```
+----+----------------------------------------------------+--------+
| #  | Item                                               | Days   |
+----+----------------------------------------------------+--------+
| E1 | Call Suite runs API at start (G11 live switch)     | 2      |
| E2 | Verify recipe signature (G15) with built-in keys   | 2      |
| E3 | Kill switch + min version from catalog (G18)       | 1      |
| E4 | host_permissions = mock hosts; live via optional   | 0.5    |
|    | permission only after pack is cs-cleared           |        |
| E5 | Guard test suite (SAFETY.md "How guards are        | 4-5    |
|    | tested") — 0 tests today [F]                       |        |
| E6 | Force-install policy + 2-person release (G18)      | 3      |
+----+----------------------------------------------------+--------+
 ≈ 12-14 dev days (extension repo)
```

## P4 total

```
 Agent front door (Suite)   10-12 days
 Extension hardening        12-14 days
 First live run (after CS)   3-5 days supervised
 ≈ 25-31 dev days  (Round 3 said 12-15 → corrected: extension phase 1 not done)
```

## Plan deltas

```
 D8.1  P4 = front door + extension hardening + supervised runs, 25-31 days.
 D8.2  Marketing line holds with E4 a: plan · preflight · prepare · hand off ·
       watch · explain. Acting = verified tools + humans.
```
