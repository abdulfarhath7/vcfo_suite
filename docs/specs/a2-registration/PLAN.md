# A2 · Registration agent — implementation plan

Sources: `vcfo_agent_plan.md` (A1–A6, section 4 is A2) and SBC-STD-AI-02, the AI policy
("Agents prepare. Humans file."). This plan says what A2 is, what the policy requires of it,
where it sits in this codebase, and the order to build it in.

---

## 1. What A2 actually is

A2 is **not fourteen AI agents**. It is fourteen **rule packs**: versioned, cited, deterministic
data that tell the rest of the chain what each registration needs. Each pack holds:

1. applicability (the thresholds A1.3 evaluates),
2. the entity-wise document matrix (what A4.1 turns into a checklist),
3. the form fields and where each value comes from (what A4.3 maps),
4. the portal and the human-only steps (login, OTP, DSC, submit, pay),
5. the result (the number and certificate A4.8 captures),
6. the post-registration duties and due dates (what A1.4 adds to the calendar),
7. prerequisites (the dependency graph A1.1 uses).

A2 itself makes **no model calls**. Reading documents (A4.2) and drafting query replies (A4.7)
are where a model is used. This keeps A2 inside pillar 2 of the policy: "Code calculates".

A2's autonomy level is **L2 (Prepare)**: it drafts and assembles inside the firm vault, and a
maker reviews every output. It never reaches L4.

## 2. What the policy requires of A2 (the build checklist)

| Policy rule | What it means for A2 |
|---|---|
| Rule 1: agents never submit | Each pack lists its human steps. No code path in A2 or A4 presses submit or pays. |
| Rule 2: agents never hold credentials | Rule packs and every A2/A4 run must never read portal passwords. See risk R1 below. |
| Rule 3: three human layers | Each pack names its gates (K0, K1, K2, K4, K5). Maker, checker and approver are different people. |
| Rule 5: numbers come from code | Thresholds, fees and validity periods are data and code, never model output. |
| Rule 10: everything is logged | Every run records `rulePackId@version`, its inputs, outputs, reviewer and decision. |
| Prompts and skills are production code | Packs are versioned in git, reviewed by a second person, and must pass their golden cases before release. |
| Knowledge is dated and cited | Each rule carries its source (SOP section, Act and section, notification) and an `effectiveFrom` date. |
| Year-gated law | Where a rule cites income-tax law, the pack carries both the 1961 and the 2025 Act sections. |
| PII | Packs hold no client data. KYC values come from the A1.2 profile, which has the Personal Data label, and are tokenised before any model call. |
| Valid run | A run needs an engagement ID, a registered agent, inputs from the vault, a passed self-check and a reviewer, or it is quarantined. |
| Release gate | Golden cases, regression, red team, citation and number ties, then AI Council sign-off. |

## 3. What already exists in this repo (reuse, do not rebuild)

| Existing code | Use in A2 |
|---|---|
| `src/data/checklist.ts`: registration steps `reg-1` to `reg-24` | Each pack points at its step (`checklistStepId`). The step stays the place where answers and the certificate are stored. |
| `src/lib/registrations/registration-facts.ts` (`SOURCES`) | It already maps each step to its number, date, certificate and expiry fields. A pack's `result` block should name the same fields. Later, `SOURCES` can read from the packs. |
| `src/lib/assist-agents/pack.ts` + `packs/*.json` | This is the pattern to copy: JSON validated by zod, with `PACK_GATES` (`LOGIN`, `CAPTCHA`, `OTP`, `DSC`, `SUBMIT`, `PAY`, `EVC`). A rule pack's `portal.assistPack` points at `gst`, `epfo`, `esic` or `dgft`. |
| `src/lib/assist-agents/signing.ts` | Hashing and signing for A4.5 filing packs later. |
| `src/lib/assist-agents/pii.ts` (`containsPersonalData`) | A test asserts that no rule pack contains personal data. |
| `src/lib/assist-agents/attestation.ts` (`certifierAllowed`) | The "checker is not the maker" rule for K2. |
| `src/lib/compliance/obligations-seed.ts`, `generate-instances.ts` | A pack's `duties` name obligation ids that already exist here, so A1.4 reuses the calendar engine. |
| `src/db/repositories/audit-events.ts` | The run log, until the Evidence Locker exists. |

Mapping of the 14 packs onto existing steps:

| A2 | Pack id | Step | Notes |
|---|---|---|---|
| A2.1 | `gst` | `reg-4` | Has a tracker (`gst-tracker.ts`). Monthly vs QRMP path (manual fix #3). |
| A2.2 | `clra` | `reg-13` | State-specific. |
| A2.3 | `epf` | `reg-1` | Blocked until manual fix #2 (20 vs more than 20). |
| A2.4 | `esi` | `reg-3` | State threshold varies. |
| A2.5 | `iec` | `reg-8` | |
| A2.6 | `lwf` | **none** | A new step (`reg-25`) is needed. |
| A2.7 | `lei` | `reg-6` | Renewal is per-entity (manual fix #4). |
| A2.8 | `lut` | `reg-5` | Also read from `reg-4` (`ALSO_FROM`). Has a tracker. |
| A2.9 | `non-stpi` | `reg-11` | Needs GST + IEC. |
| A2.10 | `posh` | `reg-14` | Not a portal filing: drafts the policy, IC note, awareness plan and annual report. |
| A2.11 | `pt` | `reg-7` | State-specific. |
| A2.12 | `shops-establishment` | `reg-9` | State-specific. Root of the labour dependency graph. |
| A2.13 | `trade-licence` | `reg-10` | Municipal. |
| A2.14 | `trademark` | `reg-12` | Hands search, class and objection work to A3. Renewal (`reg-17`) belongs to A5.7. |

The other `reg-*` steps (PAN/TAN, MSME, ICEGATE, patent, FCGPR, FDI, ODI, FLA, FCTRS) are
outside A2's fourteen. They stay as manual checklist steps for now.

## 4. Where the code goes

```
src/lib/rule-packs/              pure: no db, no fetch, no model
  schema.ts                      zod schema for one rule pack (+ types)
  load.ts                        load and validate every pack once; fail the build on a bad pack
  applicability.ts               evaluate a pack's conditions against a client profile → { applies, reasons[] }
  documents.ts                   document matrix → checklist for one entity type, state and premises
  graph.ts                       prerequisites → order, "blocked by", cycle check
  result.ts                      check a captured number (GSTIN, IEC, LEI…) against the pack's pattern
  *.test.ts                      beside the code
src/data/rule-packs/*.json       the 14 packs (state variants inside each pack)
tests/rule-packs/golden/*.json   anonymised client profiles with the known correct answer per pack
docs/specs/a2-registration/      this plan, the AI-register entry, the per-pack review sign-offs
```

No database tables are needed for A2 itself. Packs are versioned in git, and a run stores
`rulePackId@version` when A4 records it.

### The rule pack schema (draft)

```ts
{
  id: 'shops-establishment',
  agentId: 'A2.12',
  checklistStepId: 'reg-9',
  title: 'Shops & Establishment registration',
  version: '1.0.0',
  effectiveFrom: '2026-04-01',
  ownerTeam: 'HR & Compliance',
  sources: [{ ref: 'SBC R&C Manual v1.0', section: 'SOP 12', note: '...' },
            { ref: 'Telangana Shops and Establishments Act 1988', section: 's. 3' }],

  applicability: {                     // evaluated by A1.3, in code
    rule: { always: true },            // or { all: [{ fact: 'employees', op: 'gte', value: 20 }] }
    reason: 'Every establishment needs S&E registration (SOP 12).',
  },
  prerequisites: [],                   // e.g. lut → ['gst']; non-stpi → ['gst', 'iec']

  documents: [                         // A4.1 builds the checklist; A4.2 validates
    { key: 'pan', label: 'PAN of the entity', entityTypes: ['*'], matchOn: ['name', 'pan'] },
    { key: 'partnership-deed', label: 'Partnership deed', entityTypes: ['partnership', 'llp'] },
    { key: 'rent-agreement', label: 'Rent agreement', when: { premises: 'rented' }, maxAgeDays: null },
    { key: 'electricity-bill', label: 'Latest electricity bill', maxAgeDays: 60 },
  ],

  form: {                              // A4.3 maps; A4.4 re-checks
    portal: 'State labour portal',
    assistPack: null,                  // or 'gst' | 'epfo' | 'esic' | 'dgft'
    formCode: 'Form-A',
    fields: [{ key: 'establishmentName', from: 'profile.legalName', required: true }],
  },
  humanSteps: ['LOGIN', 'OTP', 'SUBMIT', 'PAY'],
  gates: ['K0', 'K1', 'K2', 'K4', 'K5'],

  result: { numberField: 'shopsRegistrationNumber', certificateField: 'shopsCertificateUrl',
            expiryField: 'shopsLicenceExpiryDate', numberPattern: null },
  duties: [{ obligationId: 'se-renewal', note: 'Renewal due 1 December (manual, annual sheet).' }],

  stateVariants: {                     // only what differs by state
    TS: { form: { portal: 'labour.telangana.gov.in' } },
  },
}
```

## 5. Before you write code (phase 0, decisions)

1. **Resolve the manual corrections that touch A2** (plan section 13): #2 (the EPF threshold),
   #4 (LEI renewal per entity), #8 (the TOC and the empty "CLRA – Additional Reference"). A pack
   cannot be written on a rule the manual contradicts.
2. **Get the SOP text for each of the 14 registrations** into `docs/specs/a2-registration/sources/`.
   Every rule in a pack must cite a line in it.
3. **Pick the pilot.** The plan allows A2.12 S&E or A2.11 PT. **Use S&E.** It applies to every
   client and is the root of the labour dependency graph. Start with one state only (the state
   most of your clients are in).
4. **Register A2 in the AI register**: owner (VCFO product lead), purpose, data (no client data in
   packs), model (none), level L2, gates. AI Council approves.
5. **Agree the interface with whoever builds A1 and A4.** A2 exports pure functions: `getPack`,
   `evaluateApplicability`, `buildDocumentChecklist`, `registrationOrder`, `checkResultNumber`.
   A1 and A4 call them. A2 calls neither.

## 6. Build order

### Phase 1 — schema and engine (no packs yet) · built 2026-11-13

Built in `src/lib/rule-packs/` as listed in section 4, plus `effective.ts` (a state variant laid
over its pack) and `test-fixtures.ts`. The schema also enforces: login and submit stay human on a
portal pack, K0, K1 and K2 on every pack, K5 on a portal pack, two different reviewers before a
pack leaves `draft`, and a source on every rule. The list below is the original brief.

- `schema.ts` with zod. A test that every JSON file in `src/data/rule-packs/` parses.
- `applicability.ts`: `always`, `all`, `any`, `not`, and the operators `gte`, `gt`, `eq`, `in`,
  `bool`. Every result returns the reason and the source it came from. Missing facts give
  "unknown", never "no".
- `graph.ts`: topological order and a cycle test over the dependency graph in plan section 4.
- `documents.ts`: filter by entity type, state and premises (owned or rented).
- Tests: `containsPersonalData(pack) === false` for every pack; every rule has a source;
  every `checklistStepId` exists in `src/data/checklist.ts`; every `obligationId` exists in the
  obligations seed; every `assistPack` exists in `src/lib/assist-agents/packs/`.

### Phase 2 — the S&E pilot pack
- Write `shops-establishment.json` for one state.
- Write 5 to 10 golden cases: a company, an LLP, a partnership and a proprietorship, with owned
  and rented premises, and one profile with a missing fact. Each case has the expected
  applicability, document checklist and duties.
- The HR & Compliance team reviews the pack line by line against the SOP and signs it (two people).

### Phase 3 — show it in the app (read-only, behind a flag)
- On the registration box (`src/views/compliances/RegistrationBoxes.tsx`) show "Applies because…"
  and "Documents needed" from the pack. This lets the team check the pack against real
  engagements before A4 exists.
- Read through a repository that takes an `AuthContext`, as the seam rule requires.

### Phase 4 — the other 13 packs, in waves of similar packs
- **Wave A, state labour:** PT, LWF (add step `reg-25`), Trade Licence, CLRA.
- **Wave B, central payroll:** EPF (after fix #2), ESI.
- **Wave C, tax and trade:** GST (both monthly and QRMP paths), LUT, IEC, Non-STPI, LEI.
- **Wave D, special:** POSH (a document set, not a portal form), Trademark (hands off to A3).

Each pack is done when:
- [ ] every rule cites a source and has an `effectiveFrom` date,
- [ ] golden cases pass, including one entity type that does *not* need the registration,
- [ ] its prerequisites and duties resolve to real ids,
- [ ] its human steps are listed and nothing in code performs them,
- [ ] the owner team has reviewed it (two named people), and the sign-off is in this folder.

### Phase 5 — release gate (policy section 12)
1. Golden cases pass for all 14 packs.
2. Regression: CI runs the golden cases. A change that breaks a protected case fails the build.
3. Red team: A2 reads no outside content, so this falls on A4.2. Record that in the release note.
4. Citation and number ties: every citation resolves; every threshold equals the SOP.
5. AI Council signs the release note. The AI register entry is updated.

Then follow the pipeline in plan section 12: spec, legal check, build, code review and legal
re-check, staging, pilot, production, monitor.

## 7. Risks to raise now

- **R1 — portal passwords in the app.** Commit `3bd843d4` stores registration portal usernames and
  passwords (encrypted) in the credentials workbook (`src/db/repositories/credentials/registration-logins.ts`).
  The policy says credentials are never placed in "a document an agent can read" and that SBC does
  not ask clients for primary account passwords. At a minimum, A2 and A4 code must never import that
  repository, and a test should enforce that. Ask the security officer whether the store may exist
  at all once agents run in this app.
- **R2 — A2 depends on A1 and A4, which come first in the build order.** The packs and the engine are
  pure, so they can be built and tested now. Until A1.3 exists, applicability is shown as advice
  only (phase 3) and the Partner's K0 approval stays manual.
- **R3 — state variation.** S&E, PT, LWF, CLRA and Trade Licence differ by state. Build one state per
  pack first, and treat a state with no variant as "not covered", never as "not applicable".
- **R4 — manual drift.** Once the packs exist, they are the rules. Regulatory Watch proposes changes,
  a person accepts them, and the version bumps.
