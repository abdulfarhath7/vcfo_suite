# v6 — Round 3: plan

```
 STAMP
   Branch    claude/nice-babbage-ny1h0f
   Commit    755ad8d (= main a4b9495 + round 1-2 docs)
   Analyzed  2026-11-14
   Mode      analysis only · no code changed
   Legend    [F] fact, read in code/git   [A] assumption   S1 blocks · S2 must fix · S3 should
   Input     E1-E5 sheet NOT filled → this round uses the Round 2 picks:
             E1 c silo · E2 b GSP · E3 a remove secrets · E4 a drop AI mode · E5 b new co.
   Team      Q35 NOT given → effort assumes 2 developers [A]
```

---

## Q2 · What blocks the FIRST live filing (SPICe+ Part A)

```
+----+----------------------------------------------+----+--------+-----------+
| #  | Blocker                                      | Sev| Effort | Owner     |
+----+----------------------------------------------+----+--------+-----------+
| X1 | CS letter not sent. No "date sent" in        | S1 | 0.5 d  | Owner     |
|    | ROADMAP.md phase 0 [F]                       |    |        |           |
| X2 | No written CS opinion (rule 2) [F]           | S1 | weeks  | CS        |
| X3 | mca-v3 pack legalStatus "mock-only";         | S1 | 0.5 d  | Dev       |
|    | ASSIST_LIVE_PACKS unset [F packs/mca-v3.json]|    | (after |           |
|    |                                              |    | X2)    |           |
| X4 | G18 distribution "None of this is set up     | S1 | 3-5 d  | IT + Dev  |
|    | yet" [F DISTRIBUTION.md]: managed Chrome,    |    |        |           |
|    | force-install, 2-person release, HW keys     |    |        |           |
| X5 | Prod recipe key ASSIST_RECIPE_PRIVATE_KEY    | S1 | 0.5 d  | Dev       |
|    | set? unknown [A] (signing.ts:13)             |    |        |           |
| X6 | Migrations 0052-0054 (assist tables) on RDS? | S1 | 0.5 d  | Dev       |
|    | unknown [A]                                  |    |        |           |
| X7 | Demo passwords still on RDS [F CLAUDE.md]    | S1 | 0.5 d  | Dev       |
| X8 | Extension repo abdulfarhath7/vcfo_assist is  | S2 | 0.1 d  | Owner     |
|    | PUBLIC [F]. v5 §10 says closed source        |    |        |           |
| X9 | audit_events cascade on actor delete [F]     | S2 | 1 d    | Dev       |
| X10| Live recorder capture of Part A (ROADMAP     | S2 | 1 d    | Lead+Dev  |
|    | ph.1 exit 5) — done? unknown [A]             |    |        |           |
| X11| ~30 unmerged CR commits touch SPICe+ steps   | S2 | 3-5 d  | Dev       |
|    | (B7, B11, B21) → recipe may drift [F]        |    |        |           |
| X12| Authority proof per client (CS Q5) — no      | S2 | 1 d    | Owner     |
|    | template / no field [A]                      |    |        |           |
| X13| Supervised-run count + reviewer not set      | S2 | 0.1 d  | Owner+CS  |
|    | (ROADMAP ph.4 exit 4) [F]                    |    |        |           |
| X14| Filled values not pinned to the run (no      | S3 | 2 d    | Dev       |
|    | hash of the G13 table) [F schema-assist.ts]  |    |        |           |
+----+----------------------------------------------+----+--------+-----------+
 Dev effort without X2: ~12-15 days. X2 decides the date.
```

---

## Q3 · Capability map (task × portal × route × status)

Source: `src/lib/assist-agents/catalog.ts` (21 tasks) + trackers in `src/lib/registrations/` [F].

```
+-------------------+--------+----------+------------+--------+-------+------------------+
| Task              | Portal | Route    | Kind       | Status | Legal | Blocker          |
+-------------------+--------+----------+------------+--------+-------+------------------+
| SPICe+ A          | MCA    | 4 Ext    | portal-fill| beta   | mock  | X1-X7            |
| SPICe+ B          | MCA    | 4 Ext    | portal-fill| beta   | mock  | X2 · after A     |
| AGILE-PRO-S       | MCA    | 4 Ext    | portal-fill| beta   | mock  | X2               |
| e-MoA INC-33      | MCA    | 4 Ext    | portal-fill| beta   | mock  | X2               |
| e-AoA INC-34      | MCA    | 4 Ext    | portal-fill| beta   | mock  | X2               |
| INC-9             | MCA    | 4 Ext    | attach     | later  | mock  | no recipe        |
| INC-20A           | MCA    | 4 Ext    | portal-fill| later  | mock  | no recipe        |
| ADT-1             | MCA    | 4 Ext    | portal-fill| later  | mock  | no recipe        |
| DIR-3 KYC         | MCA    | 4 Ext    | portal-fill| later  | mock  | no recipe        |
| AOC-4             | MCA    | 4 Ext    | portal-fill| later  | mock  | no recipe        |
| MGT-7 / 7A        | MCA    | 4 Ext    | portal-fill| later  | mock  | no recipe        |
| GST REG-01        | GST    | MANUAL   | tracker    | built  | OK    | ext. banned;     |
|                   |        |          |            |        |       | API? [A]         |
| LUT RFD-11        | GST    | MANUAL   | tracker    | built  | OK    | same             |
| GSTR-1 / 3B       | GST    | 2 GSP    | api        | none   | L4-L5 | GSTZen contract  |
| Udyam             | Udyam  | 4 Ext    | portal-fill| later  | mock  | L18 · Aadhaar    |
| IEC               | DGFT   | 4 Ext    | portal-fill| later  | mock  | ToS unclear      |
| Shops & Est.      | State  | 4 Ext    | portal-fill| later  | none  | no pack          |
| Professional tax  | State  | 4 Ext    | portal-fill| later  | none  | no pack          |
| Challan 281 (TDS) | IT     | 4 Ext    | challan-   | later  | mock  | CS Q26 · s.70    |
|                   |        |          | prepare    |        |       |                  |
| Challan 280 (adv.)| IT     | 4 Ext    | challan-   | later  | mock  | CS Q26           |
|                   |        |          | prepare    |        |       |                  |
| TDS 24Q / 26Q     | Protean| 3 File   | file-      | later  | mock  | CS Q27           |
|                   |        |          | builder    |        |       |                  |
| Form 16 / 16A     | TRACES | 4 Ext    | portal-fill| later  | mock  | CS Q28 · ToS gap |
| ITR               | IT     | 1 ERI or | portal-fill| later  | mock  | L6 ERI type      |
|                   |        | 4 Ext    |            |        |       |                  |
| EPFO / ESIC       | EPFO.. | 4 Ext    | -          | packs  | mock  | no task in       |
|                   |        |          |            | only   |       | catalog [F]      |
+-------------------+--------+----------+------------+--------+-------+------------------+
 beta 5 · later 16 · built (manual) 2 · ready 0 · live 0
```

---

## Q20 · Human gates

Source: `catalog.ts` `MCA_GATES`, `PORTAL_GATES`; `SAFETY.md` G4-G6, G13, G17 [F].

```
+-----------+----------------------+-------------------------+-------------------------+
| Gate      | Who                  | Where                   | Proof kept [F]          |
+-----------+----------------------+-------------------------+-------------------------+
| LOGIN     | Filer, own BU ID     | Portal, own tab (G1,G12)| runs.mca_login_label    |
| CAPTCHA   | Filer                | Portal (G2)             | runs.refusals           |
| OTP       | Holder of the phone  | Portal (G3). Client     | runs.refusals           |
|           | (often the client)   | phone → L13             |                         |
| FILL OK   | Filer                | Side panel table (G13)  | counts only; table NOT  |
|           |                      |                         | hashed (X14)            |
| ATTEST    | Certifier (CA/CS)    | Suite (G17)             | assist_run_attestations |
|           |                      |                         | + evidence docs         |
| DSC       | Each signer          | emBridge, own token (G6)| runs.dsc_signers        |
| SUBMIT    | Filer                | Portal (G4)             | runs.state              |
| PAY       | Firm or client (CS Q9| Bank page (G5)          | assist_filings.paid_at  |
|           | open)                |                         |                         |
| EVC       | Taxpayer             | Portal (tax tasks)      | runs.refusals           |
| SRN       | Ext. reads, Suite    | record-srn.ts →         | step field + audit      |
|           | writes               | applyChecklistPatch     |                         |
+-----------+----------------------+-------------------------+-------------------------+
 MCA task  = LOGIN CAPTCHA OTP DSC SUBMIT PAY  (+ FILL OK, ATTEST)
 Other     = LOGIN CAPTCHA OTP SUBMIT PAY
 Challan   = stops before payment mode; person creates + pays
 Client portal shows NONE of these gates today [A] → client OTP UX gap
```

---

## Q22 · Trace one filing: SPICe+ Part A

```
 Client / lead types value
   │  checklist_state jsonb (engagements)              [F]
   │  [!] B1 no per-field history: step_events keep STATUS only
   │         (schema-work.ts:37). Old value lost on edit.
   │  [!] B2 no link field → source document (docs link per step only) [A]
   ▼
 Step review / approval   step_events.review_status + actor_id     [F] ✓
   │  [?] B3 edit after approval re-opens review? unknown [A]
   ▼
 GET /api/engagements/[id]/assist-profile → values to browser only [F] ✓ (G9)
   ▼
 Extension fills · user approves fill table (G13)
   │  [!] B4 table not hashed onto run (X14)
   ▼
 assist_agent_runs: recipe_id + recipe_version ✓ · heals · refusals ·
                    blanks · login label · device · IPs              [F] ✓
   ▼
 assist_run_attestations: certifier + evidenceDocumentIds           [F] ✓
   ▼
 Human: DSC → Submit → Pay      (assist_filings.paid_at)            [F] ✓
   ▼
 SRN → record-srn.ts → step field "acknowledgementNumber" (audited) [F] ✓
   │  [!] B5 audit_events cascade on actor delete (X9)
   ▼
 Receipt PDF → documents (S3 versioned, no Object Lock)  [!] B6
```

```
+----+--------------------------------------+-------------------------------+--------+
| #  | Break                                | Fix                           | Effort |
+----+--------------------------------------+-------------------------------+--------+
| B1 | No field-value history               | step_field_history table      | 2-3 d  |
|    |                                      | (old, new, actor, at)         |        |
| B2 | No field → source document link      | optional source_doc_id per    | 2 d    |
|    |                                      | field in history row          |        |
| B3 | Edit after approval                  | test; re-open review if not   | 1 d    |
| B4 | Fill table not pinned                | sha256(table) on run + attest | 1 d    |
| B5 | Audit cascade                        | ON DELETE SET NULL (names     | 1 d    |
|    |                                      | already kept)                 |        |
| B6 | Evidence mutable                     | separate evidence bucket,     | 1-2 d  |
|    |                                      | Object Lock (compliance mode) |        |
+----+--------------------------------------+-------------------------------+--------+
```

---

## Q23 · Part 1 gap (v5 inbound vs tool)

```
 [!] KEY FACT  Outlook scopes = offline_access User.Read Mail.Send
               Calendars.ReadWrite  (src/lib/outlook/oauth.ts:8) [F]
               → the tool SENDS mail. It READS NO mail. Part 1 is ~0% on mail.
```

```
+------------------------+---------------------------------------+--------+--------+
| v5 Part 1 step         | Tool today                            | Gap    | Effort |
+------------------------+---------------------------------------+--------+--------+
| Connect M365 mailboxes | Delegated, per user, send only        | BIG    | 3-4 d  |
|                        |                                       | (app + |        |
|                        |                                       | access |        |
|                        |                                       | policy)|        |
| Teams / SharePoint     | Calendars only (Teams link)           | BIG    | later  |
| Zoho                   | none                                  | BIG    | later  |
| Sender check SPF/DKIM/ | none                                  | BIG    | 2 d    |
| DMARC + known contact  |                                       |        |        |
| Durable queue          | Inngest (retries, replay) [F]         | SMALL  | 1 d    |
| Inbound message store  | none (no table)                       | BIG    | 1-2 d  |
| Malware scan           | none found [F grep]                   | BIG    | 2 d    |
| Parse PDF/DOCX/XLSX    | ask/ingest/pdf-text.ts, ask-drop [F]  | SMALL  | 1 d    |
| OCR scanned docs       | none found; images → Bedrock (flag)   | MED    | 2 d    |
| Mask → LLM             | masked-provider.ts [F] ✓              | NONE   | -      |
| Validate PAN/GSTIN/CIN | regex in checklist-responses.ts etc.; | MED    | 1 d    |
|                        | checksum? [A]                         |        |        |
| Staging + exception q. | askChangesets (hash, decide, expiry)  | SMALL  | 1-2 d  |
|                        | [F]; no low-confidence queue          |        |        |
| Maker → checker        | changeset decide + step approvals [F] | SMALL  | 1 d    |
| Client master update   | changeset/apply.ts → checklist [F]    | NONE   | -      |
| Reject → back to source| send-back reason (D-T07-02 fixed) [F] | SMALL  | 1 d    |
| Bank change call-back  | none                                  | BIG    | 2 d    |
| Manual inbound today   | client portal uploads, doc requests,  | -      | -      |
|                        | request lists, Ask drop [F]           |        |        |
+------------------------+---------------------------------------+--------+--------+
 Total Part 1 MVP (M365 only): ~20-25 dev days
 Reuse: ask-drop → askChangesets → apply. Add only the mail front door.
```

```
 PART 1 TARGET (reuse marked ✓)
   M365 app (Mail.Read, scoped by Exchange application access policy)
      ─▶ Inngest poll/webhook ✓ ─▶ inbound_messages (new)
      ─▶ sender check (new) ── fail ─▶ quarantine (new)
      ─▶ S3 evidence (Object Lock) ─▶ malware scan (new)
      ─▶ ask-drop sorter ✓ ─▶ masked LLM ✓ ─▶ askChangesets ✓
      ─▶ lead decides ✓ ─▶ manager/CA approves (2nd decide, new) ─▶ apply ✓
```

---

## Q9 · Phased roadmap (2 devs [A])

```
 Week      1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16
 P0 Clean  ███████                                   merge B*, RDS migs, X7, X8, X9
 P1 Legal  ████████████████████████████              external: CS, ICAI, GSTZen
 P2 Safety     ██████████                            E3, B1-B6, multi_az, retention v1
 P3 Part 1             ████████████████              mail front door (Q23)
 P4 Live A                         ░░░░████████      X2-X6, X10-X13 → 3-5 supervised
 P5 GST GSP                            ░░░░████████  after L4-L5 + contract
 P6 Tenant2                                    ██████ white-label, TF workspace
 P7 Recipes                                        ████████ AOC-4, MGT-7, DIR-3 →
 ░ = waiting on P1
```

```
+----+-------------------+-----------------+-------------+---------------------------+
| P  | Phase             | Depends on      | Dev days    | Exit                      |
+----+-------------------+-----------------+-------------+---------------------------+
| P0 | Clean             | -               | 8-10        | main = all wanted work;   |
|    |                   |                 |             | RDS at 0057; no demo pw   |
| P1 | Legal             | X1 letter sent  | 0 (owner)   | written answers L1-L5,    |
|    |                   |                 |             | CS Q1-Q19                 |
| P2 | Safety            | P0, E3          | 10-12       | B1-B6 closed; secrets     |
|    |                   |                 |             | removed; multi_az on      |
| P3 | Part 1 inbound    | P0, P2 (B6)     | 20-25       | 1 mailbox → approved      |
|    |                   |                 |             | client data, end to end   |
| P4 | First live filing | P1 (CS), P2     | 12-15       | N supervised Part A runs, |
|    |                   |                 |             | 0 guard violations        |
| P5 | GST via GSP       | P1 (L4-L5)      | 15-20       | GSTR-1/3B prepared by API,|
|    |                   |                 |             | filed by human EVC/DSC    |
| P6 | Tenant #2         | P0, E5 company  | 8-10        | firm #2 live on own stack |
| P7 | More recipes      | P4              | 5 / recipe  | each passes mock, 0 AI    |
+----+-------------------+-----------------+-------------+---------------------------+
 CRITICAL PATH  X1 letter ─▶ CS opinion ─▶ P4 live.  Send the letter THIS WEEK.
 TOTAL dev      ~80-95 days ≈ 9-10 weeks for 2 devs, plus legal wait.
 CUT IF 1 DEV   drop P6 (selling) and P7; keep P0 · P2 · P4 · P3.
```

---

## Feeds the next rounds

```
+--------+--------------------------------------------+-----------+
| Item   | Goes to                                    | Round     |
+--------+--------------------------------------------+-----------+
| X8     | Public extension repo → threat model       | 4 · Q5    |
| L13    | Client OTP relay → threat model            | 4 · Q5    |
| B6     | Object Lock → DR                           | 4 · Q28   |
| P3     | Mail ingest → breach runbook               | 4 · Q34   |
| P6     | Silo cost per tenant                       | 5 · Q11   |
| team   | 2-dev assumption → capacity                | 5 · Q35   |
+--------+--------------------------------------------+-----------+
```
