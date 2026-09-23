# QUESTIONS

Append-only. Judgement calls the docs don't cover. Don't block — pick the default,
record it, keep building.

## Q<n> — <short title>
- **Context:**
- **Default chosen:**
- **Alternative:**
- **Answer:** _(left blank for the human)_

---

## Q1 — Director identity across reorders
- **Context:** the extension's `mapping.js` targets MCA repeat panels by positional
  `instance`. Removing or reordering a director on pre-15 renumbers everyone, so a
  profile generated before the change puts one director's data against another's
  panel. The same hazard already exists for generated drafts.
- **Default chosen:** preserve `ProposedDirector.index` as array position, and also
  emit a stable `id` per director so a consumer can detect a reorder.
- **Alternative:** positional only, with a warning note in `notes`.
- **Answer:** Emit a stable director id alongside the positional index (owner, 2026-09-23).
  Built: every `directors[]` entry carries `id` (the `pre-15` entry id, or `legacy-{n}`)
  and `index` (= array position + 1). The parity test lists both as informational keys
  `mapping.js` does not read.

## Q2 — Sections Suite cannot supply
- **Context:** `agile`, `moa` and `aoa` largely have no home in `checklist_state`.
- **Default chosen:** emit them as `missing` with a reason, and treat the resulting
  list as the specification for a later Suite change.
- **Alternative:** add fields to existing steps now.
- **Answer:**

## Q3 — "missing: []" on a full engagement, and subscribers
- **Context:** `docs/04` asks for a full engagement to produce `missing: []`, but also
  says a field Suite does not hold is listed in `missing`. Some fields no engagement can
  ever supply today (sub-category of company, father's name in parts, place of birth,
  every AGILE-PRO-S / MoA / AoA input), so a literal `missing: []` is impossible without
  hiding them. Separately, `subscribers[]` has no Suite resolver: `pre-16` holds only
  non-director subscribers and nothing records which directors subscribe or for how
  many shares.
- **Default chosen:** one `missing` array. An item with no `reason` is a blank Suite
  field the lead can fill; an item with a `reason` (`Suite does not collect this yet`,
  `no MCA equivalent mapped`, `…one line of text…`, `…whole shares…`, `…cannot
  convert`) is one Suite cannot supply. The test asserts a full engagement has no
  reason-less items, and the Copy for Assist chip counts only those (so a full
  engagement shows "Nothing missing"). `subscribers` is not emitted; it is one
  `missing` item at `pre-16` plus a note to enter subscribers and the Part B section 3 counts
  on the portal.
- **Alternative:** split into `missing` and `unsupported` arrays (a contract change for
  Assist), or build a `pre-16` resolver and a "directors subscribe equally" rule.
- **Answer:**

## Q4 — Registered office held as one string
- **Context:** Suite stores `registeredOfficeCompleteAddress` as one textarea. MCA wants
  line 1 and line 2 (25 characters each), PIN code, and lets the PIN fill area / city /
  district / state. `moa.ts` has a best-effort state parser; it is a guess, so it is
  not reused.
- **Default chosen:** `registeredOffice` carries only `country: 'India'` (structural)
  and the company mail / mobile from pre-1. Line 1 / line 2 / PIN are one `missing`
  item with the "one line of text" reason, and the full address is put in `notes` so
  the lead can type it. The whole section is omitted when there is no address.
- **Alternative:** take a trailing six-digit number as the PIN code (Indian postal
  convention) so the portal lookup fills the rest; or add structured fields to pre-14.
- **Answer:**

## Q5 — Company structure from the name suffix; where e-form gaps point
- **Context:** Suite holds no type / class / category of company (Part A says they are
  project settings, and `companyType` is only domestic / foreign). Part A validation
  does require every proposed name to end in "India Private Limited".
- **Default chosen:** `vocabulary.ts` maps the legal suffix "Private Limited" (not
  "(OPC)") to `New Company (Others)` / `Private` / `Company limited by shares`; any
  other suffix is `missing` with "no MCA equivalent mapped". Sub-category stays
  `missing` (not collected). AGILE-PRO-S / INC-33 / INC-34 gaps point at `pre-10`
  (SPICe+ Filing, where those e-forms are filed) with no tab.
- **Alternative:** leave all four structure fields missing; point e-form gaps at the
  step that should eventually collect them once one exists.
- **Answer:**

## Q6 — Chip count and director-level noise
- **Context:** fields no director has in Suite (nationality, place of birth, area of
  occupation, stay duration) would otherwise repeat once per director.
- **Default chosen:** one aggregated `directors.<field>` item each. Per-director items
  remain for fields that differ per person (father's name split, address split, blank
  PAN, unmapped gender, …).
- **Alternative:** one item per director per field.
- **Answer:**
