# 09 — UI reskin and feature decisions

This is the working document for the conversation you are about to have with Claude. Fill the **Owner input** section (or paste it into chat). Claude should return a **decision pack**, not code.

## Owner input (fill this)

**Mood (3 adjectives):**  
_e.g. warm, editorial, high-contrast_

**Primary colour idea:**  
_e.g. keep blue / deep green / ink + gold / black + one accent_

**Light vs dark default:**  

**Roles — one look or three atmospheres?**  
_(intern workspace vs client portal vs firm admin)_

**References (links or names):**  

**Must keep:**  

**Must change:**  

**In / out of scope:**  
- [ ] Tokens + marketing + chrome only  
- [ ] Also intern step workspace layout  
- [ ] Also nav IA / cut features  
- [ ] Also new features (list them)

**Constraints:** India GCC professional services; pilot ~10 people; clients include foreign parents; must stay readable in bright offices and on laptops.

---

## Decision questions (Claude: answer each)

### Visual system

1. What is the **primary**, **neutral**, and **10% accent** set (light + dark), in OKLCH or hex? How do you avoid navy-on-blue / low contrast?
2. Do phase washes stay analogous to the new primary, or become a **fixed traffic-light language** independent of brand?
3. Fonts: keep Manrope + Space Grotesk + Plex Mono, or replace? What role does display type play (marketing only vs intern H1 vs everywhere)?
4. Radius and density: stay soft (0.875rem) or go sharper (fintech) / rounder (consumer)?
5. How colourful may KPIs, nav icons, and status chips be before the product feels like a toy CRM?
6. Super Admin: keep gold as a **badge only**?
7. Logo: evolve the existing mark or new wordmark? (Files: `SbcLogo`, `public/logo-mark.svg` — name still says SBC.)

### Chrome and IA

8. Keep the **flush L-shell**, or floating sidebar / top-only nav?
9. Keep intern sidebar **auto-collapse on engagement pages**?
10. Unify admin vs manager labels (Home vs Dashboard) or keep them?
11. Client: stay Inbox-first? Any fifth nav item?
12. Command palette — keep as only search?

### Feature triage

Mark each **keep / restyle / merge / cut / postpone**:

| Item | Notes |
|---|---|
| Marketing landing + /roles + /contact | Public brand |
| Login colourful chips | Strong pattern |
| Intern Today by company | Core |
| Intern 4-phase overview | Core |
| Client gated flowchart | Core |
| Board resolution editor | Core |
| Manager approvals + Outlook compose | Core |
| Knowledge bank | Staff-only |
| Doc vault vs client documents | Two stores — confusing? |
| Analytics (demo data) | Trust risk |
| Intern Analytics nav | Often unused in pilots |
| Intern Audit log | Spec: intern cannot read audit |
| Client Messages | Dead |
| OnboardingWizard | Legacy island |
| Operational Readiness stage | Hidden |
| Compliance digest email | Not wired |
| Tasks (admin/manager) | Intern already removed |
| Settings beyond password | Thin |
| Dual toast libraries | Tech debt |
| Multiple status/KPI components | Tech debt |

13. What is the **smallest set of screens** that must look “new brand” for a client demo (suggest: login, intern Today, intern step, client inbox, client incorporation, admin home)?

### Role theming

14. Should `data-role` actually change atmosphere (e.g. intern cooler, client warmer) or stay one brand with different density?

### Motion

15. Keep layoutId sidebar pills and journey pulse, or quieter?

---

## Guardrails for Claude’s recommendation

- Prefer **token + primitive** restyle over 70 unique page redesigns.
- Intern step workspace and client gate are the product. Visual change is welcome; workflow change needs an explicit yes.
- Never recommend showing board-resolution **drafts** to clients.
- Never recommend email-on-autosave.
- Status colour = chips/icons, not page fill.
- White (or near-white) text on primary buttons.
- Name the **files** to touch (`app/globals.css`, `app/layout.tsx`, `src/components/noir/*`, `src/components/shell/*`, marketing, logo).
- If proposing a new feature, say whether it needs a **new table** or fits `checklist_state` / notifications / requests.

## Output format Claude should use

```
## Recommended direction
(1–2 paragraphs + 5-token palette)

## Visual system
palette, type, radius, light/dark, phase/status rules

## Role atmospheres
same vs different

## Feature triage
table: keep / restyle / cut / postpone

## IA changes
nav before/after if any

## Phased rollout
P0 demo screens → P1 shells → P2 debt (KPI/status/toast/onboarding)

## Open questions
for the owner

## Implementation notes
files and what not to touch

## Risks
trust, contrast, intern density, email workflows
```

## Known pain to maybe fix while restyling (optional, not required)

From `docs/context/UX-AUDIT.md` (2026-08-11; brand section is stale — app is blue now, not Graphite Violet):

- Onboarding wizard unreadable in dark mode.
- Analytics demo data presented as real.
- Docx preview white page in dark shell.
- Hydration mismatch risk on admin dashboard (`Date.now()` / random class).
- People page showing generated ids (`ib35ba39e75`).
- Full-screen boot interstitial between pages.
- Empty approvals / empty intern requests.
- Marketing stats showing seed numbers (“2, 0, 0”).

Fixing these during a rebrand is high leverage.
