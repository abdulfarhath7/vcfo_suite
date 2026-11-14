# v6 — Round 9: P3 Shared mailboxes → inbound → maker-checker

```
 STAMP   branch claude/nice-babbage-ny1h0f · commit b384a2b · 2026-11-14
         mode: DESIGN only · no code · fake values only
         legend [F] code/git · [A] assumption · ⚖️ waits for CA
```

---

## Flow

```
 Tenant admin: "Connect mailbox" (GST desk, ITR desk …)
   │  Entra app, Graph APPLICATION permission Mail.Read          (new app,
   │  scoped by Exchange RBAC for Applications / app access policy  separate from
   │  to the chosen shared mailboxes only [A: confirm current MS    send-only
   │  feature name at build time]                                   delegated app)
   ▼
 Graph change notification (webhook)  +  delta query every 15 min (backstop)
   ▼
 /api/webhooks/graph (validate clientState) ─▶ Inngest event ✓ (retries, replay)
   ▼
 inbound_messages (idempotent on internet_message_id)
   ▼
 SENDER CHECK ── fail ─▶ quarantine (no parse, staff review)
   │ pass
   ▼
 attachments ─▶ evidence bucket (Object Lock, sha256) ─▶ malware scan
   │            (GuardDuty Malware Protection for S3 [A]) ── infected ─▶ quarantine
   ▼
 ask-drop sorter ✓ ─▶ per client card ─▶ masked extraction ✓ ─▶ askChangesets ✓
   ▼
 checks: format + checksum (PAN, GSTIN, CIN, IFSC) + cross-source
   ├─ ok         ─▶ proposed (lead = maker)
   └─ low conf.  ─▶ held (RowCheck.heldReason ✓ [F]) = exception queue
   ▼
 Lead decides ─▶ Manager/CA approves (2nd decision, new) ─▶ apply ✓ ─▶ field history (D5)
   └─ reject ─▶ reply to sender with reason (T3 send, exact recipient)
```

---

## Sender check (reuse what M365 already computed)

```
+----+-----------------------------------------------+---------------------+
| #  | Check                                         | Source              |
+----+-----------------------------------------------+---------------------+
| S1 | Authentication-Results: spf=pass, dkim=pass,  | message headers     |
|    | dmarc=pass (computed by Exchange Online) [A]  | (Graph internet-    |
|    |                                               | MessageHeaders)     |
| S2 | From address is a known contact of ONE        | engagement recipients|
|    | engagement                                    | client team [F]     |
| S3 | Reply-To = From (or known)                    | headers             |
| S4 | No bank-detail change in the body/attachments | extraction class    |
|    | → if yes: force call-back flow (below)        |                     |
+----+-----------------------------------------------+---------------------+
 S1 fail or S2 none → quarantine.  S2 many → staff picks engagement.
```

---

## Schema drafts

```
 mailboxes
   id · address · tag ('gst'|'itr'|'roc'|'general') · graph_subscription_id ·
   subscription_expires_at · delta_link · status · connected_by · created_at

 inbound_messages
   id · mailbox_id · internet_message_id (UNIQUE) · graph_id · from_address ·
   subject_hash · received_at · auth_results jsonb · sender_status
   ('pass'|'quarantine'|'manual') · engagement_id (nullable) · status
   ('new'|'scanned'|'sorted'|'done'|'quarantined') · drop_id (→ ask drop) ·
   created_at
   (body not stored; subject stored hashed + masked preview) [A] ⚖️ L11

 inbound_attachments
   id · message_id · s3_key (evidence bucket) · sha256 · mime · size ·
   scan_status ('pending'|'clean'|'infected') · ask_attachment_id
```

---

## Bank-detail change (fraud guard)

```
 extraction finds bank change ─▶ changeset HELD ─▶ call-back task to manager
   ─▶ manager phones the number already on file (not the one in the mail)
   ─▶ records outcome + time ─▶ CA approves ─▶ apply
 Never apply a bank change from email alone.
```

---

## Model tiering

```
+------------------------+------------------+-----------------------------+
| Step                   | Model            | Note                        |
+------------------------+------------------+-----------------------------+
| Structured data (JSON, | none             | parse only                  |
| XLSX with headers)     |                  |                             |
| Triage / sort          | fast             | subject + file names masked |
| Text extraction        | document         | masked text                 |
| Scanned ID images      | document (vision)| only with ASK_ID_DOC_READING|
|                        |                  | + consent ⚖️ L9              |
+------------------------+------------------+-----------------------------+
```

---

## Effort

```
+----+-----------------------------------------+--------+
| #  | Item                                    | Days   |
+----+-----------------------------------------+--------+
| M1 | Entra app + mailbox connect UI          | 3      |
| M2 | Webhook + delta + subscription renew    | 3      |
| M3 | inbound_* tables + repositories + tests | 2      |
| M4 | Sender check + quarantine view          | 2      |
| M5 | Evidence bucket + malware scan hook     | 2      |
| M6 | ask-drop hookup + engagement match      | 2      |
| M7 | Checksums PAN/GSTIN/CIN/IFSC            | 1      |
| M8 | Exception queue view (held rows)        | 2      |
| M9 | Second decision (checker) on changesets | 2      |
| M10| Bank call-back flow                     | 2      |
| M11| Reject → reply                          | 1      |
+----+-----------------------------------------+--------+
 ≈ 22 dev days (fits Round 3 estimate 20-25)
```

## Tests (acceptance)

```
 ✓ same message twice → one row        ✓ spf fail → quarantine, not parsed
 ✓ unknown sender → quarantine          ✓ infected file → never reaches AI
 ✓ PII never in model payload (masker)  ✓ bank change cannot apply without call-back
 ✓ lead cannot approve own changeset    ✓ subscription expiry renews before lapse
 ✓ mailbox outside the access policy → Graph 403 (scope proven)
```

## Plan deltas

```
 D9.1  Two Entra apps: existing delegated (send, calendar) + new application
       (read, scoped). Do not widen the existing one.
 D9.2  Gmail / IMAP / Zoho = later connectors behind the same inbound_messages.
```

## Needs owner / CA

```
 L11 retention of mail data · L9 ID images · which mailboxes first (pilot: 1)
```
