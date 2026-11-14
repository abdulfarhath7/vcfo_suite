# v6 — Round 4: as-is vs to-be · roadmap × 2

```
 STAMP   branch claude/nice-babbage-ny1h0f · commit b384a2b · 2026-11-14
         mode: analysis only · no code changed
         legend [F] code/git · [W] web · [A] assumption · [!] gap
 BASIS   plan v6 file not supplied → "v6" = Round 2 picks [A]:
         E1 c silo · E2 b GSP · E3 a remove secrets · E4 a drop AI mode · E5 b new co.
```

---

## Q7 · As-is architecture (main @ a4b9495)

```
                        ┌──────────── AWS ap-south-1 (Mumbai) only [F] ────────────┐
 Browser (staff/client) │                                                          │
   │  HTTPS             │  App Runner  Next.js 16, 1 vCPU / 2 GB, 1-2 inst. [F]    │
   ├───────────────────▶│   ├─ app/api/* (~35 handlers) ─▶ src/db/repositories ✓   │
   │                    │   │      AuthContext + role scope (no tenant) [!]        │
   │                    │   ├─ Ask VCFO ─▶ masked-provider ─▶ Bedrock (in.*) ✓     │
   │                    │   │      27 actions T1-T3, T4 prepare-only [F]           │
   │                    │   └─ Inngest jobs (~37) ✓                                │
   │                    │                                                          │
   │                    │  RDS Postgres  t4g.micro · single-AZ [!] · 7d PITR       │
   │                    │                + AWS Backup 30d · KMS ✓                  │
   │                    │  S3 documents  versioned · SSE-KMS · no Object Lock [!]  │
   │                    │  Secrets Mgr · SES · End User Messaging (WhatsApp)       │
   │                    │  NAT = fck-nat t4g.nano · no WAF [!] · 1 alarm (NAT) [!] │
   │                    └──────────────────────────────────────────────────────────┘
   │
   ├─ Outlook (Graph, delegated): Mail.Send · Calendars.ReadWrite — NO read [!]
   │
   └─ VCFO Assist ext. v0.1.0 (PUBLIC repo [!]) ─ content script on LIVE
        www.mca.gov.in [!] · no G11/G15/G18 · guard.js G1/G4 ✓
        Suite side: catalog, signed recipes, runs, patches, attest ✓ (unused by ext. [!])
```

## Q7 · To-be architecture (v6)

```
 ┌───────── per tenant (E1 c) · own AWS account or Terraform workspace ────────────┐
 │                                                                                 │
 │  INBOUND (P3)                                                                   │
 │   M365 app (Mail.Read via app access policy) ─▶ Inngest ─▶ inbound_messages     │
 │     ─▶ sender check ─▶ quarantine | evidence bucket (Object Lock) ─▶ scan       │
 │     ─▶ ask-drop ✓ ─▶ masked LLM ✓ ─▶ askChangesets ✓ ─▶ maker ▸ checker ─▶ apply │
 │                                                                                 │
 │  CORE                                                                           │
 │   Next.js ─▶ repositories ✓ ─▶ RDS Multi-AZ + PITR + cross-region snapshot      │
 │     pii_vault (field-level KMS) · step_field_history · audit hash chain         │
 │                                                                                 │
 │  AGENT FRONT DOOR (P2)                                                          │
 │   Ask VCFO ─▶ plan ─▶ action registry T0-T4 ✓ ─▶ capability registry           │
 │     ├─ route 2 GSP (GSTZen) server-side  (E2 b)                                 │
 │     ├─ route 3 file builder (FVU)        server-side, human uploads             │
 │     └─ route 4 VCFO Assist ext.          user's tab, T0-T4 heal, G1-G18         │
 │   Human gates: LOGIN · OTP · FILL OK · ATTEST · DSC · SUBMIT · PAY              │
 │                                                                                 │
 │  OPS: CloudWatch alarms ─▶ SNS ─▶ on-call · WAF · log retention 180 d (India)   │
 └─────────────────────────────────────────────────────────────────────────────────┘
 Shared (vendor co., E5 b): build pipeline · signed releases · extension policy URL
```

```
 GAP LIST  (as-is ─▶ to-be)
+----+-----------------------------+----------------------------------+--------+
| #  | As-is                       | To-be                            | Phase  |
+----+-----------------------------+----------------------------------+--------+
| G1 | 1 firm row                  | 1 stack per tenant               | P6     |
| G2 | Outlook send only           | inbound mail front door          | P3     |
| G3 | PII in plain jsonb          | pii_vault, field KMS             | P2     |
| G4 | no field history            | step_field_history               | P2     |
| G5 | audit cascade               | SET NULL + hash chain            | P2     |
| G6 | single-AZ, 1 region         | Multi-AZ + Hyderabad copy        | P2     |
| G7 | no Object Lock              | evidence bucket, compliance lock | P2     |
| G8 | 1 alarm, no WAF             | alarms + SNS + WAF               | P2     |
| G9 | ext. public, live MCA host  | private, mock hosts, G11/15/18   | P0     |
| G10| Ask = Q&A + actions         | Ask = agent front door           | P4     |
| G11| no GSP                      | GSTZen route                     | P5     |
+----+-----------------------------+----------------------------------+--------+
```

---

## Q9 · Roadmap × 2 (E2 = a manual GST · E2 = b GSP GST)

Phase numbers from here on (they replace Round 3's):

```
 P0 Clean      P1 Legal (external)   P2 Safety   P3 Part 1 inbound
 P4 Agent front door + first live MCA filing     P5 GST GSP
 P6 Tenant #2  P7 More recipes
```

```
 VARIANT b (GSP)  — recommended                 2 devs [A], weeks
 Week      1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17
 P0        ███████
 P1        ████████████████████████████████
 P2            ███████████
 P3                     ████████████████
 P4                                ░░░░██████████
 P5                                      ░░░░██████████
 P6                                                 ███████
 P7                                                       ████████▶
```

```
 VARIANT a (manual GST)
 Week      1   2   3   4   5   6   7   8   9  10  11  12  13  14
 P0        ███████
 P1        ████████████████████████
 P2            ███████████
 P3                     ████████████████
 P4                                ░░░░██████████
 P5        —  (GST stays tracker + data sheet + copy button)
 P6                                          ███████
 P7                                                ████████▶
```

```
+----------------------+------------------+------------------+
|                      | a) manual GST    | b) GSP GST       |
+----------------------+------------------+------------------+
| Dev days             | 65-75            | 80-95            |
| Calendar (2 devs)    | ~14 wks          | ~17 wks          |
| External dependency  | CS only          | CS + GSTZen +    |
|                      |                  | L4-L5            |
| GST time saved       | 0                | high (monthly    |
|                      |                  | GSTR-1/3B) [A]   |
| Sellable as "agents" | weak on GST      | strong           |
| Policy change        | none             | none [F]         |
| Reversible           | yes              | yes (stop GSP)   |
+----------------------+------------------+------------------+
 PICK  b). GST is the highest-volume monthly work. The GSP route is already
       allowed by policy (checklist-workflow.md:237) [F].
```

---

## Plan deltas

```
 D4.1  Phase numbers re-based (above). Round 3 P4 "Live A" = new P4.
 D4.2  New P0 item: extension repo private + host_permissions to mock (G9).
 D4.3  New P4 scope: extension must call Suite runs API (G11) and verify
       recipe signatures (G15) and the kill switch (G18) before any live run.
```

## Feeds next rounds

```
 G6-G8 ▸ Round 5 (DR, observability) · G9 ▸ Round 5 threat model · G3-G5 ▸ Round 7
 G10 ▸ Round 8 · G2 ▸ Round 9 · G1 ▸ Round 10
```

## Needs owner / CA

```
 E1-E5 unsigned (using picks) · plan v6 file not supplied · G9 repo action
```
