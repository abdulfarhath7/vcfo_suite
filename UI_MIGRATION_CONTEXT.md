# UI Migration Context — Prototype UI → Existing Repository

Read this entire file before touching any code. These rules override your defaults for this task.

## 1. What you are working with

There are two inputs. Each is the source of truth for exactly one thing:

| Input | Location | Source of truth for | NOT a source of truth for |
|---|---|---|---|
| **PROTOTYPE** | `<PROTOTYPE_PATH>` | Visual design, layout, spacing, colors, typography, screen structure, navigation structure, component appearance, interaction *feel* | Data, state management, business logic, API calls, auth, routing implementation |
| **REPOSITORY** (this repo) | `<REPO_PATH>` | All functionality: backend, API clients, hooks, services, state, validation, auth, data models, utilities, tests, routing logic | Visual appearance |

The prototype is a non-functional reference. Its buttons mostly do nothing or only redirect. Its data is hardcoded/mock. **Never copy the prototype's data, mock state, fake handlers, or placeholder logic into the repository.**

## 2. The goal in one sentence

Replace the repository's existing UI with the prototype's UI, pixel-faithful, while keeping 100% of the repository's existing functionality wired into the new UI.

## 3. Hard rules (non-negotiable)

1. **No backend or logic code is deleted.** Backend = anything that is not purely presentational. This includes: API routes/controllers/handlers, services, database models/queries/migrations, auth, middleware, API client functions, hooks (data-fetching, form, state), stores/reducers/contexts, validation schemas, utilities, types/interfaces, constants, config, environment handling, tests.
2. **Old UI code is removed, not left behind.** When a screen is replaced by its prototype version, the old presentational code for that screen (old components, old styles, old layout files, old assets used only by it) must be deleted. Do not keep two UIs. Do not leave dead components "just in case".
3. **Reuse before build.** For every interactive element in the prototype (button, link, form, toggle, dropdown, table, list, modal, search, filter, upload…), first search the repository for existing functionality that does that job. Wire the new UI to it. Only build new logic if nothing in the repository does it.
4. **No wasted code.** After migration, every file in the repo must be either (a) used by the new UI, (b) backend/logic that the new UI calls, or (c) backend/logic that is still a valid part of the system even if no screen currently calls it (keep it, note it in the report). Nothing orphaned from the OLD UI survives.
5. **Nothing from the prototype that is purely a placeholder survives either.** Prototype buttons that "redirect to another page" must redirect to the real page using the repository's real router. Prototype forms must submit through the repository's real submit logic. Prototype lists/tables must render real data from the repository's real data source.
6. **Match the prototype visually.** Same layout, spacing, colors, fonts, sizes, icons, component states (hover/active/disabled/loading/empty/error) as far as the prototype shows them. Where the prototype does not show a state the real app needs (loading, error, empty, validation error), design it consistently with the prototype's style.
7. **Do not rebuild the application.** This is a UI swap on top of existing functionality, not a rewrite. Do not restructure the backend, rename APIs, change data contracts, or "improve" working logic unless the new UI strictly cannot work without it — and then ask first.
8. **Ask before any of these:** deleting a file whose classification is unclear; adding a new dependency; changing a route/URL path; changing an API contract or data shape; introducing a second styling system; touching anything under the backend/server/API directories; touching auth.

## 4. How to classify a file before deleting it

Before deleting ANY file, classify it. If unsure, ask — do not guess.

- **UI-only (safe to delete once replaced):** presentational components with no data logic, page/screen components that only compose other components, CSS/SCSS/style files, old layout shells, images/icons/fonts used only by the old UI, storybook stories for deleted components, old theme files superseded by the prototype's design tokens.
- **Logic (NEVER delete):** anything that fetches, transforms, validates, stores, or sends data; anything imported by backend code; anything with business rules; types; tests of logic.
- **Mixed (split, don't delete):** a component that contains both markup and logic (e.g. a page that fetches data and renders it). Extract the logic (into a hook/service/handler in the repo's existing pattern), rebuild the markup from the prototype, and connect the two. Delete only the old markup.

Rule of thumb: if removing the file would make an API call, a data flow, a validation, or a test disappear, it is not UI-only.

## 5. Required process — do these phases in order

Do not skip to implementation. Each phase produces an artifact you show to me before continuing.

### Phase 0 — Read everything
- Read the repository structure fully: routing, entry points, component tree, hooks/services/stores, API client, styling system, build config, tests.
- Read the prototype fully: every screen, every component, the design tokens (colors, fonts, spacing), the navigation structure.
- Identify the repository's tech stack (framework, styling approach, state management, router, form library, component library). The new UI must be implemented in THIS stack, not the prototype's stack if they differ.

### Phase 1 — Functionality inventory (from the REPOSITORY)
Produce `MIGRATION/01-functionality-inventory.md` listing every existing capability:
- Routes/pages and what each does
- Every hook, service, store, API client function, and what it does
- Every form and its submit/validation logic
- Auth flows, roles, permissions
- Any background processes, notifications, integrations
For each item note the file path. This list is the checklist of things that must still work at the end.

### Phase 2 — Screen inventory (from the PROTOTYPE)
Produce `MIGRATION/02-prototype-screens.md` listing every screen and every interactive element on it, with what the prototype *appears* to intend each element to do.

### Phase 3 — Mapping
Produce `MIGRATION/03-mapping.md`: a table with one row per prototype interactive element / screen section:

| Prototype screen | Element | Intended behaviour | Existing repo functionality to wire (file + function) | Status |

Status is one of:
- `REUSE` — existing logic found, will wire it
- `ADAPT` — existing logic found but needs small adaptation (describe it)
- `NEW` — nothing exists; needs new logic (describe what, and ask me to confirm scope)
- `ORPHAN` — existing repo functionality that has NO place in the prototype UI (list these separately; ask me whether it needs a screen, a hidden entry point, or stays backend-only — it is NOT deleted)

Also list the old UI files you intend to delete, classified per section 4.

**Stop here and wait for my approval of the mapping before writing UI code.**

### Phase 4 — Design tokens
Port the prototype's design tokens (colors, typography, spacing, radii, shadows, breakpoints) into the repository's existing styling system (theme file, CSS variables, Tailwind config, etc.). If the repo has no token system, create one in the repo's styling approach. Do not hardcode values per component.

### Phase 5 — Implement screen by screen
For each screen, in the order I approve:
1. Build the new screen from the prototype, in the repo's stack, using the shared tokens and shared components.
2. Wire every element per the mapping. Use the repo's existing hooks/services/handlers directly.
3. Handle real-world states the prototype omits (loading, empty, error, validation, disabled) in the prototype's visual style.
4. Replace the old screen in the router; delete the old UI files for that screen (classified per section 4).
5. Run build, lint, type-check, and existing tests. Fix anything broken. Do not disable or delete tests to make them pass — if a test tests old UI markup only, update it to the new markup; if it tests logic, it must still pass unchanged.
6. Report what was reused, what was built new, what was deleted, and anything you were unsure about.

Build shared components (buttons, inputs, cards, tables, modals, nav) once, from the prototype, and reuse them across screens. Do not duplicate.

### Phase 6 — Final verification
Produce `MIGRATION/04-final-report.md`:
- Walk through `01-functionality-inventory.md` and confirm each item still works and where it is now surfaced in the new UI.
- List every file deleted, with its classification.
- List every new file, with why it was needed (and confirm no existing code could have done the job).
- List any `ORPHAN` logic and its decided fate.
- Confirm: build passes, lint passes, type-check passes, tests pass, no unused imports/files, no leftover references to old UI, no mock/placeholder data from the prototype anywhere.
- Run a search for leftover old-UI identifiers (old component names, old class names, old route names) and show the result is empty.

## 6. Working style

- Work in small, reviewable commits: one screen (or one shared component group) per commit, with a clear message like `ui: migrate Dashboard screen from prototype (reuses useDashboardData, deletes old Dashboard/)`.
- Use plan mode for Phases 0–3.
- When you find a conflict between the prototype and the repository (e.g. prototype shows a field the backend doesn't have, or the backend has a required field the prototype doesn't show), do not silently pick one. List it and ask.
- When you are unsure whether something is UI or logic, treat it as logic and ask.
- Prefer the repository's existing conventions (folder structure, naming, component patterns) over the prototype's or your own.
- Never say "done" for a screen until build + tests pass and the old files for that screen are gone.

---

## Kickoff prompt (paste this into Claude Code after the file is in the repo)

```
Read UI_MIGRATION_CONTEXT.md in full and follow it exactly.

Prototype location: <PROTOTYPE_PATH>
Repository: this working directory.

Start with Phase 0 and Phase 1. Produce MIGRATION/01-functionality-inventory.md
and MIGRATION/02-prototype-screens.md, then MIGRATION/03-mapping.md, and stop
for my approval before writing any UI code. Use plan mode.
```
