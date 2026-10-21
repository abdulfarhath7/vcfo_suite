# Documents & Knowledge Bank — prototype inventory (FINAL)

Catalogue of every view, state, control and motion in the FINAL clickable prototype for the client
**Documents** page (`/app/client/documents`) and **Knowledge Bank** (`/app/client/library`,
`/app/client/library/[id]`, `/app/client/learn/[slug]`), plus the shared document viewer.
Written for a pixel-for-pixel rebuild on the real Next.js 16 app with real data.

## 0. Sources, precedence and conventions

| Thing | Path (all relative to `/home/user/vcfo_suite/`) |
|---|---|
| Prototype boards (source of truth) | `docs/specs/client-pages/prototype/final-src/s/docs/*.dc.html` |
| Routed document viewer (responsive, Esc wired) | `docs/specs/client-pages/prototype/final-src/s/home/v7x_doc_viewer.dc.html` (route `doc-viewer`) |
| Board copy of the viewer (fixed 1440 px, used by Documents boards' links) | `docs/specs/client-pages/prototype/final-src/s/docs/v7x_doc_viewer.dc.html` |
| Prototype glue (routing, theme, tooltips, fallback toasts, drill pop-up, Ask VCFO launcher) | `docs/specs/client-pages/prototype/final-src/proto.js` |
| Shell (real sidebar/drawer injected over board placeholders) | `docs/specs/client-pages/prototype/final-src/shell.js` |
| Route map | `docs/specs/client-pages/prototype/final-src/routes.js` (`documents` → d: `s/docs/docs_a_refined.dc.html`, m: `s/docs/docs_a_mobile.dc.html`; `knowledge-bank` → `s/docs/lib_shelf_a.dc.html`; `kb-reader` → `s/docs/lib_reader.dc.html`; `doc-viewer` → `s/home/v7x_doc_viewer.dc.html`) |
| Owner decisions | `docs/specs/client-pages/DECISIONS.md` § "Documents & Knowledge Bank" (lines 69–84) |
| Design rules | `docs/specs/client-pages/DESIGN-RULES.md` (rules 1–18) |
| Problem list the redesign answers | `final-src/s/docs/improve.dc.html` (16 rows; quoted in §2.9) |
| Screenshots | `docs/specs/client-pages/prototype/v7-screens/documents__{1920x1080,1440x900,1024x768,390x844}.png` |

**Precedence notes (important for the developer):**

1. `support.js` (188 KB) is **only the runtime**: React production build + the `dc` template engine
   (`sc-for`, `sc-if`, `dc-import`, `DCLogic`). It contains **no board-specific behaviour** — nothing
   to port from it. All behaviour lives in each board's `<script data-dc-script>` + `proto.js` + `shell.js`.
2. The v7 screenshots predate the FINAL "One shape" override. In the screenshots the file-type marks are
   wide solid chips (white text on red/teal/blue, ~30 px wide, 11 px text). In FINAL every mark in the tree is a
   **20×20 px, 6 px-radius tile, 7 px mono text, light tint background + coloured text** (`docs_a_refined.dc.html:119-124`;
   the same block is present 5× in `vcfo-client-portal-FINAL.html`). **Build FINAL, not the screenshots.**
   Screenshots remain valid for the overall layout, the shell, row heights and spacing.
3. The shell (sidebar) in the boards is a placeholder (`side.dc.html`, `active=4` Documents, `active=5` Library);
   at runtime `shell.js` covers it with the real nav (`shell.js:91-101`): Home · Updates(3) · Incorporation(badge "inc" = 6/14) ·
   Compliances › Calendar/Filings · **Documents (badge "6")** · **Library** · Credentials · Team · Audit · Settings.
   DECISIONS says the sidebar label must be **"Knowledge Bank"** (route stays `/library`) — the prototype
   still says "Library" in the nav, the page trail (`topbar trail="Library"`), the empty state H1 and the drill's link.
   **Use "Knowledge Bank" for every user-visible label**; keep URLs `/app/client/library…`.
4. Before / After incorporation: the prototype's Before/After switch (`proto.js:182,213-219`, top-bar pill
   injected by the shell, bottom "PROTOTYPE" bar) **does not change any Documents or Library board** — they
   listen to nothing (no `vcfo-after` listener). Switching only shows the toast
   "Showing the company after incorporation" / "…before incorporation" (`proto.js:217`). The demo data
   is an after-COI state (COI dated 24 Oct 2026). In the real app the variant is data-driven: before COI the
   tree simply has fewer folders / more dashed "missing" rows; Phase 3 folders do not exist yet. See §1.12.
5. Breakpoints used by every board: **phone ≤ 767 · tablet 768–1279 · desktop ≥ 1280** (comment in
   `docs_a_refined.dc.html:86`), plus Documents-specific stack point **≤ 999** and Reader stack point **≤ 1100**.
   The prototype router serves the **mobile board** (`docs_a_mobile`) when `innerWidth < 700` or the "Mobile 390"
   device is picked (`proto.js:94`). Recommendation: use the mobile drill-down layout for `< 768`.

Token block used by all Documents boards (light) — `docs_a_refined.dc.html:15-24`; dark values are applied
globally by `proto.js:35-75` (`html[data-theme="dark"]`), reproduced verbatim in §3.0.

Line references are `file:line` with paths relative to `final-src/s/docs/` unless prefixed.

---
## Contents

1. INVENTORY (§1.1 toolbar · §1.2 tree rows · §1.3 menus · §1.4 ZIP toast · §1.5 preview pane · §1.6 progress drill · §1.7 states · §1.8 phone · §1.9 upload · §1.10 viewer · §1.11 phone preview · §1.12 before/after · §1.13 shelf · §1.14 recent drill · §1.15 library empty · §1.16 reader · §1.17 shell · §1.18 keyboard · §1.19 animations · §1.20 breakpoints)
2. DATA mapping to the real app (§2.0–2.9)
3. LAYOUT & CSS verbatim (§3.0 tokens … §3.15)
4. Gaps / conflicts
5. Build checklist

# 1. INVENTORY

Columns: **id | item | exact behaviour | file:line**. Ids: `D` Documents desktop/tablet, `DT` tree rows,
`DM` row menus, `DP` preview pane, `DZ` ZIP/copy toast, `DD` progress drill-down, `DS` page states,
`M` Documents phone, `U` upload flow, `V` shared document viewer, `MP` phone preview sheet, `L` Knowledge Bank shelf,
`LD` recently-read drill, `LE` library empty, `R` reader, `S` shell/shared, `K` keyboard, `A` animation, `B` breakpoint.

## 1.1 Documents — page frame & toolbar (desktop/tablet board `docs_a_refined.dc.html`)

| id | item | exact behaviour | file:line |
|---|---|---|---|
| D-01 | Page root `.vdoc` | Full viewport flex row: sidebar column + content column. `height:100vh/100dvh; min-height:560px`; bg `--bg`; Manrope 13px. **No page H1** on the redesign (title lives only in the top-bar trail "Documents"). | docs_a_refined.dc.html:90,127 |
| D-02 | Sidebar column `.vp-sidecol` | 248 px (desktop), 72 px (≤1279), 0 + hidden (≤767). Navy `#0f2a4a`. Holds the shell sidebar (active = Documents). | :87-89,128 |
| D-03 | Top bar | `dc-import topbar trail="Documents"`, 52 px. Logo · folder crumb icon · "Documents" · Search ⌘K · Announcements · Notifications (3) · Theme. See S-01..S-08. | :130; topbar.dc.html:37-53 |
| D-04 | Main `.vdoc-main` | max-width 1600, centred, padding `clamp(12px,1.6vw,20px) clamp(12px,1.8vw,24px) clamp(12px,1.8vw,24px)`, column gap 14. | :92,131 |
| D-05 | Explorer card `section[aria-label="Document explorer"]` | One white card: radius 10, 1 px border, `--shadow`, flex column, fills height. Contains toolbar + body (tree | pane) + toast layer (position:relative). | :132 |
| D-06 | Toolbar `.vdoc-tools` | min-height 52, padding 9/12, wraps (`gap:8px 6px`), bottom border. Order: Filter · Status toggle · Replaced toggle · Arrange-by pill · spacer · Download all (ZIP) · Upload · N requested. | :93,133-140 |
| D-07 | Filter input | `label.vdoc-q` 32 px tall, search glyph 14 px, `input[type=search]` placeholder **"Filter documents"**, aria-label same; right side mono 11 px counter **`{shown}/{total}`** files (e.g. "15/17"; total counts every file node incl. missing + replaced; shown applies the Replaced toggle and the query). Typing filters live (onInput). Flex `1 1 200px`, min 200, max 300 (≤999: full row). | :94,134,311-313,371 |
| D-08 | Filter behaviour | Case-insensitive `includes` on the **row name** (not file name). While a query is set: every folder is forced open (chevrons at 90°), folders with no matching visible file are removed, missing rows match too. | :311-312,323,327-328 |
| D-09 | "Status" toggle `.tg` | 32 px pill button, icon = three 6 px dots (green `--ok`, blue `--prog`, amber `--due`), label "Status". `aria-pressed`. **Default ON**. ON → `.tg.on` (primary-light bg, navy text, border primary/35%). Shows/hides the per-file status glyph (DT-14). Tooltip (data-tip) "Show status icons" — note: `.tg` has no `.tip` class, so the tip renders through proto's rule-17 tooltip only if icon-only; label is visible so effectively none. | :33-34,135,346,372-374 |
| D-10 | "Replaced" toggle (the "h toggle") | Same `.tg` style, eye-off icon 14 px + "Replaced". **Default OFF** (DECISIONS: replaced files shown but hidden by default). ON reveals replaced rows (DT-11). data-tip "Show files that were replaced". | :136,312,374 |
| D-11 | Arrange-by sliding pill `.seg` | `role=tablist aria-label="Arrange by"`, width 190, two tabs **"By step" / "By category"**; navy thumb slides `translateX(view*100%)` with spring (A-01). Active label white. **Default By step.** DECISIONS: "the choice is remembered" — prototype does **not** persist it (state only) → must persist (localStorage per user, or user pref). Switching closes any open menu. | :35-38,137,375-376 |
| D-12 | Spacer | `.vdoc-sp` flex 1 (hidden ≤999). | :95,138 |
| D-13 | "Download all (ZIP)" button `.btn.btn-o` | 32 px outline button, download glyph + "Download all (ZIP)". Starts ZIP toast for **"Northwind documents.zip"** with total = all files that are not Missing and not Replaced (demo 16). DECISIONS: ZIP uses real step names in folder paths. | :139,366,377 |
| D-14 | "Upload · 2 requested" button `.btn.btn-n` | Navy 32 px, upload glyph + **"Upload · {n} requested"** where n = open requests (demo 2: DIR-2 + lease deed). Opens the Upload dialog (U-08). DECISIONS: upload **only against open requests** — no free upload; hide/disable when n = 0. | :139; docs_upload.dc.html:88-109 |
| D-15 | Tablet button height | ≤1279: toolbar `.btn` height 36. | :103 |

## 1.2 Documents — tree rows (`role=tree`)

| id | item | exact behaviour | file:line |
|---|---|---|---|
| DT-01 | Tree container `.vdoc-tree` | `role=tree aria-label="Folders and files"`, width `clamp(300px,44%,440px)`, right border, own scroll, padding 6/0. ≤999: full width, `max-height:52vh`, bottom border. | :98,107,143 |
| DT-02 | Row `.tr` | `role=treeitem`, `aria-expanded` on folders, `aria-selected`. Height 36 (44 on ≤767), 13 px. Inner full-width `<button class="main">` (click target) + optional progress bar link + kebab. Hover bg `--raised`. | :39-46,145-146 |
| DT-03 | Indent guides `.gd` | One 16 px column per depth with a 1 px left border (`--border`), margin-left 7. Phase depth 0, step 1, file 2. | :47,147,297,337 |
| DT-04 | Chevron | 12 px chevron in a 16/20 px slot, folders only; rotates 0°→90° when open, `transition:transform .15s`. | :148,341 |
| DT-05 | Folder glyph | 16 px folder SVG inside a 20×20 r6 tile (tint `light-dark(oklch(94.5% 0.015 255), oklch(21.3% 0.01 255))`), glyph scaled to 12 px. Fill `--folder` (#0f2a4a) closed, `--folder-open` (#1b4f94) open. Inner line `M3 9.2h18` white/35%. Selected row: fill white, line navy. | :48,119-124,149,340 |
| DT-06 | Phase folder row | Label e.g. "Phase 1 — Name application". Right side: mono 11 px **count** = non-replaced files under it (incl. missing). No progress bar. Default open: p1, p2, p3. | :156,261-287,342 |
| DT-07 | Step folder row | Label "**{step no} · {step name}**" e.g. "6 · Director KYC" (DECISIONS: readable real step names). Right side **per-step progress bar** (DT-08). Default open: s3, s6, s8, s17, s22; **s21 closed**. | :241,331,343 |
| DT-08 | Per-step progress bar `a.pb` | 56×4 px track (`--hair`), 1 px gaps, three segments in order **ok (green `--ok`) · in review (blue `--prog`) · missing (amber `--due`)** widths = share of non-replaced files. Then mono frac **"{ok}/{total}"**. Hover: bg primary/8%, navy tooltip above-right (`::after`, max 240, 11.5 px/600) text **"{Step name without number} · {ok} received · {rv} in review · {ms} missing"** (e.g. "Director KYC · 4 received · 0 in review · 1 missing"); tooltip shows on hover **and** focus-visible, `.12s` no delay. **Click → progress drill-down dialog (DD-*)**. aria-label "{tip}. Open the list". Only rendered if total > 0. | :55-59,158,330,343-345 |
| DT-09 | Category folder row (By category view) | 5 categories, flat (no phases): **Identity & KYC (c1) · Office address (c2) · Company records (c3) · Certificates (c4) · Banking & capital (c5)**; each file is re-parented under its category (keeps `step` for "Open step N"). Category rows get the same progress bar + frac as steps. Default open c1–c4, **c5 closed**. | :288,291-294,332,343 |
| DT-10 | File row | Type tile (DT-12) · name (`.lb` 600, ellipsis) · optional chips · status glyph (DT-14). Click → selects file (navy row) and shows it in the preview pane; closes menus. (Rule 9 says "click a row → preview overlay" — FINAL desktop shows it in the right pane; the pane's page/eye opens the overlay viewer.) | :150-155,355 |
| DT-11 | Replaced row `.tr.hid` | Only when Replaced toggle ON. Text `--subtle`, label italic, **no status glyph**; shows eye-off icon (14 px) with tooltip **"Replaced by a newer file"**. Excluded from counts/progress and from ZIP totals. Status text in pane "Replaced" (raised bg, muted). Demo: "Board resolution (draft v1)" DOCX, "Address proof — Ravi (June bill)". | :43-44,154,264,270,312,329 |
| DT-12 | File-type tile `.ft` | 20×20, r6, `font:700 7px/20px IBM Plex Mono`, letter-spacing −.02em. Colours (tint + ink): **PDF** `--over-light`/`--over-text`; **JPG** `--teal-light`/`--teal-chip`; **DOCX** `--prog-light`/`--prog-text`. Tooltip + aria-label: "PDF file" · "Image (JPG)" · "Word document". DECISIONS: file-type colour only as a thin band/tile; **status is always a separate badge**. (PNG/HEIC not in demo — add PNG = JPG colours, "Image (PNG)".) | :51,119-120,150,298,301 |
| DT-13 | Missing (requested, not uploaded) row | DECISIONS "missing files as dashed rows": dashed 14×14 r3 1.5 px `--due` square inside a 20 px slot (instead of the type tile) · name · status glyph (person amber / ! red) · **due chip**: "Due 12 Nov" (`--due-chip` white) or **"Overdue"** (`--over-chip` white), 18 px tall. Click → selects; pane shows drop zone. Never counted in ZIP. | :151,155,272,276,348 |
| DT-14 | Status glyph `.sg` (rule 18, set A) | 20×20 r6 filled tile, white 10 px glyph. Shown when Status toggle ON and row not replaced (missing rows show it too). Mapping: Approved/Final → **done** green check (`--ok-chip`); In review → **SBC** blue arrow-up-right (`oklch(55% 0.2 262)`); Missing due → **you** amber person (`--due-chip`); Missing overdue → **late** red "!" (`--over-chip`). Tooltip/aria: "Done · approved {date}", "Done · from SBC {date}", "With SBC · in review since {date}", "Waiting on Northwind · due {date}", "Late · was due {date}". Selected row: 1.5 px white ring. (`now` navy clock glyph defined but unused.) | :82-83,121,155,302-310,346-347 |
| DT-15 | "Older than 2 months" stale chip | DECISIONS "stale-proof flag". Amber chip (`--due-light`/`--due-text`, 18 px, 11 px) after the name of a dated proof older than 2 months (demo: Address proof electricity bill). Tooltip **"Bill is older than 2 months. SBC may ask for a newer one."** | :154,269,346 |
| DT-16 | Board resolution row | DECISIONS: **a row with a "Final" badge, no separate card**. Demo: Phase 1 › "3 · Signed Board Resolution" › "Board resolution (final)" PDF, status Final, From "SBC · Arjun Mehta". Older draft is a Replaced DOCX. Replaces today's `ClientBoardResolutionCard`. | :262-264 |
| DT-17 | Kebab `.kb` (⋮) | 28×28 transparent, **opacity 0 until row hover / focus-within / menu open** (always visible ≤767 at 40×40). Hover bg primary/12% (on selected navy row: white/16%). aria "More actions for {label}", `aria-haspopup=menu`, `aria-expanded`. Toggles that row's menu (only one open at a time). | :60-64,117,159,349,352 |
| DT-18 | Selected row `.tr.sel` | Navy bg, white text, **3 px gold left bar** (`::before`), guides white/20%, counts white/70%, folder glyph white. Default selection **f9 Certificate of Incorporation**. | :41-42,48-49,54,241 |
| DT-19 | Folder click | Toggles open/closed (`aria-expanded`), closes menus. Folders don't select. | :355 |
| DT-20 | Empty filter result | When no rows: bot (40 px, idle) + speech bubble **"No document matches “{q}”."** + text button **"Clear filter"** (clears q) + link **"Ask VCFO why"** (opens chat). | :186,370 |
| DT-21 | Row "id" naming | Rows use human names ("PAN card — Ravi Kumar"); actual file name only in pane "File" row (DECISIONS "readable row names"). | :267,213 |

## 1.3 Documents — row menus (pop-over, `role=menu`)

| id | item | exact behaviour | file:line |
|---|---|---|---|
| DM-01 | Menu container `.menu` | Absolute under the row (`right:6px; top:34px`), 236 px (max `100vw-24px`), padding 4, r8, border, shadow `0 16px 36px -12px`. z 70. Items 34 px, 12.5 px/600, icon 15 px, hover/focus primary-light + navy. `hr` hairline. Right-aligned mono hint `.k`. | :65-69,161 |
| DM-02 | Folder menu (phase, step or category) | 1 **Download folder as ZIP** — hint "{n} files" (non-missing, non-replaced) → ZIP toast "{folder name without number}.zip" (DECISIONS: real step names). 2 **Expand all** (opens folder + all sub-folders). 3 **Collapse all**. — hr — 4 **Copy link to folder** → toast "Link copied". | :162-168,351,356-359 |
| DM-03 | File menu | 1 **Download** (closes menu; real: signed URL download). 2 **Preview** (= row click/select; real: open viewer V). 3 **Open step {N}** (N = step number of the owning step, also in category view) → navigate to `/app/client/incorporation/step/{N}` (prototype only closes). — hr — 4 **Copy link** → "Link copied" toast. | :169-175,350,360 |
| DM-04 | Missing-row menu | 1 **Upload** (selects row → pane drop zone; real: open upload for that request). 2 **Open step {N}**. — hr — 3 **Copy link**. | :176-181 |
| DM-05 | Close behaviour | Esc inside menu (onKeyDown on menu) closes; picking any item closes; clicking another kebab swaps; switching view closes. **No outside-click close in prototype — add it.** Focus does not move into the menu in the prototype — add roving focus (↑/↓) for a11y. | :161,318,352-353 |
| DM-06 | Prototype states board | `docs_a_states.dc.html` shows two 1440 boards side by side: folder menu open on "6 · Director KYC" + ZIP preparing (3 of 4); file menu open on COI + ZIP done. | docs_a_states.dc.html:15-16; docs_a_refined.dc.html:236,243-246 |

## 1.4 Documents — ZIP / copy toast

| id | item | exact behaviour | file:line |
|---|---|---|---|
| DZ-01 | Toast container | Absolute, bottom 20, centred, width `min(360px,100%-24px)`, navy, r8, padding 10/12, `role=status aria-live=polite`, enter animation A-04. | :74-76,219-230 |
| DZ-02 | Preparing state | 22 px round white/14% badge with zip glyph · **"Preparing {name}.zip…"** · mono "{n} of {total}" (75% opacity) · dismiss ✕ (24 px). Below: 4 px track white/18% with **gold** fill `width:n/total`, `transition:width .25s`. Prototype ticks 1 file / **260 ms**. | :77-78,223-228,248-257,380-382 |
| DZ-03 | Done state | Green 22 px check badge (`--ok-chip`) · **"Downloaded {name}.zip"** · "{total} files". No bar. Stays until dismissed (prototype). Real: auto-hide ~3–4 s like the global toast (3200 ms, `proto.js:164`). | :222,380-381 |
| DZ-04 | Copy state | "Link copied", no count, no bar, check badge. | :319,380 |
| DZ-05 | Dismiss ✕ | aria "Dismiss"; clears timer and toast. | :226,383 |

## 1.5 Documents — preview pane (right)

| id | item | exact behaviour | file:line |
|---|---|---|---|
| DP-01 | Pane header | 52 px, padding 0 12 0 16, bottom border: type tile (min-width 34, 20 tall, 11 px text, tooltip) · name 700 14 px ellipsis · **status badge** · (files only) **Preview** eye icon button `.ib` (tooltip "Preview") → viewer; **Download** icon button (tooltip "Download"). Missing → type tile shows "—" on `--due-chip`, tooltip "Not uploaded yet". | :190-195,378 |
| DP-02 | Status badge colours | Approved: `--ok-light`/`--ok-text`. **Final: navy bg white** (BR, COI, MoA, SH-1). In review: `--prog-light`/`--prog-text`. Replaced: `--raised`/`--muted`. Missing: `--due-chip` white. 20 px, r4, 11 px/700. | :27,300 |
| DP-03 | Preview area `.vdoc-pv` | `--raised` bg, centred, padding 20. **File**: paper card `.vdoc-page` (`data-paper`, always light paper even in dark mode), `width:min(340px,100%)`, `aspect-ratio:340/440`, padding 34/36, shadow. Content placeholder: "SAMPLE · PLACEHOLDER PAGE" 11 px caps · title 18 px Space Grotesk · company 11.5 px · 4 grey lines. **Whole page is a link → opens the document viewer (V)**. Real: first-page thumbnail (PDF/image) or docx render. | :100-101,196-204 |
| DP-04 | Missing drop zone `.vdoc-drop` | `min(360px,100%)×220`, dashed 1.5 px `--due`, r10, `--due-light` bg, 40 px `--due-chip` round upload badge, "Drop the file or **browse**". Link → upload (U). Real: drag & drop target + file picker for that request. | :102,205-207 |
| DP-05 | Key-value rows `.kv` | 36 px rows, hairline top border, label muted 500 / value 600 right-aligned. **Step** "17 · Certificate of Incorporation" · **From** "SBC · Arjun Mehta" / "Northwind" / for missing "Asked by Arjun Mehta" · **Date** (mono 12) or **Due** for missing · **File** mono 12/500 (actual filename, "—" if missing) · **Verify** (only for some docs) portal link + ↗ 12 px, opens new tab, tooltip "Open {portal}", sr "(opens in a new tab)". Demo portals: COI & MoA → "MCA portal" `https://www.mca.gov.in`; PAN → "Income-tax e-filing" `https://www.incometax.gov.in`. (Rule 15.) | :70-73,209-215,363-368,378 |
| DP-06 | ≤999 stacking | Pane goes under the tree; preview height `clamp(260px,42vh,420px)`; page uses `height:100%; width:auto`. | :104-112 |

## 1.6 Documents — progress drill-down dialog (`docs_a_drill.dc.html`)

| id | item | exact behaviour | file:line |
|---|---|---|---|
| DD-01 | Trigger | Click a step/category progress bar `a.pb` (DT-08). Rule 14: hover a part → tooltip; click → pop-up listing the items, with sliding pill, clicked part pre-selected. | docs_a_refined.dc.html:158 |
| DD-02 | Scrim | Full-screen `oklch(20% 0.05 258 / .55)`, dialog centred. | docs_a_drill.dc.html:46 |
| DD-03 | Dialog | 640 px, r12, shadow `0 24px 60px -20px`, `role=dialog aria-modal`, aria-label "{step} documents". Pop animation A-05. | :47 |
| DD-04 | Context strip `.dd-top` | primary-light bar 9/18 px, 12 px muted: "These documents are for **Director KYC** in **Incorporation**" + right link **"Open Incorporation →"** (800, 12.5) → incorporation page (real: the step page). | :47 |
| DD-05 | Header | 56 px: navy folder 18 px · H2 "6 · Director KYC" 700 15 · mini bar 80×5 (ok/missing split) · mono "4/5" · close `.ib` ✕ (tooltip "Close"). | :48-54 |
| DD-06 | Status pill | `.seg` full width, 4 tabs **All · Received · In review · Missing** each with mono count (`.c` 10.5 px; white/72% when active). Thumb slides (A-01). Prototype opens on **Received** (t=1). Real: open on the segment that was hovered/clicked; default All. | :56,78,88-92 |
| DD-07 | List rows `.row` | 44 px, hairline top, hover raised: type tile (or dashed square) · name link (600; file → viewer, missing → upload) · mono date (11.5, `--subtle`; missing shows "Due 12 Nov") · status badge · action `.ib`: eye **Preview** (files) or amber-bordered **Upload** (missing). | :59-69,93 |
| DD-08 | Empty tab | Bot 40 px + bubble "Nothing in this group yet." + "Ask VCFO why". | :70,94 |
| DD-09 | Close | ✕ link; Esc and scrim click must also close (proto `vcfoDrill` pattern: Esc + scrim, focus returns to trigger, focus moves to ✕ on open — `proto.js:711-739`). | :53; proto.js:726-734 |
| DD-10 | Phone | Drill becomes a bottom sheet (DECISIONS "Mobile drill-downs = Bottom sheet"; `proto.js:743` `@media (max-width:700px)` sheet, radius 14 top, max 86vh). | proto.js:708 |

## 1.7 Documents — page states

| id | item | exact behaviour | file:line |
|---|---|---|---|
| DS-01 | Loading skeleton | `main[aria-busy=true]`. Toolbar skeletons: 300×32 (filter), 84×32, 96×32, 220×32 r8 (pill), spacer, 170×32. Tree (420 px): rows 36 px with 16 px icon + bar; step rows indented 36 px with 56×4 bar at right; file rows indented 60 px with 22×16 r3 tile. Pane: header skeleton (26×20, 240×12, two 32 px squares), page 340×440 r2, two kv rows (60/180, 50/120). Shimmer A-06. Rule: show after 150 ms, hold ≥ 300 ms (DECISIONS Incorporation "Loading L1"). **Note**: loading/empty boards still show an H1 "Documents" (22 px) above the card — the refined page has none; drop the H1 for consistency. | docs_a_loading.dc.html:13-20,22-54 |
| DS-02 | Empty (no documents at all) | Toolbar at 50% opacity with "Filter documents 0/0". Tree shows the three phase folders greyed (`--subtle`, folder fill-opacity .3, count 0). Right side (raised): bot **56 px** + bubble **"No documents yet. Northwind’s files will appear here as each step is done."** + "Ask VCFO why"; buttons **Upload a document** (navy; only if open requests exist) · **Open incorporation** (outline). Replaces today's `return null` (improve #6). | docs_a_empty.dc.html:13-25,27-50 |
| DS-03 | No match | DT-20. | docs_a_refined.dc.html:186 |
| DS-04 | Error | Not drawn. Use rule 16 exception: errors keep red style. Suggest red card in the tree area with "Could not load documents" + Retry. | — |

## 1.8 Documents — phone (`docs_a_mobile.dc.html`, menu-sheet variant `docs_a_mobile_menu.dc.html`)

| id | item | exact behaviour | file:line |
|---|---|---|---|
| M-01 | Root | `width:100%; height:100dvh; min-height:520px`, column, bg `--bg`. | docs_a_mobile.dc.html:46 |
| M-02 | Header | 56 px white, border-bottom: menu `.tbb` 44×44 (`data-vp-menu` → opens shell drawer) · SBC logo 24 px · spacer · bell 44×44 (primary colour, aria "Notifications, 3 new"). | :47-52 |
| M-03 | Back row (drilled levels only) | min-height 44: back chevron `.tbb` (margin-left −10, navy, aria "Back to {parent label}") · crumb mono 11 px `--subtle` ("Documents / Phase 2") · **H1 19 px/700 navy** = current folder name (ellipsis). Hidden at root (screenshot root shows no title). | :54-57,146-147 |
| M-04 | Filter + level kebab | 44 px filter (search 15 px, input 14 px, counter "14/16") + 44×44 bordered kebab for the **current level** → bottom sheet with the folder actions. (Menu variant: kebab in the title row, filter on its own row; crumb 10.5 px.) | :58-61; docs_a_mobile_menu.dc.html:53-58 |
| M-05 | List card | Card r10 border shadow, `role=list`; enter animation A-08 on each level change. | :63-64 |
| M-06 | Folder row | min-height 56: folder 20 px (navy fill) · label 14/600 · **step folders**: under the label a 64×4 progress track (ok/rv/ms) + mono frac "4/5"; **phase folders**: right mono count · chevron 14 px. Tap → drill into folder (push to path). Kebab 44×44 → sheet. | :66-79,129 |
| M-07 | File row | Type tile · label 14/600 · under it **status badge + mono date** (missing: dashed 16 px square, badge "Missing", date "Due 12 Nov"/"Overdue"). Tap: **no-op in prototype** → must open the phone preview sheet (MP). Kebab → sheet. | :69-74,127 |
| M-08 | Bottom sheet (actions) | Scrim button (aria "Close menu", `oklch(20% 0.05 258 / .45)`) + sheet (`role=menu`), r12 top, handle 40×4, title row 14/700 navy with hairline, items 52 px 14/600 with 18 px navy icons, mono right hint. Padding bottom **76 px** (clears the Ask VCFO pill; menu variant 20 px). Animation A-07. | :83-90 |
| M-09 | Sheet items — folder | **Download folder as ZIP** ("{n} files") → toast; **Copy link to folder**. | :140-141 |
| M-10 | Sheet items — file | **Download · Preview · Open step {N} · Copy link**. | :138 |
| M-11 | Sheet items — missing | **Take photo** (camera glyph — DECISIONS "camera capture" → `<input type=file accept="image/*" capture="environment">`) · **Choose file** · **Open step {N}** · **Copy link**. | :137 |
| M-12 | Toast | Absolute left/right 16, bottom 20, navy r8: text + mono count + gold bar while busy. Text "Preparing {name}.zip…" → "Downloaded {name}.zip", count "n of total" → "{total} files". 260 ms ticks. | :91-96,104-108,150 |
| M-13 | Missing on phone | No Status / Replaced toggles, no By step/category pill, no Download all, no Upload button on phone. Recommend: put "Download all (ZIP)" + "Upload · N requested" in the root-level kebab sheet; keep replaced hidden. | — |
| M-14 | Tap targets | All interactive ≥ 44 px (rows 56, kebabs 44). | :22-29 |

## 1.9 Upload flow (`docs_upload.dc.html` — specimen board, 1440×900)

| id | item | exact behaviour | file:line |
|---|---|---|---|
| U-01 | Request card (waiting) | `.card.t` (gold 38×3 tab at top-left): title 13/700 "Signed DIR-2 — Meera Shah" + due chip right (min-width 116, centred) · drop strip `.drop` (dashed amber/55%, amber-light/50% bg, r8): 32 px white round upload badge with amber ring · "Drop the file or **browse**". | docs_upload.dc.html:24-25,32,47-53 |
| U-02 | Dragging over | Drop strip turns **solid navy border**, primary-light bg, 4 px primary/12% ring, centred, padding 18/12; badge navy filled; text **"Release to upload"** 700 navy. | :54-60 |
| U-03 | Uploading | Inner box: tiny mono "PDF" tag (9 px, over tint) · filename 12.5/600 ellipsis · mono "64%" · cancel ✕ (aria "Cancel upload") · 6 px bar navy fill (prototype animates 8→64% loop A-11; real: real progress). | :34-36,61-70 |
| U-04 | Done | The new row moves into the list: row with 28×34 file glyph (tint body + coloured **bottom band** "PDF" — the "thin band" look) · name · chip **In review**; row bg glows ok-light → panel (A-12, prototype loops; real: once). Toast **"Sent to Arjun for review"** with green check + gold **Undo** (800 12.5). Toast enter A-13. | :38-40,71-85 |
| U-05 | Error — file refused | Red alert box (1.5 px over/50% border, over-light bg): 28 px red "!" badge · "{file} · this file type can't be opened" (over-text 600) · outline **Try again** (28 px). Title chip "Overdue · 6 Nov". | :110-119 |
| U-06 | Re-upload asked by SBC | Card title + red chip **"Re-upload"** · note row (raised bg r6): navy mono initials tag "AM" + quoted reason "“Bill is older than 2 months. Please send the latest one.”" · drop strip "Drop the new file or **browse**". | :120-125 |
| U-07 | Accepted types caption | mono 11 px "PDF · JPG · PNG · DOCX · up to 10 MB". Real limit is `MAX_UPLOAD_MB` (default 50, env) and `MILESTONE_DOCUMENT_EXTENSIONS` → print from config. | :104; src/lib/upload-limits.ts:7,19,91 |
| U-08 | Upload dialog (from toolbar button) | `role=dialog aria-label="Upload a document"`, r12: header "Upload a document" 700 15 navy + close 30 px · body: label **"For"** + 2-col grid of request cards (button; selected = 2 px navy border + primary-light; each shows name + due chip "Overdue"/"Due 12 Nov") · large drop zone (dashed primary/45%, primary-light/50%, r10, padding 28): 44 px navy upload badge, "Drop files here or **browse**", type caption · footer (raised): **Cancel** (outline) · **Upload** (navy). Only open requests are listed. | :88-109 |
| U-09 | After upload | Request turns into a file row (In review) in its step; "N requested" count decrements; email to lead (existing `client_uploaded` event). | — |

## 1.10 Shared document viewer (overlay) — `s/home/v7x_doc_viewer.dc.html` (routed) / `s/docs/v7x_doc_viewer.dc.html`

| id | item | exact behaviour | file:line |
|---|---|---|---|
| V-01 | Opened from | Pane eye button, pane paper click, drill eye, file menu "Preview", reader "Documents for this" row, Home docs widget. DECISIONS "shared preview" = one component everywhere. | docs_a_refined.dc.html:194,198 |
| V-02 | Scrim | `oklch(20% 0.05 258 / .6)`; in the routed version it starts at `left: var(--vp-side-w,248px)` (sidebar stays visible) and `top:52px` on phone under a mini bar (`.vh-pbar` with menu button, logo, "Documents"). | s/home/v7x_doc_viewer.dc.html:226 |
| V-03 | Dialog | `width:min(1152px,100%-24px)`, `height:min(720px,100%-24px)`, r12, bg `light-dark(oklch(94% 0.008 255), oklch(22% 0.008 255))`, shadow `0 30px 70px -20px`. `role=dialog aria-modal aria-label="Document preview"`. | :226 |
| V-04 | Header bar | white, padding 10/14: 30×30 r6 type tile (mono 11/700 PDF tint) · file name 14/700 ellipsis · **(i) info** 18 px → pop-over (≤280 px, arrow) "From SBC · 24 Oct 2026 · Size [size]" + row "🤖 Ask VCFO about this" · position "1 of 4" (cap 600) · **Download** outline 32 px (label hidden ≤767, aria "Download") · **Close** 32 px ✕ (aria "Close preview (Esc)", title "Close (Esc)"). | :226 |
| V-05 | Page area | scroll, padding `28px clamp(12px,6vw,72px) 72px`; paper `data-paper` width `{pageW}` = 460 px × zoom, `aspect-ratio:1/1.414`, padding `clamp(20px,5vw,48px) clamp(18px,5vw,52px)`, `transition:width .2s`; demo content + rotated "SAMPLE" watermark (prototype only). | :226 |
| V-06 | Prev / Next document | 40 px round buttons at left/right 16, vertically centred, shadow; aria "Previous document"/"Next document"; cycles through the **current list** (wraps). Real: the visible tree order (or drill list). | :226,247 |
| V-07 | Zoom bar | navy floating pill bottom centre: "Page 1 / 1" · divider · − (aria "Zoom out") · "{zoom}%" · + (aria "Zoom in"). Range **50–150 %, step 25**, default 100. Phone: bar lifted to bottom 72 px (`.vh-zoom`). | :226,247 |
| V-08 | Unsupported type state | Same chrome (no position, no prev/next): centred 64 px r12 prog-tint tile with doc glyph · "Preview not available for this file type" 15/700 · primary **Download** button. Example "Draft Board Resolution.docx". Real app **can** render DOCX (`IncorporationDocxPreview`, `docx-preview` dep) → use this state only for HEIC/ZIP/other. | :227-230 |
| V-09 | Close | ✕ button or **Esc** (`keydown` on document, `preventDefault`) → back to the opener (shell back, else history.back). | :232-244 |
| V-10 | Dark mode | `[data-paper]` stays white paper with light ink in dark theme (`proto.js:67-69`). | proto.js:66-69 |

## 1.11 Phone preview sheet (`docs_mobile_preview.dc.html`)

| id | item | exact behaviour | file:line |
|---|---|---|---|
| MP-01 | Sheet | Dark backdrop `oklch(20% 0.05 258)`; sheet from `top:28px` to bottom, r12 top, handle 40×4, enter A-09. `role=dialog aria-modal aria-label="Preview: {name}"`. | docs_mobile_preview.dc.html:26-28 |
| MP-02 | Header | H2 15/700 navy ellipsis; under it chips **Final** (navy) · **SBC** (gold-soft/gold-text source chip) · mono date; close 44×44 ✕ (aria "Close preview"). | :29-32 |
| MP-03 | Page | grey well `light-dark(oklch(93.5% 0.01 255), oklch(22.8% 0.01 255))`, paper 330×466 serif (Source Serif 4) demo COI. | :33-39 |
| MP-04 | Pager | dots (active 18×4 navy, inactive 6×4) + mono "Page 1 of 2 · swipe" → horizontal swipe between pages. | :40 |
| MP-05 | Footer | 2-col: **Ask VCFO** outline (18 px bot) · **Download** navy, 44 px. | :41-44 |

## 1.12 Before / after incorporation (Documents)

| id | item | exact behaviour | file:line |
|---|---|---|---|
| BA-01 | Toggle | Prototype bar "Before COI / After COI" + top-bar pill; Documents board unchanged; toast only. | proto.js:182,213-219 |
| BA-02 | Real-app variant | Driven by data: before COI → Phase 3/4 folders absent (no files), COI/MoA rows absent, more dashed missing rows in Phases 1–2; empty state DS-02 for a brand-new client. After COI → COI, MoA/AoA, SH-1 are **Final** rows with MCA "Verify" links. | docs_a_refined.dc.html:277-286 |

## 1.13 Knowledge Bank — bookshelf (`lib_shelf_a.dc.html`)

| id | item | exact behaviour | file:line |
|---|---|---|---|
| L-01 | Page frame `.vlib` | sidebar column (active = Library/Knowledge Bank) + column with topbar `trail="Library"` (→ "Knowledge Bank") + main (max 1600, padding `clamp(12px,1.6vw,20px) clamp(12px,1.8vw,24px) 96px`, gap 16). No H1. | lib_shelf_a.dc.html:66-68,95-99 |
| L-02 | Toolbar `.vlib-tools` | wraps, gap 10: category pill · "{n} books" chip · **Monthly status brief** (outline 34 px) · **PDF brief** (outline + download glyph) · search. | :69,100-103 |
| L-03 | Category pill | `role=tablist aria-label="Category"`; 6 tabs **All 15 · Incorporation 4 · Foreign inv. 3 · Tax 3 · Compliance 3 · Northwind’s project 2** (label + mono count); buttons 30 px; wrapper `flex:1 1 680px; max-width:740px` with hidden-scrollbar horizontal scroll, pill min-width 680. Thumb slides (A-01). Selecting filters shelves (only that category's shelf shown). | :24-29,70-72,101,158-162 |
| L-04 | "{n} books" chip | `--primary-chip` bg white 11/700 — total saved items (not filtered). (`--primary-chip` is defined in proto dark tokens and side.dc.html: `oklch(52% 0.21 263)`.) | :101,160 |
| L-05 | Monthly status brief | → `/api/ask/brief?engagementId=` PDF (existing `StatusBriefButton`). | :101 |
| L-06 | PDF brief | Exports the shown books → `/api/ask/library/export?ids=`. | :101 |
| L-07 | Search | 34 px (44 on phone), placeholder/aria **"Search books"**, live filter on book title (case-insensitive). | :102,156-157 |
| L-08 | Recently read strip `.vlib-recent` | H2 "RECENTLY READ" (800 11 px, .1em caps, navy, 110 px wide; full row ≤1279) + up to **3 mini cards** `.mini` (min 230, `flex:1 1 200px; max 360`): 30×42 cover in book colour (inset 4 px spine shade; Northwind's-project covers get a **gold** spine) · title link (12.5 px → reader) · progress bar 5 px (`.pbar`; hover adds 2 px primary/25% ring) with tooltip **"70% read · 2 of 3 sections"** / **"Finished · read on 8 Nov"** / "35% read · 1 of 3 sections"; bar click → Recently-read drill (LD). | :41-45,74-78,105-110 |
| L-09 | Shelves card | One white card r10, padding 6/0/18, gap 6. One `section` per category with ≥1 visible book, in fixed order: **Incorporation, Foreign investment, Tax, Compliance, Northwind’s project**. | :112-129,142-148,157 |
| L-10 | Shelf header | 10×10 r3 colour dot · H2 13/700 navy (category title) · mono count. Padding 14/28/0. | :115 |
| L-11 | Shelf `.shelf` | flex-wrap, gap 18 (row-gap 40), padding 22/28/0, `perspective:900px`, min-height 186; repeating plank background every 212 px (so wrapped rows each get a plank). Plank `.plank` 14 px gradient + shadow below the last row (margin 0 16). | :30-31,79,116,127 |
| L-12 | Book `a.book` | 128×172, padding 16/12/12/22, r `2 6 6 2`, bg `--bc` (category colour), white; spine shading (`::before` 11 px gradient), page edges (`::after` 5 px striped, right −5). Gold top band `.bk-band` 5 px. 28 px round white/18% icon disc with category glyph (15 px). Title `.bk-t` 700 13/1.32, **2-line clamp** (6 lines on hover). Bottom `.bk-c` short category 11/700 caps .04em 80% opacity. aria "Open {title}" → reader. | :32-39,56-60,118-124 |
| L-13 | Book hover/focus | Lift + tilt: `translate3d(0,-14px,0) rotate(-2.5deg)`, deeper shadow, title unclamps to 6 lines; active (press) `translate(0,-10px) rotate(-1.5deg) scale(.985)`. Timing A-14. | :56-60 |
| L-14 | "Updated" ribbon `.rib` | DECISIONS **"Updated" chip = blue**: 14×22 bookmark ribbon at top-right (right 8), `--prog-chip` (blue), clip-path notch; `title="Updated"` (needs a real tooltip + aria per rule 17: "Updated since you saved it"). Shown when the topic version is newer than the saved copy. Demo: "FC-GPR after share allotment". | :40,120,152 |
| L-15 | Category colours & glyphs | Incorporation `var(--navy-3)` building glyph, short "Incorp." · Foreign investment `oklch(45% 0.16 14)` globe, "FDI" · Tax `oklch(50% 0.12 62)` receipt, "Tax" · Compliance `oklch(42% 0.08 200)` shield-check, "Compliance" · Northwind’s project `var(--navy)` flag, "Northwind’s project". (Real categories also include **labour** — needs a colour, e.g. `oklch(50% 0.12 200)` `--cat-labour`.) | :142-148; src/lib/ask/categories.ts |
| L-16 | No match | Bot 40 + "No book matches “{q}”." + **Clear search** (clears q **and** resets category to All) + "Ask VCFO why". | :130,162 |
| L-17 | Ask VCFO launcher | Bottom-right floating launcher (boards draw a 68 px round bot button + "Ask VCFO" label; the real one is the shared launcher, `proto.js:~312-…`). | :134 |

## 1.14 Knowledge Bank — recently-read drill (`lib_recent_drill.dc.html`)

| id | item | exact behaviour | file:line |
|---|---|---|---|
| LD-01 | Dialog | Over the shelf, scrim .55, 600 px r12, pop A-05, aria "Recently read". Context strip "These guides live in the Library" + "Open Library →". Header H2 "Recently read" + close. | lib_recent_drill.dc.html:36-43 |
| LD-02 | Pill | **All 3 · In progress 2 · Finished 1**; opens on In progress. | :44,61,68 |
| LD-03 | Rows `a.row` | 56 px: 30×42 cover · title 700 · 140×5 bar · mono 56 px right "70%" / "Done". Row → reader. | :25-29,46-53,70 |

## 1.15 Knowledge Bank — empty (`lib_empty.dc.html`)

| id | item | exact behaviour | file:line |
|---|---|---|---|
| LE-01 | Layout | H1 "Library" (→ "Knowledge Bank") 22 px; card min-height 580 centred. | lib_empty.dc.html:31-33 |
| LE-02 | Book illustration | 200×110 with 3 px violet-soft floor; 4 books rise in (A-15) staggered 0/.08/.16/.24 s; last one leaning 12°. | :21-24,34-40 |
| LE-03 | Bot message | Bot 48 + bubble **"Northwind’s library is empty. Save an answer from Ask VCFO and it lands here as a book."** + "Ask VCFO why". | :41 |
| LE-04 | CTA | Navy **Ask VCFO** (opens chat). | :42 |
| LE-05 | Suggested topics | violet-tint chips (32 px, r6) "What is SPICe+?" · "What happens after the COI?" · "When do I need GST?" → `/app/client/learn/{slug}`. | :20,43-45 |
| LE-06 | Loading | Not drawn; improve #13 asks for **skeleton books** + error card "Back to library". | improve.dc.html:43 |

## 1.16 Knowledge Bank — reader (`lib_reader.dc.html`, mode `saved` | `learn`)

| id | item | exact behaviour | file:line |
|---|---|---|---|
| R-01 | Frame | Topbar `trail="Library"` + `leaf="{title}"` (crumb Library / title). Grid `minmax(0,780px) minmax(260px,340px)` gap 20 centred; ≤1100 one column with side cards in an auto-fit grid (min 240). | lib_reader.dc.html:56-71,93-94 |
| R-02 | Hero `.vrd-hero` | r10 padding 22/24/20, gradient `115deg navy → navy-2 62% → oklch(38% 0.12 292)`, white. 3 px gold underline gradient at bottom. | :96,104 |
| R-03 | Hero chips | Category chip (white/14% + inset ring) "Foreign investment" · **"✓ Reviewed by SBC"** (`--ok-chip`, min 116) · **"Updated 6 Nov"** (`--prog-chip` blue, min 116, saved mode only). | :97 |
| R-04 | Title | H1 white `clamp(22px,1.2vw + 14px,30px)/1.2` 700. | :61,98 |
| R-05 | Depth pill | `role=group aria-label="Depth"`, **Simpler · Normal · More detail**, white thumb on translucent track, active label navy 700, inactive white/78%; `aria-pressed`. Default Normal. Changes the lead line and (More detail) shows the facts grid (R-09). | :100,168,179-181 |
| R-06 | Read time + official link | mono "3 min read" (70%) · pill link **"Official link · RBI FIRMS ↗"** (white/12% + ring, 30 px, new tab). | :102 |
| R-07 | Lead paragraph | 17 px/1.6 500, max 68ch (16 px on phone). | :108 |
| R-08 | Timeline visual | primary-light panel r10: label "TIMELINE" violet-text; 3 nodes 170 px: done (green ✓ 40 px) "Shares allotted · Day 0 · 2 Nov" — green link — **current** (navy "2" + 3 px gold ring + pulse A-16) "FIRC + KYC from bank · Now" — dashed link — next (dashed primary ring) "File FC-GPR on FIRMS · By day 30 · 2 Dec". Phone: vertical, links 3×22. (Rule 10 / Focus track.) | :41-45,109-118,76-80 |
| R-09 | Facts grid (More detail) | 3 raised tiles: WHO FILES "SBC, for Northwind" · LATE FEE "LSF, per RBI" · PORTAL "RBI FIRMS". 1 column on phone. | :119 |
| R-10 | Why it matters | gold-soft box, 28 px gold star disc, H2 "Why it matters to Northwind" (gold-text) + 13.5 px text. | :120-123 |
| R-11 | Sources | label "SOURCES" + chips (26 px raised + ring) with ↗. | :124-130 |
| R-12 | Action row | top border: saved → green **"✓ Saved to library"** (static `.btn-ok`) · learn → navy **"Save to library"** (bookmark) · **PDF brief** · **Ask a follow-up** (18 px bot) · spacer · saved → trash `.ib` (aria "Remove from library", hover red tint). improve #11: removal = toast with **Undo** (soft delete). | :131-138 |
| R-13 | Side: In Northwind’s project | `.card.t`: H2 · date tile 50×54 amber "DEC 2" · "FC-GPR filing" + chips "24 days left" (due tint) · "SBC files" · link "Open in Compliances". | :143-150 |
| R-14 | Side: Related | H2 "Related in Northwind’s library" + rows (28 px primary-light icon tile + title) with hairlines. | :151-155 |
| R-15 | Side: Documents for this | H2 + row: PDF tag · "FIRC from the bank" · chip Approved → opens the shared viewer. (improve #16, DECISIONS "topic → documents link"). | :156-159 |
| R-16 | Launcher | Ask VCFO launcher bottom-right with label arrow. | :163 |
| R-17 | Phone | hero/body padding 18/16, buttons 40, `.ib` 40, pill buttons 36, source chips wrap min 40. | :72-87 |

## 1.17 Shell, top bar, bot, prototype-wide behaviours

| id | item | exact behaviour | file:line |
|---|---|---|---|
| S-01 | Top bar `.vtb` | 52 px, white/90% + hairline. Menu (phone only) · logo 26 px (22 phone) · location trail (24 px primary-light folder tile hidden on phone; trail 13 px; with leaf: trail muted 500 / "/" / leaf 600) · right: Search button (`clamp(180px,18vw,256px)`, collapses to 36 px icon ≤1279, 40 ≤767) with kbd ⌘ K · Announcements · Notifications (badge 17 px "3", primary tint active) · Theme (hidden on phone). | topbar.dc.html:21-53 |
| S-02 | Search ⌘K | Visual only in the prototype (no key handler; click → toast "Search · type to find steps, filings and documents"). Real: command palette (`src/components/shell/CommandPalette.tsx` already fetches `/api/documents`). | proto.js:245 |
| S-03 | Theme | light / dark (True black) / system, stored `vcfo.theme`; any button whose aria contains "theme" toggles. | proto.js:6-75 |
| S-04 | Rule-17 tooltip | Icon-only controls get a navy tooltip after **120 ms** (`#vp-tip`), unless `data-tip` exists (then CSS `.tip::after` with 120 ms delay). | proto.js:297-310,661 |
| S-05 | Fallback toasts | 3200 ms toast for dead controls: "Download started · …", "Preparing the ZIP…", "Choose a file to upload", "Link copied", "Opens the official portal in a new tab". Real app must do the real action. | proto.js:159-166,237-245 |
| S-06 | Page transitions | enter `vpIn .26s` (y 6 → 0), leave `.14s` opacity .35. | proto.js:135-137 |
| S-07 | Bot avatar | `v7c_bot` states idle / thinking (antenna pulse 1 s + eye scan 1.3 s) / answered (green antenna) / cannot (grey); sizes used: 16, 18, 40, 48, 56. Smile never changes. | v7c_bot.dc.html:128-141 |
| S-08 | Speech bubble (rule 16) | max 320, padding 10/14, r `10 10 10 2`, panel + border + shadow `0 8px 20px -12px`; text 600 13/1.45; action links 12/700 primary. | docs_a_refined.dc.html:186 |
| S-09 | Scrollbars | Hidden everywhere (`scrollbar-width:none`) — prototype choice. | proto.js:141-142 |

## 1.18 Keyboard

| id | key | behaviour | file:line |
|---|---|---|---|
| K-01 | Esc in row menu | closes menu | docs_a_refined.dc.html:353 |
| K-02 | Esc in viewer | closes viewer → opener | s/home/v7x_doc_viewer.dc.html:232-235 |
| K-03 | Esc in drill pop-up | closes, focus back to trigger | proto.js:726-728 |
| K-04 | Esc / Tab in phone drawer | closes drawer / focus trap | shell.js:433-445 |
| K-05 | Tab / Shift-Tab | all controls are buttons/links with `:focus-visible` 2 px primary/50% ring (offset 2; tree `.main` offset −2). Kebab becomes visible on focus. Progress tooltip shows on focus-visible. | docs_a_refined.dc.html:46,64,84 |
| K-06 | ⌘K | displayed only (S-02) | topbar.dc.html:48 |
| K-07 | Tree arrows | **Not implemented** in prototype; `role=tree/treeitem` promises it → implement WAI tree keys (↑/↓ move, →/← expand/collapse, Enter select, Home/End). | docs_a_refined.dc.html:143-145 |
| K-08 | Viewer ←/→, +/− | Not wired; recommended to mirror prev/next + zoom buttons. | — |

## 1.19 Animations & timings

| id | what | spec | file:line |
|---|---|---|---|
| A-01 | Sliding pill thumb | `transform .42s linear(0,0.0637,0.2021,0.3619,0.5141,0.6451,0.7506,0.8315,0.8909,0.9328,0.9613,0.9799,0.9914,0.9981,1.0016,1.0032,1.0036,1.0034,1.0029,1.0023,1.0018,1.0013,1.0009,1.0006,1.0004)` (= `springSnappy` 420/32/0.8); label colour `.2s` | docs_a_refined.dc.html:36-37 |
| A-02 | Tree chevron | `transform .15s` 0→90° | :341 |
| A-03 | Tooltips | `.tip::after` opacity/transform/visibility `.12s` **delay .12s**, from `translate(-50%,3px)`; progress-bar tip `.12s` no delay | :58-59,80-81 |
| A-04 | Docs toast in | `tin .25s cubic-bezier(.22,1,.36,1)` from `translate(-50%,10px)` opacity 0; progress fill `width .25s`; ZIP tick 260 ms/file | :74-78,256 |
| A-05 | Dialog pop (drill, recent drill) | `pop .22s cubic-bezier(.22,1,.36,1)` from `translateY(8px) scale(.985)` opacity 0 | docs_a_drill.dc.html:31-32 |
| A-06 | Skeleton shimmer | `sh 1.3s linear infinite`, gradient bg 600 px wide moving −300→300 px | docs_a_loading.dc.html:16-17 |
| A-07 | Phone action sheet | `up .25s cubic-bezier(.22,1,.36,1)` from `translateY(40px)` opacity 0 | docs_a_mobile.dc.html:32-33 |
| A-08 | Phone level change | `sl .2s cubic-bezier(.22,1,.36,1)` from `translateX(14px)` opacity 0 | :34-35 |
| A-09 | Phone preview sheet | `sheet .28s cubic-bezier(.22,1,.36,1)` from `translateY(40px)` | docs_mobile_preview.dc.html:21-22 |
| A-10 | Viewer zoom | paper `width .2s` | s/home/v7x_doc_viewer.dc.html:226 |
| A-11 | Upload bar (specimen) | `fill 1.6s cubic-bezier(.2,.7,.2,1) infinite alternate` 8%→64% | docs_upload.dc.html:35-36 |
| A-12 | New row glow | `glow 2.4s ease-out` ok-light → panel (prototype infinite; ship once) | :39-40 |
| A-13 | Upload toast | `toast .3s cubic-bezier(.22,1,.36,1) .3s both` from y 10 | :37-38 |
| A-14 | Book hover | `transform .42s cubic-bezier(.34,1.45,.5,1)`, `box-shadow .3s cubic-bezier(.22,1,.36,1)`, `will-change:transform` | lib_shelf_a.dc.html:56 |
| A-15 | Empty-library books rise | `rise .6s cubic-bezier(.22,1,.36,1)` scaleY .2→1, delays 0/.08/.16/.24 s | lib_empty.dc.html:22-23,35-38 |
| A-16 | Current-node pulse | `v7pulse 1.8s ease-in-out infinite` gold ring 0→7 px | lib_reader.dc.html:44-45 |
| A-17 | Ask VCFO launcher | `v7up .45s cubic-bezier(.22,1,.36,1) .5s` from y 48; `v7bob 2.6s ease-in-out infinite` (−4 px) | lib_shelf_a.dc.html:48-51 |
| A-18 | Reduced motion | every board: `@media (prefers-reduced-motion: reduce)` disables all animations/transitions; books `transform:none` | docs_a_refined.dc.html:85; lib_shelf_a.dc.html:52,61 |

## 1.20 Breakpoint variants

| id | width | Documents | Knowledge Bank | Reader | file:line |
|---|---|---|---|---|---|
| B-01 | ≥1280 | sidebar 248; tree `clamp(300px,44%,440px)` + pane side by side; toolbar one line | seg wrapper 680–740; "Recently read" label inline | 2 columns | docs_a_refined.dc.html:87,98 |
| B-02 | 1000–1279 | sidebar 72 (icon rail; Before/After pill moves into rail in screenshot); toolbar buttons 36 px and wrap to 2nd line (screenshot 1024) | "Recently read" heading full row | 2 cols until 1100 | :88,103; lib_shelf_a.dc.html:77 |
| B-03 | ≤1100 | — | — | single column; side cards in auto-fit grid min 240 | lib_reader.dc.html:68-71 |
| B-04 | ≤999 | page grows (height auto); tree above pane (max 52vh); preview fixed `clamp(260px,42vh,420px)`; filter full row; spacer hidden | — | — | docs_a_refined.dc.html:104-112 |
| B-05 | ≤767 | sidebar hidden (drawer); toolbar controls 40, pill buttons 36, rows 44, kebabs 40 always visible — **but the router serves the phone board (M-*) instead** | seg full row, buttons 40, search 44, shelf = grid `repeat(auto-fill,128px)` centred, gap 40/18; mini cards full width, links 40 | hero/body padding 16, timeline vertical, facts 1 col, buttons 40 | :113-118; lib_shelf_a.dc.html:80-92; lib_reader.dc.html:72-87 |
| B-06 | phone board | M-01…M-14, MP-* | (no dedicated phone board for the shelf; uses B-05 rules) | | docs_a_mobile.dc.html |

---

# 2. DATA — what each board shows, mapped to the real app

Legend: **EXISTS** = hook / API / repository already in the repo · **PARTIAL** = exists but must be extended ·
**NEW** = must be built (with the backend piece named). Paths relative to `/home/user/vcfo_suite/`.
Golden rule from `CLAUDE.md`: only `src/db/repositories/*` may import `db`; every new query = a repository
function taking `AuthContext`, plus a cross-tenant test.

## 2.0 What the real pages use today

| Page | Today's code | Data today |
|---|---|---|
| `/app/client/documents` | `app/app/client/documents/page.tsx` → `src/views/client/Documents.tsx` (149 lines) | `useApp()` → `engagements`, `requests`, `getStateForEngagement`; `collectVaultDocuments` / `groupVaultDocuments` (`src/lib/vault-documents.ts`) build milestone → section → doc lists from `checklist_state`; each row fetches its own signed URL on mount via `MilestoneDocumentLink` (`src/components/common/MilestoneDocumentLink.tsx` → `getMilestoneDocumentSignedUrl` → `GET /api/milestone-documents/signed-url?path=`); `ClientBoardResolutionCard` (`fetchBoardResolutionInDb` → `GET /api/engagements/[id]/board-resolution`); legacy requests split into "on file" / "Still needed" lists. Returns `null` with no engagement. |
| `/app/client/library` | `src/views/client/ask/ClientLibrary.tsx` | `useQuery(['ask','library'], fetchLibrary)` → `GET /api/ask/library` → `listLibraryItems(ctx)` (`src/db/repositories/client-library.ts:33`) → `toLibraryView` (`src/lib/ask/library.ts`) giving `{id,title,category,topicSlug,updated,savedAt,answer}`; `StatusBriefButton` → `/api/ask/brief`; export → `/api/ask/library/export?ids=`. |
| `/app/client/library/[id]` | `src/views/client/ask/ClientLibraryItem.tsx` → `AskReader` | `fetchLibraryItem(id)` → `GET /api/ask/library/[id]` (`{item, notice}`); delete → `DELETE /api/ask/library/[id]` (`deleteLibraryItem` repo) then router push. Export `/api/ask/library/[id]/export`. |
| `/app/client/learn/[slug]` | `src/views/client/ask/ClientLearnTopic.tsx` → `AskReader` | `fetchTopicAnswer(slug,{depth,engagementId})` → `GET /api/ask/topics/[slug]`; depth switch re-fetches; save → `POST /api/ask/library` (`saveToLibrary`). |
| Staff vault (reference only) | `src/views/vault/DocumentVaultPage.tsx` | `useIndexedDocuments` (`src/lib/use-vault-documents.ts`) → `GET /api/documents`; `getIndexedDocumentSignedUrl` → `GET /api/documents/[id]/signed-url`. |
| Firm Knowledge Bank (staff) | `src/db/repositories/knowledge-bank.ts`, `app/api/knowledge-bank/**` | **Staff-only** (`requireAnyRole('admin','manager','intern')`). Not the client "Knowledge Bank": the client one is the Ask VCFO library (`client_library_items`) + topics (`src/data/ask/topics/*.json`). Do not expose firm KB files to clients. |

## 2.1 Documents — one unified "document node" model (NEW view-model, existing sources)

The board's data rows (`docs_a_refined.dc.html:260-287`) are
`[id, parent, label, type, status, from, date, fileName, categoryId, replaced?, dueKind?, stale?]`.
Recommend a single server endpoint that returns this already merged and scoped:

**NEW** `GET /api/client/documents?engagementId=` → `{ phases:[{id,label,steps:[{itemId,no,label,categoryIds,files:[DocNode]}]}], openRequests:n, totals }`
built by a **NEW repository** `src/db/repositories/client-documents.ts` → `listClientDocumentTree(ctx, engagementId)` that merges:

| Source | Gives | Existing function |
|---|---|---|
| Checklist uploads (paths in `engagements.checklist_state[*].responses`) | milestone files per step/field, upload timestamp from the path | `collectVaultDocuments` / `extractItemResponses` / `uploadTimestampFromStoragePath` / `fileNameFromStoragePath` (`src/lib/vault-documents.ts`, `src/lib/milestone-document-storage.ts:123-142`) — move server-side; client release filter via `isStepReleasedTo` (`src/lib/checklist/checklist-visibility.ts:67`) like `listDocuments` does |
| Indexed documents table | SBC-delivered files (COI, MoA, SH-1…), category, `stepId`, `contentType`, `sizeBytes`, `uploadedBy`, `sharedWithClient` | `listDocuments(ctx, engagementId)` (`src/db/repositories/documents.ts:130`) — client sees `shared_with_client = true` + released steps only |
| Board resolution | final / signed BR file | `fetchBoardResolutionForApi` (`src/lib/api/board-resolution-access.ts`) / `GET /api/engagements/[id]/board-resolution` (client allowed) + `download` / `download-signed` routes (client allowed) |
| Incorporation drafts shared with client | DOCX drafts | `filterClientVisibleIncorpDrafts` (`src/lib/incorporation-docs/share.ts`) as used in `incorporation-docs/download-all/route.ts` |
| Open requests | dashed "missing" rows | `listDocumentRequests(ctx)` (`src/db/repositories/document-requests.ts:58`) filtered `status==='pending'` + engagement |
| Step / phase structure | phase → step tree, step names | `getIncorporationPhases()` (`src/data/checklist.ts:1071`) + `CLIENT_PROGRESS_PHASE_TITLES` (`src/lib/client-progress-board.ts:21-26`: "Phase 1 — Name Application", "Phase 2 — Incorporation", "Phase 3 — Post-Incorporation", "Phase 4 — Registration") |

## 2.2 Documents — field-by-field mapping

| UI datum (id) | Prototype value | Real source | Status |
|---|---|---|---|
| Phase folder label (DT-06) | "Phase 2 — Incorporation" | `CLIENT_PROGRESS_PHASE_TITLES[phase.id]` | EXISTS (casing differs: board uses sentence case "Name application", "Post-incorporation"; pick the app's string or lower-case second word consistently) |
| Phase count (DT-06) | 10 | count of non-replaced DocNodes under phase (incl. missing) | NEW (derived) |
| Step folder label (DT-07) "N · Name" | "6 · Director KYC" | step number = 1-based position of the item in the client step order (`getIncorporationPhases()` flattened), name = `item.title` | PARTIAL (number helper: reuse whatever the Incorporation page uses to print "Step 7 of 14"; else NEW tiny helper in `src/lib/`) |
| Per-step progress ok/rv/ms (DT-08) | 4 / 0 / 1 | ok = files with status Approved or Final; rv = In review; ms = Missing rows | NEW (derived in repo) |
| Category folders (DT-09) | Identity & KYC, Office address, Company records, Certificates, Banking & capital | `documents.category` today holds `documents|images|reports|deliverables` or a field `section` / vault phase (`milestone-documents/route.ts:141`) — **not** these 5 | NEW: a `CLIENT_DOC_CATEGORY` map `fieldId/stepId → c1..c5` in `src/lib/` (static, like `vaultPhaseForItem`) |
| Row name (DT-21) | "PAN card — Ravi Kumar" | field label (`getClientResponseFields(item)[].label`, repeat label via `repeatFieldLabel`) + person name for director repeats (`resolvePre6DisplayNameForPrefix`) ; indexed rows: a human title | PARTIAL (VaultDocument.fieldLabel exists; person suffix NEW) |
| Type tile (DT-12) | PDF / JPG / DOCX | `contentType` (indexed) or extension of `fileName` (`resolveUploadExtension`, `src/lib/upload-limits.ts:125`) | EXISTS |
| Status Approved (DT-14) | green | step slice `getReviewStatus(slice)==='accepted'` (`src/lib/checklist/checklist-item-review.ts:11-25`) or request `status==='approved'` | EXISTS |
| Status In review | blue | `isAwaitingReview(slice)` / request `uploaded` | EXISTS |
| Status Final | navy badge | SBC-delivered: indexed doc uploaded by staff & shared, or `isDeliveredToClient(slice)` (`src/lib/checklist/checklist-state-key.ts:187`), BR `status==='finalized'`/signed (`boardResolutionProgressFromDoc`, `client-progress-board.ts:33`) | EXISTS (rule to combine = NEW) |
| Status Replaced (DT-11) | greyed, hidden by default | older uploads for the same field. Today only the **latest** path is kept in `checklist_state` (improve #7), but every upload is a new S3 object `{eng}/{fieldId}/{ts}-{name}` (`milestoneDocumentObjectPath`) | **NEW**: keep history — either a `document_versions` table (doc_id, object_key, replaced_at, replaced_by) or index every upload in `documents` with `replaced_by_id`; repo fn `listFieldVersions(ctx, engagementId, fieldId)`. Alternative: S3 `ListObjectsV2` on the prefix → **NEW** `listObjects(prefix)` in `src/storage/s3.ts` (only the repo may call it) |
| Missing row (DT-13) | "Signed DIR-2 — Meera Shah", due 12 Nov | pending `document_requests` row (title) | EXISTS (title) |
| Due date / Overdue | "Due 12 Nov" / "Overdue" | `DocRequest.dueAt` exists in the type and in `createDocumentRequest` input, **but `document_requests` has no due column** (`src/db/schema.ts:673-683`) — dropped on insert | **NEW**: migration `document_requests.due_at timestamptz`, `step_id text`, `field_id text`, `object_key text`, `file_name text`, `uploaded_at timestamptz`, `review_note text`; map in repo |
| "Asked by Arjun Mehta" (DP-05) | requester name | `document_requests.requested_by` → profiles name | NEW join in `listDocumentRequests` (return `requestedByName`) |
| "From" (DP-05) | "SBC · Arjun Mehta" / "Northwind" | indexed `documents.uploaded_by` → profile name + role (staff → "SBC · {name}", client → company name); milestone uploads by the client → company name | PARTIAL (uploaded_by exists for indexed rows; milestone path has no uploader → store `uploadedBy` in the response slice or index client uploads too) |
| Date (DP-05) | "24 Oct 2026" | indexed `createdAt`; milestone `uploadTimestampFromStoragePath`; format `dd MMM yyyy` (`formatUploadDate` in Documents.tsx uses `en-IN` "24 Oct 2026") | EXISTS |
| File (DP-05) | `COI-Northwind.pdf` | `fileName` / `fileNameFromStoragePath` | EXISTS |
| Verify portal (DP-05) | MCA portal / Income-tax e-filing | map by document kind → portal (rule 15). Portal URL constants exist in `src/lib/announcement-portals.ts` (MCA, etc.) | NEW map `src/lib/document-portals.ts` (kind → {label,url}) |
| Stale flag "Older than 2 months" (DT-15) | address-proof bill | needs the **bill date** (document date), not upload date. Fields: utility bill / bank statement / address proof | NEW: rule table `{fieldId → maxAgeDays: 60}` + use an entered "bill date" response if the step captures it, else upload date as fallback; flag computed in repo |
| Board resolution row (DT-16) | Phase 1 › step "Signed Board Resolution" › "Board resolution (final)" Final + replaced draft | `fetchBoardResolutionForApi` → `storagePath` (draft docx) + `signedStoragePath` (signed) + `status` | EXISTS (merge into tree = NEW); delete `ClientBoardResolutionCard` usage on this page |
| Toolbar counter "15/17" (D-07) | shown/total files | client-side from the tree | derived |
| "Upload · 2 requested" (D-14) | open request count | pending requests for the engagement | EXISTS (`requests` in `useApp()` or the new endpoint) |
| Arrange-by remembered (D-11) | By step | — | NEW: `localStorage['vcfo.docs.view']` (per-viewer convenience) or `ask-client-prefs`-style user pref repo (`src/db/repositories/ask-client-prefs.ts` exists as a pattern) |
| Status / Replaced toggles | on / off | — | client state (optionally remembered) |
| Open state of folders | default map | — | client state; default open all except collapsed long steps |
| Selected file | f9 | — | client state; deep link `?doc=` (for "Copy link") NEW |

## 2.3 Documents — actions mapping

| Action | Prototype | Real backend | Status |
|---|---|---|---|
| Preview (pane page, eye, menu Preview, drill eye) | opens `v7x_doc_viewer` | signed URL **on click only** (improve #1): milestone → `GET /api/milestone-documents/signed-url?path=` ; indexed → `GET /api/documents/[id]/signed-url` ; BR → `GET /api/engagements/[id]/board-resolution/download(-signed)`; render PDF in `<iframe>`/`<object>` or pdf.js, images `<img>`, DOCX via `IncorporationDocxPreview` (`src/components/incorporation/IncorporationDocxPreview.tsx`, dep `docx-preview`) as `DocPackPreviewDialog` does | EXISTS (endpoints) / NEW (shared `DocumentViewer` component) |
| Pane thumbnail (DP-03) | placeholder page | first page of PDF / the image / docx render, lazy | NEW (client render from signed URL) |
| Download (icon, menu, viewer) | toast | same signed URLs with `Content-Disposition: attachment` (add `?download=1` → `signedDownloadUrl(key, ttl, {filename})`) | PARTIAL — `signedDownloadUrl(key, expiresIn)` (`src/storage/s3.ts:75-84`) has **no** `ResponseContentDisposition`; NEW optional `{ downloadName }` param → `GetObjectCommand({…, ResponseContentDisposition: 'attachment; filename="…"'})` |
| Download folder as ZIP / Download all (ZIP) | 260 ms ticking toast | **NEW** route `GET /api/client/documents/zip?engagementId=&folder={phaseId|itemId|categoryId|all}` — streams a zip with **real step names as folders** ("Phase 2 — Incorporation/6 · Director KYC/PAN card — Ravi Kumar.pdf"); reuse `pizzip` like `src/lib/incorporation-docs/zip.ts`; read bytes via `getObjectBuffer` (`src/storage/s3.ts:63`) inside a repository-side helper; audit with `recordAuditEvent` (`doc_pack.download_zip` pattern in `app/api/engagements/[id]/doc-pack/zip/route.ts`). Progress: real toast can show indeterminate → done, or stream with `Content-Length`. Staff doc-pack zip is **staff-only** (`src/lib/api/doc-pack.ts:50`) — do not reuse for clients. | NEW |
| Copy link / Copy link to folder | "Link copied" toast | `navigator.clipboard.writeText(origin + '/app/client/documents?doc=' + id)` / `?folder=` | NEW (URL param handling in page) |
| Open step N | — | `router.push('/app/client/incorporation/step/{stepId}')` (route `app/app/client/incorporation/step/[stepId]/page.tsx` takes the checklist **item id**, not the display number) | EXISTS (route) |
| Upload against a request (U-*, DP-04, M-11) | specimen | **NEW** `POST /api/requests/[id]/upload` (multipart) → validate (`validateMilestoneUploadFile`, `MILESTONE_DOCUMENT_EXTENSIONS`), `putObject(bucketKey(...))`, then `updateDocumentRequest(ctx,id,{status:'uploaded',fileName,uploadedAt})` + store `object_key` (new column) → fires existing `client_uploaded` email (`app/api/requests/[id]/route.ts`). When the request is tied to a checklist field, call the existing `POST /api/engagements/[id]/milestone-documents` (fieldId + file) instead, then PATCH the request. Today `uploadDoc` in `src/context/use-app-provider-value.ts:927-942` only records a file **name** — no bytes are stored. | NEW |
| Undo after upload (U-04) | gold Undo | NEW `DELETE /api/requests/[id]/upload` within N s (soft: revert status to pending, delete object) | NEW |
| Re-upload note (U-06) | "AM: Bill is older…" | `document_requests.detail` today mixes message + `file:`/`uploadedAt:` lines (`document-requests.ts:135-148`) — fragile | NEW `review_note` column (or reuse step `reviewStatus==='rejected'` + reviewer note) |
| Take photo (M-11) | sheet item | `<input type="file" accept="image/*" capture="environment">` → same upload route | NEW (UI only) |
| Accepted types caption (U-07) | "PDF · JPG · PNG · DOCX · up to 10 MB" | `MILESTONE_DOCUMENT_EXTENSIONS` + `maxUploadSizeLabel()` (`src/lib/upload-limits.ts:25,91`, default 50 MB) | EXISTS — print from config, don't hard-code 10 MB |
| Upload error (U-05) | ".heic · this file type can't be opened" | route returns `validateMilestoneUploadFile` error | EXISTS |
| Ask VCFO why / Ask VCFO about this | opens chat | `useAskOptional()` → `ask.setOpen(true)`; context `{kind:'document', ref, label}` exists in `ChatBody.context` (`src/hooks/ask/ask-api.ts:62-70`) | EXISTS |
| Open incorporation (empty state, drill link) | — | `/app/client/incorporation` | EXISTS |

## 2.4 Shared document viewer (V-*) data

| Datum | Source | Status |
|---|---|---|
| File name, type tile | DocNode | from 2.2 |
| (i) "From SBC · 24 Oct 2026 · Size [size]" | `uploadedBy` name, date, `sizeBytes` (`formatUploadFileSize`, `src/lib/upload-limits.ts:35`) — milestone uploads have no size → S3 `HeadObject` NEW or store size at upload | PARTIAL |
| "1 of 4" + prev/next | the ordered list the viewer was opened from (tree order / drill tab) | client |
| Page n / N, zoom | PDF renderer page count | NEW (pdf.js or browser viewer) |
| Unsupported state | types other than pdf/jpg/png/docx | client |

## 2.5 Knowledge Bank shelf (L-*)

| UI datum | Prototype | Real source | Status |
|---|---|---|---|
| Books | 15 saved items | `fetchLibrary()` → `LibraryItemView[]` (`src/hooks/ask/ask-api.ts:119-145`) | EXISTS |
| Book title | "FC-GPR after share allotment" | `item.title` | EXISTS |
| Shelf / category | 5 shelves | `item.category` ∈ `incorporation · tax · foreign-investment · labour · compliance · your-project` (`src/lib/ask/categories.ts`); label via `categoryLabel` but **"your-project" must render as "{Company}’s project"** (company from `ask.engagementId` → engagement name) | EXISTS (+ label tweak) ; add **labour** shelf colour |
| Category order | Incorporation, Foreign investment, Tax, Compliance, Northwind’s project | static order array in the view | NEW (const) |
| Category pill counts | All 15 · … | count per category of loaded items | derived |
| "{n} books" chip | 15 | `items.length` | derived |
| Updated ribbon (L-14) | blue ribbon | `item.updated` (`isLibraryItemUpdated`, `src/lib/ask/library.ts`) — today rendered as an **amber** "Updated" chip in `ClientLibrary.tsx:119-121` → change to blue ribbon | EXISTS (restyle) |
| Book glyph | per category | static per category | NEW (const) |
| Search "Search books" | title includes | today searches `title + answer.line` (`ClientLibrary.tsx:34-38`) | EXISTS |
| Monthly status brief | button | `StatusBriefButton` → `/api/ask/brief?engagementId=` | EXISTS |
| PDF brief | button | `/api/ask/library/export?ids=` | EXISTS |
| Recently read (L-08) + drill (LD-*) | 3 items, % read, "2 of 3 sections", "read on 8 Nov", In progress/Finished | — | **NEW**: table `client_library_reads (profile_id, item_id | topic_slug, progress_pct int, sections_read int, sections_total int, last_read_at, finished_at)`; repo `src/db/repositories/library-reads.ts` (`listRecentReads(ctx, limit)`, `recordReadProgress(ctx, …)`) scoped to `ctx.userId`; API `GET/POST /api/ask/library/reads`; reader reports scroll progress (IntersectionObserver per section) |
| Suggested chips (LE-05) | 3 topic titles | `fetchSuggestions('client', engagementId)` → `GET /api/ask/suggestions` or published topics list (`src/lib/ask/topics.ts`) linking to `/app/client/learn/{slug}` | EXISTS |
| Empty state | bot text | `items.length===0` | EXISTS |
| Loading | skeleton books | `query.isLoading` | EXISTS (UI NEW) |
| Error | error card + "Back to library" | `query.isError` | EXISTS (UI NEW) |

## 2.6 Reader (R-*)

| UI datum | Prototype | Real source | Status |
|---|---|---|---|
| Category chip | "Foreign investment" | `categoryLabel(item.category)` | EXISTS |
| "Reviewed by SBC" | green chip | `TrustBadge` logic (`src/components/ask/TrustBadge.tsx`): topic answers with `reviewedBy` and not `draft` | EXISTS |
| "Updated 6 Nov" (blue) | saved mode | `item.updated` + `notice` (`UPDATED_SINCE_SAVED`) ; date = topic `reviewedAt` (topic schema) | PARTIAL (date not in `LibraryItemView` → add `topicReviewedAt`) |
| Title | H1 | `item.title` / `topic.title` | EXISTS |
| Depth pill | Simpler · Normal · More detail | `AnswerDepth` `simple|normal|detail`; learn page re-fetches (`onDepth`); saved item: snapshot has only one depth → NEW: re-fetch topic at chosen depth when `topicSlug` present (call `fetchTopicAnswer`) ; for generated answers hide the pill | PARTIAL |
| "3 min read" | read time | NEW derived: words(line + why + visual text) / 200 wpm, min 1 |
| Official link · RBI FIRMS | hero pill | first `answer.citations[]` with `url` of a govt source, or NEW portal map per topic | PARTIAL |
| Lead line | 17 px | `answer.line` | EXISTS |
| Timeline visual | 3 nodes | `answer.visual` type `timeline` → `VisualRenderer` (`src/components/ask/visuals/`) — restyle to Focus-track nodes (done ✓ / current navy+gold pulse / next dashed) | EXISTS (restyle) |
| Facts grid (More detail) | Who files / Late fee / Portal | `visual.type==='keyFacts'` (`{k,v}[]`) at detail depth | EXISTS (data shape) |
| Why it matters to Northwind | gold box | `answer.why` (title must use company name) | EXISTS |
| Sources chips | 2 | `answer.citations[]` | EXISTS |
| Save / Saved / Remove | buttons | `saveToLibrary` / `deleteLibraryItem` — Remove needs **toast + Undo** (improve #11): soft delete → NEW `deleted_at` column on `client_library_items` + restore endpoint, or delay the DELETE 5 s client-side | NEW (undo) |
| PDF brief | button | `/api/ask/library/[id]/export` (saved) | EXISTS (learn mode: NEW export by slug or hide) |
| Ask a follow-up | button | `ask.setOpen(true); ask.showTopic(slug, depth, 'Tell me more about …')` | EXISTS |
| In Northwind’s project (R-13) | FC-GPR filing 2 Dec, 24 days left, SBC files, Open in Compliances | topic slug ↔ compliance obligation (topics `obligation-*.json` exist; FC-GPR topic `fc-gpr.json`) → `getFilings(ctx, …)` (`src/db/repositories/filings.ts:65`) / `useComplianceFilings` (`src/hooks/use-compliance-filings.ts:10`) filtered by obligation | NEW mapping topic→obligation id (static) + reuse filings |
| Related in library (R-14) | 2 rows | `topic.related[]` (max 3 slugs, `src/data/ask/schema.ts` topicSchema) → saved item if exists else `/learn/{slug}` | EXISTS (data) |
| Documents for this (R-15) | FIRC from the bank · Approved | `topic.stepIds[]` → DocNodes in those steps (new tree endpoint, filter by `stepId`) → opens shared viewer | NEW (join) |
| Trail leaf | title | page | EXISTS |

## 2.7 Shell & shared

| Item | Real source | Status |
|---|---|---|
| Sidebar badge "Documents 6" | open requests + new files? (prototype hard-codes "6") — define as pending requests count | NEW (definition) |
| Notifications badge | existing notifications repo | EXISTS |
| Bot avatar | existing launcher/assets (`src/components/ask/AskLauncher.tsx`) | EXISTS |
| Theme | existing `ThemeToggle` | EXISTS |

## 2.8 Access-control notes for new pieces (Path A)

* All new document reads for clients: `assertEngagementAccess(ctx, engagementId)` + `shared_with_client` + `isStepReleasedTo('client', slice)` exactly as `listDocuments` (`documents.ts:96-118`) and `milestone-documents/signed-url/route.ts:52-66`.
* ZIP route must apply the same filters per entry (never zip an unreleased step's file).
* Request upload: client may only upload to **its own engagement's pending requests**; flip status only to `uploaded` (`updateDocumentRequest` already enforces, `document-requests.ts:131-133`).
* Library reads: private to `ctx.userId` like `client_library_items`.
* Cross-tenant tests for: `listClientDocumentTree`, zip builder, request upload, library reads.

## 2.9 improve.dc.html — problem → fix list the redesign answers (verbatim summary)

| # | Problem today | Fix (in FINAL) |
|---|---|---|
| 1 | Each row fetches its own signed link on load; new tab; "(link unavailable)" | fetch only on 👁/⬇, open shared in-app viewer |
| 2 | No search/filter/sort | filter, source filter, group switch |
| 3 | "Still needed" has no upload | drop zone per request |
| 4 | Raw dates / raw status words | one date format; In review / Approved / Re-upload |
| 5 | Requests and files in two lists | one list; requests become rows/badges on their step |
| 6 | No engagement → blank | friendly empty state |
| 7 | Only latest file; no reason for re-upload | keep versions; Replaced greyed (h toggle); SBC note |
| 8 | No bulk download | Download ZIP / Download all |
| 9 | No stale-proof sign | amber "older than" chip |
| 10 | Library cards are text | book covers by category |
| 11 | Remove deletes at once | toast with Undo |
| 12 | Learn topic "Loading…" forever without engagement | show topic without project facts / clear message |
| 13 | "Loading…" text, dead-end errors | skeleton books; error card "Back to library" |
| 14 | "Updated" chip amber | blue ribbon |
| 15 | No recently read / suggestions | Recently read strip; suggested topics |
| 16 | Topic never links to filings/docs | reader side panel "In {Company}’s project" + "Documents for this" |

Source: `final-src/s/docs/improve.dc.html:22-45`.

---

# 3. LAYOUT & CSS — verbatim excerpts per board and breakpoint

Everything below is copied byte-for-byte from the FINAL sources (only the fences are added).
Template syntax: `{{x}}` = value from the board's `renderVals()`; `<sc-for list as>` = map; `<sc-if value>` = conditional;
`<dc-import name="v7c_bot" …>` = the bot avatar component; `<dc-import name="side|topbar">` = shell placeholders.
`light-dark(a, b)` = light value, dark value. Fonts: **Manrope** (UI), **IBM Plex Mono** (`.mono`, counts, dates, file names, type tiles),
**Space Grotesk** (preview titles / metrics), **Source Serif 4** (phone preview paper only).

## 3.0 Design tokens

Light tokens are declared per board (Documents set below). Dark ("True black") tokens are injected globally by `proto.js`;
note `[data-paper]` stays light in dark mode.

#### Light tokens (Documents boards) — `s/docs/docs_a_refined.dc.html:15-24` (verbatim)

```css
:root{--bg:oklch(97.4% 0.006 255);--panel:oklch(100% 0 0);--raised:oklch(96.6% 0.007 255);--border:oklch(92.2% 0.011 255);--hair:oklch(94.8% 0.007 255);--fg:oklch(21% 0.042 264);--muted:oklch(46% 0.028 258);--subtle:oklch(55% 0.022 255);
--primary:oklch(54.6% 0.215 263);--primary-dark:oklch(48.8% 0.217 264);--primary-light:oklch(96.6% 0.02 260);
--navy:#0f2a4a;--navy-2:#17396b;--navy-3:#1b4f94;--gold:#c9a24b;--gold-soft:#fbf3df;--gold-text:#6e500f;
--ok:oklch(56% 0.13 168);--ok-light:oklch(96% 0.028 170);--ok-text:oklch(39% 0.09 172);--ok-chip:oklch(50% 0.12 168);
--due:oklch(66% 0.17 48);--due-light:oklch(96.8% 0.04 55);--due-text:oklch(48% 0.14 42);--due-chip:oklch(55% 0.17 42);
--over:oklch(57% 0.2 22);--over-light:oklch(96.4% 0.026 18);--over-text:oklch(46% 0.17 20);--over-chip:oklch(52% 0.2 22);
--prog:oklch(55% 0.16 252);--prog-light:oklch(96% 0.026 250);--prog-text:oklch(43% 0.13 254);--prog-chip:oklch(51% 0.17 252);
--teal-light:oklch(96.4% 0.026 195);--teal-chip:oklch(47% 0.09 195);
--folder:#0f2a4a;--folder-open:#1b4f94;
--shadow:0 1px 2px oklch(25% 0.04 264 / 0.04), 0 6px 18px -10px oklch(28% 0.06 264 / 0.18)}
```

#### Dark theme tokens + data-paper island (proto.js) — `proto.js:35-75` (verbatim)

```js
    var ds = document.createElement('style'); ds.id = 'vp-dark';
    ds.textContent = [
      'html{color-scheme:light}',
      'html[data-theme="dark"]{color-scheme:dark;' +
        '--bg:#000;--panel:oklch(13% 0.006 260);--raised:oklch(17% 0.008 260);--border:oklch(24% 0.01 260);--hair:oklch(19% 0.008 260);' +
        '--fg:oklch(92% 0.005 260);--muted:oklch(72% 0.008 260);--subtle:oklch(60% 0.01 260);' +
        '--primary:oklch(68% 0.16 255);--primary-dark:oklch(76% 0.13 255);--primary-light:oklch(22% 0.06 258);--primary-chip:oklch(50% 0.17 258);' +
        '--navy:oklch(46% 0.15 258);--navy-ink:oklch(94% 0.008 255);--navy-2:oklch(52% 0.15 258);--navy-3:oklch(56% 0.15 255);' +
        '--navy-deep:oklch(19% 0.05 258);--navy-2-deep:oklch(23% 0.07 258);--navy-3-deep:oklch(29% 0.1 255);--primary-fill:oklch(52% 0.19 258);--primary-fill-2:oklch(58% 0.18 258);' +
        '--gold:#e0bd66;--gold-2:#ecd08a;--gold-soft:oklch(25% 0.05 85);--gold-text:#e8c97d;' +
        '--ok:oklch(68% 0.14 165);--ok-light:oklch(23% 0.05 165);--ok-text:oklch(80% 0.1 165);--ok-chip:oklch(50% 0.12 165);' +
        '--due:oklch(74% 0.15 62);--due-light:oklch(25% 0.06 60);--due-text:oklch(84% 0.11 68);--due-chip:oklch(54% 0.15 45);' +
        '--over:oklch(66% 0.19 22);--over-light:oklch(23% 0.07 22);--over-text:oklch(80% 0.12 22);--over-chip:oklch(52% 0.19 22);' +
        '--prog:oklch(66% 0.15 252);--prog-light:oklch(23% 0.06 252);--prog-text:oklch(80% 0.1 252);--prog-chip:oklch(50% 0.16 252);' +
        '--up:oklch(40% 0.015 255);--up-light:oklch(18% 0.008 255);--up-text:oklch(72% 0.01 255);--up-chip:oklch(40% 0.02 258);' +
        '--violet:oklch(68% 0.15 292);--violet-light:oklch(24% 0.06 292);--violet-chip:oklch(52% 0.16 292);--violet-text:oklch(80% 0.1 292);--violet-soft:oklch(28% 0.07 292);' +
        '--sky:oklch(68% 0.11 228);--sky-light:oklch(23% 0.05 228);--sky-chip:oklch(52% 0.11 230);' +
        '--teal:oklch(66% 0.1 195);--teal-light:oklch(23% 0.05 195);--teal-chip:oklch(58% 0.09 195);' +
        '--you:oklch(70% 0.15 55);--you-light:oklch(25% 0.06 55);--you-text:oklch(84% 0.1 60);' +
        '--with:oklch(66% 0.15 262);--with-light:oklch(23% 0.06 262);--with-text:oklch(80% 0.1 262);' +
        '--own-you:oklch(26% 0.05 85);--own-you-t:#e8c97d;--own-sbc:oklch(23% 0.05 262);--own-sbc-t:oklch(80% 0.1 262);' +
        '--folder:oklch(72% 0.1 255);--folder-open:oklch(78% 0.1 255);--sk:oklch(20% 0.008 260);--cv:oklch(20% 0.008 260);' +
        '--shadow:0 0 0 1px oklch(20% 0.008 260);--pop:0 18px 44px -12px rgba(0,0,0,.9)}',
      'html[data-theme="dark"],html[data-theme="dark"] body{background:#000}',
      /* the sidebar and the page-level sidebar placeholders are hard-coded navy; True black takes them to black */
      'html[data-theme="dark"] .vps,html[data-theme="dark"] .vh-side,html[data-theme="dark"] .tb-side{background:#000!important}',
      'html[data-theme="dark"] .vps:not(.vps-mbar){box-shadow:inset -1px 0 0 oklch(20% 0.008 260)}',
      'html[data-theme="dark"] .vps .vps-i[aria-current=page]{background:oklch(17% 0.02 260)}',
      'html[data-theme="dark"] .vps.vps-icons .vps-i .vps-b{box-shadow:0 0 0 2px #000}',
      /* switch knobs stay light so on/off reads at a glance */
      'html[data-theme="dark"] .tgl::after{background:oklch(92% 0.005 260)}',
      /* document previews: a light-only island, white paper with the original ink */
      'html[data-theme="dark"] [data-paper]{color-scheme:light;background:#fff!important;color:oklch(21% 0.042 264);' +
        '--fg:oklch(21% 0.042 264);--muted:oklch(46% 0.028 258);--subtle:oklch(55% 0.022 255);--hair:oklch(94.8% 0.007 255);' +
        '--border:oklch(92.2% 0.011 255);--raised:oklch(96.6% 0.007 255);--panel:#fff;--navy:#0f2a4a;--navy-ink:#0f2a4a}',
      /* Credentials: per-authority colours, slate accent */
      'html[data-theme="dark"] :is(.cr-card,.cr-ctile)[data-auth=mca]{--a:oklch(62% 0.15 278);--a-bg:oklch(24% 0.06 278);--a-fg:oklch(84% 0.08 278)}',
      'html[data-theme="dark"] :is(.cr-card,.cr-ctile)[data-auth=it]{--a:oklch(62% 0.1 200);--a-bg:oklch(23% 0.05 200);--a-fg:oklch(84% 0.07 200)}',
      'html[data-theme="dark"] :is(.cr-card,.cr-ctile)[data-auth=gst]{--a:oklch(62% 0.12 155);--a-bg:oklch(23% 0.05 155);--a-fg:oklch(84% 0.08 155)}',
      'html[data-theme="dark"] :is(.cr-card,.cr-ctile)[data-auth=oth]{--a:oklch(70% 0.13 72);--a-bg:oklch(25% 0.06 72);--a-fg:oklch(86% 0.09 75)}'
    ].join('\n');
```

Extra light tokens used by Library/viewer boards (from `v7x_doc_viewer.dc.html` / `side.dc.html`):
`--primary-chip:oklch(52% 0.21 263)` · `--up*` · `--violet:oklch(54% 0.17 292)` · `--violet-light:oklch(96.4% 0.032 292)` · `--violet-chip:oklch(50% 0.17 292)` ·
`--sky*` · `--teal:oklch(55% 0.1 195)` · category inks `--cat-tax:oklch(58% 0.14 70)`, `--cat-labour:oklch(50% 0.12 200)`, `--cat-business:oklch(52% 0.17 292)`, `--cat-ip:oklch(52% 0.13 230)`, `--cat-fema:oklch(55% 0.19 12)`.
**Note** `lib_shelf_a`/`lib_reader` redefine `--violet*` to the *primary blue* (`--violet:oklch(54.6% 0.215 263)`, `--violet-text:oklch(40% 0.17 264)`) — knowledge = blue-violet there; `lib_empty` keeps true violet (`oklch(54% 0.17 292)`).

## 3.1 Documents desktop / tablet — complete stylesheet (`docs_a_refined`)

Covers: badges, buttons, icon buttons, toggles `.tg`, sliding pill `.seg`, tree rows `.tr`, guides `.gd`, file-type tile `.ft`,
progress bar `.pb` + tooltip, kebab `.kb`, menus, key-value rows, toast, tooltips `.tip`, status glyph `.sg`, the responsive layer
(sidebar column, page, toolbar, tree, pane, preview page, drop zone; ≤1279 / ≤999 / ≤767) and the **"One shape" 20 px override that wins** (last 6 lines).

#### Stylesheet — `s/docs/docs_a_refined.dc.html:14-124` (verbatim)

```css
body{margin:0;-webkit-font-smoothing:antialiased}
:root{--bg:oklch(97.4% 0.006 255);--panel:oklch(100% 0 0);--raised:oklch(96.6% 0.007 255);--border:oklch(92.2% 0.011 255);--hair:oklch(94.8% 0.007 255);--fg:oklch(21% 0.042 264);--muted:oklch(46% 0.028 258);--subtle:oklch(55% 0.022 255);
--primary:oklch(54.6% 0.215 263);--primary-dark:oklch(48.8% 0.217 264);--primary-light:oklch(96.6% 0.02 260);
--navy:#0f2a4a;--navy-2:#17396b;--navy-3:#1b4f94;--gold:#c9a24b;--gold-soft:#fbf3df;--gold-text:#6e500f;
--ok:oklch(56% 0.13 168);--ok-light:oklch(96% 0.028 170);--ok-text:oklch(39% 0.09 172);--ok-chip:oklch(50% 0.12 168);
--due:oklch(66% 0.17 48);--due-light:oklch(96.8% 0.04 55);--due-text:oklch(48% 0.14 42);--due-chip:oklch(55% 0.17 42);
--over:oklch(57% 0.2 22);--over-light:oklch(96.4% 0.026 18);--over-text:oklch(46% 0.17 20);--over-chip:oklch(52% 0.2 22);
--prog:oklch(55% 0.16 252);--prog-light:oklch(96% 0.026 250);--prog-text:oklch(43% 0.13 254);--prog-chip:oklch(51% 0.17 252);
--teal-light:oklch(96.4% 0.026 195);--teal-chip:oklch(47% 0.09 195);
--folder:#0f2a4a;--folder-open:#1b4f94;
--shadow:0 1px 2px oklch(25% 0.04 264 / 0.04), 0 6px 18px -10px oklch(28% 0.06 264 / 0.18)}
a{color:var(--primary);text-decoration:none;font-weight:700}
.mono{font-family:"IBM Plex Mono",monospace;font-feature-settings:"tnum"}
.badge{display:inline-flex;align-items:center;gap:4px;height:20px;border-radius:4px;padding:0 7px;font-size:11px;font-weight:700;white-space:nowrap;box-sizing:border-box}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:32px;padding:0 12px;border-radius:6px;font:600 12.5px Manrope,sans-serif;border:1px solid transparent;cursor:pointer;text-decoration:none;white-space:nowrap;box-sizing:border-box}
.btn-n{background:var(--navy);color:#fff}.btn-n:hover{background:var(--navy-2);color:#fff}
.btn-o{background:var(--panel);color:var(--fg);border-color:var(--border)}.btn-o:hover{background:var(--raised);color:var(--fg)}
.ib{width:32px;height:32px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:inline-flex;align-items:center;justify-content:center;flex:none;cursor:pointer;box-sizing:border-box}
.ib:hover{background:var(--primary-light);color:var(--navy-ink,var(--navy))}
.tg{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--muted);font:600 12px Manrope,sans-serif;cursor:pointer}
.tg.on{background:var(--primary-light);color:var(--navy-ink,var(--navy));border-color:oklch(54.6% 0.215 263 / .35)}
.seg{position:relative;display:inline-grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);padding:2px;border-radius:8px;background:light-dark(oklch(96.5% 0.008 250), oklch(18.3% 0.008 250));box-shadow:inset 0 0 0 1px var(--border)}
.seg>.thumb{position:absolute;top:2px;bottom:2px;left:2px;border-radius:6px;background:var(--navy);box-shadow:0 1px 2px oklch(21% 0.042 264 / .25);transition:transform .42s linear(0,0.0637,0.2021,0.3619,0.5141,0.6451,0.7506,0.8315,0.8909,0.9328,0.9613,0.9799,0.9914,0.9981,1.0016,1.0032,1.0036,1.0034,1.0029,1.0023,1.0018,1.0013,1.0009,1.0006,1.0004)}
.seg button{position:relative;z-index:1;border:0;background:none;height:26px;padding:0 12px;border-radius:6px;font:500 12px Manrope,sans-serif;color:light-dark(oklch(50% 0.022 255), oklch(80% 0.015 255));cursor:pointer;white-space:nowrap;transition:color .2s}
.seg button.on{color:#fff}
.tr{position:relative;display:flex;align-items:center;height:36px;padding-right:6px;font-size:13px;color:var(--fg)}
.tr:hover{background:var(--raised)}
.tr.sel{background:var(--navy);color:#fff}
.tr.sel::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--gold)}
.tr.hid{color:var(--subtle)}
.tr.hid .lb{font-style:italic}
.tr .main{flex:1;min-width:0;height:36px;display:flex;align-items:center;gap:8px;padding:0 0 0 12px;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.tr .main:focus-visible{outline:2px solid oklch(54.6% 0.215 263 / .5);outline-offset:-2px}
.gd{width:16px;align-self:stretch;flex:none;border-left:1px solid var(--border);margin-left:7px;box-sizing:border-box}
.tr.sel svg.fold path:first-child{fill:#fff}.tr.sel svg.fold .ln{stroke:var(--navy)}
.tr.sel .gd{border-left-color:oklch(100% 0 0 / .2)}
.ico{width:16px;height:16px;flex:none;display:flex;align-items:center;justify-content:center}
.ft{font:700 11px/18px "IBM Plex Mono",monospace;min-width:30px;height:18px;padding:0 3px;box-sizing:border-box;border-radius:3px;color:#fff;text-align:center;flex:none}
.lb{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.cnt{font:500 11px "IBM Plex Mono",monospace;color:var(--subtle)}
.tr.sel .cnt{color:oklch(100% 0 0 / .7)}
.pb{position:relative;display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 4px;border-radius:4px;flex:none;cursor:pointer;font-weight:500}
.pb:hover{background:oklch(54.6% 0.215 263 / .08)}
.pb .trk{display:flex;gap:1px;width:56px;height:4px;border-radius:2px;overflow:hidden;background:var(--hair)}
.pb::after{content:attr(data-tip);position:absolute;right:0;bottom:calc(100% + 6px);z-index:60;width:max-content;max-width:240px;padding:6px 9px;border-radius:6px;background:var(--navy);color:#fff;font:600 11.5px Manrope,sans-serif;opacity:0;visibility:hidden;transform:translateY(3px);transition:opacity .12s,transform .12s,visibility .12s;pointer-events:none}
.pb:hover::after,.pb:focus-visible::after{opacity:1;visibility:visible;transform:none}
.kb{width:28px;height:28px;border-radius:6px;border:0;background:none;color:inherit;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;flex:none}
.tr:hover .kb,.tr:focus-within .kb,.kb.open{opacity:1}
.kb:hover,.kb.open{background:oklch(54.6% 0.215 263 / .12)}
.tr.sel .kb:hover,.tr.sel .kb.open{background:oklch(100% 0 0 / .16)}
.kb:focus-visible{opacity:1;outline:2px solid oklch(54.6% 0.215 263 / .5);outline-offset:-2px}
.menu{position:absolute;right:6px;top:34px;z-index:70;width:236px;max-width:calc(100vw - 24px);box-sizing:border-box;padding:4px;border-radius:8px;background:var(--panel);border:1px solid var(--border);box-shadow:0 16px 36px -12px oklch(21% 0.042 264 / .4);color:var(--fg)}
.menu button{display:flex;align-items:center;gap:10px;width:100%;height:34px;padding:0 10px;border:0;border-radius:6px;background:none;font:600 12.5px Manrope,sans-serif;color:var(--fg);cursor:pointer;text-align:left}
.menu button:hover,.menu button:focus-visible{background:var(--primary-light);color:var(--navy-ink,var(--navy));outline:none}
.menu hr{border:0;border-top:1px solid var(--hair);margin:4px 2px}
.menu .k{margin-left:auto;font:500 11px "IBM Plex Mono",monospace;color:var(--subtle)}
.kv{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:36px;padding:0 16px;box-sizing:border-box;border-top:1px solid var(--hair);font-size:13px}
.kv>span:first-child{color:var(--muted);font-weight:500}
.kv>span:last-child{font-weight:600;min-width:0;text-align:right;overflow-wrap:anywhere}
.kv>span:first-child{flex:none}
.toast{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);z-index:80;width:min(360px,calc(100% - 24px));box-sizing:border-box;padding:10px 12px;border-radius:8px;background:var(--navy);color:#fff;box-shadow:0 18px 40px -14px oklch(15% 0.05 258 / .65);display:flex;flex-direction:column;gap:8px}
@keyframes tin{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translateX(-50%)}}
.toast{animation:tin .25s cubic-bezier(.22,1,.36,1) both}
.tbar{height:4px;border-radius:2px;background:oklch(100% 0 0 / .18);overflow:hidden}
.tbar>span{display:block;height:100%;background:var(--gold);transition:width .25s}
.tip{position:relative}
.tip::after{content:attr(data-tip);position:absolute;left:50%;bottom:calc(100% + 6px);z-index:90;width:max-content;max-width:240px;padding:6px 9px;border-radius:6px;background:var(--navy);color:#fff;font:600 11.5px/1.35 Manrope,sans-serif;font-style:normal;letter-spacing:0;text-transform:none;white-space:nowrap;opacity:0;visibility:hidden;transform:translate(-50%,3px);transition:opacity .12s .12s,transform .12s .12s,visibility .12s .12s;pointer-events:none}
.tip:hover::after,.tip:focus-visible::after{opacity:1;visibility:visible;transform:translate(-50%,0)}
.sg{width:16px;height:16px;border-radius:99px;flex:none;display:flex;align-items:center;justify-content:center}
.tr.sel .sg{box-shadow:0 0 0 1.5px light-dark(#fff, oklch(13% 0.006 260))}
button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid oklch(54.6% 0.215 263 / .5);outline-offset:2px}
@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
/* ---------- v7 responsive (phone <=767 · tablet 768-1279 · desktop >=1280) ---------- */
.vp-sidecol{width:var(--vp-side-w,248px);flex:none;overflow:hidden;background:#0f2a4a}
@media (max-width:1279px){.vp-sidecol{width:var(--vp-side-w,72px)}}
@media (max-width:767px){.vp-sidecol{width:var(--vp-side-w,0px);visibility:hidden}}
.vdoc{position:relative;width:100%;height:100vh;height:100dvh;min-height:560px;display:flex;background:var(--bg);font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px}
.vdoc-col{flex:1;min-width:0;display:flex;flex-direction:column}
.vdoc-main{flex:1;min-height:0;width:100%;max-width:1600px;margin-inline:auto;box-sizing:border-box;padding:clamp(12px,1.6vw,20px) clamp(12px,1.8vw,24px) clamp(12px,1.8vw,24px);display:flex;flex-direction:column;gap:14px}
.vdoc-tools{display:flex;align-items:center;flex-wrap:wrap;gap:8px 6px;min-height:52px;padding:9px 12px;box-sizing:border-box;border-bottom:1px solid var(--border);flex:none}
.vdoc-q{flex:1 1 200px;max-width:300px;min-width:200px;box-sizing:border-box}
.vdoc-sp{flex:1 1 0}
.vdoc-acts{display:flex;gap:8px;flex-wrap:wrap}
.vdoc-body{flex:1;min-height:0;display:flex}
.vdoc-tree{width:clamp(300px,44%,440px);flex:none;border-right:1px solid var(--border);overflow:auto;padding:6px 0}
.vdoc-pane{flex:1;min-width:0;display:flex;flex-direction:column}
.vdoc-pv{flex:1;min-height:0;background:var(--raised);display:flex;align-items:center;justify-content:center;padding:20px;overflow:hidden}
.vdoc-page{position:relative;width:min(340px,100%);max-height:100%;aspect-ratio:340/440;flex:none;background:light-dark(#fff, oklch(13% 0 89.9));box-shadow:0 4px 24px -8px oklch(21% 0.042 264 / .3);border-radius:2px;padding:34px 36px;box-sizing:border-box;color:var(--fg);font-weight:500;display:block;overflow:hidden}
.vdoc-drop{width:min(360px,100%);height:220px;box-sizing:border-box}
@media (max-width:1279px){.vdoc-acts .btn{height:36px}}
@media (max-width:999px){
  .vdoc{height:auto;min-height:100vh;min-height:100dvh}
  .vdoc-body{flex-direction:column}
  .vdoc-tree{width:auto;max-height:52vh;border-right:0;border-bottom:1px solid var(--border)}
  .vdoc-pv{flex:none;height:clamp(260px,42vh,420px)}
  .vdoc-page{height:100%;width:auto;max-width:100%}
  .vdoc-q{max-width:none;flex-basis:100%}
  .vdoc-sp{display:none}
}
@media (max-width:767px){
  .vdoc-tools .tg,.vdoc-tools .btn{height:40px}
  .vdoc-tools .seg button{height:36px}
  .vdoc .tr,.vdoc .tr .main{height:44px}
  .vdoc .kb{width:40px;height:40px;opacity:1}
}
/* "One shape": every mark in the tree is the same 20px rounded square */
.ft{width:20px;min-width:20px;height:20px;padding:0;border-radius:6px;font:700 7px/20px "IBM Plex Mono",monospace;letter-spacing:-.02em}
.sg{width:20px;height:20px;border-radius:6px}
.ico:has(.fold){width:20px;height:20px;border-radius:6px;background:light-dark(oklch(94.5% 0.015 255), oklch(21.3% 0.01 255))}
.ico:has(.fold) .fold{width:12px;height:12px}
.ico>span{width:20px!important;height:20px!important;border-radius:6px!important}
```

### 3.1.1 Documents desktop — complete markup (page frame, toolbar, tree row template, menus, empty filter, pane, toast)

#### Template — `s/docs/docs_a_refined.dc.html:127-234` (verbatim)

```html
<div class="vdoc">
  <div class="vp-sidecol" data-vp="side"><dc-import name="side" active="4" hint-size="248px,900px" style="display:block;width:248px"></dc-import></div>
  <div class="vdoc-col">
    <dc-import name="topbar" trail="Documents" hint-size="100%,52px" style="display:block"></dc-import>
    <main class="vdoc-main">
      <section aria-label="Document explorer" style="position:relative;flex:1;min-height:0;background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow);display:flex;flex-direction:column">
        <div class="vdoc-tools">
          <label class="vdoc-q" style="display:flex;align-items:center;gap:8px;height:32px;padding:0 10px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--subtle);box-sizing:border-box"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M16 16l4 4"></path></svg><input type="search" aria-label="Filter documents" placeholder="Filter documents" value="{{q}}" onInput="{{onQ}}" style="flex:1;min-width:0;border:0;outline:0;background:none;font:500 13px Manrope,sans-serif;color:var(--fg)"><span class="mono" style="font-size:11px;color:var(--subtle)">{{countLabel}}</span></label>
          <button type="button" class="{{tgStatus}}" data-tip="Show status icons" aria-pressed="{{statusOn}}" onClick="{{toggleStatus}}"><span style="display:flex;gap:2px"><span style="width:6px;height:6px;border-radius:99px;background:var(--ok)"></span><span style="width:6px;height:6px;border-radius:99px;background:var(--prog)"></span><span style="width:6px;height:6px;border-radius:99px;background:var(--due)"></span></span>Status</button>
          <button type="button" class="{{tgHid}}" data-tip="Show files that were replaced" aria-pressed="{{hidOn}}" onClick="{{toggleHid}}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M3 3l18 18 M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.6 3.3 M6.6 6.6C3.9 8.4 2.5 12 2.5 12s3.5 6 9.5 6a9 9 0 0 0 4.4-1.1 M9.9 9.9a3 3 0 0 0 4.2 4.2"></path></svg>Replaced</button>
          <div class="seg" role="tablist" aria-label="Arrange by" style="width:190px"><span class="thumb" style="width:calc((100% - 4px)/2);{{vThumb}}"></span><sc-for list="{{views}}" as="v" hint-placeholder-count="2"><button type="button" role="tab" aria-selected="{{v.sel}}" class="{{v.cls}}" onClick="{{v.pick}}">{{v.label}}</button></sc-for></div>
          <span class="vdoc-sp"></span>
          <span class="vdoc-acts"><button type="button" class="btn btn-o" onClick="{{zipAll}}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11 M7.5 10.5 12 15l4.5-4.5 M5 19.5h14"></path></svg>Download all (ZIP)</button><a class="btn btn-n" style="height:32px" href="docs_upload.dc.html"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4 M7.5 8.5 12 4l4.5 4.5 M5 19.5h14"></path></svg>Upload · 2 requested</a></span>
        </div>

        <div class="vdoc-body">
          <div role="tree" aria-label="Folders and files" class="vdoc-tree">
            <sc-for list="{{rows}}" as="r" hint-placeholder-count="18">
              <div role="treeitem" aria-expanded="{{r.exp}}" aria-selected="{{r.selA}}" class="{{r.cls}}">
                <button type="button" class="main" onClick="{{r.click}}">
                  <sc-for list="{{r.guides}}" as="g" hint-placeholder-count="1"><span class="gd"></span></sc-for>
                  <span class="ico" style="color:var(--subtle)"><sc-if value="{{r.folder}}" hint-placeholder-val="{{true}}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="{{r.chev}}"><path d="M9 6l6 6-6 6"></path></svg></sc-if></span>
                  <sc-if value="{{r.folder}}" hint-placeholder-val="{{true}}"><span class="ico"><svg class="fold" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18.5V5.5A1.5 1.5 0 0 1 4.5 4h4.2l2 2.4h8.8A1.5 1.5 0 0 1 21 7.9v10.6a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z" fill="{{r.fFill}}"></path><path class="ln" d="M3 9.2h18" stroke="oklch(100% 0 0 / .35)" stroke-width="1.3"></path></svg></span></sc-if>
                  <sc-if value="{{r.file}}" hint-placeholder-val="{{false}}"><span class="ft tip" role="img" data-tip="{{r.typeTip}}" aria-label="{{r.typeTip}}" style="{{r.tStyle}}">{{r.type}}</span></sc-if>
                  <sc-if value="{{r.missing}}" hint-placeholder-val="{{false}}"><span class="ico"><span style="width:14px;height:14px;border-radius:3px;border:1.5px dashed var(--due);box-sizing:border-box"></span></span></sc-if>
                  <span class="lb">{{r.label}}</span>
                  
                  <sc-if value="{{r.stale}}" hint-placeholder-val="{{false}}"><span class="badge tip" data-tip="Bill is older than 2 months. SBC may ask for a newer one." style="background:var(--due-light);color:var(--due-text);height:18px;font-size:11px">Older than 2 months</span></sc-if><sc-if value="{{r.isHidden}}" hint-placeholder-val="{{false}}"><span class="tip" role="img" data-tip="Replaced by a newer file" aria-label="Replaced by a newer file" style="display:flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M3 3l18 18 M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.6 3.3 M6.6 6.6C3.9 8.4 2.5 12 2.5 12s3.5 6 9.5 6a9 9 0 0 0 4.4-1.1 M9.9 9.9a3 3 0 0 0 4.2 4.2"></path></svg></span></sc-if>
                  <sc-if value="{{r.missing}}" hint-placeholder-val="{{false}}"><span class="badge" style="{{r.mStyle}}">{{r.mLabel}}</span></sc-if><sc-if value="{{r.showDot}}" hint-placeholder-val="{{false}}"><span class="sg tip" role="img" data-tip="{{r.stTip}}" aria-label="{{r.stTip}}" style="{{r.sgBg}}"><svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true"><path d="{{r.sgFill}}" fill="#fff"></path><path d="{{r.sgStroke}}" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"></path></svg></span></sc-if>
                  <sc-if value="{{r.phase}}" hint-placeholder-val="{{false}}"><span class="cnt">{{r.cnt}}</span></sc-if>
                </button>
                <sc-if value="{{r.hasBar}}" hint-placeholder-val="{{false}}"><a class="pb" href="docs_a_drill.dc.html" data-tip="{{r.tip}}" aria-label="{{r.tip}}. Open the list"><span class="trk"><span style="background:var(--ok);{{r.wOk}}"></span><span style="background:var(--prog);{{r.wRv}}"></span><span style="background:var(--due);{{r.wMs}}"></span></span><span class="cnt">{{r.frac}}</span></a></sc-if>
                <button type="button" class="{{r.kbCls}}" data-tip="More actions" aria-label="More actions for {{r.label}}" aria-haspopup="menu" aria-expanded="{{r.menuOpen}}" onClick="{{r.openMenu}}"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5.5" r="1.7"></circle><circle cx="12" cy="12" r="1.7"></circle><circle cx="12" cy="18.5" r="1.7"></circle></svg></button>
                <sc-if value="{{r.showMenu}}" hint-placeholder-val="{{false}}">
                  <div class="menu" role="menu" aria-label="Actions" onKeyDown="{{r.menuKey}}">
                    <sc-if value="{{r.folder}}" hint-placeholder-val="{{true}}">
                      <button type="button" role="menuitem" onClick="{{r.zip}}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5h8l4 4v13H6Z M10 3.5v2 M10 7.5v2 M10 11.5v2 M9 16h2v3H9Z"></path></svg>Download folder as ZIP<span class="k">{{r.zipCount}}</span></button>
                      <button type="button" role="menuitem" onClick="{{r.expandAll}}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9l5-5 5 5 M7 15l5 5 5-5"></path></svg>Expand all</button>
                      <button type="button" role="menuitem" onClick="{{r.collapseAll}}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4l5 5 5-5 M7 20l5-5 5 5"></path></svg>Collapse all</button>
                      <hr>
                      <button type="button" role="menuitem" onClick="{{r.copy}}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path></svg>Copy link to folder</button>
                    </sc-if>
                    <sc-if value="{{r.fileMenu}}" hint-placeholder-val="{{false}}">
                      <button type="button" role="menuitem" onClick="{{r.dl}}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11 M7.5 10.5 12 15l4.5-4.5 M5 19.5h14"></path></svg>Download</button>
                      <button type="button" role="menuitem" onClick="{{r.click}}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z"></path></svg>Preview</button>
                      <button type="button" role="menuitem" onClick="{{r.close}}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 4.5h15v15h-15Z M9 12h6 M12 9l3 3-3 3"></path></svg>Open step {{r.stepNo}}</button>
                      <hr>
                      <button type="button" role="menuitem" onClick="{{r.copy}}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path></svg>Copy link</button>
                    </sc-if>
                    <sc-if value="{{r.missMenu}}" hint-placeholder-val="{{false}}">
                      <button type="button" role="menuitem" onClick="{{r.click}}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4 M7.5 8.5 12 4l4.5 4.5 M5 19.5h14"></path></svg>Upload</button>
                      <button type="button" role="menuitem" onClick="{{r.close}}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 4.5h15v15h-15Z M9 12h6 M12 9l3 3-3 3"></path></svg>Open step {{r.stepNo}}</button>
                      <hr>
                      <button type="button" role="menuitem" onClick="{{r.copy}}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path></svg>Copy link</button>
                    </sc-if>
                  </div>
                </sc-if>
              </div>
            </sc-for>
            <sc-if value="{{noRows}}" hint-placeholder-val="{{false}}"><div style="padding:40px 16px"><div role="status" style="display:flex;align-items:flex-end;gap:10px;justify-content:center;text-align:left"><dc-import name="v7c_bot" state="idle" size="40" hint-size="40px,40px"></dc-import><div style="position:relative;max-width:320px;padding:10px 14px;border-radius:10px 10px 10px 2px;background:var(--panel);border:1px solid var(--border);box-shadow:0 8px 20px -12px oklch(21% 0.042 264 / .35);display:flex;flex-direction:column;align-items:flex-start"><span style="font:600 13px/1.45 Manrope,sans-serif;color:var(--fg)">No document matches “{{q}}”.</span><button type="button" onClick="{{clearQ}}" style="margin-top:6px;padding:0;border:0;background:none;font:700 12px Manrope,sans-serif;color:var(--primary);cursor:pointer">Clear filter</button><a href="#" style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;font-size:12px;font-weight:700;color:var(--primary)">Ask VCFO why</a></div></div></div></sc-if>
          </div>

          <div class="vdoc-pane">
            <div style="display:flex;align-items:center;gap:8px;height:52px;padding:0 12px 0 16px;border-bottom:1px solid var(--border);flex:none">
              <span class="ft tip" role="img" data-tip="{{sel.typeTip}}" aria-label="{{sel.typeTip}}" style="min-width:34px;height:20px;line-height:20px;font-size:11px;{{sel.tStyle}}">{{sel.type}}</span>
              <span style="font:700 14px Manrope,sans-serif;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{sel.label}}</span>
              <span class="badge" style="{{sel.stStyle}}">{{sel.status}}</span>
              <sc-if value="{{sel.isFile}}" hint-placeholder-val="{{true}}"><a class="ib tip" href="v7x_doc_viewer.dc.html" data-go="doc-viewer" data-tip="Preview" aria-label="Preview"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z"></path></svg></a><a class="ib tip" href="#" data-tip="Download" aria-label="Download"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11 M7.5 10.5 12 15l4.5-4.5 M5 19.5h14"></path></svg></a></sc-if>
            </div>
            <div class="vdoc-pv">
              <sc-if value="{{sel.isFile}}" hint-placeholder-val="{{true}}">
                <a href="v7x_doc_viewer.dc.html" data-go="doc-viewer" aria-label="Open in viewer" class="vdoc-page" data-paper>
                  <span style="display:block;font-size:11px;letter-spacing:.1em;color:var(--muted);text-transform:uppercase">Sample · placeholder page</span>
                  <span style="display:block;font:600 18px 'Space Grotesk';margin-top:10px">{{sel.label}}</span>
                  <span style="display:block;font-size:11.5px;color:var(--muted);margin-top:4px">Northwind Technologies India Pvt Ltd</span>
                  <span style="display:block;height:6px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:92%;margin-top:18px"></span><span style="display:block;height:6px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:84%;margin-top:9px"></span><span style="display:block;height:6px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:95%;margin-top:9px"></span><span style="display:block;height:6px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:66%;margin-top:9px"></span>
                </a>
              </sc-if>
              <sc-if value="{{sel.isMissing}}" hint-placeholder-val="{{false}}">
                <a href="docs_upload.dc.html" class="vdoc-drop" style="border:1.5px dashed var(--due);border-radius:10px;background:var(--due-light);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--due-text)"><span style="width:40px;height:40px;border-radius:99px;background:var(--due-chip);color:#fff;display:flex;align-items:center;justify-content:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4 M7.5 8.5 12 4l4.5 4.5 M5 19.5h14"></path></svg></span><span style="font-size:13.5px">Drop the file or <span style="color:var(--primary)">browse</span></span></a>
              </sc-if>
            </div>
            <div style="flex:none">
              <div class="kv"><span>Step</span><span>{{sel.step}}</span></div>
              <div class="kv"><span>From</span><span>{{sel.from}}</span></div>
              <div class="kv"><span>{{sel.dateLabel}}</span><span class="mono" style="font-size:12px">{{sel.date}}</span></div>
              <div class="kv"><span>File</span><span class="mono" style="font-size:12px;font-weight:500">{{sel.file}}</span></div>
              <sc-if value="{{sel.hasPortal}}" hint-placeholder-val="{{true}}"><div class="kv"><span>Verify</span><a class="tip" data-tip="Open {{sel.portal}}" href="{{sel.portalUrl}}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px">{{sel.portal}}<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 16L16 8 M9 8h7v7"></path></svg><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)"> (opens in a new tab)</span></a></div></sc-if>
            </div>
          </div>
        </div>

        <sc-if value="{{toastOn}}" hint-placeholder-val="{{false}}">
          <div class="toast" role="status" aria-live="polite">
            <div style="display:flex;align-items:center;gap:10px">
              <sc-if value="{{toastDone}}" hint-placeholder-val="{{false}}"><span style="width:22px;height:22px;border-radius:99px;background:var(--ok-chip);display:flex;align-items:center;justify-content:center;flex:none"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg></span></sc-if>
              <sc-if value="{{toastBusy}}" hint-placeholder-val="{{true}}"><span style="width:22px;height:22px;border-radius:99px;background:oklch(100% 0 0 / .14);display:flex;align-items:center;justify-content:center;flex:none"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5h8l4 4v13H6Z M10 3.5v2 M10 7.5v2 M10 11.5v2"></path></svg></span></sc-if>
              <span style="flex:1;font-size:12.5px;font-weight:700">{{toastText}}</span>
              <span class="mono" style="font-size:11px;opacity:.75">{{toastCount}}</span>
              <button type="button" aria-label="Dismiss" onClick="{{toastClose}}" style="width:24px;height:24px;border:0;border-radius:6px;background:none;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button>
            </div>
            <sc-if value="{{toastBusy}}" hint-placeholder-val="{{true}}"><div class="tbar"><span style="{{toastW}}"></span></div></sc-if>
          </div>
        </sc-if>
      </section>
    </main>
  </div>
</div>
```

### 3.1.2 Documents desktop — data, colour maps and behaviour (renderVals)

Read this for: demo rows, category list, `TS` (type tile colours), `DOT`, `ST` (status badge colours), `TT` (type tooltips),
`G` (status glyph paths/colours), `gk`, `tipOf` (status tooltip text), filter/visibility rules, counts, progress maths, menu actions,
ZIP toast timer (260 ms), portal map, default open folders and selection.

#### Board logic — `s/docs/docs_a_refined.dc.html:236-387` (verbatim)

```js
<script type="text/x-dc" data-dc-script data-props='{"initMenu":{"editor":"text","default":""},"initToast":{"editor":"enum","options":["none","preparing","done"],"default":"none"},"$preview":{"width":1440,"height":1000}}'>
class Component extends DCLogic {
  constructor(p) {
    super(p);
    const t = (p && p.initToast) || 'none';
    this.state = { open: { p1: true, s3: true, p2: true, s6: true, s8: true, s17: true, p3: true, s21: false, s22: true, c1: true, c2: true, c3: true, c4: true, c5: false }, sel: 'f9', q: '', status: true, hid: false, view: 0, menu: (p && p.initMenu) || '', toast: t === 'none' ? null : { name: 'Phase 2 — Incorporation.zip', total: 9, n: t === 'done' ? 9 : 6, done: t === 'done' } };
  }
  componentDidMount() {
    const m = (this.props && this.props.initMenu) || ''; const t = (this.props && this.props.initToast) || 'none';
    if ((m && !this.state.menu) || (t !== 'none' && !this.state.toast)) this.setState({ menu: m, toast: t === 'none' ? null : { name: '6 · Director KYC.zip'.replace(/^\d+ · /, ''), total: 4, n: t === 'done' ? 4 : 3, done: t === 'done' } });
  }
  componentWillUnmount() { if (this.timer) clearInterval(this.timer); }
  startZip(name, total) {
    if (this.timer) clearInterval(this.timer);
    let n = 0;
    this.setState({ menu: '', toast: { name, total, n: 0, done: false } });
    this.timer = setInterval(() => {
      n++;
      if (n >= total) { clearInterval(this.timer); this.timer = null; this.setState({ toast: { name, total, n: total, done: true } }); }
      else this.setState({ toast: { name, total, n, done: false } });
    }, 260);
  }
  renderVals() {
    const s = this.state || {};
    const N = [
      ['p1', null, 'Phase 1 — Name application'],
      ['s3', 'p1', '3 · Signed Board Resolution'],
      ['f1', 's3', 'Board resolution (final)', 'PDF', 'Final', 'SBC · Arjun Mehta', '18 Sep 2026', 'board-resolution-final.pdf', 'c3'],
      ['f2', 's3', 'Board resolution (draft v1)', 'DOCX', 'Replaced', 'SBC · Arjun Mehta', '12 Sep 2026', 'draft-board-resolution-v1.docx', 'c3', true],
      ['p2', null, 'Phase 2 — Incorporation'],
      ['s6', 'p2', '6 · Director KYC'],
      ['f3', 's6', 'PAN card — Ravi Kumar', 'PDF', 'Approved', 'Northwind', '14 Sep 2026', 'ravi-kumar-pan.pdf', 'c1'],
      ['f4', 's6', 'Passport — Meera Shah', 'PDF', 'Approved', 'Northwind', '14 Sep 2026', 'meera-shah-passport.pdf', 'c1'],
      ['f5', 's6', 'Address proof — Ravi Kumar', 'PDF', 'Approved', 'Northwind', '15 Sep 2026', 'electricity-bill-aug.pdf', 'c1', false, '', 'stale'],
      ['f5b', 's6', 'Address proof — Ravi (June bill)', 'PDF', 'Replaced', 'Northwind', '2 Sep 2026', 'electricity-bill-jun.pdf', 'c1', true],
      ['f6', 's6', 'Photograph — Meera Shah', 'JPG', 'Approved', 'Northwind', '15 Sep 2026', 'meera-photo.jpg', 'c1'],
      ['m1', 's6', 'Signed DIR-2 — Meera Shah', '', 'Missing', 'Asked by Arjun Mehta', '12 Nov 2026', '—', 'c1', false, 'due'],
      ['s8', 'p2', '8 · Registered Office Address'],
      ['f7', 's8', 'Utility bill — office', 'PDF', 'Approved', 'Northwind', '22 Sep 2026', 'office-electricity-sep.pdf', 'c2'],
      ['f8', 's8', 'Rent agreement', 'DOCX', 'Approved', 'Northwind', '23 Sep 2026', 'rent-agreement.docx', 'c2'],
      ['m2', 's8', 'Notarised lease deed', '', 'Missing', 'Asked by Arjun Mehta', '6 Nov 2026', '—', 'c2', false, 'over'],
      ['s17', 'p2', '17 · Certificate of Incorporation'],
      ['f9', 's17', 'Certificate of Incorporation', 'PDF', 'Final', 'SBC · Arjun Mehta', '24 Oct 2026', 'COI-Northwind.pdf', 'c4'],
      ['f10', 's17', 'MoA and AoA (stamped)', 'PDF', 'Final', 'SBC · Arjun Mehta', '24 Oct 2026', 'moa-aoa-northwind.pdf', 'c4'],
      ['p3', null, 'Phase 3 — Post-incorporation'],
      ['s21', 'p3', '21 · Share Capital Infusion'],
      ['f11', 's21', 'FIRC from the bank', 'PDF', 'Approved', 'Northwind', '2 Nov 2026', 'firc-hdfc.pdf', 'c5'],
      ['f12', 's21', 'Bank statement — Oct 2026', 'PDF', 'Approved', 'Northwind', '3 Nov 2026', 'hdfc-statement-oct.pdf', 'c5'],
      ['s22', 'p3', '22 · Share Certificates (SH-1)'],
      ['f13', 's22', 'Apostilled parent COI', 'PDF', 'In review', 'Northwind', '6 Nov 2026', 'parent-coi-apostille.pdf', 'c3'],
      ['f14', 's22', 'Share certificates SH-1', 'PDF', 'Final', 'SBC · Arjun Mehta', '7 Nov 2026', 'sh1-certificates.pdf', 'c4']
    ];
    const CATS = [['c1', 'Identity & KYC'], ['c2', 'Office address'], ['c3', 'Company records'], ['c4', 'Certificates'], ['c5', 'Banking & capital']];
    const isFile = (n) => n.length > 3;
    let nodes = N;
    if (s.view === 1) {
      nodes = [];
      CATS.forEach((c) => { nodes.push([c[0], null, c[1]]); N.filter((n) => isFile(n) && n[8] === c[0]).forEach((n) => { const m = n.slice(); m[1] = c[0]; m.step = n[1]; nodes.push(m); }); });
    }
    const by = {}; nodes.forEach((n) => { by[n[0]] = n; });
    const orig = {}; N.forEach((n) => { orig[n[0]] = n; });
    const depth = (n) => { let d = 0, p = n[1]; while (p) { d++; p = by[p][1]; } return d; };
    const TS = { PDF: 'background:var(--over-light);color:var(--over-text)', JPG: 'background:var(--teal-light);color:var(--teal-chip)', DOCX: 'background:var(--prog-light);color:var(--prog-text)' };
    const DOT = { Approved: 'background:var(--ok)', Final: 'background:var(--ok)', 'In review': 'background:var(--prog)', Replaced: 'background:light-dark(oklch(75% 0.01 255), oklch(37.5% 0.01 255))' };
    const ST = { Approved: 'background:var(--ok-light);color:var(--ok-text)', Final: 'background:var(--navy);color:#fff', 'In review': 'background:var(--prog-light);color:var(--prog-text)', Replaced: 'background:var(--raised);color:var(--muted)', Missing: 'background:var(--due-chip);color:#fff' };
    const TT = { PDF: 'PDF file', JPG: 'Image (JPG)', DOCX: 'Word document' };
    const G = {
      done: ['background:var(--ok-chip)', '', 'M6.5 12.5l3.8 3.8 7.2-8'],
      sbc: ['background:oklch(55% 0.2 262)', '', 'M5.5 16l4.5-4.5 3 3 5.5-6 M14.5 8.5h4v4'],
      you: ['background:var(--due-chip)', 'M12 4.5a3.6 3.6 0 1 1 0 7.2a3.6 3.6 0 1 1 0-7.2Z M4.8 20.5a7.2 7.2 0 0 1 14.4 0Z', ''],
      late: ['background:var(--over-chip)', '', 'M12 6v7.5 M12 18.2v.1'],
      now: ['background:var(--navy)', '', 'M12 6.5v6l3.5 2']
    };
    const gk = (n) => n[4] === 'In review' ? 'sbc' : n[4] === 'Missing' ? (n[10] === 'over' ? 'late' : 'you') : 'done';
    const tipOf = (n) => n[4] === 'Approved' ? 'Done · approved ' + n[6] : n[4] === 'Final' ? 'Done · from SBC ' + n[6] : n[4] === 'In review' ? 'With SBC · in review since ' + n[6] : n[4] === 'Missing' ? (n[10] === 'over' ? 'Late · was due ' + n[6] : 'Waiting on Northwind · due ' + n[6]) : n[4];
    const q = (s.q || '').trim().toLowerCase();
    const shown = (n) => (s.hid || !n[9]) && (!q || n[2].toLowerCase().includes(q));
    const files = nodes.filter(isFile);
    const under = (id) => files.filter((f) => { let p = f[1]; while (p) { if (p === id) return true; p = by[p][1]; } return false; });
    const folders = nodes.filter((n) => !isFile(n));
    const subFolders = (id) => folders.filter((f) => { let p = f[1]; while (p) { if (p === id) return true; p = by[p][1]; } return false; }).map((f) => f[0]);
    const cls = (st) => (st === 'Approved' || st === 'Final') ? 'ok' : st === 'In review' ? 'rv' : st === 'Missing' ? 'ms' : 'x';
    const close = () => this.setState({ menu: '' });
    const copyToast = (label) => { if (this.timer) clearInterval(this.timer); this.setState({ menu: '', toast: { name: 'Link copied', total: 0, n: 0, done: true, copy: label } }); };
    const rows = [];
    nodes.forEach((n) => {
      let p = n[1], vis = true;
      while (p) { if (!q && !s.open[p]) vis = false; p = by[p][1]; }
      if (!vis) return;
      const f = isFile(n);
      if (f && !shown(n)) return;
      if (!f && under(n[0]).filter(shown).length === 0) return;
      const d = depth(n); const open = q ? true : !!s.open[n[0]];
      const kids = f ? [] : under(n[0]).filter((x) => !x[9]);
      const ok = kids.filter((x) => cls(x[4]) === 'ok').length, rv = kids.filter((x) => cls(x[4]) === 'rv').length, ms = kids.filter((x) => cls(x[4]) === 'ms').length, tot = ok + rv + ms;
      const isStep = !f && n[1] !== null && s.view === 0;
      const isCat = !f && s.view === 1;
      const missing = f && n[4] === 'Missing';
      const selected = s.sel === n[0];
      const stepId = f ? (n.step || n[1]) : null;
      rows.push({
        guides: Array.from({ length: d }, () => ({})), folder: !f, file: f && !missing, missing, label: n[2], type: n[3] || '', tStyle: TS[n[3]] || '',
        exp: f ? null : (open ? 'true' : 'false'), selA: selected ? 'true' : 'false',
        cls: 'tr' + (selected ? ' sel' : '') + (n[9] ? ' hid' : ''),
        fFill: open ? 'var(--folder-open)' : 'var(--folder)',
        chev: 'transition:transform .15s;transform:rotate(' + (open ? 90 : 0) + 'deg)',
        phase: !f && !isStep && !isCat, cnt: kids.length,
        hasBar: (isStep || isCat) && tot > 0, frac: ok + '/' + tot,
        wOk: 'width:' + (ok / tot * 100) + '%', wRv: 'width:' + (rv / tot * 100) + '%', wMs: 'width:' + (ms / tot * 100) + '%',
        tip: n[2].replace(/^\d+ · /, '') + ' · ' + ok + ' received · ' + rv + ' in review · ' + ms + ' missing',
        showDot: f && s.status && !n[9], status: n[4] || '', isHidden: !!n[9], stale: n[11] === 'stale',
        typeTip: TT[n[3]] || '', sgBg: G[gk(n)][0], sgFill: G[gk(n)][1], sgStroke: G[gk(n)][2], stTip: tipOf(n),
        mLabel: n[10] === 'over' ? 'Overdue' : 'Due 12 Nov', mStyle: n[10] === 'over' ? 'background:var(--over-chip);color:#fff' : 'background:var(--due-chip);color:#fff',
        menuOpen: s.menu === n[0] ? 'true' : 'false', showMenu: s.menu === n[0], kbCls: 'kb tip' + (s.menu === n[0] ? ' open' : ''),
        fileMenu: f && !missing, missMenu: missing, stepNo: stepId ? orig[stepId] && orig[stepId][2].split(' · ')[0] : '',
        zipCount: kids.filter((x) => x[4] !== 'Missing').length + ' files',
        openMenu: () => this.setState({ menu: s.menu === n[0] ? '' : n[0] }),
        menuKey: (e) => { if (e.key === 'Escape') close(); },
        close,
        click: () => f ? this.setState({ sel: n[0], menu: '' }) : this.setState({ open: Object.assign({}, s.open, { [n[0]]: !s.open[n[0]] }), menu: '' }),
        zip: () => this.startZip(n[2].replace(/^\d+ · /, '') + '.zip', Math.max(1, kids.filter((x) => x[4] !== 'Missing').length)),
        expandAll: () => { const o = Object.assign({}, s.open); [n[0]].concat(subFolders(n[0])).forEach((id) => { o[id] = true; }); this.setState({ open: o, menu: '' }); },
        collapseAll: () => { const o = Object.assign({}, s.open); [n[0]].concat(subFolders(n[0])).forEach((id) => { o[id] = false; }); this.setState({ open: o, menu: '' }); },
        copy: () => copyToast(n[2]),
        dl: () => this.setState({ menu: '' })
      });
    });
    const sn = by[s.sel] || by.f9 || orig.f9;
    const stepNode = orig[sn.step || sn[1]] || orig.s17;
    const t = s.toast;
    const allFiles = N.filter((n) => isFile(n) && n[4] !== 'Missing' && !n[9]).length;
    const PORT = { f9: ['MCA portal', 'https://www.mca.gov.in'], f10: ['MCA portal', 'https://www.mca.gov.in'], f3: ['Income-tax e-filing', 'https://www.incometax.gov.in'] };
    const pt = PORT[sn[0]];
    return {
      rows, noRows: rows.length === 0, clearQ: () => this.setState({ q: '' }), q: s.q || '', onQ: (e) => this.setState({ q: e.target.value }),
      countLabel: files.filter(shown).length + '/' + files.length,
      statusOn: s.status ? 'true' : 'false', hidOn: s.hid ? 'true' : 'false',
      tgStatus: 'tg' + (s.status ? ' on' : ''), tgHid: 'tg' + (s.hid ? ' on' : ''),
      toggleStatus: () => this.setState({ status: !s.status }), toggleHid: () => this.setState({ hid: !s.hid }),
      views: ['By step', 'By category'].map((l, i) => ({ label: l, cls: s.view === i ? 'on' : '', sel: s.view === i ? 'true' : 'false', pick: () => this.setState({ view: i, menu: '' }) })),
      vThumb: 'transform:translateX(' + (s.view * 100) + '%)',
      zipAll: () => this.startZip('Northwind documents.zip', allFiles),
      sel: { typeTip: TT[sn[3]] || 'Not uploaded yet', label: sn[2], type: sn[3] || '—', tStyle: TS[sn[3]] || 'background:var(--due-chip)', status: sn[4], stStyle: ST[sn[4]], isFile: sn[4] !== 'Missing', isMissing: sn[4] === 'Missing', step: stepNode[2], from: sn[5], dateLabel: sn[4] === 'Missing' ? 'Due' : 'Date', date: sn[6], file: sn[7], hasPortal: !!pt, portal: pt ? pt[0] : '', portalUrl: pt ? pt[1] : '#' },
      toastOn: !!t, toastDone: !!(t && t.done), toastBusy: !!(t && !t.done),
      toastText: t ? (t.copy ? 'Link copied' : t.done ? 'Downloaded ' + t.name : 'Preparing ' + t.name + '…') : '',
      toastCount: t ? (t.copy ? '' : t.done ? t.total + ' files' : t.n + ' of ' + t.total) : '',
      toastW: t ? 'width:' + (t.total ? (t.n / t.total * 100) : 0) + '%' : '',
      toastClose: () => { if (this.timer) clearInterval(this.timer); this.setState({ toast: null }); }
    };
  }
}
</script>
```

### 3.1.3 Exact geometry cheat-sheet (desktop ≥1280, from the CSS above + screenshot 1440×900)

| Element | Size / spacing |
|---|---|
| Sidebar | 248 px (72 px rail ≤1279) |
| Top bar | 52 px |
| Main padding | 20 px top, 24 px sides/bottom at 1440 (clamp) |
| Explorer card | r10, 1 px border, shadow `0 1px 2px oklch(25% 0.04 264/.04), 0 6px 18px -10px oklch(28% 0.06 264/.18)` |
| Toolbar | min-height 52, padding 9 12, gap 8 (row) 6 (col); controls 32 px |
| Filter | 200–300 px wide, 32 tall, r6 |
| Arrange-by pill | 190 px, track padding 2, buttons 26 px, thumb r6 navy |
| Tree column | `clamp(300px,44%,440px)` (≈ 440 at 1440), padding 6 0 |
| Row | 36 px; left pad 12; each depth +16 px guide (+7 px margin); icon slots 20 px; gap 8 |
| Progress track | 56×4, r2, segments gap 1 |
| Kebab | 28×28 (r6) |
| Menu | 236 wide, items 34 tall, offset right 6 / top 34 |
| Pane header | 52 px |
| Preview page | 340×440 (aspect), padding 34 36 |
| KV rows | 36 px, padding 0 16 |
| Toast | ≤360 wide, bottom 20, r8 |

## 3.2 Documents — progress drill-down dialog

#### Drill stylesheet — `s/docs/docs_a_drill.dc.html:14-42` (verbatim)

```css
body{margin:0;-webkit-font-smoothing:antialiased}
:root{--panel:oklch(100% 0 0);--raised:oklch(96.6% 0.007 255);--border:oklch(92.2% 0.011 255);--hair:oklch(94.8% 0.007 255);--fg:oklch(21% 0.042 264);--muted:oklch(46% 0.028 258);--subtle:oklch(55% 0.022 255);--primary:oklch(54.6% 0.215 263);--primary-light:oklch(96.6% 0.02 260);--navy:#0f2a4a;--navy-2:#17396b;--gold:#c9a24b;
--ok:oklch(56% 0.13 168);--ok-light:oklch(96% 0.028 170);--ok-text:oklch(39% 0.09 172);--due:oklch(66% 0.17 48);--due-chip:oklch(55% 0.17 42);--due-light:oklch(96.8% 0.04 55);--due-text:oklch(48% 0.14 42);--prog:oklch(55% 0.16 252);--prog-light:oklch(96% 0.026 250);--prog-text:oklch(43% 0.13 254);--over-chip:oklch(52% 0.2 22);--teal-chip:oklch(47% 0.09 195)}
a{color:var(--primary);text-decoration:none;font-weight:700}
.mono{font-family:"IBM Plex Mono",monospace;font-feature-settings:"tnum"}
.badge{display:inline-flex;align-items:center;height:20px;border-radius:4px;padding:0 7px;font-size:11px;font-weight:700;white-space:nowrap}
.ib{width:32px;height:32px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:inline-flex;align-items:center;justify-content:center;flex:none;box-sizing:border-box}
.ib:hover{background:var(--primary-light);color:var(--navy-ink,var(--navy))}
.seg{position:relative;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);padding:2px;border-radius:8px;background:light-dark(oklch(96.5% 0.008 250), oklch(18.3% 0.008 250));box-shadow:inset 0 0 0 1px var(--border)}
.seg>.thumb{position:absolute;top:2px;bottom:2px;left:2px;border-radius:6px;background:var(--navy);transition:transform .42s linear(0,0.0637,0.2021,0.3619,0.5141,0.6451,0.7506,0.8315,0.8909,0.9328,0.9613,0.9799,0.9914,0.9981,1.0016,1.0032,1.0036,1.0034,1.0029,1.0023,1.0018,1.0013,1.0009,1.0006,1.0004)}
.seg button{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;background:none;height:28px;border-radius:6px;font:500 12px Manrope,sans-serif;color:light-dark(oklch(50% 0.022 255), oklch(80% 0.015 255));cursor:pointer}
.seg button.on{color:#fff}
.seg .c{font:600 10.5px "IBM Plex Mono",monospace;color:oklch(55% 0.022 255)}
.seg button.on .c{color:oklch(100% 0 0 / .72)}
.row{display:flex;align-items:center;gap:10px;height:44px;padding:0 12px 0 16px;border-top:1px solid var(--hair);color:var(--fg)}
.row:hover{background:var(--raised)}
.ft{font:700 7.5px/16px "IBM Plex Mono",monospace;width:22px;height:16px;border-radius:3px;color:#fff;text-align:center;flex:none}
@keyframes pop{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}
.dlg{animation:pop .22s cubic-bezier(.22,1,.36,1) both}
.tip{position:relative}.tip::after{content:attr(data-tip);position:absolute;left:50%;bottom:calc(100% + 6px);z-index:90;width:max-content;padding:6px 9px;border-radius:6px;background:var(--navy);color:#fff;font:600 11.5px Manrope,sans-serif;white-space:nowrap;opacity:0;visibility:hidden;transform:translate(-50%,3px);transition:opacity .12s .12s,transform .12s .12s,visibility .12s .12s;pointer-events:none}.tip:hover::after,.tip:focus-visible::after{opacity:1;visibility:visible;transform:translate(-50%,0)}
button:focus-visible,a:focus-visible{outline:2px solid oklch(54.6% 0.215 263 / .5);outline-offset:2px}
@media (prefers-reduced-motion: reduce){.dlg{animation:none}.seg>.thumb{transition:none}}
/* "One shape": every mark in the tree is the same 20px rounded square */
.ft{width:20px;min-width:20px;height:20px;padding:0;border-radius:6px;font:700 7px/20px "IBM Plex Mono",monospace;letter-spacing:-.02em}
.sg{width:20px;height:20px;border-radius:6px}
.ico:has(.fold){width:20px;height:20px;border-radius:6px;background:light-dark(oklch(94.5% 0.015 255), oklch(21.3% 0.01 255))}
.ico:has(.fold) .fold{width:12px;height:12px}
.ico>span{width:20px!important;height:20px!important;border-radius:6px!important}
</style>
```

#### Drill markup — `s/docs/docs_a_drill.dc.html:44-74` (verbatim)

```html
<div style="position:relative;width:1440px;height:1000px;overflow:hidden;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
  <div aria-hidden="true" style="position:absolute;inset:0;pointer-events:none"><dc-import name="docs_a_refined" hint-size="1440px,1000px"></dc-import></div>
  <div style="position:absolute;inset:0;background:oklch(20% 0.05 258 / 0.55);display:flex;align-items:center;justify-content:center">
    <div role="dialog" aria-modal="true" aria-label="Director KYC documents" class="dlg" style="width:640px;background:var(--panel);border-radius:12px;box-shadow:0 24px 60px -20px oklch(15% 0.05 258 / .55);overflow:hidden"><div class="dd-top" style="display:flex;align-items:center;gap:8px;padding:9px 18px;background:var(--primary-light);border-bottom:1px solid var(--border);font-size:12px;color:var(--muted)"><span>These documents are for Director KYC in Incorporation</span><a href="#" data-go="incorporation" style="margin-left:auto;font-weight:800;font-size:12.5px;white-space:nowrap">Open Incorporation →</a></div>
      <div style="display:flex;align-items:center;gap:10px;height:56px;padding:0 12px 0 18px;border-bottom:1px solid var(--border)">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18.5V5.5A1.5 1.5 0 0 1 4.5 4h4.2l2 2.4h8.8A1.5 1.5 0 0 1 21 7.9v10.6a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z" fill="#0f2a4a"></path></svg>
        <h2 style="margin:0;font:700 15px Manrope,sans-serif;color:var(--navy-ink,var(--navy));flex:1">6 · Director KYC</h2>
        <span style="display:flex;gap:1px;width:80px;height:5px;border-radius:3px;overflow:hidden"><span style="width:80%;background:var(--ok)"></span><span style="width:20%;background:var(--due)"></span></span>
        <span class="mono" style="font-size:11.5px;color:var(--subtle)">4/5</span>
        <a class="ib tip" data-tip="Close" href="docs_a_refined.dc.html" aria-label="Close"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></a>
      </div>
      <div style="padding:12px 16px">
        <div class="seg" role="tablist" aria-label="Status"><span class="thumb" style="width:calc((100% - 4px)/4);{{thumb}}"></span><sc-for list="{{tabs}}" as="t" hint-placeholder-count="4"><button type="button" role="tab" aria-selected="{{t.sel}}" class="{{t.cls}}" onClick="{{t.pick}}">{{t.label}}<span class="c">{{t.cnt}}</span></button></sc-for></div>
      </div>
      <div style="padding-bottom:6px">
        <sc-for list="{{rows}}" as="r" hint-placeholder-count="4">
          <div class="row">
            <sc-if value="{{r.isFile}}" hint-placeholder-val="{{true}}"><span class="ft" style="{{r.tStyle}}">{{r.type}}</span></sc-if>
            <sc-if value="{{r.missing}}" hint-placeholder-val="{{false}}"><span style="width:22px;height:16px;display:flex;justify-content:center"><span style="width:14px;height:14px;border-radius:3px;border:1.5px dashed var(--due);box-sizing:border-box"></span></span></sc-if>
            <a href="{{r.href}}" style="flex:1;color:var(--fg);font-weight:600">{{r.name}}</a>
            <span class="mono" style="font-size:11.5px;color:var(--subtle)">{{r.date}}</span>
            <span class="badge" style="{{r.stStyle}}">{{r.status}}</span>
            <sc-if value="{{r.isFile}}" hint-placeholder-val="{{true}}"><a class="ib tip" data-tip="Preview" href="v7x_doc_viewer.dc.html" aria-label="Preview {{r.name}}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z"></path></svg></a></sc-if>
            <sc-if value="{{r.missing}}" hint-placeholder-val="{{false}}"><a class="ib tip" data-tip="Upload" href="docs_upload.dc.html" aria-label="Upload {{r.name}}" style="color:var(--due-text);border-color:oklch(66% 0.17 48 / .5)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4 M7.5 8.5 12 4l4.5 4.5 M5 19.5h14"></path></svg></a></sc-if>
          </div>
        </sc-for>
        <sc-if value="{{none}}" hint-placeholder-val="{{false}}"><div style="padding:22px 16px;border-top:1px solid var(--hair)"><div role="status" style="display:flex;align-items:flex-end;gap:10px;justify-content:center;text-align:left"><dc-import name="v7c_bot" state="idle" size="40" hint-size="40px,40px"></dc-import><div style="position:relative;max-width:320px;padding:10px 14px;border-radius:10px 10px 10px 2px;background:var(--panel);border:1px solid var(--border);box-shadow:0 8px 20px -12px oklch(21% 0.042 264 / .35);display:flex;flex-direction:column;align-items:flex-start"><span style="font:600 13px/1.45 Manrope,sans-serif;color:var(--fg)">Nothing in this group yet.</span><a href="#" style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;font-size:12px;font-weight:700;color:var(--primary)">Ask VCFO why</a></div></div></div></sc-if>
      </div>
    </div>
  </div>
</div>
```

#### Drill logic (tabs, counts, rows) — `s/docs/docs_a_drill.dc.html:77-97` (verbatim)

```js
class Component extends DCLogic {
  constructor(p) { super(p); this.state = { t: 1 }; }
  renderVals() {
    const s = this.state || {};
    const TS = { PDF: 'background:var(--over-chip)', JPG: 'background:var(--teal-chip)' };
    const D = [
      ['PAN card — Ravi Kumar', 'PDF', '14 Sep', 'Approved', 1], ['Passport — Meera Shah', 'PDF', '14 Sep', 'Approved', 1],
      ['Address proof — Ravi Kumar', 'PDF', '15 Sep', 'Approved', 1], ['Photograph — Meera Shah', 'JPG', '15 Sep', 'Approved', 1],
      ['Signed DIR-2 — Meera Shah', '', 'Due 12 Nov', 'Missing', 3]
    ];
    const ST = { Approved: 'background:var(--ok-light);color:var(--ok-text)', Missing: 'background:var(--due-chip);color:#fff' };
    const L = ['All', 'Received', 'In review', 'Missing'];
    const list = D.filter((d) => s.t === 0 || d[4] === s.t);
    return {
      tabs: L.map((l, i) => ({ label: l, cnt: i === 0 ? D.length : D.filter((d) => d[4] === i).length, cls: s.t === i ? 'on' : '', sel: s.t === i ? 'true' : 'false', pick: () => this.setState({ t: i }) })),
      thumb: 'transform:translateX(' + (s.t * 100) + '%)',
      rows: list.map((d) => ({ name: d[0], type: d[1], date: d[2], status: d[3], tStyle: TS[d[1]] || '', stStyle: ST[d[3]], isFile: d[4] !== 3, missing: d[4] === 3, href: d[4] === 3 ? 'docs_upload.dc.html' : 'v7x_doc_viewer.dc.html' })),
      none: list.length === 0
    };
  }
}
```

Shared drill pop-up used by other pages (`proto.js` `vcfoDrill`): Esc/scrim close, focus management, phone sheet ≤700 px.

#### proto.js drill component (CSS + behaviour) — `proto.js:684-739` (verbatim)

```js
  var dcss = document.createElement('style');
  dcss.textContent = [
    '#vp-drill{width:min(600px,100%);max-height:calc(100vh - 120px);display:flex;flex-direction:column;background:light-dark(#fff, oklch(13% 0 89.9));border-radius:12px;box-shadow:0 30px 70px -20px rgba(8,20,40,.6);overflow:hidden;font:500 13px/1.45 Manrope,system-ui,sans-serif;color:light-dark(#0f1b2d, oklch(91.2% 0.028 258.3));transform:translateY(10px) scale(.98);transition:transform .24s cubic-bezier(.22,1,.36,1)}',
    '#vp-drill-scrim.on #vp-drill{transform:none}',
    '#vp-drill .top{display:flex;align-items:center;gap:8px;padding:9px 18px;background:light-dark(#eef3ff, oklch(18.4% 0.01 267.8));border-bottom:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7));font-size:12px;color:#5a6b82}',
    '#vp-drill .top a{margin-left:auto;font-weight:800;font-size:12.5px;color:#2e5cff;text-decoration:none;white-space:nowrap}',
    '#vp-drill .hd{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7))}',
    '#vp-drill .hd b{flex:1;font:700 15px Manrope;color:light-dark(#0f2a4a, oklch(88.7% 0.047 254.4))}',
    '#vp-drill .hd small{display:block;font:500 12px Manrope;color:#5a6b82}',
    '#vp-drill .x{width:32px;height:32px;border-radius:6px;border:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7));background:light-dark(#fff, oklch(13% 0 89.9));color:#5a6b82;cursor:pointer;font-size:18px;line-height:1}',
    '#vp-drill .tabs{display:flex;gap:2px;margin:14px 18px 0;padding:2px;border-radius:8px;background:light-dark(#f1f4f8, oklch(18.1% 0.006 255.5));box-shadow:inset 0 0 0 1px #e3e8ef}',
    '#vp-drill .tabs button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:30px;border:0;border-radius:6px;background:none;font:600 12px Manrope;color:#5a6b82;cursor:pointer;white-space:nowrap}',
    '#vp-drill .tabs button i{width:8px;height:8px;border-radius:2px;display:inline-block}',
    '#vp-drill .tabs button span{font:600 11px "IBM Plex Mono",monospace;opacity:.75}',
    '#vp-drill .tabs button[aria-selected=true]{background:#0f2a4a;color:#fff}',
    '#vp-drill .list{flex:1;min-height:0;overflow:auto;padding:8px 18px 6px;scrollbar-width:none}',
    '#vp-drill .list::-webkit-scrollbar{display:none}',
    '#vp-drill .r{display:grid;grid-template-columns:minmax(0,1fr) auto auto 16px;align-items:center;gap:12px;padding:9px 10px;margin:0 -10px;border-radius:6px;cursor:pointer;color:inherit;text-decoration:none}',
    '#vp-drill .r:hover{background:light-dark(#f5f7fa, oklch(16.7% 0.005 258.3))}',
    '#vp-drill .r b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#vp-drill .r em{font:500 12px "IBM Plex Mono",monospace;font-style:normal;color:#5a6b82;white-space:nowrap}',
    '#vp-drill .r .c{font:700 11px Manrope;padding:2px 7px;border-radius:4px;color:#fff;white-space:nowrap}',
    '#vp-drill .r .a{color:#2e5cff}',
    '#vp-drill .ft{padding:10px 18px;border-top:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7));background:light-dark(#f5f7fa, oklch(16.7% 0.005 258.3));font-size:12px;color:#5a6b82}',
    '@media (max-width:700px){#vp-drill-scrim{align-items:flex-end;padding:0}#vp-drill{width:100%;border-radius:14px 14px 0 0;max-height:86vh}}'
  ].join('\n');
  document.head.appendChild(dcss);
  function drill(cfg) {
    var old = document.getElementById('vp-drill-scrim'); if (old) old.remove();
    var tab = cfg.active || 0, last = document.activeElement;
    var sc = document.createElement('div'); sc.id = 'vp-drill-scrim';
    sc.innerHTML = '<div id="vp-drill" role="dialog" aria-modal="true" aria-labelledby="vp-drill-t">' +
      (cfg.link ? '<div class="top"><span>' + cfg.link.lead + '</span><a href="#" data-dlink>' + cfg.link.text + '</a></div>' : '') +
      '<div class="hd"><b id="vp-drill-t">' + cfg.title + (cfg.sub ? '<small>' + cfg.sub + '</small>' : '') + '</b><button type="button" class="x" aria-label="Close">×</button></div>' +
      '<div class="tabs" role="tablist"></div><div class="list"></div><div class="ft"></div></div>';
    document.body.appendChild(sc); requestAnimationFrame(function () { sc.classList.add('on'); });
    function paint() {
      sc.querySelector('.tabs').innerHTML = cfg.tabs.map(function (t, i) { return '<button type="button" role="tab" aria-selected="' + (i === tab) + '" data-t="' + i + '">' + (t.color ? '<i style="background:' + t.color + '"></i>' : '') + t.label + '<span>' + (t.n != null ? t.n : t.rows.length) + '</span></button>'; }).join('');
      var t = cfg.tabs[tab], rows = t.rows;
      sc.querySelector('.list').innerHTML = rows.length ? rows.map(function (r, i) { return '<a href="#" class="r" data-r="' + i + '"><b>' + r[0] + '</b><em>' + (r[1] || '') + '</em>' + (r[2] ? '<span class="c" style="background:' + (r[3] || '#5a6b82') + '">' + r[2] + '</span>' : '<span></span>') + '<span class="a">→</span></a>'; }).join('') : '<div style="padding:16px 0;color:#5a6b82">Nothing here.</div>';
      var total = t.n != null ? t.n : rows.length;
      sc.querySelector('.ft').textContent = rows.length < total ? 'Showing ' + rows.length + ' of ' + total + ' · the full list is in ' + (cfg.link ? cfg.link.where || 'the app' : 'the app') : 'Showing all ' + total;
    }
    function close() { document.removeEventListener('keydown', key, true); sc.classList.remove('on'); setTimeout(function () { sc.remove(); }, reduce ? 0 : 160); last && last.focus && last.focus({ preventScroll: true }); }
    function key(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', key, true);
    sc.addEventListener('click', function (e) {
      e.stopPropagation();
      if (e.target === sc || e.target.closest('.x')) { e.preventDefault(); return close(); }
      var b = e.target.closest('[data-t]'); if (b) { tab = +b.getAttribute('data-t'); paint(); return; }
      if (e.target.closest('[data-dlink]')) { e.preventDefault(); close(); if (cfg.link.go) go(cfg.link.go); else if (cfg.link.onClick) cfg.link.onClick(); return; }
      var r = e.target.closest('[data-r]'); if (r) { e.preventDefault(); var row = cfg.tabs[tab].rows[+r.getAttribute('data-r')]; close(); if (row[4]) go(row[4]); else toast('Opening ' + row[0] + '…'); }
    });
    paint(); setTimeout(function () { var f = sc.querySelector('.x'); f && f.focus({ preventScroll: true }); }, 40);
  }
  window.vcfoDrill = drill;
```

## 3.3 Documents — states boards

### Loading skeleton

#### Skeleton CSS — `s/docs/docs_a_loading.dc.html:13-20` (verbatim)

```css
<style>
body{margin:0;-webkit-font-smoothing:antialiased}
:root{--bg:oklch(97.4% 0.006 255);--panel:oklch(100% 0 0);--raised:oklch(96.6% 0.007 255);--border:oklch(92.2% 0.011 255);--hair:oklch(94.8% 0.007 255);--fg:oklch(21% 0.042 264);--navy:#0f2a4a;--sk:oklch(93.5% 0.008 255);--shadow:0 1px 2px oklch(25% 0.04 264 / 0.04), 0 6px 18px -10px oklch(28% 0.06 264 / 0.18)}
@keyframes sh{0%{background-position:-300px 0}100%{background-position:300px 0}}
.sk{display:block;border-radius:4px;background:linear-gradient(90deg,var(--sk) 0,light-dark(oklch(96.5% 0.006 255), oklch(18.3% 0.006 255)) 40%,var(--sk) 80%) var(--sk);background-size:600px 100%;animation:sh 1.3s linear infinite}
.r{display:flex;align-items:center;gap:8px;height:36px;padding:0 12px}
@media (prefers-reduced-motion: reduce){.sk{animation:none}}
</style>
```

#### Skeleton markup — `s/docs/docs_a_loading.dc.html:22-54` (verbatim)

```html
<div style="position:relative;width:1440px;height:1000px;display:flex;background:var(--bg);font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
  <div style="width:248px;flex:none;background:#0f2a4a"><dc-import name="side" active="4" hint-size="248px,900px" style="display:block;width:248px"></dc-import></div>
  <div style="flex:1;min-width:0;display:flex;flex-direction:column">
    <dc-import name="topbar" trail="Documents" hint-size="100%,52px" style="display:block"></dc-import>
    <main style="flex:1;min-height:0;padding:20px 24px 24px;display:flex;flex-direction:column;gap:14px" aria-busy="true">
      <div style="display:flex;align-items:center;gap:8px;height:32px"><h1 style="margin:0;font:700 22px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">Documents</h1></div>
      <section aria-label="Loading documents" style="flex:1;min-height:0;background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow);display:flex;flex-direction:column">
        <div style="display:flex;align-items:center;gap:8px;height:52px;padding:0 12px;border-bottom:1px solid var(--border)"><span class="sk" style="width:300px;height:32px;border-radius:6px"></span><span class="sk" style="width:84px;height:32px;border-radius:6px"></span><span class="sk" style="width:96px;height:32px;border-radius:6px"></span><span class="sk" style="width:220px;height:32px;border-radius:8px"></span><span style="flex:1"></span><span class="sk" style="width:170px;height:32px;border-radius:6px"></span></div>
        <div style="flex:1;display:flex">
          <div style="width:420px;border-right:1px solid var(--border);padding:6px 0">
            <div class="r"><span class="sk" style="width:16px;height:16px"></span><span class="sk" style="width:210px;height:10px"></span></div>
            <div class="r" style="padding-left:36px"><span class="sk" style="width:16px;height:16px"></span><span class="sk" style="width:170px;height:10px"></span><span style="flex:1"></span><span class="sk" style="width:56px;height:4px"></span></div>
            <div class="r" style="padding-left:60px"><span class="sk" style="width:22px;height:16px;border-radius:3px"></span><span class="sk" style="width:190px;height:10px"></span></div>
            <div class="r" style="padding-left:60px"><span class="sk" style="width:22px;height:16px;border-radius:3px"></span><span class="sk" style="width:150px;height:10px"></span></div>
            <div class="r"><span class="sk" style="width:16px;height:16px"></span><span class="sk" style="width:190px;height:10px"></span></div>
            <div class="r" style="padding-left:36px"><span class="sk" style="width:16px;height:16px"></span><span class="sk" style="width:140px;height:10px"></span><span style="flex:1"></span><span class="sk" style="width:56px;height:4px"></span></div>
            <div class="r" style="padding-left:60px"><span class="sk" style="width:22px;height:16px;border-radius:3px"></span><span class="sk" style="width:200px;height:10px"></span></div>
            <div class="r" style="padding-left:60px"><span class="sk" style="width:22px;height:16px;border-radius:3px"></span><span class="sk" style="width:160px;height:10px"></span></div>
            <div class="r" style="padding-left:60px"><span class="sk" style="width:22px;height:16px;border-radius:3px"></span><span class="sk" style="width:180px;height:10px"></span></div>
            <div class="r" style="padding-left:36px"><span class="sk" style="width:16px;height:16px"></span><span class="sk" style="width:180px;height:10px"></span><span style="flex:1"></span><span class="sk" style="width:56px;height:4px"></span></div>
            <div class="r"><span class="sk" style="width:16px;height:16px"></span><span class="sk" style="width:220px;height:10px"></span></div>
          </div>
          <div style="flex:1;display:flex;flex-direction:column">
            <div style="display:flex;align-items:center;gap:8px;height:52px;padding:0 16px;border-bottom:1px solid var(--border)"><span class="sk" style="width:26px;height:20px"></span><span class="sk" style="width:240px;height:12px"></span><span style="flex:1"></span><span class="sk" style="width:32px;height:32px;border-radius:6px"></span><span class="sk" style="width:32px;height:32px;border-radius:6px"></span></div>
            <div style="flex:1;background:var(--raised);display:flex;align-items:center;justify-content:center"><span class="sk" style="width:340px;height:440px;border-radius:2px"></span></div>
            <div style="height:36px;border-top:1px solid var(--hair);display:flex;align-items:center;justify-content:space-between;padding:0 16px"><span class="sk" style="width:60px;height:10px"></span><span class="sk" style="width:180px;height:10px"></span></div>
            <div style="height:36px;border-top:1px solid var(--hair);display:flex;align-items:center;justify-content:space-between;padding:0 16px"><span class="sk" style="width:50px;height:10px"></span><span class="sk" style="width:120px;height:10px"></span></div>
          </div>
        </div>
      </section>
    </main>
  </div>
</div>
```

### Empty

#### Empty CSS — `s/docs/docs_a_empty.dc.html:13-25` (verbatim)

```css
<style>
body{margin:0;-webkit-font-smoothing:antialiased}
:root{--bg:oklch(97.4% 0.006 255);--panel:oklch(100% 0 0);--raised:oklch(96.6% 0.007 255);--border:oklch(92.2% 0.011 255);--hair:oklch(94.8% 0.007 255);--fg:oklch(21% 0.042 264);--muted:oklch(46% 0.028 258);--subtle:oklch(55% 0.022 255);--primary:oklch(54.6% 0.215 263);--navy:#0f2a4a;--navy-2:#17396b;--gold:#c9a24b;--due:oklch(66% 0.17 48);--shadow:0 1px 2px oklch(25% 0.04 264 / 0.04), 0 6px 18px -10px oklch(28% 0.06 264 / 0.18)}
a{color:var(--primary);text-decoration:none;font-weight:700}
.mono{font-family:"IBM Plex Mono",monospace}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:32px;padding:0 12px;border-radius:6px;font:600 12.5px Manrope,sans-serif;border:1px solid transparent;text-decoration:none;white-space:nowrap;box-sizing:border-box}
.btn-n{background:var(--navy);color:#fff}.btn-o{background:var(--panel);color:var(--fg);border-color:var(--border)}
.r{display:flex;align-items:center;gap:8px;height:36px;padding:0 12px;color:var(--subtle);font-weight:600}
.trk{width:56px;height:4px;border-radius:2px;background:var(--hair)}
@keyframes fl{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.fl{animation:fl 3s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.fl{animation:none}}
</style>
```

#### Empty markup — `s/docs/docs_a_empty.dc.html:27-50` (verbatim)

```html
<div style="position:relative;width:1440px;height:1000px;display:flex;background:var(--bg);font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
  <div style="width:248px;flex:none;background:#0f2a4a"><dc-import name="side" active="4" hint-size="248px,900px" style="display:block;width:248px"></dc-import></div>
  <div style="flex:1;min-width:0;display:flex;flex-direction:column">
    <dc-import name="topbar" trail="Documents" hint-size="100%,52px" style="display:block"></dc-import>
    <main style="flex:1;min-height:0;padding:20px 24px 24px;display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;align-items:center;gap:8px;height:32px"><h1 style="margin:0;font:700 22px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">Documents</h1><span style="flex:1"></span><a class="btn btn-n" href="docs_upload.dc.html">Upload</a></div>
      <section aria-label="Document explorer" style="flex:1;min-height:0;background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow);display:flex;flex-direction:column">
        <div style="display:flex;align-items:center;gap:8px;height:52px;padding:0 12px;border-bottom:1px solid var(--border);opacity:.5"><span style="width:300px;height:32px;border-radius:6px;border:1px solid var(--border);display:flex;align-items:center;padding:0 10px;box-sizing:border-box;color:var(--subtle)">Filter documents<span class="mono" style="margin-left:auto;font-size:11px">0/0</span></span></div>
        <div style="flex:1;display:flex">
          <div style="width:420px;border-right:1px solid var(--border);padding:6px 0">
            <div class="r"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18.5V5.5A1.5 1.5 0 0 1 4.5 4h4.2l2 2.4h8.8A1.5 1.5 0 0 1 21 7.9v10.6a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z" fill="#0f2a4a" fill-opacity=".3"></path></svg><span style="flex:1">Phase 1 — Name application</span><span class="mono" style="font-size:11px">0</span></div>
            <div class="r"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18.5V5.5A1.5 1.5 0 0 1 4.5 4h4.2l2 2.4h8.8A1.5 1.5 0 0 1 21 7.9v10.6a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z" fill="#0f2a4a" fill-opacity=".3"></path></svg><span style="flex:1">Phase 2 — Incorporation</span><span class="mono" style="font-size:11px">0</span></div>
            <div class="r"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18.5V5.5A1.5 1.5 0 0 1 4.5 4h4.2l2 2.4h8.8A1.5 1.5 0 0 1 21 7.9v10.6a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z" fill="#0f2a4a" fill-opacity=".3"></path></svg><span style="flex:1">Phase 3 — Post-incorporation</span><span class="mono" style="font-size:11px">0</span></div>
          </div>
          <div style="flex:1;background:var(--raised);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center">
            <div role="status" style="display:flex;align-items:flex-end;gap:10px;justify-content:center;text-align:left"><dc-import name="v7c_bot" state="idle" size="56" hint-size="56px,56px"></dc-import><div style="position:relative;max-width:320px;padding:10px 14px;border-radius:10px 10px 10px 2px;background:var(--panel);border:1px solid var(--border);box-shadow:0 8px 20px -12px oklch(21% 0.042 264 / .35);display:flex;flex-direction:column;align-items:flex-start"><span style="font:600 13px/1.45 Manrope,sans-serif;color:var(--fg)">No documents yet. Northwind’s files will appear here as each step is done.</span><a href="#" style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;font-size:12px;font-weight:700;color:var(--primary)">Ask VCFO why</a></div></div>
            <div style="display:flex;gap:8px"><a class="btn btn-n" href="docs_upload.dc.html">Upload a document</a><a class="btn btn-o" href="#">Open incorporation</a></div>
            
          </div>
        </div>
      </section>
    </main>
  </div>
</div>
```

### Menus + ZIP toast states board

#### States board (two instances of docs_a_refined with init-menu / init-toast props) — `s/docs/docs_a_states.dc.html:14-17` (verbatim)

```html
<div style="width:2960px;height:1000px;display:flex;gap:80px;background:light-dark(oklch(97.4% 0.006 255), oklch(16.9% 0.006 255));font-family:Manrope,system-ui,sans-serif;color:light-dark(oklch(21% 0.042 264), oklch(91.6% 0.029 264))">
  <div style="width:1440px;height:1000px;flex:none" aria-label="Folder menu open, ZIP preparing"><dc-import name="docs_a_refined" init-menu="s6" init-toast="preparing" hint-size="1440px,1000px"></dc-import></div>
  <div style="width:1440px;height:1000px;flex:none" aria-label="File menu open, ZIP done"><dc-import name="docs_a_refined" init-menu="f9" init-toast="done" hint-size="1440px,1000px"></dc-import></div>
</div>
```

## 3.4 Documents — phone (≤767 / router "Mobile 390")

#### Phone stylesheet — `s/docs/docs_a_mobile.dc.html:14-44` (verbatim)

```css
<style>
body{margin:0;-webkit-font-smoothing:antialiased}
:root{--bg:oklch(97.4% 0.006 255);--panel:oklch(100% 0 0);--raised:oklch(96.6% 0.007 255);--border:oklch(92.2% 0.011 255);--hair:oklch(94.8% 0.007 255);--fg:oklch(21% 0.042 264);--muted:oklch(46% 0.028 258);--subtle:oklch(55% 0.022 255);--primary:oklch(54.6% 0.215 263);--primary-light:oklch(96.6% 0.02 260);--navy:#0f2a4a;--navy-2:#17396b;--gold:#c9a24b;
--ok:oklch(56% 0.13 168);--ok-light:oklch(96% 0.028 170);--ok-text:oklch(39% 0.09 172);--ok-chip:oklch(50% 0.12 168);--due:oklch(66% 0.17 48);--due-chip:oklch(55% 0.17 42);--due-text:oklch(48% 0.14 42);--prog:oklch(55% 0.16 252);--prog-light:oklch(96% 0.026 250);--prog-text:oklch(43% 0.13 254);--prog-chip:oklch(51% 0.17 252);--over-chip:oklch(52% 0.2 22);--teal-chip:oklch(47% 0.09 195);
--shadow:0 1px 2px oklch(25% 0.04 264 / 0.04), 0 6px 18px -10px oklch(28% 0.06 264 / 0.18)}
a{color:var(--primary);text-decoration:none;font-weight:700}
.mono{font-family:"IBM Plex Mono",monospace;font-feature-settings:"tnum"}
.badge{display:inline-flex;align-items:center;height:20px;border-radius:4px;padding:0 7px;font-size:11px;font-weight:700;white-space:nowrap}
.tbb{width:44px;height:44px;border-radius:6px;border:0;background:none;color:var(--muted);display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer}
.row{display:flex;align-items:center;min-height:56px;border-top:1px solid var(--hair)}
.row:first-child{border-top:0}
.row .main{flex:1;min-width:0;min-height:56px;display:flex;align-items:center;gap:10px;padding:0 0 0 14px;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer}
.row .main:active{background:var(--raised)}
.ft{font:700 11px/18px "IBM Plex Mono",monospace;min-width:32px;height:18px;padding:0 3px;box-sizing:border-box;border-radius:3px;color:#fff;text-align:center;flex:none}
.trk{display:flex;gap:1px;width:64px;height:4px;border-radius:2px;overflow:hidden;background:var(--hair)}
.kb{width:44px;height:44px;border:0;background:none;color:var(--muted);display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;border-radius:6px}
.sheet button{display:flex;align-items:center;gap:12px;width:100%;height:52px;padding:0 20px;border:0;background:none;font:600 14px Manrope,sans-serif;color:var(--fg);text-align:left;cursor:pointer}
.sheet button:active{background:var(--primary-light)}
@keyframes up{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
.sheet{animation:up .25s cubic-bezier(.22,1,.36,1) both}
@keyframes sl{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}
.lvl{animation:sl .2s cubic-bezier(.22,1,.36,1) both}
button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid oklch(54.6% 0.215 263 / .5);outline-offset:-2px}
@media (prefers-reduced-motion: reduce){.sheet,.lvl{animation:none}}
/* "One shape": every mark in the tree is the same 20px rounded square */
.ft{width:20px;min-width:20px;height:20px;padding:0;border-radius:6px;font:700 7px/20px "IBM Plex Mono",monospace;letter-spacing:-.02em}
.sg{width:20px;height:20px;border-radius:6px}
.ico:has(.fold){width:20px;height:20px;border-radius:6px;background:light-dark(oklch(94.5% 0.015 255), oklch(21.3% 0.01 255))}
.ico:has(.fold) .fold{width:12px;height:12px}
.ico>span{width:20px!important;height:20px!important;border-radius:6px!important}
</style>
```

#### Phone markup (header, back row, filter, list, action sheet, toast) — `s/docs/docs_a_mobile.dc.html:46-97` (verbatim)

```html
<div style="position:relative;width:100%;height:100vh;height:100dvh;min-height:520px;overflow:hidden;background:var(--bg);font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px;display:flex;flex-direction:column">
  <header style="height:56px;flex:none;display:flex;align-items:center;gap:4px;padding:0 6px;background:var(--panel);border-bottom:1px solid var(--border)">
    <button type="button" class="tbb" data-vp-menu aria-label="Open menu"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"></path></svg></button>
    <img src="vcfo-bin:b/58380a4992a06cfe5c18a947b721abdf.png" alt="SBC" style="height:24px;width:auto">
    <span style="flex:1"></span>
    <button type="button" class="tbb" aria-label="Notifications, 3 new" style="color:var(--primary)"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4.5 1.8 6.5 1.8 6.5H4.7S6.5 14.5 6.5 10Z M10 19.5a2.2 2.2 0 0 0 4 0"></path></svg></button>
  </header>
  <div style="padding:12px 16px 0;display:flex;flex-direction:column;gap:10px;flex:none">
    <sc-if value="{{canBack}}" hint-placeholder-val="{{false}}"><div style="display:flex;align-items:center;gap:4px;min-height:44px">
      <sc-if value="{{canBack}}" hint-placeholder-val="{{false}}"><button type="button" class="tbb" aria-label="Back to {{backLabel}}" onClick="{{back}}" style="margin-left:-10px;color:var(--navy-ink,var(--navy))"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 6l-6 6 6 6"></path></svg></button></sc-if>
      <div style="flex:1;min-width:0"><sc-if value="{{canBack}}" hint-placeholder-val="{{false}}"><div class="mono" style="font-size:11px;color:var(--subtle);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{crumb}}</div></sc-if><h1 style="margin:0;font:700 19px/1.2 Manrope,sans-serif;color:var(--navy-ink,var(--navy));white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{title}}</h1></div>
    </div></sc-if>
    <div style="display:flex;align-items:center;gap:8px">
      <label style="display:flex;align-items:center;gap:8px;height:44px;flex:1;min-width:0;padding:0 12px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--subtle)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M16 16l4 4"></path></svg><input type="search" aria-label="Filter documents" placeholder="Filter documents" style="flex:1;min-width:0;border:0;outline:0;background:none;font:500 14px Manrope,sans-serif"><span class="mono" style="font-size:11px">14/16</span></label>
      <button type="button" class="kb" style="border:1px solid var(--border);background:var(--panel);color:var(--muted);border-radius:6px" aria-label="More actions for {{title}}" aria-haspopup="menu" onClick="{{openHere}}"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5.5" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="12" cy="18.5" r="1.8"></circle></svg></button>
    </div>
  </div>
  <div style="flex:1;min-height:0;overflow:auto;padding:12px 16px 16px">
    <div class="lvl" role="list" style="background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow)">
      <sc-for list="{{rows}}" as="r" hint-placeholder-count="5">
        <div class="row" role="listitem">
          <button type="button" class="main" onClick="{{r.tap}}">
            <sc-if value="{{r.folder}}" hint-placeholder-val="{{true}}"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style="flex:none"><path d="M3 18.5V5.5A1.5 1.5 0 0 1 4.5 4h4.2l2 2.4h8.8A1.5 1.5 0 0 1 21 7.9v10.6a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z" fill="#0f2a4a"></path><path d="M3 9.2h18" stroke="oklch(100% 0 0 / .35)" stroke-width="1.3"></path></svg></sc-if>
            <sc-if value="{{r.file}}" hint-placeholder-val="{{false}}"><span class="ft" style="{{r.tStyle}}">{{r.type}}</span></sc-if>
            <sc-if value="{{r.missing}}" hint-placeholder-val="{{false}}"><span style="width:24px;display:flex;justify-content:center;flex:none"><span style="width:16px;height:16px;border-radius:3px;border:1.5px dashed var(--due);box-sizing:border-box"></span></span></sc-if>
            <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
              <span style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{r.label}}</span>
              <sc-if value="{{r.hasBar}}" hint-placeholder-val="{{false}}"><span style="display:flex;align-items:center;gap:8px"><span class="trk"><span style="background:var(--ok);{{r.wOk}}"></span><span style="background:var(--prog);{{r.wRv}}"></span><span style="background:var(--due);{{r.wMs}}"></span></span><span class="mono" style="font-size:11px;color:var(--subtle)">{{r.frac}}</span></span></sc-if>
              <sc-if value="{{r.hasBadge}}" hint-placeholder-val="{{false}}"><span style="display:flex;align-items:center;gap:6px"><span class="badge" style="{{r.stStyle}}">{{r.status}}</span><span class="mono" style="font-size:11px;color:var(--subtle)">{{r.date}}</span></span></sc-if>
            </span>
            <sc-if value="{{r.folder}}" hint-placeholder-val="{{true}}"><span class="mono" style="font-size:11px;color:var(--subtle)">{{r.cnt}}</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--subtle)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg></sc-if>
          </button>
          <button type="button" class="kb" aria-label="More actions for {{r.label}}" aria-haspopup="menu" onClick="{{r.menu}}"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5.5" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="12" cy="18.5" r="1.8"></circle></svg></button>
        </div>
      </sc-for>
    </div>
  </div>
  <sc-if value="{{sheetOn}}" hint-placeholder-val="{{false}}">
    <button type="button" aria-label="Close menu" onClick="{{closeSheet}}" style="position:absolute;inset:0;border:0;padding:0;background:oklch(20% 0.05 258 / .45);cursor:default"></button>
    <div class="sheet" role="menu" aria-label="Actions for {{sheetTitle}}" style="position:absolute;left:0;right:0;bottom:0;background:var(--panel);border-radius:12px 12px 0 0;padding:8px 0 76px;max-height:calc(100% - 24px);overflow:auto;box-sizing:border-box;box-shadow:0 -16px 40px -20px oklch(15% 0.05 258 / .5)">
      <div style="display:flex;justify-content:center;padding-bottom:6px"><span style="width:40px;height:4px;border-radius:2px;background:var(--border)"></span></div>
      <div style="padding:6px 20px 10px;font:700 14px Manrope,sans-serif;color:var(--navy-ink,var(--navy));border-bottom:1px solid var(--hair)">{{sheetTitle}}</div>
      <sc-for list="{{sheetItems}}" as="m" hint-placeholder-count="4"><button type="button" role="menuitem" onClick="{{m.act}}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color:var(--navy-ink,var(--navy))"><path d="{{m.icon}}"></path></svg>{{m.label}}<span class="mono" style="margin-left:auto;font-size:11px;color:var(--subtle)">{{m.k}}</span></button></sc-for>
    </div>
  </sc-if>
  <sc-if value="{{toastOn}}" hint-placeholder-val="{{false}}">
    <div role="status" style="position:absolute;left:16px;right:16px;bottom:20px;padding:10px 12px;border-radius:8px;background:var(--navy);color:#fff;display:flex;flex-direction:column;gap:8px;box-shadow:0 18px 40px -14px oklch(15% 0.05 258 / .65)">
      <div style="display:flex;align-items:center;gap:10px"><span style="flex:1;font-size:13px;font-weight:700">{{toastText}}</span><span class="mono" style="font-size:11px;opacity:.75">{{toastCount}}</span></div>
      <sc-if value="{{toastBusy}}" hint-placeholder-val="{{true}}"><div style="height:4px;border-radius:2px;background:oklch(100% 0 0 / .18);overflow:hidden"><span style="display:block;height:100%;background:var(--gold);{{toastW}}"></span></div></sc-if>
    </div>
  </sc-if>
</div>
```

#### Phone logic (folder tree F, drill path, sheet items incl. Take photo, ZIP) — `s/docs/docs_a_mobile.dc.html:100-153` (verbatim)

```js
class Component extends DCLogic {
  constructor(p) { super(p); const on = !!(p && p.initSheet && p.initSheet !== 'false'); this.state = { path: on ? ['p2', 's6'] : [], sheet: on ? 's6' : '', toast: null }; }
  componentDidMount() { const v = this.props && this.props.initSheet; if (v && v !== 'false' && !this.state.sheet) this.setState({ path: ['p2', 's6'], sheet: 's6' }); }
  componentWillUnmount() { if (this.timer) clearInterval(this.timer); }
  zip(name, total) {
    if (this.timer) clearInterval(this.timer);
    let n = 0; this.setState({ sheet: '', toast: { name, total, n: 0 } });
    this.timer = setInterval(() => { n++; if (n >= total) { clearInterval(this.timer); this.timer = null; } this.setState({ toast: { name, total, n: Math.min(n, total) } }); }, 260);
  }
  renderVals() {
    const s = this.state || {};
    const F = { root: { label: 'Documents', kids: ['p1', 'p2', 'p3'] },
      p1: { label: 'Phase 1 — Name application', kids: ['s3'] }, p2: { label: 'Phase 2 — Incorporation', kids: ['s6', 's8', 's17'] }, p3: { label: 'Phase 3 — Post-incorporation', kids: ['s21', 's22'] },
      s3: { label: '3 · Signed Board Resolution', files: [['Board resolution (final)', 'PDF', 'Final', '18 Sep']] },
      s6: { label: '6 · Director KYC', files: [['PAN card — Ravi Kumar', 'PDF', 'Approved', '14 Sep'], ['Passport — Meera Shah', 'PDF', 'Approved', '14 Sep'], ['Address proof — Ravi Kumar', 'PDF', 'Approved', '15 Sep'], ['Photograph — Meera Shah', 'JPG', 'Approved', '15 Sep'], ['Signed DIR-2 — Meera Shah', '', 'Missing', 'Due 12 Nov']] },
      s8: { label: '8 · Registered Office Address', files: [['Utility bill — office', 'PDF', 'Approved', '22 Sep'], ['Rent agreement', 'DOCX', 'Approved', '23 Sep'], ['Notarised lease deed', '', 'Missing', 'Overdue']] },
      s17: { label: '17 · Certificate of Incorporation', files: [['Certificate of Incorporation', 'PDF', 'Final', '24 Oct'], ['MoA and AoA (stamped)', 'PDF', 'Final', '24 Oct']] },
      s21: { label: '21 · Share Capital Infusion', files: [['FIRC from the bank', 'PDF', 'Approved', '2 Nov'], ['Bank statement — Oct 2026', 'PDF', 'Approved', '3 Nov']] },
      s22: { label: '22 · Share Certificates (SH-1)', files: [['Apostilled parent COI', 'PDF', 'In review', '6 Nov'], ['Share certificates SH-1', 'PDF', 'Final', '7 Nov']] } };
    const allFiles = (id) => F[id].files ? F[id].files : F[id].kids.reduce((a, k) => a.concat(allFiles(k)), []);
    const c = (st) => (st === 'Approved' || st === 'Final') ? 0 : st === 'In review' ? 1 : 2;
    const TS = { PDF: 'background:var(--over-light);color:var(--over-text)', JPG: 'background:var(--teal-light);color:var(--teal-chip)', DOCX: 'background:var(--prog-light);color:var(--prog-text)' };
    const ST = { Approved: 'background:var(--ok-light);color:var(--ok-text)', Final: 'background:var(--navy);color:#fff', 'In review': 'background:var(--prog-light);color:var(--prog-text)', Missing: 'background:var(--due-chip);color:#fff' };
    const path = s.path || []; const cur = path.length ? path[path.length - 1] : 'root';
    const node = F[cur];
    let rows;
    if (node.files) {
      rows = node.files.map((f, i) => ({ folder: false, file: f[2] !== 'Missing', missing: f[2] === 'Missing', label: f[0], type: f[1], tStyle: TS[f[1]] || '', hasBadge: true, status: f[2], stStyle: ST[f[2]], date: f[3], hasBar: false, tap: () => {}, menu: () => this.setState({ sheet: cur + ':' + i }) }));
    } else {
      rows = node.kids.map((k) => { const fs = allFiles(k); const ok = fs.filter((f) => c(f[2]) === 0).length, rv = fs.filter((f) => c(f[2]) === 1).length, ms = fs.length - ok - rv; const step = !!F[k].files; return { folder: true, file: false, missing: false, label: F[k].label, cnt: step ? '' : fs.length, hasBar: step, hasBadge: false, frac: ok + '/' + fs.length, wOk: 'width:' + (ok / fs.length * 100) + '%', wRv: 'width:' + (rv / fs.length * 100) + '%', wMs: 'width:' + (ms / fs.length * 100) + '%', tap: () => this.setState({ path: path.concat([k]) }), menu: () => this.setState({ sheet: k }) }; });
    }
    const I = { zip: 'M6 3.5h8l4 4v13H6Z M10 3.5v2 M10 7.5v2 M10 11.5v2 M9 16h2v3H9Z', dl: 'M12 4v11 M7.5 10.5 12 15l4.5-4.5 M5 19.5h14', eye: 'M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z', step: 'M4.5 4.5h15v15h-15Z M9 12h6 M12 9l3 3-3 3', link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1', up: 'M12 15V4 M7.5 8.5 12 4l4.5 4.5 M5 19.5h14' };
    let sheetTitle = '', sheetItems = [];
    const close = () => this.setState({ sheet: '' });
    if (s.sheet) {
      if (s.sheet.indexOf(':') > 0) {
        const [sid, idx] = s.sheet.split(':'); const f = F[sid].files[+idx]; sheetTitle = f[0];
        sheetItems = f[2] === 'Missing' ? [{ label: 'Take photo', icon: 'M4.5 8.5h3l1.5-2h6l1.5 2h3v10h-15Z M12 10.5a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z', act: close }, { label: 'Choose file', icon: I.up, act: close }, { label: 'Open step ' + F[sid].label.split(' · ')[0], icon: I.step, act: close }, { label: 'Copy link', icon: I.link, act: close }]
          : [{ label: 'Download', icon: I.dl, act: close }, { label: 'Preview', icon: I.eye, act: close }, { label: 'Open step ' + F[sid].label.split(' · ')[0], icon: I.step, act: close }, { label: 'Copy link', icon: I.link, act: close }];
      } else {
        const id = s.sheet; const n = allFiles(id).filter((f) => f[2] !== 'Missing').length; sheetTitle = F[id].label;
        sheetItems = [{ label: 'Download folder as ZIP', k: n + ' files', icon: I.zip, act: () => this.zip(F[id].label.replace(/^\d+ · /, '') + '.zip', n) }, { label: 'Copy link to folder', icon: I.link, act: close }];
      }
    }
    const t = s.toast;
    return {
      rows, title: node.label, canBack: path.length > 0, crumb: ['Documents'].concat(path.slice(0, -1).map((p) => F[p].label.split(' — ')[0])).join(' / '),
      backLabel: path.length > 1 ? F[path[path.length - 2]].label : 'Documents', back: () => this.setState({ path: path.slice(0, -1) }),
      openHere: () => this.setState({ sheet: cur }),
      sheetOn: !!s.sheet, sheetTitle, sheetItems, closeSheet: close,
      toastOn: !!t, toastBusy: !!(t && t.n < t.total), toastText: t ? (t.n < t.total ? 'Preparing ' + t.name + '…' : 'Downloaded ' + t.name) : '', toastCount: t ? (t.n < t.total ? t.n + ' of ' + t.total : t.total + ' files') : '', toastW: t ? 'width:' + (t.n / t.total * 100) + '%' : ''
    };
  }
}
```

### 3.4.1 Phone — menu-sheet-open variant (diff vs. drill-down board)

`docs_a_mobile_menu.dc.html` is the same board fixed at 390×844 with the sheet open on "6 · Director KYC". Differences:
```diff
5,6c5
< <meta name="viewport" content="width=device-width, initial-scale=1">
< <title>A refined — mobile drill-down</title>
---
> <title>A refined — mobile menu sheet open</title>
27c26
< .ft{font:700 11px/18px "IBM Plex Mono",monospace;min-width:32px;height:18px;padding:0 3px;box-sizing:border-box;border-radius:3px;color:#fff;text-align:center;flex:none}
---
> .ft{font:700 7.5px/16px "IBM Plex Mono",monospace;width:24px;height:16px;border-radius:3px;color:#fff;text-align:center;flex:none}
46c45
< <div style="position:relative;width:100%;height:100vh;height:100dvh;min-height:520px;overflow:hidden;background:var(--bg);font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px;display:flex;flex-direction:column">
---
> <div style="position:relative;width:390px;height:844px;overflow:hidden;background:var(--bg);font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px;display:flex;flex-direction:column">
48c47
<     <button type="button" class="tbb" data-vp-menu aria-label="Open menu"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"></path></svg></button>
---
>     <button type="button" class="tbb" aria-label="Open menu"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"></path></svg></button>
54c53
<     <sc-if value="{{canBack}}" hint-placeholder-val="{{false}}"><div style="display:flex;align-items:center;gap:4px;min-height:44px">
---
>     <div style="display:flex;align-items:center;gap:4px;min-height:44px">
56,60c55,56
<       <div style="flex:1;min-width:0"><sc-if value="{{canBack}}" hint-placeholder-val="{{false}}"><div class="mono" style="font-size:11px;color:var(--subtle);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{crumb}}</div></sc-if><h1 style="margin:0;font:700 19px/1.2 Manrope,sans-serif;color:var(--navy-ink,var(--navy));white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{title}}</h1></div>
<     </div></sc-if>
<     <div style="display:flex;align-items:center;gap:8px">
<       <label style="display:flex;align-items:center;gap:8px;height:44px;flex:1;min-width:0;padding:0 12px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--subtle)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M16 16l4 4"></path></svg><input type="search" aria-label="Filter documents" placeholder="Filter documents" style="flex:1;min-width:0;border:0;outline:0;background:none;font:500 14px Manrope,sans-serif"><span class="mono" style="font-size:11px">14/16</span></label>
<       <button type="button" class="kb" style="border:1px solid var(--border);background:var(--panel);color:var(--muted);border-radius:6px" aria-label="More actions for {{title}}" aria-haspopup="menu" onClick="{{openHere}}"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5.5" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="12" cy="18.5" r="1.8"></circle></svg></button>
---
>       <div style="flex:1;min-width:0"><sc-if value="{{canBack}}" hint-placeholder-val="{{false}}"><div class="mono" style="font-size:10.5px;color:var(--subtle);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{crumb}}</div></sc-if><h1 style="margin:0;font:700 19px/1.2 Manrope,sans-serif;color:var(--navy-ink,var(--navy));white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{title}}</h1></div>
>       <button type="button" class="kb" aria-label="More actions for {{title}}" aria-haspopup="menu" onClick="{{openHere}}"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5.5" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="12" cy="18.5" r="1.8"></circle></svg></button>
61a58
>     <label style="display:flex;align-items:center;gap:8px;height:44px;padding:0 12px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--subtle)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M16 16l4 4"></path></svg><input type="search" aria-label="Filter documents" placeholder="Filter documents" style="flex:1;min-width:0;border:0;outline:0;background:none;font:500 14px Manrope,sans-serif"><span class="mono" style="font-size:11px">14/16</span></label>
85c82
<     <div class="sheet" role="menu" aria-label="Actions for {{sheetTitle}}" style="position:absolute;left:0;right:0;bottom:0;background:var(--panel);border-radius:12px 12px 0 0;padding:8px 0 76px;max-height:calc(100% - 24px);overflow:auto;box-sizing:border-box;box-shadow:0 -16px 40px -20px oklch(15% 0.05 258 / .5)">
---
>     <div class="sheet" role="menu" aria-label="Actions for {{sheetTitle}}" style="position:absolute;left:0;right:0;bottom:0;background:var(--panel);border-radius:12px 12px 0 0;padding:8px 0 20px;box-shadow:0 -16px 40px -20px oklch(15% 0.05 258 / .5)">
99c96
< <script type="text/x-dc" data-dc-script data-props='{"initSheet":{"editor":"boolean","default":false},"$preview":{"width":390,"height":844}}'>
---
> <script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":844}}'>
101c98
<   constructor(p) { super(p); const on = !!(p && p.initSheet && p.initSheet !== 'false'); this.state = { path: on ? ['p2', 's6'] : [], sheet: on ? 's6' : '', toast: null }; }
---
>   constructor(p) { super(p); const on = true; this.state = { path: on ? ['p2', 's6'] : [], sheet: on ? 's6' : '', toast: null }; }
```

## 3.5 Upload flow specimens

#### Upload stylesheet (drop strip, bar, toast, glow) — `s/docs/docs_upload.dc.html:13-43` (verbatim)

```css
<style>
body{margin:0;-webkit-font-smoothing:antialiased}
:root{--bg:oklch(97.4% 0.006 255);--panel:oklch(100% 0 0);--raised:oklch(96.6% 0.007 255);--border:oklch(92.2% 0.011 255);--hair:oklch(94.8% 0.007 255);--fg:oklch(21% 0.042 264);--muted:oklch(46% 0.028 258);--subtle:oklch(55% 0.022 255);
--primary:oklch(54.6% 0.215 263);--primary-dark:oklch(48.8% 0.217 264);--primary-light:oklch(96.6% 0.02 260);
--navy:#0f2a4a;--navy-2:#17396b;--gold:#c9a24b;--gold-soft:#fbf3df;--gold-text:#6e500f;
--ok:oklch(56% 0.13 168);--ok-light:oklch(96% 0.028 170);--ok-text:oklch(39% 0.09 172);--ok-chip:oklch(50% 0.12 168);
--due:oklch(66% 0.17 48);--due-light:oklch(96.8% 0.04 55);--due-text:oklch(48% 0.14 42);--due-chip:oklch(55% 0.17 42);
--over:oklch(57% 0.2 22);--over-light:oklch(96.4% 0.026 18);--over-text:oklch(46% 0.17 20);--over-chip:oklch(52% 0.2 22);
--prog:oklch(55% 0.16 252);--prog-light:oklch(96% 0.026 250);--prog-text:oklch(43% 0.13 254);
--shadow:0 1px 2px oklch(25% 0.04 264 / 0.04), 0 6px 18px -10px oklch(28% 0.06 264 / 0.18)}
a{color:var(--primary);text-decoration:none;font-weight:700}a:hover{color:var(--primary-dark)}
.card{position:relative;background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow)}
.card.t::before{content:"";position:absolute;left:18px;top:-1px;width:38px;height:3px;border-radius:0 0 3px 3px;background:var(--gold)}
.chip{display:inline-flex;align-items:center;gap:4px;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;line-height:16px;white-space:nowrap}
.lbl{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--navy-ink,var(--navy))}
.cap{font-size:11.5px;color:var(--muted)}
.mono{font-family:"IBM Plex Mono",monospace;font-feature-settings:"tnum"}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:34px;padding:0 12px;border-radius:6px;font:600 12.5px Manrope,sans-serif;border:1px solid transparent;cursor:pointer;white-space:nowrap}
.btn-n{background:var(--navy);color:#fff}.btn-o{background:var(--panel);color:var(--fg);border-color:var(--border)}
.drop{border:1.5px dashed oklch(66% 0.17 48 / .55);border-radius:8px;background:light-dark(oklch(96.8% 0.04 55 / .5), oklch(23.9% 0.106 55 / 0.5));display:flex;align-items:center;gap:10px;padding:10px 12px}
.ttl{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700}
.bar{height:6px;border-radius:3px;background:var(--raised);overflow:hidden}
@keyframes fill{from{width:8%}to{width:64%}}
.bar>span{display:block;height:100%;border-radius:3px;background:var(--navy);width:64%;animation:fill 1.6s cubic-bezier(.2,.7,.2,1) infinite alternate}
@keyframes toast{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.toast{animation:toast .3s cubic-bezier(.22,1,.36,1) .3s both}
@keyframes glow{0%{background:var(--ok-light)}100%{background:var(--panel)}}
.new{animation:glow 2.4s ease-out infinite}
button:focus-visible,a:focus-visible,select:focus-visible{outline:2px solid oklch(54.6% 0.215 263 / .4);outline-offset:2px}
@media (prefers-reduced-motion: reduce){.bar>span,.toast,.new{animation:none}}
</style>
```

#### Upload markup (4 states, dialog, error, re-upload) — `s/docs/docs_upload.dc.html:45-128` (verbatim)

```html
<div style="width:1440px;height:900px;box-sizing:border-box;padding:32px;background:var(--bg);font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px;display:flex;flex-direction:column;gap:28px">
  <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px">
    <div style="display:flex;flex-direction:column;gap:10px">
      <div class="lbl">1 · Waiting</div>
      <section class="card t" style="padding:14px 16px 16px;display:flex;flex-direction:column;gap:8px">
        <div class="ttl">Signed DIR-2 — Meera Shah<span style="flex:1"></span><span class="chip" style="background:var(--due-chip);color:#fff;min-width:116px;justify-content:center">Due 12 Nov</span></div>
        <div class="drop"><span style="width:32px;height:32px;border-radius:99px;background:var(--panel);color:var(--due-text);display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px oklch(66% 0.17 48 / .4)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4 M7.5 8.5 12 4l4.5 4.5 M5 19.5h14"></path></svg></span><span style="font-size:12.5px">Drop the file or <span style="color:var(--primary);font-weight:700">browse</span></span></div>
      </section>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div class="lbl">2 · Dragging a file over</div>
      <section class="card t" style="padding:14px 16px 16px;display:flex;flex-direction:column;gap:8px">
        <div class="ttl">Signed DIR-2 — Meera Shah<span style="flex:1"></span><span class="chip" style="background:var(--due-chip);color:#fff;min-width:116px;justify-content:center">Due 12 Nov</span></div>
        <div class="drop" style="border-style:solid;border-color:var(--navy);background:var(--primary-light);box-shadow:0 0 0 4px oklch(54.6% 0.215 263 / .12);justify-content:center;padding:18px 12px"><span style="width:32px;height:32px;border-radius:99px;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4 M7.5 8.5 12 4l4.5 4.5 M5 19.5h14"></path></svg></span><span style="font-size:13px;font-weight:700;color:var(--navy-ink,var(--navy))">Release to upload</span></div>
      </section>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div class="lbl">3 · Uploading</div>
      <section class="card t" style="padding:14px 16px 16px;display:flex;flex-direction:column;gap:8px">
        <div class="ttl">Signed DIR-2 — Meera Shah<span style="flex:1"></span><span class="chip" style="background:var(--due-chip);color:#fff;min-width:116px;justify-content:center">Due 12 Nov</span></div>
        <div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;align-items:center;gap:8px"><span class="mono" style="font-size:9px;font-weight:600;padding:1px 5px;border-radius:4px;background:var(--over-light);color:var(--over-text)">PDF</span><span style="flex:1;font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">dir2-meera-signed.pdf</span><span class="mono cap">64%</span><button type="button" aria-label="Cancel upload" style="width:24px;height:24px;border-radius:6px;border:0;background:none;color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div>
          <div class="bar"><span></span></div>
        </div>
      </section>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div class="lbl">4 · Done — row moves to the list</div>
      <section class="card" style="overflow:hidden">
        <div class="new" style="display:flex;align-items:center;gap:10px;padding:10px 12px">
          <span style="position:relative;width:28px;height:34px;flex:none;border-radius:4px;background:var(--over-light);box-shadow:inset 0 0 0 1px oklch(57% 0.2 22 / .35)"><span style="position:absolute;left:3px;right:3px;bottom:3px;border-radius:2px;background:var(--over-chip);color:#fff;font:700 7.5px/11px 'IBM Plex Mono',monospace;text-align:center">PDF</span></span>
          <span style="flex:1;font-size:12.5px;font-weight:600">Signed DIR-2 — Meera Shah</span>
          <span class="chip" style="background:var(--prog-light);color:var(--prog-text)">In review</span>
        </div>
      </section>
      <div class="toast" role="status" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:var(--navy);color:#fff;box-shadow:0 12px 28px -12px oklch(15% 0.05 258 / .6)">
        <span style="width:22px;height:22px;border-radius:99px;background:var(--ok-chip);display:flex;align-items:center;justify-content:center;flex:none"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg></span>
        <span style="flex:1;font-size:12.5px;font-weight:600">Sent to Arjun for review</span>
        <button type="button" style="border:0;background:none;color:var(--gold);font:800 12.5px Manrope,sans-serif;cursor:pointer;padding:4px 6px;border-radius:6px">Undo</button>
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:20px;align-items:start">
    <div style="grid-column:span 7;display:flex;flex-direction:column;gap:10px">
      <div class="lbl">Upload button (top right) → small dialog</div>
      <div role="dialog" aria-label="Upload a document" style="background:var(--panel);border-radius:12px;border:1px solid var(--border);box-shadow:0 24px 60px -20px oklch(15% 0.05 258 / 0.4);overflow:hidden">
        <div style="display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border)"><h2 style="margin:0;font:700 15px Manrope,sans-serif;color:var(--navy-ink,var(--navy));flex:1">Upload a document</h2><button type="button" aria-label="Close" style="width:30px;height:30px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:flex;align-items:center;justify-content:center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div>
        <div style="padding:18px;display:flex;flex-direction:column;gap:14px">
          <div style="display:flex;flex-direction:column;gap:6px"><label for="up-for" style="font-size:12px;font-weight:700">For</label>
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">
              <button type="button" style="text-align:left;padding:10px 12px;border-radius:8px;border:2px solid var(--navy);background:var(--primary-light);font:700 12.5px Manrope,sans-serif;color:var(--navy-ink,var(--navy));cursor:pointer">Notarised lease deed<span style="display:block;margin-top:4px"><span class="chip" style="background:var(--over-chip);color:#fff">Overdue</span></span></button>
              <button type="button" style="text-align:left;padding:10px 12px;border-radius:8px;border:1px solid var(--border);background:var(--panel);font:700 12.5px Manrope,sans-serif;color:var(--fg);cursor:pointer">Signed DIR-2 — Meera Shah<span style="display:block;margin-top:4px"><span class="chip" style="background:var(--due-chip);color:#fff;min-width:116px;justify-content:center">Due 12 Nov</span></span></button>
              
            </div>
          </div>
          <div style="border:1.5px dashed oklch(54.6% 0.215 263 / .45);border-radius:10px;background:light-dark(oklch(96.6% 0.02 260 / .5), oklch(24% 0.058 260 / 0.5));padding:28px;display:flex;flex-direction:column;align-items:center;gap:8px">
            <span style="width:44px;height:44px;border-radius:99px;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4 M7.5 8.5 12 4l4.5 4.5 M5 19.5h14"></path></svg></span>
            <span style="font-size:14px;font-weight:700">Drop files here or <a href="#">browse</a></span>
            <span class="mono" style="font-size:11px;color:var(--subtle)">PDF · JPG · PNG · DOCX · up to 10 MB</span>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--border);background:var(--raised)"><button type="button" class="btn btn-o">Cancel</button><button type="button" class="btn btn-n">Upload</button></div>
      </div>
    </div>
    <div style="grid-column:span 5;display:flex;flex-direction:column;gap:10px">
      <div class="lbl">Error — file refused</div>
      <section class="card t" style="padding:14px 16px 16px;display:flex;flex-direction:column;gap:8px">
        <div class="ttl">Notarised lease deed<span style="flex:1"></span><span class="chip" style="background:var(--over-chip);color:#fff">Overdue · 6 Nov</span></div>
        <div role="alert" style="border:1.5px solid oklch(57% 0.2 22 / .5);border-radius:8px;background:var(--over-light);display:flex;align-items:center;gap:10px;padding:10px 12px">
          <span style="width:28px;height:28px;border-radius:99px;background:var(--over-chip);color:#fff;display:flex;align-items:center;justify-content:center;flex:none"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 7v6 M12 16.5h.01"></path></svg></span>
          <span style="flex:1;font-size:12.5px;color:var(--over-text);font-weight:600">lease-deed-scan.heic · this file type can't be opened</span>
          <button type="button" class="btn btn-o" style="height:28px;font-size:12px">Try again</button>
        </div>
      </section>
      <div class="lbl" style="margin-top:12px">Re-upload asked by SBC</div>
      <section class="card t" style="padding:14px 16px 16px;display:flex;flex-direction:column;gap:8px">
        <div class="ttl">Address proof — Ravi Kumar<span style="flex:1"></span><span class="chip" style="background:var(--over-chip);color:#fff">Re-upload</span></div>
        <div style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-radius:6px;background:var(--raised);font-size:12px"><span class="mono" style="font-size:10px;font-weight:700;padding:2px 5px;border-radius:4px;background:var(--navy);color:#fff">AM</span><span>“Bill is older than 2 months. Please send the latest one.”</span></div>
        <div class="drop"><span style="width:32px;height:32px;border-radius:99px;background:var(--panel);color:var(--due-text);display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px oklch(66% 0.17 48 / .4)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4 M7.5 8.5 12 4l4.5 4.5 M5 19.5h14"></path></svg></span><span style="font-size:12.5px">Drop the new file or <span style="color:var(--primary);font-weight:700">browse</span></span></div>
      </section>
    </div>
  </div>
</div>
```

## 3.6 Shared document viewer (overlay)

### 3.6.1 Routed responsive version (`s/home/v7x_doc_viewer.dc.html`) — build this one

#### Viewer stylesheets (shared v7 base + .info pop-over + .tipw + responsive .vh-* layer) — `s/home/v7x_doc_viewer.dc.html:13-223` (verbatim)

```css
<style>
body{margin:0;-webkit-font-smoothing:antialiased}
:root{--bg:oklch(97.4% 0.006 255);--panel:oklch(100% 0 0);--raised:oklch(96.6% 0.007 255);--border:oklch(92.2% 0.011 255);--hair:oklch(94.8% 0.007 255);--fg:oklch(21% 0.042 264);--muted:oklch(46% 0.028 258);--subtle:oklch(55% 0.022 255);
--primary:oklch(54.6% 0.215 263);--primary-dark:oklch(48.8% 0.217 264);--primary-light:oklch(96.6% 0.02 260);--primary-chip:oklch(52% 0.21 263);
--navy:#0f2a4a;--navy-2:#17396b;--navy-3:#1b4f94;--gold:#c9a24b;--gold-soft:#fbf3df;--gold-text:#6e500f;
--ok:oklch(56% 0.13 168);--ok-light:oklch(96% 0.028 170);--ok-text:oklch(39% 0.09 172);--ok-chip:oklch(50% 0.12 168);
--due:oklch(66% 0.17 48);--due-light:oklch(96.8% 0.04 55);--due-text:oklch(48% 0.14 42);--due-chip:oklch(55% 0.17 42);
--over:oklch(57% 0.2 22);--over-light:oklch(96.4% 0.026 18);--over-text:oklch(46% 0.17 20);--over-chip:oklch(52% 0.2 22);
--prog:oklch(55% 0.16 252);--prog-light:oklch(96% 0.026 250);--prog-text:oklch(43% 0.13 254);--prog-chip:oklch(51% 0.17 252);
--up:oklch(82% 0.018 255);--up-light:oklch(96.6% 0.007 255);--up-text:oklch(46% 0.028 258);--up-chip:oklch(54% 0.026 258);
--violet:oklch(54% 0.17 292);--violet-light:oklch(96.4% 0.032 292);--violet-chip:oklch(50% 0.17 292);
--sky:oklch(58% 0.12 228);--sky-light:oklch(96.4% 0.026 228);--sky-chip:oklch(49% 0.12 230);
--teal:oklch(55% 0.1 195);--teal-light:oklch(96.4% 0.026 195);--teal-chip:oklch(47% 0.09 195);
--gst:oklch(52% 0.15 148);--it:oklch(53% 0.16 252);--mca:oklch(50% 0.18 300);--fema:oklch(55% 0.19 12);--labour:oklch(50% 0.12 200);
--cat-tax:oklch(58% 0.14 70);--cat-labour:oklch(50% 0.12 200);--cat-business:oklch(52% 0.17 292);--cat-ip:oklch(52% 0.13 230);--cat-fema:oklch(55% 0.19 12);
--shadow:0 1px 2px oklch(25% 0.04 264 / 0.04), 0 6px 18px -10px oklch(28% 0.06 264 / 0.18)}
a{color:var(--primary);text-decoration:none;font-weight:700}a:hover{color:var(--primary-dark)}
@keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.card{position:relative;background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow);min-width:0;display:flex;flex-direction:column;transition:transform .25s ease,box-shadow .25s ease;animation:up .5s cubic-bezier(.2,.7,.2,1) backwards}
.card:hover{transform:translateY(-2px);box-shadow:0 2px 4px oklch(25% 0.04 264 / 0.05), 0 14px 28px -12px oklch(28% 0.08 264 / 0.25)}
.card.t::before{content:"";position:absolute;left:18px;top:-1px;width:38px;height:3px;border-radius:0 0 3px 3px;background:var(--gold)}
.ch{display:flex;align-items:center;gap:10px;padding:16px 18px 0;flex-wrap:wrap}
.st{font-size:12px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--navy-ink,var(--navy));margin:0}
.ic{width:30px;height:30px;border-radius:99px;display:flex;align-items:center;justify-content:center;flex:none;color:#fff}
.circ{width:44px;height:44px;border-radius:99px;display:flex;align-items:center;justify-content:center;flex:none;color:#fff}
.duo{fill:currentColor;stroke:none;opacity:.26}
.chip{display:inline-flex;align-items:center;gap:4px;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;letter-spacing:.01em;line-height:16px;white-space:nowrap}
.cap{font-size:11px;color:var(--muted)}
.lbl{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.rt{font-size:13px;font-weight:600;color:var(--fg)}
.metric{font-family:"Space Grotesk",Manrope,sans-serif;font-weight:600;letter-spacing:-.035em;color:var(--fg);font-feature-settings:"tnum"}
.mono{font-family:"IBM Plex Mono",monospace;font-feature-settings:"tnum"}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:36px;padding:0 14px;border-radius:6px;font:600 13px Manrope,sans-serif;border:1px solid transparent;cursor:pointer;text-decoration:none;white-space:nowrap;transition:background-color .15s,box-shadow .15s,transform .15s}
.btn:active{transform:scale(.98)}
.btn-p{background:var(--primary-fill,var(--primary));color:#fff;box-shadow:0 1px 2px oklch(30% 0.12 264 / 0.3), inset 0 1px 0 oklch(100% 0 0 / 0.16)}.btn-p:hover{background:var(--primary-fill-2,var(--primary-dark));color:#fff}
.btn-o{background:var(--panel);color:var(--fg);border-color:var(--border)}
.bar{height:8px;border-radius:3px;background:var(--raised);overflow:hidden;flex:1}
.bar>span{display:block;height:100%;border-radius:3px;transform-origin:left;animation:grow .9s cubic-bezier(.2,.7,.2,1) .2s backwards}
.stack{flex:1;display:flex;gap:2px;height:14px;border-radius:4px;overflow:hidden;background:var(--raised)}
.stack>span{transform-origin:left;animation:grow .9s cubic-bezier(.2,.7,.2,1) .2s backwards}
.pct{font-size:11.5px;font-weight:800;width:36px;text-align:right;color:var(--fg);font-feature-settings:"tnum"}
.go{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:800;margin-top:auto;padding:10px 18px 12px;border-top:1px solid var(--hair);color:var(--primary)}
.av{border-radius:99px;display:flex;align-items:center;justify-content:center;font-weight:800;flex:none;color:#fff;box-shadow:0 0 0 2px var(--panel)}
.kpi{position:relative;background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow);padding:14px 14px 0 18px;display:flex;flex-direction:column;gap:10px;overflow:hidden;transition:transform .25s ease;animation:up .5s cubic-bezier(.2,.7,.2,1) backwards}
.kpi:hover{transform:translateY(-2px)}
.kpi::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:4px;border-radius:0 4px 4px 0;background:var(--ac)}
.kpi .go{padding:9px 0 11px;margin:0}
th{text-align:left;padding:8px;font-size:11px;font-weight:800;color:var(--subtle);text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid var(--border)}
td{white-space:nowrap;padding:9px 8px;border-top:1px solid var(--hair);vertical-align:middle}
tbody tr:first-child td{border-top:0}
.nv{position:relative;display:flex;align-items:center;gap:11px;min-height:38px;padding:0 10px;border-radius:8px;color:var(--muted);font-weight:600;font-size:13.5px}
.nv:hover{background:var(--raised);color:var(--fg)}
.nv.on{background:var(--primary-light);color:var(--navy-ink,var(--navy));font-weight:800;box-shadow:inset 0 0 0 1px oklch(54.6% 0.215 263 / 0.18)}
.nv.on::before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:99px;background:var(--gold)}
.sub{min-height:32px;padding-left:38px;font-size:13px}
.tb{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:6px;color:var(--muted);position:relative;background:none;border:0}
.tb:hover{background:var(--primary-light);color:var(--fg)}
.dtile{width:50px;height:54px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex:none}
.box{width:22px;height:22px;border-radius:4px;border:2px solid var(--primary);flex:none;display:flex;align-items:center;justify-content:center;background:var(--panel)}
.seg{position:relative;display:inline-grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);padding:4px;border-radius:8px;background:var(--raised);box-shadow:inset 0 0 0 1px var(--border)}
.seg>.thumb{position:absolute;top:4px;bottom:4px;left:4px;border-radius:6px;background:var(--primary-light);box-shadow:inset 0 0 0 1px oklch(54.6% 0.215 263 / 0.28),0 1px 2px oklch(28% 0.06 264 / 0.08);transition:transform .38s cubic-bezier(.3,1.3,.5,1)}
.seg button{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;background:none;height:28px;padding:0 12px;border-radius:6px;font:600 12px Manrope,sans-serif;color:var(--muted);cursor:pointer;white-space:nowrap}
.seg button.on{color:var(--navy-ink,var(--navy));font-weight:700}
.seg .cnt{font:600 11px "IBM Plex Mono",monospace;color:var(--subtle)}
.seg button.on .cnt{color:var(--primary)}
@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
</style><style>
/* v7.1 - matches src/views/admin/ProjectsSections.tsx proj-view-pill + src/lib/motion.ts springSnappy (420/32/0.8) */
.seg{padding:2px;border-radius:8px;background:light-dark(oklch(96.5% 0.008 250), oklch(18.3% 0.008 250));box-shadow:inset 0 0 0 1px var(--border)}
.seg>.thumb{top:2px;bottom:2px;left:2px;border-radius:5px;background:var(--navy);box-shadow:0 1px 2px oklch(21% 0.042 264 / .25);transition:transform .42s linear(0,0.0637,0.2021,0.3619,0.5141,0.6451,0.7506,0.8315,0.8909,0.9328,0.9613,0.9799,0.9914,0.9981,1.0016,1.0032,1.0036,1.0034,1.0029,1.0023,1.0018,1.0013,1.0009,1.0006,1.0004)}
/* dark theme: #0f2a4a vanishes on a dark track, so the pill steps up to --navy-3 */
[data-theme="dark"] .seg>.thumb{background:var(--navy-3)}
.seg button{height:28px;padding:0 10px;border-radius:5px;font:500 12px Manrope,sans-serif;color:oklch(55% 0.022 255);transition:color .2s}
.seg button:hover{color:light-dark(oklch(45% 0.03 255), oklch(82% 0.021 255))}
.seg button.on{color:#fff;font-weight:500}
.seg .cnt{color:oklch(55% 0.022 255)}
.seg button.on .cnt{color:oklch(100% 0 0 / .72)}
/* cardHover (y -2, 0.16 s) + shadow-layered-lg, pressScale 0.98, row hover, focus ring */
.card{transition:transform .16s cubic-bezier(.22,1,.36,1),box-shadow .16s cubic-bezier(.22,1,.36,1),border-color .16s}
.card:hover{border-color:oklch(54.6% 0.215 263 / .35);box-shadow:0 2px 4px oklch(32% 0.04 264 / .05),0 8px 22px -6px oklch(37.9% 0.146 266 / .1),0 16px 40px -12px oklch(37.9% 0.146 266 / .08)}
.btn{transition:transform .12s cubic-bezier(.22,1,.36,1),background .15s}
.btn:active{transform:scale(.98)}
tbody tr{transition:background .15s}
tbody tr:hover{background:light-dark(oklch(96.8% 0.006 250 / .7), oklch(17.8% 0.006 250 / 0.7))}
a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid oklch(54.6% 0.215 263 / .4);outline-offset:2px}
.kbd{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;border-radius:4px;background:var(--raised);box-shadow:inset 0 0 0 1px var(--border);font:500 11px "IBM Plex Mono",monospace;color:var(--muted)}
/* sidebar: active pill + 3 px rail slide with the same spring; hover glass */
.snav a{position:relative;z-index:2}
.snav a:hover{background:oklch(100% 0 0 / .07)}
.spill,.srail{transition:transform .42s linear(0,0.0637,0.2021,0.3619,0.5141,0.6451,0.7506,0.8315,0.8909,0.9328,0.9613,0.9799,0.9914,0.9981,1.0016,1.0032,1.0036,1.0034,1.0029,1.0023,1.0018,1.0013,1.0009,1.0006,1.0004)}
/* page enter: fadeUp (y 6, 0.2 s) staggered 0.06 s */
@keyframes v7fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.stag>*{animation:v7fade .2s cubic-bezier(.22,1,.36,1) backwards}
/* Ask VCFO bot: pops up from the bottom, idle bob, reaction on answer */
@keyframes v7up{from{opacity:0;transform:translateY(48px)}to{opacity:1;transform:none}}
@keyframes v7bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes v7react{0%{transform:scale(.9)}45%{transform:scale(1.1) rotate(-4deg)}75%{transform:scale(.98)}100%{transform:none}}
@keyframes v7think{0%,100%{opacity:.35}50%{opacity:1}}
.botup{animation:v7up .45s cubic-bezier(.22,1,.36,1) .5s both}
.bob{animation:v7bob 2.6s ease-in-out infinite}
.react{animation:v7react .55s cubic-bezier(.22,1,.36,1) both}
.dot1{animation:v7think 1s infinite}.dot2{animation:v7think 1s .2s infinite}.dot3{animation:v7think 1s .4s infinite}
@media (prefers-reduced-motion: reduce){.seg>.thumb,.card,.btn,.spill,.srail{transition:none}.card:hover{transform:none}.stag>*,.botup,.bob,.react,.dot1,.dot2,.dot3{animation:none}}
</style><style>
.info{position:relative;display:inline-flex;vertical-align:middle;flex:none}
.info>button{width:18px;height:18px;padding:0;border:0;border-radius:4px;background:none;color:oklch(62% 0.02 255);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:color .15s}
.info>button:hover,.info:focus-within>button{color:var(--navy-ink,var(--navy))}
.info .pop{position:absolute;left:50%;top:calc(100% + 8px);z-index:40;width:max-content;min-width:200px;max-width:280px;box-sizing:border-box;padding:10px 12px;border-radius:8px;background:var(--panel);border:1px solid var(--border);box-shadow:0 12px 32px -12px oklch(21% 0.042 264 / .35);font:500 12px/1.45 Manrope,sans-serif;color:var(--fg);text-align:left;white-space:normal;letter-spacing:0;text-transform:none;opacity:0;visibility:hidden;transform:translate(-50%,-4px);transition:opacity .15s,transform .15s,visibility .15s}
.info .pop::before{content:"";position:absolute;left:50%;top:-6px;width:10px;height:10px;background:var(--panel);border-left:1px solid var(--border);border-top:1px solid var(--border);transform:translateX(-50%) rotate(45deg)}
.info:focus-within .pop,.info.open .pop{opacity:1;visibility:visible;transform:translate(-50%,0)}
.info .pop .ask{display:flex;align-items:center;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid var(--hair);color:var(--primary);font-weight:700}
.stag>*:focus-within,.card:focus-within,section:focus-within{position:relative;z-index:30}
@media (prefers-reduced-motion: reduce){.info .pop{transition:none}}
</style><style>@keyframes v7pulse{0%,100%{box-shadow:0 0 0 0 oklch(80% 0.12 85 / .7)}50%{box-shadow:0 0 0 5px oklch(80% 0.12 85 / 0)}}.pulse{animation:v7pulse 1.8s ease-in-out infinite}@media (prefers-reduced-motion: reduce){.pulse{animation:none}}</style><style>
.tipw{cursor:pointer}
.tipw .tt{position:absolute;left:50%;bottom:calc(100% + 8px);transform:translate(-50%,4px);z-index:60;background:var(--navy);color:#fff;font:700 12px/1.3 Manrope,sans-serif;letter-spacing:0;text-transform:none;padding:5px 9px;border-radius:6px;white-space:nowrap;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .12s,transform .12s,visibility .12s}
.tipw .tt::after{content:"";position:absolute;left:50%;top:100%;width:8px;height:8px;background:inherit;transform:translate(-50%,-4px) rotate(45deg)}
.tipw .tt.l{left:auto;right:calc(100% + 10px);bottom:auto;top:50%;transform:translate(4px,-50%)}
.tipw .tt.l::after{left:100%;top:50%;transform:translate(-4px,-50%) rotate(45deg)}
.tipw .tt.w{background:light-dark(#fff, oklch(13% 0 89.9));color:var(--navy-ink,var(--navy))}
.tipw:hover>.tt,.tipw:focus-visible>.tt{opacity:1;visibility:visible;transform:translate(-50%,0)}
.tipw:hover>.tt.l,.tipw:focus-visible>.tt.l{transform:translate(0,-50%)}
.ddrow{display:grid;grid-template-columns:minmax(0,1fr) 62px 116px 16px;align-items:center;gap:12px;padding:9px 10px;margin:0 -10px;border-radius:6px;color:var(--fg)}
.ddrow>.mono{text-align:right}
.ddrow>.chip{width:100%;justify-content:center}
.ddrow:hover{background:var(--raised)}
@media (prefers-reduced-motion: reduce){.tipw .tt{transition:none}}
</style>
<style data-vh="1">
/* v7 responsive layer (Home) - board root, sidebar column, top bar, card grid */
.vh-root{position:relative;width:100%;min-height:100vh;display:flex;background:var(--bg);font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px}
.vh-side{width:var(--vp-side-w,248px);flex:none;background:#0f2a4a;overflow:hidden}
.vh-body{flex:1;min-width:0}
.vh-top{--vh-hg:12px;--vh-hp:16px}
.vh-menu{display:none;flex:none;width:40px;height:40px;margin-left:-6px;border:0;border-radius:8px;background:none;color:var(--navy-ink,var(--navy));align-items:center;justify-content:center;cursor:pointer}
.vh-menu:hover{background:var(--primary-light)}
.vh-search{width:256px;padding:0 10px 0 12px}
.vh-main{box-sizing:border-box;width:100%;max-width:1600px;margin-inline:auto;padding:clamp(12px,2vw,24px);display:grid;gap:16px;align-items:start;grid-template-columns:minmax(0,1fr)}
.vh-main>.stag{display:flex;flex-direction:column;gap:16px;min-width:0}
.vh-b{grid-template-areas:"g" "a" "c1" "b" "c2"}
.vh-a{grid-template-areas:"g" "a1" "c1" "a2" "c2" "f" "d" "e"}
@media (min-width:600px){
 .vh-b{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-areas:"g g" "a a" "c1 c2" "b b"}
 .vh-a{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-areas:"g g" "a1 a1" "c1 a2" "c1 c2" "f f" "d e";grid-template-rows:auto auto auto 1fr}
}
@media (min-width:1180px){
 .vh-b{grid-template-columns:minmax(0,2fr) minmax(0,1fr);grid-template-areas:"g g" "a c1" "a c2" "b c2";grid-template-rows:auto auto 1fr auto}
 .vh-a{grid-template-columns:repeat(6,minmax(0,1fr));grid-template-areas:"g g g g g g" "a1 a1 a1 a1 c1 c1" "a1 a1 a1 a1 c2 c2" "a2 a2 a2 a2 c2 c2" "f f f f f f" "d d d e e e";grid-template-rows:auto auto 1fr auto}
}
@media (min-width:1800px){
 .vh-b{grid-template-columns:repeat(3,minmax(0,1fr));grid-template-areas:"g g g" "a c1 c2" "b b c2";grid-template-rows:auto auto 1fr}
 .vh-a{grid-template-areas:"g g g g g g" "a1 a1 a2 a2 c1 c1" "a1 a1 c2 c2 c1 c1" "f f f f f f" "d d d e e e";grid-template-rows:auto auto 1fr}
}
@media (max-width:1099px){
 .vh-search{width:36px;padding:0;justify-content:center}
 .vh-search>span{display:none!important}
}
@media (max-width:767px){
 .vh-top{--vh-hg:6px;--vh-hp:10px}
 .vh-menu{display:flex}
 .vh-crumb>*{display:none!important}
 .vh-top img{height:22px!important}
 .vh-top button{min-width:40px;min-height:40px}
 .vh-hide-sm{display:none!important}
 .card .btn,.card .seg button{min-height:40px}
 .card:hover{transform:none}
}
@media (max-width:479px){.vh-hide-xs{display:none!important}}
.vh-pbar{display:none}
@media (max-width:767px){
 .vh-pbar{display:flex;position:absolute;left:0;right:0;top:0;height:52px;z-index:4;align-items:center;gap:6px;padding:0 10px;background:light-dark(#fff, oklch(13% 0 89.9));border-bottom:1px solid var(--border);box-sizing:border-box}
 .vh-pbar .vh-menu{display:flex}
 .vh-under-bar{top:52px!important}
 .vh-zoom{bottom:72px!important}
}
/* cards: let long text shrink, headers wrap, tables and charts scroll inside their own box */
.card [style*="flex:1"]{min-width:0}
section.card>div:first-of-type{flex-wrap:wrap;row-gap:8px}
.vh-x{overflow-x:auto;max-width:100%;overscroll-behavior-x:contain}
.vh-x>table{min-width:var(--tmin,520px)}
.vh-tl{overflow-x:auto;overscroll-behavior-x:contain}
.vh-stats{row-gap:8px}
@media (max-width:599px){
 .vh-gtop{flex-wrap:wrap}
 .vh-stats{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px 12px}
 .vh-stat{border-right:0!important;margin-right:0!important;padding-right:0!important}
}
@media (max-width:767px){
 .vh-segwrap{display:flex!important;flex-wrap:wrap;gap:2px}
 .vh-segwrap>.thumb{display:none}
 .vh-segwrap button{flex:1 1 auto}
 .vh-segwrap button.on{background:var(--navy);color:#fff}
}
/* pop-ups always fit the viewport; closed ones take no space (no phantom page scroll) */
.info .pop{max-width:min(280px,calc(100vw - 24px));display:none}
.info:focus-within .pop,.info.open .pop{display:block;animation:vhfade .15s ease-out}
.tipw .tt{display:none}
.tipw:hover>.tt,.tipw:focus-visible>.tt{display:block;animation:vhfade .12s ease-out}
@keyframes vhfade{from{opacity:0}to{opacity:1}}
.vh-dd{width:min(600px,calc(100vw - 24px))!important;max-height:min(560px,calc(100dvh - 24px))!important}
@media (max-width:640px){
 .vh-dd .seg{display:flex!important;flex-wrap:wrap;gap:2px}
 .vh-dd .seg>.thumb{display:none}
 .vh-dd .seg button{flex:1 1 auto}
 .vh-dd .seg button.on{background:var(--navy);color:#fff}
 .vh-dd .ddrow{grid-template-columns:minmax(0,1fr) 116px 16px}
 .vh-dd .ddrow>.mono{display:none}
}
@media (pointer:coarse){.info>button{position:relative}.info>button::after{content:"";position:absolute;inset:-11px}}
</style>
```

#### Viewer markup (PDF dialog + unsupported-type dialog) — `s/home/v7x_doc_viewer.dc.html:225-227` (same markup, one tag per line for reading; whitespace only)

```html
<div style="font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<div style="width:100%;display:flex;flex-direction:column;gap:32px;background:var(--bg);padding-bottom:32px">
<div style="position:relative;width:100%;height:100vh;overflow:hidden">
<div style="position:absolute;left:0;top:0;width:100%;pointer-events:none;z-index:0" aria-hidden="true">
<dc-import name="v7_after" hint-size="1440px,900px">
</dc-import>
</div>
<div class="vh-pbar">
<button type="button" class="vh-menu" data-vp-menu aria-label="Open menu" onClick="{{openSide}}">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
<path d="M4 7h16 M4 12h16 M4 17h16">
</path>
</svg>
</button>
<img src="vcfo-bin:b/6e69009086da4b463a19d1d632abaa20.png" alt="SBC" style="height:22px;width:auto">
<span style="margin-left:6px;font-size:13px;font-weight:600;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Documents</span>
</div>
<div class="vh-under-bar" style="position:absolute;top:0;right:0;bottom:0;left:var(--vp-side-w,248px);background:oklch(20% 0.05 258 / 0.6);display:flex;align-items:center;justify-content:center;z-index:2">
<div role="dialog" aria-modal="true" aria-label="Document preview" style="width:min(1152px,calc(100% - 24px));height:min(720px,calc(100% - 24px));display:flex;flex-direction:column;border-radius:12px;overflow:hidden;background:light-dark(oklch(94% 0.008 255), oklch(22% 0.008 255));box-shadow:0 30px 70px -20px oklch(15% 0.05 258 / .6)">
<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--panel);border-bottom:1px solid var(--border)">
<span class="mono" style="width:30px;height:30px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;background:var(--over-light);color:var(--over-text)">PDF</span>
<div style="flex:1;min-width:0;display:flex;align-items:center;gap:4px;font-size:14px;font-weight:700">
<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{docFile}}</span>
<span class="info ">
<button type="button" aria-label="More information">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
<circle cx="12" cy="12" r="9">
</circle>
<path d="M12 11v5M12 8h.01">
</path>
</svg>
</button>
<span class="pop" role="tooltip">{{docMeta}} · Size [size]<a class="ask" href="#">
<dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px">
</dc-import>Ask VCFO about this</a>
</span>
</span>
</div>
<span class="cap" style="margin-right:6px;font-weight:600;white-space:nowrap;flex:none">{{docPos}}</span>
<a class="btn btn-o" href="#" aria-label="Download" style="height:32px;padding:0 10px;font-size:12.5px;flex:none">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;">
<path class="duo" d="M4.5 15h15v3.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5Z">
</path>
<path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 4.5V15 M7.8 10.8 12 15l4.2-4.2">
</path>
</svg>
<span class="vh-hide-sm">Download</span>
</a>
<button type="button" aria-label="Close preview (Esc)" title="Close (Esc)" onClick="{{close}}" style="width:32px;height:32px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--fg);display:flex;align-items:center;justify-content:center;cursor:pointer">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
<path d="M6 6l12 12M18 6L6 18">
</path>
</svg>
</button>
</div>
<div style="position:relative;flex:1;min-height:0;overflow:auto;display:flex;justify-content:center;padding:28px clamp(12px,6vw,72px) 72px">
<div data-paper style="position:relative;width:{{pageW}};max-width:100%;flex:none;align-self:flex-start;aspect-ratio:1/1.414;background:light-dark(#fff, oklch(13% 0 89.9));box-shadow:0 4px 24px -8px oklch(21% 0.042 264 / .3);border-radius:2px;padding:clamp(20px,5vw,48px) clamp(18px,5vw,52px);box-sizing:border-box;overflow:hidden;transition:width .2s">
<div style="font-size:11px;letter-spacing:.14em;color:var(--muted);text-transform:uppercase">Sample · placeholder page</div>
<div class="metric" style="font-size:22px;margin-top:10px">{{docTitle}}</div>
<div class="cap" style="margin-top:4px">Northwind Technologies India Pvt Ltd · {{docDate}}</div>
<div style="height:7px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:92%;margin-top:10px">
</div>
<div style="height:7px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:86%;margin-top:10px">
</div>
<div style="height:7px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:95%;margin-top:10px">
</div>
<div style="height:7px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:70%;margin-top:10px">
</div>
<div style="height:7px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:88%;margin-top:10px">
</div>
<div style="height:7px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:93%;margin-top:10px">
</div>
<div style="height:7px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:60%;margin-top:10px">
</div>
<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
<span style="font:800 clamp(34px,7vw,64px) Manrope,sans-serif;color:oklch(90% 0.01 255);transform:rotate(-24deg);letter-spacing:.1em">SAMPLE</span>
</div>
</div>
<button type="button" aria-label="Previous document" onClick="{{prev}}" style="position:absolute;left:16px;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:99px;border:1px solid var(--border);background:var(--panel);color:var(--fg);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 12px -4px oklch(21% 0.042 264 / .25)">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;transform:rotate(180deg)">
<path class="duo" d="">
</path>
<path d="M9 6l6 6-6 6">
</path>
</svg>
</button>
<button type="button" aria-label="Next document" onClick="{{next}}" style="position:absolute;right:16px;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:99px;border:1px solid var(--border);background:var(--panel);color:var(--fg);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 12px -4px oklch(21% 0.042 264 / .25)">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;">
<path class="duo" d="">
</path>
<path d="M9 6l6 6-6 6">
</path>
</svg>
</button>
<div class="vh-zoom" style="position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;align-items:center;gap:4px;padding:4px;border-radius:8px;background:var(--navy);color:#fff;box-shadow:0 8px 20px -8px oklch(15% 0.05 258 / .5)">
<span style="padding:0 10px;font:600 12px Manrope,sans-serif;white-space:nowrap">Page 1 / 1</span>
<span style="width:1px;height:18px;background:oklch(100% 0 0 / .2)">
</span>
<button type="button" aria-label="Zoom out" onClick="{{zoomOut}}" style="width:30px;height:30px;border:0;border-radius:6px;background:transparent;color:#fff;font:700 16px Manrope;cursor:pointer">−</button>
<span style="min-width:48px;text-align:center;font:600 12px Manrope,sans-serif">{{zoomLabel}}</span>
<button type="button" aria-label="Zoom in" onClick="{{zoomIn}}" style="width:30px;height:30px;border:0;border-radius:6px;background:transparent;color:#fff;font:700 16px Manrope;cursor:pointer">+</button>
</div>
</div>
</div>
</div>
</div>
<div style="padding:0 clamp(12px,3vw,32px) 0 calc(var(--vp-side-w,248px) + clamp(12px,2.5vw,32px));display:flex;flex-direction:column;gap:12px">
<div class="lbl" style="color:var(--navy-ink,var(--navy))">Unsupported file type</div>
<div role="dialog" aria-modal="true" aria-label="Document preview" style="width:min(860px,100%);min-height:380px;display:flex;flex-direction:column;border-radius:12px;overflow:hidden;background:light-dark(oklch(94% 0.008 255), oklch(22% 0.008 255));box-shadow:0 30px 70px -20px oklch(15% 0.05 258 / .6)">
<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--panel);border-bottom:1px solid var(--border)">
<span class="mono" style="width:30px;height:30px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;background:var(--prog-light);color:var(--prog-text)">DOCX</span>
<div style="flex:1;min-width:0;display:flex;align-items:center;gap:4px;font-size:14px;font-weight:700">
<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Draft Board Resolution.docx</span>
<span class="info ">
<button type="button" aria-label="More information">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
<circle cx="12" cy="12" r="9">
</circle>
<path d="M12 11v5M12 8h.01">
</path>
</svg>
</button>
<span class="pop" role="tooltip">From SBC · 14 Sep 2026 · Size [size]<a class="ask" href="#">
<dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px">
</dc-import>Ask VCFO about this</a>
</span>
</span>
</div>
<a class="btn btn-o" href="#" aria-label="Download" style="height:32px;padding:0 10px;font-size:12.5px;flex:none">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;">
<path class="duo" d="M4.5 15h15v3.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5Z">
</path>
<path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 4.5V15 M7.8 10.8 12 15l4.2-4.2">
</path>
</svg>
<span class="vh-hide-sm">Download</span>
</a>
<button type="button" aria-label="Close preview (Esc)" title="Close (Esc)" onClick="{{close}}" style="width:32px;height:32px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--fg);display:flex;align-items:center;justify-content:center;cursor:pointer">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
<path d="M6 6l12 12M18 6L6 18">
</path>
</svg>
</button>
</div>
<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:24px 16px">
<span style="width:64px;height:64px;border-radius:12px;background:var(--prog-light);color:var(--prog-text);display:flex;align-items:center;justify-content:center">
<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;">
<path class="duo" d="M6 4.5h7.5L18 9v10.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1Z">
</path>
<path d="M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5Z M13.5 3.5v5h5 M8.5 13h7 M8.5 16.5h4.5">
</path>
</svg>
</span>
<div style="font-size:15px;font-weight:700">Preview not available for this file type</div>
<a class="btn btn-p" href="#">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;">
<path class="duo" d="M4.5 15h15v3.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5Z">
</path>
<path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 4.5V15 M7.8 10.8 12 15l4.2-4.2">
</path>
</svg>Download</a>
</div>
</div>
</div>
</div>
</div>
```

#### Viewer logic (Esc, close→back, prev/next, zoom 50–150 step 25, pop-over viewport fit + tap toggle) — `s/home/v7x_doc_viewer.dc.html:229-271` (verbatim)

```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":1420}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = { i: 0, z: 100 }; }
  componentDidMount() {
    this._onKey = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); this.close(); } };
    document.addEventListener('keydown', this._onKey);
  }
  componentWillUnmount() { if (this._onKey) document.removeEventListener('keydown', this._onKey); }
  // Back to the screen that opened the viewer: the shell's back, else Home (the viewer's
  // opener in the prototype), else browser history, else the Home route.
  close() {
    if (typeof window.vcfoBack === 'function') return window.vcfoBack();
    if (typeof window.vcfoNav === 'function') return window.vcfoNav('s/home/v7_before.dc.html');
    if (window.history.length > 1) return window.history.back();
    if (typeof window.vcfoGo === 'function') return window.vcfoGo('home');
  }
  renderVals() {
    const s = this.state || {};
    const D = [["Certificate of Incorporation", "24 Oct 2026", "SBC"], ["Board meeting minutes", "26 Oct 2026", "SBC"], ["GST certificate", "1 Nov 2026", "SBC"], ["Share capital FIRC", "2 Nov 2026", "Northwind"]]; const i = s.i || 0; const d = D[i]; const z = s.z || 100;return { docFile: d[0] + '.pdf', docTitle: d[0], docDate: d[1], docMeta: 'From ' + d[2] + ' · ' + d[1], docPos: (i + 1) + ' of ' + D.length, prev: () => this.setState({ i: (i + D.length - 1) % D.length }), next: () => this.setState({ i: (i + 1) % D.length }), zoomIn: () => this.setState({ z: Math.min(150, z + 25) }), zoomOut: () => this.setState({ z: Math.max(50, z - 25) }), zoomLabel: z + '%', pageW: Math.round(460 * z / 100) + 'px', close: () => this.close(), openSide: () => { if (window.vcfoOpenSide) window.vcfoOpenSide(); else if (window.vcfoShell && window.vcfoShell.openDrawer) window.vcfoShell.openDrawer(); } };
  }
}
</script>
<script>
/* keep info pop-ups and tooltips inside the viewport (Home v7) */
(function(){
  function fit(e){
    var w = e.target && e.target.closest && e.target.closest('.info,.tipw'); if (!w) return;
    var p = w.querySelector(':scope>.pop,:scope>.tt'); if (!p) return;
    p.style.marginLeft = '';
    var r = p.getBoundingClientRect(), W = document.documentElement.clientWidth, d = 0;
    if (r.right > W - 8) d = W - 8 - r.right;
    if (r.left + d < 8) d = 8 - r.left;
    if (d) p.style.marginLeft = Math.round(d) + 'px';
  }
  ['mouseover', 'focusin', 'click'].forEach(function(t){ document.addEventListener(t, fit, true); });
  /* tap / click toggles an info pop-up (touch has no hover); a click outside closes it */
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('.info>button');
    [].forEach.call(document.querySelectorAll('.info.open'), function (x) { if (!b || x !== b.parentElement) x.classList.remove('open'); });
    if (b) { b.parentElement.classList.toggle('open'); fit({ target: b }); }
  }, true);
})();
</script>
```

### 3.6.2 Board copy (`s/docs/v7x_doc_viewer.dc.html`) — fixed 1440 px, used by Documents links

Differences vs. 3.6.1 (sizes): `.lbl`/`th`/`.seg .cnt`/`.kbd` 10.5–10 px instead of 11; `.card:hover` lifts 2 px; dialog fixed `1152×720`; page padding `28px 72px 72px`; no Esc handler, no `.vh-*` layer.

#### Board viewer markup — `s/docs/v7x_doc_viewer.dc.html:130-130` (same markup, one tag per line for reading; whitespace only)

```html
<div style="width:1440px;display:flex;flex-direction:column;gap:32px;background:var(--bg);padding-bottom:32px">
<div style="position:relative;width:1440px;height:900px;overflow:hidden">
<div style="position:absolute;left:0;top:0;width:1440px;pointer-events:none;z-index:0" aria-hidden="true">
<dc-import name="docs_opt_a" hint-size="1440px,900px">
</dc-import>
</div>
<div style="position:absolute;inset:0;background:oklch(20% 0.05 258 / 0.6);display:flex;align-items:center;justify-content:center;z-index:2">
<div role="dialog" aria-modal="true" aria-label="Document preview" style="width:1152px;height:720px;display:flex;flex-direction:column;border-radius:12px;overflow:hidden;background:light-dark(oklch(94% 0.008 255), oklch(22% 0.008 255));box-shadow:0 30px 70px -20px oklch(15% 0.05 258 / .6)">
<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--panel);border-bottom:1px solid var(--border)">
<span class="mono" style="width:30px;height:30px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:700;background:var(--over-light);color:var(--over-text)">PDF</span>
<div style="flex:1;min-width:0;display:flex;align-items:center;gap:4px;font-size:14px;font-weight:700">{{docFile}}<span class="info ">
<button type="button" aria-label="More information">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
<circle cx="12" cy="12" r="9">
</circle>
<path d="M12 11v5M12 8h.01">
</path>
</svg>
</button>
<span class="pop" role="tooltip">{{docMeta}} · Size [size]<a class="ask" href="#">
<dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px">
</dc-import>Ask VCFO about this</a>
</span>
</span>
</div>
<span class="cap" style="margin-right:6px;font-weight:600">{{docPos}}</span>
<a class="btn btn-o" href="#" style="height:32px;padding:0 10px;font-size:12.5px">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;">
<path class="duo" d="M4.5 15h15v3.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5Z">
</path>
<path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 4.5V15 M7.8 10.8 12 15l4.2-4.2">
</path>
</svg>Download</a>
<button type="button" aria-label="Close preview (Esc)" title="Close (Esc)" style="width:32px;height:32px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--fg);display:flex;align-items:center;justify-content:center;cursor:pointer">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
<path d="M6 6l12 12M18 6L6 18">
</path>
</svg>
</button>
</div>
<div style="position:relative;flex:1;min-height:0;overflow:auto;display:flex;justify-content:center;padding:28px 72px 72px">
<div data-paper style="position:relative;width:{{pageW}};aspect-ratio:1/1.414;background:light-dark(#fff, oklch(13% 0 89.9));box-shadow:0 4px 24px -8px oklch(21% 0.042 264 / .3);border-radius:2px;padding:48px 52px;box-sizing:border-box;transition:width .2s">
<div style="font-size:9px;letter-spacing:.14em;color:var(--muted);text-transform:uppercase">Sample · placeholder page</div>
<div class="metric" style="font-size:22px;margin-top:10px">{{docTitle}}</div>
<div class="cap" style="margin-top:4px">Northwind Technologies India Pvt Ltd · {{docDate}}</div>
<div style="height:7px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:92%;margin-top:10px">
</div>
<div style="height:7px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:86%;margin-top:10px">
</div>
<div style="height:7px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:95%;margin-top:10px">
</div>
<div style="height:7px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:70%;margin-top:10px">
</div>
<div style="height:7px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:88%;margin-top:10px">
</div>
<div style="height:7px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:93%;margin-top:10px">
</div>
<div style="height:7px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:60%;margin-top:10px">
</div>
<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
<span style="font:800 64px Manrope,sans-serif;color:oklch(90% 0.01 255);transform:rotate(-24deg);letter-spacing:.1em">SAMPLE</span>
</div>
</div>
<button type="button" aria-label="Previous document" onClick="{{prev}}" style="position:absolute;left:16px;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:99px;border:1px solid var(--border);background:var(--panel);color:var(--fg);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 12px -4px oklch(21% 0.042 264 / .25)">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;transform:rotate(180deg)">
<path class="duo" d="">
</path>
<path d="M9 6l6 6-6 6">
</path>
</svg>
</button>
<button type="button" aria-label="Next document" onClick="{{next}}" style="position:absolute;right:16px;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:99px;border:1px solid var(--border);background:var(--panel);color:var(--fg);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 12px -4px oklch(21% 0.042 264 / .25)">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;">
<path class="duo" d="">
</path>
<path d="M9 6l6 6-6 6">
</path>
</svg>
</button>
<div style="position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;align-items:center;gap:4px;padding:4px;border-radius:8px;background:var(--navy);color:#fff;box-shadow:0 8px 20px -8px oklch(15% 0.05 258 / .5)">
<span style="padding:0 10px;font:600 12px Manrope,sans-serif">Page 1 / 1</span>
<span style="width:1px;height:18px;background:oklch(100% 0 0 / .2)">
</span>
<button type="button" aria-label="Zoom out" onClick="{{zoomOut}}" style="width:30px;height:30px;border:0;border-radius:6px;background:transparent;color:#fff;font:700 16px Manrope;cursor:pointer">−</button>
<span style="min-width:48px;text-align:center;font:600 12px Manrope,sans-serif">{{zoomLabel}}</span>
<button type="button" aria-label="Zoom in" onClick="{{zoomIn}}" style="width:30px;height:30px;border:0;border-radius:6px;background:transparent;color:#fff;font:700 16px Manrope;cursor:pointer">+</button>
</div>
</div>
</div>
</div>
</div>
<div style="padding:0 32px;display:flex;flex-direction:column;gap:12px">
<div class="lbl" style="color:var(--navy-ink,var(--navy))">Unsupported file type</div>
<div role="dialog" aria-modal="true" aria-label="Document preview" style="width:860px;height:420px;display:flex;flex-direction:column;border-radius:12px;overflow:hidden;background:light-dark(oklch(94% 0.008 255), oklch(22% 0.008 255));box-shadow:0 30px 70px -20px oklch(15% 0.05 258 / .6)">
<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--panel);border-bottom:1px solid var(--border)">
<span class="mono" style="width:30px;height:30px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:700;background:var(--prog-light);color:var(--prog-text)">DOCX</span>
<div style="flex:1;min-width:0;display:flex;align-items:center;gap:4px;font-size:14px;font-weight:700">Draft Board Resolution.docx<span class="info ">
<button type="button" aria-label="More information">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
<circle cx="12" cy="12" r="9">
</circle>
<path d="M12 11v5M12 8h.01">
</path>
</svg>
</button>
<span class="pop" role="tooltip">From SBC · 14 Sep 2026 · Size [size]<a class="ask" href="#">
<dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px">
</dc-import>Ask VCFO about this</a>
</span>
</span>
</div>
<a class="btn btn-o" href="#" style="height:32px;padding:0 10px;font-size:12.5px">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;">
<path class="duo" d="M4.5 15h15v3.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5Z">
</path>
<path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 4.5V15 M7.8 10.8 12 15l4.2-4.2">
</path>
</svg>Download</a>
<button type="button" aria-label="Close preview (Esc)" title="Close (Esc)" style="width:32px;height:32px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--fg);display:flex;align-items:center;justify-content:center;cursor:pointer">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
<path d="M6 6l12 12M18 6L6 18">
</path>
</svg>
</button>
</div>
<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center">
<span style="width:64px;height:64px;border-radius:12px;background:var(--prog-light);color:var(--prog-text);display:flex;align-items:center;justify-content:center">
<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;">
<path class="duo" d="M6 4.5h7.5L18 9v10.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1Z">
</path>
<path d="M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5Z M13.5 3.5v5h5 M8.5 13h7 M8.5 16.5h4.5">
</path>
</svg>
</span>
<div style="font-size:15px;font-weight:700">Preview not available for this file type</div>
<a class="btn btn-p" href="#">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;">
<path class="duo" d="M4.5 15h15v3.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5Z">
</path>
<path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 4.5V15 M7.8 10.8 12 15l4.2-4.2">
</path>
</svg>Download</a>
</div>
</div>
</div>
</div>
```

## 3.7 Phone preview sheet

#### Phone preview CSS — `s/docs/docs_mobile_preview.dc.html:13-24` (verbatim)

```css
<style>
body{margin:0;-webkit-font-smoothing:antialiased}
:root{--panel:oklch(100% 0 0);--raised:oklch(96.6% 0.007 255);--border:oklch(92.2% 0.011 255);--hair:oklch(94.8% 0.007 255);--fg:oklch(21% 0.042 264);--muted:oklch(46% 0.028 258);--subtle:oklch(55% 0.022 255);--primary:oklch(54.6% 0.215 263);--primary-light:oklch(96.6% 0.02 260);--navy:#0f2a4a;--gold:#c9a24b;--gold-soft:#fbf3df;--gold-text:#6e500f;--over-light:oklch(96.4% 0.026 18);--over-chip:oklch(52% 0.2 22)}
a{color:var(--primary);text-decoration:none;font-weight:700}
.chip{display:inline-flex;align-items:center;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;line-height:16px;white-space:nowrap}
.mono{font-family:"IBM Plex Mono",monospace}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:44px;padding:0 14px;border-radius:6px;font:600 13px Manrope,sans-serif;border:1px solid transparent;text-decoration:none;white-space:nowrap}
.btn-n{background:var(--navy);color:#fff}.btn-o{background:var(--panel);color:var(--fg);border-color:var(--border)}
@keyframes sheet{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
.sheet{animation:sheet .28s cubic-bezier(.22,1,.36,1) both}
@media (prefers-reduced-motion: reduce){.sheet{animation:none}}
</style>
```

#### Phone preview markup — `s/docs/docs_mobile_preview.dc.html:26-46` (verbatim)

```html
<div style="position:relative;width:390px;height:844px;overflow:hidden;background:oklch(20% 0.05 258);font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
  <div role="dialog" aria-modal="true" aria-label="Preview: Certificate of Incorporation" class="sheet" style="position:absolute;left:0;right:0;top:28px;bottom:0;background:var(--panel);border-radius:12px 12px 0 0;display:flex;flex-direction:column;overflow:hidden">
    <div style="display:flex;justify-content:center;padding-top:8px"><span style="width:40px;height:4px;border-radius:2px;background:var(--border)"></span></div>
    <div style="display:flex;align-items:center;gap:10px;padding:8px 8px 10px 16px;border-bottom:1px solid var(--border)">
      <div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px"><h2 style="margin:0;font:700 15px Manrope,sans-serif;color:var(--navy-ink,var(--navy));white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Certificate of Incorporation</h2></div><div style="display:flex;gap:6px;margin-top:4px"><span class="chip" style="background:var(--navy);color:#fff">Final</span><span class="chip" style="background:var(--gold-soft);color:var(--gold-text)">SBC</span><span class="mono" style="font-size:11px;color:var(--subtle);align-self:center">24 Oct 2026</span></div></div>
      <a href="docs_mobile.dc.html" aria-label="Close preview" style="width:44px;height:44px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--muted)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></a>
    </div>
    <div style="flex:1;min-height:0;background:light-dark(oklch(93.5% 0.01 255), oklch(22.8% 0.01 255));padding:16px;display:flex;justify-content:center;overflow:hidden">
      <div style="width:330px;height:466px;background:light-dark(#fff, oklch(13% 0 89.9));box-shadow:0 2px 6px oklch(25% 0.04 264 / .12),0 18px 40px -18px oklch(25% 0.06 264 / .35);padding:28px 26px;box-sizing:border-box;font-family:'Source Serif 4',Georgia,serif;color:light-dark(oklch(25% 0.02 260), oklch(90% 0.014 260))">
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center"><span style="width:34px;height:34px;border-radius:99px;border:2px solid var(--gold)"></span><div style="font-size:9px;letter-spacing:.14em;text-transform:uppercase">Government of India</div><div style="font-size:15px;font-weight:600;margin-top:8px">Certificate of Incorporation</div></div>
        <p style="font-size:10.5px;line-height:1.7;margin:16px 0 0">I hereby certify that <b>NORTHWIND TECHNOLOGIES INDIA PRIVATE LIMITED</b> is incorporated on this twenty-fourth day of October two thousand twenty-six under the Companies Act, 2013.</p>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:18px"><span style="height:5px;width:80%;border-radius:2px;background:light-dark(oklch(92% 0.008 255), oklch(25% 0.008 255))"></span><span style="height:5px;width:62%;border-radius:2px;background:light-dark(oklch(92% 0.008 255), oklch(25% 0.008 255))"></span><span style="height:5px;width:70%;border-radius:2px;background:light-dark(oklch(92% 0.008 255), oklch(25% 0.008 255))"></span></div>
      </div>
    </div>
    <div style="display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 0;border-top:1px solid var(--hair)"><span style="width:18px;height:4px;border-radius:2px;background:var(--navy)"></span><span style="width:6px;height:4px;border-radius:2px;background:var(--border)"></span><span class="mono" style="font-size:11px;color:var(--subtle);margin-left:6px">Page 1 of 2 · swipe</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px 16px 20px;border-top:1px solid var(--border)">
      <a class="btn btn-o" href="#"><dc-import name="v7c_bot" state="idle" size="18" hint-size="18px,18px"></dc-import>Ask VCFO</a>
      <a class="btn btn-n" href="#"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11 M7.5 10.5 12 15l4.5-4.5 M5 19.5h14"></path></svg>Download</a>
    </div>
  </div>
</div>
```

## 3.8 Knowledge Bank — bookshelf

#### Shelf stylesheet (books, spine, page edges, gold band, ribbon, planks, mini cards, responsive) — `s/docs/lib_shelf_a.dc.html:13-93` (verbatim)

```css
<style>
body{margin:0;-webkit-font-smoothing:antialiased}
:root{--bg:oklch(97.4% 0.006 255);--panel:oklch(100% 0 0);--raised:oklch(96.6% 0.007 255);--border:oklch(92.2% 0.011 255);--hair:oklch(94.8% 0.007 255);--fg:oklch(21% 0.042 264);--muted:oklch(46% 0.028 258);--subtle:oklch(55% 0.022 255);
--primary:oklch(54.6% 0.215 263);--primary-light:oklch(96.6% 0.02 260);--navy:#0f2a4a;--navy-2:#17396b;--navy-3:#1b4f94;--gold:#c9a24b;--gold-soft:#fbf3df;--gold-text:#6e500f;
--ok-text:oklch(39% 0.09 172);--prog-chip:oklch(51% 0.17 252);--violet:oklch(54.6% 0.215 263);--violet-light:oklch(96.6% 0.02 260);--violet-chip:oklch(48.8% 0.217 264);--violet-text:oklch(40% 0.17 264);
--shadow:0 1px 2px oklch(25% 0.04 264 / 0.04), 0 6px 18px -10px oklch(28% 0.06 264 / 0.18)}
a{color:var(--primary);text-decoration:none;font-weight:700}
.chip{display:inline-flex;align-items:center;gap:4px;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;line-height:16px;white-space:nowrap}
.mono{font-family:"IBM Plex Mono",monospace;font-feature-settings:"tnum"}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:34px;padding:0 12px;border-radius:6px;font:600 12.5px Manrope,sans-serif;border:1px solid transparent;text-decoration:none;white-space:nowrap}
.btn-o{background:var(--panel);color:var(--fg);border-color:var(--border)}
.seg{position:relative;display:inline-grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);padding:2px;border-radius:8px;background:light-dark(oklch(96.5% 0.008 250), oklch(18.3% 0.008 250));box-shadow:inset 0 0 0 1px var(--border)}
.seg>.thumb{position:absolute;top:2px;bottom:2px;left:2px;border-radius:5px;background:var(--navy);box-shadow:0 1px 2px oklch(21% 0.042 264 / .25);transition:transform .42s linear(0,0.0637,0.2021,0.3619,0.5141,0.6451,0.7506,0.8315,0.8909,0.9328,0.9613,0.9799,0.9914,0.9981,1.0016,1.0032,1.0036,1.0034,1.0029,1.0023,1.0018,1.0013,1.0009,1.0006,1.0004)}
.seg button{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;background:none;height:30px;padding:0 10px;border-radius:5px;font:500 12px Manrope,sans-serif;color:light-dark(oklch(50% 0.022 255), oklch(80% 0.015 255));cursor:pointer;white-space:nowrap;transition:color .2s}
.seg button.on{color:#fff}
.seg .cnt{font:600 11px "IBM Plex Mono",monospace;color:oklch(55% 0.022 255)}
.seg button.on .cnt{color:oklch(100% 0 0 / .72)}
.shelf{position:relative;display:flex;align-items:flex-end;gap:18px;padding:22px 28px 0;perspective:900px;min-height:186px}
.plank{height:14px;border-radius:2px;background:linear-gradient(180deg,light-dark(oklch(86% 0.018 255), oklch(34.2% 0.018 255)),light-dark(oklch(80% 0.022 255), oklch(36% 0.022 255)));box-shadow:0 10px 18px -10px oklch(25% 0.05 258 / .55)}
.book{position:relative;width:116px;height:164px;flex:none;box-sizing:border-box;padding:14px 10px 10px 20px;border-radius:2px 6px 6px 2px;background:var(--bc);color:#fff;display:flex;flex-direction:column;gap:8px;transform:rotateY(-16deg);transform-origin:left bottom;box-shadow:8px 4px 14px -6px oklch(20% 0.05 258 / .45),inset -2px 0 0 oklch(100% 0 0 / .08);transition:transform .3s cubic-bezier(.22,1,.36,1),box-shadow .3s;font-weight:700}
.book::before{content:"";position:absolute;left:0;top:0;bottom:0;width:11px;border-radius:2px 0 0 2px;background:linear-gradient(90deg,oklch(0% 0 0 / .32),oklch(100% 0 0 / .14) 55%,oklch(0% 0 0 / .18))}
.book::after{content:"";position:absolute;right:-5px;top:5px;bottom:5px;width:5px;border-radius:0 2px 2px 0;background:repeating-linear-gradient(180deg,light-dark(oklch(97% 0.01 85), oklch(17.5% 0.01 85)) 0 2px,light-dark(oklch(90% 0.012 85), oklch(28% 0.01 85)) 2px 3px)}
.book:hover,.book:focus-visible{transform:rotateY(0deg) translateY(-12px);box-shadow:12px 18px 26px -10px oklch(20% 0.05 258 / .45);color:#fff}
.bk-band{position:absolute;left:11px;right:0;top:0;height:5px;background:var(--gold)}
.bk-ic{width:28px;height:28px;border-radius:99px;background:oklch(100% 0 0 / .18);display:flex;align-items:center;justify-content:center}
.bk-t{font:800 12.5px/1.25 Manrope,sans-serif;letter-spacing:-.005em}
.bk-c{margin-top:auto;font:700 11px/1.2 Manrope,sans-serif;letter-spacing:.04em;text-transform:uppercase;opacity:.8}
.rib{position:absolute;right:8px;top:0;width:14px;height:22px;background:var(--prog-chip);clip-path:polygon(0 0,100% 0,100% 100%,50% 74%,0 100%)}
.mini{display:flex;align-items:center;gap:10px;padding:8px 12px 8px 8px;border-radius:8px;background:var(--panel);border:1px solid var(--border);box-shadow:var(--shadow);color:var(--fg);min-width:230px}
.mini .cv{width:30px;height:42px;border-radius:2px 4px 4px 2px;background:var(--bc);box-shadow:inset 4px 0 0 oklch(0% 0 0 / .25);flex:none}
.bar{display:block;height:5px;border-radius:3px;background:var(--raised);overflow:hidden}
.bar>span{display:block;height:100%;background:var(--primary-fill,var(--primary))}
.pbar{display:block;padding:4px 0;border-radius:4px}.pbar:hover .bar{box-shadow:0 0 0 2px oklch(54.6% 0.215 263 / .25)}
.tip{position:relative}.tip::after{content:attr(data-tip);position:absolute;left:50%;bottom:calc(100% + 6px);z-index:90;width:max-content;padding:6px 9px;border-radius:6px;background:var(--navy);color:#fff;font:600 11.5px Manrope,sans-serif;white-space:nowrap;opacity:0;visibility:hidden;transform:translate(-50%,3px);transition:opacity .12s .12s,transform .12s .12s,visibility .12s .12s;pointer-events:none}.tip:hover::after,.tip:focus-visible::after{opacity:1;visibility:visible;transform:translate(-50%,0)}
a:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid oklch(54.6% 0.215 263 / .5);outline-offset:3px}
@keyframes v7up{from{opacity:0;transform:translateY(48px)}to{opacity:1;transform:none}}
@keyframes v7bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.botup{animation:v7up .45s cubic-bezier(.22,1,.36,1) .5s both}
.bob{animation:v7bob 2.6s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none!important;transition:none!important}.book{transform:none}}
</style>
<style>
/* v5 · covers: full titles at normal spacing (2 lines, then …); hover lifts and tilts the book instead of squeezing it */
.book{width:128px;height:172px;padding:16px 12px 12px 22px;transform:none;transform-origin:20% 100%;transition:transform .42s cubic-bezier(.34,1.45,.5,1),box-shadow .3s cubic-bezier(.22,1,.36,1);will-change:transform}
.book:hover,.book:focus-visible{transform:translate3d(0,-14px,0) rotate(-2.5deg);box-shadow:14px 24px 30px -12px oklch(20% 0.05 258 / .5),inset -2px 0 0 oklch(100% 0 0 / .08)}
.book:active{transform:translate3d(0,-10px,0) rotate(-1.5deg) scale(.985)}
.bk-t{font:700 13px/1.32 Manrope,sans-serif;letter-spacing:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:break-word;hyphens:auto}
.book:hover .bk-t,.book:focus-visible .bk-t{-webkit-line-clamp:6}
@media (prefers-reduced-motion: reduce){.book,.book:hover,.book:focus-visible{transition:none;transform:none}}
/* ---------- v7 responsive (phone <=767 · tablet 768-1279 · desktop >=1280) ---------- */
.vp-sidecol{width:var(--vp-side-w,248px);flex:none;overflow:hidden;background:#0f2a4a}
@media (max-width:1279px){.vp-sidecol{width:var(--vp-side-w,72px)}}
@media (max-width:767px){.vp-sidecol{width:var(--vp-side-w,0px);visibility:hidden}}
.vlib{position:relative;width:100%;min-height:100vh;min-height:100dvh;display:flex;background:var(--bg);font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px}
.vlib-col{flex:1;min-width:0}
.vlib-main{width:100%;max-width:1600px;margin-inline:auto;box-sizing:border-box;padding:clamp(12px,1.6vw,20px) clamp(12px,1.8vw,24px) 96px;display:flex;flex-direction:column;gap:16px}
.vlib-tools{display:flex;align-items:center;flex-wrap:wrap;gap:10px}
.vlib-segw{flex:1 1 680px;max-width:740px;min-width:0;overflow-x:auto;scrollbar-width:none;border-radius:8px}
.vlib-segw::-webkit-scrollbar{display:none}
.vlib-segw .seg{width:100%;min-width:680px;box-sizing:border-box}
.vlib-q{flex:1 1 200px;min-width:0;box-sizing:border-box}
.vlib-recent{display:flex;flex-wrap:wrap;align-items:center;gap:12px}
.vlib-recent>h2{flex:none}
.vlib-recent>.mini{flex:1 1 200px;max-width:360px;min-width:0;box-sizing:border-box}
@media (max-width:1279px){.vlib-recent>h2{flex-basis:100%}}
.vlib-recent .mini a{overflow-wrap:anywhere}
.shelf{flex-wrap:wrap;row-gap:40px;background:linear-gradient(180deg,transparent 172px,light-dark(oklch(86% 0.018 255), oklch(34.2% 0.018 255)) 172px,light-dark(oklch(80% 0.022 255), oklch(36% 0.022 255)) 185px,oklch(72% 0.02 255) 185px,oklch(72% 0.02 255) 186px,transparent 186px) 16px 22px/calc(100% - 32px) 212px repeat-y}
@media (max-width:767px){
  .vlib-segw{flex-basis:100%;max-width:none}
  .vlib-segw .seg button{height:40px}
  .vlib-tools .btn{height:40px;flex:1 1 auto}
  .vlib-q{flex-basis:100%;height:44px!important}
  .vlib-recent>h2{flex-basis:100%}
  .vlib-recent>.mini{max-width:none}
  .vlib-recent .mini a{display:flex;align-items:center;min-height:40px}
  .vlib-recent .mini .pbar{min-height:28px}
  .vlib-recent .mini .pbar .bar{flex:1}
  .shelf{display:grid;grid-template-columns:repeat(auto-fill,128px);justify-content:center;align-items:end;padding:22px 12px 0;gap:40px 18px;background-position:6px 22px;background-size:calc(100% - 12px) 212px}
  .vlib .plank{margin:0 6px!important}
}
</style>
```

#### Shelf markup — `s/docs/lib_shelf_a.dc.html:95-135` (verbatim)

```html
<div class="vlib">
  <div class="vp-sidecol" data-vp="side"><dc-import name="side" active="5" hint-size="248px,900px" style="display:block;width:248px"></dc-import></div>
  <div class="vlib-col">
    <dc-import name="topbar" trail="Library" hint-size="100%,52px" style="display:block"></dc-import>
    <main class="vlib-main">
      <div class="vlib-tools">
        <div class="vlib-segw"><div class="seg" role="tablist" aria-label="Category"><span class="thumb" style="width:calc((100% - 4px)/6);{{thumb}}"></span><sc-for list="{{tabs}}" as="t" hint-placeholder-count="6"><button type="button" role="tab" aria-selected="{{t.sel}}" class="{{t.cls}}" onClick="{{t.pick}}">{{t.label}}<span class="cnt">{{t.cnt}}</span></button></sc-for></div></div><span class="chip" style="background:var(--primary-chip);color:#fff">{{total}} books</span><a class="btn btn-o" href="#">Monthly status brief</a><a class="btn btn-o" href="#"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11 M7.5 10.5 12 15l4.5-4.5 M5 19.5h14"></path></svg>PDF brief</a>
        <label class="vlib-q" style="display:flex;align-items:center;gap:8px;height:34px;padding:0 10px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--subtle)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M16 16l4 4"></path></svg><input type="search" aria-label="Search books" placeholder="Search books" value="{{q}}" onInput="{{onQ}}" style="flex:1;min-width:0;border:0;outline:0;background:none;font:500 13px Manrope,sans-serif"></label>
      </div>

      <section class="vlib-recent">
        <h2 style="margin:0;font:800 11px Manrope,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--navy-ink,var(--navy));width:110px">Recently read</h2>
        <div class="mini" style="--bc:oklch(45% 0.16 14)"><span class="cv"></span><span style="flex:1;display:flex;flex-direction:column;gap:5px"><a href="lib_reader.dc.html" style="font-size:12.5px;color:var(--fg)">FC-GPR after share allotment</a><a class="pbar tip" href="lib_recent_drill.dc.html" data-tip="70% read · 2 of 3 sections" aria-label="70% read · 2 of 3 sections. Open the reading list"><span class="bar"><span style="width:70%"></span></span></a></span></div>
        <div class="mini" style="--bc:var(--navy-3)"><span class="cv"></span><span style="flex:1;display:flex;flex-direction:column;gap:5px"><a href="lib_reader.dc.html" style="font-size:12.5px;color:var(--fg)">What is SPICe+?</a><a class="pbar tip" href="lib_recent_drill.dc.html" data-tip="Finished · read on 8 Nov" aria-label="Finished · read on 8 Nov. Open the reading list"><span class="bar"><span style="width:100%"></span></span></a></span></div>
        <div class="mini" style="--bc:var(--navy)"><span class="cv" style="box-shadow:inset 4px 0 0 var(--gold)"></span><span style="flex:1;display:flex;flex-direction:column;gap:5px"><a href="lib_reader.dc.html" style="font-size:12.5px;color:var(--fg)">What happens after the COI?</a><a class="pbar tip" href="lib_recent_drill.dc.html" data-tip="35% read · 1 of 3 sections" aria-label="35% read · 1 of 3 sections. Open the reading list"><span class="bar"><span style="width:35%"></span></span></a></span></div>
      </section>

      <div style="background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow);padding:6px 0 18px;display:flex;flex-direction:column;gap:6px">
        <sc-for list="{{shelves}}" as="sh" hint-placeholder-count="3">
          <section aria-label="{{sh.title}}">
            <div style="display:flex;align-items:center;gap:8px;padding:14px 28px 0"><span style="width:10px;height:10px;border-radius:3px;{{sh.dot}}"></span><h2 style="margin:0;font:700 13px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">{{sh.title}}</h2><span class="mono" style="font-size:11px;color:var(--subtle)">{{sh.count}}</span></div>
            <div class="shelf">
              <sc-for list="{{sh.books}}" as="b" hint-placeholder-count="4">
                <a class="book" href="lib_reader.dc.html" style="{{b.style}}" aria-label="Open {{b.title}}">
                  <span class="bk-band"></span>
                  <sc-if value="{{b.updated}}" hint-placeholder-val="{{false}}"><span class="rib" title="Updated"></span></sc-if>
                  <span class="bk-ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{b.icon}}"></path></svg></span>
                  <span class="bk-t">{{b.title}}</span>
                  <span class="bk-c">{{b.short}}</span>
                </a>
              </sc-for>
            </div>
            <div class="plank" style="margin:0 16px"></div>
          </section>
        </sc-for>
        <sc-if value="{{none}}" hint-placeholder-val="{{false}}"><div style="padding:40px 16px"><div role="status" style="display:flex;align-items:flex-end;gap:10px;justify-content:center;text-align:left"><dc-import name="v7c_bot" state="idle" size="40" hint-size="40px,40px"></dc-import><div style="position:relative;max-width:320px;padding:10px 14px;border-radius:10px 10px 10px 2px;background:var(--panel);border:1px solid var(--border);box-shadow:0 8px 20px -12px oklch(21% 0.042 264 / .35);display:flex;flex-direction:column;align-items:flex-start"><span style="font:600 13px/1.45 Manrope,sans-serif;color:var(--fg)">No book matches “{{q}}”.</span><button type="button" onClick="{{clearQ}}" style="margin-top:6px;padding:0;border:0;background:none;font:700 12px Manrope,sans-serif;color:var(--primary);cursor:pointer">Clear search</button><a href="#" style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;font-size:12px;font-weight:700;color:var(--primary)">Ask VCFO why</a></div></div></div></sc-if>
      </div>
    </main>
  </div>
  <div style="position:absolute;top:0;right:0;width:min(420px,100%);height:min(900px,100vh);pointer-events:none;z-index:5"><div style="pointer-events:auto"><div class="botup" style="position:absolute;right:24px;bottom:24px;display:flex;flex-direction:column;align-items:center;gap:6px"><span style="background:var(--navy);color:#fff;font-size:12px;font-weight:700;border-radius:6px;padding:4px 10px">Ask VCFO</span><button type="button" aria-label="Open Ask VCFO" style="width:68px;height:68px;border-radius:99px;border:0;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));box-shadow:0 10px 24px -8px oklch(25% 0.06 258 / 0.45),0 0 0 1px var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer"><span class="bob" style="display:flex"><dc-import name="v7c_bot" state="idle" size="50" hint-size="50px,50px"></dc-import></span></button></div></div></div>
</div>
```

#### Shelf data (categories: name, short, colour, glyph path; books; filters) — `s/docs/lib_shelf_a.dc.html:138-165` (verbatim)

```js
class Component extends DCLogic {
  constructor(p) { super(p); this.state = { c: 0, q: '' }; }
  renderVals() {
    const s = this.state || {};
    const CAT = [
      ['Incorporation', 'Incorp.', 'var(--navy-3)', 'M4 20h16 M6 20V8l6-4 6 4v12 M10 20v-5h4v5'],
      ['Foreign investment', 'FDI', 'oklch(45% 0.16 14)', 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18Z M3 12h18 M12 3c3 3.5 3 14.5 0 18 M12 3c-3 3.5-3 14.5 0 18'],
      ['Tax', 'Tax', 'oklch(50% 0.12 62)', 'M6 3h12v18l-3-2-3 2-3-2-3 2Z M9 9h6 M9 13h6'],
      ['Compliance', 'Compliance', 'oklch(42% 0.08 200)', 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6Z M8.5 12l2.5 2.5 4.5-4.5'],
      ['Northwind’s project', 'Northwind’s project', 'var(--navy)', 'M5 21V4 M5 4h11l-2 4 2 4H5']
    ];
    const B = [
      [0, 'What is SPICe+?'], [0, 'Why the board resolution needs an apostille'], [0, 'DSC and DIN for foreign directors'], [0, 'Rules for the company name'],
      [1, 'FC-GPR after share allotment', true], [1, 'FDI: automatic or approval route'], [1, 'What a FIRC proves'],
      [2, 'When do I need GST registration?'], [2, 'TDS basics for a new company'], [2, 'LUT for export of services'],
      [3, 'Commencement of business (INC-20A)'], [3, 'Auditor appointment (ADT-1)'], [3, 'Northwind’s first-year filing calendar'],
      [4, 'What happens after the COI?'], [4, 'Reading Northwind’s monthly status brief']
    ];
    const q = (s.q || '').trim().toLowerCase();
    const shelves = CAT.map((c, i) => ({ title: c[0], dot: 'background:' + c[2], books: B.filter((b) => b[0] === i && (s.c === 0 || s.c - 1 === i) && (!q || b[1].toLowerCase().includes(q))).map((b) => ({ title: b[1], updated: !!b[2], short: c[1], icon: c[3], style: '--bc:' + c[2] })) })).filter((x) => x.books.length).map((x) => Object.assign(x, { count: x.books.length }));
    const L = ['All', 'Incorporation', 'Foreign inv.', 'Tax', 'Compliance', 'Northwind’s project'];
    return {
      total: B.length,
      tabs: L.map((l, i) => ({ label: l, cnt: i === 0 ? B.length : B.filter((b) => b[0] === i - 1).length, cls: s.c === i ? 'on' : '', sel: s.c === i ? 'true' : 'false', pick: () => this.setState({ c: i }) })),
      thumb: 'transform:translateX(' + (s.c * 100) + '%)', shelves, none: shelves.length === 0, clearQ: () => this.setState({ q: '', c: 0 }), q: s.q || '', onQ: (e) => this.setState({ q: e.target.value })
    };
  }
}
```

### 3.8.1 Book anatomy (128×172)

```
 ┌──────────────────────────────┐  ← .bk-band 5 px gold, from x=11 to right edge, top 0
 │▌ ●(28px disc, glyph 15)  ▼rib│  ← .rib 14×22 blue (--prog-chip) at right 8, only if updated
 │▌                             │
 │▌ Title 700 13/1.32           │  ← 2-line clamp (6 on hover)
 │▌ two lines max…              │
 │▌                             │
 │▌ CATEGORY SHORT 11/700 .8    │  ← margin-top:auto
 └──────────────────────────────┘▒ ← ::after 5 px page edges (striped), right −5, top/bottom 5
  ▲ ::before 11 px spine gradient; radius 2 6 6 2; padding 16 12 12 22
```

## 3.9 Knowledge Bank — recently-read drill

#### Recent drill CSS — `s/docs/lib_recent_drill.dc.html:13-34` (verbatim)

```css
<style>
body{margin:0;-webkit-font-smoothing:antialiased}
:root{--panel:oklch(100% 0 0);--raised:oklch(96.6% 0.007 255);--border:oklch(92.2% 0.011 255);--hair:oklch(94.8% 0.007 255);--fg:oklch(21% 0.042 264);--muted:oklch(46% 0.028 258);--subtle:oklch(55% 0.022 255);--primary:oklch(54.6% 0.215 263);--primary-light:oklch(96.6% 0.02 260);--navy:#0f2a4a;--navy-3:#1b4f94;--gold:#c9a24b;--violet:oklch(54.6% 0.215 263);--ok-chip:oklch(50% 0.12 168)}
a{color:var(--primary);text-decoration:none;font-weight:700}
.mono{font-family:"IBM Plex Mono",monospace;font-feature-settings:"tnum"}
.ib{width:32px;height:32px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box}
.seg{position:relative;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);padding:2px;border-radius:8px;background:light-dark(oklch(96.5% 0.008 250), oklch(18.3% 0.008 250));box-shadow:inset 0 0 0 1px var(--border)}
.seg>.thumb{position:absolute;top:2px;bottom:2px;left:2px;border-radius:6px;background:var(--navy);transition:transform .42s linear(0,0.0637,0.2021,0.3619,0.5141,0.6451,0.7506,0.8315,0.8909,0.9328,0.9613,0.9799,0.9914,0.9981,1.0016,1.0032,1.0036,1.0034,1.0029,1.0023,1.0018,1.0013,1.0009,1.0006,1.0004)}
.seg button{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;background:none;height:28px;border-radius:6px;font:500 12px Manrope,sans-serif;color:light-dark(oklch(50% 0.022 255), oklch(80% 0.015 255));cursor:pointer}
.seg button.on{color:#fff}
.seg .c{font:600 10.5px "IBM Plex Mono",monospace;color:oklch(55% 0.022 255)}
.seg button.on .c{color:oklch(100% 0 0 / .72)}
.row{display:flex;align-items:center;gap:12px;height:56px;padding:0 16px;border-top:1px solid var(--hair);color:var(--fg)}
.row:hover{background:var(--raised)}
.cv{width:30px;height:42px;border-radius:2px 4px 4px 2px;flex:none;box-shadow:inset 4px 0 0 oklch(0% 0 0 / .25)}
.bar{width:140px;height:5px;border-radius:3px;background:var(--raised);overflow:hidden}
.bar>span{display:block;height:100%;background:var(--primary-fill,var(--primary))}
@keyframes pop{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}
.dlg{animation:pop .22s cubic-bezier(.22,1,.36,1) both}
button:focus-visible,a:focus-visible{outline:2px solid oklch(54.6% 0.215 263 / .5);outline-offset:2px}
@media (prefers-reduced-motion: reduce){.dlg{animation:none}.seg>.thumb{transition:none}}
</style>
```

#### Recent drill markup — `s/docs/lib_recent_drill.dc.html:36-57` (verbatim)

```html
<div style="position:relative;width:1440px;height:1000px;overflow:hidden;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
  <div aria-hidden="true" style="position:absolute;inset:0;pointer-events:none"><dc-import name="lib_shelf_a" hint-size="1440px,1000px"></dc-import></div>
  <div style="position:absolute;inset:0;background:oklch(20% 0.05 258 / 0.55);display:flex;align-items:center;justify-content:center">
    <div role="dialog" aria-modal="true" aria-label="Recently read" class="dlg" style="width:600px;background:var(--panel);border-radius:12px;box-shadow:0 24px 60px -20px oklch(15% 0.05 258 / .55);overflow:hidden"><div class="dd-top" style="display:flex;align-items:center;gap:8px;padding:9px 18px;background:var(--primary-light);border-bottom:1px solid var(--border);font-size:12px;color:var(--muted)"><span>These guides live in the Library</span><a href="#" data-go="knowledge-bank" style="margin-left:auto;font-weight:800;font-size:12.5px;white-space:nowrap">Open Library →</a></div>
      <div style="display:flex;align-items:center;gap:10px;height:56px;padding:0 12px 0 18px;border-bottom:1px solid var(--border)">
        <h2 style="margin:0;font:700 15px Manrope,sans-serif;color:var(--navy-ink,var(--navy));flex:1">Recently read</h2>
        <a class="ib" href="lib_shelf_a.dc.html" aria-label="Close"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></a>
      </div>
      <div style="padding:12px 16px"><div class="seg" role="tablist" aria-label="Reading status"><span class="thumb" style="width:calc((100% - 4px)/3);{{thumb}}"></span><sc-for list="{{tabs}}" as="t" hint-placeholder-count="3"><button type="button" role="tab" aria-selected="{{t.sel}}" class="{{t.cls}}" onClick="{{t.pick}}">{{t.label}}<span class="c">{{t.cnt}}</span></button></sc-for></div></div>
      <div style="padding-bottom:6px">
        <sc-for list="{{rows}}" as="r" hint-placeholder-count="3">
          <a class="row" href="lib_reader.dc.html">
            <span class="cv" style="{{r.cv}}"></span>
            <span style="flex:1;font-weight:700">{{r.title}}</span>
            <span class="bar"><span style="{{r.w}}"></span></span>
            <span class="mono" style="width:56px;text-align:right;font-size:11.5px;color:var(--subtle)">{{r.pct}}</span>
          </a>
        </sc-for>
      </div>
    </div>
  </div>
</div>
```

#### Recent drill logic — `s/docs/lib_recent_drill.dc.html:60-73` (verbatim)

```js
class Component extends DCLogic {
  constructor(p) { super(p); this.state = { t: 1 }; }
  renderVals() {
    const s = this.state || {};
    const D = [['FC-GPR after share allotment', 70, 'background:oklch(45% 0.16 14)'], ['What happens after the COI?', 35, 'background:var(--navy);box-shadow:inset 4px 0 0 var(--gold)'], ['What is SPICe+?', 100, 'background:var(--navy-3)']];
    const k = (d) => d[1] === 100 ? 2 : 1;
    const list = D.filter((d) => s.t === 0 || k(d) === s.t);
    return {
      tabs: ['All', 'In progress', 'Finished'].map((l, i) => ({ label: l, cnt: i === 0 ? D.length : D.filter((d) => k(d) === i).length, cls: s.t === i ? 'on' : '', sel: s.t === i ? 'true' : 'false', pick: () => this.setState({ t: i }) })),
      thumb: 'transform:translateX(' + (s.t * 100) + '%)',
      rows: list.map((d) => ({ title: d[0], cv: d[2], w: 'width:' + d[1] + '%', pct: d[1] === 100 ? 'Done' : d[1] + '%' }))
    };
  }
}
```

## 3.10 Knowledge Bank — empty

#### Empty library CSS — `s/docs/lib_empty.dc.html:13-25` (verbatim)

```css
<style>
body{margin:0;-webkit-font-smoothing:antialiased}
:root{--bg:oklch(97.4% 0.006 255);--panel:oklch(100% 0 0);--raised:oklch(96.6% 0.007 255);--border:oklch(92.2% 0.011 255);--fg:oklch(21% 0.042 264);--muted:oklch(46% 0.028 258);--primary:oklch(54.6% 0.215 263);--navy:#0f2a4a;--navy-2:#17396b;--gold:#c9a24b;--violet:oklch(54% 0.17 292);--violet-light:oklch(96.4% 0.032 292);--violet-chip:oklch(50% 0.17 292);--violet-soft:oklch(92% 0.05 292);--violet-text:oklch(42% 0.16 292);--shadow:0 1px 2px oklch(25% 0.04 264 / 0.04), 0 6px 18px -10px oklch(28% 0.06 264 / 0.18)}
a{color:var(--primary);text-decoration:none;font-weight:700}
.card{background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:36px;padding:0 14px;border-radius:6px;font:600 13px Manrope,sans-serif;border:1px solid transparent;text-decoration:none;white-space:nowrap;cursor:pointer}
.btn-n{background:var(--navy);color:#fff}
.q{display:inline-flex;align-items:center;height:32px;padding:0 12px;border-radius:6px;background:var(--violet-light);color:var(--violet-text);box-shadow:inset 0 0 0 1px oklch(54% 0.17 292 / .25);font-size:12.5px}
.bk{position:absolute;bottom:0;border-radius:3px 3px 0 0}
@keyframes rise{from{transform:scaleY(.2)}to{transform:none}}
.bk{transform-origin:bottom;animation:rise .6s cubic-bezier(.22,1,.36,1) both}
@media (prefers-reduced-motion: reduce){.bk{animation:none}}
</style>
```

#### Empty library markup — `s/docs/lib_empty.dc.html:27-49` (verbatim)

```html
<div style="position:relative;width:1440px;height:900px;display:flex;background:var(--bg);font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
  <div style="width:248px;flex:none;background:#0f2a4a"><dc-import name="side" active="5" hint-size="248px,900px" style="display:block;width:248px"></dc-import></div>
  <div style="flex:1;min-width:0">
    <dc-import name="topbar" trail="Library" hint-size="100%,52px" style="display:block"></dc-import>
    <main style="padding:24px;display:flex;flex-direction:column;gap:16px">
      <h1 style="margin:0;font:700 22px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">Library</h1>
      <section class="card" style="min-height:580px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center">
        <div aria-hidden="true" style="position:relative;width:200px;height:110px;border-bottom:3px solid var(--violet-soft)">
          <span class="bk" style="left:30px;width:26px;height:78px;background:var(--violet-chip)"></span>
          <span class="bk" style="left:60px;width:22px;height:94px;background:var(--navy);animation-delay:.08s"></span>
          <span class="bk" style="left:86px;width:30px;height:64px;background:var(--violet-soft);animation-delay:.16s"></span>
          <span class="bk" style="left:122px;width:24px;height:86px;background:var(--gold);animation-delay:.24s;transform:rotate(12deg);transform-origin:bottom left"></span>
          
        </div>
        <div role="status" style="display:flex;align-items:flex-end;gap:10px;justify-content:center;text-align:left"><dc-import name="v7c_bot" state="idle" size="48" hint-size="48px,48px"></dc-import><div style="position:relative;max-width:320px;padding:10px 14px;border-radius:10px 10px 10px 2px;background:var(--panel);border:1px solid var(--border);box-shadow:0 8px 20px -12px oklch(21% 0.042 264 / .35);display:flex;flex-direction:column;align-items:flex-start"><span style="font:600 13px/1.45 Manrope,sans-serif;color:var(--fg)">Northwind’s library is empty. Save an answer from Ask VCFO and it lands here as a book.</span><a href="#" style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;font-size:12px;font-weight:700;color:var(--primary)">Ask VCFO why</a></div></div>
        <button type="button" class="btn btn-n">Ask VCFO</button>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:12px">
          <a class="q" href="#">What is SPICe+?</a><a class="q" href="#">What happens after the COI?</a><a class="q" href="#">When do I need GST?</a>
        </div>
      </section>
    </main>
  </div>
</div>
```

## 3.11 Reader

#### Reader stylesheet (hero, chips, depth pill on dark, focus-track timeline, responsive) — `s/docs/lib_reader.dc.html:13-88` (verbatim)

```css
<style>
body{margin:0;-webkit-font-smoothing:antialiased}
:root{--bg:oklch(97.4% 0.006 255);--panel:oklch(100% 0 0);--raised:oklch(96.6% 0.007 255);--border:oklch(92.2% 0.011 255);--hair:oklch(94.8% 0.007 255);--fg:oklch(21% 0.042 264);--muted:oklch(46% 0.028 258);--subtle:oklch(55% 0.022 255);
--primary:oklch(54.6% 0.215 263);--primary-dark:oklch(48.8% 0.217 264);--primary-light:oklch(96.6% 0.02 260);
--navy:#0f2a4a;--navy-2:#17396b;--navy-3:#1b4f94;--gold:#c9a24b;--gold-soft:#fbf3df;--gold-text:#6e500f;
--ok:oklch(56% 0.13 168);--ok-light:oklch(96% 0.028 170);--ok-text:oklch(39% 0.09 172);--ok-chip:oklch(50% 0.12 168);
--due:oklch(66% 0.17 48);--due-light:oklch(96.8% 0.04 55);--due-text:oklch(48% 0.14 42);--due-chip:oklch(55% 0.17 42);
--over-text:oklch(46% 0.17 20);
--prog:oklch(55% 0.16 252);--prog-light:oklch(96% 0.026 250);--prog-text:oklch(43% 0.13 254);--prog-chip:oklch(51% 0.17 252);
--violet:oklch(54.6% 0.215 263);--violet-light:oklch(96.6% 0.02 260);--violet-chip:oklch(48.8% 0.217 264);--violet-text:oklch(40% 0.17 264);
--shadow:0 1px 2px oklch(25% 0.04 264 / 0.04), 0 6px 18px -10px oklch(28% 0.06 264 / 0.18)}
a{color:var(--primary);text-decoration:none;font-weight:700}a:hover{color:var(--primary-dark)}
.card{position:relative;background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow);min-width:0}
.card.t::before{content:"";position:absolute;left:18px;top:-1px;width:38px;height:3px;border-radius:0 0 3px 3px;background:var(--gold)}
.chip{display:inline-flex;align-items:center;gap:4px;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;line-height:16px;white-space:nowrap}
.cap{font-size:11.5px;color:var(--muted)}
.lbl{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.mono{font-family:"IBM Plex Mono",monospace;font-feature-settings:"tnum"}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:36px;padding:0 14px;border-radius:6px;font:600 13px Manrope,sans-serif;border:1px solid transparent;cursor:pointer;text-decoration:none;white-space:nowrap}
.btn-n{background:var(--navy);color:#fff}.btn-n:hover{background:var(--navy-2);color:#fff}
.btn-o{background:var(--panel);color:var(--fg);border-color:var(--border)}.btn-o:hover{background:var(--raised);color:var(--fg)}
.btn-ok{background:var(--ok-light);color:var(--ok-text);border-color:oklch(56% 0.13 168 / .35)}
.ib{width:36px;height:36px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:none}
.ib:hover{background:light-dark(oklch(96.4% 0.026 18), oklch(24.2% 0.072 18));color:var(--over-text)}
.seg{position:relative;display:inline-grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);padding:2px;border-radius:8px;background:light-dark(oklch(96.5% 0.008 250), oklch(18.3% 0.008 250));box-shadow:inset 0 0 0 1px var(--border)}
.seg>.thumb{position:absolute;top:2px;bottom:2px;left:2px;border-radius:5px;background:var(--navy);box-shadow:0 1px 2px oklch(21% 0.042 264 / .25);transition:transform .42s linear(0,0.0637,0.2021,0.3619,0.5141,0.6451,0.7506,0.8315,0.8909,0.9328,0.9613,0.9799,0.9914,0.9981,1.0016,1.0032,1.0036,1.0034,1.0029,1.0023,1.0018,1.0013,1.0009,1.0006,1.0004)}
.seg button{position:relative;z-index:1;border:0;background:none;height:30px;padding:0 14px;border-radius:5px;font:500 12px Manrope,sans-serif;color:light-dark(oklch(50% 0.022 255), oklch(80% 0.015 255));cursor:pointer;white-space:nowrap;transition:color .2s}
.seg button.on{color:#fff}
.node{display:flex;flex-direction:column;align-items:center;gap:8px;width:170px;text-align:center}
.dot{width:40px;height:40px;border-radius:99px;display:flex;align-items:center;justify-content:center;font:700 13px "IBM Plex Mono",monospace}
.lnk{flex:1;height:3px;border-radius:2px;margin-top:19px}
@keyframes v7pulse{0%,100%{box-shadow:0 0 0 0 oklch(80% 0.12 85 / .7)}50%{box-shadow:0 0 0 7px oklch(80% 0.12 85 / 0)}}
.pulse{animation:v7pulse 1.8s ease-in-out infinite}
a:focus-visible,button:focus-visible{outline:2px solid oklch(54.6% 0.215 263 / .4);outline-offset:2px}
@keyframes v7up{from{opacity:0;transform:translateY(48px)}to{opacity:1;transform:none}}
@keyframes v7bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.botup{animation:v7up .45s cubic-bezier(.22,1,.36,1) .5s both}
.bob{animation:v7bob 2.6s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
/* ---------- v7 responsive (phone <=767 · tablet 768-1279 · desktop >=1280) ---------- */
.vp-sidecol{width:var(--vp-side-w,248px);flex:none;overflow:hidden;background:#0f2a4a}
@media (max-width:1279px){.vp-sidecol{width:var(--vp-side-w,72px)}}
@media (max-width:767px){.vp-sidecol{width:var(--vp-side-w,0px);visibility:hidden}}
.vrd{position:relative;width:100%;min-height:100vh;min-height:100dvh;display:flex;background:var(--bg);font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px}
.vrd-col{flex:1;min-width:0}
.vrd-main{width:100%;max-width:1600px;margin-inline:auto;box-sizing:border-box;padding:clamp(12px,1.8vw,24px) clamp(12px,1.8vw,24px) 96px;display:grid;grid-template-columns:minmax(0,780px) minmax(260px,340px);justify-content:center;gap:20px;align-items:start}
.vrd-art{min-width:0;display:flex;flex-direction:column;gap:16px}
.vrd-side{min-width:0;display:flex;flex-direction:column;gap:16px}
.vrd-hero h1{font:700 clamp(22px,1.2vw + 14px,30px)/1.2 Manrope,sans-serif!important}
.vrd-chips{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.vrd-hrow{display:flex;align-items:center;gap:12px;margin-top:16px;flex-wrap:wrap}
.vrd-tl{display:flex;align-items:flex-start}
.vrd-tl .node{flex:0 1 170px;width:auto;min-width:0}
.vrd-tl .lnk{min-width:24px}
.vrd-lead{max-width:68ch}
@media (max-width:1100px){
  .vrd-main{grid-template-columns:minmax(0,780px)}
  .vrd-side{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));align-items:start}
}
@media (max-width:767px){
  .vrd-hero{padding:18px 16px 16px!important}
  .vrd-body{padding:18px 16px!important}
  .vrd-lead{font-size:16px!important}
  .vrd-tl{flex-direction:column;align-items:stretch}
  .vrd-tl .node{flex:none;flex-direction:row;align-items:center;text-align:left;gap:12px;width:auto}
  .vrd-tl .node>span:nth-child(2){flex:1;min-width:0}
  .vrd-tl .lnk{flex:none;width:3px;height:22px;min-width:0;margin:4px 0 4px 18px}
  .vrd-tl .lnk.dash{background:repeating-linear-gradient(180deg,var(--primary) 0 6px,transparent 6px 11px)!important}
  .vrd-facts{grid-template-columns:minmax(0,1fr)!important}
  .vrd .btn{height:40px}
  .vrd .ib{width:40px;height:40px}
  .vrd .seg button{height:36px;padding:0 12px}
  .vrd-src a{height:auto!important;min-height:40px;white-space:normal}
  .vrd-side a{min-height:40px}
}
</style>
```

#### Reader markup — `s/docs/lib_reader.dc.html:90-164` (verbatim)

```html
<div class="vrd">
  <div class="vp-sidecol" data-vp="side"><dc-import name="side" active="5" hint-size="248px,900px" style="display:block;width:248px"></dc-import></div>
  <div class="vrd-col">
    <dc-import name="topbar" trail="{{trail}}" leaf="FC-GPR after share allotment" hint-size="100%,52px" style="display:block"></dc-import>
    <main class="vrd-main">
      <article class="vrd-art">
        <section class="vrd-hero" style="position:relative;border-radius:10px;padding:22px 24px 20px;background:linear-gradient(115deg,var(--navy-deep,var(--navy)) 0%,var(--navy-2-deep,var(--navy-2)) 62%,oklch(38% 0.12 292) 100%);color:#fff;overflow:hidden">
          <div class="vrd-chips"><span class="chip" style="background:oklch(100% 0 0 / .14);color:#fff;box-shadow:inset 0 0 0 1px oklch(100% 0 0 / .25)">Foreign investment</span><span class="chip" style="background:var(--ok-chip);color:#fff;min-width:116px;justify-content:center"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>Reviewed by SBC</span><sc-if value="{{saved}}" hint-placeholder-val="{{true}}"><span class="chip" style="background:var(--prog-chip);color:#fff;min-width:116px;justify-content:center">Updated 6 Nov</span></sc-if></div>
          <h1 style="margin:12px 0 0;font:700 28px/1.2 Manrope,sans-serif;letter-spacing:-.015em;color:#fff">FC-GPR after share allotment</h1>
          <div class="vrd-hrow">
            <div class="seg" role="group" aria-label="Depth" style="background:oklch(100% 0 0 / .1);box-shadow:inset 0 0 0 1px oklch(100% 0 0 / .2)"><span class="thumb" style="width:calc((100% - 4px)/3);background:light-dark(#fff, oklch(13% 0 89.9));{{dThumb}}"></span><sc-for list="{{depths}}" as="d" hint-placeholder-count="3"><button type="button" aria-pressed="{{d.sel}}" onClick="{{d.pick}}" style="{{d.style}}">{{d.label}}</button></sc-for></div>
            <span style="flex:1"></span>
            <span class="mono" style="font-size:11px;opacity:.7">3 min read</span><a href="https://firms.rbi.org.in" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border-radius:6px;background:oklch(100% 0 0 / .12);box-shadow:inset 0 0 0 1px oklch(100% 0 0 / .28);color:#fff;font-size:12px">Official link · RBI FIRMS<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 16L16 8 M9 8h7v7"></path></svg><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)"> (opens in a new tab)</span></a>
          </div>
          <span style="position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,var(--gold),oklch(78% 0.1 85 / 0) 70%)"></span>
        </section>

        <section class="card vrd-body" style="padding:22px 24px;display:flex;flex-direction:column;gap:18px">
          <p class="vrd-lead" style="margin:0;font-size:17px;line-height:1.6;font-weight:500">{{line}}</p>
          <div style="border-radius:10px;background:var(--primary-light);padding:22px 20px">
            <div class="lbl" style="color:var(--violet-text);margin-bottom:16px">Timeline</div>
            <div class="vrd-tl">
              <div class="node"><span class="dot" style="background:var(--ok-chip);color:#fff"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg></span><span style="font-weight:700;font-size:13px">Shares allotted</span><span class="mono cap">Day 0 · 2 Nov</span></div>
              <span class="lnk" style="background:var(--ok)"></span>
              <div class="node"><span class="dot pulse" style="background:var(--navy);color:#fff;box-shadow:0 0 0 3px var(--gold)">2</span><span style="font-weight:700;font-size:13px">FIRC + KYC from bank</span><span class="mono cap">Now</span></div>
              <span class="lnk dash" style="background:repeating-linear-gradient(90deg,var(--primary) 0 6px,transparent 6px 11px)"></span>
              <div class="node"><span class="dot" style="background:var(--panel);color:var(--violet-text);border:2px dashed var(--primary)">3</span><span style="font-weight:700;font-size:13px">File FC-GPR on FIRMS</span><span class="mono cap">By day 30 · 2 Dec</span></div>
            </div>
          </div>
          <sc-if value="{{detail}}" hint-placeholder-val="{{false}}"><div class="vrd-facts" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px"><div style="padding:12px;border-radius:8px;background:var(--raised)"><div class="lbl">Who files</div><div style="font-weight:700;margin-top:4px">SBC, for Northwind</div></div><div style="padding:12px;border-radius:8px;background:var(--raised)"><div class="lbl">Late fee</div><div style="font-weight:700;margin-top:4px">LSF, per RBI</div></div><div style="padding:12px;border-radius:8px;background:var(--raised)"><div class="lbl">Portal</div><div style="font-weight:700;margin-top:4px">RBI FIRMS</div></div></div></sc-if>
          <div style="display:flex;gap:12px;align-items:flex-start;padding:14px 16px;border-radius:8px;background:var(--gold-soft);border:1px solid oklch(75% 0.1 85 / .45)">
            <span style="width:28px;height:28px;border-radius:99px;background:var(--gold);color:var(--navy);display:flex;align-items:center;justify-content:center;flex:none"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7Z"></path></svg></span>
            <div><h2 style="margin:0;font:700 13px Manrope,sans-serif;color:var(--gold-text)">Why it matters to Northwind</h2><p style="margin:4px 0 0;font-size:13.5px;line-height:1.55">Northwind’s parent company sent the share money on 2 Nov. If FC-GPR is late, the RBI charges a late fee and the shares stay unreported.</p></div>
          </div>
          <div>
            <div class="lbl" style="margin-bottom:6px">Sources</div>
            <ul class="vrd-src" style="margin:0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:8px">
              <li><a href="#" class="chip" style="height:26px;padding:0 9px;background:var(--raised);color:var(--fg);box-shadow:inset 0 0 0 1px var(--border);font-weight:600">FEMA (Non-debt Instruments) Rules, 2019 ↗</a></li>
              <li><a href="#" class="chip" style="height:26px;padding:0 9px;background:var(--raised);color:var(--fg);box-shadow:inset 0 0 0 1px var(--border);font-weight:600">RBI Master Direction — Foreign Investment ↗</a></li>
            </ul>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-top:14px;border-top:1px solid var(--border)">
            <sc-if value="{{saved}}" hint-placeholder-val="{{true}}"><span class="btn btn-ok"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>Saved to library</span></sc-if>
            <sc-if value="{{learn}}" hint-placeholder-val="{{false}}"><button type="button" class="btn btn-n"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 4h11v16l-5.5-4-5.5 4Z"></path></svg>Save to library</button></sc-if>
            <a class="btn btn-o" href="#"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11 M7.5 10.5 12 15l4.5-4.5 M5 19.5h14"></path></svg>PDF brief</a>
            <button type="button" class="btn btn-o"><dc-import name="v7c_bot" state="idle" size="18" hint-size="18px,18px"></dc-import>Ask a follow-up</button>
            <span style="flex:1"></span>
            <sc-if value="{{saved}}" hint-placeholder-val="{{true}}"><button type="button" class="ib" aria-label="Remove from library"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 7h15 M9.5 7V4.5h5V7 M6.5 7l1 12.5h9l1-12.5"></path></svg></button></sc-if>
          </div>
        </section>
      </article>

      <aside class="vrd-side">
        <section class="card t" style="padding:14px 16px;display:flex;flex-direction:column;gap:12px">
          <h2 style="margin:0;font:700 13px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">In Northwind’s project</h2>
          <div style="display:flex;align-items:center;gap:12px">
            <span style="width:50px;height:54px;border-radius:8px;background:var(--due-chip);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;flex:none"><span style="font:700 11px Manrope,sans-serif;letter-spacing:.06em">DEC</span><span style="font:600 20px/1 'Space Grotesk'">2</span></span>
            <div style="flex:1"><div style="font-weight:700">FC-GPR filing</div><div style="display:flex;gap:6px;margin-top:4px"><span class="chip" style="background:var(--due-light);color:var(--due-text)">24 days left</span><span class="chip" style="background:var(--raised);color:var(--muted)">SBC files</span></div></div>
          </div>
          <a href="#" style="font-size:12px">Open in Compliances</a>
        </section>
        <section class="card" style="padding:14px 16px;display:flex;flex-direction:column;gap:4px">
          <h2 style="margin:0 0 6px;font:700 13px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">Related in Northwind’s library</h2>
          <a href="#" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--hair);color:var(--fg);font-weight:600"><span style="width:28px;height:28px;border-radius:6px;background:var(--primary-light);color:var(--violet-text);display:flex;align-items:center;justify-content:center;flex:none"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 6h4v4H5Z M15 14h4v4h-4Z M9 8h4a2 2 0 0 1 2 2v4"></path></svg></span>What is SPICe+?</a>
          <a href="#" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--hair);color:var(--fg);font-weight:600"><span style="width:28px;height:28px;border-radius:6px;background:var(--primary-light);color:var(--violet-text);display:flex;align-items:center;justify-content:center;flex:none"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M7 7h10 M7 12h10 M7 17h6"></path></svg></span>Commencement of business (INC-20A)</a>
        </section>
        <section class="card" style="padding:14px 16px;display:flex;flex-direction:column;gap:8px">
          <h2 style="margin:0;font:700 13px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">Documents for this</h2>
          <a href="docs_preview.dc.html" style="display:flex;align-items:center;gap:10px;color:var(--fg);font-weight:600"><span class="mono" style="font-size:11px;font-weight:600;padding:2px 5px;border-radius:4px;background:light-dark(oklch(96.4% 0.026 18), oklch(24.2% 0.072 18));color:var(--over-text)">PDF</span><span style="flex:1">FIRC from the bank</span><span class="chip" style="background:var(--ok-light);color:var(--ok-text)">Approved</span></a>
        </section>
      </aside>
    </main>
  </div>
  <div style="position:absolute;top:0;right:0;width:min(420px,100%);height:min(900px,100vh);pointer-events:none;z-index:5"><div style="pointer-events:auto"><div class="botup" style="position:absolute;right:24px;bottom:24px;display:flex;flex-direction:column;align-items:center;gap:6px"><span style="background:var(--navy);color:#fff;font-size:12px;font-weight:700;border-radius:6px;padding:4px 10px;position:relative">Ask VCFO<span style="position:absolute;left:50%;bottom:-4px;width:8px;height:8px;background:var(--navy);transform:translateX(-50%) rotate(45deg)"></span></span><button type="button" aria-label="Open Ask VCFO" style="width:68px;height:68px;border-radius:99px;border:0;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));box-shadow:0 10px 24px -8px oklch(25% 0.06 258 / 0.45),0 0 0 1px var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer"><span class="bob" style="display:flex"><dc-import name="v7c_bot" state="idle" size="50" hint-size="50px,50px"></dc-import></span></button></div></div></div>
</div>
```

#### Reader logic (mode saved|learn, depth lines) — `s/docs/lib_reader.dc.html:167-184` (verbatim)

```js
class Component extends DCLogic {
  constructor(p) { super(p); this.state = { d: 1 }; }
  renderVals() {
    const s = this.state || {};
    const learn = (this.props.mode ?? 'saved') === 'learn';
    const LINES = [
      'Tell the RBI about the shares Northwind gave its parent company. Do it within 30 days.',
      'After Northwind allots shares to a foreign investor, it must be reported to the RBI on the FIRMS portal in form FC-GPR within 30 days of the allotment date.',
      'FC-GPR reports a fresh issue of shares to a person resident outside India. File it on RBI FIRMS within 30 days of allotment, with the FIRC, the KYC letter from the AD bank, the valuation certificate and the CS certificate.'
    ];
    return {
      saved: !learn, learn, trail: 'Library',
      line: LINES[s.d], detail: s.d === 2,
      dThumb: 'transform:translateX(' + (s.d * 100) + '%)',
      depths: ['Simpler', 'Normal', 'More detail'].map((l, i) => ({ label: l, sel: s.d === i ? 'true' : 'false', style: s.d === i ? 'color:var(--navy-ink,var(--navy));font-weight:700' : 'color:oklch(100% 0 0 / .78)', pick: () => this.setState({ d: i }) }))
    };
  }
}
```

## 3.12 Top bar (shared shell piece)

#### Top bar CSS (responsive: search folds ≤1279, menu button ≤767) — `s/docs/topbar.dc.html:13-35` (verbatim)

```css
<style>
body{margin:0;-webkit-font-smoothing:antialiased}
:root{--bg:oklch(97.4% 0.006 255);--panel:oklch(100% 0 0);--raised:oklch(96.6% 0.007 255);--border:oklch(92.2% 0.011 255);--hair:oklch(94.8% 0.007 255);--fg:oklch(21% 0.042 264);--muted:oklch(46% 0.028 258);--subtle:oklch(55% 0.022 255);--primary:oklch(54.6% 0.215 263);--primary-light:oklch(96.6% 0.02 260);--navy:#0f2a4a}
.kbd{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;border-radius:4px;background:var(--raised);box-shadow:inset 0 0 0 1px var(--border);font:500 10px "IBM Plex Mono",monospace;color:var(--muted)}
.duo{fill:currentColor;stroke:none;opacity:.26}
.tbb{position:relative;width:36px;height:36px;border-radius:6px;border:0;background:transparent;color:var(--muted);display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer}
.tbb:hover{background:var(--primary-light);color:var(--fg)}
button:focus-visible,a:focus-visible{outline:2px solid oklch(54.6% 0.215 263 / .4);outline-offset:2px}
/* v7 responsive: phone <=767 shows the menu button; the search box folds to an icon below 1180 px */
.vtb{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:0 16px;min-width:0}
.vtb-menu{display:none}
.vtb-srch{display:flex;align-items:center;gap:8px;width:clamp(180px,18vw,256px);height:36px;padding:0 10px 0 12px;border-radius:6px;border:1px solid light-dark(oklch(91.5% 0.012 255 / .7), oklch(25.4% 0.012 255 / 0.7));background:light-dark(oklch(96.8% 0.006 250 / .5), oklch(17.8% 0.006 250 / 0.5));color:var(--muted);font:500 13px Manrope,sans-serif;cursor:text;box-sizing:border-box}
.kbd{font-size:11px}
@media (max-width:1279px){.vtb-srch{width:36px;padding:0;justify-content:center}.vtb-srch .vtb-t,.vtb-srch .kbd{display:none}}
@media (max-width:767px){
  .vtb{gap:6px;padding:0 8px}
  .vtb-menu{display:flex}
  .vtb .tbb,.vtb-srch{width:40px;height:40px}
  .vtb-logo img{height:22px!important}
  .vtb-ci,.vtb-theme{display:none!important}
  .vtb-act{gap:2px!important}
}
</style>
```

#### Top bar markup — `s/docs/topbar.dc.html:37-53` (verbatim)

```html
<header class="vtb" style="border-bottom:1px solid light-dark(oklch(91.5% 0.012 255 / .6), oklch(25.4% 0.012 255 / 0.6));background:light-dark(oklch(100% 0 0 / .9), oklch(13% 0 0 / 0.9));font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
  <button type="button" class="tbb vtb-menu" data-vp-menu aria-label="Open menu" onClick="{{openSide}}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"></path></svg></button>
  <a href="#" class="vtb-logo" aria-label="SBC home" style="display:flex;flex:none"><img src="vcfo-bin:b/58380a4992a06cfe5c18a947b721abdf.png" alt="SBC" style="height:26px;width:auto"></a>
  <nav aria-label="Location" style="flex:1;min-width:0;display:flex;align-items:center;gap:6px">
    <span class="vtb-ci" style="flex:none;width:24px;height:24px;border-radius:6px;background:var(--primary-light);color:var(--primary);display:grid;place-items:center"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="duo" d="M3.5 8h17v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18Z"></path><path d="M3.5 18V6A1.5 1.5 0 0 1 5 4.5h4l2 2.5h8a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18Z"></path></svg></span>
    <ol style="display:flex;align-items:center;gap:4px;min-width:0;margin:0;padding:0;list-style:none;overflow:hidden">
      <li style="font-size:13px;font-weight:{{w1}};color:{{c1}};white-space:nowrap">{{trail}}</li>
      <sc-if value="{{hasLeaf}}" hint-placeholder-val="{{false}}"><li aria-hidden="true" style="color:var(--subtle)">/</li><li aria-current="page" style="min-width:48px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600;color:var(--fg)">{{leaf}}</li></sc-if>
    </ol>
  </nav>
  <div class="vtb-act" style="margin-left:auto;flex:none;display:flex;align-items:center;gap:6px">
    <button type="button" class="vtb-srch" aria-label="Search (⌘K)" style="{{searchStyle}}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="color:oklch(54.6% 0.215 263 / .8)"><path d="M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M16 16l4 4"></path></svg><span class="vtb-t" style="flex:1;text-align:left">Search</span><span class="kbd">⌘</span><span class="kbd">K</span></button>
    <button type="button" class="tbb" aria-label="Announcements"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="duo" d="M4 10h3l8-4.5v13L7 14H4Z"></path><path d="M4 10h3l8-4.5v13L7 14H4Z M7 14l1.5 5.5H11L10 14 M18 9.5a3.5 3.5 0 0 1 0 5"></path></svg></button>
    <button type="button" class="tbb" aria-label="Notifications, 3 new" style="background:var(--primary-light);color:var(--primary)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="duo" d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4.5 1.8 6.5 1.8 6.5H4.7S6.5 14.5 6.5 10Z"></path><path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4.5 1.8 6.5 1.8 6.5H4.7S6.5 14.5 6.5 10Z M10 19.5a2.2 2.2 0 0 0 4 0"></path></svg><span style="position:absolute;top:4px;right:4px;min-width:17px;height:17px;padding:0 3px;box-sizing:border-box;border-radius:99px;background:var(--primary-fill,var(--primary));color:#fff;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px var(--panel)">3</span></button>
    <button type="button" class="vtb-theme" aria-label="Switch to dark theme" style="width:36px;height:36px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="duo" d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7Z"></path><path d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7Z M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6 7 7 M17 17l1.4 1.4 M5.6 18.4 7 17 M17 7l1.4-1.4"></path></svg></button>
  </div>
</header>
```

#### Top bar logic (trail/leaf) — `s/docs/topbar.dc.html:56-67` (verbatim)

```js
class Component extends DCLogic {
  renderVals() {
    const leaf = this.props.leaf ?? '';
    const has = !!leaf;
    return {
      trail: this.props.trail ?? 'Documents', leaf, hasLeaf: has,
      w1: has ? 500 : 600, c1: has ? 'var(--muted)' : 'var(--fg)',
      searchStyle: this.props.compact ? 'display:none' : '',
      openSide: (e) => { if (e && e.defaultPrevented) return; if (window.vcfoOpenSide) window.vcfoOpenSide(); else if (window.vcfoShell && window.vcfoShell.openDrawer) window.vcfoShell.openDrawer(); }
    };
  }
}
```

## 3.13 Bot avatar (used in every empty / no-match bubble)

#### Bot motion CSS — `s/docs/v7c_bot.dc.html:127-134` (verbatim)

```css
</style><style>@keyframes v7pulse{0%,100%{box-shadow:0 0 0 0 oklch(80% 0.12 85 / .7)}50%{box-shadow:0 0 0 5px oklch(80% 0.12 85 / 0)}}.pulse{animation:v7pulse 1.8s ease-in-out infinite}@media (prefers-reduced-motion: reduce){.pulse{animation:none}}</style><style>
/* owner character, static head. Moods: antenna colour (idle teal, answered green, cannot grey); thinking = antenna pulse + eyes scan. The smile never changes. */
.vb-scan{animation:vbScan 1.3s ease-in-out infinite}
@keyframes vbScan{0%,100%{transform:translateX(-9px)}50%{transform:translateX(9px)}}
.vb-ant{animation:vbAnt 1s ease-in-out infinite}
@keyframes vbAnt{50%{opacity:.35}}
@media (prefers-reduced-motion: reduce){.vb-scan,.vb-ant{animation:none}}
</style>
```

#### Bot markup (4 states: idle, thinking, answered, cannot) — `s/docs/v7c_bot.dc.html:136-136` (same markup, one tag per line for reading; whitespace only)

```html
<div style="{{box}}">
<sc-if value="{{idle}}" hint-placeholder-val="{{true}}">
<svg viewBox="0 -40 240 240" width="100%" height="100%" role="img" aria-label="Ask VCFO assistant">
<defs>
<linearGradient id="{{gid}}" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#4C8DF8">
</stop>
<stop offset="1" stop-color="#1D4ED8">
</stop>
</linearGradient>
<filter id="{{fid}}" x="-60%" y="-60%" width="220%" height="220%">
<feGaussianBlur stdDeviation="3" result="b">
</feGaussianBlur>
<feMerge>
<feMergeNode in="b">
</feMergeNode>
<feMergeNode in="SourceGraphic">
</feMergeNode>
</feMerge>
</filter>
<clipPath id="{{cid}}">
<rect x="-10" y="-40" width="260" height="240">
</rect>
</clipPath>
</defs>
<g clip-path="{{curl}}">
<line x1="120" y1="46" x2="120" y2="24" stroke="#1E40AF" stroke-width="5" stroke-linecap="round">
</line>
<circle class="" cx="120" cy="18" r="8" fill="#2DD4BF">
</circle>
<rect x="14" y="112" width="20" height="46" rx="10" fill="#1E40AF">
</rect>
<rect x="206" y="112" width="20" height="46" rx="10" fill="#1E40AF">
</rect>
<rect x="30" y="44" width="180" height="210" rx="56" fill="{{gurl}}">
</rect>
<path d="M62 56 q30 -10 60 -8" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round" fill="none">
</path>
<rect x="50" y="84" width="140" height="82" rx="36" fill="#0B1736">
</rect>
<rect x="64" y="91" width="54" height="7" rx="3.5" fill="#fff" fill-opacity=".08">
</rect>
<g class="" filter="{{furl}}" fill="#7DD3FC">
<rect x="88" y="109" width="22" height="30" rx="11">
</rect>
<rect x="130" y="109" width="22" height="30" rx="11">
</rect>
<path d="M103 148 Q120 161 137 148" fill="none" stroke="#7DD3FC" stroke-width="5" stroke-linecap="round">
</path>
</g>
<rect x="104" y="180" width="32" height="5" rx="2.5" fill="#1E3A8A" fill-opacity=".7">
</rect>
</g>
</svg>
</sc-if>
<sc-if value="{{thinking}}" hint-placeholder-val="{{false}}">
<svg viewBox="0 -40 240 240" width="100%" height="100%" role="img" aria-label="Ask VCFO assistant, thinking">
<defs>
<linearGradient id="{{gid}}" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#4C8DF8">
</stop>
<stop offset="1" stop-color="#1D4ED8">
</stop>
</linearGradient>
<filter id="{{fid}}" x="-60%" y="-60%" width="220%" height="220%">
<feGaussianBlur stdDeviation="3" result="b">
</feGaussianBlur>
<feMerge>
<feMergeNode in="b">
</feMergeNode>
<feMergeNode in="SourceGraphic">
</feMergeNode>
</feMerge>
</filter>
<clipPath id="{{cid}}">
<rect x="-10" y="-40" width="260" height="240">
</rect>
</clipPath>
</defs>
<g clip-path="{{curl}}">
<line x1="120" y1="46" x2="120" y2="24" stroke="#1E40AF" stroke-width="5" stroke-linecap="round">
</line>
<circle class="vb-ant" cx="120" cy="18" r="8" fill="#7DD3FC">
</circle>
<rect x="14" y="112" width="20" height="46" rx="10" fill="#1E40AF">
</rect>
<rect x="206" y="112" width="20" height="46" rx="10" fill="#1E40AF">
</rect>
<rect x="30" y="44" width="180" height="210" rx="56" fill="{{gurl}}">
</rect>
<path d="M62 56 q30 -10 60 -8" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round" fill="none">
</path>
<rect x="50" y="84" width="140" height="82" rx="36" fill="#0B1736">
</rect>
<rect x="64" y="91" width="54" height="7" rx="3.5" fill="#fff" fill-opacity=".08">
</rect>
<g class="vb-scan" filter="{{furl}}" fill="#7DD3FC">
<rect x="88" y="109" width="22" height="30" rx="11">
</rect>
<rect x="130" y="109" width="22" height="30" rx="11">
</rect>
<path d="M103 148 Q120 161 137 148" fill="none" stroke="#7DD3FC" stroke-width="5" stroke-linecap="round">
</path>
</g>
<rect x="104" y="180" width="32" height="5" rx="2.5" fill="#1E3A8A" fill-opacity=".7">
</rect>
</g>
</svg>
</sc-if>
<sc-if value="{{answered}}" hint-placeholder-val="{{false}}">
<svg viewBox="0 -40 240 240" width="100%" height="100%" role="img" aria-label="Ask VCFO assistant, answered">
<defs>
<linearGradient id="{{gid}}" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#4C8DF8">
</stop>
<stop offset="1" stop-color="#1D4ED8">
</stop>
</linearGradient>
<filter id="{{fid}}" x="-60%" y="-60%" width="220%" height="220%">
<feGaussianBlur stdDeviation="3" result="b">
</feGaussianBlur>
<feMerge>
<feMergeNode in="b">
</feMergeNode>
<feMergeNode in="SourceGraphic">
</feMergeNode>
</feMerge>
</filter>
<clipPath id="{{cid}}">
<rect x="-10" y="-40" width="260" height="240">
</rect>
</clipPath>
</defs>
<g clip-path="{{curl}}">
<line x1="120" y1="46" x2="120" y2="24" stroke="#1E40AF" stroke-width="5" stroke-linecap="round">
</line>
<circle class="" cx="120" cy="18" r="8" fill="#34D399">
</circle>
<rect x="14" y="112" width="20" height="46" rx="10" fill="#1E40AF">
</rect>
<rect x="206" y="112" width="20" height="46" rx="10" fill="#1E40AF">
</rect>
<rect x="30" y="44" width="180" height="210" rx="56" fill="{{gurl}}">
</rect>
<path d="M62 56 q30 -10 60 -8" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round" fill="none">
</path>
<rect x="50" y="84" width="140" height="82" rx="36" fill="#0B1736">
</rect>
<rect x="64" y="91" width="54" height="7" rx="3.5" fill="#fff" fill-opacity=".08">
</rect>
<g class="" filter="{{furl}}" fill="#7DD3FC">
<rect x="88" y="109" width="22" height="30" rx="11">
</rect>
<rect x="130" y="109" width="22" height="30" rx="11">
</rect>
<path d="M103 148 Q120 161 137 148" fill="none" stroke="#7DD3FC" stroke-width="5" stroke-linecap="round">
</path>
</g>
<rect x="104" y="180" width="32" height="5" rx="2.5" fill="#1E3A8A" fill-opacity=".7">
</rect>
</g>
</svg>
</sc-if>
<sc-if value="{{cannot}}" hint-placeholder-val="{{false}}">
<svg viewBox="0 -40 240 240" width="100%" height="100%" role="img" aria-label="Ask VCFO assistant, cannot answer">
<defs>
<linearGradient id="{{gid}}" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#4C8DF8">
</stop>
<stop offset="1" stop-color="#1D4ED8">
</stop>
</linearGradient>
<filter id="{{fid}}" x="-60%" y="-60%" width="220%" height="220%">
<feGaussianBlur stdDeviation="3" result="b">
</feGaussianBlur>
<feMerge>
<feMergeNode in="b">
</feMergeNode>
<feMergeNode in="SourceGraphic">
</feMergeNode>
</feMerge>
</filter>
<clipPath id="{{cid}}">
<rect x="-10" y="-40" width="260" height="240">
</rect>
</clipPath>
</defs>
<g clip-path="{{curl}}">
<line x1="120" y1="46" x2="120" y2="24" stroke="#1E40AF" stroke-width="5" stroke-linecap="round">
</line>
<circle class="" cx="120" cy="18" r="8" fill="#94A3B8">
</circle>
<rect x="14" y="112" width="20" height="46" rx="10" fill="#1E40AF">
</rect>
<rect x="206" y="112" width="20" height="46" rx="10" fill="#1E40AF">
</rect>
<rect x="30" y="44" width="180" height="210" rx="56" fill="{{gurl}}">
</rect>
<path d="M62 56 q30 -10 60 -8" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round" fill="none">
</path>
<rect x="50" y="84" width="140" height="82" rx="36" fill="#0B1736">
</rect>
<rect x="64" y="91" width="54" height="7" rx="3.5" fill="#fff" fill-opacity=".08">
</rect>
<g class="" filter="{{furl}}" fill="#7DD3FC">
<rect x="88" y="109" width="22" height="30" rx="11">
</rect>
<rect x="130" y="109" width="22" height="30" rx="11">
</rect>
<path d="M103 148 Q120 161 137 148" fill="none" stroke="#7DD3FC" stroke-width="5" stroke-linecap="round">
</path>
</g>
<rect x="104" y="180" width="32" height="5" rx="2.5" fill="#1E3A8A" fill-opacity=".7">
</rect>
</g>
</svg>
</sc-if>
</div>
```

#### Bot logic — `s/docs/v7c_bot.dc.html:139-143` (verbatim)

```js
class Component extends DCLogic {
  renderVals() {
    const p = this.props || {}; const st = p.state || 'idle'; const sz = Number(p.size || 56);if (!this._u) this._u = 'vb' + Math.random().toString(36).slice(2, 8);const u = this._u; const o = { box: 'display:flex;width:' + sz + 'px;height:' + sz + 'px', gid: u + 'h', fid: u + 'g', cid: u + 'c', gurl: 'url(#' + u + 'h)', furl: 'url(#' + u + 'g)', curl: 'url(#' + u + 'c)' }; ['idle','thinking','answered','cannot'].forEach((k) => { o[k] = st === k; }); return o;
  }
}
```

## 3.14 Shell sidebar CSS (runtime, replaces the `side` placeholder)

Shown for completeness of the Documents/Library frame (active pill + rail spring, item metrics). The nav model is at `shell.js:91-101`.

#### shell.js nav model + sidebar CSS (first part) — `shell.js:90-170` (verbatim)

```js
  /* ---------- the one navigation model ---------- */
  var NAV = [
    { k: 'home', t: 'Home', i: 'layout-dashboard' },
    { g: 'updates', t: 'Updates', i: 'megaphone', badge: '3', hot: true, kids: [{ k: 'announcements', t: 'Announcements' }, { k: 'notifications', t: 'Notifications', badge: '3', hot: true }] },
    { k: 'incorporation', t: 'Incorporation', i: 'building-2', badge: 'inc' },
    { g: 'compliances', t: 'Compliances', i: 'calendar-check', kids: [{ k: 'compliances', t: 'Calendar' }, { k: 'filings', t: 'Filings' }] },
    { k: 'documents', t: 'Documents', i: 'folder-open', badge: '6' },
    { k: 'knowledge-bank', t: 'Library', i: 'library' },
    { k: 'credentials', t: 'Credentials', i: 'key-round' },
    { k: 'team', t: 'Team', i: 'users' },
    { k: 'audit', t: 'Audit', i: 'history' },
    { k: 'settings', t: 'Settings', i: 'settings' }
  ];
  var ALIAS = { 'inc-phase-a': 'incorporation', 'inc-phase-3': 'incorporation', 'inc-phase-4': 'incorporation', 'credentials': 'credentials', 'home-after': 'home', 'home-chat': 'home', 'ids-password': 'home', 'inc-phase': 'incorporation', 'inc-step7': 'incorporation', 'inc-step10': 'incorporation', 'board-resolution': 'incorporation', 'doc-viewer': 'documents', 'kb-reader': 'knowledge-bank' };
  function active() { var h = window.vcfoHere ? window.vcfoHere() : null; if (/^inc-step/.test(h || '')) return 'incorporation'; return ALIAS[h] || h; }
  var TEAM = [
    { n: 'Priya Raman', r: 'Project Manager', ini: 'PR', c: ['wa', 'call', 'mail', 'teams'] },
    { n: 'Arjun Mehta', r: 'Project Lead', ini: 'AM', c: ['wa', 'call', 'mail', 'teams'] },
    { n: 'Customer support', r: 'SBC help desk', ini: 'CS', sup: true, c: ['wa', 'mail', 'teams', 'call'] }
  ];
  var VERB = { wa: 'WhatsApp', call: 'Call', mail: 'Email', teams: 'Teams' };
  var ME = { n: 'Rohan Kumar', r: 'Northwind · Client', ini: 'RK' };

  /* ---------- styles ---------- */
  var css = document.createElement('style'); css.id = 'vp-shell-css';
  css.textContent = [
    '.vps{position:fixed;top:0;z-index:45;height:100vh;display:flex;flex-direction:column;background:#0f2a4a;color:#fff;font:500 13px/1.4 Manrope,system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;box-sizing:border-box}',
    '@supports (height:100dvh){#vp-side,#vp-drawer{height:100dvh}}',
    '.vps::-webkit-scrollbar{display:none}',
    '.vps div,.vps span,.vps a,.vps button,.vps b,.vps small,.vps nav,.vps img,.vps svg{margin:0;padding:0;border:0;background:none;box-shadow:none;position:static;float:none;min-width:0;max-width:none;letter-spacing:normal;text-transform:none;text-decoration:none;font-style:normal;box-sizing:border-box;opacity:1;filter:none}',
    '.vps svg{flex:0 0 auto;display:block}',
    '.vps a,.vps button{font:inherit;color:inherit;text-decoration:none}',
    '.vps button{border:0;background:none;cursor:pointer;padding:0}',
    '.vps :focus-visible{outline:2px solid #8fb4ff;outline-offset:2px;border-radius:8px}',
    '#vp-side{left:0;width:var(--vp-side-w,248px)}',
    '.vps .vps-logo{flex:0 0 auto;height:64px;display:flex;align-items:center;padding:0 18px;border-bottom:1px solid rgba(255,255,255,.08)}',
    '.vps .vps-logo img{display:block;height:34px;width:auto;max-width:100%;object-fit:contain;object-position:left center}',
    '.vps .vps-nav{position:relative;display:flex;flex-direction:column;gap:2px;padding:12px 8px}',
    '.vps .vps-pill{position:absolute;left:8px;right:8px;top:0;height:36px;border-radius:8px;background:rgba(255,255,255,.1);box-shadow:inset 0 0 0 1px rgba(110,150,255,.42),inset 0 1px 0 rgba(255,255,255,.12);pointer-events:none;will-change:transform;transition:transform .42s cubic-bezier(.22,1.2,.36,1),height .3s cubic-bezier(.22,1,.36,1),opacity .2s}',
    '.vps .vps-rail{position:absolute;left:8px;top:0;width:3px;height:20px;border-radius:99px;background:#6e96ff;pointer-events:none;will-change:transform;transition:transform .42s cubic-bezier(.22,1.2,.36,1)}',
    '.vps .vps-i{position:relative;z-index:1;display:flex;align-items:center;gap:11px;width:100%;height:36px;padding:0 10px;border-radius:8px;font-size:13.5px;font-weight:500;color:#c3cddc;text-align:left;transition:background .15s,color .15s}',
    '.vps .vps-i:hover{background:rgba(255,255,255,.06);color:#fff}',
    '.vps .vps-i .vps-ic{display:flex;color:#9aa8bd;transition:color .15s}',
    '.vps .vps-i:hover .vps-ic{color:#c9d6ea}',
    '.vps .vps-i .vps-t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.vps .vps-i[aria-current=page],.vps .vps-i[data-cur]{color:#fff;font-weight:650}',
    '.vps .vps-i[aria-current=page] .vps-ic,.vps .vps-i[data-cur] .vps-ic{color:#a9c3ff}',
    '.vps .vps-b{flex:0 0 auto;min-width:20px;height:20px;padding:0 6px;border-radius:6px;display:grid;place-items:center;font:700 11px/1 Manrope,sans-serif;background:rgba(255,255,255,.1);color:#fff;transition:opacity .2s,transform .2s}',
    '.vps .vps-b.hot{background:#d93a3a}',
    '.vps .vps-cv{display:flex;color:#8c9ab0;transition:transform .28s cubic-bezier(.22,1,.36,1)}',
    '.vps .vps-g[aria-expanded=true] .vps-cv{transform:rotate(90deg)}',
    '.vps .vps-g[aria-expanded=true] .vps-b{opacity:0;transform:scale(.6)}',
    '.vps .vps-sub{display:grid;grid-template-rows:0fr;transition:grid-template-rows .3s cubic-bezier(.22,1,.36,1)}',
    '.vps .vps-sub.open{grid-template-rows:1fr}',
    '.vps .vps-sub>div{overflow:hidden;position:relative}',
    '.vps .vps-sub:not(.open)>div{visibility:hidden}',
    '.vps .vps-sub>div:before{content:"";position:absolute;left:18px;top:4px;bottom:4px;width:1px;background:rgba(255,255,255,.14)}',
    '.vps .vps-sub .vps-i{height:32px;padding-left:37px;font-size:13px;margin-top:2px}',
    '.vps .vps-sub .vps-i:after{content:"";position:absolute;left:16px;top:50%;width:5px;height:5px;margin-top:-2.5px;border-radius:50%;background:#5b6e8a;transition:background .15s,box-shadow .15s}',
    '.vps .vps-sub .vps-i[aria-current=page]:after{background:#8fb0ff;box-shadow:0 0 0 3px rgba(110,150,255,.22)}',
    '.vps .vps-team{margin-top:auto;padding:10px 8px 8px;border-top:1px solid rgba(255,255,255,.1)}',
    '.vps .vps-lbl{font:800 11px Manrope,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#d8b25a;margin:0 8px 6px}',
    '.vps .vps-p{position:relative;display:flex;align-items:center;gap:9px;height:38px;padding:0 8px;border-radius:8px;transition:background .15s}',
    '.vps .vps-p:hover,.vps .vps-p:focus-within{background:rgba(255,255,255,.06)}',
    '.vps .vps-av{flex:0 0 auto;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.12);box-shadow:0 0 0 1.5px rgba(255,255,255,.22);color:#dbe3ef;font:700 11px Manrope,sans-serif}',
    '.vps .vps-nm{flex:1;min-width:0;display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:12.5px;line-height:1.3;color:#fff}',
    '.vps .vps-nm b{font-weight:700;color:#fff}',
    '.vps .vps-nm small{display:inline;font-size:11.5px;color:#9eadc3}',
    '.vps .vps-c{position:absolute;right:6px;top:50%;transform:translateY(-50%);display:flex;gap:3px;padding-left:14px;background:linear-gradient(90deg,rgba(22,50,80,0),#163250 14px);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .15s,visibility 0s}',
    '.vps .vps-p:hover .vps-c,.vps .vps-p:focus-within .vps-c{opacity:1;visibility:visible;pointer-events:auto}',
    '.vps .vps-c button{width:24px;height:24px;border-radius:6px;display:grid;place-items:center;background:rgba(255,255,255,.12);color:#fff;transition:background .15s,transform .15s}',
    '.vps .vps-c button:hover{background:rgba(255,255,255,.22)}',
    '.vps .vps-c button:active{transform:scale(.94)}',
    '.vps .vps-c button.wa{background:#1f8f5a}.vps .vps-c button.wa:hover{background:#25a468}',
    '.vps .vps-me{position:relative;padding:8px 10px 12px;border-top:1px solid rgba(255,255,255,.1)}',
    '.vps .vps-meb{width:100%;display:flex;align-items:center;gap:10px;padding:6px;border-radius:8px;text-align:left;transition:background .15s}',
    /* the account row is read-only now: the only control in it is sign out */
    '.vps .vps-mest{width:100%;display:flex;align-items:center;gap:10px;padding:6px;border-radius:8px}',
    '.vps .vps-mest .vps-nm{flex:1;min-width:0}.vps .vps-mest .vps-nm b{display:block;font-size:13px;font-weight:650}.vps .vps-mest .vps-nm small{display:block;font-size:11px;color:#a9b6c9}',
    '.vps .vps-out{flex:none;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:7px;color:#a9b6c9;transition:background .15s,color .15s}',
    '.vps .vps-out:hover{background:rgba(255,255,255,.12);color:#fff}',
```

## 3.15 Prototype-global CSS that affects these pages (proto.js)

#### proto.js global CSS: prototype bar, toast, tooltip, page enter/leave, hidden scrollbars, drill scrim — `proto.js:119-152` (verbatim)

```js
  var css = document.createElement('style');
  css.textContent = [
    '#vp-bar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:2147483000;display:flex;align-items:center;gap:6px;padding:5px;border-radius:10px;background:#0f2a4a;box-shadow:0 12px 30px -10px rgba(8,20,40,.55);font:600 12px Manrope,system-ui,sans-serif;color:#fff}',
    '#vp-bar .vp-tag{padding:0 8px;color:#c9a24b;font-weight:800;letter-spacing:.08em;text-transform:uppercase;font-size:11px}',
    '#vp-bar .vp-seg{position:relative;display:flex;background:rgba(255,255,255,.1);border-radius:7px;padding:2px}',
    '#vp-bar .vp-seg button{position:relative;z-index:1;border:0;background:none;color:rgba(255,255,255,.75);font:600 12px Manrope,sans-serif;height:26px;padding:0 10px;border-radius:5px;cursor:pointer}',
    '#vp-bar .vp-seg button[aria-pressed=true]{background:light-dark(#fff, oklch(13% 0 89.9));color:light-dark(#0f2a4a, oklch(88.7% 0.047 254.4))}',
    '#vp-bar select{height:30px;border-radius:6px;border:0;background:rgba(255,255,255,.12);color:#fff;font:600 12px Manrope,sans-serif;padding:0 8px;max-width:210px}',
    '#vp-bar select option{color:light-dark(#0f2a4a, oklch(88.7% 0.047 254.4))}',
    '#vp-bar .vp-x{width:26px;height:26px;border:0;border-radius:6px;background:none;color:rgba(255,255,255,.7);cursor:pointer;font-size:14px}',
    '#vp-mini{position:fixed;left:14px;bottom:14px;z-index:2147483000;border:0;border-radius:8px;background:#0f2a4a;color:#c9a24b;font:800 11px Manrope,sans-serif;letter-spacing:.08em;padding:8px 10px;cursor:pointer;box-shadow:0 8px 20px -8px rgba(8,20,40,.5)}',
    '#vp-toast{position:fixed;left:50%;bottom:64px;transform:translate(-50%,12px);opacity:0;z-index:2147483001;display:flex;align-items:center;gap:12px;max-width:min(560px,calc(100vw - 32px));padding:10px 12px 10px 14px;border-radius:8px;background:#0f2a4a;color:#fff;font:600 13px Manrope,sans-serif;box-shadow:0 18px 40px -14px rgba(8,20,40,.6);transition:opacity .18s,transform .22s cubic-bezier(.22,1,.36,1);pointer-events:none}',
    '#vp-toast.on{opacity:1;transform:translate(-50%,0);pointer-events:auto}',
    '#vp-toast button{border:0;background:rgba(255,255,255,.14);color:#e6c46e;font:700 12px Manrope,sans-serif;height:28px;padding:0 10px;border-radius:6px;cursor:pointer}',
    '#vp-tip{position:fixed;z-index:2147483002;pointer-events:none;background:#0f2a4a;color:#fff;font:700 12px/1.3 Manrope,sans-serif;padding:5px 9px;border-radius:6px;white-space:nowrap;opacity:0;transform:translateY(3px);transition:opacity .12s,transform .12s}',
    '#vp-tip.on{opacity:1;transform:none}',
    'html.vp-enter body{animation:vpIn .26s cubic-bezier(.22,1,.36,1) both}',
    'html.vp-leave body{opacity:.35;transition:opacity .14s}',
    '@keyframes vpIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
    'html.vp-mobile body{background:light-dark(#dfe5ee, oklch(25% 0.01 258.3))}',
    /* pop-ups always on top: drill-downs and dialogs escape their card's stacking context (rule 14 · item 14) */
    /* no visible scrollbars anywhere; scrolling still works (item 11) */
    'html,body,*{scrollbar-width:none!important}',
    '*::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}',
    '.ov{position:fixed!important;inset:0!important;z-index:2147482000!important}',
    '.ddscrim{position:fixed!important;inset:0!important;z-index:2147482000!important}',
    '.dd{position:fixed!important;z-index:2147482001!important;top:max(72px,8vh)!important;max-height:calc(100vh - 110px);overflow:auto!important}',
    ':is(.card,.kpi,section,.stag>*,.sc-host,dc-import):has([style*="z-index:201"],[style*="z-index: 201"]){transform:none!important;z-index:2147481500!important;position:relative}',
    '#vp-drill-scrim{position:fixed;inset:0;z-index:2147482000;background:rgba(8,20,40,.5);display:flex;align-items:flex-start;justify-content:center;padding:max(72px,8vh) 16px 16px;opacity:0;transition:opacity .18s}',
    '#vp-drill-scrim.on{opacity:1}',
    'html.vp-mobile x-dc~div,html.vp-mobile body>div:first-of-type{margin:0 auto}',
    '@media (max-width:700px){#vp-bar{top:62px;bottom:auto;flex-wrap:wrap;justify-content:center;width:calc(100% - 20px)}#vp-bar select{max-width:none;flex:1}#vp-toast{bottom:100px}}',
    '@media (prefers-reduced-motion: reduce){html.vp-enter body{animation:none}#vp-toast,#vp-tip{transition:none}}'
  ].join('\n');
```


---

# 4. Gaps, conflicts and decisions the developer must make

| # | Topic | Finding | Recommendation |
|---|---|---|---|
| G-01 | Sidebar / page name | DECISIONS: "Knowledge Bank" (route `/library`). Prototype nav, trail, empty H1, drill copy all say "Library". | Use "Knowledge Bank" in nav, top-bar trail, H1s, "Open Knowledge Bank →", "These guides live in the Knowledge Bank". Keep "Save to library" button text? → make it "Save to Knowledge Bank" only if owner agrees; prototype keeps "Save to library" / "Saved to library" / "Remove from library". |
| G-02 | Screenshots vs FINAL | Screenshots show pre-"One shape" type chips. | Build the FINAL 20 px tile (§3.1 last block). |
| G-03 | "File-type thin band" | Tree uses 20 px tint tile; upload "Done" row shows a file glyph with a coloured bottom band (`docs_upload.dc.html:75`). | Tree: tile. Larger file glyphs (upload done row, viewer header 30 px tile): band/tint style. Status never encoded in the type colour. |
| G-04 | Row click on desktop | Rule 9 says row → preview overlay; FINAL selects into the right pane; overlay from eye/page. | Follow FINAL (pane); double-click or Enter on a selected file may open the overlay. |
| G-05 | Remembered grouping | Not persisted in prototype. | Persist `By step / By category` (+ Status/Replaced toggles optional) in localStorage `vcfo.docs.view` (try/catch). |
| G-06 | Outside click / roving focus for row menus | Missing. | Close on outside click; focus first item on open; ↑/↓/Home/End; Esc returns focus to kebab. |
| G-07 | Tree keyboard | `role=tree` without arrow keys. | Implement WAI-ARIA tree pattern (K-07). |
| G-08 | Phone file tap | No-op in board. | Open phone preview sheet (MP-*). |
| G-09 | Phone missing features | No toggles / Download all / Upload button. | Root kebab sheet adds "Download all (ZIP)" and "Upload · N requested". |
| G-10 | Request data model | `document_requests` lacks due date, step/field link, file key, review note; `uploadDoc` stores only a name. | Migration + `POST /api/requests/[id]/upload` (§2.3). |
| G-11 | Versions ("Replaced") | Only the latest path is kept per field. | Versions table or index every upload (§2.2). |
| G-12 | Client ZIP | Only staff doc-pack ZIP and incorporation-draft ZIP exist. | New client ZIP route with release filters (§2.3). |
| G-13 | Stale proof rule | Needs a document date. | Rule table + bill date field; fallback to upload date. |
| G-14 | Reading progress | No storage. | `client_library_reads` table + repo + API (§2.5). |
| G-15 | Remove from library | Hard delete. | Soft delete + Undo toast. |
| G-16 | Categories | Real app has `labour`; prototype has 5 shelves. | Add a Labour shelf (colour `--cat-labour` oklch(50% 0.12 200), glyph Lucide `hard-hat`/`users`). "your-project" label = "{Company}’s project". |
| G-17 | Updated chip colour | Today amber (`ClientLibrary.tsx:119-121`). | Blue ribbon on books; blue "Updated {date}" chip in reader hero. |
| G-18 | DOCX preview | Board says "Preview not available" for DOCX. | Real app can render DOCX (`IncorporationDocxPreview`) → only unknown types get that state. |
| G-19 | Max upload size | Board says 10 MB; app default 50 MB (env). | Print `maxUploadSizeLabel()`. |
| G-20 | Before/After | Boards static. | Data-driven (BA-02). |
| G-21 | Loading/Empty boards keep an H1 "Documents" | Refined page has no H1. | Drop H1 in loading/empty too (consistency with rule 7 / dashboard v7.4), or add a visually-hidden H1 on all states for a11y. |
| G-22 | Toast auto-dismiss | Docs toast stays until ✕. | Auto-hide done/copy toasts after ~3.2 s (prototype global toast timing); keep "Preparing…" until done. |
| G-23 | Progress drill default tab | Board opens on "Received". | Open on the segment under the pointer (rule 14) — ok/rv/ms map to Received/In review/Missing; keyboard activation → All. |
| G-24 | Copy link | No deep-link handling. | Support `?doc={id}` (select + scroll + open pane) and `?folder={id}` (expand + scroll). |
| G-25 | "Documents 6" nav badge | Hard-coded. | Define = pending requests (or pending + new since last visit) — owner to confirm. |

# 5. Build checklist (suggested component split)

| Component | Covers | Notes |
|---|---|---|
| `DocumentsPage` (`src/views/client/Documents.tsx` rewrite) | D-*, DS-* | fetch tree via TanStack Query; skeleton after 150 ms, min 300 ms |
| `DocToolbar` | D-06…D-15 | `SlidingPill` shared component (spring A-01) |
| `DocTree` / `DocTreeRow` | DT-*, DM-*, K-07 | virtualise if > 200 rows |
| `StepProgressBar` + `ProgressDrill` | DT-08, DD-* | shared tooltip + drill pop-up component (rule 14) — phone = bottom sheet |
| `DocPreviewPane` | DP-* | thumbnail lazy-load |
| `DocumentViewer` (shared, overlay) | V-*, MP-* | used by Documents, Reader, Home; Esc, prev/next, zoom |
| `ZipToast` | DZ-* | real progress or indeterminate |
| `UploadDialog` + `RequestDropZone` | U-*, M-11 | drag states, camera capture, Undo |
| `DocumentsMobile` | M-* | path-based drill with back crumb, action sheets |
| `KnowledgeBankShelf` (`ClientLibrary.tsx` rewrite) | L-*, LE-*, LD-* | book component, recently-read strip |
| `Reader` (`AskReader.tsx` restyle) | R-* | hero, depth pill, focus-track timeline, side cards |
| `BotSays` (rule 16 bubble) | DT-20, DS-02, DD-08, L-16, LE-03 | sizes 40/48/56 |
