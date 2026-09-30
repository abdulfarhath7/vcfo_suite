# 01 — Architecture of the bridge

## Shape

```
Suite:  checklist_state
          │  (existing, tested resolvers)
          ▼
        buildDocPackContext()
          │
          ▼
        src/lib/assist-profile/build.ts        ← new, pure
          │  { profile, missing[], schemaVersion }
          ├─────────────► GET /api/engagements/[id]/assist-profile   ← new route
          │                          │
          │                          ▼
          │               Assist popup "Load from VCFO Suite"        ← new
          │                          │
          └─────────────► "Copy for Assist" button in Suite UI       ← new
                                     │
                                     ▼ (clipboard, fallback path)
                          Assist popup textarea (existing)
                                     │
                                     ▼
                          mapping.js → filler.js → MCA   (unchanged)
```

Two inbound paths into Assist, one shape. The clipboard path exists because it works
on a machine that cannot reach Suite, and because it is the honest fallback when the
fetch path fails.

## Files

### In `vcfo_suite`

```
src/lib/assist-profile/
  build.ts            # DocPackContext → { profile, missing }
  vocabulary.ts       # every value that must match MCA dropdown text exactly
  types.ts            # AssistProfile and AssistProfileResult typedefs
  build.test.ts       # required
  vocabulary.test.ts  # required
src/lib/api/assist-profile.ts     # loader, mirrors src/lib/api/doc-pack.ts
app/api/engagements/[id]/assist-profile/route.ts
src/components/…      # "Copy for Assist" control on the step page
```

### In `vcfo_assist`

```
extension/popup/popup.js      # add the fetch path; existing paste path stays
extension/popup/popup.html    # Suite origin field, engagement picker, new button
extension/manifest.json       # optional_host_permissions
```

No new tables. No migration. No changes under `src/db/` beyond reusing the existing
engagement repository the doc-pack loader already calls.

## Auth and scoping

The route copies `loadDocPack`'s shape exactly: resolve the engagement through the
repository with `AuthContext`, staff only — `super_admin`, `admin`, `manager`,
`intern`. Clients never reach it. A lead sees only engagements they are assigned to,
because the repository already enforces that. Do not add a second access rule here.

## Versioning

`build.ts` exports `ASSIST_PROFILE_SCHEMA_VERSION`. The route returns it. Assist
records it and refuses a version it does not understand, naming the mismatch. Bump it
whenever the profile shape changes in a way Assist's `mapping.js` would misread.

## Trade-offs

- **Pure module plus thin route** rather than building the profile in the route:
  keeps it testable without a database, and lets the clipboard button reuse it.
- **Clipboard before fetch**: costs one extra UI control; buys a working path on day
  one and a fallback forever.
- **No new storage**: the profile is derived on every request. It is small, and a
  cached copy would go stale the moment a lead edits a step.
