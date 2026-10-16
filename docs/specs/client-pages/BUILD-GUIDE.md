# Client portal v7 — build guide (for every builder)

The client portal is an exact replica of `prototype/vcfo-client-portal-FINAL.html`,
built inside the existing app and wired to real data. Readable FINAL sources:
`prototype/final-src/` (extracted from the FINAL bundle; FINAL wins over `prototype/src/`).
Per-area catalogues: `BUILD-INVENTORY.md` (one section per area).

## Owner rules for this build

- Do NOT run tests, write tests, take screenshots or set up a database. The owner tests.
  `npx tsc --noEmit -p .` only to find a broken import while writing code.
- Take your own decision at every choice. Record every decision or assumption the owner
  may want to change as a row in `QUESTIONS.md` (repo root):
  `| area | question | what was decided | how to change it |`.
- Nothing may be left out: every screen, state, pop-up, hover, animation, empty state,
  before/after variant and breakpoint in the prototype must exist in the app.

## Architecture

| Piece | Where |
|---|---|
| Shell (sidebar / rail / drawer, top bar, Before/After pill, Ask VCFO launcher + chat, toast, drill-down, Search ⌘K) | `src/components/client-portal/` — `ClientPortalShell`, `Sidebar`, `TopBar`, `AskLauncher`, `PortalProvider`, `SearchPalette` |
| Shared runtime hook | `usePortal()` from `src/components/client-portal/PortalProvider.tsx`: `shell`, `after`, `setAfter`, `theme`, `toast(msg, {undo})`, `drill(cfg)`, `tipAt(x,y,text)`, `openChat(question?, whatsThis?)`, `go(routeKeyOrPath)`, `savePrefs`, `prefs` |
| Route keys → paths | `src/components/client-portal/routes.ts` (`portalHref`, `stepHref`, `phaseHref`) |
| Icons | `src/components/client-portal/icons.tsx` (`Lu`, `ShellIcon`, `RawSvg` for any SVG body copied verbatim) |
| Bot avatar | `src/components/client-portal/Visor.tsx` (`VisorHead` static head; `VisorCharacter` loop/peek) |
| Page components | `src/components/client-portal/pages/<area>/…` |
| Page routes | `app/app/client/**/page.tsx` — keep the existing URLs; a page file renders the area component |
| New tables | `src/db/schema-portal-<area>.ts` (already re-exported from `src/db/schema.ts`; touch `profiles`/`engagements` only inside lazy `.references(() => …)` callbacks — circular import) |
| New repositories | `src/db/repositories/<name>.ts` — the ONLY place that imports `db`. Every function takes `AuthContext`, scopes by role (Path A), header comment states the access rule |
| New API routes | `app/api/client/…/route.ts`, template `app/api/client/portal/route.ts` (`requireAuth`, repository call, 403/404 mapping) |

## CSS — copy the prototype verbatim

1. Copy each board's `<style>` (and inline-style-heavy blocks you turn into classes) into
   `src/components/client-portal/css-src/<area>-<board>.css`, first line
   `/* @cp-scope page=<area> */`.
2. Run `node scripts/cp-css.mjs` — writes `css/<same name>.css` with every selector
   scoped to `.cp .cp-<area>` and keyframes suffixed per file. `:root`/`html`/`body`
   map to the page root. `html[data-theme="dark"] X` → `.cp[data-theme="dark"] .cp-<area> X`.
3. Import the generated file from the area's page component: `import '../../css/<file>.css'`.
4. The page root element carries `className="cp-<area>"`.
5. Shared CSS already loaded for every page: tokens (light + True-black dark), the shared
   board stylesheet `b/ecdc…css` (`.card .ch .st .chip .btn .btn-p .btn-o .btn-n .seg
   .thumb .info .pop .tgl .row .dlg .ov .sk .toast .tl .dtile .node [data-tip] …`),
   shell, runtime (`#vp-chat`, `#vp-drill`, `#vp-toast`, `#vp-tip`), top bar.
   Do not duplicate them; a board that redefines them gets its own page-scoped copy.
6. Inside `.cp` every element starts from the browser's default styles (the app's
   Tailwind preflight is reverted), so prototype markup renders as in the prototype.
   An existing Tailwind widget reused inside a page goes in a `<div className="cp-tw">`.
7. Fonts: Manrope, Space Grotesk and IBM Plex Mono are self-hosted with the prototype's
   own files under those family names — write `font: 700 13px Manrope` as in the prototype.

## Markup

- Same element types, class names, nesting, inline styles (as React style objects) and
  SVGs as the prototype. Static text stays verbatim; prototype demo values become data.
- `data-go="key"` → `onClick={() => go('key')}` (or an `<a href={portalHref('key')}>`).
- `data-tip="…"` stays as an attribute (CSS tooltip, 120 ms). Icon-only controls also get
  `aria-label` (rule 17).
- `(i)` → `.info` with `<button>` + `.pop` (≤280 px) ending in an "Ask VCFO about this"
  row that calls `openChat('Tell me about <title>')`.
- Charts / donuts / bars: hover → `tipAt`/`data-tip`; click → `drill({...})` with the
  clicked part pre-selected; rows open their real page (rule 14).
- Toasts: `toast('…', { undo })` exactly where the prototype toasts.
- Bot speech bubbles (rule 16): `VisorHead` 40–56 px + bubble.
- Breakpoints: phone ≤767, tablet 768–1279, desktop ≥1280 (CSS media queries copied
  from the boards). Where the prototype has a separate phone board (`m` file in
  `routes.js`), render the phone component under 700 px (`useBreakpoint()` from
  `Sidebar.tsx` gives phone/tablet/desktop; add a width check where 700 is needed).
- Before / After: `const { after } = usePortal()` — true when the client sees the
  after-incorporation layout (real COI state unless the client flipped the pill).

## Data

- Fetch through API routes with TanStack Query (`useQuery`, `useMutation`), as the rest
  of the app does. Reuse existing routes/hooks first: `/api/client/overview`
  (`ClientOverview`), `useApp()` (engagements, checklist state, `updateItem`,
  `submitChecklistItem`), `/api/filings`, `/api/documents`, `/api/notifications`,
  `/api/announcements`, `/api/audit-logs`, `/api/account/*`, `/api/ask/*`.
- Missing data → NEW repository + route + (if needed) table. Never fake a value; if a
  value truly has no source, hide the element and add a QUESTIONS.md row.
