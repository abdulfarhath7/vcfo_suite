# v6 — Round 5: harden

```
 STAMP   branch claude/nice-babbage-ny1h0f · commit b384a2b · 2026-11-14
         mode: analysis only · no code changed
         legend [F] code/git · [W] web · [A] assumption
 BASIS   E1-E5 = Round 2 picks [A]
```

---

## Q5 · STRIDE threat model

```
 S spoof · T tamper · R repudiate · I info leak · D denial · E elevation
+----+-----------+---+----------------------------------+------+-------------------------+-------+
| #  | Asset     |   | Threat                           | Now  | Control                 | Phase |
+----+-----------+---+----------------------------------+------+-------------------------+-------+
| T1 | Extension | T | Public repo; anyone builds a     | OPEN | private repo; G18       | P0    |
|    |           |   | copy with live MCA host [F]      |      | force-install only      |       |
| T2 | Extension | T | Recipe altered in transit/store  | OPEN | G15 verify in ext. [F:  | P4    |
|    |           |   | (ext. does not verify) [F]       | (ext)| Suite signs, ext. not]  |       |
| T3 | Extension | E | Hijacked publisher update        | n/a  | G18: no Web Store,      | P4    |
|    |           |   |                                  | yet  | 2-person release        |       |
| T4 | Extension | E | Page text injects "click Submit" | PART | guard.js G4 ✓; G10 AI   | -     |
|    |           |   |                                  |      | index only ✓            |       |
| T5 | Extension | I | Values sent to AI                | CLOSE| G9 labels only; pii.ts  | -     |
|    |           |   |                                  |      | refuses PII ✓ [F]       |       |
| T6 | Extension | R | "I did not file that"            | PART | G14 run evidence ✓;     | P2    |
|    |           |   |                                  |      | fill table hash (X14)   |       |
| T7 | OTP relay | S | Staff ask client for OTP by phone| OPEN | credential_otps; L13;   | P2    |
|    |           |   | (social-engineering pattern)     |      | E3 a drops relay        |       |
| T8 | Cred.vault| I | Breach exposes all client portal | OPEN | E3 a: remove secrets    | P2    |
|    |           |   | logins [F schema]                |      |                         |       |
| T9 | Cred.vault| D | Key unset → feature throws [F]   | OPEN | moot after E3 a         | P2    |
| T10| AI        | I | ID images to Bedrock unmasked    | FLAG | consent + notice; L9    | P2    |
|    |           |   | (ASK_ID_DOC_READING) [F]         |      |                         |       |
| T11| AI        | T | Prompt injection via uploaded doc| PART | T2+ changeset approval  | -     |
|    |           |   | → wrong data proposed            |      | ✓; content_hash ✓ [F]   |       |
| T12| AI        | D | Token spend runaway              | PART | ASK_DAILY_TOKEN_BUDGET  | P2    |
|    |           |   |                                  |      | 2M [F]; no alarm        |       |
| T13| Mail (P3) | S | Spoofed client email with fake   | n/a  | SPF/DKIM/DMARC + known  | P3    |
|    |           |   | bank details                     | yet  | contact + call-back     |       |
| T14| Mail (P3) | T | Malware attachment               | n/a  | scan before parse       | P3    |
| T15| Mail (P3) | I | App reads whole tenant mailbox   | n/a  | Exchange app access     | P3    |
|    |           |   |                                  | yet  | policy → chosen boxes   |       |
| T16| Audit     | R | Profile delete wipes audit rows  | OPEN | SET NULL + hash chain   | P2    |
|    |           |   | [F 0000:269]                     |      |                         |       |
| T17| Data      | I | PAN/Aadhaar plain in jsonb [F]   | OPEN | pii_vault               | P2    |
| T18| Data      | I | Cross-tenant leak                | n/a  | E1 c silo → ~0          | P6    |
| T19| Web       | D | No WAF on App Runner [F]         | OPEN | AWS WAF + rate rules    | P2    |
| T20| Auth      | S | Seeded demo passwords on RDS [F] | OPEN | purge (P0)              | P0    |
+----+-----------+---+----------------------------------+------+-------------------------+-------+
 OPEN 11 · PART 5 · CLOSE 1 · FLAG 1 · n/a yet 4
```

---

## Q12 · Failure playbook (due-date day)

```
+----+------------------------+-----------------------+----------------------+-----------+
| #  | Failure                | Detect                | Fallback             | Who       |
+----+------------------------+-----------------------+----------------------+-----------+
| F1 | Portal down            | run error + portal    | manual later; record | Lead      |
|    |                        | status page           | downtime screenshot  |           |
|    |                        |                       | (extension claims)   |           |
| F2 | Recipe breaks (field   | T1-T3 heal; T4 teach  | person fills the rest| Lead +    |
|    | moved)                 | mode [F]              | by hand; patch later | Dev       |
| F3 | Recipe breaks (whole   | completion < 50% on a | roll back to vN-1;   | Dev       |
|    | form changed)          | form (run metrics)    | manual filing        |           |
| F4 | Unknown result after   | no SRN read           | state UNKNOWN →      | Filer     |
|    | Submit                 |                       | check portal history |           |
|    |                        |                       | → never re-submit    |           |
| F5 | GSP API down (P5)      | 5xx / timeout         | queue; manual portal | Lead      |
|    |                        |                       | filing by person     |           |
| F6 | Suite down             | service-checks job    | portal by hand; data | Dev       |
|    |                        | (5 min) [F]; no page  | from last export     |           |
| F7 | DSC token expired      | expiry alerts job [F] | other signer / renew | Manager   |
| F8 | Bedrock throttled      | provider error        | T0/T1 only; T4 teach | auto      |
| F9 | Mail ingest stuck (P3) | queue age alarm       | client portal upload | Dev       |
| F10| Kill switch needed     | bad release           | catalog              | Dev       |
|    |                        |                       | extensionDisabled    |           |
+----+------------------------+-----------------------+----------------------+-----------+
 RULE  Every task keeps a manual path. Late fee calc (late-fees.ts) shows
       the cost of waiting [F].
```

---

## Q28 · DR: v5 promise vs infra

```
+------------------------+--------------------------+------------------------------+------+
| Item                   | Today [F infra/]         | To-be                        | Cost |
+------------------------+--------------------------+------------------------------+------+
| RDS Multi-AZ           | false (database.tf:68)   | true                         | 2x DB|
| PITR                   | 7 days                   | 35 days                      | low  |
| Snapshots              | AWS Backup daily, 30 d   | + copy to ap-south-2         | low  |
| Cross-region           | none                     | Backup copy rule → Hyderabad | low  |
| S3                     | versioning + SSE-KMS     | + replication to ap-south-2; | low  |
|                        |                          | evidence bucket Object Lock  |      |
| Deletion protection    | true ✓                   | keep                         | -    |
| Restore drill          | none recorded            | monthly, timed, logged       | 0.5d |
| RPO (honest)           | ≤ 5 min PITR in-region;  | same + 24 h cross-region     |      |
|                        | 24 h if region lost      |                              |      |
| RTO (honest)           | unknown (no drill)       | < 4 h (measure, then promise)|      |
+------------------------+--------------------------+------------------------------+------+
 [!] v5 "RPO ≈ 0, RTO < 1 h" is not true today. Do not promise it to buyers.
```

```
 TERRAFORM DIFF (plan only — never applied)
   database.tf   multi_az = false            ─▶ true
                 backup_retention_period = 7 ─▶ 35
   backup.tf     + copy_action { destination_vault_arn = <ap-south-2 vault> }
   storage.tf    + aws_s3_bucket "evidence" { object_lock_enabled = true }
                 + aws_s3_bucket_object_lock_configuration (COMPLIANCE, 8 y [A] → L11)
                 + aws_s3_bucket_replication_configuration → ap-south-2
   new waf.tf    + aws_wafv2_web_acl (AWS managed common + rate rule)
                 + aws_apprunner ... web_acl association [A: check App Runner support]
   new alarms.tf + aws_sns_topic "oncall" + alarms (see Q29)
```

---

## Q29 · Observability

```
+--------------------------+-------------------------------+-----------------+--------+
| Signal                   | Today [F]                     | Add             | Pager  |
+--------------------------+-------------------------------+-----------------+--------+
| Outside services up      | service-checks job, 5 min,    | alert on 2 fails| email  |
|                          | dev console only              |                 |        |
| NAT instance             | CloudWatch alarm (recover)    | keep            | -      |
| AWS spend                | budget $25/month (budget.tf)  | per-tenant tag  | email  |
| App 5xx / latency        | none                          | App Runner alarm| SNS    |
| RDS CPU / storage / conn | none                          | 3 alarms        | SNS    |
| Inngest job failures     | none (Inngest UI only) [A]    | failure hook →  | SNS    |
|                          |                               | staff alert     |        |
| Failed emails            | failedEmails table [F]        | daily count alert| email |
| AI tokens / cost         | ask_usage_daily [F], budget   | 80% alarm       | email  |
| Guard refusals off-gate  | runs.refusals [F]             | weekly review   | -      |
| Recipe heals per page    | runs.heals [F]                | > 3 → patch due | -      |
| Portal drift             | none (canary = mock only)     | heal-rate trend | -      |
| Security events          | user_sessions, sign-in        | SIEM later      | -      |
|                          | throttle [F]                  |                 |        |
| Log retention            | not set in Terraform [F]      | 180 d (CERT-In) | -      |
+--------------------------+-------------------------------+-----------------+--------+
 On-call: 1 named dev + 1 backup on due-date weeks (7th, 11th, 13th, 20th) [A].
```

---

## Q34 · Breach runbook

```
 T+0      Detect  (alarm, staff report, client report, vendor notice)
   │      Owner: on-call dev → opens incident in incident log (new doc)
 T+1 h    Contain  rotate keys · kill switch · disable affected logins ·
   │               snapshot RDS (do not restore over it)
 T+6 h    CERT-In report  (cyber incident within 6 h) ⚖️ L14 confirms scope
   │      Owner: named security contact
 T+24 h   Assess  which tenants · which data classes · which people
   │
 T+72 h   DPDP  notify Data Protection Board + each affected person
   │      (Rules 2025; timing from in force date) ⚖️ L10
   │      Tenant firms notified at once (they are fiduciaries, we process)
 T+7 d    Fix + post-mortem · update threat model · drill the fix
```

```
+------------------------+--------------------+-------------------------------+
| Incident type          | Extra step         | Who tells whom                |
+------------------------+--------------------+-------------------------------+
| PII leak               | list data classes  | vendor co. → tenant → people  |
| Wrong filing on portal | file correction /  | certifier → client; CS        |
|                        | revised form;      | advice                        |
|                        | keep run evidence  |                               |
| Malicious ext. release | kill switch (G18)  | dev → all staff               |
| AI vendor incident     | stop T3 calls;     | vendor → us → tenants         |
|                        | T0/T1 only         |                               |
| Lost DSC token         | revoke at CA       | signer → issuing CA           |
+------------------------+--------------------+-------------------------------+
 [!] No incident log, no named security contact, no CERT-In contact in repo [F grep].
```

---

## Plan deltas

```
 D5.1  P2 gets: WAF, alarms + SNS, log retention 180 d, Multi-AZ, PITR 35 d,
       cross-region backup copy, evidence bucket with Object Lock.
 D5.2  v6 / sales text: replace "RPO ≈ 0, RTO < 1 h" with measured values
       after the first restore drill.
 D5.3  New doc: docs/context/INCIDENT.md (runbook + contacts) in P2.
```

## Feeds next rounds

```
 T2/T3 ▸ Round 8 (ext. in agent flow) · T13-T15 ▸ Round 9 · T16-T17 ▸ Round 7
```

## Needs owner / CA

```
 L10 DPDP breach timing · L14 CERT-In scope · named security contact · on-call names
```

---

## ✔ Checkpoint (Rounds 4-5 + earlier 1-3)

```
 ✅ Done     v6-round1 … v6-round5
 🔥 Urgent   extension public + live MCA host (T1) · demo passwords (T20)
 🔄 Deltas   D4.1-D4.3 · D5.1-D5.3
 ⏸ Blocked  CS opinion · E1-E5 signature · L4-L5 GSP
 ▶ Next     Round 6 P0 merge plan · Round 7 P2 designs · Round 8 agent front door
```
