# Brief for Claude Design: VCFO Suite design system, v1

Paste the text below into the Claude Design chat with the "VCFO Suite" design system open.
Attach these five files from `docs/design/` first: `design-tokens.json`, `TOKENS.md`,
`COMPONENTS.md`, `vcfo-design-system.html`, `AUDIT.md`.

---

You are revising the design system called "VCFO Suite", the one open now. It describes a product that already exists and is being redesigned. The system has two jobs, in this order. First, it lets me assemble the redesign prototype in Design canvases quickly and consistently. Second, it guides the refactor of the live codebase, screen by screen, once the prototype is approved. Every decision below serves one of those two jobs.

## Context

VCFO Suite is a compliance and incorporation cockpit for an Indian professional-services firm, SBC. It runs company incorporation (a client questionnaire, the 34-step SPICe+ checklist, generated MCA documents, board resolutions) and the recurring compliance calendar. Five roles share one app: super admin, admin, manager, intern (project lead) and client. Staff share one shell with a navy sidebar; clients get their own portal shell. The code is Next.js with Tailwind and shadcn-style components at github.com/abdulfarhath7/vcfo_suite. The screens are dense, the numbers matter, and the people reading them are checking whether something is late. The system is therefore quiet: cool neutrals, navy ink, one action blue, one orange highlight that means "this needs you", four status colours that always come with a word, and six chart hues that never leave the charts.

## What exists, and what is wrong with it

The current "VCFO Suite" system was synced on 6 October 2026 from main@723829e. That is the codebase before the redesign. Its tokens.json holds 165 colours and three fonts (Manrope, Space Grotesk, IBM Plex Mono). Its README describes categorical accent colours assigned by hash, five phase hues, eight statutory-act hues, a coral warning, pill chips, layered shadows and a gradient page atmosphere. Every one of those is now deprecated. No components were built; only the Cover and the Logos group exist.

Treat this as a revision, not a rebuild. Keep the Logos assets and the index. Replace the tokens whole, rewrite the README, and build the component library. Do not sync from GitHub in this pass: the redesign lives on a branch that is not pushed yet, so GitHub still carries the old values. The attached files are the source.

## Sources of truth, in order of precedence

1. `design-tokens.json`. This becomes tokens.json as it is. It is already in this system's shape: color.themes, color.tokens with a light value, a dark value and a usage note each, type.fonts, type.families, type.groups, spacing, radius, size, shadow and borderWidth. It holds 37 colour tokens, 13 type styles, 8 spacing steps, 5 radii, 11 sizes, 2 shadows and 3 border widths. Do not add, rename or re-tint anything in it. If a value cannot be loaded, say which and why; do not substitute.
2. `TOKENS.md`. The decisions behind the values, the contrast table (every pair passes; keep it that way in your previews), the type scale, the control and chip rules, and the full table of deprecated names with their replacements. Every deprecated name is removed on 30 November 2026.
3. `COMPONENTS.md`. The component inventory: for each pattern, the one component that owns it in code, what it replaces, the callers still to migrate, and the rules the owners enforce. This is the list you build.
4. `vcfo-design-system.html`. A rendered book of the same system, drawn from the tokens, with a theme toggle. Lift preview markup from it rather than inventing a second rendering. Where it and TOKENS.md disagree, TOKENS.md wins.
5. `AUDIT.md`. Why the old system failed. Read it once for the reasoning; nothing in it is a target.

Where any source conflicts with a decision below, the decision wins, and you say so in your report.

## Decisions already made. Do not reopen them.

- One action colour, `brand` (#1b4f94 light, #6aa2e8 dark). Navy `ink` for text, the sidebar and the hero. Never two blues on one surface.
- One orange, `highlight`, text-safe, for "this needs you" on chips and small marks. One orange moment per screen region. Never an orange button. `highlight-bright` only on marks that carry no small text.
- Four statuses (`positive`, `warning`, `danger`, `info`), each with a `-soft` ground, always paired with a word. Warning is amber, not orange. Info is teal.
- Identity never gets a colour. Companies, people, tags, nav items and phases are neutral; state carries the colour (`brand` current, `positive` done, `warning` waiting, `ink-faint` locked).
- `data-1` to `data-6` are for charts and the statutory calendar only, in fixed order, never cycled through chips or avatars.
- Public Sans at weights 400, 500 and 600 for everything. IBM Plex Mono for identifiers (CIN, DIN, PAN, GSTIN, file names). No 700 or 800; weight is replaced by size and colour. No Manrope, no Space Grotesk.
- Radius scale 6, 8, 10, 12. Chips and avatars are rounded rectangles. Pills survive only as toggle knobs and progress rings.
- Borders before shadows. Every card has a `line` hairline; `shadow-card` only lifts; `shadow-float` only on popovers, dialogs and sheets. No gradients, no coloured left borders, no cards inside cards, no blur.
- Controls: buttons 28, 32 or 40px tall and at least 84px wide; chips 22px tall and 88px wide inside a table column; rows 40px; icon tiles 32px. Buttons in one row share one height; chips or buttons in one column share one width. Labels are two words at most and never wrap.
- The logo keeps its own colours. They are never UI tokens.

## Deliverables, in this order

### 1. Read-back and plan. Stop here.

Read the current system's index, README and tokens.json, then the five attached files. Report in one message: what you will remove, what you will replace, and the full component inventory you intend to build, as a table with the columns name, tier, code owner, preview source, status. Flag any token the format cannot load and any component whose source is thin. Wait for my go-ahead before writing anything.

### 2. Foundations. Stop here.

Replace tokens.json with the attached file, adding only a `meta` block that records the source as the attached files from branch design/design-system on today's date. Rewrite README.md as a brand book for a consuming agent: imperative sentences that name tokens, styles and assets. Cover, in this order: content fundamentals (tone, casing, the fixed status vocabulary, Indian formats for money, dates and identifiers), colour (grounds, text, action, highlight, status, charts, sidebar, focus ring and scrim), type, spacing and layout, shape and depth, states and motion, iconography (Lucide at 14, 16 and 20px), logo use, and a "Build a screen" section that gives the page skeleton, the order of sections, the rows-and-lists rule and the "Never" list from COMPONENTS.md. No provenance or build notes in the README; those go in your reply. Add `DEPRECATED.md` as a section holding the two deprecation tables from TOKENS.md verbatim, with the removal date.

### 3. Component library

Build every component in the approved inventory, in tiers, each with a README and a live preview. Name a component after the pattern as COMPONENTS.md names it; where the code export differs (the chip is `Badge` in code), record the export in the code map, not in the name. Previews are hand-written HTML and CSS that read only the system's tokens; each README states "hand-written from vcfo-design-system.html" or "hand-written from COMPONENTS.md". Where a bundle is possible, expose the components as `window.VcfoSuite.<Name>` so canvases can call them; if it is not, say so and keep the previews static.

Starting inventory, to reconcile against COMPONENTS.md before you build:

- Primitives: Button (variants default, secondary, outline, ghost, destructive, link; sizes sm, default, lg, icon), Chip (status, owner and count variants; an in-column variant at 88px), IconChip (neutral tile; a status tone only when the tile means that status), Input, Textarea, Select, Checkbox, RadioGroup, Switch, Field (label, helper text, error), Tooltip, Skeleton, Avatar (8px corners, initials, neutral).
- Composites: DashSection, StatCard (3px `stat-rule` top edge in its tone, optional six-bar trend), DashHero, DataTable (uppercase `label` heads on `surface-sunken`, 40px rows, right-aligned `figure` amounts, chips in columns, row actions, empty and loading states), ListRow (hairline rows inside a card), Callout (an alert with an info IconChip on `info-soft`), ProgressSegments, DashDonut with DashLegendRow, Tabs, Dialog, Sheet, DropdownMenu, Popover, Toast, PageHeader (back cluster, title in `display`, 2px `rule`, actions), EmptyState (inline, full page, illustrated), StepRow (one checklist step: title, owner chip, status chip, due date, action), DocumentRow, ActivityRow (audit log), MessageBubble (Ask VCFO).
- Shell and templates: AppShell (navy sidebar, white top bar, mobile sheet), RoleSidebar, TopBar, ClientPortalShell; templates Dashboard (the lead Today screen is the reference), ClientHome, ListPage (filters above a DataTable), DetailPage (content beside a 318px side rail), WizardStep, CalendarPage, SettingsPage, Login, AskVcfoPanel.

Every component README follows one contract: a summary sentence; when to use it and when not; anatomy; variants and sizes; states (default, hover, focus-visible, active, selected, disabled, loading, invalid, empty); content rules; token bindings for ground, text, border, radius and height; behaviour at 1440, 1024 and 390px; accessibility (role, name, focus order, the contrast pairs it relies on, a 40px hit area on a phone); what the consumer supplies; do and don't.

Previews show the main variants in both themes with real domain data: company names, a CIN such as U72900KA2024PTC123456, a PAN such as ABCDE1234F, a GSTIN, amounts in Indian grouping (₹9,05,178 in full; ₹24.6 L only on dense tiles), dates such as 24 Oct 2026, the fixed status words (done, filed, paid; due soon, waiting, needs review; overdue, failed; in progress; upcoming), the statutory acts (GST, Income Tax, MCA, FEMA, STPI, Labour, Other) and the five phases (Pre-incorporation, Filing, Post-incorporation, FEMA, Registrations).

### 4. Code map, for the refactor

Add `CODE-MAP.md` as a section. One row per component: system name; repo file and export; the prop and variant names as they exist in code (Button and Badge variants come from `button-variants.ts` and `badge-variants.ts`, chip classes from `CHIP_CLASS`, `TONE_BADGE` and `CHIP_COLUMN_CLASS` in `IconChip.tsx`); the components it replaces; the callers still to migrate, taken from COMPONENTS.md. Then a token map: each token to its CSS variable and to the Tailwind utility the repo exposes for it (`bg-surface-raised`, `text-ink-muted`, `border-line-strong`, `bg-brand-soft`, `h-control-md`, `min-w-chip` and so on). Then the deprecated-to-new table again, grouped by file: `app/globals.css`, `tailwind.config.ts`, and the client portal's `css-src/00-tokens.css`. A coding agent reads this section before touching a screen, so it must be exact.

### 5. Cover, verification, report

Write the Cover last. Then verify: every text token reads at 4.5:1 on each ground its usage note names, in both themes, inside the previews and not only in the table; `line-strong`, `focus-ring` and `highlight-bright` reach 3:1; no preview uses a hex literal, a gradient, a coloured left border, a pill or a weight above 600; every button is at least 84px wide; every chip carries a word. Report in one message: the link; the inventory table with a final status per row; tokens.json before and after (counts of colours, fonts and styles); the assumptions you made; the decisions I should check; and exactly what remains, if anything. Never end silently incomplete.

## Working method

- Exact values from the sources. The token file and the code beat any screenshot or library default. Never invent a token, a colour, a size or a component.
- The source defines the inventory. Add nothing outside it except under a heading "Intentional additions", one reason each.
- Change only what the step asks. Keep the Logos assets, the index keys and anything added on the page.
- Stop at the two checkpoints, after step 1 and after step 2, and wait. Everywhere else, decide and list the decision.
- Write in plain full sentences and sentence case, with the British spelling the sources use (colour). No em-dashes, no emoji, no marketing adjectives.

## Constraints

- The palette is closed: blue, neutrals, one orange, four statuses, six chart hues.
- No new fonts. Public Sans and IBM Plex Mono are Google-hosted; name them in `type.families` and attach no files.
- Do not redraw or recolour the logo. Use the files already in Logos.
- Do not sync from GitHub in this pass. When I say the branch is pushed, re-sync from branch design/design-system and merge, keeping the README prose and every component README.

## What done looks like

A Design canvas attached to this system can build any screen of the five roles by reading README.md, picking a template and filling it with the components, without inventing a colour, a size or a style. A coding agent working in the repo can open CODE-MAP.md, find the owner component and the token for anything it sees on a canvas, and migrate a screen without asking what a name means.
