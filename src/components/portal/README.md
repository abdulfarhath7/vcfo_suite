# Client portal (redesign, Oct 2026)

The client portal is a port of the owner's prototype into the real app.

- **Prototype (the look and the behaviour):** `C:\Users\Prithish Sai Reddy\Projects\sbc-vcfo-local\source\portal\`
  - markup: `v4/body.txt` (client portal), `v4/newc_body.txt` (the SBC-GCC screens: Overview, Master data, Declarations,
    which are sections of the ONE client portal since 2026-10-29, not a separate seat)
  - logic: `v4js/a1_core.js` (helpers, data model, popover, filing card), `a2_home.js`, `a3_inc.js`, `a35_regs.js`,
    `a4_cal.js`, `a55_master.js`, `a5_docs.js`, `a6_rest.js` (library, credentials, team, audit, settings, walkthrough,
    chat, search), `a58b_newc.js` (new client), `a57_xlsx.js` (workbook engine for the new client's forms)
  - its sample data: `source/data/ref/{data,rich,flows}.js`, `source/data/xl/master.json`
  - handoff: `sbc-vcfo-local/docs/HANDOFF.md`; the SBC registration & compliance manual: `sbc-vcfo-local/docs/compliance-manual.md`
- **Functional reference:** the API routes under `app/api/client/*`. The previous portal (`src/components/client-portal/`)
  was deleted on 2026-10-29 once this one was complete; read it from git history (`git show HEAD:src/components/client-portal/...`)
  if you need to check how a feature worked before.

## How the new portal is built

| File | What it is |
|---|---|
| `PortalRoot.tsx` | root `.cpx` element, sprite, providers, overlays (rendered by `ClientGate` from `app/app/client/layout.tsx`) |
| `runtime.tsx` | `usePortal()`: `go(section)`, `openPop`, `openWizard`, `openModal`, `toast`, `openChat`, theme, `useNavBadge`, `usePaletteItems`, `useIntent` |
| `overlays.tsx` | `PopHead`, `WizardView` (+ `WizStep`), `ModalBox`, search palette |
| `ui.tsx` | `Icon`, `Sym`, `Btn`, `IconBtn`, `GoArrow`, `Seg`, `LawChip`, `StatusPill`, `Pill`, `DateTile`, `Timer`, `SecHead`, `SecLoading`, `SecError` |
| `data.ts` | shared queries: `usePortalIncorporation()` (step model), `useClientHome()`, `useFilings()`, `useClientDocuments()`, `useIncorporationExtras()`, `useClientOverview()`, `getJson`, `sendJson`, `useRefreshPortal()` |
| `dates.ts` | `todayIso`, `fmt`, `fmtY`, `fmtL`, `rel`, `daysTo`, `addDays`, `fyOf` (prototype wording) |
| `Shell.tsx` | sidebar, top bar, phone tabs, one `<section class="sec" id="sec-<key>">` frame per section |
| `Intent.tsx` + `app/app/client/**/page.tsx` | each route only sends an intent (`section`, `step`, `phase`, `board`, `notes`, `anns`, `reader`, `filing`) |
| `sections/<area>/` | one folder per section; `section-registry.tsx` maps keys to components |
| `css-src/` → `css/` | prototype CSS copied verbatim, scoped under `.cpx` by `node scripts/portal-css.mjs` |

**Markup:** use the prototype's class names and DOM structure exactly (`glass panel`, `ph`, `pill due`, `sr`, `nd` …).
The prototype CSS is already loaded, so the right markup is styled with no extra CSS. Inline styles that the prototype's
JS set are fine as inline styles. Only if a React-specific need appears, add a new file `css-src/95-<area>.css` (never
edit the copied files) and run `node scripts/portal-css.mjs`.

**Popovers, walkthroughs and modals take a React node.** Pass a component (`openPop(anchor, <FilingCard id={f.id} />)`),
and let that component read live data with hooks, so an open card refreshes with the data.

**The section frame is drawn by the shell.** A section component returns what goes inside
`<section class="sec">`: its `.sec-h` header and its panels. Do not render another `.sec`.

## Rules (from the owner and the repo)

1. **Real data only.** Every number, name, date and status comes from the database through `/api/client/*` routes.
   Never ship the prototype's sample data (Northwind, Rahul Khanna, Priya Raman …). With no data, show a short,
   plain empty state. **No "coming soon" anywhere.**
2. **Keep every real function** the previous portal had (uploads, approvals, sign-offs, OTP reveal, invites, exports,
   reminders, notification preferences, WhatsApp opt-in, Ask VCFO). Only the look changes.
3. **Backend changes are allowed** when a prototype screen needs data the API does not return yet. Follow the seam:
   only `src/db/repositories/*` imports `db`; every repository function takes an `AuthContext` and scopes a client to
   their own engagement (`getMyEngagement` + `assertEngagementAccess`); routes call repositories. Add a test for new
   repository logic. Prefer pure helpers in `src/lib/` with unit tests.
4. Use names from the real tool (checklist step titles in `src/data/checklist.ts`, filing names from the register).
5. Dark and light must both read well; no overlap, no clipped text, no sideways scroll from 390 px to 1440 px.
6. Do not commit, push or start another `next dev` (one runs on :3000). Do not touch other sections' folders.
