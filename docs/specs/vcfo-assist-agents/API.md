# VCFO Assist agents — Suite API

This is the server side the VCFO Assist extension calls for the agents in `PLAN.md`. Every route
lives in VCFO Suite and is called **from inside a signed-in Suite tab** (`chrome.scripting.executeScript`
running `fetch` in the Suite page), exactly like `/api/engagements/[id]/assist-profile`. The calls are
therefore same-origin and carry the Auth.js session cookie. There is no CORS header, no `OPTIONS`
handler, no bearer token and no extension origin list; see `docs/specs/assist-profile/06-no-cors.md`.
Do not call these routes from the extension's own origin.

## Common rules

- **Auth.** Staff only: super admin, admin, manager and project lead (`intern`). A client or a
  developer account gets `403`; no session gets `401`.
- **Scope.** Runs are reached through their engagement. A manager reaches engagements they manage,
  a lead the engagements they lead, admins every engagement. An engagement or run out of reach
  answers `404`, never `403`, so ids cannot be probed.
- **Labels only.** No request may carry a profile value. Only the free-text fields of a body are
  checked: the resolver's `fieldKey`, `fieldLabel` and candidate `label` / `name` / `aria`; the
  patch's `fieldKey`, `proposed` and `evidence`; the run update's `error`, heal `field` names and
  refusal `kind` / `target`. Anything there that looks like a PAN, Aadhaar, passport, DIN, email or
  phone number is refused with `personal_data` (`400` on the run and patch routes, `422` on the
  resolver). Ids (`runId`, `recipeId`), versions, enums and the SRN are never checked: a uuid whose
  first group is all digits looks like a DIN, so checking it would refuse a good request.
- **Responses.** JSON, `Cache-Control: private, no-store`. Success bodies have `ok: true`; errors
  are `{ ok: false, error: "<code>" }`. A malformed body is `400` with the first validation message
  as `error` (for example `srn_shape`, `personal_data`, or zod's own text).
- **Engagement ids.** `[id]` accepts the engagement uuid, a legacy app id or the project slug, the
  same as the assist-profile route.
- **Live portals, per pack.** Runs may start only on a mock portal host unless the task's own portal
  pack is live. A pack is live only when its JSON says `legalStatus: "cs-cleared"` (set in code,
  with a deploy, after the written CS opinion names that portal) **and** the server names it in
  `ASSIST_LIVE_PACKS` (comma separated, for example `mca-v3,income-tax-efiling`). Either alone is
  not enough, and approval for one pack never opens another pack's hosts. `ASSIST_LIVE_PORTALS=true`
  is a deprecated alias that names `mca-v3` only. Every pack is `mock-only` today, so nothing is
  live. Mock hosts come from `ASSIST_MOCK_HOSTS` (comma separated; `localhost` and `127.0.0.1` by
  default).

## Typical run

1. `GET /api/assist/catalog` — show the agent grid and the task tree; note `packs`, `liveHosts` and `mockHosts`. At every run
   start the extension reads it again for the kill switch (`extensionDisabled`,
   `minExtensionVersion`) and the firm's own contacts (`firmContacts`).
2. `GET /api/assist/recipes/spice-a` — verify `{ recipe, sig, alg, keyId }` against the extension's
   built-in public keys, then cache it by `recipe.version`.
3. `GET /api/engagements/[id]/assist-profile` — the values (existing route; they never leave the browser).
4. `POST /api/engagements/[id]/assist-runs` — start the run; keep `run.id`.
5. While filling: `PATCH .../assist-runs/[runId]` with progress. On a field miss the extension
   tries T0/T1/T2 itself, then `POST /api/assist/resolve` (T3) with `runId`, then teach mode (T4).
   A heal that found a better SOM path, selector or label is proposed with `POST /api/assist/patches`.
6. At `WAIT_SUBMIT_PAY` the extension polls `GET .../assist-runs/[runId]` until `run.attestation`
   is set; the certifier records it in Suite (`POST .../assist-runs/[runId]/attestation`). Only then
   does the panel show "You do this: Submit and Pay".
7. After the user submits and pays: `PATCH` with `status: "done"` and the `srn`.

"Fix in Suite" in the panel opens `GET /api/assist/step-link/[id]?step=<stepId>` in a new tab; Suite
redirects to that engagement's checklist step in the signed-in role's own shell.

---

## GET /api/assist/catalog

The agents and their tasks, as a flat list (`agents`, the shape older extensions read) and as a
tree of any depth (`tree`), plus each portal pack's legal status and live switch.

Response `200`:

```json
{
  "ok": true,
  "liveEnabled": false,
  "liveHosts": [],
  "mockHosts": ["localhost", "127.0.0.1"],
  "packs": [
    { "id": "mca-v3", "title": "MCA V3 e-filing (www.mca.gov.in)", "hosts": ["www.mca.gov.in"], "legalStatus": "mock-only", "needsCsOpinionFirst": false, "live": false },
    { "id": "gst", "title": "GST portal (www.gst.gov.in)", "hosts": ["www.gst.gov.in", "reg.gst.gov.in", "services.gst.gov.in"], "legalStatus": "mock-only", "needsCsOpinionFirst": true, "live": false }
  ],
  "extensionDisabled": false,
  "minExtensionVersion": null,
  "firmContacts": { "emails": ["desk@firm.in"], "phones": ["9876501234"] },
  "agents": [
    {
      "id": "incorporation",
      "title": "Incorporation",
      "subAgents": [
        {
          "id": "spice-a",
          "agent": "incorporation",
          "title": "Name reservation",
          "form": "SPICe+ Part A",
          "status": "beta",
          "portal": "mca",
          "portalHost": "www.mca.gov.in",
          "pack": "mca-v3",
          "kind": "portal-fill",
          "gates": ["LOGIN", "CAPTCHA", "OTP", "SUBMIT", "PAY"],
          "recipeId": "spice-a",
          "recipeVersion": "2.0.0",
          "stepId": "pre-4",
          "srnField": "nameApplicationFilingNotes",
          "path": ["incorporation", "spice-a"]
        }
      ]
    }
  ],
  "tree": [
    {
      "type": "group", "id": "compliance", "title": "Compliance", "path": ["compliance"],
      "children": [
        { "type": "group", "id": "income-tax-tds", "title": "Income tax & TDS", "path": ["compliance", "income-tax-tds"], "children": [
          { "type": "group", "id": "tds", "title": "TDS", "path": ["compliance", "income-tax-tds", "tds"], "children": [
            { "type": "task", "id": "challan-281", "agent": "compliance", "title": "Monthly TDS challan", "form": "Challan 281 (ITNS 281)", "status": "later",
              "portal": "income-tax", "portalHost": "eportal.incometax.gov.in", "pack": "income-tax-efiling", "kind": "challan-prepare",
              "gates": ["LOGIN", "CAPTCHA", "OTP", "PAY"], "recipeId": null, "recipeVersion": null, "stepId": null,
              "note": "The agent prepares the challan; you create it and pay it through your own bank.",
              "path": ["compliance", "income-tax-tds", "tds", "challan-281"] }
          ] }
        ] }
      ]
    }
  ]
}
```

- **The tree.** Agent → sub-agent → … → task, any depth. A `group` node has `children`; a `task`
  node is one runnable task with the same members as a flat sub-agent. Task ids are unique across
  the tree and never change, so `spice-a` and the other original sixteen ids keep working when the
  tree is regrouped. `agents[].subAgents` lists every task under that agent at any depth, in tree
  order. Today:

  | Agent | Below it |
  |---|---|
  | Incorporation | spice-a, spice-b, agile-pro-s, emoa, eaoa, inc-9 |
  | Post-incorporation | inc-20a, adt-1 |
  | Registration | gst-reg-01, udyam, iec, shops-establishment, pt |
  | Compliance | MCA annual filings › dir-3-kyc, aoc-4, mgt-7; Income tax & TDS › TDS › challan-281 (Monthly TDS challan, Challan 281), tds-return-24q-26q (Quarterly TDS return 24Q / 26Q), form-16 (Form 16 / 16A download); Income tax & TDS › Income tax › challan-280 (Advance tax challan, Challan 280), itr (ITR) |

- **Task members.** `pack`: the portal pack the task runs on (`null` for state portals with no
  pack yet). `kind`: `portal-fill` (the agent fills a web form), `challan-prepare` (the agent
  prepares a tax challan and stops before the payment mode and bank page; the person creates the
  challan and **pays** it through their own bank) or `file-builder` (no web fill: Suite builds a
  file, such as a 24Q or 26Q return for Protean's FVU, and the person validates, uploads and signs
  it). `gates`: the steps only a person takes (`LOGIN`, `CAPTCHA`, `OTP`, `DSC`, `SUBMIT`, `PAY`,
  `EVC`). `note`: one sentence for the panel. `path`: ids from the agent to the task.
- `status`: `beta` has a recipe checked against a capture or the mock (spice-a, spice-b,
  agile-pro-s, emoa, eaoa today); `later` has none yet (`recipeId` and `recipeVersion` are `null`).
  Nothing is `ready` until a supervised live run.
- `stepId`: the checklist step the run advances (`pre-*`, `post-*`, `reg-*`); `null` for
  compliance tasks, which carry `activityId` (`ACT-M08`, `ACT-015-AOC4`, `ACT-015-MGT7`) or nothing
  yet (the tax tasks).
- `portalHost`: `null` for state portals (Shops and Establishments, PT) and for the 24Q/26Q file builder.
- `srnField`: present when a finished run's SRN is appended to that step's filing note.
- `packs`: each portal pack's `legalStatus` (`mock-only` or `cs-cleared`), `needsCsOpinionFirst`
  (true for GST: even capture waits for the CS opinion, because the GST terms bar unauthorised
  interfaces) and `live` (cleared **and** named in `ASSIST_LIVE_PACKS`). The panel shows "Needs CS
  opinion" for a task on a `needsCsOpinionFirst` pack and "Mock only until the CS opinion" for any
  task whose pack is not live. The extension believes `live` only together with `cs-cleared`.
- `liveEnabled` is true when any pack is live; `liveHosts` lists the live packs' hosts. The
  extension refuses a live host that is not in `liveHosts`.
- `extensionDisabled` (`ASSIST_EXTENSION_DISABLED=true`) and `minExtensionVersion`
  (`ASSIST_MIN_EXTENSION_VERSION`, dotted numbers, `null` when unset): the remote kill switch (SAFETY.md
  G18, `DISTRIBUTION.md`). The extension refuses to start a run while the first is true or while its
  own manifest version is below the second, and also when it cannot read the catalog.
- `firmContacts`: the firm's own emails (lower case) and phone numbers (last ten digits), from the
  firm settings' support email and phone, `ASSIST_FIRM_CONTACTS` (comma separated) and the signed-in
  user's email. The no-placeholder guard (G16) never types one of them into a client's field.
- Source: `src/lib/assist-agents/catalog.ts` (tree, live switch), `pack.ts` and `packs/*.json`,
  `app/api/assist/catalog/route.ts`.

## Portal packs

`src/lib/assist-agents/packs/<id>.json`, parsed by `packSchema` in `pack.ts` (strict). One pack per
website: `id`, `title`, `hosts` (exact names or `*.domain`), `mockHosts`, `legalStatus`,
`needsCsOpinionFirst`, `framework` (`aem` or `unknown`), `pages[]` (`id`, `title`, `urlPattern`,
`mockUrlPattern`, `readySelector`, optional `step`: a step only the person takes, such as opening a
wizard section), `selectors` (shared, by purpose), `waits` (`readyMs`, `optionsMs`,
`afterPincodeMs`), `popups[]` (information pop-ups the agent may close; one that reads like Submit,
Pay, OTP or Login is refused by the schema), `gates[]` (must include `LOGIN` and `SUBMIT`),
`source` and `notes[]`.

| Pack | Hosts | Status | Pages |
|---|---|---|---|
| `mca-v3` | www.mca.gov.in | mock-only | SPICe+ Part A, Part B sections 1, 2, 4 and 5, AGILE-PRO-S, INC-33, INC-34, INC-9, login; from the 2026-09-23 captures (`extensions/vcfo-assist/portal-data/mca-v3/`) |
| `income-tax-efiling` | eportal.incometax.gov.in | mock-only | none yet (Challan 280 and 281 are prepared, never paid) |
| `traces` | www.tdscpc.gov.in | mock-only | none yet |
| `protean-tin` | www.protean-tinpan.com, tin.tin.nsdl.com | mock-only | none (24Q/26Q are file builders) |
| `gst` | www.gst.gov.in, reg.gst.gov.in, services.gst.gov.in | mock-only, needs CS opinion first | none |
| `epfo`, `esic`, `udyam`, `dgft` | their portals | mock-only | none yet |

## GET /api/assist/recipes/[id]

One recipe and its signature.

Response `200`: `{ "ok": true, "recipe": Recipe, "sig": "<base64, 64 bytes>", "alg": "ed25519", "keyId": "prod" | "dev" }`.
`404 not_found` for an unknown id; `500 server_error` when `ASSIST_RECIPE_PRIVATE_KEY` is set but is
not an Ed25519 PEM (an unsigned recipe is never served).

- `sig` is Ed25519 over the UTF-8 bytes of the recipe's **canonical JSON**: object keys sorted at
  every depth, no whitespace, `undefined` members dropped (`canonicalJson` in
  `src/lib/assist-agents/recipe.ts`; the extension has the same function).
- **Keys.** `ASSIST_RECIPE_PRIVATE_KEY` holds the private key as PKCS#8 PEM (one line with literal
  `\n` works too) and `ASSIST_RECIPE_KEY_ID` its id (default `prod`; `dev` is reserved).
  `node scripts/assist-recipe-keygen.mjs [keyId]` prints a new pair: the private key for Suite's
  env, and the public key (raw 32 bytes, base64url) for `RECIPE_PUBLIC_KEYS` in
  `extensions/vcfo-assist/src/engine/recipe.ts`. Without a private key, Suite signs with its built-in
  **dev** key (derived from a fixed seed in `signing.ts`, so it is effectively public) and says
  `keyId: "dev"`.
- **What the extension accepts.** It verifies with WebCrypto against its built-in key map
  `{ dev: <dev public key>, prod: null }`. `keyId: "dev"` is accepted on mock hosts only. A key id the
  map does not hold (including `prod` until the owner pastes its public key there), another `alg`,
  or a signature that does not verify is refused, and the run falls back to the bundled copy (mock
  hosts) or stops. A live portal therefore needs the production key on both sides.
- **One source.** `src/lib/assist-agents/recipes/*.json` is the only place a recipe is edited. The
  extension's `src/recipes/bundled.json` is generated from it, signed with the dev key, by
  `node --conditions=react-server --import tsx scripts/assist-recipes-bundle.ts`; tests on both sides
  fail when the two differ.
- Recipe shape (`recipeSchema`, strict; unknown keys are refused):

```ts
{
  id: string; version: 'x.y.z'; title: string; subAgent: string;
  verifiedAgainst: 'mock' | 'capture' | 'live';
  capturedFrom?: string;     // for 'capture': the capture and commit the keys were checked against
  pack?: string;             // the portal pack (packs/<id>.json); Suite applies it before signing
  waits?: { readyMs; optionsMs; afterPincodeMs };   // from the pack
  pages: {
    id;
    packPage?: string;        // a page of the pack; title, urlPattern, mockUrlPattern, ready and step come from it
    title?;                   // required without packPage
    urlPattern?: string;      // a glob on the portal path: `*` any run, `?` one character (required without packPage)
    mockUrlPattern?: string;  // the same on a mock host, for example "/spice-a*.html"
    ready?: Match;            // required without packPage; a CSS match must also be visible
    step?: string;            // a step only the person takes before this page fills (a wizard section)
    closePopups?: Match[];    // information pop-ups the agent may close first (guarded clicks)
  }[];
  fields: {
    key: string;            // Assist profile key, e.g. "company.proposedNames[0]" or "directors[{i}].din"
    slot?: string;          // tells two fields with one key apart; identity "key@slot" (e.g. "directors[0].din@7a")
    page?: string;          // a pages[].id
    som?: string;           // AEM SOM path for guideBridge.resolveNode (not captured for live MCA)
    css?: string;           // e.g. ".guideFieldNode.proposedname1" (MCA's key class); a box is searched for its control
    nth?: number;           // which match of css (0-based); with `each`, each entry takes the next match of that selector
    nodeId?: string;        // the captured AEM node id: the second T0 tier
    label: string;          // the portal label, for T1/T3 heals and the confirm table
    where?: Record<string, boolean | string>;  // with `each`: true present, false absent, a string equal
    waitForOptions?: boolean; // a dependent dropdown: poll up to waits.optionsMs for the option
    lookup?: boolean;       // the portal looks fields up after this one (a PIN code): wait waits.afterPincodeMs
    transform?: 'none' | 'toMcaDate' | 'rupeeAmount' | 'vocabulary' | 'nicDivision' | 'yesNo' | 'upper';
    required: boolean;
    askUser?: boolean;      // the profile cannot supply it: highlight, never type
    note?: string;
    each?: string;          // a repeating template over this profile array, e.g. "directors"
    noPlaceholder?: boolean; // G16; default = required (fieldRejectsPlaceholder)
  }[];
  actions: { id; label; kind: 'safe' | 'human'; match: Match }[];  // Submit / Pay / Final / Sign are always 'human'
  gates: ('LOGIN' | 'CAPTCHA' | 'OTP' | 'DSC' | 'SUBMIT' | 'PAY' | 'EVC')[];
  expect: { id; kind: 'srn' | 'text'; pattern: string /* JS RegExp source */ }[];
}
Match = { som?: string; css?: string; text?: string }   // at least one
```

Every field needs at least one of `som`, `css` and `nodeId`. A recipe without `pack` and with its
own `urlPattern` and `ready` per page (the 1.x format) still parses: the change is backwards
compatible. The extension finds a field by the MCA lookup ladder ported from the old filler: T0 is
the SOM path, then the `css` match number `nth` (searched for its control), then `nodeId`; T1 is the
label. A field whose selector matches on the page but whose control is hidden (another wizard
section, or a conditional field), or whose `nth` block is not open (another person's Add/Edit
sub-panel), is left to the person and never healed by label into another block.

- **Page check.** The extension plans and writes only while the portal tab's path matches the
  page's `urlPattern` (`mockUrlPattern` on a mock host). On another page the run waits with "Open the
  form page" and goes on by itself once the page is open.
- **Repeating groups.** A field with `each: "directors"` is a template: its key must read
  `directors[{i}].…` and its SOM path must hold `{i}` (0-based) or `{n}` (1-based); the CSS selector
  and label may use them too. After the profile is loaded, the extension writes one field per entry
  of that array (at most 20), so `directors[1].din` fills `…director[1].din[0]` and its label reads
  "Director 2: DIN". A placeholder on a field without `each` is refused. The template carries no
  count: the profile decides how many blocks are filled. The mock shows its blocks up front; adding
  an instance on a live form ("Add director") is not built.
- **MCA recipes (`verifiedAgainst: "capture"`, `pack: "mca-v3"`).** Rewritten with the real keys
  from the captured field maps (`abdulfarhath7/vcfo_assist` at `5e58bcf`, now
  `extensions/vcfo-assist/portal-data/mca-v3/`). A test checks every verified key and node id
  against the captured schemas, and the offline harness fills each recipe into the sanitized
  captured fixtures.
  - `spice-a@2.0.0` (`spice.html`): `type-of-company`, `class-of-company`, `category-of-company`,
    `subcategory-of-company` (the last three wait for their options), `nic-text-box` (the person
    picks the NIC row), `proposedname1`, `proposedname2`. Actions: Save and Auto check (safe), Submit
    and Pay (human). Gates `LOGIN`, `CAPTCHA`, `OTP`, `SUBMIT`, `PAY`: Part A has no DSC step and no
    attach slot. `significance` and `trademarkSimilar` were not in the capture: they are `askUser`,
    with a note that their selectors are unverified.
  - `spice-b@2.0.0` (`SpicePartB.html`): four pack pages, one per wizard section the person opens
    (structure and capital, address, subscribers, directors). Capital (`numberOfClasses`, `classe1`,
    `numberofeshares_1`, `subeshare_1`, `amountpershare_1`, `aoaEntrenched`), the registered office
    (`correspondenceaddressline1`/`2`, `correspondenceaddress_pinCode` with the lookup wait, `Area1`
    waiting for its options, `correspondenceaddress_MobileNumber`, `correspondenceaddress_emailID`,
    longitude, latitude, the ROC office). Subscribers with a DIN fill block 6b (`din6b`,
    `noofequityshares6b`), without one block 6c (`firstName6c`, father's names, `date6c`, `pan6c`,
    the email box and more). Subscriber-directors and then directors fill block 7a by DIN (`din7a`)
    or 7b without one (`firstName7bp`, `surName7b`, `pan7b`, `mobile7b`, `emailID7b`, citizenship and
    residence radios); designations are `askUser`. Body-corporate subscribers (6a), addresses of
    individuals and the share-count fields that share one class across blocks (`tableItem12`) are
    not in the recipe yet. Actions: Save, Download PDF and Attach PDF (safe), Submit and Pay (human);
    the captured Part B has no Auto check. Gates add `DSC`.
  - `agile-pro-s@1.0.0` (`AgilePro.html`): state, district, number of directors, declaration place.
  - `emoa@1.0.0` (`INC-33.html`): company name, registered office state, witness name and address.
  - `eaoa@1.0.0` (`INC-34.html`): company name, each subscriber's place of signing (`place`, by
    instance), witness name, address and occupation, DIN/PAN/membership.
  The other captured fields bind to nothing in the Assist profile and are left to the person.

## POST /api/assist/resolve

The T3 heal: pick which candidate element is the field.

Body (strict):

```json
{
  "fieldKey": "company.proposedNames[0]",
  "fieldLabel": "Proposed name (1)",
  "recipeId": "spice-a",
  "runId": "uuid (optional)",
  "candidates": [{ "i": 0, "label": "Name 1", "name": "proposedName1", "aria": "optional" }]
}
```

- `candidates`: 1 to 40 items; `i` is the extension's own index (0–999); each text up to 200 chars.

Response `200`:

```json
{ "ok": true, "choice": 0, "confidence": 0.82, "tier": "T3", "tokens": 912, "aiCalls": 1 }
```

- `choice` is one of the `i` values sent, or `null` (none clearly matches). A model pick outside
  the list is discarded by the server.
- `tier: "T1"` means the server answered with its deterministic fuzzy label match instead of the
  model: no API key configured, the daily Ask token budget nearly spent, the path switched off
  (`ASK_KILL_PATHS=assist_resolve`), the run closed or out of model calls (10 per run), or the
  model reply was not valid JSON (then `aiCalls` is still 1).
- With `runId`, the call's tokens are added to that run's `aiCalls` / `aiTokens` on the server.
  The tokens also count in the Ask token report under "VCFO Assist field match".
- Errors: `422 personal_data`, `422 unknown_recipe`, `400` for a malformed body.
- The model sees only the field key, the field label and the candidates. It returns an index
  through a JSON schema; it never outputs a selector, URL or value.

## POST /api/engagements/[id]/assist-runs

Start a run. The server fills `agent`, `recipeId` and `recipeVersion` from its catalog.

Body (strict):

```json
{
  "subAgent": "spice-a", "portalHost": "localhost:3100", "recipeVersion": "1.0.0", "fieldsTotal": 9, "state": "READY",
  "mcaLoginLabel": "lead@firm.in",
  "device": { "installId": "0f6c1a2e-…", "userAgent": "Mozilla/5.0 …" },
  "extensionVersion": "0.1.0"
}
```

- `portalHost`: the host of the portal tab (a port is ignored). Required.
- `recipeVersion`: optional; send the cached version to detect a stale cache.
- `fieldsTotal`: optional, defaults to the recipe's field count (a repeating template counts once,
  so the extension sends the expanded count). `state`: optional, `READY` by default
  (upper case, `^[A-Z][A-Z0-9_]*$`).
- Evidence (SAFETY.md G14), all optional: `mcaLoginLabel` is the answer to "Which MCA login are you
  using?" (1–120 chars, a user id or email label; never a password; not checked for personal data
  because it is the staff member's own login). `device.installId` is the random id the extension
  keeps in `chrome.storage.local` (8–64 letters, digits and hyphens), `device.userAgent` up to 400
  chars. `extensionVersion` is the manifest version.
- The server adds the Suite user's name and email (kept on the row if the account is later deleted)
  and the client IP of this call (see "Client IP" below).

Response `201`: `{ "ok": true, "run": Run }`.

Errors: `400 unknown_sub_agent`, `400 no_recipe` (a `later` sub-agent),
`409 recipe_outdated` (with `recipeVersion` = the current version: refetch the recipe),
`403 live_portals_disabled` (a live host whose pack is not live, or a host of another pack), `404 not_found` (engagement out of reach).

## GET /api/engagements/[id]/assist-runs

This engagement's runs, newest first (up to 50). Response `200`: `{ "ok": true, "runs": Run[] }`;
`404 not_found` when the engagement is out of reach.

## GET /api/engagements/[id]/assist-runs/[runId]

One run, to resume after a tab reload. `200 { ok, run }`; `404 not_found` when the run is out of
reach or belongs to another engagement.

## PATCH /api/engagements/[id]/assist-runs/[runId]

Progress, the SRN and the finish. Send only what changed.

Body (strict; every member optional):

```json
{
  "status": "running | waiting_user | done | failed | cancelled",
  "state": "FILL",
  "fieldsTotal": 9,
  "fieldsFilled": 7,
  "heals": [{ "field": "company.type", "tier": "T1", "ok": true }],
  "refusals": [{ "kind": "captcha", "target": "Enter captcha", "at": "2026-11-09T10:00:00Z" }],
  "srn": "AA1234567",
  "error": "short reason, no values",
  "blanks": [{ "field": "directors[0].mobile", "reason": "placeholder" }],
  "dscSigners": ["director:e3", "professional:self"]
}
```

- `heals` (up to 200, tiers `T0`–`T4`) and `refusals` (up to 100) **replace** the stored arrays:
  send the run's full list each time.
- `srn`: 6–20 letters and digits, upper-cased by the server.
- `blanks` (up to 300) **replaces** the stored list: the fields the extension left empty for the
  user to fill from the client's records (G16), by key and one of `missing`, `empty`, `placeholder`,
  `firm_contact`. Never the value. The keys are checked for personal data like heal fields.
- `dscSigners` (1–20): who signed at the DSC step, as references only: `director:<entry id>`,
  `subscriber:<1-based index>` or `professional:self`. Suite resolves each to a name from its own
  records (the Assist profile; `professional:self` is the caller) and stores `{ ref, kind, name }`;
  a reference that does not resolve is `400 unknown_signer`. The extension never sends a name.
- Every PATCH notes the client IP in the run's evidence log.
- `aiCalls` and `aiTokens` cannot be sent; only the resolver writes them.
- `done`, `failed` and `cancelled` close the run and stamp `finishedAt`. A closed run answers
  `409 run_closed` to any further PATCH.
- Only the person who started the run, or an admin or manager in scope, may change it
  (`403 forbidden` for another lead).

Response `200`:

```json
{ "ok": true, "run": Run, "srnWriteBack": { "recorded": true, "stepId": "pre-4", "field": "nameApplicationFilingNotes" } }
```

- `srnWriteBack` appears only when this PATCH finished the run as `done` with an SRN on it. Where
  the catalog names an `srnField` (spice-a → pre-4, spice-b → pre-10, inc-20a → post-6), the line
  `SRN <srn> (VCFO Assist, YYYY-MM-DD)` is appended to that filing note through the ordinary
  checklist save (same role rules, audited, no status or review change, no email). Otherwise
  `{ "recorded": false, "reason": "no_step_field" }` and the SRN stays on the run.
  `reason: "checklist_refused"` means the step would not take the save (for example it is locked);
  the run is still `done` with its SRN.
- The write-back reads and saves the checklist by the engagement uuid the route resolved, so a
  run URL that names the engagement by its slug records the SRN too.

### Run

```ts
{
  id: string; engagementId: string; companyName: string | null;
  userId: string; userName: string | null;
  agent: string; subAgent: string; recipeId: string; recipeVersion: string;
  status: 'running' | 'waiting_user' | 'done' | 'failed' | 'cancelled';
  state: string; fieldsTotal: number; fieldsFilled: number;
  heals: { field: string; tier: 'T0'|'T1'|'T2'|'T3'|'T4'; ok: boolean }[];
  refusals: { kind: string; target?: string; at?: string }[];
  aiCalls: number; aiTokens: number; srn: string | null; error: string | null;
  blanks: { field: string; reason: 'missing' | 'empty' | 'placeholder' | 'firm_contact' }[];
  evidence: {
    userName: string | null; userEmail: string | null;           // the Suite user at the start
    mcaLoginLabel: string | null;
    dscSigners: { ref: string; kind: 'director' | 'subscriber' | 'professional'; name: string }[];
    device: { installId: string; userAgent: string; extensionVersion?: string } | null;
    clientIps: { ip: string; forwardedFor?: string; firstAt: string; lastAt: string; calls: number }[];
  };
  attestation: Attestation | null;
  startedAt: string; finishedAt: string | null; updatedAt: string;   // ISO
}
```

`userId` is `null` only after the Suite account was deleted; `evidence.userName` still says who.

### Client IP

Suite takes the IP from the request the same way the rest of Suite does (`clientIp` in
`src/lib/growth/demo-request.ts`): App Runner's front proxy appends the address it saw to
`X-Forwarded-For`, so the right-most entry is the first hop Suite trusts. Entries to its left were
written by the caller and can be spoofed, so the whole chain is kept beside it as `forwardedFor`
(truncated to 200 chars). Each distinct IP is kept once with its first and last time and a call
count, up to 20 per run. Run start and every PATCH count; GET polls do not. The certifier's IP is
kept on the attestation, apart from the filer's.

## POST /api/engagements/[id]/assist-runs/[runId]/attestation

The certifier's due-diligence checks (SAFETY.md G17). Staff only (super admin, admin, manager, project
lead) on a run in the caller's scope. The Suite UI is "Record certifier checks" on the run's detail on
the Assist runs page; nothing in it starts ticked.

Body (strict):

```json
{
  "checks": {
    "fieldsCheckedAgainstRecords": true,
    "registeredOffice": "visited | owner_noc",
    "subscriberSignatures": "in_presence | video_kyc"
  },
  "evidenceDocumentIds": ["<documents.id>", "…"],
  "note": "optional, up to 500 chars, no personal data"
}
```

- `fieldsCheckedAgainstRecords` must be `true` ("I checked every filled field against the original
  records"). SPICe+ Part B (`spice-b`) also needs `registeredOffice` ("I personally visited the
  registered office" or "I hold the owner's NOC") and `subscriberSignatures` ("Each subscriber signed
  in my presence" or "through recorded video-KYC"). Choices a form does not need are dropped.
- `evidenceDocumentIds` (up to 20, default none): live documents of the same engagement's vault (site
  visit photo, NOC, video-KYC record).
- Certifier rule: by default the user who ran the agent may record the checks. When the firm setting
  `assistCertifierMustDiffer` is on (Firm settings → VCFO Assist filing checks; `PATCH
  /api/firm-settings` with `{ "assistCertifierMustDiffer": true }`), Suite refuses the filer with
  `403 certifier_must_differ`.
- One attestation per run, never changed.

Response `201`: `{ "ok": true, "attestation": Attestation }`.

Errors: `400 attestation_incomplete`, `400 unknown_document`, `400 personal_data` (in `note`),
`403 certifier_must_differ`, `404 not_found` (run out of reach or under another engagement's URL),
`409 already_attested`, `409 run_closed`, `409 run_not_filled` (the run is not yet in `CHECK`,
`DOWNLOAD`, `WAIT_DSC`, `ATTACH`, `RECHECK` or `WAIT_SUBMIT_PAY`).

### Attestation

```ts
{
  id: string; runId: string;
  certifierId: string | null; certifierName: string | null; certifierEmail: string | null;
  checks: { fieldsCheckedAgainstRecords: true; registeredOffice?: 'visited' | 'owner_noc'; subscriberSignatures?: 'in_presence' | 'video_kyc' };
  evidenceDocumentIds: string[]; note: string | null; ip: string | null; createdAt: string;
}
```

## Retention

`assist_agent_runs` (with its evidence) and `assist_run_attestations` are kept for **at least one
year** (DPDP Rule 8(3); CERT-In's 180 days is the floor). No job deletes them, and since migration
`0054_assist_filing_safeguards` deleting a staff account sets `user_id` / `certifier_id` to null
instead of deleting the rows. See SAFETY.md G14.

## GET /api/assist/step-link/[id]?step=<stepId>

"Fix in Suite". A `302` to the engagement's checklist step page in the shell the signed-in role can
open, so the extension does not need to know the role:

| Role | Lands on |
|---|---|
| Project lead (`intern`) | `/app/lead/engagements/{slug}/step/{stepSlug}` |
| Manager | `/app/manager/projects/{slug}/step/{stepSlug}` |
| Admin, super admin | `/app/admin/projects/{slug}/step/{stepSlug}` |

- `[id]` is the uuid, legacy id or slug. Without `step`, or with a step id the checklist does not
  know, it lands on the engagement page instead.
- Signed out goes to `/login`; a client or developer to their home; an engagement out of reach to
  the caller's role home (never a `404` page, so ids cannot be probed).
- `?run=<runId>` ("Open in Suite" while the panel waits for the certifier) lands on
  `/app/{super|admin|manager|intern}/assist-runs?run=<runId>` instead, where that run's detail opens
  with "Record certifier checks". A malformed run id falls back to the step link.
- The extension sends the step of the first `missing[]` entry that names one, else the sub-agent's
  catalog `stepId`. Source: `src/lib/assist-agents/step-link.ts`.

## GET /api/assist/agent-runs

The staff page's list: recent runs on every engagement in the caller's scope, newest first.
Query `limit` (1–200, default 50). `200 { ok, runs: Run[] }`.

## GET /api/assist/patches

The recipe patch queue. Query `status` (`proposed` | `approved` | `rejected`; all when absent) and
`recipeId`. Super admin, admin and manager see every patch; a lead sees only the patches they
proposed. `200 { ok, patches: Patch[] }` (up to 100, newest first).

## POST /api/assist/patches

Propose a recipe fix found by a heal.

Body (strict):

```json
{
  "recipeId": "spice-a",
  "recipeVersion": "1.0.0",
  "fieldKey": "company.type",
  "proposed": { "som": "guide[0]...companyType[0]", "css": "[name=companyType]", "label": "Type of Company" },
  "evidence": { "fieldLabel": "Type of company", "candidateLabels": ["..."], "chosenLabel": "Type of Company", "confidence": 0.9, "note": "label reworded" },
  "sourceTier": "T1 | T3 | T4",
  "runId": "uuid (optional)"
}
```

- `proposed` needs at least one of `som`, `css`, `label`. `evidence` is labels only (up to 40
  candidate labels).
- `fieldKey` is the concrete key; a repeating field is proposed as `directors[1].din`, which
  names the recipe's `directors[{i}].din` template, and a slotted field as `directors[1].din@7a`.
- Errors: `400 unknown_recipe`, `400 unknown_field` (the key is not in the recipe),
  `400 personal_data`, `404 not_found` (the run is out of reach).

Response `201`: `{ "ok": true, "patch": Patch }`.

## POST /api/assist/patches/[id]/review

Approve or reject a proposed patch. Super admin, admin and manager only (`403` for a lead).

Body: `{ "decision": "approved" | "rejected" }`.

Response `200`: `{ "ok": true, "patch": Patch }`. Errors: `404 not_found`, `409 already_decided`.
The decision is audited (`assist.patch_approved` / `assist.patch_rejected`). Approving does **not**
change the served recipe: a person applies the fix to the recipe JSON and bumps its version, so
every extension refetches it (`recipe_outdated` on the next run start).

### Patch

```ts
{
  id: string; recipeId: string; recipeVersion: string; fieldKey: string;
  proposed: { som?: string; css?: string; label?: string };
  evidence: { fieldLabel?: string; candidateLabels?: string[]; chosenLabel?: string; confidence?: number; note?: string };
  sourceTier: 'T1' | 'T3' | 'T4'; runId: string | null; proposedBy: string | null;
  status: 'proposed' | 'approved' | 'rejected'; reviewedBy: string | null; reviewedAt: string | null; createdAt: string;
}
```

## Not to be confused with

`/api/assist/runs`, `/api/assist/engagements/[id]/runs` and `/api/assist/engagements/[id]/result`
serve the older `assist_runs` table (migration 0029): the "Start filing" state per compliance
filing period or registration, which the client portal also shows. The agent run log here is a
separate table, `assist_agent_runs` (migration `0052_assist_agents`), and is staff-only.

## Where the code lives

| Part | Path |
|---|---|
| Recipe schema, canonical JSON | `src/lib/assist-agents/recipe.ts` |
| Recipes | `src/lib/assist-agents/recipes/*.json`, `registry.ts` |
| Mock pages and their recipes | `src/lib/assist-agents/mock-fields.ts`; pages generated by `extensions/vcfo-assist/mock-portal/build-mocks.mjs` |
| Catalog tree, per-pack live switch | `src/lib/assist-agents/catalog.ts` |
| Portal packs | `src/lib/assist-agents/pack.ts`, `src/lib/assist-agents/packs/*.json` |
| Captured MCA data | `extensions/vcfo-assist/portal-data/mca-v3/` |
| Signing (Ed25519), key pair | `src/lib/assist-agents/signing.ts`, `scripts/assist-recipe-keygen.mjs` |
| Extension bundle generator | `scripts/assist-recipes-bundle.ts` → `extensions/vcfo-assist/src/recipes/bundled.json` |
| Fix in Suite redirect | `app/api/assist/step-link/[id]/route.ts`, `src/lib/assist-agents/step-link.ts` |
| Resolver | `src/lib/assist-agents/resolve.ts`, `pii.ts` |
| Request bodies | `src/lib/assist-agents/api-schemas.ts` |
| SRN write-back | `src/lib/assist-agents/record-srn.ts` |
| Certifier's checks (rules) | `src/lib/assist-agents/attestation.ts` |
| DSC signer references | `src/lib/assist-agents/dsc-signers.ts` |
| Repositories | `src/db/repositories/assist-agent-runs.ts`, `assist-attestations.ts`, `assist-patches.ts` |
| Tables | `src/db/schema-assist.ts`, `src/db/migrations/0052_assist_agents.sql`, `0054_assist_filing_safeguards.sql` |
| Staff page | `src/views/assist/AssistRunsPage.tsx` and `AssistRunDetail.tsx`, `/app/{super,admin,manager,intern}/assist-runs` |
| Distribution, kill switch | `DISTRIBUTION.md` |
