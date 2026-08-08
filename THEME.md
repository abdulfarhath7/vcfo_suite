# Theme — Graphite Violet

The VCFO Suite color theme. Dark mode is the primary surface.

## Palette (source swatch)

| Token | Hex | OKLCH (L% C H) | Role |
|---|---|---|---|
| primary | `#1A1B22` | 22.4% 0.014 279 | graphite base / text |
| action | `#7C5CFC` | 59.7% 0.226 287 | buttons, links, focus, active |
| surface | `#F7F6FB` | 97.5% 0.007 295 | light-mode cards/panels |
| accent | `#A78BFA` | 70.9% 0.159 294 | secondary highlights, badges |
| ok | `#329D6B` | 62.2% 0.123 159 | success · on-track · completed |
| warn | `#DDA632` | 75.8% 0.141 82 | at-risk · awaiting-client |
| danger | `#E16F6F` | 67.5% 0.143 22 | overdue · error · reject |

## Where it lives

All colors are CSS custom properties in `app/globals.css`, expressed as OKLCH
channel triplets and consumed via `oklch(var(--token))`. Tailwind
(`tailwind.config.ts`) reads those variables — no colors are hardcoded in the
config, so changing a value in `globals.css` updates the whole app.

- **Light theme:** `:root` block in `app/globals.css`.
- **Dark theme:** `.dark, [data-theme="dark"]` block (primary surface).
- **Per-role accents:** `[data-role="admin|intern|client"]` override `--primary`,
  `--role-accent`, `--ring` — manager = action violet, intern = soft accent
  violet, client = deeper violet.

Legacy `--orange-*` and `--gold-*` variable names are kept (many components use
those utility classes) but now resolve to VIOLET. Don't assume those names mean
orange anymore.

## Semantic → app-state mapping

| Palette | CSS token | Engagement health | Checklist status |
|---|---|---|---|
| ok (green) | `--success` | on-track | completed |
| warn (amber) | `--warning` | at-risk | awaiting-client / in-progress |
| danger (red) | `--danger` / `--destructive` | overdue | overdue / rejected |
| action (violet) | `--primary` | — | active / focus |

## Dark mode toggle

Wired via `next-themes` in `app/providers.tsx` (`attribute="class"`,
`defaultTheme="dark"`). A ready-made toggle is at
`src/components/common/ThemeToggle.tsx` — drop it into the app shell header or
sidebar footer.

## Accessibility note

Violet-on-violet pairings (accent text on accent fills, or accent badges on the
graphite base) can run low on contrast. Before the pilot, run a quick WCAG
contrast check on: action text on accent surfaces, and accent-foreground on
dark panels. Enterprise buyers of a compliance tool tend to ask.
