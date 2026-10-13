# Prototype v7: owner change list

The owner is sending changes one at a time. **Do not build v7 until the owner asks.**

| # | Change | Input |
|---|---|---|
| 1 | Replace the logo everywhere | `vcfo-logo-on-light.webp` (black "VCFO", orange "Suite", "BY SBC") for light backgrounds. `vcfo-logo-on-dark.webp` (white text) for the navy sidebar and dark mode |
| 2 | Show this animation when the user enters the site (intro / splash before the app) | https://claude.ai/artifact/Tujb5zcNkwnjAtyyazRyZC |
| 3 | Replace the Ask VCFO chatbot avatar with the owner's animated SVG. It must come and go exactly as in the file: rises from the bottom edge, hands grip the edge, looks around, blinks, then sinks away on a 20.5 s loop | `visor-avatar-animated.svg` (smile added under the eyes, owner 2026-10-13; it moves with the eyes and never changes) |
| 4 | Incorporation pages: build them to match the REDESIGN boards on the Incorporation canvas https://claude.ai/artifact/NFNdegb62iwKAjKhFp1Nvq (page "Incorporation — as in VCFO Suite"): Redesign · landing; landing with a phase open; step page with the journey rail (Focus track); close-ups: status-icon tooltip, What's this? on a step row, What's this? answer card; phone landing; phone step page. Do NOT use the "Current" boards. Keep the real Phase 1–4 names and steps from incorporation-steps.json | Canvas boards vs_land, vs_land_b, vs_step, vs_tip, vs_whats, vs_ask, vs_m_land, vs_m_step |
| 5 | RESPONSIVE (top priority, owner: v6 does not suit all display sizes). Every page must fit and look right on every screen: phone 360–430, tablet 768–1024 (portrait + landscape), small laptop 1280×720/800, laptop 1366–1536, desktop 1920, large 2560. No horizontal page scroll, no clipped or overlapping content, no tiny text. Fluid layouts (grid/flex, clamp() type and spacing, max-width content), sidebar collapses to icons on tablet and to a drawer on phone, tables/grids scroll inside their own box, pop-ups fit the viewport, the Ask VCFO avatar and chat fit small screens. Verify with screenshots of every page at each size before delivering | — |

More changes to follow.
