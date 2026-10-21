# Incorporation — prototype catalogue for the Next.js rebuild

Scope: the client's Incorporation screens of the VCFO Suite prototype (FINAL build), mapped onto the real app at `/home/user/vcfo_suite`.

## 0. Sources, and how FINAL differs from the generator (read this first)

| What | Path |
|---|---|
| FINAL pages (source of truth) | `docs/specs/client-pages/prototype/final-src/s/inc/incorporation.html` (landing), `phase.html#p=1..4`, `step.html#n=1..48`, `board.html`, `view.html` (legacy redirect only) |
| Shared prototype runtime | `final-src/proto.js` (toast + Undo, Before/After store, drill pop-up, Ask VCFO chat + "What's this?" answer card, tooltip-at-point, navigation), `final-src/shell.js` (sidebar / rail / drawer, breakpoints, Before/After pill), `final-src/tl-editor.js` (Timeline "Edit" modal), `final-src/routes.js` |
| Generator (more readable, OLDER) | `prototype/src/generators/incorporation/{template.html, app.js, model.js, build.js}` |
| Real steps | `prototype/incorporation-steps.json` (48 steps, extracted from `src/data/checklist.ts`) |
| Rules | `docs/specs/client-pages/DECISIONS.md` (Incorporation section), `DESIGN-RULES.md` |
| Screenshots in repo (v7 = GENERATOR version, now superseded) | `prototype/v7-screens/incorporation__{390x844,1024x768,1440x900,1920x1080}.png`, `inc-step-7__*.png` |
| Screenshots of FINAL I rendered (Chromium, Before unless `-A`) | `/tmp/claude-0/-home-user-vcfo-suite/70d95962-24da-5bb2-bffa-28b5658aceeb/scratchpad/inv/shots/` → `landing__{1440,1024,390}.png`, `landing-A__*` (After), `landing-open2__*` (Part B accordion open), `landing-info__*` ((i) pop-over), `landing-drill__*` (drill pop-up), `phase2__*`, `phase2-A__*`, `phase4__*`, `step5__*`, `step7__*`, `step7-A__*`, `step8__*`, `step10__*`, `step20__*`, `board__*` |
| Verbatim extracted FINAL code (split per page) | same folder `x/` → `incorporation.app.js`, `phase.app.js` (= `board.app.js`), `step.app.js`, `*.css`, `*.body`, `*.data` |

**The FINAL output differs from the generator in four big ways. FINAL wins:**

1. **Landing has NO navy hero.** `renderLanding()` in FINAL renders `.r2 (COI tile + This week) → Timeline card → 4 donuts`. `heroLanding()` (company name, "Monthly status brief" button, "Board resolution · Ready" button, SPICe+ ring) still exists in the code but is never called. The SPICe+ ring moved INTO the Days-to-COI tile (`.coi .tr1`). So in FINAL the **Monthly status brief drawer and the Board resolution header button have no entry point on the landing**. The phase and board pages never had the brief button. DECISIONS.md (2026-10-12) still lists "status brief + board resolution header buttons", so the owner needs to confirm. My recommendation: build the drawer (spec in §1.6), keep the real `StatusBriefButton`, and ask where it goes.
2. **The landing card is renamed "Timeline"** (it was "Phases"). Phase names use `PHL = ['SPICe+ Part A','SPICe+ Part B','Post-incorporation','Registration']`. The row layout is new: `[Steps ▸ toggle] [glyph + name] [gantt lane] [Open → link]`. The accordion opens with the **Steps** button; **Open →** goes to the phase page. There is an **Edit** button that opens the timeline editor. The bars are taller (20 px, radius 5), the active bar shows a "Now · step N" label, the today line has a red "Today" tag, and the step table has a "Portal · Proof" column and an "Open →" text button. The **What's this? (?) button per row is gone from the landing table** (it is still on the phase-page table and the step rail).
3. **The step page uses the "live app" layout** (`renderLive(x)`): plain title row + "What's this?" link, one answers card, the Documents card, and a right-hand phase step list (`naRail`). This is the same layout as the real `EngagementStepDetail`. The generator layout (navy hero, 4-stage lifecycle tracker, bot banner, Timeline card, Focus-track journey rail, "Needed from you" checklist) is still in the code ("kept for reference") but is not rendered. The sticky **Approve & submit** action bar is still rendered.
4. **The copy is third person.** "You" becomes "Northwind": owner chips read "Northwind", "Waiting on Northwind", "Awaiting Northwind's approval", "Documents from Northwind", "Signed by Northwind". The landing owner column also adds **MCA** (violet) for steps 13 and 14 (`LOWN={13:'MCA',14:'MCA'}`). The "Who's working on what" donut gets a third MCA segment. The landing status column adds **"Next"** (see §3).

The **phase page and board page in FINAL equal the generator** apart from the Northwind wording and `light-dark()` colours. They keep the navy hero, the Focus-track journey rail and the old step table with (?) and → buttons.

Data facts used by every screen (from `final-src/s/inc/*.html` data block + app constants):
- `TODAY_B = 2026-10-06` (Before), `TODAY_A = 2026-11-12` (After), `WIN_END = 2026-10-28` (manager-set incorporation window end), gantt axis `AX0 = 2026-09-08` → `AX1 = 2026-12-31`.
- `PLAN = {1:['2026-09-08','2026-09-28'], 2:['2026-09-29', WIN_END]}`. Phases 3 and 4 run `[coiDate(), phEnd(p)]`, where `phEnd` is the latest step date in the phase.
- Status arrays (model.js): **Before**: steps 1–6 `done`, 7 `you`, 8/9/10 `prog`, 11–48 `up`. **After**: 1–18, 21, 24–28, 31, 34 `done`; 19, 20, 22, 23, 29, 33, 36 `prog`; the rest `up`.
- Counts: Before 6/48 (13%), SPICe+ 6/14 (43%), phases 5/5 · 1/9 · 0/11 · 0/23. After 26/48 (54%), SPICe+ 14/14 (100%), phases 5/5 · 9/9 · 7/11 · 5/23.
- People: Arjun Mehta (Project Lead, initials AM, navy avatar), Priya Raman (Project Manager, PR, `#2f6fd0`), Rohan Kumar (client user), J. Carter (director). Company "Northwind Technologies India Pvt Ltd", short name "Northwind".

---

## 1. INVENTORY

ID prefixes: `SH` shell, `LD` landing, `PH` phase page, `ST` step page, `BR` board resolution, `OV` overlays (drill, pop-over, brief, tooltip, toast, chat, editor), `AN` animation, `LS` loading/empty, `BA` Before/After, `BP` breakpoints.
Files: L = `final-src/s/inc/incorporation.html` (`x/incorporation.app.js`), P = `phase.html` (`x/phase.app.js`), S = `step.html` (`x/step.app.js`), B = `board.html`, PJ = `final-src/proto.js`, SJ = `final-src/shell.js`, TL = `final-src/tl-editor.js`.

### 1.1 Shell (every incorporation page)

| id | item | exact behaviour / content | file |
|---|---|---|---|
| SH-01 | Sidebar | Navy `#0f2a4a`, fixed. 248 px at ≥1280, a 72 px icon rail at 768–1279, a drawer at ≤767 (`--vp-side-w`). Items: Home · Updates (badge 3) · **Incorporation (badge "6/14" Before, "14/14" After, i.e. SPICe+ done/14)** · Compliances ▸ · Documents (6) · Library · Credentials · Team · Audit · Settings. Then "NORTHWIND'S TEAM": Priya Raman · Project Manager, Arjun Mehta · Project Lead, Customer support · SBC help desk (compact rows, hover actions). Then the account row: Rohan Kumar · Northwind · Client. | SJ (`incBadge()` l.269) |
| SH-02 | Top bar | 52 px tall, white, bottom border. Menu button (phone only) · SBC logo 28 px · breadcrumb · spacer · Search ⌘K (240 px, collapses to a 40 px icon below 1280) · **Before / After sliding pill** (desktop top bar; inside the rail on tablet; at the top of the drawer on phone) · Announcements · Notifications (badge 3, tinted primary-light) · Theme toggle. No profile, no Ask button. | `*.body`, SJ |
| SH-03 | Breadcrumb | Landing: `Home / **Incorporation**`. Phase: `Home / Incorporation / **Phase 2 · Incorporation**` (uses PH names). Step: `Home / Incorporation / **SPICe+ Part B** / **<step title>**` (`crumbPhase()` inserts the PHN phase link). Board: `Home / Incorporation / **Board resolution**`. Phone: only the bold current crumb, navy 14.5 px. | body + S `crumbPhase` |
| SH-04 | Ask VCFO launcher | Bottom-right robot and "Ask VCFO" pill. It sinks while you scroll. When the step action bar is present it lifts above it (`.has-act #vp-launch{bottom:var(--acth)}`). | PJ, template CSS |
| SH-05 | Prototype bar | Bottom-centre "PROTOTYPE" control (Before COI / After COI, Desktop / Mobile 390, page select). **Prototype-only, do not build.** | PJ `buildBar` |
| SH-06 | Page title | `document.title`: "Incorporation · VCFO Suite", "Phase N · <PH> · Incorporation · VCFO Suite", "<step title> · Incorporation · VCFO Suite", "Board resolution · Incorporation · VCFO Suite". | L/P/S/B |
| SH-07 | Theme | Every colour uses `light-dark(light, dark)`. Dark = "True black" (proto.js `#vp-dark`). It is already ported as tokens in the uncommitted `src/components/client-portal/css/00-tokens.css`. | all CSS |

### 1.2 Landing (`/app/client/incorporation`)

| id | item | exact behaviour / content | file |
|---|---|---|---|
| LD-01 | Layout | `.wrap` (max 1600, gap 16). Row 1 `.r2` = auto-fit grid `minmax(min(100%,400px),1fr)`: COI tile + This week. Row 2 = Timeline card. Row 3 = 4 donut cards (`.dg`: 4 cols → 2 cols ≤1279 → 1 col ≤767). | L `renderLanding` |
| LD-02 | Days-to-COI tile (Before) | Navy gradient `linear-gradient(120deg,#0f2a4a,#173f74)`, radius 12, gold 3 px bottom strip. Big button: **"22" + "days to COI"** (number in Space Grotesk 34–42 px tabular; label gold-2 15–18 px). Tooltip "Expected Wed 28 Oct 2026 · window set by Arjun Mehta" ⚠ only a manager can set windows in the real app, so this should name Priya Raman / the manager. Click → SPICe+ drill (`drillRing`). | L `coiTile` |
| LD-03 | (i) on COI | `.ibtn` white 75%. Pop-over title "Days to COI": "Counts down to the end of the incorporation window Northwind's manager set (Wed 28 Oct 2026). After the Certificate of Incorporation it shows the real incorporation date." + "Ask VCFO about this" row. | L `INFO.coi` |
| LD-04 | "At risk · step 7" chip | Amber `.chip.risk`, link to the first step whose status is `you`. aria "At risk · step 7 · Registered Office Address". Tooltip "Step 7 is waiting on Northwind · due 9 Oct". Shown only Before, and only if a `you` step exists. | L |
| LD-05 | SPICe+ ring (inside tile, `.tr1`) | 46 px ring, 5 px stroke, gold `#e6c46e` arc on a white-16% track, "43%" in the middle, "SPICe+" mono caption. Tooltip "SPICe+ · 6 of 14 steps done". Click → drill "SPICe+ progress · Phases 1 and 2 · 6 of 14 steps done", tabs by status, active "Waiting", top link "SPICe+ ends with the Certificate of Incorporation · Open Phase 2 →". DECISIONS: the ring counts SPICe+ steps only. | L `ringBtn`, `drillRing` |
| LD-06 | Sub line | Before: "Northwind Technologies India Pvt Ltd · expected Wed 28 Oct". After: "Northwind Technologies India Pvt Ltd · incorporated Sat 24 Oct" + mono "· CIN, PAN and TAN issued" + gold link **"Open certificate"** (→ document viewer). | L |
| LD-07 | Steps pill | Full-width bar button: "6 / 48 steps", a 7 px green gradient track (`#1fb488→#2fd3a0`, min width 2%), "13%". Click → drill "All 48 steps · 6 done · 42 to go", tabs Done/Waiting/In progress/With SBC/Upcoming, active "Waiting" (Before) or "With SBC" (After). | L `drillAll` |
| LD-08 | COI tile (After) | Big "24 Oct" + "incorporated". Green chip "4 days early" (= days(COI, window end)), tooltip "Window ended Wed 28 Oct". (i) is titled "About the incorporation date". Ring 100%. No count-up. | L |
| LD-09 | This week card | Header "THIS WEEK" + mono range "6 – 12 Oct" (After "9 – 15 Nov"). Bot (26 px robot) + bubble "MCA: nothing pending this week." (After "Nothing is waiting on Northwind this week."). Rows (grid 80 px · 1fr · auto, 7 px padding, hairline top border, hover raised): owner chip · text · mono date. Before (fixed): Northwind "Upload NOC · requested by Arjun" 9 Oct → step 7; Northwind "Check & approve step 7" 9 Oct → 7; SBC "KYC review & DSC" now → 10; SBC "Draft MOA & AOA" 12 Oct → 11. After: computed — steps whose status is with/you/prog, sorted by date, first 4, date shows "now" if ≤ today+3 days. Each row links to its step. | L `weekCard` |
| LD-10 | Timeline card header | `.card.acc` (gold 30×3 px tab top-left). "TIMELINE" + (i) ("The timeline": "Each bar is the planned window of a phase. The fill is the share of steps done; red is time past the plan. The red line is today; the gold diamond is the COI."). Right: mono "6 of 48 steps · Sep – Dec 2026" + **Edit** button (pencil, 30 px tall) → timeline editor modal (OV-08). | L `phasesCard` |
| LD-11 | Gantt axis | Weekly mono labels from 15 Sep to 22 Dec, positioned by `pos(d)` on the AX0–AX1 scale. Every 2nd label hides when a week is under 58 px (`e2`), 3 of 4 hide under 29 px (`e4`). Hidden in simple mode. | L `axis`, `layoutGantt` |
| LD-12 | Phase row | Grid `72px | minmax(120px,180px) | 1fr | 84px`, gap 14, min height 58, padding 12 18, hairline top. Cells: **Steps** toggle (`btn sm stb`, chevron-right) · status glyph XL (26 px) + phase name (14 px 700) · lane · **Open →** link button to the phase page (tooltip = PH_TIP, e.g. "SPICe+ Part A · name approval with MCA"). | L `phaseRow` |
| LD-13 | Phase bar | `<button class="gbar">` absolutely placed from plan start to max(plan end, actual end). 20 px tall, radius 5. **done** = green fill 100%, plus a red right segment sized `daysLate/(phase duration)`. **active** = `--with-light` background, 1.5 px navy inset outline, navy fill = pct, and the label "Now · step 7" in with-text 11 px at `left: calc(fill% + 6px)`. **up** = hatched `repeating-linear-gradient(135deg,#e3e8ef 0 4px,#f3f5f8 4px 8px)`. Phase 2 gets the **gold diamond** (16 px rotated square, gold, 2 px white ring) at its right end = COI. Hover/focus: brightness 1.08 + 3 px primary 25% ring. Tooltip "SPICe+ Part B · 1 of 9 done · 29 Sep → 28 Oct". Click → phase drill (OV-01) with the link "Every step of this phase · Open the phase page →". | L `phBar`, `drillPhase` |
| LD-14 | Bar label | `.glab`: "**100%**" (Space Grotesk 17) + "5 / 5 steps" + an extra: done → "3 days late" (red) or "4 days early" (green); active/up → nothing (FINAL removed "Ends 28 Oct"). JS places it to the right of the bar if it fits, else to the left, else switches the whole card to **simple mode**. White background pill so it can sit over the today line. | L `phLabel`, `layoutGantt` |
| LD-15 | Today line | 2 px red vertical button spanning each lane (top/bottom −13 px), 12 px invisible hit area. On the last row when it is closed, a red "Today" tag under it (`.phr:last-of-type:not(.open) .today:after`). Tooltip "Today · Tue 6 Oct". Click → toast "Today · Tue 6 Oct 2026". | L `todayLine` |
| LD-16 | Simple mode | Triggered when the lane is under 500 px wide (true at 1024 and 390) or no label fits. Axis and today line hide. The bar goes full width on row 2 and the label wraps under it. | L `layoutGantt`, CSS `.phc.simple` |
| LD-17 | Accordion | **Steps** toggles that phase's step table in place. Only one is open at a time (`openPh`). When open: row background `#f7f9fc`, the Steps button turns navy with white text, the chevron rotates 90°, `aria-expanded=true`, aria "Hide the steps of SPICe+ Part B" (otherwise "Show the steps of …"). The body animates `fin .2s ease-out` (opacity 0 / −4 px → 0). The body is `role=region`, aria "SPICe+ Part B steps". DECISIONS: "steps open in place; the phase name still links to the phase page" (FINAL: the Open → button does this). | L `togglePh` |
| LD-18 | Landing step table header | Mono uppercase 11 px: (glyph) (#) STEP · OWNER · STATUS · DATE · PORTAL · PROOF · (open). Columns `22px 26px 1fr 88px 128px 112px 112px 76px`. | L `stepTable` |
| LD-19 | Step row | Status glyph (set A, tooltip `ltip`) · mono number · title (13.5 px 600, ellipsis, + red "Urgent" tag if `urgent`) · owner chip (Northwind gold `#fbf0d2/#7a5a0c`, SBC blue `#e8eefb/#2349a8`, MCA violet) · status chip (Done green / Waiting amber / In progress navy / With SBC blue / Upcoming outline / **Next** grey `#eef1f5` outline) · date (mono: "Done 4 Oct", "Due 9 Oct", "since 6 Oct", "exp. 28 Oct" for step 14, "—" for Next/Upcoming) · Portal ↗ (SBC/MCA-owned steps except step 2; tooltip "<form> · official portal"; toast "Opens <form> on the official portal in a new tab") + **📎 Proof** chip when such a step is done (opens preview) · **Open →** (`btn sm so`) to the step page. Row with status `you` gets background `#fffdf8` and a 3 px gold inset left bar. | L `stepTable` |
| LD-20 | Registration grouping | Phase 4 only: blue uppercase sub-headers General, Customs, Foreign Trade, Labour, Local Compliance, IP/Brand, FEMA, from `regGroup(title)`. The same regexes exist in `internRegistrationHeadingForTitle` in `src/lib/intern-overview-progress.ts`. DECISIONS: check the names against the code. They match the code's `INTERN_REGISTRATION_HEADING_ORDER`. | L `regGroup` |
| LD-21 | Not-started phase bubble | When a phase is all `up` and has a PH_WAIT text, the table starts with a bot bubble: P3 "Post-incorporation starts once the Certificate of Incorporation is issued." / P4 "Registrations start after the Certificate of Incorporation. GST comes first." + button "Ask VCFO when it starts" → chat "When does Post-incorporation start?". | L |
| LD-22 | Donut "Documents from Northwind" | 96 px donut, 13 px stroke (16 on hover), 1.2 px gaps, centre total. Legend buttons: Submitted 8 `#15805f` · Under review 1 `#2453c7` · Pending 2 `#d9731f` · Sent back 1 `#cf3a2f` (After 11/0/1/0). Each segment/legend → drill with tabs per segment, rows = document names ("From Northwind"), link "Every document, with versions · Open Documents →". | L `donut`, `segData`, `drillSeg` |
| LD-23 | Donut "Documents SBC prepares" | Generated 5 `#2f6fd0` · Pending 7 `#dfe4ec` · Signed by Northwind 2 `#15805f` (After 14/5/3), with document names (see code). | L |
| LD-24 | Donut "Who's working on what" | Not-done steps by owner: Northwind 4 `#c9a24b` · SBC 36 `#2f6fd0` · MCA 2 `#6b3fc4` (After 0/22/0). Drill rows = steps. | L |
| LD-25 | Donut "On plan vs overdue" | Active steps (you/prog/with): On time 3 · At risk 1 (the `you` steps) · Overdue 0 (After 7/0/0). | L |
| LD-26 | Removed in FINAL | Navy landing hero (company h1 "Northwind Technologies India Pvt Ltd", eyebrow "INCORPORATION · 4 PHASES", meta "6/48 · COI expected 28 Oct 2026", buttons "Monthly status brief" + "Board resolution ✓ Ready", ring). See §0.1. | L `heroLanding` (dead code) |

### 1.3 Phase page (`phase.html#p=1..4`) — NEW route

| id | item | exact behaviour / content | file |
|---|---|---|---|
| PH-01 | Hero | Navy gradient band (`100deg #0f2a4a→#14386a→#1b4f94`, radius 12, gold 3 px bottom gradient). Back button 34 px → landing. Eyebrow mono gold "INCORPORATION · PHASE 2 OF 4". h1 (Space Grotesk 19–23) = PH name ("Name Application" / "Incorporation" / "Post-Incorporation" / "Registration" — ⚠ the landing calls these "SPICe+ Part A/B…"; pick one naming). **What's this?** button (robot mini + text, white-12% fill) → chat "What's this: Phase 2 · Incorporation?". Meta mono: "1/9 · 29 Sep → 28 Oct · ends 28 Oct 2026" ("finished …" when done). Right: prev/next phase buttons ("‹ Phase 1 · Name Application", "Phase 3 · Post-Incorporation ›", max 240 px, ellipsis) + a 50 px phase ring (gold, or green `#2fd3a0` when done) with "Phase 2" caption → phase drill. | P `renderPhase` |
| PH-02 | Progress card | `.card.acc.psum`: "PROGRESS" + (i) (title "Phase 2 · Incorporation", text = PH_INFO). Mono "1 of 9 steps". Inline 12 px bar (same `phBar`, inline) + label "11% 1 / 9 steps Ends 28 Oct". Key-date chips (`.kd span` raised, radius 6): "Starts **29 Sep**" · "Ends **28 Oct**" (or Finished) · "Now **Step 7 · Registered Office Address**" (link, not when done) · "COI **28 Oct (expected)**" (phase 2 only) · "Reviewer **Arjun Mehta**". | P |
| PH-03 | Steps card | "STEPS" + "9 steps". The generator `stepTable(p, focus)`: columns glyph · # · Step · Owner · Status · Date · ↗·📎 icon header · (?) What's this · → open. 6/7 show 📎 (attachments → step). SBC steps with forms show ↗ portal. The focus row has `.cur` (primary-light background). Statuses use the real KD (no "Next"). | P `stepTable` |
| PH-04 | Journey rail (Focus track) | `.card.acc.rail`. Title "INCORPORATION · JOURNEY" (11.5 px) + chip "1 / 9". Rows: glyph · "8 · Proposed Directors" + railSub ("Done · 4 Oct", "Waiting on Northwind · due 9 Oct", "In progress · due 16 Oct", "With Northwind's project lead · since 6 Oct", "Opens later") + sub-step dots (active rows, up to 6 dots: green done, blue current, ring todo) + owner chip. Connectors: dotted `#cfd6e2`, solid green between two done rows. **Focus card** (`.rh`) for the focus step: navy, 4 px `#f3e7c6` halo, "NOW · STEP 7" gold mono, title, railSub, white (?) button, sub-step track (12 px dots, green done, gold current with halo, labels when ≤4 labels of ≤14 chars, otherwise "x of n sub-steps done"). Phases with more than 11 steps show a 9-step window around the focus + "Show all 23 steps" / "Show fewer steps". | P `rail`, `railHero` |
| PH-05 | Who's doing it | `.card.acc.team`: a 12 px owner bar split by flex (Northwind `#c9a24b` 5, SBC `#2f6fd0` 4), tooltip "Northwind · 5 of 9 steps", + legend buttons → drill "Who's doing it · Phase 2". | P |
| PH-06 | Focus rule | Focus = first step `you`, else first not done, else last. | P |
| PH-07 | Phone prev/next | `.pn` bar (phone only) with "← Phase 1" / "Phase 3 →" (or "All phases"). | P |
| PH-08 | Grid | `.sgrid` = `1fr minmax(280px,320px)`. At ≤999 one column; the side column becomes an auto-fit grid (≥300 px). | CSS |

### 1.4 Step page (`/app/client/incorporation/step/[slug]`, FINAL `renderLive`)

| id | item | exact behaviour / content | file |
|---|---|---|---|
| ST-01 | Layout | `.wrap.na` (max 1360). Title row `.nah`: back chevron (32 px ghost → phase page, aria "Back to SPICe+ Part B") · h1 22 px Manrope 700 · **"(?) What's this?"** ghost link 12 px subtle → Ask VCFO with "What's this: <title>?". Grid `.nag`: `1fr minmax(260px,296px)`, gap 20. One column at ≤999 (the rail drops below). | S `renderLive` |
| ST-02 | Answers card — not approved | `.card.nac` (no shadow). `.nain` intro 14 px muted (`liveIntro`): `you` "Northwind's team filled this step. Check it, then approve & submit by 9 Oct." · `with` "Northwind's team is preparing this step (due 19 Oct). Here is what it captures." · `prog` "Fill this step and submit by 16 Oct. Here is what it captures." · `up` SBC-owned "Northwind's team prepares this step. Here is what it captures." / client-owned "Northwind fills this step once step 10 · KYC Review & DSC is done. Here is what it captures." Then the `dl.nakv` rows (label 12.5 muted / value 14 fg, column grid `minmax(140px,224px) 1fr`, hairline separators, "—" subtle when empty). "Remarks (optional) —" is always appended. | S `liveIntro`, `liveRows` |
| ST-03 | Answers card — approved (done) | Tab strip `.natabs` with one selected tab (✓ + tab name, e.g. "Capital structure", primary underline 2 px, 44 px tall). Green `.naok` box: circle-check + "**Approved**" + "Accepted after submission on 4 Oct 2026." (`fmtS`: "27 Sept 2026" style). Then `dl` with values, or "Provided · 4 Oct" for generic done fields. Below the card, right-aligned: **"Request a change"** (primary-tinted outline) → chat "I want to request a change to step N · title". | S |
| ST-04 | Step 5 special | Rows: Approved company name "Northwind Technologies India Private Limited" · Name approval date "1 October 2026" · Name approval expiry date (+20 days) "21 October 2026" · MCA name approval letter = link button "↗ Name_Approval_Letter.pdf" (preview) · Remarks —. Banner text "Accepted after submission on 27 Sept 2026" (date of step 4). | S `liveRows` |
| ST-05 | Prototype answer data | Step 6: Authorised ₹10,00,000 · Paid-up ₹1,00,000 · Face value ₹10 · 10,000 shares · Shareholding Northwind Inc. 9,999 · nominee 1. Step 7: address "Plot 42, 3rd Floor, Cyber Towers, HITEC City, Madhapur, Hyderabad 500081" · Telangana · Electricity bill · TSSPDCL 1102 4587 66. Step 8 Before/After, step 10 Before/After: see `X` in the code (§5). All other steps: rows = `infoRequired` labels (value "—", or "Provided · date" when done). | S `X`, `fields` |
| ST-06 | Documents card (step 7) | `.card.acc#docs`: "DOCUMENTS" + (i) ("Files this step needs. SBC checks each one before it goes into the MCA filing.") + count chip "**1 of 2**" amber → "2 of 2" green. Request line `.dreq`: 16 px `you` glyph + "No-objection certificate from the owner · requested by Arjun". **Drop zone** `.drop` (1.5 px dashed `#e7a463`, `--you-light` fill, radius 10): 38 px amber round upload button · "**NOC from property owner** (i)" (NOC info: "A no-objection certificate signed by the owner of the premises, needed when the company does not own the registered office.") · "Drop a file here or **browse**" · amber chip "Due 9 Oct". Second requirement: green glyph + "Copy of utility bill (not older than two months)" + file row (PDF tile `#fdecec/#c0392b`, "Utility bill · September", mono "tsspdcl-sep-2026.pdf · 301 KB · Arjun · 5 Oct", chip "Uploaded", 👁 preview, ⬇ download). | S `docsCard`, `fileRow` |
| ST-07 | NOC upload | Click the upload button or "browse" → (prototype) mark uploaded, re-render: the drop zone becomes a file row "NOC from property owner · noc-plot42-owner.pdf · 188 KB · Northwind · just now · Uploaded". The request glyph turns green, the chip shows "2 of 2". Toast **with Undo**: "NOC from property owner uploaded · Arjun will check it". DECISIONS: "Client uploads: only files the lead asked for. Answers stay read-only." | S click handler `[data-upload]` |
| ST-08 | Documents card (step 6) | "DOCUMENTS" + "1 file": XLSX tile `#e6f4ee` "Cap table · northwind-cap-table.xlsx · Northwind · 2 Oct · Checked". Steps with no requested/attached docs show no Documents card. | S |
| ST-09 | Phase step list (`naRail`) | `aside.card.narail`, sticky `top:72px`, list scrolls inside (`max-height: calc(100vh - 160px)`). Heading mono 11 px uppercase muted "SPICE+ PART B". Rows (grid `24px 1fr 32px 32px`, padding 8 4, radius 8): status glyph 24 px (set A; **upcoming = a numbered circle showing the position in the phase**) · step name link (13 px; current = 700 + `aria-current=page`, row background `#f3f6fb`, glyph ring `0 0 0 3px #f3f6fb, 0 0 0 5px #b9cdf5`) · owner icon 13 px (user glyph, blue for SBC, subtle grey for Northwind, tooltip "SBC owns this step"/"Northwind owns this step") · ⋮ "More" (toast "Step N · title · more actions in the full app") · (?) What's this. Connector: 2 px green under done rows, 1 px `--up` otherwise. | S `naRail` |
| ST-10 | Sticky action bar | Only when status = `you`. `position:sticky; bottom:0`, white 96% + 6 px blur, top border, shadow. Left: 22 px `you` glyph + "**Awaiting Northwind's approval**" + a 200×4 px progress bar (primary fill = done need-items %, min 6%; step 7 = 1/3 before the NOC, 2/3 after). Right: **Request a change** (outline, message icon) + **Approve & submit** (primary, check icon). Phone: buttons share the width at 40 px with icons hidden. It sets `--acth` so the launcher sits above it. | S `actBar` |
| ST-11 | Approve & submit | DECISIONS: one button with Undo. Prototype: step 7 with no NOC → toast "Upload the NOC first · it is still needed from Northwind" (DECISIONS: "Approve without NOC — Blocked; scroll to the upload". The build must also scroll to and focus `#docs .drop`). Otherwise the button becomes "✓ Submitted" (disabled) + toast **with Undo** "Approved & submitted · Arjun Mehta files it next". | S `[data-approve]` |
| ST-12 | Request a change | Prototype → Ask VCFO chat pre-filled "I want to request a change to step 7 · Registered Office Address". Real: `ClientChangeRequestButton` dialog → `POST /api/client/change-requests` (note required). | S |
| ST-13 | Phone prev/next | `.pn`: "← 6 · Capital Structure" / "8 · Proposed Directors →" (first/last → "All phases"). | S |
| ST-14 | Not rendered in FINAL (kept for reference) | Navy step hero (eyebrow "PHASE 2 · INCORPORATION · STEP 2 OF 9", What's this?, meta "You · 1 working day · due 9 Oct · reviewer Arjun Mehta", prev/next, status glyph), 4-stage lifecycle tracker (Started → Submitted → Reviewed → Completed with a navy "Now" card + amber "Waiting on you" tag), bot banner, answers card with tab + "Pre-filled from project setup" + form chips (SPICe+ Part B ↗, INC-22 ↗), Timeline card, Focus-track rail, "Needed from you" checklist (Upload NOC / Check the answers / Approve & submit with checkboxes, "2 left"), team card (Arjun / Priya with message buttons). The v7 screenshot `inc-step-7__*.png` shows this layout. | S `renderStep` body after `renderLive(x);return;` |

### 1.5 Board resolution page (`/app/client/board-resolution`)

| id | item | exact behaviour / content | file |
|---|---|---|---|
| BR-01 | Hero | Back → Phase 1 page. Eyebrow "PHASE 1 · NAME APPLICATION · STEPS 2–3". h1 "Board resolution" + What's this? (→ chat; answer: "Northwind's parent board authorises the India subsidiary. SBC drafts it, a director signs it, and Northwind uploads the signed copy." Why: "The name application in step 4 cannot be filed without it."). Chips: green "Signed copy received · 30 Sep", translucent "Certified true copy". Right: "2 · Draft Board Resolution ›", "3 · Signed Board Resolution ›", done glyph XL (tooltip "Done · received 30 Sep"). | B `renderBoard` |
| BR-02 | Tracker | `.card.trk` `.lc`: ✓ Drafted "SBC · 26 Sep" — ✓ Released "28 Sep" — ✓ Signed "Northwind · 30 Sep" — green "now" card: tile ✓ "RECEIVED / Received by SBC / Arjun · 30 Sep". Green connectors. Phone: vertical. | B |
| BR-03 | Preview card | `.card.prv` (raised background). Header "PREVIEW" + mono "page 1 of 2 · 100%" + buttons − / + (zoom 60–160% in 10% steps, `transform: scale()` with a .2s transition) + ⛶ full screen (toast "opens the document viewer"). Paper 440 px wide, Georgia 12/1.6, padding 34/38/30: centred bold title "CERTIFIED TRUE COPY OF THE RESOLUTION PASSED BY THE BOARD OF DIRECTORS OF NORTHWIND INC. ON 24 SEPTEMBER 2026", grey placeholder lines, "RESOLVED THAT", "RESOLVED FURTHER THAT", signature "J. Carter" in script + "Director, Northwind Inc.", a blue round stamp "NORTHWIND INC." rotated −12°. | B |
| BR-04 | Files card | "FILES" + "2 files": DOCX "Draft · Word · board-resolution.docx · SBC · 26 Sep · Released" · PDF "Signed copy · br-signed-northwind.pdf · Northwind · 30 Sep · Received" (each with 👁 ⬇). Blue drop zone: refresh icon "**Replace signed copy** · Drop a PDF or browse" + mono "PDF · DOCX". | B |
| BR-05 | What happens with it | Bot: "Northwind's parent board authorised the India subsidiary. SBC drafted it, J. Carter signed it, and it went with the name application in step 4." + button "Open step 3". | B |
| BR-06 | Grid | `.brg` = `1.35fr 1fr`. One column at ≤999. Same in Before and After. | CSS |

### 1.6 Overlays and shared components

| id | item | exact behaviour / content | file |
|---|---|---|---|
| OV-01 | Drill pop-up (rule 14) | Scrim `rgba(8,20,40,.5)`, fades in .18s. Panel `#vp-drill` min(600px,100%), radius 12, slides `translateY(10px) scale(.98)→none` .24s `cubic-bezier(.22,1,.36,1)`, top `max(72px,8vh)`. Optional top link strip (light blue `#eef3ff`): lead text + bold link "Open the phase page →". Header: title (navy 15/700) + sub (12) + × (32 px). Tabs: grey track pill, one tab per non-empty segment (colour square + label + mono count), active = navy. List rows: grid `1fr auto auto 16px` → name · mono date · coloured status chip · "→". A row → navigate to its step. Footer "Showing all N". Esc / scrim / × close (160 ms) and return focus. Phone ≤700: bottom sheet, radius 14 top, max 86vh. Already ported as CSS in the uncommitted `src/components/client-portal/css/11-drill.css`. | PJ `drill` |
| OV-02 | Info pop-over (rule 7) | `.ip-pop`: absolute, 290 px (max 100vw−24), white, radius 10, shadow, padding 12, text 12.5/1.5. Ends with a hairline row "🤖 Ask VCFO about this" (primary 700) → chat "What's this: <title>?". Anchored under the (i): left = clamp(12, btn.left−8, vw−w−12), top = btn.bottom+8. Toggles on the same button. Closes on outside click, Esc or resize. Keys: coi, phases (title "The timeline"), docs, noc, timeline, answers (step description), phase (PH_INFO). | L/P/S `openInfo` |
| OV-03 | Tooltip (rules 14 + 17) | `#ip-tt` fixed, navy, white 600 12/1.35, padding 6 9, radius 6, nowrap, ellipsis at 100vw−16. Opacity + translateY(3px) .12s. **Show delay 100 ms**. Placed above the element (8 px gap), flips below if there is no room. SVG donut segments use the pointer position. Shows on keyboard focus only for `:focus-visible`. Hides on scroll, pointerdown or focusout. Touch: long-press 450 ms shows it for 1.8 s. Every glyph has `role=img` + an aria-label equal to the tooltip. | L/P/S tooltip block |
| OV-04 | Toast + Undo | `#vp-toast` bottom 64 px centred (100 px on phone), navy, white 600 13, radius 8, max min(560px,100vw−32). Enters with opacity .18s + translate .22s. **Auto-hides after 3200 ms.** The Undo button is gold text `#e6c46e` on white-14%, 28 px tall. Undo → runs the callback, then toast "Undone". | PJ `toast` |
| OV-05 | Ask VCFO chat + What's this answer | `window.vcfoChat(q)` opens the launcher chat, posts q, shows a typing indicator for 900 ms (0 with reduced motion), then the answer card from `window.vcfoWhatsThis(q)`: **title** (step title), **text** (step description), "**Why it matters to Northwind**" (You-owned: "Northwind owns this step: Northwind's answers and documents go into the <first form>." SBC: "SBC does this step for you; you see the result and approve it."), "Source: <forms> · VCFO Suite checklist, step N", button "Open this step →". Phase answers use PH_INFO/PH_WHY/PH_SRC. Unknown → "I can't answer that one yet. I can pass it to Northwind's project lead." (grey antenna mood). DECISIONS: "What's this? opens the Ask VCFO drawer (as in the code)". | PJ `whatsThis`, L/P/S `vcfoWhatsThis` |
| OV-06 | Monthly status brief drawer | (no entry point in FINAL, see §0.1) Right drawer `#ip-brief` min(420px,100%), scrim .32. Slides from `translateX(28px)` .26s. Phone: bottom sheet, max 88dvh. Header: prog glyph + "Monthly status brief" + "Northwind Technologies India Pvt Ltd · as of 6 Oct 2026" + ×. Body: highlight "**22 days** to the expected COI (Wed 28 Oct). SPICe+ is **43%** done: 6 of 14 steps." (After: "Incorporated on **24 Oct 2026**. SPICe+ is **100%** done. Post-incorporation and Registration are under way.") · PHASES: 4 rows (glyph, "Phase N · name", mono "d of t · ends/done date", a 5 px green mini bar, status chip) → phase page · WAITING ON NORTHWIND (rows, or bot "Nothing is waiting on Northwind.") · IN PROGRESS (rows). Footer: "Copy brief" (clipboard text) + primary "Download PDF". Focus goes to × on open; Esc closes and returns focus. | L/P `openBrief` |
| OV-07 | Glyph set A (rule 18) | 22 px circles (26 px XL; 24 px in the rail; 18 px in kv; 16 px in requests): done green + white check (stroke 3.6) · you amber `#c8620e` + white user-round · prog navy + **gold `#e6c46e` clock** · with blue `#2453c7` + white trending-up · up white with a 1.5 px `#cfd6e2` ring, empty · late red `#cf3a2f` + white x (CSS only, never produced). Tooltips via `tipTxt`: "Done · 4 Oct", "Waiting · due 9 Oct", "In progress · due 16 Oct", "With SBC · since 6 Oct · due 19 Oct", "Upcoming · planned 20 Oct", "Next · planned 16 Oct". | all `si()` |
| OV-08 | Timeline editor (landing "Edit") | Modal `#tle` min(1080px), drag/resize phase bars with day snap, cascade, before/after compare, undo. Manager: "Save timeline" ("Saving updates the dashboard for everyone on Northwind."). Client: "Request a timeline change" → "Send request" → "Change request sent to Priya Raman" / "Waiting for Priya Raman to approve". The same editor as the Home card. | TL, PJ l.274 |
| OV-09 | Bot speech bubble (rule 16) | 40 px avatar circle primary-light + robot SVG; bubble `--with-light`, radius 10, 12.5 px, optional 30 px button. Mini robot 18 px inline. | all `botSay` |

### 1.7 Loading, empty, error, animation

| id | item | behaviour | file |
|---|---|---|---|
| LS-01 | L1 skeleton | DECISIONS: "shown after 150 ms, held at least 300 ms". The incorporation prototype pages render synchronously and have no skeleton. The reference implementation is `final-src/s/home/mobile.html` l.171–177 and l.376 (class `.sk` on the app root: every `.card`/hero child `visibility:hidden` + `:after` shimmer inset 12 px, radius 6, `linear-gradient(90deg, #e9edf3 0, #f3f5f8 40%, #e9edf3 80%)` 600 px wide, `sh` 1.2 s linear infinite; navy cards use `oklch(30% .05 258)`/`oklch(36% .05 258)`; on reveal `.wrap>*` play `fu .3s cubic-bezier(.22,1,.36,1)`). Build: a timer starts the skeleton only if data is still pending at 150 ms; once shown, keep it ≥300 ms. Replace the current `HexgridLoader` / "Loading checklist…" fallbacks. The real app has `src/components/client/overview/ClientOverviewSkeleton.tsx` to reuse. | mobile.html |
| LS-02 | No engagement | Real view: `EmptyStateIllustrated` "No active engagement" — restyle as a bot bubble (rule 16). | real `Incorporation.tsx` |
| LS-03 | Phase not started | Bot bubble LD-21. | L |
| LS-04 | Nothing waiting | This week bot "MCA: nothing pending this week." / brief "Nothing is waiting on Northwind." | L |
| LS-05 | Drill empty tab | "Nothing here." (only non-empty tabs are rendered). | PJ |
| LS-06 | Error | Real `app/app/client/incorporation/error.tsx` and `step/[stepId]/error.tsx` exist; keep them. | real |
| AN-01 | COI count-up | First paint, Before only, not with reduced motion: 0 → 22 over **650 ms**, easeOutCubic `1-(1-k)^3`, `requestAnimationFrame`. | L |
| AN-02 | Page enter/leave | `html.vp-enter body{animation:vpIn .26s cubic-bezier(.22,1,.36,1)}` (from opacity 0 / +6 px), class removed after 400 ms. Leave `opacity:.35` .14s before navigating. | PJ |
| AN-03 | Accordion | `.phr.open .phb{animation:fin .2s ease-out}`; chevron `transform .2s` rotate(90deg). | CSS |
| AN-04 | Buttons | `.btn` transition transform .12s, background .15s; `:active` scale(.98). | CSS |
| AN-05 | Donut hover | `circle.sg` stroke-width 13→16, .15s. | CSS |
| AN-06 | Step row | `.str` background transition .3s. | CSS |
| AN-07 | Brief / drill / pop-up | see OV-01, OV-06. | |
| AN-08 | Board zoom | `.paper` transform .2s. | CSS |
| AN-09 | Reduced motion | `@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}`; count-up skipped; chat typing 0 ms; brief close 0 ms. | CSS / JS |
| AN-10 | Current-step pulse (rule 10/12) | Not in the incorporation pages (the gold halo on the Focus card is static). | — |

### 1.8 Before / After (model.js) and breakpoints

| id | item | behaviour | file |
|---|---|---|---|
| BA-01 | Toggle | One stored state `vcfo.after` (localStorage), shared by the top-bar pill, the rail, the drawer and the prototype bar. Incorporation pages re-render in place on the `vcfo-after` event + toast "Showing the company after/before incorporation". Real equivalent: uncommitted `clientPortalPrefs.viewState` = `auto | before | after` (`auto` follows the real COI state) via `/api/client/portal/prefs`. | PJ `setAfter`, SJ |
| BA-02 | What changes | Status arrays (BEFORE/AFTER), dates (`DATES_B` vs `DATES_A`: after = actual dates; before = planned, steps 15+ +4 days), today (6 Oct vs 12 Nov), COI tile (countdown vs "24 Oct incorporated" + early chip + certificate link), This week rows + bot text, donut data, sidebar badge 6/14 → 14/14, step 7/8/10 data (fB/fA, timelines), board page unchanged. After, the gantt shows P3 and P4 active with "Now · step 19" and "Now · step 29" labels, P2 done "4 days early". | model.js, L/P/S |
| BP-01 | Desktop ≥1280 | 248 px sidebar; search box 240 px; donuts 4 across. | CSS, SJ |
| BP-02 | Tablet 768–1279 | 72 px icon rail (tooltips + fly-outs, Before/After pill inside the rail); search becomes a 40 px icon button; donuts 2 across; landing gantt goes into simple mode (1024 lane under 500 px). | CSS |
| BP-03 | ≤999 | `.sgrid`, `.brg`, `.nag` single column; `.scol.side2` → auto-fit grid of ≥300 px cards. | CSS |
| BP-04 | Phone ≤767 | No sidebar (drawer from the menu button); top bar 56 px, padding 0 6, gap 4; only search icon + notifications + menu; crumb = current page in navy 14.5. `main` padding 14 12 120. Hero padding 14; back 40 px (margin-top 18); hero buttons drop labels (40 px icon); `.hnav` hidden → `.pn` prev/next bar shown. Cards padding 14. kv one column. Tracker vertical (connectors 2×14 px). Rail rows ≥44 px. All icon buttons 40 px; invisible hit-area expansion (`::after inset -9px`) on (i), the risk chip and "browse"; gantt bars get ±15 px hit area. Action bar full-width buttons, no icons. Brief → bottom sheet. Drill → bottom sheet (≤700). Step table container queries (`.stt`): ≤720 px hides Date and Portal; ≤520 px hides header, Owner and Status, rows `22 22 1fr 76px`, 40 px Open. Donut card container ≤250 px: 72 px donut. | CSS |
| BP-05 | ≤370 | SBC logo 20 px. | CSS |

---

## 2. DATA per screen → real app

Legend: **EXISTS** = use as-is · **ADAPT** = exists, needs a new projection or field · **NEW** = build it (backend piece named).
All data reaches client views through repositories behind `requireAuth()` + `AuthContext`, never `db` (CLAUDE.md rule 1). Client checklist state is already redacted per viewer by `checklistStateForViewer` → `redactChecklistStateForViewer('client', …)` (`src/lib/checklist/checklist-visibility.ts`).

Note on paths: the brief says `src/domain/checklist*`. There is no `src/domain` in this tree; all checklist domain logic lives in `src/lib/checklist-*.ts`.

### 2.0 Existing building blocks (found by grep)

| Need | Real piece | Where |
|---|---|---|
| Engagement for signed-in client | `findEngagementForClientUser(engagements, user)`; `useApp().engagements`, `engagementsLoading`; server `getMyEngagement(ctx)` | `src/lib/checklist/checklist-state-key.ts`, `src/context/AppContext.tsx`, `src/db/repositories/engagements.ts:450` |
| Checklist state | `useApp().getStateForEngagement(eng)`, `refreshEngagementChecklist(id)`; `GET /api/engagements/[id]/checklist` | `src/context/use-app-provider-value.ts`, `app/api/engagements/[id]/checklist/route.ts` |
| 48 steps, phases, owners, forms, infoRequired, description, urgent | `getIncorporationPhases()`, `getActiveCatalogItems()`, `ChecklistItem.responsibleRole ('client'|'intern')`, `.forms`, `.infoRequired`, `.description`, `.urgent` | `src/data/checklist.ts` |
| Client phase labels "SPICe+ Part A…" | `internOverviewPhaseTitle()` / `PHASE_LABEL` in client-overview | `src/lib/intern-overview-progress.ts:25`, `src/lib/client-overview.ts` |
| Sequential gate (done/active/waiting/locked) | `gateActiveCatalog(state,'client')`, `getStepGate`, `isChecklistStepSequentiallyComplete`, `gateDisplayStatus` | `src/lib/checklist/checklist-step-gate.ts` |
| Display status | `deriveChecklistDisplayStatus(itemId,item,slice,brSnapshot)` | `src/lib/checklist/checklist-display-status.ts` |
| Approval sub-state | `approvalStateOf`, `isAwaitingClientApproval`, `stepApprovalLabel`, `clientApproveBlockedReason`, `phaseCompletedByApproval` | `src/lib/checklist/checklist-step-approval.ts` |
| Client fill request | `isClientFillAwaitingClient`, `clientFillLabel` | `src/lib/checklist/checklist-client-fill.ts` |
| Release / redaction | `isStepReleasedToClient`, `redactChecklistSliceForViewer` | `src/lib/checklist/checklist-visibility.ts` |
| Progress per phase / overall, ball in court, next action, milestones, documents counts, deliverables, incorporated flag, team | `getClientOverview(ctx)` → `GET /api/client/overview` → `useClientOverview()`; builders `buildProgress`, `buildNextAction`, `buildBallInCourt`, `buildMilestones`, `buildDocumentCounts`, `buildDeliverables`, `identifiersFromState` | `src/db/repositories/client-overview.ts`, `app/api/client/overview/route.ts`, `src/lib/use-client-overview.ts`, `src/lib/client-overview.ts` |
| Date windows | `engagement.schedule` (`EngagementSchedule {incorporation?, steps?}`), `windowForStep(schedule,itemId)`, `formatWindow`; write `PATCH /api/engagements/[id]/schedule` (manager/admin only) | `src/lib/schedule-windows.ts`, `src/db/repositories/schedule.ts`, `app/api/engagements/[id]/schedule/route.ts` |
| Incorporation date | `engagements.incorporation_date` (`Engagement.incorporationDate`); CIN/PAN/TAN from pre-12 (`identifiersFromState`) | `src/db/schema.ts`, `src/lib/client-overview.ts` |
| Step attachments (file fields + uploaded?) | `getStepAttachmentRequirements(item, responses, ownershipType)` | `src/lib/checklist/checklist-step-attachments.ts` |
| Client-visible fields + answers | `getClientResponseFields(item)`, `filterFieldsByViewer(…,'client')`, `extractItemResponses(item,slice)` | `src/lib/checklist/checklist-responses.ts`, `src/lib/checklist/checklist-field-access.ts` |
| Upload a file to a field | `POST /api/engagements/[id]/milestone-documents` (multipart `fieldId`, `stepId`, `file`) → S3 via `putObject`; for a client it does NOT create a `documents` index row | `app/api/engagements/[id]/milestone-documents/route.ts` |
| Signed URL / preview | `GET /api/milestone-documents/signed-url`, `GET /api/documents/[id]/signed-url` | `app/api/...` |
| Client approve | `POST /api/client/steps/[stepId]/approve` {engagementId} → `clientApproveStep(ctx, …)`; phase-approved email; `ClientStepApproveButton` | `app/api/client/steps/[stepId]/approve/route.ts`, `src/db/repositories/engagements.ts:1039`, `src/components/client/ClientStepApproveButton.tsx` |
| Client request a change | `POST /api/client/change-requests` {engagementId, stepId, note} → `createClientChangeRequest` + `clientRequestStepChange` (reopens via `changeRequestReopenPatch`) + email; `ClientChangeRequestButton` | `app/api/client/change-requests/route.ts`, `src/components/client/ClientChangeRequestButton.tsx` |
| What's this? | `WhatsThisButton kind='step'|'field'|'compliance'|'document'` → `ask.ask({context:{kind,ref,label}})` (`useAskOptional`) | `src/components/ask/WhatsThisButton.tsx` |
| Status brief | `StatusBriefButton` → `GET /api/ask/brief?engagementId=` (PDF, flag C4, client only); `buildStatusBrief` (phases, done this month, next, upcoming) | `src/components/ask/StatusBriefButton.tsx`, `app/api/ask/brief/route.ts`, `src/lib/ask/status-brief.ts` |
| Board resolution | `fetchBoardResolutionInDb(id)` → `GET /api/engagements/[id]/board-resolution`; `BoardResolutionDoc {status draft|finalized, storagePath, draftedAt, finalizedAt, finalizedBy, updatedAt, signedStoragePath, signedUploadedAt, signedUploadedBy}`; download `…/board-resolution/download`, `…/download-signed`; upload `…/upload-signed` (`uploadSignedBoardResolution`); live updates `useRealtimeBoardResolution`; preview `BoardResolutionDocPreview` | `src/lib/engagements-db.ts`, `src/db/repositories/board-resolution.ts`, `src/views/client/BoardResolutionView.tsx`, `src/components/board-resolution/*` |
| Phase rows (current view) | `InternPhaseEntryCards`, `internOverviewPhases()`, `internOverviewCurrentItemInPhase`, `internPhaseStepCounts`, `phaseWindowMeta` | `src/components/incorporation/InternOverviewProgress.tsx`, `src/lib/intern-overview-progress.ts` |
| Step page (current) | `EngagementStepDetail` (client route `/app/client/incorporation/step/[stepId]`), `StepDetailContent viewer='client'`, `ChecklistJourneyRail` (phase list with `JourneyNode`, `ResponsibleRoleBadge`, attachment kebab), `journeyRailItems()` | `src/views/engagement/EngagementStepDetail.tsx`, `src/components/incorporation/ChecklistJourneyRail.tsx` |
| Paths | `clientIncorporationPath()`, `clientIncorporationStepPath(item)` (slug), `clientBoardResolutionPath()` | `src/lib/project-step-path.ts` |
| Team (PM / lead) | `ClientOverview.team`; uncommitted `getClientPortalShell(ctx).team` (`ClientPortalContact`) | `client-overview.ts`, `src/db/repositories/client-portal.ts` (WIP) |
| Shell (sidebar, Before/After, badges, companyShort "Northwind", incorporated) | **Uncommitted WIP in the working tree**: `GET /api/client/portal`, `/api/client/portal/prefs`, `src/db/repositories/client-portal.ts`, `src/lib/client-portal/types.ts`, `clientPortalPrefs` table (schema.ts diff), `src/components/client-portal/{routes.ts,Visor.tsx,css/*}` (tokens, drill CSS, shell CSS), `public/client-portal/fonts` | `git status` |
| Activity | `activity` table, `listActivity(ctx)`, `createActivity`; `GET /api/activity` | `src/db/repositories/activity.ts` |
| Document requests (free text) | `document_requests (engagement_id, requested_by, title, detail, status)`, `listDocumentRequests`, `createDocumentRequest`, `updateDocumentRequest`; `/api/requests` | `src/db/repositories/document-requests.ts` |
| Tasks | `tasks.ts` repository, `/api/tasks` (TaskInstance with `checklistKey`) | `src/db/repositories/tasks.ts` |
| Doc pack (staff only) | `useDocPack`, `GET /api/engagements/[id]/doc-pack` (statuses ready / needs-inputs / waiting-release); `docPackVisible = !isClientRoute` | `src/lib/doc-pack/*`, `src/hooks/use-doc-pack.ts` |

### 2.1 Landing data map

| UI datum | Prototype source | Real source | Status |
|---|---|---|---|
| Company name / short name | constants | `engagement.companyName`; `ClientPortalShell.companyShort` (WIP) | EXISTS / WIP |
| Days to COI (before) | `days(TODAY, WIN_END)` | `engagement.schedule.incorporation.to` minus today (IST calendar days). If no window: hide the number, bot "Your manager hasn't set the incorporation window yet". | ADAPT (pure fn `daysToCoi(schedule, today)`) |
| "window set by …" tooltip | "Arjun Mehta" | `schedule.incorporation.setBy` → profile name (repository join) | ADAPT (resolve the name server-side, add it to the overview) |
| Incorporated date (after) | `DT(14)` | `engagement.incorporationDate` ?? `state['pre-12'].completedOn/deliveredToClientAt`; flag `ClientOverview.incorporated` | EXISTS |
| "4 days early" | `days(DT14, WIN_END)` | `incorporation.to − incorporationDate` | ADAPT (pure) |
| "CIN, PAN and TAN issued" | static | `identifiersFromState(state)` → cin/pan/tan present | EXISTS |
| "Open certificate" | doc-viewer | `ClientOverview.documents.deliverables` kind certificate (`pre-12:certificateOfIncorporationFinalUrl`) → signed-url preview | EXISTS |
| At risk · step N | first KD `you` | first step whose derived status is `you` (§3) + its due date | ADAPT |
| SPICe+ ring 43% | phases 1–2 done/14 | `buildProgress(state).byPhase` P1+P2 done/total | EXISTS |
| Steps pill 6/48 13% | `doneN(STEPS)` | `buildProgress(state)` done/total/overallPct | EXISTS |
| All-48 drill tabs | `tabsFor(STEPS)` | derived status per step (§3) + date (§3.4) | ADAPT (pure `deriveClientStepStatus`) |
| This week rows | WEEK_B (fixed) / computed | union of: (a) open file requests for the client (NEW, §2.3), (b) steps with `approval.state === 'pending_client'` ("Check & approve step 7"), (c) steps with status with/prog whose due date (window `to`) falls in Mon–Sun of this week, (d) firm tasks (`tasks` with checklistKey) — date "now" when due ≤ today+3 | NEW (`buildThisWeek(state, schedule, requests, tasks, today)` in `src/lib/client-incorporation.ts` + a field on the overview response) |
| This week bot line | "MCA: nothing pending this week." | "MCA" items = steps owned by MCA (pre-11 MCA Remarks, pre-12 COI; see owner below) with the status `with` due this week; otherwise the generic text | NEW |
| Week range "6 – 12 Oct" | constant | Monday–Sunday of today (IST) — DECISIONS (Compliances) "Week starts Monday" | ADAPT |
| Timeline count "6 of 48 · Sep – Dec 2026" | constant | done/total + min/max month of all phase windows | ADAPT |
| Phase plan window (bar left/right) | PLAN 1/2, [coi, phEnd] for 3/4 | P1+P2: real has ONE window `schedule.incorporation` for Part A+B. Options: (1) split by the step windows of pre-5 (Part A end) if set, (2) **NEW** `schedule.phases[phaseId]` windows. P3/P4: from `coiDate` to the max `windowForStep(…).to` of the phase's steps (DECISIONS: "Phase end date (Post-inc., Registration) = latest step date in the phase"). | NEW (extend `EngagementSchedule` with `phases?: Record<phaseId, ScheduleWindow>` or derive) |
| Phase actual end / late / early | `phEnd(p)` = latest step date | latest completion date of the phase's steps (`completedOn` ?? `deliveredToClientAt` ?? `approval.clientApprovedAt`) vs the plan end | ADAPT (pure) |
| "Now · step N" on the bar | first step with you/prog/with | the gate's current step (index of the first incomplete step) in that phase | EXISTS (`internOverviewCurrentItemInPhase(items, gates)`) |
| Today line | TODAY | `new Date()` in Asia/Kolkata (`indiaDay` used in status-brief) | EXISTS |
| COI diamond | phase 2 bar end | `schedule.incorporation.to` (before) / incorporationDate (after) | EXISTS |
| Edit (timeline editor) | tl-editor.js | Manager: `PATCH /api/engagements/[id]/schedule`. Client: "Request a timeline change" → NEW kind on `/api/engagement-change-requests` (current kinds: delete_project, change_client, change_manager) or a client change request with stepId null | NEW (shared with the Home card build) |
| Step table rows | STEPS + lkind | `getIncorporationPhases()` items + derived status + date + owner | ADAPT |
| Owner chip Northwind / SBC / MCA | `x.o` + `LOWN` | `responsibleRole` ('client' → company short name, 'intern' → firm name "SBC"); **MCA is NEW**: add `actor?: 'mca'` to `ChecklistItem` for pre-11 (MCA Remarks) and pre-12 (COI) — or a client-side map `CLIENT_OWNER_OVERRIDE = {'pre-11':'MCA','pre-12':'MCA'}` in the presentation layer (do not touch the LIFTed `checklist.ts` unless agreed) | NEW (presentation map) |
| Portal ↗ | `x.f[0]` | `item.forms[0]` + NEW portal URL map form → portal (MCA V3, GST, EPFO, ESIC, …). Rule 15 list. `src/lib/announcement-portals.ts` already has a portal table per registration — reuse/extend | ADAPT |
| 📎 Proof | done SBC/MCA step | a NEW per-step "proof" pointer: the first firm-uploaded file field of the step (`getStepAttachmentRequirements(...).find(uploaded)`) or a deliverable; a missing proof → amber "Proof pending" chip (rule 15) | NEW (pure selector + signed-url) |
| Urgent tag | `x.u` | `item.urgent` | EXISTS |
| Registration groups | `regGroup` | `internRegistrationHeadingForTitle` / `internRegistrationHeadingGroups` | EXISTS |
| PH_WAIT bubble | constant | static copy, keyed by phase id | static |
| Donut "Documents from Northwind" | DOCS_B/A | per client-owned file field across released steps: `getStepAttachmentRequirements` + slice review state → Submitted (uploaded & step accepted/approved/completed) · Under review (uploaded & `reviewStatus==='reviewing'`) · Pending (required, not uploaded, step active/requested) · Sent back (`reviewStatus==='rejected'`, field in `unlockedFields`). Row names = field labels (+ director name for repeat fields via `repeatFieldLabel`). | NEW (pure `buildClientDocumentBreakdown(state, ownershipType)` + overview field) |
| Donut "Documents SBC prepares" | DOCS_B/A | firm-generated docs: doc-pack definitions (`src/lib/doc-pack/registry.ts`, statuses ready/needs-inputs/waiting-release → Generated/Pending) + board resolution (`finalized` → Generated; `signedStoragePath` → Signed by Northwind) + DIR-2 signed etc. The doc pack is staff-only today (`docPackVisible=!isClientRoute`) → expose a **client-safe count/name summary** (no inputs, no blockers) | NEW (repository fn `getClientPreparedDocsSummary(ctx, engId)` reusing `evaluate.ts`) |
| Donut "Who's working on what" | not-done by owner | not-done steps (gate ≠ done) grouped by owner (with the MCA map) | ADAPT (pure) |
| Donut "On plan vs overdue" | active: at risk = you | active steps (gate active/waiting): Overdue = due date < today or status `overdue`; At risk = status `you` (or due within 2 days); On time = rest | ADAPT (pure) |
| Donut drill "Open Documents →" | documents route | `/app/client/documents` | EXISTS |

### 2.2 Phase page data map

| UI datum | Real source | Status |
|---|---|---|
| Route `phase.html#p=N` | NEW route `app/app/client/incorporation/phase/[phase]/page.tsx` (`phase` = `part-a|part-b|post-incorporation|registration` or the phase id). Legacy `?phase=` handling already exists in `Incorporation.tsx`: update it to go to the phase page instead of the current step. | NEW |
| Title / eyebrow / prev-next | `getIncorporationPhases()` index + `internOverviewPhaseTitle` | EXISTS |
| Meta "1/9 · 29 Sep → 28 Oct · ends …" | phase window (§2.1 phase plan) + `internPhaseStepCounts(items,gates)` | ADAPT |
| Phase ring % | `internPhaseProgressPercent` | EXISTS |
| Key dates: Starts / Ends / Now step / COI / Reviewer | window; current step (`internOverviewCurrentItemInPhase`); COI date; reviewer = engagement lead name (`ClientOverview.team` role Project Lead) | ADAPT |
| What's this? (phase) | `WhatsThisButton` has no `phase` kind → **NEW** `kind:'phase'` in `WhatsThisButton` + the Ask context resolver (`src/lib/ask/*`) with PH_INFO/PH_WHY/PH_SRC copy | NEW |
| Steps table | as landing, plus (?) per row (`WhatsThisButton kind='step' compact`) | ADAPT |
| Journey rail (Focus track) | `ChecklistJourneyRail` exists (lead style) — needs the Focus-track variant: Focus card, sub-step ticks, dots | NEW component (`FocusTrackRail`); data: derived status, `railSub`, sub-steps (§2.4) |
| Sub-steps (ticks/dots) | prototype `SUBS` for 6/7/8/10 + infoRequired otherwise | the real fields' `section` values per step (`getClientResponseFields(item)` grouped by `section`) with filled state from responses (each section done when its required fields are filled), or `item.infoRequired`. For released steps only. | ADAPT (pure `stepSubSteps(item, responses, status)`) |
| Who's doing it | count of phase items by owner (+ MCA map) | ADAPT |

### 2.3 Step page data map

| UI datum | Real source | Status |
|---|---|---|
| Title, back, crumbs (Home / Incorporation / SPICe+ Part B / title) | `EngagementStepDetail` (`PageBackButton`, h1) + `phaseForStep(itemId)` for the crumb | EXISTS / ADAPT (crumb) |
| What's this? | `WhatsThisButton kind="step" refId={item.id} label={item.title}` — already in the title row | EXISTS |
| Intro sentence (`liveIntro`) | derived status (§3) + due date + previous step title | ADAPT (pure `clientStepIntro`) |
| Approved banner + date | `approval.clientApprovedAt` ?? `clientSubmittedAt`/`reviewedAt` when accepted ?? `deliveredToClientAt` ?? `completedOn` | ADAPT |
| Answer rows | `StepDetailContent viewer='client'` + `ClientStepFieldPreview` (fields from `getClientResponseFields` filtered for the client, answers via `extractItemResponses`, released only) — restyle as `dl.nakv` | EXISTS (restyle) |
| "What this step captures" for unreleased steps | `clientNothingYet` path in `EngagementStepDetail` | EXISTS |
| Documents card — "only files the lead asked for" | file fields = `getStepAttachmentRequirements(item, responses, ownershipType)`. **Which ones the lead asked the client for** has no model: `ClientFillRequest` is step-level, `document_requests` has no step/field link. NEW: either (a) add `stepId text, fieldId text, dueDate date` columns to `document_requests` (+ requested_by name join) and a lead UI "Request this file from the client", or (b) add `clientFileRequests?: {fieldId, requestedBy, requestedByName, requestedAt, dueAt?, fulfilledAt?}[]` to `ChecklistItemStateSlice` (same pattern as `clientFillRequest`/`approval`, lives in `checklist_state` jsonb). (b) fits existing redaction/approval code; (a) fits the Documents page ("Upload on the Documents page: only against open requests"). Recommend (a) so Documents + This week + step page share one list. | NEW (repository + migration + lead UI + client read) |
| "requested by Arjun" | request.requestedBy → profile name | NEW (with the above) |
| Count chip "1 of 2" | requested + already-attached file requirements: uploaded / total | ADAPT |
| File rows (name, file name, size, uploader, date, status chip) | path in responses → `fileNameFromStoragePath`; size/uploader/date NOT stored for client uploads (the milestone route skips `createDocument` for clients) → NEW: create the `documents` row for client uploads too (with `stepId`), then read it via `listDocuments(ctx, …)` filtered by stepId | ADAPT route + NEW read |
| Preview 👁 / Download ⬇ | `/api/milestone-documents/signed-url` + shared preview overlay | EXISTS |
| Client upload of a requested file | `POST /api/engagements/[id]/milestone-documents` then write `responses[fieldId]=path`. A client cannot write a step that is `pending_client` today (answers read-only; only `unlockedFields`). NEW server path: `POST /api/client/steps/[stepId]/files` {engagementId, fieldId, path} → repository `clientAttachRequestedFile(ctx, …)` that checks the field is in an open request for this client, writes only that response key, marks the request fulfilled, and logs activity. | NEW |
| Undo on upload toast | delete/restore the previous response value: same repository fn with `path: previous`; keep the S3 object | NEW (small) |
| Approve & submit | `ClientStepApproveButton` → `POST /api/client/steps/[stepId]/approve`. Enabled only when `approval.state === 'pending_client'`; `clientApproveBlockedReason` gives the disabled reason. | EXISTS |
| "with Undo" | the real approve is immediate and can send the phase-approved email. NEW: defer the POST. Optimistic "Submitted" state + toast with Undo; fire the POST when the toast closes (≈5 s; prototype toast 3.2 s); Undo cancels it. No server change needed. If the owner wants a server-side undo: add `POST /api/client/steps/[stepId]/unapprove` allowed only within N minutes and only if no phase email was sent — not recommended. | NEW (client hook `useDeferredAction`) |
| NOC blocking | prototype: toast. NEW: (1) UI: the Approve button stays clickable; if any open file request for this step is unfulfilled → scroll `#docs` drop zone into view, focus "browse", amber pulse, toast "Upload the NOC first"; (2) server: `clientApproveStep` rejects with `requested_files_missing` when open requests exist for the step (defence in depth). | NEW |
| Progress bar in the action bar | prototype: need-items done/total | `(fulfilled file requests + 1 if answers checked) / (requests + 2)` — or simply fulfilled requests / requests; define with the owner | NEW (pure) |
| Request a change | `ClientChangeRequestButton` (dialog, required note) → `/api/client/change-requests` | EXISTS |
| Phase step list (right) | `ChecklistJourneyRail` + `journeyRailItems()` (gate, status, attachments, windowLabel) — restyle to `naRail`: set-A glyphs (numbered circle for upcoming), owner user icon (blue SBC / grey client), ⋮ attachment menu (`showAttachmentMenu` = "Attachments required" list), (?) `WhatsThisButton compact` | EXISTS (restyle) |
| Registration groups in rail | `internRegistrationHeadingGroups` (already in `EngagementStepDetail`) | EXISTS |
| Prev / next step (phone) | catalog order `getActiveCatalogItems()` | EXISTS |
| Locked step access | the real client route opens every step for viewing; the gate controls actions (`EngagementStepDetail` comment) | EXISTS |

### 2.4 Board resolution page data map

| UI datum | Real source | Status |
|---|---|---|
| Visibility | client sees it only when `doc.status==='finalized' && storagePath` (`ClientBoardResolutionCard`, `BoardResolutionView`) | EXISTS |
| Tracker: Drafted (SBC · date) | `doc.draftedAt` | EXISTS |
| Released (date) | `doc.finalizedAt` (+ `finalizedBy` name) | EXISTS |
| Signed (Northwind · date) | `doc.signedUploadedAt` (+ `signedUploadedBy` name) | EXISTS |
| Received by SBC (Arjun · date) | no field: NEW — either `pre-3` step accepted (`state['pre-3'].reviewStatus==='accepted'`/`approval` / `completedOn` + `reviewedBy`), or treat upload = received. Use pre-3 acceptance (`isChecklistStepSequentiallyComplete` on pre-3) and its `reviewedAt/reviewedBy`. | ADAPT |
| Chips "Signed copy received · 30 Sep", "Certified true copy" | as above | ADAPT |
| Preview (zoom − / + / full screen) | `BoardResolutionDocPreview` (docx render) — add zoom controls; full screen = shared doc viewer | ADAPT |
| Files: Draft · Word (Released) / Signed copy (Received) | `…/board-resolution/download` (docx) + `…/download-signed`; sizes not stored (omit, or read `HEAD` from S3) | EXISTS |
| Replace signed copy (drop zone, PDF·DOCX) | `uploadSignedBoardResolution` + `validateSignedBoardResolutionFile` | EXISTS |
| Prev/next to steps 2 / 3 | `clientIncorporationStepPath('pre-2'|'pre-3')` | EXISTS |
| Header entry from the landing | prototype hero button (dead in FINAL) — the real `ClientBoardResolutionCard` "Board resolution ready" link exists; decide placement (§0.1) | decision |
| Ownership independent → BR steps N/A | `deriveChecklistDisplayStatus` returns not-applicable → hide the BR page/links | EXISTS |

### 2.5 Status brief

| UI datum | Real source | Status |
|---|---|---|
| Download PDF | `GET /api/ask/brief?engagementId=` (C4 flag) | EXISTS |
| Drawer body (phases, waiting on client, in progress) | `buildStatusBrief` gives phases, done-this-month, next, upcoming; the drawer needs per-step lists → reuse `buildProgress` + derived statuses | ADAPT (`GET /api/client/incorporation` payload covers it) |
| Copy brief | client-side text from the same payload | NEW (pure) |

### 2.6 Recommended single read for all incorporation screens

NEW `GET /api/client/incorporation?engagementId=` → repository `getClientIncorporation(ctx, engagementId?)` in `src/db/repositories/client-incorporation.ts`. It runs `assertEngagementAccess` and composes `checklistStateForViewer`, the schedule, the board-resolution row, file requests, the team and tasks, plus a pure builder `src/lib/client-incorporation.ts` returning:
`{ engagement{id, companyName, companyShort, incorporated, incorporationDate, window{from,to,setByName}}, today, phases[{id,label,plan{from,to}, actualEnd, lateDays, done,total,pct, state:'done'|'active'|'up', currentStepId}], steps[{id, n, phaseId, title, slug, owner:'client'|'firm'|'mca', status:'done'|'you'|'prog'|'with'|'up'|'next'|'late', date, dateKind:'done'|'due'|'since'|'planned'|'expected', forms, urgent, portalUrl?, proof?{path}|'pending', subSteps[{label, state}] }], thisWeek[], donuts{fromClient, firmPrepares, who, plan}, boardResolution{...}, brief{...} }` plus a hook `useClientIncorporation()` (TanStack Query, `staleTime 30s` like `useClientOverview`). Add a cross-tenant test (CLAUDE.md rule 2).

---

## 3. Step-status model

### 3.1 How the prototype computes it (`x/*.app.js`)

```
ST(n)  = (AFTER_ON ? AFTER : BEFORE)[n-1]          // 'done' | 'you' | 'prog' | 'up'  (model.js)
KD(n)  = ST(n)==='prog' && STEPS[n-1].o!=='You' ? 'with' : ST(n)   // in-progress SBC step = "With SBC"
lkind(x) (landing table only): KD!=='prog' ? KD : (first 'prog' step of the phase ? 'next' : 'up')
       → a client-owned step that is in progress but not the client's turn shows "Next" (the first) or "Upcoming"; its date shows "—"
phState(p) = all done ? 'done' : all 'up' ? 'up' : 'active';   phKind: done|up|prog (glyph)
'late'  : CSS + glyph exist (.si.late red ×, .chip.late), never produced; "Overdue" donut = 0
'at risk' (COI tile chip, plan donut) = KD === 'you'
```
Labels `KL = {done:'Done', you:'Waiting', prog:'In progress', with:'With SBC', up:'Upcoming', next:'Next'}` (rail/brief text says "Waiting on Northwind"). Colours `KCOL = {done:#15805f, you:#c8620e, prog:#0f2a4a, with:#2453c7, up:#8a97a8}`. Order of drill tabs `done, you, prog, with, up`.
Date cell `dateCell(n)`: done → "Done 4 Oct"; you/prog → "Due 9 Oct"; with → "since " + `since(n)` (= due − 5 days, capped at today); up → "—" (step 14 → "exp. 28 Oct" = COI date). Tooltip `tipTxt`: "<label> · <date>" (with: "With SBC · since 6 Oct · due 19 Oct"; up: "Upcoming · planned 20 Oct").
Sub-steps `subList(x)`: labels SUBS[6]=Share classes/Shares/Face value/Holding; [7]=Office address/State/NOC/Utility bill; [8]=Directors/DIN · DSC/ID proofs/Address proofs/Interests; [10]=KYC data/KYC review/DSC; otherwise `short(infoRequired label)`. States: done → all done; up → all todo; Before + SUBK_B (7: done,done,now,done · 8: done,done,now,todo,todo · 10: done,now,todo); else you → n−1 done + now; prog/with → floor(n/2) done + now.

### 3.2 Derivation from real checklist state (client viewer)

Inputs per step: `item` (catalog), `slice = redacted state[item.id]` (from `checklistStateForViewer`), `gate = getStepGate(gateActiveCatalog(state,'client'), item.id)`, `approval = approvalStateOf(slice)`, `fill = slice.clientFillRequest`, `requests = open file requests for this step` (NEW), `due = windowForStep(schedule,item.id)?.to`, `today` (IST).

Proposed pure function `deriveClientStepStatus(...)` (put it in `src/lib/client-incorporation.ts`; tests next to it), evaluated in this order:

| # | Prototype status | Condition on real state | Notes |
|---|---|---|---|
| 1 | **done** | `gate.kind === 'done'` (i.e. `isChecklistStepSequentiallyComplete` and before the current step), or `slice.status === 'not-applicable'` (render N/A as a done glyph with tooltip "Not needed for Northwind", or hide the row) | `gateDisplayStatus` already turns a re-requested `completed` into in-progress |
| 2 | **you** ("Waiting on Northwind") | `approval === 'pending_client'` (manager approved, the client must Approve & submit), OR open file request for the client on this step (NEW), OR `isClientFillAwaitingClient(fill)`, OR (`gate.kind === 'active'` && `item.responsibleRole === 'client'` && (`no client responses yet` OR `isReviewRejected(slice)`)) | "Check & approve step 7" in This week = the `pending_client` case |
| 3 | **prog** ("In progress", client-owned) | `gate.kind === 'active'` && owner client && the client has started (any client response saved, `slice.status === 'in-progress'`) && not submitted | |
| 4 | **with** ("With SBC") | `gate.kind === 'waiting'` (owner firm, or `isLeadRequestPending` → "Waiting on your project lead…"), OR `approval === 'pending_manager'` (label "Awaiting your team"), OR `approval === 'change_requested'` ("Your team is working on the change you asked for."), OR a client submission under review (`reviewStatus==='reviewing' && reviewSource==='client_submission'`) | "since" date: see 3.4 |
| 5 | **next** (landing table only) | the first `gate.kind==='locked'` step right after the current step **in the same phase** | prototype rule = the first not-yet-their-turn step |
| 6 | **up** ("Upcoming") | `gate.kind === 'locked'` | tooltip "Upcoming · planned <window to>"; gate message "This opens after X is complete." can be the long tooltip |
| overlay | **late** (red ×) | not done && ((`slice.status === 'overdue'`) or (`due` && `due < today`)) | rule 17 tooltip "Late by N days"; feeds the "Overdue" donut and the red late segment on phase bars |

**Important divergence (decide before building):** the real gate is strictly sequential across all 48 steps. `gateChecklistSteps` makes exactly ONE step `active`/`waiting` (the first incomplete one) and every later step `locked`. The prototype shows several concurrent active steps: Before has 7 you + 8/9/10 in progress; After has P3 and P4 running in parallel (19, 20, 22, 23, 29, 33, 36). With today's gate, the real landing can never show "8 · In progress" while 7 waits, nor parallel registrations. Options: (a) accept a single active step (the extra rows show Next/Upcoming — FINAL's landing table already turns 8/9 into Next/Upcoming through `lkind`, so it is close); (b) relax the gate for Post-incorporation and Registration so steps after the COI run in parallel (a change in `checklist-step-gate.ts`, which is LIFTed code, so it needs owner sign-off + tests); (c) show `with` for locked steps the lead has already released (`isStepReleasedToClient(slice)` and status `in-progress`) — this is display-only and touches no gate. Recommendation: (a) for SPICe+ (matches FINAL), (c) for P3/P4, and raise (b) with the owner.

### 3.3 Phase state

`done` = every item gate done (or N/A); `up` = every item locked and no released activity; else `active`. Glyph: done → done, active → prog (navy + gold clock), up → up. `currentStepId` = `internOverviewCurrentItemInPhase(items, gates)`.

### 3.4 Dates per step

| Kind | Real field |
|---|---|
| Done date | `approval.clientApprovedAt` ?? `slice.completedOn` ?? `slice.deliveredToClientAt` ?? `slice.reviewedAt` (accepted) ?? `slice.clientSubmittedAt` |
| Due date | `windowForStep(schedule, itemId)?.to`. Part A/B steps all inherit the single incorporation window, so they would all show "Due 28 Oct". Prototype per-step dues (7 → 9 Oct, 8 → 16 Oct) need per-step windows: `schedule.steps[itemId]` already supports any item at the repository level (`applyScheduleWindow` with `{kind:'step'}`); only the UI hides the control for Part A/B (`!isIncorporationWindowStep`). Allow managers to set per-step windows inside the incorporation window → NEW UI only. |
| "since" date (With SBC) | NEW: no timestamp records when a step moved to the firm. Use the latest of `clientSubmittedAt`, `approval.changeRequestedAt`, the previous step's done date (the gate opened then), else the `activity` row for that step. Pure helper `withFirmSince(itemId, state)` — the previous step's done date is a good default. |
| Planned (upcoming) | `windowForStep(...)?.to` (or `.from` for "opens ~") |
| Expected COI | `schedule.incorporation.to` |
| Request due (NOC "Due 9 Oct") | NEW `dueAt` on the file request |

### 3.5 What the current client Incorporation view does (to replace)

`src/views/client/Incorporation.tsx`: header = `PageBackButton` + serif h1 company name + mono "done/total · incorporationDate" + `StatusBriefButton` + `ProgressRing` (all 48 steps — DECISIONS wants SPICe+ only). Body = `ClientBoardResolutionCard` ("Board resolution ready", only when finalized) + `InternPhaseEntryCards` (4 phase rows: tick track, n/m, window meta for SPICe+ rows via `phaseWindowMeta`, What's this per phase = the current step's `WhatsThisButton`), and each row links to the phase's current step (`internOverviewCurrentItemInPhase` → `clientIncorporationStepPath`). Done counts use `isChecklistStepSequentiallyComplete`. `?step=`/`?phase=` query params redirect into the step workspace (keep `?step=` for email links; point `?phase=` at the NEW phase page). Loading = `HexgridLoader`; no engagement = `EmptyStateIllustrated`. `app/app/client/progress/page.tsx` redirects to incorporation (keep it, DECISIONS).

---

## 4. Layout and CSS

The full FINAL CSS is in §6 (verbatim). These notes give the structure per screen and breakpoint; the exact numbers are in the code blocks.

**Token gotcha:** in the real app `app/globals.css`, `--gold` is an alias of the BLUE brand colour (`--gold: 54.6% 0.215 263`). The prototype gold is literal `#c9a24b` / `#e6c46e`. Use the prototype tokens from the uncommitted `src/components/client-portal/css/00-tokens.css` (scoped `.cp`) or the `:root` block in §6. Do not use Tailwind `text-gold`. Fonts: Manrope (UI), Space Grotesk (`--disp`: big numbers, hero h1), IBM Plex Mono (`--mono`: dates, counts, eyebrows). The app already loads them in `app/layout.tsx`, and the portal also ships woff2 files under `public/client-portal/fonts`.

### 4.1 Landing — structure

```
main(margin-left:var(--sw); padding:24px clamp(14px,2.2vw,24px) 120px)
 └ .wrap (max-width 1600; flex column; gap 16)
    ├ .r2 (grid auto-fit minmax(min(100%,400px),1fr); gap 16)
    │   ├ section.coi            (navy tile; .t1 row: button.big + .ibtn + .tr1[chip.risk + button.ring]; .sub; button.pill)
    │   └ section.card.week      (.ch: h2.lbl + .cnt + .wbot[bmini + span]; a.wr × 4)
    ├ section.card.acc.phc#phc   (.ch: h2.lbl "Timeline" + .ibtn + .sp + .cnt + a.btn "Edit")
    │   ├ .gax  (4-col grid like .phh: span, span, .tl[axis labels], .ob0)
    │   └ .phr[data-p] × 4
    │       ├ .phh (grid 72px | minmax(120px,180px) | 1fr | 84px; gap 14; padding 12 18; min-height 58)
    │       │   ├ button.btn.sm.stb  ">  Steps"
    │       │   ├ .pnm  [si.xl + span.tx name]
    │       │   ├ .gl   (relative, h 34)  [button.gbar (abs left/width %) + span.glab (abs, JS-placed) + button.today]
    │       │   └ a.btn.sm.ob "Open →"
    │       └ .phb#phb-N (display none; .open → block) → .stt > .sth + (.grp) + .str × n
    └ .dg (grid 4 → 2 → 1) → section.card.acc.dc × 4  (h2.lbl + .dn[.dnut svg 96 + .c total, .lgd button.lg × k])
```
Desktop 1440 (shots/landing__1440.png): COI tile 564 px wide and This week 563 px; lane ≈ 700 px; bars placed on the axis; labels right of the bars; Today tag under the last row. Tablet 1024 (landing-open2__1024.png): simple mode — name row, then a full-width bar, then the label under it; Steps / Open buttons on the name row; donuts 2×2. Phone 390 (landing__390.png): one column; COI tile first; This week bot line wraps under the title (`.wbot{flex-basis:100%}`); Edit drops under the title; simple-mode rows; donuts stacked; step table collapses at the container queries.

### 4.2 Phase page — structure

```
.wrap → section.hero (.hrow: .hl[button.hback + .htx(.eb, .ht[h1 + button.wt], .hm)] + .hr[.hnav(a.wbtn ×2) + button.ring])
      → section.card.acc.psum (.ch + .bw[gbar inline + glab] + .kd[span × 5])
      → .sgrid (1fr | minmax(280px,320px)) → .scol[section.card.acc "Steps" > div(padding 0 8 8) > .stt]
                                          + .scol.side2[section.card.acc.rail + section.card.acc.team "Who's doing it"]
      → nav.pn (phone only)
```
Generator step table columns (phase page): `22px 26px 1fr 88px 128px 112px 34px 32px 32px` (glyph, #, step, owner, status, date, link, (?), →).

### 4.3 Step page (FINAL live layout) — structure

```
.wrap.na (max-width 1360)
 ├ .nah  [button.nabk 32 · h1 22px/700 · button.naw "(?) What's this?"]
 ├ .nag (grid 1fr | minmax(260px,296px); gap 20; align start)
 │   ├ .nam (flex column gap 14)
 │   │   ├ section.card.nac
 │   │   │   done:  .natabs[button.natab ✓ tab] + .nabd[.naok.done(circle-check, b Approved, span date)] + dl.nakv(margin 22 20 0)
 │   │   │   other: .nabd(padding 20 20 26)[p.nain + dl.nakv]
 │   │   ├ section.card.acc#docs (only steps with requests/attachments)
 │   │   └ .naf (flex end) [button.btn.nachg "Request a change"]   (done only)
 │   └ aside.card.narail (sticky top 72; padding 18 16 12) [h2 mono + .nal(max-h calc(100vh-160px), overflow auto)[.nar × n]]
 ├ nav.pn (phone)
 └ .act (sticky bottom; only status you) [.in: .st(si + b + .tr) + .bs(btn "Request a change", btn.p "Approve & submit")]
```
`.nakv div` = grid `minmax(140px,224px) 1fr`, gap 16, padding 14 0, border-bottom hairline. dt 12.5 muted; dd 14 fg (`.no` subtle). `.nar` = grid `24px 1fr 32px 32px`, gap 8, padding 8 4, radius 8; connector `:after` left 15 px, top 34 px, bottom −10 px, 2 px green (done) / 1 px `--up`. ≤999: one column (rail below). ≤767: h1 19 px; `.nabd` padding 16 14 20; kv rows single column, gap 4; icon buttons 40 px; rail rows `24px 1fr 40px 40px`; `.naf .btn{flex:1}`.

### 4.4 Board page — structure

```
.wrap → section.hero (eyebrow, h1 + wt, chips row in .hm, .hnav to steps 2/3, si.xl done)
      → section.card.trk > .lc [.stg.ok ×3 with .cn.ok between + .now.ok]
      → .brg (1.35fr | 1fr)
          ├ section.card.prv (.ch white header: lbl + cnt "page 1 of 2 · <span id=zv>100%</span>" + sp + sq(−) sq(+) sq(⛶)) + .pvw(padding 20 16 24; flex centre) > .paper(440px)
          └ .scol [section.card.acc.files (.ch + .file ×2 + .drop.blue) + section.card.acc.team "What happens with it" (botSay)]
```
Phone: tracker vertical (`.lc{flex-direction:column}`, `.stg` row layout), paper padding 24 20, font 11.5.

### 4.5 Key markup (verbatim from FINAL render, Before)

Phase row (landing, phase 2):
```html
<div class="phr" data-p="2"><div class="phh"><button type="button" class="btn sm stb" data-toggle="2" aria-expanded="false" aria-controls="phb-2" aria-label="Show the steps of SPICe+ Part B"><svg class="ic">…chevron-right…</svg>Steps</button><div class="pnm"><span class="si prog xl" role="img" aria-label="SPICe+ Part B · in progress" data-tt="SPICe+ Part B · in progress"><svg>…clock…</svg></span><span class="tx">SPICe+ Part B</span></div><div class="gl"><button type="button" class="gbar s-active" data-bar="2" style="left:…%;width:…%" aria-label="SPICe+ Part B · 1 of 9 done · 29 Sep → 28 Oct" data-tt="…" data-notip><span class="in"><i class="f" style="width:11%"></i><span class="nw" style="left:calc(11% + 6px)">Now · step 7</span></span><i class="ms"></i></button><span class="glab"><b>11%</b><span>1 / 9 steps</span></span><button type="button" class="today" style="left:…%" aria-label="Today · Tue 6 Oct" data-tt="Today · Tue 6 Oct" data-notip></button></div><a href="#" class="btn sm ob" data-go="inc-phase" aria-label="Open the SPICe+ Part B page" data-tt="SPICe+ Part B · the company is formed" data-notip>Open<svg class="ic">…arrow-right…</svg></a></div><div class="phb" id="phb-2" role="region" aria-label="SPICe+ Part B steps"></div></div>
```
Landing step row (step 7):
```html
<div class="str k-you" id="step-7"><span class="si you" role="img" aria-label="Waiting · due 9 Oct" data-tt="Waiting · due 9 Oct">…</span><span class="nb">7</span><span class="nm" title="Registered Office Address">Registered Office Address</span><span class="c-own"><span class="own You" role="img" aria-label="Owner · Northwind" data-tt="Northwind owns this step">Northwind</span></span><span class="c-st"><span class="chip you">Waiting</span></span><span class="dt c-dt">Due 9 Oct</span><span class="lkc c-lk"></span><a href="#" class="btn sm so" data-go="inc-step-7" aria-label="Open step 7 · Registered Office Address">Open<svg class="ic">…</svg></a></div>
```
Step 7 Documents card:
```html
<section class="card acc" id="docs" aria-label="Documents"><div class="ch"><h2 class="lbl">Documents<button type="button" class="ibtn" data-info="docs" aria-expanded="false" aria-label="About these documents" data-tt="About these documents" data-notip>…info…</button></h2><span class="sp"></span><span class="chip you">1 of 2</span></div>
<div class="dreq"><span class="si you" aria-hidden="true">…</span>No-objection certificate from the owner · requested by Arjun</div>
<div class="drop" data-drop="7"><button type="button" class="ut" data-upload="7" aria-label="Upload the NOC from the property owner">…upload…</button><span class="tx"><b>NOC from property owner<button type="button" class="ibtn" data-info="noc" …>…</button></b><span>Drop a file here or <button type="button" data-upload="7">browse</button></span></span><span class="chip you">Due 9 Oct</span></div>
<div class="dreq"><span class="si done" aria-hidden="true">…</span>Copy of utility bill (not older than two months)</div>
<div class="file"><span class="ft pdf">PDF</span><span class="tx"><b>Utility bill · September</b><small>tsspdcl-sep-2026.pdf · 301 KB · Arjun · 5 Oct</small></span><span class="acts"><span class="chip done">Uploaded</span><button type="button" class="sq" data-view="Utility bill · September" aria-label="Preview Utility bill · September">…eye…</button><button type="button" class="sq" data-dl="tsspdcl-sep-2026.pdf" aria-label="Download tsspdcl-sep-2026.pdf">…download…</button></span></div></section>
```
Action bar:
```html
<div class="act" role="region" aria-label="Approval"><div class="in"><div class="st"><span class="si you" aria-hidden="true">…</span><span style="min-width:0;flex:1"><b>Awaiting Northwind’s approval</b><span class="tr"><i style="width:33%"></i></span></span></div><div class="bs"><button type="button" class="btn" data-change="7">…message-square…Request a change</button><button type="button" class="btn p" data-approve="7">…check…Approve &amp; submit</button></div></div></div>
```

### 4.6 Icon map (Lucide → lucide-react)

check→`Check`, clock→`Clock`, user-round→`UserRound`, trending-up→`TrendingUp`, chevron-left/right/down→`ChevronLeft/Right/Down`, arrow-right/left→`ArrowRight/Left`, info→`Info`, download→`Download`, file-text→`FileText`, external-link→`ExternalLink`, paperclip→`Paperclip`, circle-help→`CircleHelp`, upload→`Upload`, eye→`Eye`, x→`X`, copy→`Copy`, lock→`Lock`, refresh-cw→`RefreshCw`, minus/plus→`Minus/Plus`, maximize→`Maximize`, message-square→`MessageSquare`, sun→`Sun`, pen-line→`PenLine`, more→`EllipsisVertical`, user→`User`, circle-check→`CircleCheck`. Glyph stroke widths: done 3.6, you 3, prog 2.8, with 3, late 3.4; UI icons 2; sizes `.ic` 16, `.si svg` 12 (14 XL).

### 4.7 Route mapping (prototype `data-go` keys → app)

`home`→`/app/client/overview` · `incorporation`→`/app/client/incorporation` · `inc-phase-a|inc-phase|inc-phase-3|inc-phase-4`→ NEW `/app/client/incorporation/phase/{part-a|part-b|post-incorporation|registration}` · `inc-step-N`→`clientIncorporationStepPath(item)` (`/app/client/incorporation/step/<slug>`) · `board-resolution`→`/app/client/board-resolution` · `documents`→`/app/client/documents` · `doc-viewer`→ shared preview overlay · `notifications`/`announcements` as named. `view.html` legacy hashes (rv_09→step 6, pg_s7/rv_25→7, rv_10b/rv_10c→8, pg_s10/pg_s10d→10, rv_11→board, pg_phase→phase 2) are prototype-only. `src/components/client-portal/routes.ts` (WIP) already has `PORTAL_PATHS` for most keys; add the phase and step keys.


---

## 5. Verbatim FINAL code (behaviour reference)

### 5.1 Dates (data block, identical on all 4 pages)

```js
var DATES_B=["2026-09-12","2026-09-18","2026-09-24","2026-09-27","2026-10-01","2026-10-04","2026-10-09","2026-10-16","2026-10-13","2026-10-19","2026-10-20","2026-10-21","2026-10-27","2026-10-28","2026-10-31","2026-11-01","2026-11-07","2026-11-10","2026-11-20","2026-11-24","2026-11-08","2026-11-23","2026-11-25","2026-11-03","2026-11-04","2026-11-09","2026-11-11","2026-11-11","2026-11-21","2026-11-28","2026-11-06","2026-12-05","2026-11-22","2026-11-14","2026-12-08","2026-11-24","2026-12-06","2026-12-07","2026-12-11","2026-12-13","2026-12-14","2026-12-15","2026-12-18","2026-11-27","2026-12-20","2026-12-21","2026-12-25","2026-12-27"];
```

```js
var DATES_A=["2026-09-12","2026-09-18","2026-09-24","2026-09-27","2026-10-01","2026-10-04","2026-10-09","2026-10-14","2026-10-15","2026-10-17","2026-10-19","2026-10-20","2026-10-23","2026-10-24","2026-10-27","2026-10-28","2026-11-03","2026-11-06","2026-11-16","2026-11-20","2026-11-04","2026-11-19","2026-11-21","2026-10-30","2026-10-31","2026-11-05","2026-11-07","2026-11-07","2026-11-17","2026-11-24","2026-11-02","2026-12-01","2026-11-18","2026-11-10","2026-12-04","2026-11-20","2026-12-02","2026-12-03","2026-12-07","2026-12-09","2026-12-10","2026-12-11","2026-12-14","2026-11-23","2026-12-16","2026-12-17","2026-12-21","2026-12-23"];
```

```js
var BEFORE=["done","done","done","done","done","done","you","prog","prog","prog","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up","up"];
```

```js
var AFTER=["done","done","done","done","done","done","done","done","done","done","done","done","done","done","done","done","done","done","prog","prog","done","prog","prog","done","done","done","done","done","prog","up","done","up","prog","done","up","prog","up","up","up","up","up","up","up","up","up","up","up","up"];
```

STEPS entries are `{n, p, t (title), d (description), o: "You"|"SBC", tl (timeline), f (forms[]), i ([label, hint][] from infoRequired split on " — "), u (urgent)}`, built from `incorporation-steps.json` by `build.js`.

### 5.2 Landing page script — `final-src/s/inc/incorporation.html` (complete, verbatim)

This is the whole FINAL app for the landing. The phase, step and board renderers in it are the landing build's copies; the phase and board pages use `phase.app.js` (= generator + Northwind wording, see 5.4), and the step page adds `renderLive` (5.3).

```js
(function(){
'use strict';
var PH=['Name Application','Incorporation','Post-Incorporation','Registration'];
var PH_KEY=['inc-phase-a','inc-phase','inc-phase-3','inc-phase-4'];
var PHL=['SPICe+ Part A','SPICe+ Part B','Post-incorporation','Registration'];   /* landing timeline names (design 2.01) */
var LOWN={13:'MCA',14:'MCA'};   /* steps MCA acts on: owner MCA on the landing */
var PH_TIP=['SPICe+ Part A · name approval with MCA','SPICe+ Part B · the company is formed','Post-incorporation · the first 180 days','Registrations · tax, labour, trade and FEMA'];
var PH_INFO=['Name approval with MCA (SPICe+ Part A): Northwind’s details, the board resolution, and the name application SBC files for Northwind.','SPICe+ Part B: capital, registered office, directors and subscribers, KYC and DSC, the filing, and the Certificate of Incorporation.','What a new company must do in its first months: board meeting, bank account, share capital, share certificates and ROC filings.','The registrations the company needs to operate, grouped as in VCFO Suite: General, Customs, Foreign Trade, Labour, Local Compliance, IP/Brand and FEMA.'];
var PH_WHY=['Nothing else can start until MCA approves the company name.','It ends with the Certificate of Incorporation: Northwind exists from that date.','Most of these have legal deadlines counted from the incorporation date (30 to 180 days).','The company needs these to invoice, hire and trade; GST comes first.'];
var PH_SRC=['Companies Act 2013 · SPICe+ Part A (RUN)','Companies Act 2013 · SPICe+ Part B, AGILE-PRO-S','Companies Act 2013 · INC-20A, ADT-1, SH-1','GST, labour, trade and FEMA rules'];
var INFO_WHY={coi:'It is the date your company legally exists; everything after it is counted from that day.',phases:'It shows at a glance which phase is late, on time or not started.',docs:'Missing or old documents are the most common reason MCA sends a filing back.',noc:'Without it MCA rejects the registered office proof.',timeline:'It shows who did what and when, so nothing waits unnoticed.'};
var PH_WAIT=['','','Post-incorporation starts once the Certificate of Incorporation is issued.','Registrations start after the Certificate of Incorporation. GST comes first.'];
var KL={done:'Done',you:'Waiting',prog:'In progress',with:'With SBC',up:'Upcoming',next:'Next'};
var KCOL={done:'#15805f',you:'#c8620e',prog:'#0f2a4a',with:'#2453c7',up:'#8a97a8'};
var KORD=['done','you','prog','with','up'];
var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var DAY=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
var TODAY_B='2026-10-06',TODAY_A='2026-11-12',WIN_END='2026-10-28',AX0='2026-09-08',AX1='2026-12-31';
var PLAN={1:['2026-09-08','2026-09-28'],2:['2026-09-29',WIN_END]};
var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
var AFTER_ON=readAfter(),openPh=null,briefOpen=false,firstPaint=true,pop=null,popBtn=null,lastFocus=null,railAll=false,zoom=1,checks={};
var main=document.getElementById('main');

/* ---------- helpers ---------- */
function readAfter(){try{return JSON.parse(localStorage.getItem('vcfo.after'))===true;}catch(e){return false;}}
function esc(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function ic(n,c){return '<svg class="'+(c||'ic')+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(IC[n]||'')+'</svg>';}
function sic(n,w){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(w||3)+'" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(IC[n]||'')+'</svg>';}
var GLY={done:sic('check',3.6),you:sic('user-round',3),prog:sic('clock',2.8),with:sic('trending-up',3),up:'',late:sic('x',3.4)};
function si(k,tip,cls){return '<span class="si '+k+(cls?' '+cls:'')+'"'+(tip?' role="img" aria-label="'+esc(tip)+'" data-tt="'+esc(tip)+'"':' aria-hidden="true"')+'>'+(GLY[k]||'')+'</span>';}
var BOTI='<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="15" y="2" width="2" height="5" rx="1" fill="#1e40af"/><circle cx="16" cy="3" r="2.2" fill="#2dd4bf"/><rect x="3" y="7" width="26" height="21" rx="9" fill="#2563eb"/><rect x="7" y="12" width="18" height="10" rx="5" fill="#0b1736"/><rect x="11" y="14.5" width="3" height="5" rx="1.5" fill="#7dd3fc"/><rect x="18" y="14.5" width="3" height="5" rx="1.5" fill="#7dd3fc"/></svg>';
function bmini(){return '<span class="bmini" aria-hidden="true">'+BOTI+'</span>';}
function pd(s){var a=s.split('-');return new Date(Date.UTC(+a[0],+a[1]-1,+a[2]));}
function isoD(d){return d.toISOString().slice(0,10);}
function addD(s,k){var d=pd(s);d.setUTCDate(d.getUTCDate()+k);return isoD(d);}
function fmt(s){var d=pd(s);return d.getUTCDate()+' '+MON[d.getUTCMonth()];}
function fmtY(s){return fmt(s)+' '+pd(s).getUTCFullYear();}
function wd(s){return DAY[pd(s).getUTCDay()];}
function days(a,b){return Math.round((pd(b)-pd(a))/864e5);}
function today(){return AFTER_ON?TODAY_A:TODAY_B;}
function ST(n){return (AFTER_ON?AFTER:BEFORE)[n-1];}
function KD(n){var s=ST(n);return s==='prog'&&STEPS[n-1].o!=='You'?'with':s;}
function DT(n){return (AFTER_ON?DATES_A:DATES_B)[n-1];}
function since(n){var d=addD(DT(n),-5);return d>today()?today():d;}
function coiDate(){return AFTER_ON?DT(14):WIN_END;}
function steps(p){return STEPS.filter(function(x){return x.p===p;});}
function cnt(list){var c={done:0,you:0,prog:0,with:0,up:0};list.forEach(function(x){c[KD(x.n)]++;});return c;}
function phState(p){var l=steps(p),c=cnt(l);return c.done===l.length?'done':(c.up===l.length?'up':'active');}
function phKind(p){var s=phState(p);return s==='done'?'done':(s==='up'?'up':'prog');}
function phEnd(p){var d=steps(p).map(function(x){return DT(x.n);}).sort();return d[d.length-1];}
function phPlan(p){if(PLAN[p])return PLAN[p];return [coiDate(),phEnd(p)];}
function curPhase(){for(var p=1;p<=4;p++){if(phState(p)!=='done')return p;}return 4;}
function doneN(list){return list.filter(function(x){return ST(x.n)==='done';}).length;}
function dateCell(n){var k=KD(n),d=fmt(DT(n));if(k==='done')return 'Done '+d;if(k==='you'||k==='prog')return 'Due '+d;if(k==='with')return 'since '+fmt(since(n));return n===14?'exp. '+fmt(coiDate()):'—';}
function tipTxt(n){var k=KD(n),d=fmt(DT(n));return KL[k]+' · '+(k==='done'?d:k==='with'?'since '+fmt(since(n))+' · due '+d:k==='up'?'planned '+d:'due '+d);}
function chip(k){return '<span class="chip '+k+'">'+KL[k]+'</span>';}
function own(o){var L=(o==='You'?'Northwind':o);return '<span class="own '+o+'" role="img" aria-label="Owner · '+L+'" data-tt="'+(o==='You'?'Northwind owns this step':L+' owns this step')+'">'+L+'</span>';}
function lown(x){return LOWN[x.n]||x.o;}
/* landing table status: your steps not started yet read Next (the first one) or Upcoming */
function lkind(x){var k=KD(x.n);if(k!=='prog')return k;var f=steps(x.p).filter(function(y){return KD(y.n)==='prog';})[0];return f&&f.n===x.n?'next':'up';}
function ltip(x){var k=lkind(x);return k!==KD(x.n)?KL[k]+' · planned '+fmt(DT(x.n)):tipTxt(x.n);}
function short(l){l=String(l).replace(/\s*\(.*$/,'').replace(/,.*$/,'');return l.length>22?l.slice(0,20).replace(/\s+\S*$/,'')+'…':l;}
function toast(m,u){if(window.vcfoToast)window.vcfoToast(m,u);}
function chat(q){if(window.vcfoChat)window.vcfoChat(q);else toast('Ask VCFO · '+q);}
function touch(el){if(el&&el.setAttribute)el.setAttribute('data-hit',String(Date.now()));}
function drill(cfg){if(window.vcfoDrill)window.vcfoDrill(cfg);else toast(cfg.title);}
function botSay(text,btn,q,aria,go){return '<div class="bot"><span class="bav" aria-hidden="true">'+(window.vcfoBotSVG||'')+'</span><div class="bub">'+text+(btn?'<br><button type="button" class="btn"'+(go?' data-go="'+go+'"':' data-chatq="'+esc(q)+'"')+' aria-label="'+esc(aria||btn)+'">'+esc(btn)+'</button>':'')+'</div></div>';}
function stRow(x){return [esc(x.n+' · '+x.t),dateCell(x.n),KL[KD(x.n)],KCOL[KD(x.n)],'inc-step-'+x.n];}
function tabsFor(list){return KORD.map(function(k){return {k:k,label:KL[k],color:KCOL[k],rows:list.filter(function(x){return KD(x.n)===k;}).map(stRow)};}).filter(function(t){return t.rows.length;});}
function idx(tabs,k){for(var i=0;i<tabs.length;i++){if(tabs[i].k===k)return i;}return 0;}
function whats(x){return 'What’s this: '+x.t+'?';}
function regGroup(t){
  t=t.toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
  if(/\bfc\s*gpr\b|\bfdi\b|\bodi\b|\bfla\b|\bfctrs\b|\bfc\s*trs\b|\bfema\b/.test(t))return 'FEMA';
  if(/\bgst\b|\besi\b|(^| )pf( |$)|(^| )pt( |$)|\blei\b|\bmsme\b/.test(t))return 'General';
  if(/\bicegate\b|\biec\b|\blut\b/.test(t))return 'Customs';
  if(/\bnon stpi\b|\bstpi\b/.test(t))return 'Foreign Trade';
  if(/\bshops?\b|\bestablishment\b|\bclra\b|\bposh\b|\bshe box\b/.test(t))return 'Labour';
  if(/\btrade licen/.test(t))return 'Local Compliance';
  if(/\btrademark\b|\bpatent\b|\bicdr\b/.test(t))return 'IP/Brand';
  return 'General';
}

/* ---------- sub-steps ---------- */
var SUBS={6:['Share classes','Shares','Face value','Holding'],7:['Office address','State','NOC','Utility bill'],8:['Directors','DIN · DSC','ID proofs','Address proofs','Interests'],10:['KYC data','KYC review','DSC']};
var SUBK_B={7:['done','done','now','done'],8:['done','done','now','todo','todo'],10:['done','now','todo']};
function subList(x){
  var labels=SUBS[x.n]||((x.i&&x.i.length)?x.i.map(function(q){return short(q[0]);}):[short(x.t)]),k=ST(x.n),n=labels.length,st;
  if(k==='done')st=labels.map(function(){return 'done';});
  else if(k==='up')st=labels.map(function(){return 'todo';});
  else if(!AFTER_ON&&SUBK_B[x.n])st=SUBK_B[x.n];
  else{var m=k==='you'?n-1:Math.floor(n/2);st=labels.map(function(_,j){return j<m?'done':(j===m?'now':'todo');});}
  return labels.map(function(l,j){return {l:l,s:st[j]};});
}
function dots(x){return '<span class="dots" aria-hidden="true">'+subList(x).slice(0,6).map(function(s){return '<i class="'+(s.s==='done'?'on':s.s==='now'?'cu':'')+'"></i>';}).join('')+'</span>';}

/* ---------- shared: hero ---------- */
function ringSvg(pct,col){var R=20,C=2*Math.PI*R,l=C*pct/100;return '<svg viewBox="0 0 50 50" aria-hidden="true"><circle cx="25" cy="25" r="'+R+'" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="5"></circle><circle cx="25" cy="25" r="'+R+'" fill="none" stroke="'+(col||'#e6c46e')+'" stroke-width="5" stroke-linecap="round" stroke-dasharray="'+Math.max(l,.01).toFixed(2)+' '+C.toFixed(2)+'"></circle></svg>';}
function spice(){var sp=STEPS.filter(function(x){return x.p<=2;}),d=doneN(sp);return {d:d,t:sp.length,pct:Math.round(d/sp.length*100)};}

/* ---------- landing ---------- */
function heroLanding(){
  var all=doneN(STEPS),s=spice();
  return '<section class="hero" aria-label="Incorporation · Northwind Technologies India Pvt Ltd"><div class="hrow">'+
    '<div class="hl"><button type="button" class="hback" data-go="home" aria-label="Back to Home">'+ic('chevron-left')+'</button>'+
    '<div class="htx"><div class="eb">Incorporation · 4 phases</div><div class="ht"><h1>Northwind Technologies India Pvt Ltd</h1></div>'+
    '<div class="hm">'+all+'/48 · '+(AFTER_ON?'incorporated '+fmtY(DT(14)):'COI expected '+fmtY(WIN_END))+'</div></div></div>'+
    '<div class="hr"><button type="button" class="hbtn" data-brief aria-haspopup="dialog" aria-label="Monthly status brief" data-tt="Monthly status brief" data-notip>'+ic('download')+'<span class="lt">Monthly status brief</span></button>'+
    '<a href="#" class="hbtn" data-go="board-resolution" aria-label="Board resolution · ready" data-tt="Board resolution · signed copy received" data-notip>'+ic('file-text')+'<span class="lt">Board resolution</span><span class="rd">'+ic('check')+'Ready</span></a>'+
    '<button type="button" class="ring" data-ring aria-label="SPICe+ progress · '+s.pct+'% · '+s.d+' of '+s.t+' steps done" data-tt="SPICe+ · '+s.d+' of '+s.t+' steps done" data-notip><span class="rw">'+ringSvg(s.pct)+'<span class="pc">'+s.pct+'%</span></span><small>SPICe+</small></button></div>'+
  '</div></section>';
}
function ringBtn(){var s=spice();return '<button type="button" class="ring" data-ring aria-label="SPICe+ progress · '+s.pct+'% · '+s.d+' of '+s.t+' steps done" data-tt="SPICe+ · '+s.d+' of '+s.t+' steps done" data-notip><span class="rw">'+ringSvg(s.pct)+'<span class="pc">'+s.pct+'%</span></span><small>SPICe+</small></button>';}
function coiTile(){
  var all=doneN(STEPS),pct=Math.round(all/48*100),h='<section class="coi" aria-label="'+(AFTER_ON?'Incorporated':'Days to COI')+'"><div class="t1">';
  if(!AFTER_ON){
    var d=days(TODAY_B,WIN_END),you=STEPS.filter(function(x){return KD(x.n)==='you';})[0];
    h+='<button type="button" class="big" data-coi aria-label="'+d+' days to COI · expected '+wd(WIN_END)+' '+fmtY(WIN_END)+'" data-tt="Expected '+wd(WIN_END)+' '+fmtY(WIN_END)+' · window set by Arjun Mehta" data-notip><b id="coiN">'+d+'</b><span>days to COI</span></button>'+
      '<button type="button" class="ibtn" data-info="coi" aria-expanded="false" aria-label="About days to COI" data-tt="About days to COI" data-notip>'+ic('info')+'</button>'+
      '<span class="tr1">'+(you?'<a href="#" class="chip risk" data-go="inc-step-'+you.n+'" aria-label="At risk · step '+you.n+' · '+esc(you.t)+'" data-tt="Step '+you.n+' is waiting on Northwind · due '+fmt(DT(you.n))+'" data-notip>At risk · step '+you.n+'</a>':'')+ringBtn()+'</span>'+
      '</div><div class="sub"><span>Northwind Technologies India Pvt Ltd · expected '+wd(WIN_END)+' '+fmt(WIN_END)+'</span></div>';
  }else{
    var e=days(DT(14),WIN_END);
    h+='<button type="button" class="big" data-coi aria-label="Incorporated '+fmtY(DT(14))+'" data-tt="Certificate of Incorporation · '+wd(DT(14))+' '+fmtY(DT(14))+'" data-notip><b>'+fmt(DT(14))+'</b><span>incorporated</span></button>'+
      '<button type="button" class="ibtn" data-info="coi" aria-expanded="false" aria-label="About the incorporation date" data-tt="About the incorporation date" data-notip>'+ic('info')+'</button>'+
      '<span class="tr1"><span class="chip done" role="img" aria-label="'+e+' days early" data-tt="Window ended '+wd(WIN_END)+' '+fmt(WIN_END)+'">'+e+' days early</span>'+ringBtn()+'</span>'+
      '</div><div class="sub"><span>Northwind Technologies India Pvt Ltd · incorporated '+wd(DT(14))+' '+fmt(DT(14))+'</span><span class="mono">· CIN, PAN and TAN issued</span><a href="#" data-go="doc-viewer">Open certificate</a></div>';
  }
  h+='<button type="button" class="pill" data-allsteps aria-label="'+all+' of 48 steps done · '+pct+'%"><span>'+all+' / 48 steps</span><span class="tr"><i style="width:'+Math.max(pct,2)+'%"></i></span><b>'+pct+'%</b></button>';
  return h+'</section>';
}
var WEEK_B=[['You','Upload NOC · requested by Arjun','9 Oct',7],['You','Check & approve step 7','9 Oct',7],['SBC','KYC review & DSC','now',10],['SBC','Draft MOA & AOA','12 Oct',11]];
function weekCard(){
  var rows=AFTER_ON?STEPS.filter(function(x){var k=KD(x.n);return k==='with'||k==='you'||k==='prog';}).sort(function(a,b){return DT(a.n)<DT(b.n)?-1:1;}).slice(0,4).map(function(x){return [x.o,x.t,DT(x.n)<=addD(TODAY_A,3)?'now':fmt(DT(x.n)),x.n];}):WEEK_B;
  var range=AFTER_ON?'9 – 15 Nov':'6 – 12 Oct';
  var h='<section class="card week" aria-label="This week"><div class="ch"><h2 class="lbl">This week</h2><span class="cnt">'+range+'</span><span class="wbot">'+bmini()+'<span>'+(AFTER_ON?'Nothing is waiting on Northwind this week.':'MCA: nothing pending this week.')+'</span></span></div>';
  rows.forEach(function(r){h+='<a href="#" class="wr" data-go="inc-step-'+r[3]+'" aria-label="'+esc(r[1])+' · '+(r[0]==='You'?'Northwind':r[0])+' · '+r[2]+'"><span class="own '+r[0]+'">'+(r[0]==='You'?'Northwind':r[0])+'</span><span class="t">'+esc(r[1])+'</span><span class="dt">'+r[2]+'</span></a>';});
  return h+'</section>';
}
function pos(s){return Math.max(0,Math.min(1,days(AX0,s)/days(AX0,AX1)))*100;}
function phLabel(p){
  var l=steps(p),d=doneN(l),t=l.length,pct=Math.round(d/t*100),ps=phState(p),pl=phPlan(p),e;
  if(ps==='done'){var end=phEnd(p),dl=days(pl[1],end);e=dl>0?'<span class="e late">'+dl+' day'+(dl===1?'':'s')+' late</span>':dl<0?'<span class="e early">'+(-dl)+' days early</span>':'';}
  else e='';
  return '<b>'+pct+'%</b><span>'+d+' / '+t+' steps</span>'+e;
}
function phBar(p,inline){
  var l=steps(p),d=doneN(l),t=l.length,ps=phState(p),pl=phPlan(p),end=ps==='done'?phEnd(p):pl[1],last=end>pl[1]?end:pl[1];
  var a=pos(pl[0]),b=pos(last),w=Math.max(b-a,1.5),fill,late='',cls=ps==='done'?'s-done':(ps==='up'?'s-up':'s-active');
  if(ps==='done'){fill=100;if(end>pl[1]){var lp=days(pl[1],end)/Math.max(1,days(pl[0],end))*100;late='<i class="lt" style="width:'+lp.toFixed(1)+'%"></i>';}}
  else fill=Math.round(d/t*100);
  var tip=PHL[p-1]+' · '+d+' of '+t+' done · '+fmt(pl[0])+' → '+fmt(pl[1]);
  var nw=l.filter(function(x){var k=KD(x.n);return k==='you'||k==='prog'||k==='with';})[0];
  nw=ps==='active'&&nw?'<span class="nw" style="left:calc('+fill+'% + 6px)">Now · step '+nw.n+'</span>':'';
  return '<button type="button" class="gbar '+cls+'" data-bar="'+p+'"'+(inline?'':' style="left:'+a.toFixed(2)+'%;width:'+w.toFixed(2)+'%"')+' aria-label="'+esc(tip)+'" data-tt="'+esc(tip)+'" data-notip><span class="in"><i class="f" style="width:'+fill+'%"></i>'+late+nw+'</span>'+(p===2?'<i class="ms"></i>':'')+'</button>';
}
function axis(){
  var h='',d='2026-09-15';
  while(d<='2026-12-29'){h+='<span style="left:'+pos(d).toFixed(2)+'%">'+fmt(d)+'</span>';d=addD(d,7);}
  return '<div class="gax" aria-hidden="true"><span></span><span></span><div class="tl">'+h+'</div><span class="ob0"></span></div>';
}
function stepTable(p,cur){
  var h='<div class="stt"><div class="sth" aria-hidden="true"><span></span><span></span><span>Step</span><span class="c-own">Owner</span><span class="c-st">Status</span><span class="c-dt">Date</span><span class="lk c-lk">Portal · Proof</span><span></span></div>',g='';
  if(phState(p)==='up'&&PH_WAIT[p-1])h=botSay(PH_WAIT[p-1],'Ask VCFO when it starts','When does '+PHL[p-1]+' start?','Ask VCFO when '+PHL[p-1]+' starts')+h;
  steps(p).forEach(function(x){
    if(p===4){var gg=regGroup(x.t);if(gg!==g){h+='<div class="grp">'+gg+'</div>';g=gg;}}
    var k=lkind(x),o=lown(x),po=o!=='You'&&x.n!==2,f=x.f[0]||'the MCA filing',lk='';
    if(po)lk='<button type="button" class="lkb" data-portal-f="'+esc(f)+'" aria-label="Open '+esc(f)+' on the official portal" data-tt="'+esc(f)+' · official portal" data-notip>'+ic('external-link')+'</button>';
    if(po&&k==='done')lk+='<button type="button" class="prf" data-view="Proof · step '+x.n+' · '+esc(x.t)+'" aria-label="Proof of step '+x.n+' · '+esc(x.t)+'">'+ic('paperclip')+'Proof</button>';
    h+='<div class="str k-'+k+(cur===x.n?' cur':'')+'" id="step-'+x.n+'">'+si(k==='next'?'up':k,ltip(x))+'<span class="nb">'+x.n+'</span><span class="nm" title="'+esc(x.t)+'">'+esc(x.t)+(x.u?'<span class="urg">Urgent</span>':'')+'</span>'+
      '<span class="c-own">'+own(o)+'</span><span class="c-st">'+chip(k)+'</span><span class="dt c-dt">'+(k!==KD(x.n)?'—':dateCell(x.n))+'</span><span class="lkc c-lk">'+lk+'</span>'+
      '<a href="#" class="btn sm so" data-go="inc-step-'+x.n+'" aria-label="Open step '+x.n+' · '+esc(x.t)+'">Open'+ic('arrow-right')+'</a></div>';
  });
  return h+'</div>';
}
function todayLine(){var t=today();return '<button type="button" class="today" style="left:'+pos(t).toFixed(2)+'%" aria-label="Today · '+wd(t)+' '+fmt(t)+'" data-tt="Today · '+wd(t)+' '+fmt(t)+'" data-notip></button>';}
function stbLabel(p,o){return (o?'Hide':'Show')+' the steps of '+PHL[p-1];}
function phaseRow(p){
  var open=openPh===p,ps=phState(p),k=phKind(p);
  return '<div class="phr'+(open?' open':'')+'" data-p="'+p+'"><div class="phh">'+
    '<button type="button" class="btn sm stb" data-toggle="'+p+'" aria-expanded="'+open+'" aria-controls="phb-'+p+'" aria-label="'+stbLabel(p,open)+'">'+ic('chevron-right')+'Steps</button>'+
    '<div class="pnm">'+si(k,PHL[p-1]+' · '+(ps==='done'?'done':ps==='up'?'upcoming':'in progress'),'xl')+'<span class="tx">'+PHL[p-1]+'</span></div>'+
    '<div class="gl">'+phBar(p)+'<span class="glab">'+phLabel(p)+'</span>'+todayLine()+'</div>'+
    '<a href="#" class="btn sm ob" data-go="'+PH_KEY[p-1]+'" aria-label="Open the '+PHL[p-1]+' page" data-tt="'+esc(PH_TIP[p-1])+'" data-notip>Open'+ic('arrow-right')+'</a>'+
    '</div><div class="phb" id="phb-'+p+'" role="region" aria-label="'+PHL[p-1]+' steps">'+(open?stepTable(p):'')+'</div></div>';
}
function phasesCard(){
  var d=doneN(STEPS);
  var h='<section class="card acc phc" id="phc"><div class="ch"><h2 class="lbl">Timeline<button type="button" class="ibtn" data-info="phases" aria-expanded="false" aria-label="About the timeline" data-tt="About the timeline" data-notip>'+ic('info')+'</button></h2><span class="sp"></span><span class="cnt">'+d+' of 48 steps · Sep – Dec 2026</span><a class="btn btn-o" href="#" style="height:30px;padding:0 10px;font-size:12px;margin-left:10px" aria-label="Edit the timeline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M14.5 5.5l4 4L9 19l-4.5 1 1-4.5Z"></path><path d="M15.5 4.5a2 2 0 0 1 2.9 0l1.1 1.1a2 2 0 0 1 0 2.9L9 19l-4.5 1 1-4.5Z M13.5 6.5l4 4"></path></svg>Edit</a></div>'+axis();
  for(var p=1;p<=4;p++)h+=phaseRow(p);
  return h+'</section>';
}
/* donuts */
var DOCS_B={you:[['Submitted',8,'#15805f',['PAN · Rohan Kumar','Aadhaar · Rohan Kumar','Passport · J. Carter','Address proof · J. Carter','Photo · Rohan Kumar','Photo · J. Carter','Signed board resolution','Cap table']],['Under review',1,'#2453c7',['Utility bill · September']],['Pending',2,'#d9731f',['NOC from property owner','Bank statement · J. Carter']],['Sent back',1,'#cf3a2f',['Address proof · Rohan Kumar · older than two months']]],
  sbc:[['Generated',5,'#2f6fd0',['Board resolution draft','Name application (RUN)','Name approval letter','SPICe+ Part A','DIR-2 consent letters']],['Pending',7,'#dfe4ec',['MOA','AOA','INC-9','DIR-8','INC-22','AGILE-PRO-S','SPICe+ Part B']],['Signed by Northwind',2,'#15805f',['Board resolution (signed)','DIR-2 · Rohan Kumar']]]};
var DOCS_A={you:[['Submitted',11,'#15805f',['PAN · Rohan Kumar','Aadhaar · Rohan Kumar','Passport · J. Carter','Address proof · J. Carter','Address proof · Rohan Kumar','Photo · Rohan Kumar','Photo · J. Carter','Signed board resolution','Cap table','Utility bill · September','NOC from property owner']],['Under review',0,'#2453c7',[]],['Pending',1,'#d9731f',['Bank KYC letter · FIRC']],['Sent back',0,'#cf3a2f',[]]],
  sbc:[['Generated',14,'#2f6fd0',['Certificate of Incorporation','PAN card','TAN card','MOA','AOA','INC-9','DIR-8','INC-22','AGILE-PRO-S','SPICe+ Part B','First board meeting minutes','ADT-1','Company letterhead','GST certificate']],['Pending',5,'#dfe4ec',['SH-1 share certificates','INC-20A','FC-GPR','MGT-4/5/6','PT certificate']],['Signed by Northwind',3,'#15805f',['Board resolution (signed)','DIR-2 · Rohan Kumar','SPICe+ Part B']]]};
function donut(key,title,segs){
  var tot=segs.reduce(function(a,s){return a+s[1];},0),R=38,C=2*Math.PI*R,off=0,svg='',nz=segs.filter(function(q){return q[1];}).length;
  segs.forEach(function(s,i){if(!s[1])return;var l=C*s[1]/tot,g=nz>1?1.2:0;
    svg+='<circle class="sg" cx="48" cy="48" r="'+R+'" stroke="'+s[2]+'" stroke-dasharray="'+Math.max(l-g,.1).toFixed(2)+' '+(C-l+g).toFixed(2)+'" stroke-dashoffset="'+(-off).toFixed(2)+'" data-seg="'+key+':'+i+'" data-tt="'+esc(s[0])+' · '+s[1]+'"></circle>';off+=l;});
  return '<section class="card acc dc" aria-label="'+esc(title)+'"><h2 class="lbl">'+title+'</h2><div class="dn"><div class="dnut"><svg viewBox="0 0 96 96" aria-hidden="true">'+svg+'</svg><span class="c">'+tot+'</span></div><div class="lgd">'+
    segs.map(function(s,i){return '<button type="button" class="lg" data-seg="'+key+':'+i+'" aria-label="'+esc(title)+' · '+esc(s[0])+' · '+s[1]+'"><i style="background:'+s[2]+'"></i><span>'+esc(s[0])+'</span><b>'+s[1]+'</b></button>';}).join('')+'</div></div></section>';
}
function segData(){
  var D=AFTER_ON?DOCS_A:DOCS_B,left=STEPS.filter(function(x){return ST(x.n)!=='done';});
  var you=left.filter(function(x){return lown(x)==='You';}),sbc=left.filter(function(x){return lown(x)==='SBC';}),mca=left.filter(function(x){return lown(x)==='MCA';});
  var act=STEPS.filter(function(x){var k=KD(x.n);return k==='you'||k==='prog'||k==='with';});
  var risk=act.filter(function(x){return KD(x.n)==='you';}),ok=act.filter(function(x){return KD(x.n)!=='you';});
  return {you:D.you,sbc:D.sbc,who:[['Northwind',you.length,'#c9a24b',you],['SBC',sbc.length,'#2f6fd0',sbc],['MCA',mca.length,'#6b3fc4',mca]],plan:[['On time',ok.length,'#15805f',ok],['At risk',risk.length,'#d9731f',risk],['Overdue',0,'#cf3a2f',[]]]};
}
var SEG_T={you:'Documents from Northwind',sbc:'Documents SBC prepares',who:'Who’s working on what',plan:'On plan vs overdue'};
function donuts(){var s=segData();return '<div class="dg">'+donut('you',SEG_T.you,s.you)+donut('sbc',SEG_T.sbc,s.sbc)+donut('who',SEG_T.who,s.who)+donut('plan',SEG_T.plan,s.plan)+'</div>';}
function drillSeg(v){
  var a=v.split(':'),key=a[0],i=+a[1],s=segData()[key],docs=key==='you'||key==='sbc';
  var tabs=s.map(function(q,j){return {k:j,label:q[0],color:q[2],rows:(q[3]||[]).map(function(r){return typeof r==='string'?[esc(r),key==='you'?'From Northwind':'Prepared by SBC','','','documents']:stRow(r);})};});
  var cfg={title:SEG_T[key],sub:s.reduce(function(t,q){return t+q[1];},0)+(docs?' documents':' steps'),tabs:tabs,active:i};
  if(docs)cfg.link={lead:'Every document, with versions',text:'Open Documents →',go:'documents',where:'Documents'};
  drill(cfg);
}
function renderLanding(){
  document.title='Incorporation · VCFO Suite';
  main.innerHTML='<div class="wrap"><div class="r2">'+coiTile()+weekCard()+'</div>'+phasesCard()+donuts()+'</div>';
  layoutGantt();
  if(firstPaint&&!AFTER_ON&&!reduce){var el=document.getElementById('coiN');if(el){var to=+el.textContent,t0=0;el.textContent='0';
    requestAnimationFrame(function f(ts){if(!t0)t0=ts;var k=Math.min(1,(ts-t0)/650);el.textContent=String(Math.round(to*(1-Math.pow(1-k,3))));if(k<1)requestAnimationFrame(f);});}}
}
function layoutGantt(){
  var c=document.getElementById('phc');if(!c)return;
  c.classList.remove('simple');
  var gl=c.querySelector('.gl');if(!gl)return;
  var W=gl.getBoundingClientRect().width,simple=W<500,ax=c.querySelector('.gax'),sp=W*7/days(AX0,AX1);
  if(ax){ax.classList.toggle('e2',sp<58&&sp>=29);ax.classList.toggle('e4',sp<29);}
  if(!simple)[].forEach.call(c.querySelectorAll('.gl'),function(g){
    var b=g.querySelector('.gbar'),lb=g.querySelector('.glab');if(!b||!lb)return;
    var a=parseFloat(b.style.left)/100*W,e=a+parseFloat(b.style.width)/100*W,lw=lb.getBoundingClientRect().width;
    lb.style.left='';lb.style.right='';
    if(W-e>=lw+18)lb.style.left=(e+14)+'px';
    else if(a>=lw+14)lb.style.right=(W-a+10)+'px';
    else simple=true;
  });
  if(simple){c.classList.add('simple');[].forEach.call(c.querySelectorAll('.glab'),function(lb){lb.style.left='';lb.style.right='';});}
}

/* ---------- journey rail (focus track) ---------- */
function railSub(x){var k=KD(x.n);return k==='done'?'Done · '+fmt(DT(x.n)):k==='you'?'Waiting on Northwind · due '+fmt(DT(x.n)):k==='prog'?'In progress · due '+fmt(DT(x.n)):k==='with'?'With Northwind’s project lead · since '+fmt(since(x.n)):'Opens later';}
function railHero(x,isPage){
  var k=KD(x.n),sl=subList(x),dn=sl.filter(function(s){return s.s==='done';}).length,lbl=(isPage?(k==='done'?'Done':k==='up'?'Upcoming':'Now'):'Now')+' · step '+x.n;
  var labels=sl.length<=4&&sl.every(function(s){return s.l.length<=14;});
  return '<div class="rh" role="group" aria-label="Step '+x.n+' · '+esc(x.t)+' · '+railSub(x)+'"><div class="hh">'+si(k,tipTxt(x.n))+'<div style="min-width:0"><div class="k">'+lbl+'</div><b>'+esc(x.t)+'</b><small>'+railSub(x)+'</small></div>'+
    '<button type="button" class="wq" data-ask="'+x.n+'" aria-label="What’s this? '+esc(x.t)+'" data-tt="What’s this? · ask VCFO" data-notip>'+ic('circle-help')+'</button></div>'+
    '<div class="subt">'+sl.map(function(s){return '<span class="sb '+(s.s==='done'?'on':s.s==='now'?'cu':'')+'" role="img" aria-label="'+esc(s.l)+' · '+(s.s==='done'?'done':s.s==='now'?'in progress':'to do')+'" data-tt="'+esc(s.l)+' · '+(s.s==='done'?'done':s.s==='now'?'in progress':'to do')+'"><i></i>'+(labels?'<span>'+esc(s.l)+'</span>':'')+'</span>';}).join('')+'</div>'+
    (labels?'':'<div class="subn">'+dn+' of '+sl.length+' sub-steps done</div>')+'</div>';
}
function rail(p,focus,isPage){
  var l=steps(p),d=doneN(l),list=l;
  if(l.length>11&&!railAll){var i=l.map(function(x){return x.n;}).indexOf(focus),s=Math.max(0,Math.min(l.length-9,i-4));list=l.slice(s,s+9);}
  var h='<section class="card acc rail" aria-label="Journey · Phase '+p+'"><div class="ch"><h2 class="lbl" style="font-size:11.5px">'+PH[p-1]+' · journey</h2><span class="sp"></span><span class="chip up" style="font-family:var(--mono);font-weight:600">'+d+' / '+l.length+'</span></div><div class="rl">';
  list.forEach(function(x,j){
    var k=KD(x.n),nx=list[j+1],ok=k==='done'&&nx&&KD(nx.n)==='done';
    if(x.n===focus){h+=railHero(x,isPage);return;}
    h+='<a href="#" class="rr'+(ok?' ok':'')+(j===list.length-1?' last':'')+'" data-go="inc-step-'+x.n+'" aria-label="Step '+x.n+' · '+esc(x.t)+' · '+railSub(x)+'">'+si(k,tipTxt(x.n))+'<span style="min-width:0"><b>'+x.n+' · '+esc(x.t)+'</b><small>'+railSub(x)+'</small>'+(k==='done'||k==='up'?'':dots(x))+'</span>'+own(x.o)+'</a>';
  });
  h+='</div>'+(l.length>11?'<button type="button" class="btn sm rmore" data-railall aria-expanded="'+railAll+'">'+(railAll?'Show fewer steps':'Show all '+l.length+' steps')+'</button>':'');
  return h+'</section>';
}

/* ---------- step page ---------- */
var X={
 6:{tab:'Capital structure',forms:['SPICe+ Part B'],pre:'Filled by Arjun Mehta from Northwind’s cap table',
    f:[['Authorised capital','₹10,00,000'],['Paid-up capital','₹1,00,000'],['Face value','₹10 · 10,000 shares'],['Shareholding','Northwind Inc. 9,999 · nominee 1']],
    docs:[{t:'xlsx',n:'Cap table',f:'northwind-cap-table.xlsx',m:'Northwind · 2 Oct',s:'Checked'}],
    tl:[['ok','Answers filled','Arjun Mehta','2 Oct'],['ok','Approved by Northwind’s manager','Priya Raman','3 Oct'],['ok','Approved by Northwind','Northwind','4 Oct']],
    stg:['Arjun · 2 Oct','Arjun · 3 Oct','Priya · 3 Oct','4 Oct']},
 7:{tab:'Registered office',forms:['SPICe+ Part B','INC-22'],pre:'Pre-filled from project setup',
    f:[['Complete address of the proposed registered office','Plot 42, 3rd Floor, Cyber Towers, HITEC City, Madhapur, Hyderabad 500081'],['State / union territory of the registered office','Telangana'],['Utility bill type','Electricity bill'],['Utility bill number','TSSPDCL 1102 4587 66'],['Remarks (optional)','—']],
    banner:'Northwind’s team filled this step. Check it, upload the NOC Arjun asked for, then approve & submit.',bsub:'Prepared from Northwindr project setup; approved by Priya Raman on 6 Oct.',
    need:[['noc','Upload NOC from owner','9 Oct',false],['chk','Check the answers','9 Oct',true],['ok','Approve & submit','9 Oct',false]],
    tlB:[['ok','Pre-filled from project setup','Arjun Mehta · Project Lead','5 Oct'],['ok','Utility bill attached','Arjun Mehta','5 Oct'],['ok','Approved by Northwind’s manager','Priya Raman','6 Oct'],['you','NOC requested from Northwind','Arjun Mehta','6 Oct'],['you','Approve & submit','Northwind','due 9 Oct'],['up','Step 8 opens','Proposed directors','after approval']],
    tlA:[['ok','Pre-filled from project setup','Arjun Mehta · Project Lead','5 Oct'],['ok','Approved by Northwind’s manager','Priya Raman','6 Oct'],['ok','NOC uploaded','Northwind','8 Oct'],['ok','Approved by Northwind','Northwind','9 Oct'],['ok','Step 8 opened','Proposed directors','9 Oct']],
    stgB:['Arjun · 2 Oct','Northwind · due 9 Oct','Arjun Mehta','Priya Raman'],stgA:['Arjun · 2 Oct','Northwind · 8 Oct','Arjun · 9 Oct','9 Oct']},
 8:{tab:'Directors',forms:['DIR-2','INC-9'],
    fB:[['Director name · gender · residency','Rohan Kumar · male · resident; J. Carter · male · non-resident'],['DIN · DSC status','Applying through SPICe+ (DIR-3)'],['Aadhaar + PAN (resident) / passport (non-resident)','2 of 3 uploaded'],['Utility bill · photograph','—'],['Other company interests','—']],
    fA:[['Director name · gender · residency','Rohan Kumar · male · resident; J. Carter · male · non-resident'],['DIN · DSC status','DIN allotted with the COI · DSC issued'],['Aadhaar + PAN (resident) / passport (non-resident)','3 of 3 uploaded'],['Utility bill · photograph','Uploaded for both directors'],['Other company interests','None declared (DIR-8)']],
    bubB:'Northwind has started this step. The missing KYC for J. Carter is due by 16 Oct. Northwind’s team reviews it once step 7 is approved.',
    need:[['kyc','Add J. Carter’s address proof','16 Oct',false],['ph','Upload both photographs','16 Oct',false],['sub','Submit for review','16 Oct',false]],
    tlB:[['ok','Director details pre-filled','Arjun Mehta · from project setup','5 Oct'],['ok','Passport · J. Carter uploaded','Northwind','6 Oct'],['prog','Fill and submit','Northwind · 2 of 5 answered','due 16 Oct'],['up','Review by Northwind’s team','Arjun Mehta','after Northwind submits']],
    tlA:[['ok','Director details filled','Northwind','12 Oct'],['ok','Reviewed by Northwind’s team','Arjun Mehta','14 Oct'],['ok','Approved by Northwind','Northwind','16 Oct']],
    stgB:['Northwind · due 16 Oct','Northwind','Arjun Mehta','Priya Raman'],stgA:['Northwind · 10 Oct','Northwind · 12 Oct','Arjun · 14 Oct','16 Oct']},
 10:{tab:'KYC & DSC',forms:['DSC · eMudhra'],
    fB:[['KYC review status','—'],['DSC success message · Non-resident director','—'],['DSC success message · Resident director','—'],['Date of signing','—'],['Place of signing','—'],['Witness to the subscribers','—'],['Other attachments','—']],
    fA:[['KYC review status','Cleared · 17 Oct'],['DSC success message · Non-resident director','Issued · eMudhra · 18 Oct'],['DSC success message · Resident director','Issued · eMudhra · 18 Oct'],['Date of signing','19 Oct 2026'],['Place of signing','Hyderabad'],['Witness to the subscribers','Priya Raman, CS'],['Other attachments','Video KYC recordings (2)']],
    bubB:'Northwind’s team prepares this step. The KYC result and the DSC proof appear here when they are delivered.',
    tlB:[['ok','KYC data received','From Northwind’s project setup','6 Oct'],['with','KYC review','Arjun Mehta · in progress','since 6 Oct'],['up','DSC creation (eMudhra)','Two 30-minute video slots','15 – 16 Oct'],['up','Delivered to Northwind','Northwind approves or requests a change','19 Oct']],
    tlA:[['ok','KYC data received','From Northwind’s project setup','6 Oct'],['ok','KYC review','Arjun Mehta','17 Oct'],['ok','DSC creation (eMudhra)','Both directors','18 Oct'],['ok','Delivered and approved','Northwind','19 Oct']],
    stgB:['Arjun Mehta · since 6 Oct','19 Oct','Northwind','Priya Raman'],stgA:['Arjun · 6 Oct','18 Oct','Northwind · 19 Oct','19 Oct']}
};
function curN(){var m=(location.hash||'').match(/n=(\d+)/),n=m?+m[1]:7;return (n>=1&&n<=48)?n:7;}
function stages(x){
  var k=KD(x.n),you=x.o==='You',d=DT(x.n),c=X[x.n]||{},sg=c[AFTER_ON?'stgA':'stgB']||c.stg;
  if(sg&&(k==='up'))sg=null;
  var names=you?['Started','Submitted','Reviewed','Completed']:(k==='with'?['With SBC','Delivered to Northwind','Northwind approves','Completed']:k==='done'?['Started','Delivered to Northwind','Northwind approved','Completed']:['Started','Delivered to Northwind','Northwind approves','Completed']);
  if(k==='up')names=['','Delivered to Northwind','Northwind approves','Completed'];
  var subs=sg||(k==='done'?['Arjun · '+fmt(addD(d,-4)),'Arjun · '+fmt(addD(d,-2)),(you?'Priya · ':'Northwind · ')+fmt(addD(d,-1)),fmt(d)]:k==='you'?['Arjun · '+fmt(addD(today(),-3)),'Northwind · due '+fmt(d),'Arjun Mehta','Priya Raman']:k==='prog'?['Northwind · due '+fmt(d),'Northwind','Arjun Mehta','Priya Raman']:k==='with'?['Arjun Mehta · since '+fmt(since(x.n)),fmt(d),'Northwind','Priya Raman']:['','~'+fmt(d),'',''] );
  var cur=k==='done'?3:k==='you'?(you?1:2):0,parts=[];
  names.forEach(function(nm,i){
    var state=k==='done'||i<cur?'ok':(i===cur?'now':'todo');
    if(i===cur){
      var hero;
      if(k==='done')hero=['ok','check','Completed',you?'Approved by Northwind':'Completed',subs[3]];
      else if(k==='you')hero=['','upload','Now · '+(cur+1)+' of 4',nm,subs[cur],'Waiting on Northwind'];
      else if(k==='prog')hero=['','pen-line','Now · 1 of 4','Filling in',subs[0]];
      else if(k==='with')hero=['','sun','Now · with SBC','SBC is working on it',subs[0]];
      else hero=['','lock','Opens after step '+(x.n-1),'Not started','Starts when step '+(x.n-1)+' is done'];
      parts.push('<div class="now'+(hero[0]?' '+hero[0]:'')+'" role="group" aria-label="'+esc(hero[2]+' · '+hero[3]+' · '+hero[4])+'">'+(hero[5]?'<span class="tag">'+hero[5]+'</span>':'')+'<span class="tile">'+ic(hero[1])+'</span><span class="tx"><span class="k">'+hero[2]+'</span><b>'+hero[3]+'</b><small>'+esc(hero[4])+'</small></span></div>');
    }else{
      parts.push('<div class="stg '+(state==='ok'?'ok':'todo')+'"><span class="o">'+(state==='ok'?sic('check',3.4):'')+'</span><span class="lb"><b>'+nm+'</b>'+(subs[i]?'<small>'+esc(subs[i])+'</small>':'')+'</span></div>');
    }
    if(i<3)parts.push('<span class="cn'+(k==='done'||i+1<=cur?' ok':' dot')+'" aria-hidden="true"></span>');
  });
  return '<section class="card trk" aria-label="Progress of this step"><div class="lc">'+parts.join('')+'</div></section>';
}
function fields(x){
  var c=X[x.n],k=ST(x.n);
  if(c){var f=c.f||c[AFTER_ON?'fA':'fB'];if(f)return f.map(function(r){return {l:r[0],v:r[1]};});}
  var it=(x.i&&x.i.length)?x.i:[[x.t,'']];
  return it.map(function(q){return {l:q[0],h:q[1],v:k==='done'?'✓':'—'};});
}
function kvRows(x){
  return fields(x).map(function(r){var v=r.v==='✓'?si('done')+'<span>Provided · '+fmt(DT(x.n))+'</span>':esc(r.v);
    return '<div class="kvr"><div class="k">'+esc(r.l)+(r.h?'<small>'+esc(r.h)+'</small>':'')+'</div><div class="v'+(r.v==='—'?' no':'')+'">'+v+'</div></div>';}).join('');
}
function formChips(x){var c=X[x.n],f=(c&&c.forms)||x.f||[];return f.length?'<span class="fchips">'+f.slice(0,3).map(function(n){return '<button type="button" class="fch" data-portal-f="'+esc(n)+'" aria-label="Open '+esc(n)+' on the official portal" data-tt="'+esc(n)+' · official portal" data-notip>'+esc(n)+ic('external-link')+'</button>';}).join('')+'</span>':'';}
function answersCard(x){
  var k=KD(x.n),c=X[x.n]||{};
  var title=(k==='done'||k==='you')?'Answers':'What this step captures';
  var h='<section class="card acc" aria-label="'+title+'"><div class="ch"><h2 class="lbl">'+title+'<button type="button" class="ibtn" data-info="answers" aria-expanded="false" aria-label="About this step" data-tt="About this step" data-notip>'+ic('info')+'</button></h2>'+formChips(x)+'</div>';
  if(c.tab&&(k==='done'||k==='you'))h+='<div class="tabs" role="tablist"><button type="button" class="tab" role="tab" aria-selected="true">'+esc(c.tab)+'</button></div>'+(c.pre?'<div class="pre">'+ic('refresh-cw')+esc(c.pre)+'</div>':'');
  if(k==='with'||k==='up'||k==='prog'){
    var msg,btn='',go='';
    if(k==='up'){var pv=STEPS[x.n-2];msg='This step opens after step '+(x.n-1)+' · '+esc(pv?pv.t:'')+'. Here is what it will ask for.';btn='Go to step '+(x.n-1);go='inc-step-'+(x.n-1);}
    else if(k==='with')msg=c.bubB&&!AFTER_ON?c.bubB:'Northwind’s team prepares this step. The result appears here when it is delivered.';
    else msg=c.bubB&&!AFTER_ON?c.bubB:'Northwind has started this step. The remaining answers are due by '+fmt(DT(x.n))+'.';
    h+='<div class="cbot">'+botSay(msg,btn,'',btn,go)+'</div>';
  }
  h+='<div class="kv">'+kvRows(x)+'</div>';
  if(k==='done')h+='<div class="cft"><span class="t">'+si('done')+(x.o==='You'?'Approved by Northwind':'Completed by Northwind’s team')+'</span><button type="button" class="btn" data-change="'+x.n+'">'+ic('message-square')+'Request a change</button></div>';
  else if(k==='with')h+='<div class="cft"><span class="t">'+si('with')+'Awaiting Northwind’s team</span><button type="button" class="btn" data-msg>'+ic('message-square')+'Message Arjun</button></div>';
  else if(k==='prog')h+='<div class="cft"><span class="t">'+si('prog')+'In progress · due '+fmt(DT(x.n))+'</span><button type="button" class="btn" data-draft>'+ic('pen-line')+'Save draft</button></div>';
  else if(k==='up')h+='<div class="cft"><span class="t">'+si('up')+'Opens later</span></div>';
  return h+'</section>';
}
function fileRow(d){
  return '<div class="file"><span class="ft '+d.t+'">'+d.t.toUpperCase()+'</span><span class="tx"><b>'+esc(d.n)+'</b><small>'+esc(d.f)+' · '+esc(d.m)+'</small></span><span class="acts"><span class="chip done">'+esc(d.s)+'</span><button type="button" class="sq" data-view="'+esc(d.n)+'" aria-label="Preview '+esc(d.n)+'">'+ic('eye')+'</button><button type="button" class="sq" data-dl="'+esc(d.f)+'" aria-label="Download '+esc(d.f)+'">'+ic('download')+'</button></span></div>';
}
function docsCard(x){
  var c=X[x.n]||{},h='';
  if(x.n===7){
    var nocDone=AFTER_ON||checks['7:noc'];
    h+='<div class="dreq">'+si(nocDone?'done':'you')+'No-objection certificate from the owner · requested by Arjun</div>';
    h+=nocDone?fileRow({t:'pdf',n:'NOC from property owner',f:'noc-plot42-owner.pdf',m:'188 KB · Northwind · '+(AFTER_ON?'8 Oct':'just now'),s:'Uploaded'}):
      '<div class="drop" data-drop="7"><button type="button" class="ut" data-upload="7" aria-label="Upload the NOC from the property owner">'+ic('upload')+'</button><span class="tx"><b>NOC from property owner<button type="button" class="ibtn" data-info="noc" aria-expanded="false" aria-label="About the NOC" data-tt="About the NOC" data-notip>'+ic('info')+'</button></b><span>Drop a file here or <button type="button" data-upload="7">browse</button></span></span><span class="chip you">Due 9 Oct</span></div>';
    h+='<div class="dreq">'+si('done')+'Copy of utility bill (not older than two months)</div>'+fileRow({t:'pdf',n:'Utility bill · September',f:'tsspdcl-sep-2026.pdf',m:'301 KB · Arjun · 5 Oct',s:'Uploaded'});
    var n2=nocDone?2:1;
    return '<section class="card acc" id="docs" aria-label="Documents"><div class="ch"><h2 class="lbl">Documents<button type="button" class="ibtn" data-info="docs" aria-expanded="false" aria-label="About these documents" data-tt="About these documents" data-notip>'+ic('info')+'</button></h2><span class="sp"></span><span class="chip '+(n2===2?'done':'you')+'">'+n2+' of 2</span></div>'+h+'</section>';
  }
  if(c.docs)return '<section class="card acc" id="docs" aria-label="Documents"><div class="ch"><h2 class="lbl">Documents</h2><span class="sp"></span><span class="cnt">'+c.docs.length+' file</span></div>'+c.docs.map(fileRow).join('')+'</section>';
  return '';
}
function timeline(x){
  var k=KD(x.n),c=X[x.n]||{},d=DT(x.n),ev=c[AFTER_ON?'tlA':'tlB']||c.tl,pv=STEPS[x.n-2];
  if(!ev){
    if(k==='done')ev=x.o==='You'?[['ok','Answers filled','Arjun Mehta',fmt(addD(d,-2))],['ok','Approved by Northwind’s manager','Priya Raman',fmt(addD(d,-1))],['ok','Approved by Northwind','Northwind',fmt(d)]]:[['ok','Started by Northwind’s team','Arjun Mehta',fmt(addD(d,-4))],['ok','Reviewed by Northwind’s manager','Priya Raman',fmt(addD(d,-1))],['ok','Completed','Arjun Mehta',fmt(d)]];
    else if(k==='you')ev=[['ok','Prepared by Northwind’s team','Arjun Mehta',fmt(addD(today(),-1))],['ok','Approved by Northwind’s manager','Priya Raman',fmt(today())],['you','Approve & submit','Northwind','due '+fmt(d)]];
    else if(k==='prog')ev=[['ok','Step opened','Arjun Mehta',fmt(since(x.n))],['prog','Fill and submit','Northwind','due '+fmt(d)],['up','Review by Northwind’s team','Arjun Mehta','after Northwind submits']];
    else if(k==='with')ev=[['ok','Started by Northwind’s team','Arjun Mehta',fmt(since(x.n))],['with','In progress','Arjun Mehta · Project Lead','now'],['up','Delivered to Northwind','Northwind approves or requests a change',fmt(d)]];
    else{var pk=pv?KD(pv.n):'up';ev=[[pk==='done'?'ok':pk,'Step '+(x.n-1)+' · '+(pv?KL[pk].toLowerCase():''),pv?pv.t:'',pk==='up'?'later':'now'],['up','Opens for Northwind’s team','Arjun Mehta','after step '+(x.n-1)],['up','Delivered to Northwind','Northwind approves','~'+fmt(d)]];}
  }
  return '<section class="card acc" aria-label="Timeline"><div class="ch"><h2 class="lbl">Timeline<button type="button" class="ibtn" data-info="timeline" aria-expanded="false" aria-label="About the timeline" data-tt="About the timeline" data-notip>'+ic('info')+'</button></h2></div><div class="tlst">'+
    ev.map(function(e){var g=e[0]==='ok'?'done':e[0];return '<div class="te'+(e[0]==='ok'?' ok':'')+'">'+si(g)+'<span style="min-width:0"><b>'+esc(e[1])+'</b><small>'+esc(e[2])+'</small></span><span class="dt">'+esc(e[3])+'</span></div>';}).join('')+'</div></section>';
}
function needItems(x){var k=KD(x.n),c=X[x.n]||{};if(k==='you')return c.need||[['chk','Check the answers',fmt(DT(x.n)),false],['ok','Approve & submit',fmt(DT(x.n)),false]];if(k==='prog')return c.need||[['fill','Fill the answers',fmt(DT(x.n)),false],['sub','Submit for review',fmt(DT(x.n)),false]];return null;}
function isOn(x,it){var key=x.n+':'+it[0];return (key in checks)?checks[key]:it[3];}
function needCard(x){
  var items=needItems(x);
  if(!items){
    return '<section class="card acc team" aria-label="Northwind’s team on this step"><div class="ch"><h2 class="lbl">Northwind’s team on this step</h2></div>'+
      '<div class="pr"><span class="av">AM</span><span><b>Arjun Mehta</b><small>Project Lead · '+(x.o==='You'?'reviews Northwind’s answers':'does this step')+'</small></span><button type="button" class="sq" data-msg aria-label="Message Arjun Mehta">'+ic('message-square')+'</button></div>'+
      '<div class="pr"><span class="av" style="background:#2f6fd0">PR</span><span><b>Priya Raman</b><small>Project Manager · approves</small></span><button type="button" class="sq" data-msg aria-label="Message Priya Raman">'+ic('message-square')+'</button></div></section>';
  }
  var left=items.filter(function(it){return !isOn(x,it);}).length;
  return '<section class="card acc need" aria-label="Needed from Northwind"><div class="ch"><h2 class="lbl">Needed from Northwind</h2><span class="sp"></span><span class="chip '+(left?'you':'done')+'" id="needN">'+(left?left+' left':'All done')+'</span></div>'+
    items.map(function(it){return '<label class="nr"><input type="checkbox" data-need="'+x.n+':'+it[0]+'"'+(isOn(x,it)?' checked':'')+'><span>'+esc(it[1])+'</span><span class="dt">'+esc(it[2])+'</span></label>';}).join('')+'</section>';
}
function banner(x){
  var k=KD(x.n),c=X[x.n]||{};
  if(k==='you')return '<div class="ban">'+bmini()+'<span><b>'+esc(c.banner||'Northwind’s team filled this step. Check it, then approve & submit.')+'</b><span>'+esc(c.bsub||'Prepared by Arjun Mehta; approved by Priya Raman.')+'</span></span></div>';
  if(k==='done')return '<div class="ban ok">'+si('done')+'<span><b>'+(x.o==='You'?'Approved by Northwind':'Completed by Northwind’s team')+'</b><span>'+(x.o==='You'?'Accepted after submission on ':'Finished on ')+fmt(DT(x.n))+'.</span></span></div>';
  return '';
}
function actBar(x){
  if(KD(x.n)!=='you')return '';
  var items=needItems(x),done=items.filter(function(it){return isOn(x,it);}).length,pct=Math.round(done/items.length*100);
  return '<div class="act" role="region" aria-label="Approval"><div class="in"><div class="st">'+si('you')+'<span style="min-width:0;flex:1"><b>Awaiting Northwind’s approval</b><span class="tr"><i style="width:'+Math.max(pct,6)+'%"></i></span></span></div><div class="bs"><button type="button" class="btn" data-change="'+x.n+'">'+ic('message-square')+'Request a change</button><button type="button" class="btn p" data-approve="'+x.n+'">'+ic('check')+'Approve & submit</button></div></div></div>';
}
function renderStep(){
  var n=curN(),x=STEPS[n-1],k=KD(n),pi=steps(x.p),pos1=pi.indexOf(x)+1,pv=STEPS[n-2],nx=STEPS[n];
  document.title='Step '+n+' · '+x.t+' · Incorporation · VCFO Suite';
  var cb=document.getElementById('crB');if(cb)cb.textContent=x.t;
  var meta=k==='done'?x.o+' · done '+fmt(DT(n)):k==='with'?'Project Lead · with SBC since '+fmt(since(n))+' · due '+fmt(DT(n)):k==='up'?x.o+' · '+esc(x.tl)+' · opens after step '+(n-1):x.o+' · '+esc(x.tl)+' · due '+fmt(DT(n))+' · reviewer Arjun Mehta';
  var h='<div class="wrap"><section class="hero" aria-label="Step '+n+' · '+esc(x.t)+'"><div class="hrow">'+
    '<div class="hl"><button type="button" class="hback" data-go="'+PH_KEY[x.p-1]+'" aria-label="Back to Phase '+x.p+' · '+PH[x.p-1]+'">'+ic('chevron-left')+'</button>'+
    '<div class="htx"><div class="eb">Phase '+x.p+' · '+PH[x.p-1]+' · step '+pos1+' of '+pi.length+'</div><div class="ht"><h1>'+esc(x.t)+'</h1><button type="button" class="wt" data-ask="'+n+'" aria-label="What’s this? '+esc(x.t)+'" data-tt="What’s this? · ask VCFO" data-notip>'+bmini()+'What’s this?</button></div><div class="hm">'+meta+'</div></div></div>'+
    '<div class="hr"><div class="hnav">'+(pv?'<a href="#" class="wbtn" data-go="inc-step-'+(n-1)+'" aria-label="Previous step · '+(n-1)+' · '+esc(pv.t)+'">'+ic('chevron-left')+'<span>'+(n-1)+' · '+esc(pv.t)+'</span></a>':'')+(nx?'<a href="#" class="wbtn" data-go="inc-step-'+(n+1)+'" aria-label="Next step · '+(n+1)+' · '+esc(nx.t)+'"><span>'+(n+1)+' · '+esc(nx.t)+'</span>'+ic('chevron-right')+'</a>':'')+'</div>'+si(k,tipTxt(n),'xl')+'</div>'+
  '</div></section>';
  h+=stages(x)+banner(x);
  h+='<div class="sgrid"><div class="scol">'+answersCard(x)+docsCard(x)+timeline(x)+'</div><div class="scol side2">'+rail(x.p,n,true)+needCard(x)+'</div></div>';
  h+='<nav class="pn" aria-label="Steps">'+(pv?'<button type="button" class="btn" data-go="inc-step-'+(n-1)+'">'+ic('arrow-left')+'<span>'+(n-1)+' · '+esc(pv.t)+'</span></button>':'<button type="button" class="btn" data-go="incorporation">'+ic('arrow-left')+'<span>All phases</span></button>')+(nx?'<button type="button" class="btn" data-go="inc-step-'+(n+1)+'"><span>'+(n+1)+' · '+esc(nx.t)+'</span>'+ic('arrow-right')+'</button>':'<button type="button" class="btn" data-go="incorporation"><span>All phases</span>'+ic('arrow-right')+'</button>')+'</nav>';
  h+=actBar(x)+'</div>';
  main.innerHTML=h;
  document.body.classList.toggle('has-act',k==='you');
  actH();
}
function actH(){var a=main.querySelector('.act');if(a)document.documentElement.style.setProperty('--acth',a.offsetHeight+'px');}

/* ---------- phase page ---------- */
function curP(){var m=(location.hash||'').match(/p=(\d)/),p=m?+m[1]:curPhase();return (p>=1&&p<=4)?p:curPhase();}
function renderPhase(){
  var p=curP(),l=steps(p),d=doneN(l),t=l.length,ps=phState(p),pl=phPlan(p),pct=Math.round(d/t*100),endD=ps==='done'?phEnd(p):pl[1];
  document.title='Phase '+p+' · '+PH[p-1]+' · Incorporation · VCFO Suite';
  var cb=document.getElementById('crB');if(cb)cb.textContent='Phase '+p+' · '+PH[p-1];
  var focus=(l.filter(function(x){return KD(x.n)==='you';})[0]||l.filter(function(x){return ST(x.n)!=='done';})[0]||l[l.length-1]).n,cur=STEPS[focus-1];
  var h='<div class="wrap"><section class="hero" aria-label="Phase '+p+' · '+PH[p-1]+'"><div class="hrow">'+
    '<div class="hl"><button type="button" class="hback" data-go="incorporation" aria-label="Back to Incorporation">'+ic('chevron-left')+'</button>'+
    '<div class="htx"><div class="eb">Incorporation · phase '+p+' of 4</div><div class="ht"><h1>'+PH[p-1]+'</h1><button type="button" class="wt" data-chatq="What’s this: Phase '+p+' · '+PH[p-1]+'?" aria-label="What’s this? Phase '+p+' · '+PH[p-1]+'" data-tt="What’s this? · ask VCFO" data-notip>'+bmini()+'What’s this?</button></div>'+
    '<div class="hm">'+d+'/'+t+' · '+fmt(pl[0])+' → '+fmt(endD)+' · '+(ps==='done'?'finished ':'ends ')+fmtY(endD)+'</div></div></div>'+
    '<div class="hr"><div class="hnav">'+(p>1?'<a href="#" class="wbtn" data-go="'+PH_KEY[p-2]+'" aria-label="Previous phase · '+PH[p-2]+'">'+ic('chevron-left')+'<span>Phase '+(p-1)+' · '+PH[p-2]+'</span></a>':'')+(p<4?'<a href="#" class="wbtn" data-go="'+PH_KEY[p]+'" aria-label="Next phase · '+PH[p]+'"><span>Phase '+(p+1)+' · '+PH[p]+'</span>'+ic('chevron-right')+'</a>':'')+'</div>'+
    '<button type="button" class="ring" data-bar="'+p+'" aria-label="Phase '+p+' · '+pct+'% · '+d+' of '+t+' steps done" data-tt="Phase '+p+' · '+d+' of '+t+' steps done" data-notip><span class="rw">'+ringSvg(pct,ps==='done'?'#2fd3a0':'#e6c46e')+'<span class="pc">'+pct+'%</span></span><small>Phase '+p+'</small></button></div>'+
  '</div></section>';
  h+='<section class="card acc psum" aria-label="Phase progress"><div class="ch" style="padding:0"><h2 class="lbl">Progress<button type="button" class="ibtn" data-info="phase" aria-expanded="false" aria-label="About this phase" data-tt="About this phase" data-notip>'+ic('info')+'</button></h2><span class="sp"></span><span class="cnt">'+d+' of '+t+' steps</span></div>'+
    '<div class="bw">'+phBar(p,true)+'<span class="glab">'+phLabel(p)+'</span></div>'+
    '<div class="kd"><span>Starts <b>'+fmt(pl[0])+'</b></span><span>'+(ps==='done'?'Finished':'Ends')+' <b>'+fmt(endD)+'</b></span>'+(ps!=='done'?'<span>Now <a href="#" data-go="inc-step-'+cur.n+'">Step '+cur.n+' · '+esc(cur.t)+'</a></span>':'')+(p===2?'<span>COI <b>'+fmt(coiDate())+(AFTER_ON?'':' (expected)')+'</b></span>':'')+'<span>Reviewer <b>Arjun Mehta</b></span></div></section>';
  var you=l.filter(function(x){return x.o==='You';}),sbc=l.filter(function(x){return x.o!=='You';}),O=[['Northwind',you,'#c9a24b'],['SBC',sbc,'#2f6fd0']];
  var wh='<section class="card acc team" aria-label="Who’s doing it"><div class="ch"><h2 class="lbl">Who’s doing it</h2></div><div class="obar" role="group" aria-label="Owners in Phase '+p+'">'+
    O.filter(function(o){return o[1].length;}).map(function(o){return '<button type="button" style="flex:'+o[1].length+';background:'+o[2]+'" data-owner="'+o[0]+'" aria-label="'+o[0]+' · '+o[1].length+' steps" data-tt="'+o[0]+' · '+o[1].length+' of '+t+' steps" data-notip></button>';}).join('')+'</div>'+
    '<div class="lgd">'+O.map(function(o){return '<button type="button" class="lg" data-owner="'+o[0]+'" aria-label="Steps owned by '+o[0]+' · '+o[1].length+'"><i style="background:'+o[2]+'"></i><span>'+o[0]+'</span><b>'+o[1].length+'</b></button>';}).join('')+'</div></section>';
  h+='<div class="sgrid"><div class="scol"><section class="card acc" aria-label="Steps"><div class="ch"><h2 class="lbl">Steps</h2><span class="sp"></span><span class="cnt">'+t+' steps</span></div><div style="padding:0 8px 8px">'+stepTable(p,focus)+'</div></section></div><div class="scol side2">'+rail(p,focus,false)+wh+'</div></div>';
  h+='<nav class="pn" aria-label="Phases">'+(p>1?'<button type="button" class="btn" data-go="'+PH_KEY[p-2]+'">'+ic('arrow-left')+'<span>Phase '+(p-1)+'</span></button>':'<button type="button" class="btn" data-go="incorporation">'+ic('arrow-left')+'<span>All phases</span></button>')+(p<4?'<button type="button" class="btn" data-go="'+PH_KEY[p]+'"><span>Phase '+(p+1)+'</span>'+ic('arrow-right')+'</button>':'<button type="button" class="btn" data-go="incorporation"><span>All phases</span>'+ic('arrow-right')+'</button>')+'</nav></div>';
  main.innerHTML=h;
}

/* ---------- board resolution ---------- */
function renderBoard(){
  document.title='Board resolution · Incorporation · VCFO Suite';
  var stg=[['Drafted','SBC · 26 Sep'],['Released','28 Sep'],['Signed','Northwind · 30 Sep']],parts=[];
  stg.forEach(function(s){parts.push('<div class="stg ok"><span class="o">'+sic('check',3.4)+'</span><span class="lb"><b>'+s[0]+'</b><small>'+s[1]+'</small></span></div>','<span class="cn ok" aria-hidden="true"></span>');});
  parts.push('<div class="now ok" role="group" aria-label="Received by SBC · Arjun · 30 Sep"><span class="tile">'+ic('check')+'</span><span class="tx"><span class="k">Received</span><b>Received by SBC</b><small>Arjun · 30 Sep</small></span></div>');
  var ln=function(w){return '<div class="ln" style="width:'+w+'%"></div>';};
  var h='<div class="wrap"><section class="hero" aria-label="Board resolution"><div class="hrow">'+
    '<div class="hl"><button type="button" class="hback" data-go="inc-phase-a" aria-label="Back to Phase 1 · Name Application">'+ic('chevron-left')+'</button>'+
    '<div class="htx"><div class="eb">Phase 1 · Name Application · steps 2–3</div><div class="ht"><h1>Board resolution</h1><button type="button" class="wt" data-chatq="What’s this: Board resolution?" aria-label="What’s this? Board resolution" data-tt="What’s this? · ask VCFO" data-notip>'+bmini()+'What’s this?</button></div>'+
    '<div class="hm" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px"><span class="chip done">Signed copy received · 30 Sep</span><span class="chip" style="background:rgba(255,255,255,.16);color:#fff">Certified true copy</span></div></div></div>'+
    '<div class="hr"><div class="hnav"><a href="#" class="wbtn" data-go="inc-step-2" aria-label="Step 2 · Draft Board Resolution"><span>2 · Draft Board Resolution</span>'+ic('chevron-right')+'</a><a href="#" class="wbtn" data-go="inc-step-3" aria-label="Step 3 · Signed Board Resolution"><span>3 · Signed Board Resolution</span>'+ic('chevron-right')+'</a></div>'+si('done','Done · received 30 Sep','xl')+'</div>'+
  '</div></section>';
  h+='<section class="card trk" aria-label="Progress of the board resolution"><div class="lc">'+parts.join('')+'</div></section>';
  h+='<div class="brg"><section class="card prv" aria-label="Preview"><div class="ch"><h2 class="lbl">Preview</h2><span class="cnt">page 1 of 2 · <span id="zv">'+Math.round(zoom*100)+'%</span></span><span class="sp"></span>'+
    '<button type="button" class="sq" data-zoom="-1" aria-label="Zoom out">'+ic('minus')+'</button><button type="button" class="sq" data-zoom="1" aria-label="Zoom in">'+ic('plus')+'</button><button type="button" class="sq" data-full aria-label="Open full screen">'+ic('maximize')+'</button></div>'+
    '<div class="pvw"><div class="paper" id="paper" style="transform:scale('+zoom+')"><div class="t">CERTIFIED TRUE COPY OF THE RESOLUTION PASSED BY THE BOARD OF DIRECTORS OF NORTHWIND INC. ON 24 SEPTEMBER 2026</div>'+ln(90)+ln(100)+ln(80)+'<h4>RESOLVED THAT</h4>'+ln(100)+ln(85)+ln(100)+ln(60)+'<h4>RESOLVED FURTHER THAT</h4>'+ln(100)+ln(75)+ln(100)+ln(50)+
    '<div class="sig"><div><div class="sg">J. Carter</div><div class="sgl">Director, Northwind Inc.</div></div><div class="stamp">NORTHWIND<br>INC.</div></div></div></div></section>';
  h+='<div class="scol"><section class="card acc files" aria-label="Files"><div class="ch"><h2 class="lbl">Files</h2><span class="sp"></span><span class="cnt">2 files</span></div>'+
    fileRow({t:'docx',n:'Draft · Word',f:'board-resolution.docx',m:'SBC · 26 Sep',s:'Released'})+fileRow({t:'pdf',n:'Signed copy',f:'br-signed-northwind.pdf',m:'Northwind · 30 Sep',s:'Received'})+
    '<div class="drop blue"><button type="button" class="ut" data-upload="br" aria-label="Replace the signed copy">'+ic('refresh-cw')+'</button><span class="tx"><b>Replace signed copy</b><span>Drop a PDF or <button type="button" data-upload="br">browse</button></span></span><span class="mono">PDF · DOCX</span></div></section>'+
    '<section class="card acc team" aria-label="What happens with it"><div class="ch"><h2 class="lbl">What happens with it</h2></div>'+botSay('Northwind’s parent board authorised the India subsidiary. SBC drafted it, J. Carter signed it, and it went with the name application in step 4.','Open step 3','','Open step 3 · Signed Board Resolution','inc-step-3')+'</section></div></div></div>';
  main.innerHTML=h;
}

/* ---------- status brief drawer ---------- */
function briefBody(){
  var s=spice();
  var h=AFTER_ON?'<p class="hl">Incorporated on <b>'+fmtY(DT(14))+'</b>. SPICe+ is <b>100%</b> done. Post-incorporation and Registration are under way.</p>'
    :'<p class="hl"><b>'+days(TODAY_B,WIN_END)+' days</b> to the expected COI ('+wd(WIN_END)+' '+fmt(WIN_END)+'). SPICe+ is <b>'+s.pct+'%</b> done: '+s.d+' of '+s.t+' steps.</p>';
  h+='<div class="sub-h">Phases</div>';
  for(var p=1;p<=4;p++){var l=steps(p),d=doneN(l),ps=phState(p);
    h+='<a href="#" class="bp" data-go="'+PH_KEY[p-1]+'" aria-label="Open Phase '+p+' · '+PH[p-1]+'">'+si(phKind(p))+'<span>Phase '+p+' · '+PH[p-1]+'<small>'+d+' of '+l.length+' · '+(ps==='done'?'done ':'ends ')+fmt(ps==='done'?phEnd(p):phPlan(p)[1])+'</small><span class="mini"><i style="width:'+Math.round(d/l.length*100)+'%"></i></span></span><span class="chip '+phKind(p)+'">'+(ps==='done'?'Done':ps==='up'?'Upcoming':'In progress')+'</span></a>';}
  var you=STEPS.filter(function(x){return KD(x.n)==='you';}),act=STEPS.filter(function(x){var k=KD(x.n);return k==='prog'||k==='with';});
  var row=function(x){return '<a href="#" class="bp" data-go="inc-step-'+x.n+'" aria-label="Open step '+x.n+' · '+esc(x.t)+'">'+si(KD(x.n))+'<span>'+x.n+' · '+esc(x.t)+'<small>'+dateCell(x.n)+'</small></span><span class="own '+x.o+'">'+x.o+'</span></a>';};
  h+='<div class="sub-h">Waiting on Northwind</div>'+(you.length?you.map(row).join(''):botSay('Nothing is waiting on Northwind.'));
  h+='<div class="sub-h">In progress</div>'+act.map(row).join('');
  return h;
}
function openBrief(btn){
  lastFocus=btn||document.activeElement;closeInfo();
  var sc=document.getElementById('ip-brief-scrim');if(sc)sc.remove();
  sc=document.createElement('div');sc.id='ip-brief-scrim';
  sc.innerHTML='<aside id="ip-brief" role="dialog" aria-modal="true" aria-labelledby="ip-brief-t"><div class="bh"><span class="si prog">'+GLY.prog+'</span><div style="flex:1;min-width:0"><b id="ip-brief-t">Monthly status brief</b><small>Northwind Technologies India Pvt Ltd · as of '+fmtY(today())+'</small></div><button type="button" class="sq" data-brief-close aria-label="Close status brief">'+ic('x')+'</button></div>'+
    '<div class="bb">'+briefBody()+'</div><div class="bf"><button type="button" class="btn" data-copy>'+ic('copy')+'Copy brief</button><button type="button" class="btn p" data-pdf>'+ic('download')+'Download PDF</button></div></aside>';
  document.body.appendChild(sc);briefOpen=true;
  if(btn)btn.setAttribute('aria-expanded','true');
  requestAnimationFrame(function(){sc.classList.add('on');});
  setTimeout(function(){var x=sc.querySelector('[data-brief-close]');x&&x.focus({preventScroll:true});},40);
}
function closeBrief(){
  var sc=document.getElementById('ip-brief-scrim');if(!sc)return;briefOpen=false;sc.classList.remove('on');
  setTimeout(function(){sc.remove();},reduce?0:180);
  var b=document.querySelector('[data-brief]');if(b)b.setAttribute('aria-expanded','false');
  if(lastFocus&&lastFocus.focus)lastFocus.focus({preventScroll:true});
}
function briefText(){var t=['Incorporation status brief · Northwind Technologies India Pvt Ltd'];for(var p=1;p<=4;p++){var l=steps(p);t.push('Phase '+p+' · '+PH[p-1]+': '+doneN(l)+' of '+l.length+' done');}return t.join('\n');}

/* ---------- info pop-over (rule 7) ---------- */
var INFO={coi:['Days to COI','Counts down to the end of the incorporation window Northwind’s manager set (Wed 28 Oct 2026). After the Certificate of Incorporation it shows the real incorporation date.'],
  phases:['The timeline','Each bar is the planned window of a phase. The fill is the share of steps done; red is time past the plan. The red line is today; the gold diamond is the COI.'],
  docs:['Documents','Files this step needs. SBC checks each one before it goes into the MCA filing.'],
  noc:['NOC from the owner','A no-objection certificate signed by the owner of the premises, needed when the company does not own the registered office.'],
  timeline:['Timeline','Everything that happened on this step, oldest first, with who did it.']};
function openInfo(btn){
  if(pop&&popBtn===btn){closeInfo();return;}closeInfo();
  var key=btn.getAttribute('data-info'),it=INFO[key]||['',''],title=it[0],txt=it[1];
  if(key==='answers'){var x=STEPS[curN()-1];title=x.t;txt=x.d||'';}
  if(key==='phase'){var p=curP();title='Phase '+p+' · '+PH[p-1];txt=PH_INFO[p-1];}
  pop=document.createElement('div');pop.className='ip-pop';pop.setAttribute('role','dialog');pop.setAttribute('aria-label','About '+title);
  pop.innerHTML='<p>'+esc(txt)+'</p><button type="button" data-chatq="What’s this: '+esc(title)+'?" aria-label="Ask VCFO: what’s this? '+esc(title)+'">'+bmini()+'Ask VCFO about this</button>';
  document.body.appendChild(pop);popBtn=btn;btn.setAttribute('aria-expanded','true');
  var r=btn.getBoundingClientRect(),w=pop.offsetWidth;pop.style.left=(Math.max(12,Math.min(innerWidth-w-12,r.left-8))+scrollX)+'px';pop.style.top=(r.bottom+scrollY+8)+'px';
}
function closeInfo(){if(pop){pop.remove();pop=null;}if(popBtn){popBtn.setAttribute('aria-expanded','false');popBtn=null;}}

/* ---------- tooltips (rules 14 + 17) ---------- */
var tt=null,ttT=0,lpT=0;
function tipEl(){if(!tt){tt=document.createElement('div');tt.id='ip-tt';tt.setAttribute('role','tooltip');document.body.appendChild(tt);}return tt;}
function showTip(el,x,y){
  var t=el.getAttribute('data-tt');if(!t)return;var d=tipEl();d.textContent=t;
  var r=el.getBoundingClientRect(),svg=(el instanceof SVGElement)&&x!=null,cx=svg?x:r.left+r.width/2,top=svg?y-10:r.top,w=d.offsetWidth,hgt=d.offsetHeight;
  d.style.left=Math.max(8,Math.min(innerWidth-w-8,cx-w/2))+'px';
  var ty=top-hgt-8;d.style.top=(ty<4?(svg?y+18:r.bottom+8):ty)+'px';
  clearTimeout(ttT);ttT=setTimeout(function(){d.classList.add('on');},100);
}
function hideTip(){if(tt){clearTimeout(ttT);tt.classList.remove('on');}}
document.addEventListener('mouseover',function(e){var el=e.target.closest&&e.target.closest('[data-tt]');if(el)showTip(el,e.clientX,e.clientY);else hideTip();});
document.addEventListener('focusin',function(e){var el=e.target.closest&&e.target.closest('[data-tt]');var fv=true;try{fv=e.target.matches(':focus-visible');}catch(x){}if(el&&fv)showTip(el);});
document.addEventListener('focusout',hideTip);
document.addEventListener('scroll',hideTip,true);
document.addEventListener('pointerdown',function(e){
  hideTip();clearTimeout(lpT);if(e.pointerType!=='touch')return;
  var el=e.target.closest&&e.target.closest('[data-tt]');if(!el)return;
  lpT=setTimeout(function(){showTip(el,e.clientX,e.clientY);setTimeout(hideTip,1800);},450);
},true);
['pointerup','pointercancel'].forEach(function(n){document.addEventListener(n,function(){clearTimeout(lpT);},true);});

/* ---------- interactions ---------- */
function togglePh(p){openPh=openPh===p?null:p;var c=document.getElementById('phc');if(!c)return;
  [].forEach.call(c.querySelectorAll('.phr'),function(r){var q=+r.getAttribute('data-p'),o=openPh===q;r.classList.toggle('open',o);var b=r.querySelector('[data-toggle]');
    b.setAttribute('aria-expanded',String(o));b.setAttribute('aria-label',stbLabel(q,o));
    r.querySelector('.phb').innerHTML=o?stepTable(q):'';});}
function drillPhase(p){var l=steps(p),tabs=tabsFor(l),c=cnt(l),act=c.you?'you':c.with?'with':c.prog?'prog':c.done===l.length?'done':'up';
  var cfg={title:PHL[p-1],sub:doneN(l)+' of '+l.length+' steps done',tabs:tabs,active:idx(tabs,act)};
  if(PAGE!=='phase')cfg.link={lead:'Every step of this phase',text:'Open the phase page →',go:PH_KEY[p-1],where:'the phase page'};drill(cfg);}
function drillRing(){var sp=STEPS.filter(function(x){return x.p<=2;}),tabs=tabsFor(sp);drill({title:'SPICe+ progress',sub:'Phases 1 and 2 · '+doneN(sp)+' of '+sp.length+' steps done',tabs:tabs,active:idx(tabs,'you'),link:{lead:'SPICe+ ends with the Certificate of Incorporation',text:'Open Phase 2 →',go:'inc-phase',where:'the phase pages'}});}
function drillAll(){var tabs=tabsFor(STEPS);drill({title:'All 48 steps',sub:doneN(STEPS)+' done · '+(48-doneN(STEPS))+' to go',tabs:tabs,active:idx(tabs,AFTER_ON?'with':'you')});}
function drillOwner(o){var p=curP(),l=steps(p),tabs=['You','SBC'].map(function(k){return {k:k,label:(k==='You'?'Northwind':k),color:k==='You'?'#c9a24b':'#2f6fd0',rows:l.filter(function(x){return x.o===k;}).map(stRow)};}).filter(function(t){return t.rows.length;});
  drill({title:'Who’s doing it · Phase '+p,sub:PH[p-1]+' · '+l.length+' steps',tabs:tabs,active:idx(tabs,o)});}
function setNeed(key,on){
  checks[key]=on;
  if(key==='7:noc'){render();if(on)toast('NOC marked as uploaded',true);return;}
  var items=main.querySelectorAll('[data-need]'),left=[].filter.call(items,function(i){return !i.checked;}).length,c=document.getElementById('needN');
  if(c){c.className='chip '+(left?'you':'done');c.textContent=left?left+' left':'All done';}
  var bar=main.querySelector('.act .tr i');if(bar)bar.style.width=Math.max(6,Math.round((items.length-left)/items.length*100))+'%';
}
document.addEventListener('click',function(e){
  var t=e.target;if(!t||!t.closest)return;
  if(t.closest('#vp-bar,#vp-chat,#vp-launch,#vp-drill-scrim,.vps,#vp-drawer,#vp-toast'))return;
  var el;
  if(pop&&!t.closest('.ip-pop')&&!t.closest('[data-info]'))closeInfo();
  if((el=t.closest('#ip-brief-scrim'))&&t===el){e.preventDefault();closeBrief();return;}
  if(t.closest('[data-go]')){closeInfo();if(briefOpen)closeBrief();return;}   /* proto.js routes data-go */
  if((el=t.closest('[data-toggle]'))){e.preventDefault();togglePh(+el.getAttribute('data-toggle'));return;}
  if((el=t.closest('[data-ask]'))){e.preventDefault();touch(el);chat(whats(STEPS[+el.getAttribute('data-ask')-1]));return;}
  if((el=t.closest('[data-chatq]'))){e.preventDefault();touch(el);closeInfo();if(briefOpen)closeBrief();chat(el.getAttribute('data-chatq'));return;}
  if((el=t.closest('[data-bar]'))){e.preventDefault();touch(el);drillPhase(+el.getAttribute('data-bar'));return;}
  if((el=t.closest('[data-ring]'))){e.preventDefault();touch(el);drillRing();return;}
  if((el=t.closest('[data-coi]'))){e.preventDefault();touch(el);drillRing();return;}
  if((el=t.closest('[data-allsteps]'))){e.preventDefault();touch(el);drillAll();return;}
  if((el=t.closest('.today'))){e.preventDefault();touch(el);toast('Today · '+wd(today())+' '+fmtY(today()));return;}
  if((el=t.closest('[data-seg]'))){e.preventDefault();touch(el);drillSeg(el.getAttribute('data-seg'));return;}
  if((el=t.closest('[data-owner]'))){e.preventDefault();touch(el);drillOwner(el.getAttribute('data-owner'));return;}
  if((el=t.closest('[data-railall]'))){e.preventDefault();railAll=!railAll;render();return;}
  if((el=t.closest('[data-portal]'))){e.preventDefault();touch(el);toast('Opens '+STEPS[+el.getAttribute('data-portal')-1].f[0]+' on the official portal in a new tab');return;}
  if((el=t.closest('[data-portal-f]'))){e.preventDefault();touch(el);toast('Opens '+el.getAttribute('data-portal-f')+' on the official portal in a new tab');return;}
  if((el=t.closest('[data-upload]'))){e.preventDefault();touch(el);
    if(el.getAttribute('data-upload')==='7'){checks['7:noc']=true;render();toast('NOC from property owner uploaded · Arjun will check it',true);}else toast('Choose a PDF to replace the signed copy');return;}
  if((el=t.closest('[data-view]'))){e.preventDefault();touch(el);toast('Preview · '+el.getAttribute('data-view'));return;}
  if((el=t.closest('[data-dl]'))){e.preventDefault();touch(el);toast('Download started · '+el.getAttribute('data-dl'));return;}
  if((el=t.closest('[data-change]'))){e.preventDefault();touch(el);var cn=+el.getAttribute('data-change');chat('I want to request a change to step '+cn+' · '+STEPS[cn-1].t);return;}
  if((el=t.closest('[data-approve]'))){e.preventDefault();touch(el);var an=+el.getAttribute('data-approve');
    if(an===7&&!checks['7:noc']){toast('Upload the NOC first · it is still needed from Northwind');return;}
    el.innerHTML=ic('check')+'Submitted';el.disabled=true;toast('Approved & submitted · Arjun Mehta files it next',true);return;}
  if((el=t.closest('[data-msg]'))){e.preventDefault();touch(el);chat('Message for Arjun Mehta about step '+curN()+' · '+STEPS[curN()-1].t);return;}
  if((el=t.closest('[data-draft]'))){e.preventDefault();touch(el);toast('Draft saved',true);return;}
  if((el=t.closest('[data-zoom]'))){e.preventDefault();zoom=Math.max(.6,Math.min(1.6,Math.round((zoom+(+el.getAttribute('data-zoom'))*.1)*10)/10));var pp=document.getElementById('paper');if(pp)pp.style.transform='scale('+zoom+')';var zv=document.getElementById('zv');if(zv)zv.textContent=Math.round(zoom*100)+'%';touch(el);return;}
  if((el=t.closest('[data-full]'))){e.preventDefault();touch(el);toast('Full screen · opens the document viewer in the full app');return;}
  if((el=t.closest('[data-brief]'))){e.preventDefault();openBrief(el);return;}
  if((el=t.closest('[data-brief-close]'))){e.preventDefault();closeBrief();return;}
  if((el=t.closest('[data-copy]'))){e.preventDefault();touch(el);try{var pr=navigator.clipboard&&navigator.clipboard.writeText(briefText());if(pr&&pr.catch)pr.catch(function(){});}catch(err){}toast('Status brief copied',false);return;}
  if((el=t.closest('[data-pdf]'))){e.preventDefault();touch(el);toast('Download started · status-brief-'+(AFTER_ON?'nov':'oct')+'-2026.pdf');return;}
  if((el=t.closest('[data-info]'))){e.preventDefault();openInfo(el);return;}
  if((el=t.closest('.tab'))){e.preventDefault();touch(el);toast('Already showing '+el.textContent);return;}
},true);
document.addEventListener('change',function(e){var el=e.target;if(el&&el.matches&&el.matches('[data-need]'))setNeed(el.getAttribute('data-need'),el.checked);});
document.addEventListener('keydown',function(e){if(e.key!=='Escape')return;if(pop){closeInfo();return;}if(briefOpen){e.stopPropagation();closeBrief();}},true);
var rzT=0;addEventListener('resize',function(){closeInfo();clearTimeout(rzT);rzT=setTimeout(function(){layoutGantt();actH();},80);});

function render(){closeInfo();hideTip();shownKey=viewKey();
  if(PAGE==='phase')renderPhase();else if(PAGE==='step')renderStep();else if(PAGE==='board')renderBoard();else renderLanding();
  if(briefOpen){var b=document.querySelector('#ip-brief .bb');if(b)b.innerHTML=briefBody();}
  firstPaint=false;}
function rerender(v){var nv=(v===undefined)?readAfter():!!v;if(nv===AFTER_ON)return;AFTER_ON=nv;render();}
/* What's this? answers for the Ask VCFO drawer: window.vcfoWhatsThis('What’s this: <step title>?') -> {title,text,why,source,go} or null */
window.vcfoWhatsThis=function(q){
  var m=String(q||'').match(/^What[’']s this:\s*(.+?)\?$/i);if(!m)return null;var t=m[1].toLowerCase(),x=null;
  STEPS.forEach(function(s){if(s.t.toLowerCase()===t)x=s;});
  var pm=t.match(/^phase\s*(\d)/),pi=pm?+pm[1]:0;
  if(!x&&!pi)PH.forEach(function(n,i){if(n.toLowerCase()===t&&i!==1)pi=i+1;});
  if(!x&&pi>=1&&pi<=4){var pl=steps(pi);return {title:'Phase '+pi+' · '+PH[pi-1],text:PH_INFO[pi-1],why:PH_WHY[pi-1],source:PH_SRC[pi-1]+' · VCFO Suite checklist, steps '+pl[0].n+'–'+pl[pl.length-1].n,go:PH_KEY[pi-1]};}
  if(!x){var ik=null;Object.keys(INFO).forEach(function(k){if(INFO[k][0].toLowerCase()===t)ik=k;});
    if(ik)return {title:INFO[ik][0],text:INFO[ik][1],why:INFO_WHY[ik],source:'VCFO Suite · Northwind’s incorporation project',go:ik==='docs'||ik==='noc'||ik==='timeline'?'inc-step-'+curN():'incorporation'};}
  if(!x)return /board resolution/.test(t)?{title:'Board resolution',text:'Northwind’s parent board authorises the India subsidiary. SBC drafts it, a director signs it, and Northwind uploads the signed copy.',why:'The name application in step 4 cannot be filed without it.',source:'Companies Act 2013 · SPICe+ Part A',go:'board-resolution'}:null;
  return {title:x.t,text:x.d,why:x.o==='You'?'Northwind owns this step: Northwind’s answers and documents go into the '+(x.f[0]||'filing')+'.':'SBC does this step for you; you see the result and approve it.',source:(x.f.length?x.f.join(', ')+' · ':'')+'VCFO Suite checklist, step '+x.n,go:'inc-step-'+x.n};
};
window.__incRerender=rerender;
document.addEventListener('vcfo-after',function(e){rerender(e.detail);});
addEventListener('storage',function(e){if(e.key==='vcfo.after')rerender();});
var shownKey=null;function viewKey(){return PAGE==='phase'?'p'+curP():PAGE==='step'?'n'+curN():PAGE;}
if(PAGE==='phase'||PAGE==='step')addEventListener('hashchange',function(){if(viewKey()===shownKey)return;railAll=false;render();window.scrollTo(0,0);});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){layoutGantt();});
render();
})();
```

### 5.3 Step page additions — `final-src/s/inc/step.html` (verbatim; the FINAL step layout)

```js
var MONL=['January','February','March','April','May','June','July','August','September','October','November','December'];
function fmtL(s){var d=pd(s);return d.getUTCDate()+' '+MONL[d.getUTCMonth()]+' '+d.getUTCFullYear();}
function fmtS(s){var d=pd(s),m=MON[d.getUTCMonth()];return d.getUTCDate()+' '+(m==='Sep'?'Sept':m)+' '+d.getUTCFullYear();}
IC.more='<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>';
IC.user='<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>';
IC.lock='<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>';
var PHN=['SPICe+ Part A','SPICe+ Part B','Post-incorporation','Registration'];
IC['circle-check']='<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>';
/* breadcrumb: Home / Incorporation / SPICe+ Part A / Name Approval on the name-approval page */
function crumbPhase(on){var b=document.getElementById('crB'),p=document.getElementById('crP');
  if(on&&!p&&b){p=document.createElement('span');p.id='crP';p.style.display='contents';b.parentNode.insertBefore(p,b);}
  if(on&&p){var q=STEPS[curN()-1].p;p.innerHTML='<a href="#" data-go="'+PH_KEY[q-1]+'">'+PHN[q-1]+'</a><span class="sl">/</span>';}
  else if(!on&&p)p.remove();}
/* side list of the phase, as in the live app: status, name, owner, more, what's this */
function naRail(x){
  var l=steps(x.p);
  return '<aside class="card narail" aria-label="'+PHN[x.p-1]+' steps"><h2>'+PHN[x.p-1]+'</h2><div class="nal">'+l.map(function(y,i){var k=KD(y.n),cur=y.n===x.n;
    var ico=k==='up'?'<span class="si num" role="img" aria-label="'+esc(tipTxt(y.n))+'" data-tt="'+esc(tipTxt(y.n))+'">'+(i+1)+'</span>':si(k,tipTxt(y.n));
    return '<div class="nar k-'+k+(cur?' cur':'')+'">'+ico+
      '<a href="#" class="nm" data-go="inc-step-'+y.n+'"'+(cur?' aria-current="page"':'')+' aria-label="Step '+y.n+' · '+esc(y.t)+'"><span>'+esc(y.t)+'</span><span class="ow '+y.o+'" role="img" aria-label="Owner · '+(y.o==='You'?'Northwind':y.o)+'" data-tt="'+(y.o==='You'?'Northwind owns this step':'SBC owns this step')+'">'+ic('user')+'</span></a>'+
      '<button type="button" class="ib" data-more="'+y.n+'" aria-label="More for step '+y.n+' · '+esc(y.t)+'" data-tt="More" data-notip>'+ic('more')+'</button>'+
      '<button type="button" class="ib" data-ask="'+y.n+'" aria-label="What’s this? '+esc(y.t)+'" data-tt="What’s this? · ask VCFO" data-notip>'+ic('circle-help')+'</button></div>';}).join('')+'</div></aside>';
}
/* status line at the top of the card */
function liveStatus(x){
  var k=KD(x.n),c=X[x.n]||{},d=DT(x.n),pv=STEPS[x.n-2];
  if(x.n===5)return ['done','circle-check','Approved','Accepted after submission on '+fmtS(DT(4))+'.'];
  if(k==='done')return ['done','circle-check',x.o==='You'?'Approved':'Completed',(x.o==='You'?'Accepted after submission on ':'Delivered by SBC on ')+fmtS(d)+'.'];
  if(k==='you')return ['you','user-round','Waiting on Northwind · due '+fmt(d),c.banner||'Northwind’s team filled this step. Check it, then approve & submit.'];
  if(k==='with')return ['with','trending-up','With SBC · since '+fmt(since(x.n)),(c.bubB&&!AFTER_ON?c.bubB:'Northwind’s project lead is working on it. The result appears here when it is delivered.')+' Due '+fmt(d)+'.'];
  if(k==='prog')return ['prog','clock','In progress · due '+fmt(d),c.bubB&&!AFTER_ON?c.bubB:'Fill the remaining answers and submit by '+fmt(d)+'.'];
  return ['up','lock','Not started','Opens after step '+(x.n-1)+(pv?' · '+pv.t:'')+'. Here is what it will ask for.'];
}
function liveIntro(x){
  var k=KD(x.n),d=DT(x.n),sbc=x.o!=='You',pv=STEPS[x.n-2];
  if(x.n===5)return 'Approved by MCA after submission on '+fmtS(DT(4))+'.';
  if(k==='done')return (sbc?'Northwind’s team completed this step on ':'You submitted this step; it was approved on ')+fmtS(d)+'. Here is what it captured.';
  if(k==='you')return 'Northwind’s team filled this step. Check it, then approve & submit by '+fmt(d)+'.';
  if(k==='with')return 'Northwind’s team is preparing this step (due '+fmt(d)+'). Here is what it captures.';
  if(k==='prog')return 'Fill this step and submit by '+fmt(d)+'. Here is what it captures.';
  return (sbc?'Northwind’s team prepares this step.':'Northwind fills this step once step '+(x.n-1)+(pv?' · '+pv.t:'')+' is done.')+' Here is what it captures.';
}
function liveRows(x){
  if(x.n===5){var d=DT(5);return [['Approved company name','Northwind Technologies India Private Limited'],['Name approval date',fmtL(d)],['Name approval expiry date',fmtL(addD(d,20))],
    ['MCA name approval letter','<button type="button" class="nalk" data-view="Name_Approval_Letter.pdf" aria-label="Open Name_Approval_Letter.pdf">'+ic('external-link')+'Name_Approval_Letter.pdf</button>',true],['Remarks (optional)','—']];}
  var rows=fields(x).map(function(r){return [r.l,r.v==='✓'?'Provided · '+fmt(DT(x.n)):esc(r.v)];});
  if(!rows.some(function(r){return /^remarks/i.test(r[0]);}))rows.push(['Remarks (optional)','—']);
  return rows;
}
function liveActions(x){
  var k=KD(x.n),pv=STEPS[x.n-2],b=[];
  if(k==='done')b.push('<button type="button" class="btn nachg" data-change="'+x.n+'">'+ic('message-square')+'Request a change</button>');
  return b.length?'<div class="naf">'+b.join('')+'</div>':'';
}
function renderLive(x){
  var n=x.n,k=KD(n),c=X[n]||{},st=liveStatus(x),pv=STEPS[n-2],nx=STEPS[n];
  document.title=x.t+' · Incorporation · VCFO Suite';
  var cb=document.getElementById('crB');if(cb)cb.textContent=x.t;crumbPhase(true);
  var tab=(n!==5&&c.tab)||x.t;
  var h='<div class="wrap na"><div class="nah"><button type="button" class="nabk" data-go="'+PH_KEY[x.p-1]+'" aria-label="Back to '+PHN[x.p-1]+'">'+ic('chevron-left')+'</button><h1>'+esc(x.t)+'</h1>'+
    '<button type="button" class="naw" data-ask="'+n+'" aria-label="What’s this? '+esc(x.t)+'">'+ic('circle-help')+'What’s this?</button></div>'+
    '<div class="nag"><div class="nam"><section class="card nac" aria-label="'+esc(x.t)+'">'+
      (k==='done'
        /* approved: tab + green banner + answers (live app, approved step) */
        ?'<div class="natabs" role="tablist" aria-label="Sections"><button type="button" class="natab" role="tab" aria-selected="true" id="na-t1" aria-controls="na-p1">'+ic('check')+esc(tab)+'</button></div>'+
          '<div class="nabd" role="tabpanel" id="na-p1" aria-labelledby="na-t1"><div class="naok done" role="status">'+ic('circle-check')+'<div><b>Approved</b><span>Accepted after submission on '+fmtS(n===5?DT(4):DT(n))+'.</span></div></div>'+
          '<dl class="nakv" style="margin:22px 20px 0">'
        /* not approved yet: plain card (live app, step not done) */
        :'<div class="nabd"><p class="nain">'+esc(liveIntro(x))+'</p><dl class="nakv">')+
      liveRows(x).map(function(r){var no=r[1]==='—';return '<div><dt>'+esc(r[0])+'</dt><dd'+(no?' class="no"':'')+'>'+r[1]+'</dd></div>';}).join('')+'</dl></div></section>'+
      docsCard(x)+liveActions(x)+'</div>'+
    naRail(x)+'</div>';
  h+='<nav class="pn" aria-label="Steps">'+(pv?'<button type="button" class="btn" data-go="inc-step-'+(n-1)+'">'+ic('arrow-left')+'<span>'+(n-1)+' · '+esc(pv.t)+'</span></button>':'<button type="button" class="btn" data-go="incorporation">'+ic('arrow-left')+'<span>All phases</span></button>')+(nx?'<button type="button" class="btn" data-go="inc-step-'+(n+1)+'"><span>'+(n+1)+' · '+esc(nx.t)+'</span>'+ic('arrow-right')+'</button>':'<button type="button" class="btn" data-go="incorporation"><span>All phases</span>'+ic('arrow-right')+'</button>')+'</nav>';
  h+=actBar(x)+'</div>';
  main.innerHTML=h;
  document.body.classList.toggle('has-act',k==='you');
  actH();
}
function renderStep(){
  var n=curN(),x=STEPS[n-1],k=KD(n),pi=steps(x.p),pos1=pi.indexOf(x)+1,pv=STEPS[n-2],nx=STEPS[n];
  renderLive(x);return;   /* every step uses the live app's layout; the older layout below is kept for reference */
```

Extra click handler on the step page:
```js
  if((el=t.closest('[data-more]'))){e.preventDefault();touch(el);var mn=+el.getAttribute('data-more');toast('Step '+mn+' · '+STEPS[mn-1].t+' · more actions in the full app');return;}
```

### 5.4 Phase page variants — `final-src/s/inc/phase.html` (verbatim functions that differ from the landing build)

The phase page uses the generator `stepTable` (with (?) and → square buttons, 📎 for steps 6/7, ↗ for SBC steps with forms, real KD statuses, no "Next"), `phaseRow`/`phasesCard` (unused on this page), and keeps `renderPhase`, `rail`, `railHero`.

```js
function stepTable(p,cur){
  var h='<div class="stt"><div class="sth" aria-hidden="true"><span></span><span></span><span>Step</span><span class="c-own">Owner</span><span class="c-st">Status</span><span class="c-dt">Date</span><span class="lk c-lk">'+ic('external-link')+'·'+ic('paperclip')+'</span><span></span><span></span></div>',g='';
  if(phState(p)==='up'&&PH_WAIT[p-1])h=botSay(PH_WAIT[p-1],'Ask VCFO when it starts','When does Phase '+p+' · '+PH[p-1]+' start?','Ask VCFO when Phase '+p+' starts')+h;
  steps(p).forEach(function(x){
    if(p===4){var gg=regGroup(x.t);if(gg!==g){h+='<div class="grp">'+gg+'</div>';g=gg;}}
    var k=KD(x.n),lk='';
    if(x.n===6||x.n===7)lk='<a href="#" class="lkb" data-go="inc-step-'+x.n+'" aria-label="Attachments of step '+x.n+'" data-tt="Attachments · open the step" data-notip>'+ic('paperclip')+'</a>';
    else if(x.o==='SBC'&&x.f&&x.f.length)lk='<button type="button" class="lkb" data-portal="'+x.n+'" aria-label="Open '+esc(x.f[0])+' on the official portal" data-tt="'+esc(x.f[0])+' · official portal" data-notip>'+ic('external-link')+'</button>';
    h+='<div class="str k-'+k+(cur===x.n?' cur':'')+'" id="step-'+x.n+'">'+si(k,tipTxt(x.n))+'<span class="nb">'+x.n+'</span><span class="nm" title="'+esc(x.t)+'">'+esc(x.t)+(x.u?'<span class="urg">Urgent</span>':'')+'</span>'+
      '<span class="c-own">'+own(x.o)+'</span><span class="c-st">'+chip(k)+'</span><span class="dt c-dt">'+dateCell(x.n)+'</span><span class="lkc c-lk">'+lk+'</span>'+
      '<button type="button" class="sq" data-ask="'+x.n+'" aria-label="What’s this? '+esc(x.t)+'" data-tt="What’s this? · ask VCFO" data-notip>'+ic('circle-help')+'</button>'+
      '<a href="#" class="sq" data-go="inc-step-'+x.n+'" aria-label="Open step '+x.n+' · '+esc(x.t)+'" data-tt="Open step '+x.n+'" data-notip>'+ic('arrow-right')+'</a></div>';
  });
  return h+'</div>';
}
```

```js
function renderPhase(){
  var p=curP(),l=steps(p),d=doneN(l),t=l.length,ps=phState(p),pl=phPlan(p),pct=Math.round(d/t*100),endD=ps==='done'?phEnd(p):pl[1];
  document.title='Phase '+p+' · '+PH[p-1]+' · Incorporation · VCFO Suite';
  var cb=document.getElementById('crB');if(cb)cb.textContent='Phase '+p+' · '+PH[p-1];
  var focus=(l.filter(function(x){return KD(x.n)==='you';})[0]||l.filter(function(x){return ST(x.n)!=='done';})[0]||l[l.length-1]).n,cur=STEPS[focus-1];
  var h='<div class="wrap"><section class="hero" aria-label="Phase '+p+' · '+PH[p-1]+'"><div class="hrow">'+
    '<div class="hl"><button type="button" class="hback" data-go="incorporation" aria-label="Back to Incorporation">'+ic('chevron-left')+'</button>'+
    '<div class="htx"><div class="eb">Incorporation · phase '+p+' of 4</div><div class="ht"><h1>'+PH[p-1]+'</h1><button type="button" class="wt" data-chatq="What’s this: Phase '+p+' · '+PH[p-1]+'?" aria-label="What’s this? Phase '+p+' · '+PH[p-1]+'" data-tt="What’s this? · ask VCFO" data-notip>'+bmini()+'What’s this?</button></div>'+
    '<div class="hm">'+d+'/'+t+' · '+fmt(pl[0])+' → '+fmt(endD)+' · '+(ps==='done'?'finished ':'ends ')+fmtY(endD)+'</div></div></div>'+
    '<div class="hr"><div class="hnav">'+(p>1?'<a href="#" class="wbtn" data-go="'+PH_KEY[p-2]+'" aria-label="Previous phase · '+PH[p-2]+'">'+ic('chevron-left')+'<span>Phase '+(p-1)+' · '+PH[p-2]+'</span></a>':'')+(p<4?'<a href="#" class="wbtn" data-go="'+PH_KEY[p]+'" aria-label="Next phase · '+PH[p]+'"><span>Phase '+(p+1)+' · '+PH[p]+'</span>'+ic('chevron-right')+'</a>':'')+'</div>'+
    '<button type="button" class="ring" data-bar="'+p+'" aria-label="Phase '+p+' · '+pct+'% · '+d+' of '+t+' steps done" data-tt="Phase '+p+' · '+d+' of '+t+' steps done" data-notip><span class="rw">'+ringSvg(pct,ps==='done'?'#2fd3a0':'#e6c46e')+'<span class="pc">'+pct+'%</span></span><small>Phase '+p+'</small></button></div>'+
  '</div></section>';
  h+='<section class="card acc psum" aria-label="Phase progress"><div class="ch" style="padding:0"><h2 class="lbl">Progress<button type="button" class="ibtn" data-info="phase" aria-expanded="false" aria-label="About this phase" data-tt="About this phase" data-notip>'+ic('info')+'</button></h2><span class="sp"></span><span class="cnt">'+d+' of '+t+' steps</span></div>'+
    '<div class="bw">'+phBar(p,true)+'<span class="glab">'+phLabel(p)+'</span></div>'+
    '<div class="kd"><span>Starts <b>'+fmt(pl[0])+'</b></span><span>'+(ps==='done'?'Finished':'Ends')+' <b>'+fmt(endD)+'</b></span>'+(ps!=='done'?'<span>Now <a href="#" data-go="inc-step-'+cur.n+'">Step '+cur.n+' · '+esc(cur.t)+'</a></span>':'')+(p===2?'<span>COI <b>'+fmt(coiDate())+(AFTER_ON?'':' (expected)')+'</b></span>':'')+'<span>Reviewer <b>Arjun Mehta</b></span></div></section>';
  var you=l.filter(function(x){return x.o==='You';}),sbc=l.filter(function(x){return x.o!=='You';}),O=[['Northwind',you,'#c9a24b'],['SBC',sbc,'#2f6fd0']];
  var wh='<section class="card acc team" aria-label="Who’s doing it"><div class="ch"><h2 class="lbl">Who’s doing it</h2></div><div class="obar" role="group" aria-label="Owners in Phase '+p+'">'+
    O.filter(function(o){return o[1].length;}).map(function(o){return '<button type="button" style="flex:'+o[1].length+';background:'+o[2]+'" data-owner="'+o[0]+'" aria-label="'+o[0]+' · '+o[1].length+' steps" data-tt="'+o[0]+' · '+o[1].length+' of '+t+' steps" data-notip></button>';}).join('')+'</div>'+
    '<div class="lgd">'+O.map(function(o){return '<button type="button" class="lg" data-owner="'+o[0]+'" aria-label="Steps owned by '+o[0]+' · '+o[1].length+'"><i style="background:'+o[2]+'"></i><span>'+o[0]+'</span><b>'+o[1].length+'</b></button>';}).join('')+'</div></section>';
  h+='<div class="sgrid"><div class="scol"><section class="card acc" aria-label="Steps"><div class="ch"><h2 class="lbl">Steps</h2><span class="sp"></span><span class="cnt">'+t+' steps</span></div><div style="padding:0 8px 8px">'+stepTable(p,focus)+'</div></section></div><div class="scol side2">'+rail(p,focus,false)+wh+'</div></div>';
  h+='<nav class="pn" aria-label="Phases">'+(p>1?'<button type="button" class="btn" data-go="'+PH_KEY[p-2]+'">'+ic('arrow-left')+'<span>Phase '+(p-1)+'</span></button>':'<button type="button" class="btn" data-go="incorporation">'+ic('arrow-left')+'<span>All phases</span></button>')+(p<4?'<button type="button" class="btn" data-go="'+PH_KEY[p]+'"><span>Phase '+(p+1)+'</span>'+ic('arrow-right')+'</button>':'<button type="button" class="btn" data-go="incorporation"><span>All phases</span>'+ic('arrow-right')+'</button>')+'</nav></div>';
  main.innerHTML=h;
}

```

```js
function rail(p,focus,isPage){
  var l=steps(p),d=doneN(l),list=l;
  if(l.length>11&&!railAll){var i=l.map(function(x){return x.n;}).indexOf(focus),s=Math.max(0,Math.min(l.length-9,i-4));list=l.slice(s,s+9);}
  var h='<section class="card acc rail" aria-label="Journey · Phase '+p+'"><div class="ch"><h2 class="lbl" style="font-size:11.5px">'+PH[p-1]+' · journey</h2><span class="sp"></span><span class="chip up" style="font-family:var(--mono);font-weight:600">'+d+' / '+l.length+'</span></div><div class="rl">';
  list.forEach(function(x,j){
    var k=KD(x.n),nx=list[j+1],ok=k==='done'&&nx&&KD(nx.n)==='done';
    if(x.n===focus){h+=railHero(x,isPage);return;}
    h+='<a href="#" class="rr'+(ok?' ok':'')+(j===list.length-1?' last':'')+'" data-go="inc-step-'+x.n+'" aria-label="Step '+x.n+' · '+esc(x.t)+' · '+railSub(x)+'">'+si(k,tipTxt(x.n))+'<span style="min-width:0"><b>'+x.n+' · '+esc(x.t)+'</b><small>'+railSub(x)+'</small>'+(k==='done'||k==='up'?'':dots(x))+'</span>'+own(x.o)+'</a>';
  });
  h+='</div>'+(l.length>11?'<button type="button" class="btn sm rmore" data-railall aria-expanded="'+railAll+'">'+(railAll?'Show fewer steps':'Show all '+l.length+' steps')+'</button>':'');
  return h+'</section>';
}

```

```js
function railHero(x,isPage){
  var k=KD(x.n),sl=subList(x),dn=sl.filter(function(s){return s.s==='done';}).length,lbl=(isPage?(k==='done'?'Done':k==='up'?'Upcoming':'Now'):'Now')+' · step '+x.n;
  var labels=sl.length<=4&&sl.every(function(s){return s.l.length<=14;});
  return '<div class="rh" role="group" aria-label="Step '+x.n+' · '+esc(x.t)+' · '+railSub(x)+'"><div class="hh">'+si(k,tipTxt(x.n))+'<div style="min-width:0"><div class="k">'+lbl+'</div><b>'+esc(x.t)+'</b><small>'+railSub(x)+'</small></div>'+
    '<button type="button" class="wq" data-ask="'+x.n+'" aria-label="What’s this? '+esc(x.t)+'" data-tt="What’s this? · ask VCFO" data-notip>'+ic('circle-help')+'</button></div>'+
    '<div class="subt">'+sl.map(function(s){return '<span class="sb '+(s.s==='done'?'on':s.s==='now'?'cu':'')+'" role="img" aria-label="'+esc(s.l)+' · '+(s.s==='done'?'done':s.s==='now'?'in progress':'to do')+'" data-tt="'+esc(s.l)+' · '+(s.s==='done'?'done':s.s==='now'?'in progress':'to do')+'"><i></i>'+(labels?'<span>'+esc(s.l)+'</span>':'')+'</span>';}).join('')+'</div>'+
    (labels?'':'<div class="subn">'+dn+' of '+sl.length+' sub-steps done</div>')+'</div>';
}
```

```js
function railSub(x){var k=KD(x.n);return k==='done'?'Done · '+fmt(DT(x.n)):k==='you'?'Waiting on Northwind · due '+fmt(DT(x.n)):k==='prog'?'In progress · due '+fmt(DT(x.n)):k==='with'?'With Northwind’s project lead · since '+fmt(since(x.n)):'Opens later';}
```

```js
function drillPhase(p){var l=steps(p),tabs=tabsFor(l),c=cnt(l),act=c.you?'you':c.with?'with':c.prog?'prog':c.done===l.length?'done':'up';
  var cfg={title:'Phase '+p+' · '+PH[p-1],sub:doneN(l)+' of '+l.length+' steps done',tabs:tabs,active:idx(tabs,act)};
  if(PAGE!=='phase')cfg.link={lead:'Every step of this phase',text:'Open the phase page →',go:PH_KEY[p-1],where:'the phase page'};drill(cfg);}
```

```js
function drillOwner(o){var p=curP(),l=steps(p),tabs=['You','SBC'].map(function(k){return {k:k,label:(k==='You'?'Northwind':k),color:k==='You'?'#c9a24b':'#2f6fd0',rows:l.filter(function(x){return x.o===k;}).map(stRow)};}).filter(function(t){return t.rows.length;});
  drill({title:'Who’s doing it · Phase '+p,sub:PH[p-1]+' · '+l.length+' steps',tabs:tabs,active:idx(tabs,o)});}
```

```js
function renderBoard(){
  document.title='Board resolution · Incorporation · VCFO Suite';
  var stg=[['Drafted','SBC · 26 Sep'],['Released','28 Sep'],['Signed','Northwind · 30 Sep']],parts=[];
  stg.forEach(function(s){parts.push('<div class="stg ok"><span class="o">'+sic('check',3.4)+'</span><span class="lb"><b>'+s[0]+'</b><small>'+s[1]+'</small></span></div>','<span class="cn ok" aria-hidden="true"></span>');});
  parts.push('<div class="now ok" role="group" aria-label="Received by SBC · Arjun · 30 Sep"><span class="tile">'+ic('check')+'</span><span class="tx"><span class="k">Received</span><b>Received by SBC</b><small>Arjun · 30 Sep</small></span></div>');
  var ln=function(w){return '<div class="ln" style="width:'+w+'%"></div>';};
  var h='<div class="wrap"><section class="hero" aria-label="Board resolution"><div class="hrow">'+
    '<div class="hl"><button type="button" class="hback" data-go="inc-phase-a" aria-label="Back to Phase 1 · Name Application">'+ic('chevron-left')+'</button>'+
    '<div class="htx"><div class="eb">Phase 1 · Name Application · steps 2–3</div><div class="ht"><h1>Board resolution</h1><button type="button" class="wt" data-chatq="What’s this: Board resolution?" aria-label="What’s this? Board resolution" data-tt="What’s this? · ask VCFO" data-notip>'+bmini()+'What’s this?</button></div>'+
    '<div class="hm" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px"><span class="chip done">Signed copy received · 30 Sep</span><span class="chip" style="background:rgba(255,255,255,.16);color:#fff">Certified true copy</span></div></div></div>'+
    '<div class="hr"><div class="hnav"><a href="#" class="wbtn" data-go="inc-step-2" aria-label="Step 2 · Draft Board Resolution"><span>2 · Draft Board Resolution</span>'+ic('chevron-right')+'</a><a href="#" class="wbtn" data-go="inc-step-3" aria-label="Step 3 · Signed Board Resolution"><span>3 · Signed Board Resolution</span>'+ic('chevron-right')+'</a></div>'+si('done','Done · received 30 Sep','xl')+'</div>'+
  '</div></section>';
  h+='<section class="card trk" aria-label="Progress of the board resolution"><div class="lc">'+parts.join('')+'</div></section>';
  h+='<div class="brg"><section class="card prv" aria-label="Preview"><div class="ch"><h2 class="lbl">Preview</h2><span class="cnt">page 1 of 2 · <span id="zv">'+Math.round(zoom*100)+'%</span></span><span class="sp"></span>'+
    '<button type="button" class="sq" data-zoom="-1" aria-label="Zoom out">'+ic('minus')+'</button><button type="button" class="sq" data-zoom="1" aria-label="Zoom in">'+ic('plus')+'</button><button type="button" class="sq" data-full aria-label="Open full screen">'+ic('maximize')+'</button></div>'+
    '<div class="pvw"><div class="paper" id="paper" style="transform:scale('+zoom+')"><div class="t">CERTIFIED TRUE COPY OF THE RESOLUTION PASSED BY THE BOARD OF DIRECTORS OF NORTHWIND INC. ON 24 SEPTEMBER 2026</div>'+ln(90)+ln(100)+ln(80)+'<h4>RESOLVED THAT</h4>'+ln(100)+ln(85)+ln(100)+ln(60)+'<h4>RESOLVED FURTHER THAT</h4>'+ln(100)+ln(75)+ln(100)+ln(50)+
    '<div class="sig"><div><div class="sg">J. Carter</div><div class="sgl">Director, Northwind Inc.</div></div><div class="stamp">NORTHWIND<br>INC.</div></div></div></div></section>';
  h+='<div class="scol"><section class="card acc files" aria-label="Files"><div class="ch"><h2 class="lbl">Files</h2><span class="sp"></span><span class="cnt">2 files</span></div>'+
    fileRow({t:'docx',n:'Draft · Word',f:'board-resolution.docx',m:'SBC · 26 Sep',s:'Released'})+fileRow({t:'pdf',n:'Signed copy',f:'br-signed-northwind.pdf',m:'Northwind · 30 Sep',s:'Received'})+
    '<div class="drop blue"><button type="button" class="ut" data-upload="br" aria-label="Replace the signed copy">'+ic('refresh-cw')+'</button><span class="tx"><b>Replace signed copy</b><span>Drop a PDF or <button type="button" data-upload="br">browse</button></span></span><span class="mono">PDF · DOCX</span></div></section>'+
    '<section class="card acc team" aria-label="What happens with it"><div class="ch"><h2 class="lbl">What happens with it</h2></div>'+botSay('Northwind’s parent board authorised the India subsidiary. SBC drafted it, J. Carter signed it, and it went with the name application in step 4.','Open step 3','','Open step 3 · Signed Board Resolution','inc-step-3')+'</section></div></div></div>';
  main.innerHTML=h;
}

```

### 5.5 Shared runtime (`final-src/proto.js`) — toast, drill, before/after

```js
  var toastEl, toastT;
  function toast(msg, undo, cb) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.id = 'vp-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.innerHTML = '';
    var s = document.createElement('span'); s.textContent = msg; toastEl.appendChild(s);
    if (undo) { var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Undo'; b.onclick = function () { if (typeof cb === 'function') cb(); toast('Undone'); }; toastEl.appendChild(b); }
    toastEl.classList.add('on'); toastEl.setAttribute('data-n', String((+toastEl.getAttribute('data-n') || 0) + 1)); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 3200);
  }
  window.vcfoToast = toast;

  function setAfter(v) {
    v = !!v; store.set('after', v); syncAfter();
    try { document.dispatchEvent(new CustomEvent('vcfo-after', { detail: v })); } catch (e) {}   // screens that are not Home re-render in place
    var h = here();
    if (!h || h.indexOf('home') === 0) goHome(); else toast(v ? 'Showing the company after incorporation' : 'Showing the company before incorporation');
  }
  window.vcfoSetAfter = setAfter;

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
Prototype fallback click semantics (`KIND`, l.236–245): approve/submit/send/save/request… → "<label> · done" toast **with Undo**; download → "Download started · …"; upload → "Choose a file to upload"; portal/↗ → "Opens the official portal in a new tab".


## 6. Verbatim FINAL CSS

### 6.1 Complete stylesheet of `step.html` (also covers phase.html and board.html, which are identical minus the `.na*` block)

```css
:root{--bg:#f3f5f9;--panel:#fff;--raised:#f5f7fa;--border:#e2e7ef;--hair:#edf0f5;--fg:#0f1b2d;--muted:#56667d;--subtle:#7b889c;
--primary:oklch(54.6% 0.215 263);--primary-dark:oklch(48.8% 0.217 264);--primary-light:oklch(96.6% 0.02 260);--navy:#0f2a4a;--gold:#c9a24b;--gold-2:#e6c46e;
--ok:#15805f;--ok-light:#e5f4ee;--ok-text:#0f6a4e;--you:#c8620e;--you-light:#fdf2e6;--you-text:#9a4a08;--with:#2453c7;--with-light:#e9effc;--with-text:#2349a8;
--over:#cf3a2f;--up:#cfd6e2;--own-you:#fbf0d2;--own-you-t:#7a5a0c;--own-sbc:#e8eefb;--own-sbc-t:#2349a8;--violet:#6b3fc4;--violet-light:#efe9fb;
--shadow:0 1px 2px rgba(15,27,45,.04),0 6px 18px -10px rgba(15,27,45,.16);
--sw:var(--vp-side-w,248px);--mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;--disp:"Space Grotesk",Manrope,system-ui,sans-serif}
@media (max-width:1279px){:root{--sw:var(--vp-side-w,72px)}}
@media (max-width:767px){:root{--sw:var(--vp-side-w,0px)}}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--fg);font:500 13px/1.5 Manrope,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
body{overflow-x:clip}
a{color:var(--primary);text-decoration:none;font-weight:700}
button{font:inherit;color:inherit}
.mono{font-family:var(--mono)}
.ic{width:16px;height:16px;flex:none}
.side{position:fixed;left:0;top:0;bottom:0;width:var(--sw);flex:none;background:#0f2a4a}
/* ---------- top bar ---------- */
.top{position:sticky;top:0;z-index:40;margin-left:var(--sw);height:52px;display:flex;align-items:center;gap:12px;padding:0 16px 0 14px;background:light-dark(#fff, oklch(13% 0 89.9));border-bottom:1px solid var(--border)}
.top .sbc{height:28px;width:auto;display:block;flex:none}
.crumb{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted);min-width:0}
.crumb a{color:var(--muted);font-weight:500;white-space:nowrap}.crumb a:hover{color:var(--fg)}
.crumb .sl{color:var(--subtle)}
.crumb b{color:var(--fg);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sp{flex:1}
.search{display:flex;align-items:center;gap:8px;width:240px;height:36px;padding:0 8px 0 12px;border-radius:8px;border:1px solid var(--border);background:var(--raised);color:var(--subtle);cursor:text;flex:none}
.search .k{margin-left:auto;display:flex;gap:4px}.search .k span{min-width:18px;height:18px;border-radius:4px;background:light-dark(#fff, oklch(13% 0 89.9));box-shadow:inset 0 0 0 1px var(--border);display:grid;place-items:center;font:500 11px var(--mono)}
.tb{position:relative;width:36px;height:36px;border-radius:8px;border:0;background:none;color:var(--muted);display:grid;place-items:center;cursor:pointer;flex:none}
.tb:hover{background:var(--primary-light);color:var(--fg)}
.tb .n{position:absolute;right:3px;top:2px;min-width:16px;height:16px;border-radius:99px;background:var(--primary-fill,var(--primary));color:#fff;font:700 11px/16px Manrope,sans-serif;text-align:center;box-shadow:0 0 0 2px light-dark(#fff, oklch(13% 0.006 260))}
.tb.b{box-shadow:inset 0 0 0 1px var(--border)}
.tb.srch{display:none}
.menu{display:none}
/* ---------- page ---------- */
main{margin-left:var(--sw);padding:24px clamp(14px,2.2vw,24px) 120px}
.wrap{max-width:1600px;margin-inline:auto;display:flex;flex-direction:column;gap:16px;min-width:0}
.card{position:relative;background:var(--panel);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow);min-width:0}
.card.acc:before{content:"";position:absolute;left:18px;top:-1px;width:30px;height:3px;border-radius:0 0 3px 3px;background:var(--gold)}
.lbl{font:800 12.5px Manrope,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--navy-ink,var(--navy));margin:0;display:flex;align-items:center;gap:6px}
.cnt{font:500 11.5px var(--mono);color:var(--subtle);white-space:nowrap}
.ch{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:16px 18px 10px}
.ch .sp{min-width:8px}
.ibtn{width:24px;height:24px;border-radius:6px;border:0;background:none;color:var(--subtle);display:inline-grid;place-items:center;cursor:pointer;flex:none;padding:0}
.ibtn:hover,.ibtn[aria-expanded=true]{background:var(--primary-light);color:var(--primary)}
.ibtn svg{width:15px;height:15px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:36px;padding:0 14px;border-radius:7px;font:600 13px Manrope,sans-serif;border:1px solid var(--border);background:light-dark(#fff, oklch(13% 0 89.9));color:var(--fg);cursor:pointer;white-space:nowrap;transition:transform .12s,background .15s;text-decoration:none}
.btn:hover{background:var(--raised)}.btn:active{transform:scale(.98)}
.btn.p{background:var(--primary-fill,var(--primary));border-color:transparent;color:#fff}.btn.p:hover{background:var(--primary-fill-2,var(--primary-dark))}
.btn.nv{background:var(--navy);border-color:var(--navy);color:#fff}.btn.nv:hover{background:#173c66}
.btn svg{width:16px;height:16px;flex:none}
.btn.sm{height:32px;padding:0 11px;font-size:12.5px}
.sq{width:32px;height:32px;border-radius:7px;border:1px solid var(--border);background:light-dark(#fff, oklch(13% 0 89.9));color:var(--navy-ink,var(--navy));display:inline-grid;place-items:center;cursor:pointer;flex:none;padding:0}
.sq:hover{background:var(--primary-light);color:var(--primary)}
.sq svg{width:15px;height:15px}
/* chips */
.chip{display:inline-flex;align-items:center;gap:5px;border-radius:5px;padding:2px 8px;font-size:12px;font-weight:700;white-space:nowrap;line-height:1.5}
.chip.done{background:var(--ok);color:#fff}.chip.you{background:var(--you);color:#fff}.chip.with{background:var(--with);color:#fff}.chip.prog{background:var(--navy);color:#fff}
.chip.up{background:light-dark(#fff, oklch(13% 0 89.9));color:var(--muted);box-shadow:inset 0 0 0 1px var(--up)}
.chip.risk{background:var(--you);color:#fff}.chip.late{background:var(--over);color:#fff}
.own{display:inline-block;border-radius:4px;padding:1px 7px;font-size:11px;font-weight:800;text-align:center;line-height:1.6;white-space:nowrap}
.own.You{background:var(--own-you);color:var(--own-you-t)}.own.SBC{background:var(--own-sbc);color:var(--own-sbc-t)}.own.MCA{background:var(--violet-light);color:var(--violet)}
/* status glyphs · set A solid (rule 18) */
.si{width:22px;height:22px;border-radius:50%;display:inline-grid;place-items:center;flex:none;position:relative;z-index:1}
.si svg{width:12px;height:12px}
.si.done{background:var(--ok);color:#fff}.si.you{background:var(--you);color:#fff}.si.prog{background:var(--navy);color:var(--gold-2)}.si.with{background:var(--with);color:#fff}
.si.up{background:light-dark(#fff, oklch(13% 0 89.9));box-shadow:inset 0 0 0 1.5px var(--up)}.si.late{background:var(--over);color:#fff}
.si.xl{width:26px;height:26px}.si.xl svg{width:14px;height:14px}
/* bot (rule 16) */
.bot{display:flex;gap:12px;align-items:flex-start}
.bav{flex:none;width:40px;height:40px;border-radius:50%;background:var(--primary-light);display:grid;place-items:center;overflow:hidden}
.bav svg{width:34px;height:43px;margin-top:9px}
.bub{position:relative;flex:1;min-width:0;background:var(--with-light);border-radius:10px;padding:9px 12px;font-size:12.5px;line-height:1.5;color:var(--fg)}
.bub .btn{margin-top:8px;height:30px;font-size:12px;padding:0 10px}
.bmini{display:inline-grid;place-items:center;width:18px;height:18px;flex:none}
.bmini svg{width:100%;height:100%}
/* ---------- navy hero band ---------- */
.hero{position:relative;overflow:hidden;border-radius:12px;color:#fff;background:linear-gradient(100deg,#0f2a4a 0%,#14386a 55%,#1b4f94 100%);padding:16px 20px 18px;box-shadow:0 10px 30px -18px rgba(15,42,74,.7)}
.hero:after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,var(--gold) 0%,var(--gold-2) 40%,rgba(201,162,75,.15) 100%)}
.hrow{display:flex;align-items:center;gap:14px;flex-wrap:wrap;position:relative}
.hl{display:flex;align-items:center;gap:14px;min-width:0;flex:1 1 360px}
.hback{width:34px;height:34px;border-radius:7px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.06);color:#fff;display:grid;place-items:center;cursor:pointer;flex:none;padding:0}
.hback:hover{background:rgba(255,255,255,.15)}
.hback svg{width:16px;height:16px}
.htx{min-width:0}
.eb{font:600 11px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--gold-2)}
.ht{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:2px 0 3px}
.ht h1{margin:0;font:700 clamp(19px,1.9vw,23px)/1.2 var(--disp);letter-spacing:-.01em;color:#fff;overflow-wrap:anywhere}
.hm{font:500 12px var(--mono);color:rgba(255,255,255,.82);overflow-wrap:anywhere}
.hr{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-left:auto}
.hbtn{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 12px;border-radius:7px;border:1px solid rgba(255,255,255,.26);background:rgba(255,255,255,.07);color:#fff;font:600 13px Manrope,sans-serif;cursor:pointer;white-space:nowrap;text-decoration:none}
.hbtn:hover{background:rgba(255,255,255,.16)}
.hbtn svg{width:15px;height:15px;flex:none}
.hbtn .rd{display:inline-flex;align-items:center;gap:4px;background:var(--ok);color:#fff;border-radius:4px;padding:1px 7px;font-size:11.5px;font-weight:800}
.hbtn .rd svg{width:12px;height:12px}
.wbtn{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 10px;border-radius:7px;border:1px solid light-dark(rgba(255,255,255,.3), oklch(22% 0 89.9 / 0.3));background:rgba(255,255,255,.12);color:#fff;font:600 12.5px Manrope,sans-serif;cursor:pointer;white-space:nowrap}
.wbtn:hover{background:rgba(255,255,255,.22)}
.ring{display:flex;flex-direction:column;align-items:center;gap:2px;border:0;background:none;padding:0;color:#fff;cursor:pointer;border-radius:8px}
.ring .rw{position:relative;width:50px;height:50px}
.ring svg{width:50px;height:50px;display:block;transform:rotate(-90deg)}
.ring .pc{position:absolute;inset:0;display:grid;place-items:center;font:700 12px Manrope,sans-serif}
.ring small{font:600 11px var(--mono);color:rgba(255,255,255,.7);letter-spacing:.04em}
.ring:focus-visible,.hbtn:focus-visible,.hback:focus-visible{outline:2px solid var(--gold-2);outline-offset:2px}
/* ---------- landing row 2 ---------- */
.r2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr));gap:16px}
.coi{position:relative;overflow:hidden;border-radius:12px;color:#fff;background:linear-gradient(120deg,#0f2a4a 0%,#173f74 100%);padding:clamp(16px,2vw,22px) clamp(16px,2vw,20px) 20px;display:flex;flex-direction:column;gap:10px;box-shadow:0 10px 30px -18px rgba(15,42,74,.7)}
.coi:after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,var(--gold),rgba(201,162,75,.1))}
.coi .t1{display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap}
.big{display:inline-flex;align-items:baseline;gap:10px;border:0;background:none;color:#fff;padding:0;cursor:pointer;text-align:left;border-radius:6px}
.big b{font:700 clamp(34px,4vw,42px)/1 var(--disp);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.big span{font:600 clamp(15px,1.5vw,18px) var(--disp);color:var(--gold-2)}
.big:focus-visible{outline:2px solid var(--gold-2);outline-offset:4px}
.coi .ibtn{color:rgba(255,255,255,.75);margin-top:6px}.coi .ibtn:hover,.coi .ibtn[aria-expanded=true]{background:rgba(255,255,255,.14);color:#fff}
.coi .t1 .chip{margin-left:auto;margin-top:8px;text-decoration:none}
.coi .sub{font-size:13px;color:rgba(255,255,255,.9);display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline}
.coi .sub .mono{font-size:11.5px;color:rgba(255,255,255,.7)}
.coi .sub a{color:var(--gold-2)}
.pill{display:flex;align-items:center;gap:12px;width:100%;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07);border-radius:9px;padding:7px 12px;color:#fff;cursor:pointer;font:600 13.5px Manrope,sans-serif;text-align:left}
.pill:hover{background:rgba(255,255,255,.13)}
.pill .tr{flex:1;height:7px;border-radius:99px;background:rgba(255,255,255,.14);overflow:hidden;min-width:40px}
.pill .tr i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#1fb488,#2fd3a0)}
.pill b{font:700 15px var(--disp)}
.week{padding:14px 18px 12px}
.week .ch{padding:0 0 8px}
.wbot{display:flex;align-items:center;gap:8px;margin-left:auto;min-width:0}
.wbot .bmini{width:26px;height:26px}
.wbot span:last-child{background:var(--with-light);border-radius:6px;padding:3px 8px;font-size:12px;font-weight:600;color:var(--fg)}
.wr{display:grid;grid-template-columns:80px minmax(0,1fr) auto;gap:10px;align-items:center;padding:7px 4px;border-top:1px solid var(--hair);color:var(--fg);font-weight:600;border-radius:6px;text-decoration:none}
.wr:hover{background:var(--raised)}
.wr .t{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wr .dt{font:500 11.5px var(--mono);color:var(--muted);white-space:nowrap}
/* ---------- phases card ---------- */
.phc{padding-bottom:6px}
.phc .ch{padding:16px 18px 6px}
.gax,.phh{display:grid;grid-template-columns:minmax(150px,230px) minmax(0,1fr) auto;gap:14px;align-items:center}
.gax{padding:2px 18px 8px;font:500 11px var(--mono);color:var(--subtle)}
.gax .tl{position:relative;height:16px}
.gax .tl span{position:absolute;top:0;transform:translateX(-50%);white-space:nowrap}
.gax .ob0{min-width:84px}
.gax.e2 .tl span:nth-child(2n),.gax.e4 .tl span:not(:nth-child(4n+1)){display:none}
.phr{border-top:1px solid var(--hair)}
.phr.open{background:light-dark(#f7f9fc, oklch(15.8% 0.005 258.3))}
.phh{padding:12px 18px;min-height:58px}
.pnm{display:flex;align-items:center;gap:10px;min-width:0}
.pnm .tx{min-width:0}
.pnm a{display:block;font:700 14px Manrope,sans-serif;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pnm a:hover{color:var(--primary);text-decoration:underline}
.pnm small{display:block;font:500 11.5px var(--mono);color:var(--subtle)}
.gl{position:relative;height:34px;min-width:0}
.today{position:absolute;top:-13px;bottom:-13px;width:2px;margin-left:-1px;background:var(--over);z-index:2;border:0;padding:0;cursor:pointer}
.today:before{content:"";position:absolute;left:-6px;right:-6px;top:0;bottom:0}
.gbar{position:absolute;top:50%;height:11px;margin-top:-5.5px;border-radius:99px;overflow:visible;border:0;padding:0;cursor:pointer;background:var(--raised);display:block}
.gbar .in{position:absolute;inset:0;border-radius:99px;overflow:hidden;display:block}
.gbar .f{position:absolute;left:0;top:0;bottom:0;display:block}
.gbar.s-done .f{background:var(--ok)}
.gbar .lt{position:absolute;right:0;top:0;bottom:0;background:var(--over);display:block}
.gbar.s-active{background:light-dark(#fff, oklch(13% 0 89.9));box-shadow:inset 0 0 0 1.5px var(--navy)}
.gbar.s-active .f{background:var(--navy)}
.gbar.s-up{background:repeating-linear-gradient(135deg,light-dark(#e3e8ef, oklch(23.6% 0.01 256.7)) 0 4px,light-dark(#f3f5f8, oklch(17.6% 0.005 258.3)) 4px 8px)}
.gbar .ms{position:absolute;right:-8px;top:50%;width:14px;height:14px;margin-top:-7px;background:var(--gold);transform:rotate(45deg);border-radius:2px;box-shadow:0 0 0 2px light-dark(#fff, oklch(13% 0.006 260));display:block}
.gbar:hover,.gbar:focus-visible{filter:brightness(1.08);outline:none;box-shadow:0 0 0 3px oklch(54.6% 0.215 263 / .25)}
.gbar.s-active:hover,.gbar.s-active:focus-visible{box-shadow:inset 0 0 0 1.5px var(--navy),0 0 0 3px oklch(54.6% 0.215 263 / .25)}
.glab{position:absolute;top:50%;transform:translateY(-50%);display:flex;align-items:baseline;gap:8px;white-space:nowrap;font-size:12.5px;font-weight:600;color:var(--muted);pointer-events:none;z-index:3;background:light-dark(#fff, oklch(13% 0 89.9));padding:0 6px;border-radius:4px}
.phr.open .glab{background:light-dark(#f7f9fc, oklch(15.8% 0.005 258.3))}
.glab b{font:700 17px var(--disp);color:var(--fg)}
.glab .e{color:var(--fg);font-weight:700}.glab .e.late{color:var(--over)}.glab .e.early{color:var(--ok-text)}
.ob{min-width:84px}
.ob svg{transition:transform .2s}
.phr.open .ob{background:var(--navy);border-color:var(--navy);color:#fff}
.phr.open .ob svg{transform:rotate(180deg)}
/* simple mode (narrow): bar under the name */
.phc.simple .gax{display:none}
.phc.simple .phh{grid-template-columns:minmax(0,1fr) auto;row-gap:8px}
.phc.simple .gl{grid-column:1/-1;grid-row:2;height:auto;display:flex;flex-direction:column;gap:8px}
.phc.simple .today{display:none}
.phc.simple .gbar{position:relative;left:0!important;width:100%!important;top:0;margin-top:0}
.phc.simple .gbar .ms{right:-2px}
.phc.simple .glab{position:static;transform:none;flex-wrap:wrap;white-space:normal;row-gap:2px}
.phb{display:none;padding:0 18px 12px}
.phr.open .phb{display:block;animation:fin .2s ease-out}
@keyframes fin{from{opacity:0;transform:translateY(-4px)}}
.phb .bot{margin:2px 0 10px}
/* steps table */
.stt{container-type:inline-size}
.sth,.str{display:grid;grid-template-columns:22px 26px minmax(0,1fr) 88px 128px 112px 34px 32px 32px;gap:8px;align-items:center}
.sth{padding:8px 12px 6px;font:800 11px Manrope,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:var(--subtle)}
.sth .lk{display:flex;gap:2px;justify-content:center;align-items:center;color:var(--subtle)}.sth .lk svg{width:12px;height:12px}
.str{padding:7px 12px;border-top:1px solid var(--hair);position:relative;background:transparent;transition:background .3s}
.str.k-you{background:light-dark(#fffdf8, oklch(13.9% 0.007 88.6));box-shadow:inset 3px 0 0 var(--gold)}
.str.cur{background:var(--primary-light)}
.str .nb{font:500 11.5px var(--mono);color:var(--subtle);text-align:right}
.str .nm{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;color:var(--fg);font-size:13.5px}
.str .urg{margin-left:6px;font:700 11px Manrope,sans-serif;color:var(--over);background:light-dark(#fde8e8, oklch(25.1% 0.065 17.6));border-radius:4px;padding:1px 6px}
.str .dt{font:500 11.5px var(--mono);color:var(--muted);white-space:nowrap}
.str .lkc{display:flex;justify-content:center}
.lkb{width:28px;height:28px;border:0;background:none;border-radius:6px;color:var(--subtle);display:grid;place-items:center;cursor:pointer;padding:0}
.lkb:hover{background:var(--primary-light);color:var(--primary)}
.lkb svg{width:14px;height:14px}
.str .sq{width:30px;height:30px}
.grp{font:800 11px Manrope,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:var(--primary);padding:12px 12px 4px}
@container (max-width:720px){
  .sth,.str{grid-template-columns:22px 24px minmax(0,1fr) 88px 128px 32px 32px}
  .sth .c-dt,.str .c-dt,.sth .c-lk,.str .c-lk{display:none}
}
@container (max-width:520px){
  .sth{display:none}
  .str{grid-template-columns:22px 22px minmax(0,1fr) 40px 40px;padding:6px 6px}
  .str .c-own,.str .c-st{display:none}
  .str .sq{width:40px;height:40px}
}
/* donuts */
.dg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
@media (max-width:1279px){.dg{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:767px){.dg{grid-template-columns:minmax(0,1fr)}}
.dc{padding:16px 18px 18px;container-type:inline-size}
.dc .lbl{margin-bottom:12px}
.dn{display:flex;align-items:center;gap:16px}
.dnut{position:relative;width:96px;height:96px;flex:none}
.dnut svg{width:96px;height:96px;display:block;transform:rotate(-90deg)}
.dnut circle.sg{fill:none;stroke-width:13;cursor:pointer;transition:stroke-width .15s}
.dnut circle.sg:hover{stroke-width:16}
.dnut .c{position:absolute;inset:0;display:grid;place-items:center;font:700 24px var(--disp);color:var(--fg);pointer-events:none}
.lgd{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}
.lg{display:grid;grid-template-columns:12px minmax(0,1fr) auto;gap:8px;align-items:center;border:0;background:none;padding:4px 6px;margin:0 -6px;border-radius:6px;cursor:pointer;font:600 13px Manrope,sans-serif;color:var(--fg);text-align:left}
.lg:hover{background:var(--raised)}
.lg i{width:11px;height:11px;border-radius:3px}
.lg b{font:600 13px var(--mono)}
@container (max-width:250px){.dn{gap:10px}.dnut,.dnut svg{width:72px;height:72px}.dnut .c{font-size:19px}.lg{font-size:12px;gap:6px;grid-template-columns:10px minmax(0,1fr) auto}.lg i{width:10px;height:10px}.lg b{font-size:12px}}
/* ---------- step page ---------- */
.hnav{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.hnav .wbtn{max-width:240px}
.hnav .wbtn span{overflow:hidden;text-overflow:ellipsis}
.hnav .wbtn svg{width:14px;height:14px;flex:none}
.wt{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 10px 0 8px;border-radius:7px;border:1px solid light-dark(rgba(255,255,255,.3), oklch(22% 0 89.9 / 0.3));background:rgba(255,255,255,.12);color:#fff;font:600 12.5px Manrope,sans-serif;cursor:pointer;white-space:nowrap}
.wt:hover{background:rgba(255,255,255,.22)}
/* lifecycle tracker */
.trk{padding:22px clamp(14px,2vw,22px) 20px}
.lc{display:flex;align-items:center;min-width:0}
.lc .cn{flex:1;min-width:16px;height:3px;border-radius:99px;background:var(--hair);margin:0 6px;align-self:flex-start;margin-top:13px}
.lc .cn.ok{background:var(--ok)}
.lc .cn.dot{background:none;border-top:3px dotted light-dark(#c9d1dc, oklch(27.7% 0.012 256.3));height:0}
.stg{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;text-align:center;flex:none}
.stg .lb{display:flex;flex-direction:column;gap:2px}
.stg .o{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;flex:none}
.stg .o svg{width:14px;height:14px}
.stg.ok .o{background:var(--ok);color:#fff}
.stg.todo .o{border:2px dashed #aeb9c9;background:light-dark(#fff, oklch(13% 0 89.9))}
.stg b{font-size:12.5px;font-weight:700;color:var(--fg);line-height:1.2}
.stg.todo b{color:var(--muted)}
.stg small{font-size:11.5px;color:var(--muted);line-height:1.2}
.now{position:relative;display:flex;align-items:center;gap:12px;background:var(--navy);color:#fff;border-radius:10px;padding:12px 16px 12px 12px;box-shadow:0 0 0 4px #f3e7c6,0 14px 30px -14px rgba(15,42,74,.8);flex:none;min-width:0;max-width:280px;text-align:left}
.now.ok{background:var(--ok);box-shadow:0 0 0 4px #d5efe5,0 14px 30px -14px rgba(21,128,95,.7)}
.now .tile{width:32px;height:32px;border-radius:8px;background:var(--gold);color:var(--navy);display:grid;place-items:center;flex:none}
.now.ok .tile{background:light-dark(#fff, oklch(13% 0 89.9));color:var(--ok)}
.now .tile svg{width:16px;height:16px}
.now .tx{min-width:0}
.now .k{display:block;font:700 11px var(--mono);letter-spacing:.06em;color:var(--gold-2);text-transform:uppercase}
.now.ok .k{color:#d7f5e9}
.now b{display:block;font:700 15px Manrope,sans-serif;line-height:1.25}
.now small{display:block;font-size:12px;color:rgba(255,255,255,.85)}
.now .tag{position:absolute;right:10px;top:-11px;background:var(--you);color:#fff;border-radius:4px;padding:1px 7px;font-size:11.5px;font-weight:700}
/* banner */
.ban{display:flex;gap:12px;align-items:center;padding:12px 16px;border-radius:12px;background:light-dark(#fbf4e6, oklch(23.9% 0.058 84.6));border:1px solid light-dark(#efdcb3, oklch(32% 0.1 86.1))}
.ban.ok{background:var(--ok-light);border-color:light-dark(#c3e6d7, oklch(32% 0.084 167.6))}
.ban.ok .si{width:28px;height:28px}
.ban .bmini{width:40px;height:40px}
.ban b{display:block;font-size:13.5px;font-weight:700;color:var(--fg)}
.ban span span{display:block;font-size:12.5px;color:var(--muted)}
.ban.ok b,.ban.ok span span{color:var(--ok-text)}
.sgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,320px);gap:16px;align-items:start}
/* name approval (step 5) · as in the live app */
.na{max-width:1360px}
.nah{display:flex;align-items:center;gap:10px;min-width:0}
.nah h1{margin:0;font:700 22px Manrope,sans-serif;color:var(--fg);letter-spacing:-.01em}
.nabk{width:32px;height:32px;border:0;background:none;border-radius:7px;color:var(--muted);display:grid;place-items:center;cursor:pointer;padding:0;flex:none}
.nabk:hover{background:var(--primary-light);color:var(--fg)}
.naw{display:inline-flex;align-items:center;gap:4px;border:0;background:none;padding:4px 6px;border-radius:6px;color:var(--subtle);font:500 12px Manrope,sans-serif;cursor:pointer}
.naw:hover{color:var(--primary);background:var(--primary-light)}.naw svg{width:13px;height:13px}
.nag{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,296px);gap:20px;align-items:start}
.nam{display:flex;flex-direction:column;gap:14px;min-width:0}
.nac{box-shadow:none}
.natabs{display:flex;gap:4px;padding:0 4px;border-bottom:1px solid var(--border);overflow-x:auto}
.natab{display:inline-flex;align-items:center;gap:7px;height:44px;padding:0 16px;border:0;background:none;border-bottom:2px solid transparent;margin-bottom:-1px;color:var(--muted);font:600 13px Manrope,sans-serif;cursor:pointer;white-space:nowrap}
.natab[aria-selected=true]{color:var(--primary);border-bottom-color:var(--primary)}
.natab svg{width:14px;height:14px}
.nabd{padding:20px 20px 26px}
.nain{margin:0 0 4px;font-size:14px;color:var(--muted)}
.nac .nakv{margin:0}
.naok{display:flex;gap:12px;align-items:flex-start;padding:14px 16px;border-radius:8px;background:var(--ok-light);border:1px solid light-dark(#9fd8c0, oklch(32% 0.1 166.9))}
.naok svg{width:18px;height:18px;flex:none;color:var(--ok);margin-top:1px}
.naok.you{background:light-dark(#fbf4e6, oklch(23.9% 0.058 84.6));border-color:light-dark(#efdcb3, oklch(32% 0.1 86.1))}.naok.you svg{color:var(--you)}
.naok.with{background:var(--with-light);border-color:light-dark(#c9d6f5, oklch(32% 0.09 267.4))}.naok.with svg{color:var(--with)}
.naok.prog{background:light-dark(#eef2f8, oklch(19% 0.009 258.3));border-color:light-dark(#cfd8e6, oklch(32% 0.043 259.2))}.naok.prog svg{color:var(--navy-ink,var(--navy))}
.naok.up{background:var(--raised);border-color:var(--border)}.naok.up svg{color:var(--subtle)}
.naok b{display:block;font-size:13px;color:var(--fg)}.naok span{display:block;font-size:12.5px;color:var(--muted);margin-top:2px}
.nakv{margin:22px 20px 0;padding:0}
.nakv div{display:grid;grid-template-columns:minmax(140px,224px) minmax(0,1fr);gap:16px;align-items:center;padding:14px 0;border-bottom:1px solid var(--hair)}
.nakv div:last-child{border-bottom:0}
.nakv dt{font-size:12.5px;color:var(--muted)}
.nakv dt small{display:block;font-size:11.5px;color:var(--subtle);margin-top:2px;line-height:1.4}
.nakv dd .si{width:18px;height:18px;vertical-align:-4px;margin-right:6px}.nakv dd .si svg{width:10px;height:10px}
.napre{display:flex;align-items:center;gap:6px;margin:16px 20px 0;font:500 12px var(--mono);color:var(--muted)}.napre svg{width:13px;height:13px}
.naf{gap:10px;flex-wrap:wrap}
.narail .nal{max-height:calc(100vh - 160px);overflow:auto;margin:0 -4px;padding:0 4px}
.nag>.narail{position:sticky;top:72px}
.nakv dd{margin:0;font-size:14px;color:var(--fg);min-width:0;overflow-wrap:anywhere}
.nakv dd.no{color:var(--subtle)}
.nalk{display:inline-flex;align-items:center;gap:6px;border:0;background:none;padding:0;color:var(--primary);font:500 14px Manrope,sans-serif;cursor:pointer;text-align:left}
.nalk:hover{text-decoration:underline}.nalk svg{width:14px;height:14px;flex:none}
.naf{display:flex;justify-content:flex-end}
.nachg{color:var(--primary);border-color:light-dark(#c9d6f5, oklch(32% 0.09 267.4))}
.narail{padding:18px 16px 12px}
.narail h2{margin:0 0 12px 4px;font:700 11px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.nar{position:relative;display:grid;grid-template-columns:24px minmax(0,1fr) 32px 32px;gap:8px;align-items:center;padding:8px 4px;border-radius:8px}
.nar:not(:last-child):after{content:"";position:absolute;left:15px;top:34px;bottom:-10px;width:2px;background:var(--ok)}
.nar:not(.k-done):not(:last-child):after{background:var(--up);width:1px;left:15.5px}
.nar .si{width:24px;height:24px}
.nar.cur{background:light-dark(#f3f6fb, oklch(17.2% 0.007 260.7))}
.nar.cur .si{box-shadow:0 0 0 3px #f3f6fb,0 0 0 5px #b9cdf5}
.nar .si.num{background:light-dark(#fff, oklch(13% 0 89.9));box-shadow:inset 0 0 0 1.5px var(--up);color:var(--muted);font:600 11px Manrope,sans-serif}
.nar.cur .si.num{box-shadow:inset 0 0 0 1.5px var(--up),0 0 0 3px #f3f6fb,0 0 0 5px #b9cdf5}
.nar .nm{min-width:0;display:flex;align-items:center;gap:6px;color:var(--fg);font:500 13px/1.35 Manrope,sans-serif;text-decoration:none}
.nar .nm:hover span{color:var(--primary);text-decoration:underline}
.nar.cur .nm{font-weight:700}
.nar .ow{flex:none;display:inline-grid;place-items:center;width:16px;height:16px;color:var(--with)}
.nar .ow.You{color:var(--subtle)}.nar .ow svg{width:13px;height:13px}
.nar .ib{width:32px;height:32px;border:0;background:none;border-radius:7px;color:var(--muted);display:grid;place-items:center;cursor:pointer;padding:0}
.nar .ib:hover{background:var(--primary-light);color:var(--primary)}.nar .ib svg{width:15px;height:15px}
@media (max-width:999px){.nag{grid-template-columns:minmax(0,1fr)}}
@media (max-width:767px){.nah h1{font-size:19px}.nabd{padding:16px 14px 20px}.nakv{margin:16px 14px 0}.nakv div{grid-template-columns:minmax(0,1fr);gap:4px}.natab{height:44px}.nar .ib,.nabk{width:40px;height:40px}.nar{grid-template-columns:24px minmax(0,1fr) 40px 40px}.naf .btn{flex:1}}
.scol{display:flex;flex-direction:column;gap:16px;min-width:0}
.fchips{display:flex;gap:6px;margin-left:auto;flex-wrap:wrap}
.fch{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 8px;border-radius:5px;border:1px solid var(--border);background:light-dark(#fff, oklch(13% 0 89.9));font:500 11.5px var(--mono);color:var(--fg);cursor:pointer;white-space:nowrap}
.fch:hover{border-color:var(--primary);color:var(--primary)}
.fch svg{width:12px;height:12px;color:var(--subtle)}
.tabs{display:flex;gap:4px;padding:0 18px;border-bottom:1px solid var(--border)}
.tab{border:0;background:none;padding:8px 12px 10px;font:700 13px Manrope,sans-serif;color:var(--navy-ink,var(--navy));border-bottom:2px solid var(--navy);margin-bottom:-1px;cursor:pointer}
.pre{display:flex;align-items:center;gap:6px;padding:12px 18px 2px;font:500 11.5px var(--mono);color:var(--muted)}
.pre svg{width:12px;height:12px}
.kv{padding:4px 18px 8px}
.kvr{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.3fr);gap:16px;padding:12px 0;border-top:1px solid var(--hair);align-items:center}
.kvr:first-child{border-top:0}
.kvr .k{color:var(--muted);font-size:13px}
.kvr .k small{display:block;font-size:11.5px;color:var(--subtle)}
.kvr .v{font-size:13.5px;font-weight:600;color:var(--fg);overflow-wrap:anywhere;display:flex;align-items:center;gap:6px}
.kvr .v.no{color:var(--subtle);font-weight:500}
.kvr .v .si{width:18px;height:18px}.kvr .v .si svg{width:10px;height:10px}
.cbot{padding:6px 18px 4px}
.cft{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 18px;border-top:1px solid var(--border)}
.cft .t{display:flex;align-items:center;gap:8px;font-weight:600;color:var(--muted);flex:1;min-width:0}
.dreq{display:flex;align-items:center;gap:6px;padding:4px 18px 6px;font-size:12px;color:var(--muted)}
.dreq .si{width:16px;height:16px}.dreq .si svg{width:9px;height:9px}
.drop{margin:0 18px 10px;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;border:1.5px dashed #e7a463;background:var(--you-light);flex-wrap:wrap}
.drop.blue{border-color:#9bb5ee;background:light-dark(#f2f6fe, oklch(17.1% 0.01 264.5))}
.drop .ut{width:38px;height:38px;border-radius:50%;background:var(--you);color:#fff;display:grid;place-items:center;flex:none;border:0;cursor:pointer;padding:0}
.drop.blue .ut{background:var(--with)}
.drop .ut svg{width:17px;height:17px}
.drop .tx{flex:1;min-width:140px}
.drop b{display:flex;align-items:center;gap:4px;font-size:13.5px}
.drop .tx>span{font-size:12.5px;color:var(--you-text)}
.drop.blue .tx>span{color:var(--with-text)}
.drop .tx>span button{border:0;background:none;padding:0;font:700 12.5px Manrope,sans-serif;color:inherit;text-decoration:underline;cursor:pointer}
.drop .mono{font-size:11.5px;color:var(--subtle)}
.file{margin:0 18px 10px;display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:light-dark(#fff, oklch(13% 0 89.9));flex-wrap:wrap}
.file .ft{width:36px;height:36px;border-radius:7px;display:grid;place-items:center;font:700 11px var(--mono);flex:none}
.file .ft.pdf{background:light-dark(#fdecec, oklch(24.6% 0.054 17.5));color:#c0392b}.file .ft.xlsx{background:light-dark(#e6f4ee, oklch(19.7% 0.01 168.5));color:var(--ok-text)}.file .ft.docx{background:light-dark(#e9effc, oklch(24.9% 0.055 266));color:var(--with)}
.file .tx{flex:1;min-width:120px}
.file b{display:block;font-size:13.5px}
.file small{display:block;font:500 11.5px var(--mono);color:var(--subtle);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.file .acts{display:flex;align-items:center;gap:8px;margin-left:auto}
.tlst{padding:2px 18px 14px}
.te{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:12px;position:relative;padding:8px 0}
.te:before{content:"";position:absolute;left:10px;top:30px;bottom:-8px;width:2px;background:var(--hair)}
.te:last-child:before{display:none}
.te.ok:before{background:light-dark(#bfe3d4, oklch(28.9% 0.113 168.2))}
.te b{display:block;font-size:13px;font-weight:700}
.te small{display:block;font-size:11.5px;color:var(--muted)}
.te .dt{font:500 11.5px var(--mono);color:var(--muted);white-space:nowrap}
/* journey rail (focus track) */
.rail{padding:14px 14px 12px}
.rail .ch{padding:0 4px 10px}
.rl{display:flex;flex-direction:column}
.rr{display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:10px;align-items:start;padding:8px 6px;border-radius:8px;position:relative;color:var(--fg);text-decoration:none;font-weight:500}
a.rr:hover{background:var(--raised)}
.rr .si{margin-top:1px}
.rr:after{content:"";position:absolute;left:17px;top:32px;bottom:-8px;width:0;border-left:2px dotted light-dark(#cfd6e2, oklch(27% 0.012 261.3))}
.rr.ok:after{border-left:2px solid var(--ok)}
.rr.last:after{display:none}
.rr b{display:block;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rr small{display:block;font-size:11.5px;color:var(--muted)}
.dots{display:flex;gap:3px;margin-top:3px}
.dots i{width:6px;height:6px;border-radius:50%;box-shadow:inset 0 0 0 1.5px #b8c2d0}
.dots i.on{background:var(--ok);box-shadow:none}.dots i.cu{background:var(--with);box-shadow:none}
.rh{position:relative;margin:4px -6px;background:var(--navy);color:#fff;border-radius:12px;padding:12px 14px 12px;box-shadow:0 0 0 4px #f3e7c6,0 14px 30px -14px rgba(15,42,74,.8);z-index:1}
.rh .k{font:700 11px var(--mono);letter-spacing:.06em;color:var(--gold-2);text-transform:uppercase}
.rh .hh{display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:10px;align-items:start}
.rh b{display:block;font:700 14.5px Manrope,sans-serif;line-height:1.3}
.rh small{display:block;font-size:12px;color:rgba(255,255,255,.8)}
.rh .wq{width:30px;height:30px;border-radius:7px;border:0;background:light-dark(#fff, oklch(13% 0 89.9));color:var(--navy-ink,var(--navy));display:grid;place-items:center;cursor:pointer;padding:0}
.rh .wq svg{width:15px;height:15px}
.subt{display:flex;align-items:flex-start;margin:12px 0 0}
.subt .sb{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;position:relative;min-width:0}
.subt .sb:before{content:"";position:absolute;top:5px;left:-50%;right:50%;height:2px;background:rgba(255,255,255,.25)}
.subt .sb.on:before{background:#2fd3a0}
.subt .sb:first-child:before{display:none}
.subt .sb i{width:12px;height:12px;border-radius:50%;background:rgba(255,255,255,.3);position:relative;z-index:1}
.subt .sb.on i{background:#2fd3a0}.subt .sb.cu i{background:var(--gold-2);box-shadow:0 0 0 3px rgba(230,196,110,.3)}
.subt .sb span{font-size:11px;color:rgba(255,255,255,.82);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.subn{margin-top:8px;font:500 11.5px var(--mono);color:rgba(255,255,255,.75)}
.rmore{margin:6px 0 0;width:100%}
/* needed from Northwind */
.need{padding:14px 18px 10px}
.need .ch{padding:0 0 8px}
.nr{display:grid;grid-template-columns:20px minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--hair);cursor:pointer}
.nr:first-of-type{border-top:0}
.nr input{appearance:none;-webkit-appearance:none;width:18px;height:18px;border-radius:4px;border:2px solid var(--you);margin:0;cursor:pointer;display:grid;place-items:center;background:light-dark(#fff, oklch(13% 0 89.9))}
.nr input:checked{background:var(--ok);border-color:var(--ok)}
.nr input:checked:after{content:"";width:5px;height:9px;border:solid light-dark(#fff, oklch(22% 0 89.9));border-width:0 2px 2px 0;transform:rotate(45deg) translate(-1px,-1px)}
.nr span{font-size:13px;font-weight:600}
.nr input:checked+span{text-decoration:line-through;color:var(--muted)}
.nr .dt{font:500 11.5px var(--mono);color:var(--muted)}
.team{padding:14px 18px 14px}
.team .ch{padding:0 0 8px}
.pr{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:10px;align-items:center;padding:7px 0}
.av{width:36px;height:36px;border-radius:50%;background:var(--navy);color:#fff;display:grid;place-items:center;font:700 12px Manrope,sans-serif}
.pr b{display:block;font-size:13px}.pr small{display:block;font-size:11.5px;color:var(--muted)}
/* action bar */
.act{position:sticky;bottom:0;z-index:30;margin:calc(4px + var(--vp-launch-h,64px)) calc(-1 * clamp(14px,2.2vw,24px)) -120px;padding:12px clamp(14px,2.2vw,24px) 14px;background:light-dark(rgba(255,255,255,.96), oklch(13% 0 89.9 / 0.96));backdrop-filter:blur(6px);border-top:1px solid var(--border);box-shadow:0 -10px 30px -20px rgba(15,27,45,.4)}
.act .in{max-width:1600px;margin-inline:auto;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.act .st{display:flex;align-items:center;gap:10px;flex:1 1 220px;min-width:0}
.act .st b{display:block;font-size:13.5px}
.act .st .tr{display:block;width:200px;max-width:100%;height:4px;border-radius:99px;background:var(--hair);margin-top:5px;overflow:hidden}
.act .st .tr i{display:block;height:100%;background:var(--primary-fill,var(--primary));border-radius:99px}
.act .bs{display:flex;gap:10px;flex-wrap:wrap}
.has-act #vp-launch{bottom:var(--acth,68px)!important}
.has-act #vp-mini{bottom:calc(var(--acth,68px) + 12px)!important}
.pn{display:none;justify-content:space-between;gap:8px}
.pn .btn{min-width:0;flex:1}
.pn .btn span{overflow:hidden;text-overflow:ellipsis}
/* phase page */
.psum{padding:16px 18px;display:flex;flex-direction:column;gap:12px}
.psum .bw{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.psum .gbar{position:relative;flex:1 1 260px;top:auto;margin-top:0;height:12px}
.psum .glab{position:static;transform:none;flex-wrap:wrap;white-space:normal}
.kd{display:flex;flex-wrap:wrap;gap:8px}
.kd span{background:var(--raised);border-radius:6px;padding:4px 10px;font-size:12px;color:var(--muted)}
.kd b{color:var(--fg)}
.kd a{font-weight:700}
.obar{display:flex;gap:2px;height:12px;border-radius:99px;overflow:hidden;margin:4px 0 8px;background:var(--raised)}
.obar button{border:0;padding:0;cursor:pointer;min-width:8px}
.obar button:hover{filter:brightness(1.1)}
/* board resolution */
.brg{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:16px;align-items:start}
.prv{background:var(--raised);overflow:hidden}
.prv .ch{background:light-dark(#fff, oklch(13% 0 89.9));border-bottom:1px solid var(--border);border-radius:12px 12px 0 0;padding:12px 18px}
.pvw{overflow:auto;padding:20px 16px 24px;display:flex;justify-content:center}
.paper{width:440px;max-width:100%;flex:none;background:light-dark(#fff, oklch(13% 0 89.9));box-shadow:0 10px 30px -12px rgba(15,27,45,.35);padding:34px 38px 30px;font:12px/1.6 Georgia,"Times New Roman",serif;color:light-dark(#1d1d1d, oklch(90.8% 0 89.9));transform-origin:top center;transition:transform .2s}
.paper .t{text-align:center;font-weight:700;font-size:12px;margin-bottom:16px}
.paper .ln{height:7px;border-radius:2px;background:light-dark(#e4e7ec, oklch(23.9% 0.007 260.7));margin:7px 0}
.paper h4{margin:16px 0 6px;font:700 12px Georgia,serif}
.paper .sig{margin-top:34px;display:flex;justify-content:space-between;align-items:flex-end;gap:12px}
.paper .sg{width:130px;border-bottom:1px solid #333;font:italic 22px/1.2 "Brush Script MT","Segoe Script",cursive;color:light-dark(#1b3a7a, oklch(85.4% 0.081 262.7))}
.paper .sgl{font-size:11px;margin-top:4px}
.paper .stamp{width:64px;height:64px;border-radius:50%;border:2px solid #4b6fd6;color:light-dark(#3557c0, oklch(80.3% 0.119 266.6));display:grid;place-items:center;text-align:center;font:700 11px/1.15 Manrope,sans-serif;transform:rotate(-12deg);flex:none}
.files{padding-bottom:8px}
/* pop-overs, tooltips, brief */
#ip-brief-scrim{position:fixed;inset:0;z-index:2147482700;background:rgba(10,22,40,.32);opacity:0;transition:opacity .18s;display:flex;justify-content:flex-end}
#ip-brief-scrim.on{opacity:1}
#ip-brief{width:min(420px,100%);height:100%;max-height:100dvh;background:light-dark(#fff, oklch(13% 0 89.9));box-shadow:-24px 0 60px -24px rgba(8,20,40,.5);display:flex;flex-direction:column;transform:translateX(28px);transition:transform .26s cubic-bezier(.22,1,.36,1);font:500 13px/1.45 Manrope,system-ui,sans-serif;color:var(--fg)}
#ip-brief-scrim.on #ip-brief{transform:none}
#ip-brief .bh{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border)}
#ip-brief .bh b{display:block;font:800 15px Manrope,sans-serif;color:var(--navy-ink,var(--navy))}
#ip-brief .bh small{display:block;font-size:12px;color:var(--muted)}
#ip-brief .bb{flex:1;min-height:0;overflow:auto;padding:12px 16px 16px}
#ip-brief .hl{margin:4px 0 6px;padding:10px 12px;border-radius:8px;background:var(--raised);font-size:13px;display:block}
#ip-brief .sub-h{font:800 11px Manrope,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:var(--subtle);margin:14px 0 4px}
#ip-brief .bp{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px;margin:0 -8px;border-radius:8px;color:var(--fg);font-weight:600}
#ip-brief .bp:hover{background:var(--raised)}
#ip-brief .bp small{display:block;font:500 11.5px var(--mono);color:var(--muted)}
#ip-brief .mini{display:block;height:5px;border-radius:99px;background:var(--raised);overflow:hidden;margin-top:5px;box-shadow:inset 0 0 0 1px var(--hair)}
#ip-brief .mini i{display:block;height:100%;background:var(--ok)}
#ip-brief .bf{display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--border);background:var(--raised);justify-content:flex-end;flex-wrap:wrap}
.ip-pop{position:absolute;z-index:2147482600;width:290px;max-width:calc(100vw - 24px);background:light-dark(#fff, oklch(13% 0 89.9));border:1px solid var(--border);border-radius:10px;box-shadow:0 18px 40px -16px rgba(8,20,40,.45);padding:12px;font:500 12.5px/1.5 Manrope,system-ui,sans-serif;color:var(--fg)}
.ip-pop p{margin:0}
.ip-pop button{margin-top:10px;width:100%;display:flex;align-items:center;gap:8px;border:0;border-top:1px solid var(--hair);background:none;padding:10px 0 0;font:700 12.5px Manrope,sans-serif;color:var(--primary);cursor:pointer;text-align:left}
#ip-tt{position:fixed;z-index:2147483002;pointer-events:none;background:#0f2a4a;color:#fff;font:600 12px/1.35 Manrope,system-ui,sans-serif;padding:6px 9px;border-radius:6px;white-space:nowrap;max-width:calc(100vw - 16px);overflow:hidden;text-overflow:ellipsis;opacity:0;transform:translateY(3px);transition:opacity .12s,transform .12s;left:0;top:0;box-shadow:0 8px 20px -10px rgba(8,20,40,.6)}
#ip-tt.on{opacity:1;transform:none}
::-webkit-scrollbar{display:none}html{scrollbar-width:none}
/* ---------- tablet ---------- */
@media (max-width:1279px){
  .search{width:40px;padding:0;justify-content:center;gap:0}.search .k,.search .st{display:none}.search svg{width:16px;height:16px}
}
@media (max-width:999px){
  .sgrid{grid-template-columns:minmax(0,1fr)}
  .brg{grid-template-columns:minmax(0,1fr)}
  .scol.side2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));align-items:start}
}
/* ---------- phone ---------- */
@media (max-width:767px){
  .top{height:56px;padding:0 6px;gap:4px}
  .search,.tb.hide-m,.crumb a,.crumb .sl{display:none}
  .tb.srch{display:grid}
  .menu{display:grid;width:40px;height:40px}
  .tb{width:40px;height:40px}
  .top .sbc{height:24px}
  .crumb b{font-size:14.5px;font-weight:700;color:var(--navy-ink,var(--navy))}
  main{padding:14px 12px 120px}
  .wrap{gap:14px}
  .hero{padding:14px 14px 16px}
  .hl{flex-basis:100%;align-items:flex-start;gap:10px}
  .hback{margin-top:18px;width:40px;height:40px}
  .hr{margin-left:0;width:100%}
  .hr .ring,.hr>.si{margin-left:auto}
  .hbtn .lt{display:none}
  .hbtn{height:40px;min-width:40px;justify-content:center;padding:0 10px}
  .wt{height:36px}
  .ch{padding:14px 14px 8px}
  .phc .ch{padding:14px 14px 6px}
  .phh{padding:12px 14px}
  .phb{padding:0 8px 10px}
  .ob{min-height:40px}
  .week{padding:14px 14px 10px}
  .wbot{margin-left:0;flex-basis:100%}
  .wr{min-height:40px}
  .dc{padding:14px}
  .lg{min-height:36px}
  .kvr{grid-template-columns:minmax(0,1fr);gap:2px;padding:10px 0}
  .kv,.tlst,.pre,.cbot,.dreq,.cft{padding-left:14px;padding-right:14px}
  .drop,.file{margin-left:14px;margin-right:14px}
  .tabs{padding:0 14px}
  .lc{flex-direction:column;align-items:stretch}
  .lc .cn{width:2px;height:14px;min-width:0;flex:none;margin:2px 0 2px 13px;align-self:flex-start}
  .lc .cn.dot{width:0;height:14px;border-top:0;border-left:2px dotted light-dark(#c9d1dc, oklch(27.7% 0.012 256.3))}
  .stg{flex-direction:row;align-items:center;text-align:left;gap:10px}
  .now{max-width:none}
  .trk{padding:16px 14px}
  .hnav{display:none}
  .pn{display:flex}
  .act{margin:calc(4px + var(--vp-launch-h,64px)) -12px -120px;padding:10px 12px 12px}
  .act .bs{width:100%}
  .act .bs .btn{flex:1;min-width:0;padding:0 10px;height:40px}
  .act .bs .btn svg{display:none}
  .rail{padding:14px 10px 10px}
  .rr{min-height:44px}
  .paper{padding:24px 20px;font-size:11.5px}
  .paper .t{font-size:11.5px}
  .sq{width:40px;height:40px}
  .lkb{width:40px;height:40px}
  .fch{height:32px}
  .nr{min-height:40px}
  .ibtn,.gbar,.coi .chip.risk,.drop .tx>span button,.pnm a{position:relative}
  .ibtn:after,.coi .chip.risk:after,.drop .tx>span button:after{content:"";position:absolute;inset:-9px}
  .phc .gbar:after{content:"";position:absolute;left:0;right:0;top:-15px;bottom:-15px}
  .pnm a:after{content:"";position:absolute;left:0;right:0;top:-10px;bottom:-10px}
  .lg{min-height:40px}.pill{min-height:42px}.fch{height:36px}.drop .ut{width:40px;height:40px}.tab{min-height:40px}
  #ip-brief-scrim{align-items:flex-end}
  #ip-brief{height:auto;max-height:88dvh;border-radius:14px 14px 0 0;transform:translateY(28px)}
}
@media (max-width:370px){
  .top .sbc{height:20px}
}
@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}
/* the five step statuses share one width so they line up down the table */
.chip.done,.chip.you,.chip.prog,.chip.with,.chip.up{min-width:116px;justify-content:center}
.own{min-width:88px}
```

### 6.2 Landing-only overrides — rules in `incorporation.html` that replace the phase/step/board rules (verbatim diff, `-` = phase/step/board, `+` = landing)

```diff
+.coi .tr1{margin-left:auto;display:flex;align-items:center;gap:12px}
+.coi .tr1 .chip{margin:0}
+.coi .ring .rw,.coi .ring svg{width:46px;height:46px}
-.phc{padding-bottom:6px}
+.phc{padding-bottom:22px}
-.gax,.phh{display:grid;grid-template-columns:minmax(150px,230px) minmax(0,1fr) auto;gap:14px;align-items:center}
+.gax,.phh{display:grid;grid-template-columns:72px minmax(120px,180px) minmax(0,1fr) 84px;gap:14px;align-items:center}
-.pnm a{display:block;font:700 14px Manrope,sans-serif;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
-.pnm a:hover{color:var(--primary);text-decoration:underline}
+.pnm .tx{display:block;font:700 14px Manrope,sans-serif;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
-.gbar{position:absolute;top:50%;height:11px;margin-top:-5.5px;border-radius:99px;overflow:visible;border:0;padding:0;cursor:pointer;background:var(--raised);display:block}
-.gbar .in{position:absolute;inset:0;border-radius:99px;overflow:hidden;display:block}
+.phr:last-of-type:not(.open) .today:after{content:"Today";position:absolute;top:100%;left:50%;transform:translateX(-50%);background:var(--over);color:#fff;font:700 10.5px/1.5 Manrope,sans-serif;padding:0 6px;border-radius:4px;white-space:nowrap}
+.gbar{position:absolute;top:50%;height:20px;margin-top:-10px;border-radius:5px;overflow:visible;border:0;padding:0;cursor:pointer;background:var(--raised);display:block}
+.gbar .in{position:absolute;inset:0;border-radius:5px;overflow:hidden;display:block}
+.gbar .nw{position:absolute;top:0;bottom:0;display:flex;align-items:center;font:600 11px Manrope,sans-serif;color:var(--with-text);white-space:nowrap;pointer-events:none}
-.gbar.s-active{background:light-dark(#fff, oklch(13% 0 89.9));box-shadow:inset 0 0 0 1.5px var(--navy)}
+.gbar.s-active{background:var(--with-light);box-shadow:inset 0 0 0 1.5px var(--navy)}
-.gbar .ms{position:absolute;right:-8px;top:50%;width:14px;height:14px;margin-top:-7px;background:var(--gold);transform:rotate(45deg);border-radius:2px;box-shadow:0 0 0 2px light-dark(#fff, oklch(13% 0.006 260));display:block}
+.gbar .ms{position:absolute;right:-9px;top:50%;width:16px;height:16px;margin-top:-8px;background:var(--gold);transform:rotate(45deg);border-radius:2px;box-shadow:0 0 0 2px light-dark(#fff, oklch(13% 0.006 260));display:block}
-.ob svg{transition:transform .2s}
-.phr.open .ob{background:var(--navy);border-color:var(--navy);color:#fff}
-.phr.open .ob svg{transform:rotate(180deg)}
+.ob svg{width:14px;height:14px}
+.stb{width:72px;padding:0 8px;gap:4px}
+.stb svg{width:14px;height:14px;transition:transform .2s}
+.phr.open .stb{background:var(--navy);border-color:var(--navy);color:#fff}
+.phr.open .stb svg{transform:rotate(90deg)}
-.phc.simple .phh{grid-template-columns:minmax(0,1fr) auto;row-gap:8px}
+.phc.simple .phh{grid-template-columns:auto minmax(0,1fr) auto;row-gap:8px}
-.sth,.str{display:grid;grid-template-columns:22px 26px minmax(0,1fr) 88px 128px 112px 34px 32px 32px;gap:8px;align-items:center}
+.sth,.str{display:grid;grid-template-columns:22px 26px minmax(0,1fr) 88px 128px 112px 112px 76px;gap:8px;align-items:center}
-.str .lkc{display:flex;justify-content:center}
+.str .lkc{display:flex;justify-content:flex-end;align-items:center;gap:6px}
+.prf{display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 8px;border-radius:6px;border:1px solid var(--border);background:light-dark(#fff, oklch(13% 0 89.9));color:var(--muted);font:600 11.5px Manrope,sans-serif;cursor:pointer;white-space:nowrap}
+.prf:hover{background:var(--primary-light);color:var(--primary)}
+.prf svg{width:12px;height:12px}
+.str .so{height:28px;padding:0 10px;gap:5px;font-size:12.5px}
+.str .so svg{width:13px;height:13px}
+.chip.next{background:light-dark(#eef1f5, oklch(19.4% 0.006 255.5));color:var(--fg);box-shadow:inset 0 0 0 1px var(--up)}
-  .sth,.str{grid-template-columns:22px 24px minmax(0,1fr) 88px 128px 32px 32px}
+  .sth,.str{grid-template-columns:22px 24px minmax(0,1fr) 88px 128px 76px}
-  .str{grid-template-columns:22px 22px minmax(0,1fr) 40px 40px;padding:6px 6px}
+  .str{grid-template-columns:22px 22px minmax(0,1fr) 76px;padding:6px 6px}
-  .str .sq{width:40px;height:40px}
+  .str .so{height:40px}
-  .ob{min-height:40px}
+  .ob,.stb{min-height:40px}
-  .ibtn,.gbar,.coi .chip.risk,.drop .tx>span button,.pnm a{position:relative}
+  .ibtn,.gbar,.coi .chip.risk,.drop .tx>span button{position:relative}
-  .pnm a:after{content:"";position:absolute;left:0;right:0;top:-10px;bottom:-10px}
```

### 6.3 Page markup shell (`step.html` body before the script, verbatim)

```html
<body>
<div class="side" data-vp="side" aria-hidden="true"></div>
<header class="top">
  <button class="tb menu" type="button" aria-label="Open menu" data-vp-menu><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
  <img class="sbc" src="vcfo-bin:b/6e69009086da4b463a19d1d632abaa20.png" alt="SBC">
  <nav class="crumb" aria-label="Breadcrumb"><a href="#" data-go="home">Home</a><span class="sl">/</span><a href="#" data-go="incorporation">Incorporation</a><span class="sl">/</span><b id="crB">Step</b></nav>
  <span class="sp"></span>
  <div class="search" role="button" tabindex="0" aria-label="Search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M16 16l4 4"/></svg><span class="st">Search</span><span class="k"><span>⌘</span><span>K</span></span></div>
  <button class="tb srch" type="button" aria-label="Search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M16 16l4 4"/></svg></button>
  <button class="tb hide-m" type="button" aria-label="Announcements" data-go="announcements"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10h3l8-4.5v13L7 14H4Z M7 14l1.5 5.5H11L10 14 M18 9.5a3.5 3.5 0 0 1 0 5"/></svg></button>
  <button class="tb" type="button" aria-label="Notifications, 3 new" data-go="notifications" style="background:var(--primary-light);color:var(--primary)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 5 2 6.5 2 6.5h-15s2-1.5 2-6.5 M10 19.5a2 2 0 0 0 4 0"/></svg><span class="n">3</span></button>
  <button class="tb b hide-m" type="button" aria-label="Switch theme"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg></button>
</header>
<main id="main"></main>
<script src="../../routes.js"></script>
<script src="../../proto.js"></script>
<script>
```

### 6.4 L1 skeleton reference (`final-src/s/home/mobile.html` l.171–177, verbatim)

```css
/* skeleton (L1) */
.sk .card,.sk .greet{position:relative}
.sk .card>*,.sk .greet>*{visibility:hidden}
.sk .card:after,.sk .greet:after{content:"";position:absolute;inset:12px;border-radius:6px;background:linear-gradient(90deg,light-dark(oklch(93.5% .008 255), oklch(22.8% 0.008 255)) 0,light-dark(oklch(96.5% .006 255), oklch(18.3% 0.006 255)) 40%,light-dark(oklch(93.5% .008 255), oklch(22.8% 0.008 255)) 80%);background-size:600px 100%;animation:sh 1.2s linear infinite}
.sk .greet:after{background:linear-gradient(90deg,oklch(30% .05 258) 0,oklch(36% .05 258) 40%,oklch(30% .05 258) 80%);background-size:600px 100%}
@keyframes sh{0%{background-position:-300px 0}100%{background-position:300px 0}}
/* enter stagger */
.wrap>*{animation:fu .3s cubic-bezier(.22,1,.36,1) both}
.sk .wrap>*{animation:none}
@keyframes fu{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
```

Boot: `render(); setTimeout(function(){ $("#app").classList.remove("sk"); requestAnimationFrame(function(){ countUp(); setTimeout(drawIn,60); }); }, RM?0:450);` (the prototype simply holds 450 ms; the build rule is: show after 150 ms, hold ≥300 ms).

### 6.5 Drill pop-up, toast and tooltip CSS (proto.js, verbatim)

```js
    '#vp-mini{position:fixed;left:14px;bottom:14px;z-index:2147483000;border:0;border-radius:8px;background:#0f2a4a;color:#c9a24b;font:800 11px Manrope,sans-serif;letter-spacing:.08em;padding:8px 10px;cursor:pointer;box-shadow:0 8px 20px -8px rgba(8,20,40,.5)}',
    '#vp-toast{position:fixed;left:50%;bottom:64px;transform:translate(-50%,12px);opacity:0;z-index:2147483001;display:flex;align-items:center;gap:12px;max-width:min(560px,calc(100vw - 32px));padding:10px 12px 10px 14px;border-radius:8px;background:#0f2a4a;color:#fff;font:600 13px Manrope,sans-serif;box-shadow:0 18px 40px -14px rgba(8,20,40,.6);transition:opacity .18s,transform .22s cubic-bezier(.22,1,.36,1);pointer-events:none}',
    '#vp-toast.on{opacity:1;transform:translate(-50%,0);pointer-events:auto}',
    '#vp-toast button{border:0;background:rgba(255,255,255,.14);color:#e6c46e;font:700 12px Manrope,sans-serif;height:28px;padding:0 10px;border-radius:6px;cursor:pointer}',
    '#vp-tip{position:fixed;z-index:2147483002;pointer-events:none;background:#0f2a4a;color:#fff;font:700 12px/1.3 Manrope,sans-serif;padding:5px 9px;border-radius:6px;white-space:nowrap;opacity:0;transform:translateY(3px);transition:opacity .12s,transform .12s}',
    '#vp-tip.on{opacity:1;transform:none}',
    'html.vp-enter body{animation:vpIn .26s cubic-bezier(.22,1,.36,1) both}',
    /* no visible scrollbars anywhere; scrolling still works (item 11) */
    'html,body,*{scrollbar-width:none!important}',
```
