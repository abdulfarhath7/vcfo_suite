# Client portal prototype v7: sources, build and checks

Everything needed to rebuild `../vcfo-client-portal-prototype-v7.html` (one self-contained HTML file that opens from disk with no network) and to re-test it.

The aim: to change v7, edit only the affected page, rebundle (about 2 seconds), and re-test only the changed screens.

## Layout

| Path | What it is |
|---|---|
| `app/` | The prototype itself. One file per screen ("board"), plus the shared glue below. |
| `app/routes.js` | Route table: route key, desktop file, phone file (used under 700 px), title. |
| `app/proto.js` | Shared runtime for every screen: routing (`vcfoNav`, `data-go`), toasts, tooltips, the Ask VCFO launcher and chat (the animated avatar, the What's this? answer card), the bottom spacer that keeps content clear of the floating pills. |
| `app/shell.js` | The navy sidebar drawn over every board: full on desktop, icon rail on tablet, drawer on phone; team contacts; the Before / After pill. |
| `app/tl-editor.js` | The timeline editor pop-up (Home). |
| `app/comp-route.js` | Routing inside the Compliances board. |
| `app/brand/` | Logos (light, dark, the V mark). |
| `app/b/` | Images the boards use (SBC logo, document thumbnails) and one shared stylesheet. |
| `build/bundle.js` | The bundler: embeds every board, script, image (as lossless WebP) and font into one HTML file. |
| `build/shell.html` | The outer page of the bundle: intro animation, favicon, the loader that shows each screen in a frame. |
| `generators/incorporation/` | Generates the Incorporation screens (see below). |
| `checks/` | Click audit, responsive scanner, screenshots, bundle comparison, and `check.js` which runs the first two for chosen routes. |

## Setup

Needs Node 18 or newer, python3 with Pillow (`pip install pillow`), and for the checks Playwright with Chromium.

```bash
cd docs/specs/client-pages/prototype/src
npm install                 # fonts (@fontsource) and icons (lucide-static), pinned in package.json
```

Playwright: in a Claude Code cloud container it is already installed and found automatically. Elsewhere run `npm i -D playwright && npx playwright install chromium` here, or point `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` at an existing install.

## How to rebuild v7.html

```bash
node build/bundle.js                                   # app/ -> out/vcfo-client-portal-prototype-v7.html
cp out/vcfo-client-portal-prototype-v7.html ../vcfo-client-portal-prototype-v7.html   # when you ship it
```

`node build/bundle.js <appDir> <outFile>` builds from or to other paths.

The rebuilt file is about 3.9 MB. The v7 file pushed on 2026-10-13 is 11.3 MB because it also carried 42 old v5 screen images that no screen uses any more. `node checks/compare-bundles.js ../vcfo-client-portal-prototype-v7.html out/vcfo-client-portal-prototype-v7.html` proves the difference is only those 42 files: every page, script, image and font that remains is identical.

To look at one board while editing, without bundling: `npm run serve` and open `http://127.0.0.1:8768/s/team/team_redesign.dc.html` (the intro and the bundle's routing only exist in the built file).

## Where each screen lives

Tablets use the desktop file. Phones narrower than 700 px use the phone file when there is one. A `#…` after a file is the view inside that file.

| Route | Desktop and tablet | Phone (under 700 px) |
|---|---|---|
| home | app/s/home/v7_before.dc.html | app/s/home/mobile.html |
| home-after | app/s/home/v7_after.dc.html | app/s/home/mobile.html #after |
| home-chat | app/s/home/v7_before.dc.html #chat | app/s/home/mobile.html #chat |
| incorporation | app/s/inc/incorporation.html (generated) | same |
| compliances | app/s/comp/index.html #cal-redesign | app/s/comp/index.html #cal-mobile |
| filings | app/s/comp/index.html #fil-redesign | same |
| documents | app/s/docs/docs_a_refined.dc.html | app/s/docs/docs_a_mobile.dc.html |
| knowledge-bank | app/s/docs/lib_shelf_a.dc.html | same |
| kb-reader | app/s/docs/lib_reader.dc.html | same |
| team | app/s/team/team_redesign.dc.html | same |
| announcements | app/s/team/ann_redesign.dc.html | same |
| notifications | app/s/team/notif_redesign.dc.html | same |
| audit | app/s/team/audit_redesign.dc.html | same |
| settings | app/s/team/settings_redesign.dc.html | same |
| doc-viewer | app/s/home/v7x_doc_viewer.dc.html | same |
| ids-password | app/s/home/v7p_ids_password.dc.html | same |
| inc-phase | app/s/inc/phase.html (generated) #p=2 | same |
| inc-step7 | app/s/inc/step.html (generated) #n=7 | same |
| inc-step10 | app/s/inc/step.html (generated) #n=10 | same |
| board-resolution | app/s/inc/board.html (generated) | same |
| inc-phase-a | app/s/inc/phase.html (generated) #p=1 | same |
| inc-phase-3 | app/s/inc/phase.html (generated) #p=3 | same |
| inc-phase-4 | app/s/inc/phase.html (generated) #p=4 | same |
| inc-step-1 … inc-step-48 | app/s/inc/step.html (generated) #n=1…48 | same |
| credentials | app/s/home/v7p_credentials.dc.html | same |

Boards import shared parts with `<dc-import name="…">` from their own folder:

- Home (`v7_before` = before COI, `v7_after` = after COI) is built from the `app/s/home/v7c_*` cards: `_b` cards for before, `_a` cards for after.
- The Team, Announcements, Notifications, Audit, Settings, Documents and Library boards share `topbar.dc.html` and `side.dc.html` in their folder.
- `v7c_bot.dc.html` (in `home/`, `docs/` and `team/`) is the small static avatar head.

## Incorporation screens are generated

`app/s/inc/incorporation.html`, `phase.html`, `step.html` and `board.html`, and the Incorporation keys in `app/routes.js`, are written by:

```bash
node generators/incorporation/build.js        # reads ../incorporation-steps.json and generators/incorporation/*
```

Edit `generators/incorporation/template.html` (markup and CSS), `app.js` (behaviour), or `model.js` (which steps are done, yours, or with SBC, Before and After), then run the generator. Do not hand-edit the four generated files: the next run overwrites them. The real phases and steps come from `../incorporation-steps.json` (extracted from `src/data/checklist.ts`).

The Home step cards (`app/s/home/v7c_steps_a/_b`, `v7c_current`, `mobile.html`) are hand-made. If you change `model.js`, update them to match.

## How to run the checks

After a change, rebuild and re-test only the screens you touched:

```bash
node build/bundle.js
node checks/check.js team,credentials            # route keys from the table above
```

`check.js` runs, for those routes:

1. the responsive matrix: 14 sizes (360x780, 390x844, 430x932, 768x1024, 1024x768, 1024x1366, 1366x1024, 1280x720, 1280x800, 1366x768, 1440x900, 1536x864, 1920x1080, 2560x1440), Before and After. A pass is no horizontal page scroll, nothing overflowing the viewport outside its own scroll box, and no text under 11 px.
2. the click audit: every control clicked, desktop and phone, Before and After. A pass is 0 dead controls, 0 console or page errors, 0 network requests.

It prints a table and ends with PASS or FAIL (exit code 1). Raw results go to `out/checks/`. Options: `--bundle <file>`, `--no-resp`, `--no-click`.

Then look at the screens, because numbers are not enough:

```bash
node checks/shots.js team,credentials 390x844,1024x768,1440x900,2560x1440      # -> out/screens/
STATE=after node checks/shots.js team                                            # the After state
```

If one control is flagged dead, re-run that route once. Under heavy machine load, or when the audit clicks a control behind a sheet it opened itself, a working control can be flagged; open the screen and click it by hand to be sure.

### The full run before a release

```bash
node checks/resp.js 0 1 out/checks/resp-all.json                       # every visible route plus sample step pages, Before only
STATES=before,after node checks/resp.js 0 1 out/checks/resp-all.json   # both states (840 checks, about 15 minutes)
for d in desktop mobile; do for s in before after; do TAG=full node checks/audit.js $d $s; done; done   # every route, about an hour each
NOCLICK=1 TAG=sweep node checks/audit.js desktop before                 # load every route without clicking: errors and requests only
```

`resp.js <shard> <shards> <out> [routes] [shotsDir]` can be sharded across processes (`0 4`, `1 4`, …). Environment: `BUNDLE` (file to test), `STATES`, `TAG`, `NOCLICK=1`, `CHECKS_OUT`, `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`. Build: `FONTS_DIR`, `WEBP_CACHE`.

Test switches the checks set in localStorage: `vcfo.skipIntro` = `1` skips the intro, `vcfo.after` = `true` / `false` picks the state, `vcfo.device` = `"mobile"` / `"desktop"` forces the phone or desktop files, `vcfo.barHidden` = `true` hides the prototype bar.

## Rules that keep the single file working

- Navigate with `window.vcfoNav('s/x/y.html#hash')` or `data-go="routeKey"`, never `location.href`. Each screen runs in a frame built from text.
- No network: no fetch of URLs, no web fonts, no CDN, no remote images. Use relative paths for images (the bundler embeds them) and inline SVG for icons (Lucide paths from `node_modules/lucide-static/icons`).
- Keep each board self-contained: its CSS in its own `<style>`, its script inline.

## Responsive contract (every board follows it)

- Breakpoints: phone up to 767 px, tablet 768 to 1279 px, desktop 1280 px and up.
- `shell.js` sets `<html data-vp-bp="phone|tablet|desktop">` and `--vp-side-w` (248px, 72px, 0px), updates both on resize, fires a window `vcfo:bp` event, and exposes `window.vcfoOpenSide()` and `window.vcfoCloseSide()`.
- A board's sidebar placeholder is `width: var(--vp-side-w, 248px); flex: none` and carries `data-vp="side"`. Its root is fluid (`width: 100%`, `min-width: 0` on flex and grid children). On wide screens the content sits in a container with `max-width: 1600px; margin-inline: auto`.
- On phones the top bar has a menu button with `data-vp-menu` that calls `vcfoOpenSide()`; without one, `shell.js` adds a fallback bar.
- Tables and wide grids scroll inside their own box, never the page. Pop-ups and sheets fit the viewport. No text under 11 px. Phone touch targets at least 40 px.
- The Before / After pill dispatches a document `vcfo-after` event (`detail` true or false); screens that are not Home re-render in place.
