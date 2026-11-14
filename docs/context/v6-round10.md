# v6 — Round 10: business (cost · tenant #2 · build vs buy · team)

```
 STAMP   branch claude/nice-babbage-ny1h0f · commit b384a2b · 2026-11-14
         mode: analysis only · no code
         legend [F] code/git · [W] web · [A] assumption
 INPUTS  Q11 load and Q35 team NOT given → every number below is [A].
         Prices: AWS list prices from memory, US-region shape, Mumbai a little
         higher; model prices from src/lib/ask/provider/pricing.ts [F]
         (list + 10% India premium, itself an estimate). Re-price before quoting.
```

---

## Q11 · Cost per tenant (E1 c silo)

```
 BASE STACK per tenant / month [A]                      today [F]   to-be (P2)
+---------------------------------------------+---------+-----------+-----------+
| Item                                        | Size    | USD       | USD       |
+---------------------------------------------+---------+-----------+-----------+
| App Runner 1 vCPU / 2 GB, 1 warm instance   | app.tf  | 25-35     | 25-35     |
| RDS t4g.micro, 20 GB                        | db.tf   | 15-18     | 30-36 MAZ |
| Backups (PITR + AWS Backup + copy)          |         | 2-4       | 5-8       |
| NAT (fck-nat t4g.nano)                      | [F] ~$7 | 7         | 7         |
| S3 + KMS keys + Secrets Manager             |         | 6-10      | 8-12      |
| WAF + CloudWatch + SNS                      |         | 1         | 12-18     |
| SES / WhatsApp                              | usage   | 1-5       | 1-5       |
+---------------------------------------------+---------+-----------+-----------+
| BASE                                        |         | ~60-80    | ~90-120   |
+---------------------------------------------+---------+-----------+-----------+
 Budget alarm today: $25/month (budget.tf) [F] → too low for to-be; raise.
```

```
 AI per client / month [A]
   20 documents × document model (6k in / 1k out)    ≈ $0.48
   30 Ask questions × fast model (4k in / 0.5k out)  ≈ $0.03
    5 agent plans × smart model (8k in / 1k out)     ≈ $0.15
   recipe heals (T3, rare, < 3k tokens)               ≈ $0.00
   ─────────────────────────────────────────────────────────
   ≈ $0.70 per client per month
```

```
+-----------+-----------+-----------+-----------+------------------+
| Clients   | Base      | AI        | GSP [A]   | Total / month    |
+-----------+-----------+-----------+-----------+------------------+
| 10        | 90-120    | ~7        | ?         | ~$100-130        |
| 50        | 100-140   | ~35       | ?         | ~$140-180        |
| 200       | 180-260 * | ~140      | ?         | ~$320-400        |
+-----------+-----------+-----------+-----------+------------------+
 * RDS → t4g.medium, App Runner max 2 busy.
 GSP fees: per GSTIN / per call, from the GSTZen quote (unknown).
 Pooled (E1 a) would save ~$60-90 per extra tenant, after 6-10 weeks of work.
```

---

## Q26 · Onboard firm #2 today

```
+----+------------------------------------------+-----------+-----------+
| #  | Step                                     | Today     | Days      |
+----+------------------------------------------+-----------+-----------+
| N1 | New AWS account / TF workspace           | manual    | 0.5       |
| N2 | terraform apply (infra/)                 | scripted ✓| 0.5       |
| N3 | Secrets (AUTH, DB, SES, Bedrock, keys)   | manual    | 0.5       |
| N4 | SES domain verify (their domain)         | manual    | 1-3 wait  |
| N5 | Bedrock model access (India profiles)    | manual    | 0.5       |
| N6 | Migrate + seed firm settings             | scripted ✓| 0.2       |
| N7 | Branding: 185 "SBC" strings in code [F]  | MISSING   | 3-5 once  |
| N8 | Firm policy text per tenant              | MISSING   | 0.5       |
| N9 | Statutory calendar import                | built ✓   | 0.5       |
| N10| Staff invites + roles                    | built ✓   | 0.5       |
| N11| Client import (CSV)                      | MISSING?  | 2 [A]     |
| N12| Extension policy install (their IT)      | MISSING   | 1         |
| N13| Outlook/M365 connect                     | built ✓   | 0.2       |
| N14| DPA + licence + DPDP notice              | MISSING   | legal     |
+----+------------------------------------------+-----------+-----------+
 First tenant: ~10 dev days (N7 + scripts). Each next: ~2-3 days.
 Goal: `npm run tenant:new <slug>` wrapping N1-N6, N9 (P6).
```

---

## Q27 · Build vs buy

```
+------------------+------------------------+------------------------+--------------+
| Need             | Build                  | Buy                    | Pick         |
+------------------+------------------------+------------------------+--------------+
| GST API          | impossible (GSP only)  | GSTZen (chosen) / other| BUY GSTZen   |
|                  |                        | GSPs                   | (compare 2)  |
| Workflow engine  | Inngest in place ✓     | Temporal               | KEEP Inngest |
| OCR              | -                      | Bedrock vision ✓ /     | Bedrock first|
|                  |                        | Textract               | Textract if  |
|                  |                        |                        | volume grows |
| Malware scan     | ClamAV in container    | GuardDuty S3 malware   | BUY GuardDuty|
| e-Sign (BR, docs)| -                      | Aadhaar eSign ASPs     | LATER (⚖️ CS |
|                  |                        |                        | Q7)          |
| OTP relay        | built (credential_otps)| -                      | REMOVE (E3)  |
| Field encryption | KMS envelope (D1)      | Aadhaar vault product  | BUILD; buy   |
|                  |                        |                        | ADV only if  |
|                  |                        |                        | ⚖️ L7 says so |
| Monitoring       | CloudWatch + SNS       | Datadog / Sentry       | BUILD cheap; |
|                  |                        |                        | Sentry later |
| Extension dist.  | -                      | Chrome Enterprise      | BUY (free    |
|                  |                        | policy                 | tier)        |
+------------------+------------------------+------------------------+--------------+
```

---

## Q35 · Team fit

```
 Total dev days (v7 plan, see final): P0 9 · P2 21 · P3 22 · P4 28 · P5 18 ·
                                       P6 10 · P7 5/recipe   ≈ 108 + recipes
+-----------+----------------+-------------------------------------------+
| Team      | Calendar       | Cut                                       |
+-----------+----------------+-------------------------------------------+
| 1 dev     | ~26 weeks      | drop P6 (no selling), P7, P5 → manual GST |
|           | (P0,P2,P4,P3)  | keep: clean · safety · first live · inbox |
| 2 devs    | ~14-16 weeks   | P7 trickles                               |
|           | + legal wait   |                                           |
| 3 devs    | ~10-11 weeks   | none; 3rd dev owns the extension          |
+-----------+----------------+-------------------------------------------+
 Review: 2-person rule for extension releases (G18) → needs ≥ 2 people with
 GitHub access even with 1 dev.
```

## Plan deltas

```
 D10.1  Budget alarm $25 → per-tenant ~$150.
 D10.2  P6 adds `tenant:new` script + branding move (N7) as the first task.
```

## Needs owner

```
 Real Q11 numbers (clients, docs/month) · Q35 team · GSTZen quote
```
