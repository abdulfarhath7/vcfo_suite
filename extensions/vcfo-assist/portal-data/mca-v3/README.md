# MCA V3 portal data (captured field maps)

This folder holds what VCFO Assist knows about the MCA V3 e-filing forms, taken from recorder
captures of the live portal. It is the source for the `mca-v3` portal pack
(`src/lib/assist-agents/packs/mca-v3.json` in Suite) and for the MCA recipes
(`src/lib/assist-agents/recipes/*.json`).

| Item | Value |
|---|---|
| Source repository | `abdulfarhath7/vcfo_assist` (retired; read only) |
| Source commit | `5e58bcf93e7adbce6bd792ff37001d424a37363a` (23 Sep 2026) |
| Capture date | 2026-09-23 (recorder runs `2026-09-23T11-35-39-714Z` and later) |
| Captured by | The firm's own walk-through of the forms, before the capture rules in `docs/specs/vcfo-assist-agents/PORTAL-CAPTURE.md` were written |

## Files

- `schemas/<form>.json`: one captured schema per form, compacted by
  `tools/portal-data/compact-schemas.mjs` from the old repository's `schemas-full/`. Each field
  keeps its AEM node id, its key and semantic classes (the class MCA puts on `.guideFieldNode`, for
  example `proposedname1` or `din7a`), its label, type, mandatory flag, widget id and name,
  maxlength and option set. Static text blocks are dropped. `index.json` lists the real form URLs.
- `fieldmaps/<form>.json`: the old repository's generated field maps (copied as they were, with
  local paths removed). Each field names its semantic key, its repeat-panel instance, whether it
  waits for its options (`waitForOptions`), and the old profile field it was bound to
  (`sourceField`). The VCFO Suite recipes were rewritten from these; the files are kept as the
  reference for the next recipe.

| Form | URL path | Captured fields |
|---|---|---|
| SPICe+ Part A | `/content/mca/global/en/mca/e-filing/incorporation-change-services/spice.html` | 105 |
| SPICe+ Part B | `.../incorporation-change-services/SpicePartB.html` | 1,177 |
| AGILE-PRO-S | `.../incorporation-change-services/AgilePro.html` | 210 |
| INC-33 e-MoA | `.../incorporation-change-services/INC-33.html` | 128 |
| INC-34 e-AoA | `.../incorporation-change-services/INC-34.html` | 128 |
| INC-9 | `.../incorporation-change-services/INC-9.html` | 286 |
| Login | `/content/mca/global/en/foportal/fologin.html` | 41 (kept only so the guards can be tested against the real login page; never filled) |

## Privacy

The schemas hold field structure only: no value typed into any field. The option sets are the
portal's own lists. One dependent list (Part B `Area1`) holds the localities the portal offered
for the PIN code used during the capture; that is public portal data, not a client's record. The old repository's AGILE-PRO-S schema held two real
director names with their DINs in the `Directornamelist` options (the portal fills that list from
the filing's own directors); the compaction script drops any option shaped like a DIN, PAN,
Aadhaar, email or mobile number, so those are not here. The
raw captures (page HTML, screenshots, network logs) were never part of the old repository and are
not here. New captures follow `PORTAL-CAPTURE.md` and never enter git.

## What was not captured

Part B sections 6 to 10 (OPC nomination, stamp duty, PAN and TAN, attachments, declaration) and the
Part A "significance of the coined word" and trademark questions were not in the captures. Recipe
fields for them are `askUser` with a note, until a new capture confirms their keys.
