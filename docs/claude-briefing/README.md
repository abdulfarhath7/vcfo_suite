# Claude briefing pack — VCFO Suite

This folder is a **product + UX context pack** for another Claude (or any LLM) so you can decide **features, information architecture, and a full visual redesign** without rediscovering the codebase.

It is **not** a rewrite of the app. It describes what exists today (as of 2026-08-20) so you can change appearance and product direction with eyes open.

## How to use this with Claude

### Fast path (one paste)

1. Open a new Claude chat (or Project).
2. Paste **`CLAUDE-CONTEXT.md`** as the first message (or as Project knowledge).
3. Then paste **your ideas** (colours, mood, competitor screenshots, “I want X”).
4. Ask Claude to produce **decisions**, not code, unless you also attach the repo.

`CLAUDE-CONTEXT.md` is the condensed master. The numbered files go deeper when Claude (or you) needs more.

### Better path (Claude Project knowledge)

Upload these in this order:

| Order | File | Why |
|---|---|---|
| 1 | `00-START-HERE.md` | System prompt, rules, how to answer |
| 2 | `CLAUDE-CONTEXT.md` | Whole product in one document |
| 3 | `05-DESIGN-SYSTEM.md` | Tokens, chrome, components to restyle |
| 4 | `09-UI-RESKIN-AND-DECISIONS.md` | Decision framework for look + features |
| 5 | `03-FEATURE-MAP.md` + `04-SCREENS-AND-IA.md` | What exists, screen by screen |
| 6 | `06-DOMAIN-INCORPORATION.md` | The 34-step GCC process (do not casually invent steps) |
| 7 | `07-ARCHITECTURE-CONSTRAINTS.md` | What must not break when implementing later |
| 8 | `08-USER-JOURNEYS.md` | Happy paths per role |
| 9 | `02-ROLES-AND-ACCESS.md` | Five roles, who sees what |

Then in the Project instructions, paste the **system prompt** from `00-START-HERE.md`.

### If the conversation is only about look-and-feel

Minimum set:

- `CLAUDE-CONTEXT.md`
- `05-DESIGN-SYSTEM.md`
- `09-UI-RESKIN-AND-DECISIONS.md`
- `04-SCREENS-AND-IA.md`

### If the conversation is about new features / cutting features

Minimum set:

- `CLAUDE-CONTEXT.md`
- `03-FEATURE-MAP.md`
- `02-ROLES-AND-ACCESS.md`
- `07-ARCHITECTURE-CONSTRAINTS.md`
- `09-UI-RESKIN-AND-DECISIONS.md`

## What this pack is for

- Rebrand: colours, type, density, marketing site, logo, dark/light.
- Role-shell UX: intern vs client vs admin feel different or unified.
- Feature triage: keep / cut / postpone / invent.
- Navigation and IA changes (what lives in the sidebar).

## What this pack is not

- Not live screenshots (walk the app yourself; demo logins are in `00-START-HERE.md`).
- Not a legal/compliance opinion. Domain copy is operational, not advice.
- Not AWS/deploy docs (`docs/context/AWS-DEPLOY.md` covers that).
- Not a substitute for the repo when you later implement. Implementation Claude still needs the codebase + `CLAUDE.md`.

## Source of truth if docs disagree

1. Running app + `src/` code
2. `docs/context/STATE.md` (what is actually built)
3. `docs/context/NOTES.md` (UX and workflow gotchas)
4. This briefing pack (snapshot)

`BUILD-STATUS.md` and parts of `README.md` still describe the pre-install scaffold. Ignore those.
