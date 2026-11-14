# v6 — Round 7: P2 Safety designs

```
 STAMP   branch claude/nice-babbage-ny1h0f · commit b384a2b · 2026-11-14
         mode: DESIGN only · no code, no migration written · values below are FAKE
         legend [F] code/git · [W] web · [A] assumption · ⚖️ waits for CA
 BASIS   E3 = a (remove stored portal secrets) [A, unsigned]
```

---

## D1 · pii_vault (field-level encryption)

```
 TODAY [F]   engagements.checklist_state jsonb holds PAN, DIN, Aadhaar,
             passport, DOB, bank, address in plain JSON (RDS KMS only).
 GOAL        Ciphertext at field level · separate key for Aadhaar ·
             domain code unchanged (golden rule 3).
```

```
 WRITE  checklist save ─▶ repository (seam ✓)
          │  for each field in VAULT_FIELDS:
          │     value ─▶ KMS data key (per tenant) ─▶ AES-256-GCM
          │     store row in pii_vault · put token in jsonb
          ▼
        checklist_state: { "pre15.director.0.pan": "vault:7f3c…" }

 READ   repository ─▶ role allowed for field? ─┬─ yes ─▶ decrypt ─▶ same shape
                                               │         as today to domain code
                                               └─ no  ─▶ masked ("XXXXX1234X")
 AI     masker sees masked value only (masked-provider.ts ✓)
```

```
 SCHEMA DRAFT
 pii_vault
   id            uuid pk
   engagement_id uuid fk → engagements (ON DELETE RESTRICT)
   field_path    text      e.g. 'pre15.director.0.pan'
   class         text      pan | aadhaar | passport | dob | bank | din | phone | email
   key_ref       text      KMS key alias (aadhaar → its own key)
   ciphertext    bytea
   iv            bytea
   value_hash    text      HMAC-SHA256 (dedupe / search by exact value)
   last4         text      for display only (not for aadhaar ⚖️ L7)
   created_by    uuid · created_at · rotated_at
   UNIQUE (engagement_id, field_path)
```

```
+------------+---------------+-----------------------------+--------------------+
| Class      | Key           | Who may read plain [A]      | Note               |
+------------+---------------+-----------------------------+--------------------+
| aadhaar    | own KMS key   | nobody in UI by default     | ⚖️ L7/L8 ADV rules  |
|            |               | (export to form only)       | may need a vault   |
|            |               |                             | product or no store|
| pan, din   | tenant key    | lead, manager, admin        |                    |
| passport   | tenant key    | lead, manager, admin        |                    |
| bank       | tenant key    | manager, admin              | change = call-back |
| dob, phone,| tenant key    | lead, manager, admin        |                    |
| email      |               |                             |                    |
+------------+---------------+-----------------------------+--------------------+
 Client sees own values. Every plain read → audit event (no value).
```

```
 MIGRATION PATH (reversible until step 4)
   1 add table + write-both (jsonb plain + vault)        feature flag
   2 backfill job (Inngest, batched, resumable)
   3 read from vault, compare with jsonb, log mismatches  (1 week)
   4 replace jsonb values with tokens                      ← point of no return
   5 drop compare code
 Effort 6-8 dev days · tests: round-trip, role matrix, masker, docx output
 unchanged (snapshot), backfill resume.
```

---

## D2 · Audit FK + hash chain

```
 TODAY [F]  audit_events.actor_user_id FK ON DELETE CASCADE (0000:269)
            → deleting a profile deletes its audit rows.
            actor_email / actor_name columns already exist ✓
```

```
 CHANGE
   1 FK → ON DELETE SET NULL  (names stay in actor_email / actor_name)
   2 add columns: seq bigint (monotonic) · prev_hash text · row_hash text
   3 row_hash = sha256( prev_hash ‖ seq ‖ at ‖ actor ‖ action ‖ engagement ‖
                        canonical_json(metadata) )
   4 insert through recordAuditEvent only (seam ✓), inside a txn with
     pg_advisory_xact_lock(<audit>) → no forks in the chain
   5 nightly job: write {date, last seq, last row_hash} to evidence bucket
     (Object Lock) → anchor outside the DB
   6 DB grant: app role has INSERT, SELECT only on audit_events
   7 verify tool: npm run audit:verify (recompute chain, report first break)
```

```
 SAME FIX for other evidence FKs that CASCADE on profile delete [A]:
   run: grep -n "onDelete: 'cascade'" src/db/schema*.ts  → list in P2 ticket.
 Effort 2-3 dev days · tests: delete profile keeps rows · tamper → verify fails
 · concurrent inserts keep one chain.
```

---

## D3 · Remove stored portal passwords (E3 a)

```
 TODAY [F]  engagement_credentials.secret_ciphertext (ID, password, mobile,
            DOB, PAN, Aadhaar…) · credential_otps · credential_access_grants ·
            identifier_reveal_attempts · src/lib/client-portal/credentials.ts
```

```
 STEPS
   1 Notice   in-app + email to each client: "From <date> SBC will not keep
              portal passwords. Download yours before <date+30>."
   2 Hide     feature flag: secret columns read-only, no new secrets
   3 Export   client (own login + 2-step) downloads own secrets once,
              as an encrypted PDF/CSV · audit event per export (no value)
   4 Purge    migration: secret_ciphertext → NULL; drop OTP relay tables
              (credential_otps, credential_access_grants)  ← point of no return
   5 Keep     non-secret rows (IDs as labels, reg. numbers, addresses, KYC
              status) — the workbook stays useful
   6 Remove   CREDENTIALS_ENCRYPTION_KEY secret after 30 days
 ⚖️ L12 before step 4 (any duty to keep or hand back).
 Effort 3-4 dev days · tests: export round-trip, purge leaves non-secret rows,
 no route returns a secret after step 4.
```

---

## D4 · Terraform DR diff

See `v6-round5.md` Q28 (plan only, never applied). Adds: Multi-AZ, PITR 35 d,
cross-region backup copy to ap-south-2, evidence bucket with Object Lock,
S3 replication, WAF, SNS + alarms, log retention 180 d.

---

## D5 · Field history (trace break B1/B2)

```
 step_field_history
   id · engagement_id · step_id · field_path · old_value_ref · new_value_ref
   (vault token or plain for non-PII) · source_document_id (nullable) ·
   actor_id (SET NULL) · actor_name · via ('ui'|'ask'|'assist'|'import') · at
 Written by applyChecklistPatch (seam ✓). Run + attestation store
 sha256(fill table) (X14).  Effort 3 dev days.
```

---

## P2 total

```
+----+------------------------------+--------+
| #  | Item                         | Days   |
+----+------------------------------+--------+
| D1 | pii_vault                    | 6-8    |
| D2 | audit SET NULL + chain       | 2-3    |
| D3 | remove portal secrets        | 3-4    |
| D4 | DR + WAF + alarms (TF)       | 3-4    |
| D5 | field history + fill hash    | 3      |
|    | INCIDENT.md + contacts       | 0.5    |
+----+------------------------------+--------+
 ≈ 18-23 dev days  (Round 3 said 10-12 → corrected upward)
```

## Plan deltas

```
 D7.1  P2 effort 10-12 → 18-23 dev days.
 D7.2  Aadhaar class may not be storable at all (⚖️ L7/L8); design keeps it
       isolated so it can be dropped without touching other classes.
```

## Needs owner / CA

```
 E3 sign-off · L7, L8, L12 · who may see plain values (role matrix above is [A])
```
