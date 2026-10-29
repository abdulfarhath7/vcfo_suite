# fix-shell: staff and client shell, rows F-271 to F-380 (round 2)

| No. | New status | What you did, or why it stays |
|---|---|---|
| F-271 | ✓ | Already matched. |
| F-272 | ✓ | Already matched. |
| F-273 | ✓ | Sidebar (rail) shows from 768 px (`md:flex`); page pad `md:pl-14` / `md:pl-[15.5rem]`; menu button `md:hidden`. Under 1100 px it stays the rail. Tab bar under 768 px. |
| F-274 | ◐ | Width cap kept (1480/1400): views are laid out for it; changing it is a page-wide decision for the hub. |
| F-275 | ◐ | Boot screen kept: the shell cannot draw a role's sidebar before the session loads. |
| F-276 | ✓ | Already matched. |
| F-277 | ◐ | White skin kept as a real setting (navy stays default). |
| F-278 | ✓ | 56 px head with the VCFO wordmark image at 26 px (on-white copy for the white skin). |
| F-279 | ✓ | Pin button now has the dark Tip with the "[" key cap. |
| F-280 | ✓ | Already matched. |
| F-281 | ✓ | Already matched. |
| F-282 | ✓ | Idle icons take `side-muted` (round 1 helper, now used on leaf rows too). |
| F-283 | ✓ | Already matched. |
| F-284 | ✓ | Counts: lead Work (red), Approvals for manager/admin (red, `usePendingApprovals`), Clients (engagement count), Updates (unread notifications), developer Connections and Jobs (red). Super admin Risks has no count yet (see gaps). |
| F-285 | ✓ | Staff groups start open (`defaultOpen`); the chevron turns. |
| F-286 | ✓ | Child rows 28 px, 13 px, faint ink, no icon, 27 px indent, no tree line. |
| F-287 | ✓ | Hairline removed; the break is space only. |
| F-288 | ✓ | Lead Clients is now a link row with a fold chevron: four clients (plus the open one), identity colour square, short name, Inc/Cmp pill, "View all N". |
| F-289 | ✓ | Same clients fold on manager/admin Projects and super admin Clients rows (scoped engagements). |
| F-290 | ✓ | Manager "Project leads" fold with "N open" (new repo `sidebar-folds`, `/api/shell/sidebar`). |
| F-291 | ✓ | Admin People and super admin Team fold managers with "N clients". |
| F-292 | ✓ | "New" tag after Compliances for lead and manager. |
| F-293 | ✓ | Month calendar only for lead and manager. |
| F-294 | ✓ | No box, "October 2026" and "Due days", Monday first, 17 px cells. |
| F-295 | ✓ | 2 px underline in the worst status colour from the person's filings (`useFilings`) and task due dates; today has a blurple ring. |
| F-296 | ✓ | "Your manager" block for leads (reports-to manager, mail button opens a mail draft: the Email page takes no recipient in the URL). |
| F-297 | ✓ | Already matched. |
| F-298 | ◐ | Lead and manager have Ask VCFO (round 1, verified, tests pass). Developer stays out: every data repository refuses a developer session, so Ask has nothing to read; needs a knowledge-only Ask mode. |
| F-299 | ✓ | Round 1: floating 420 x 620 card from 640 px, full screen on phones. |
| F-300–F-301 | ✓ | Already matched. |
| F-302 | ✓ | Name white, role `side-muted`, keyboard button, row opens profile. |
| F-303 | ✓ | Sign-out button in the profile row. |
| F-304 | ✓ | Already matched. |
| F-305 | ✓ | Rail items 40 x 36 squares, 18 px icons (round 1); 56 px head with 26 px VCFO mark (round 2). |
| F-306 | ✓ | Already matched. |
| F-307 | ✓ | Rail red badges for Work, Approvals, developer Connections and Jobs. |
| F-308 | ✓ | Rail group icon links to the first child page (`railHref`); the client-list fly-out stays for disclosures without one. |
| F-309–F-310 | ✓ | Already matched. |
| F-311 | ◐ | Staff: needs a slide-in keyframe in `app/globals.css` (foundations). Client: done (`vpsPeek`). |
| F-312–F-314 | ✓ | Already matched. |
| F-315 | ✓ | Drawer 248 px (max 88vw) with a 40 px close button on navy. |
| F-316 | ✓ | Side padding now 16 px on phones. |
| F-317 | ✓ | 20 px Menu icon, VCFO mark beside it on phones. |
| F-318 | ✓ | 26 px SBC lockup (dark-mode copy), 1 px line and 12 px gap after it. |
| F-319 | ✓ | Already matched. |
| F-320–F-327 | ✓ | Round 1 palette: 380 px button from 768, centred 600 px dialog on a scrim, Esc key cap, chips, groups (clients, steps, filings, obligations, registrations, documents, knowledge bank, pages), status square rows, key footer, "No match". Round 2 fixed super admin client and step links (they went to the lead's routes). `/api/search` is scoped and has a cross-tenant test (`src/lib/search/staff-search.test.ts`). |
| F-328 | ✓ | Already matched. |
| F-329 | ✓ | Super admin and developer have only the Announcements bell (P-257). |
| F-330–F-334 | ✓ | Round 1 (380/360 px menus, tabs at right, footer links, "None"). Rows (F-332) live in `src/components/notifications/NotificationItem.tsx`, also changed in round 1 by its owner. |
| F-335 | ✓ | Profile link removed from the top bar (sidebar row and rail avatar open it). |
| F-336 | ✓ | Already matched. |
| F-337 | ◐ | `app/providers.tsx` is not mine: set `next-themes` `defaultTheme="system"` and `enableSystem` to match. |
| F-338–F-339 | ✓ | Already matched. |
| F-340 | ✓ | "[" row added. No Calendar or row-menu groups: the real tool has no such keys, so listing them would be false. |
| F-341–F-343 | ✓ | Already matched. |
| F-344–F-345 | ✓ | Ask tab now shows for lead and manager (Ask enabled). Manager/admin tabs keep the real routes (Home, Projects, Approvals). |
| F-346 | ✓ | Developer tabs: Overview, Jobs, Connections, More (P-256). |
| F-347 | ◐ | No shared `Cols` helper; it belongs in `src/components/ui` (foundations). |
| F-348–F-351 | ✓ | Already matched. |
| F-352 | ✓ | Client sidebar starts under the ribbon (`top:3px`). |
| F-353–F-359 | ✓ | Already matched. |
| F-360 | ✓ | Profile row is a link to Profile, with keyboard and sign-out buttons. |
| F-361 | ◐ | Rail now under 1100 px or when picked, with 160/280 ms hover open over the page. The rail is still 72 px (its CSS is built for 72); 56 px is a CSS rewrite. |
| F-362 | ✓ | Pin button in the head and on the rail, "[" key, saved per browser (`vcfo.cp.sidebar`). |
| F-363–F-365 | ✓ | Already matched. |
| F-366 | ✓ | Search field 380 px from 768 px (shrinks to min 200 px if needed), icon on phones. |
| F-367–F-371 | ✓ | Already matched. |
| F-372 | ✓ | Round 1: Regulator and Status chips with Clear all. |
| F-373 | ✓ | Round 1: steps, filings, obligations, registrations, documents, pages; 12 px heads. |
| F-374 | ✓ | Round 1: key caps footer, "No match". |
| F-375 | ✓ | Round 1: 420 x 620 card, 20 px from edges. |
| F-376 | ✓ | Already matched. |
| F-377 | ✓ | Round 1 removed the first-visit note. |
| F-378–F-380 | ✓ | Already matched. |

## Coordinator requests

- P-254 done: red counts on developer Connections (Outlook links needing attention) and Jobs (runs failed today), from `/api/dev/overview` (shared cache key `['dev','/api/dev/overview']`).
- P-255 done: the super admin sees the developer items while under `/app/dev`.
- P-256 done: developer phone tabs.
- P-257 done: no Notifications bell for developer (or super admin).
- P-608 done, differently: added `roleProfilePath()` in `src/lib/auth-routes.ts` (admin, manager, lead → `/app/<role>/profile`) and the sidebar profile row and rail avatar use it. `roleSettingsPath` is unchanged because its other callers link to settings sections (`#email`, `#appearance`, notification preferences, Outlook callback).
- Client compliance agent: `'library'` is now a `PortalRouteKey` (alias of `knowledge-bank`, `/app/client/library`; the page exists). `PORTAL_ALIAS_KEYS` keeps it out of the search page list. spectrum.tsx:306 typechecks.

### Round 3 (search frame and last shell requests)

- Client search palette: the desktop frame is now a Spectrum Tailwind overlay (like `pages/compliances/overlay.tsx`): centred 600 px, scrim, dialog shadow, tokens only, so it follows dark mode. The old `#vp-drill` CSS (21-runtime.css) and the old search frame rules (23-portal.css) are removed.
- Manager: "Work" item to `/app/manager/work` in the sidebar and phone tabs (Home, Work, Projects). The "Project leads" fold links each lead to `/app/manager/team/<lead key>`. The key is the lead's `intern_id` when set, else the profile id, the same key `LeadPage` reads from the team roster. `sidebar-folds` now returns `key`.
- Admin: "Managers" item to `/app/admin/managers` with a count and a fold per manager linking `#<profile id>`. People no longer carries the fold.
- Super admin: "Documents" item to `/app/super/vault`. The account row opens `/app/super/profile` (`roleProfilePath`). Updates was already in the super nav (P-644).
- Client: the sidebar profile row opens `/app/client/profile` (new `profile` route key).
- Text size: `PortalProvider` holds `textSize` (`small`, `default`, `large`), kept per browser under `vcfo.text-size`. It sets `data-text-size` on `<html>`, which the foundations' rule scales, and the same attribute on `.cp`. The control is the new `TextSizeSetting` (`src/components/client-portal/TextSizeSetting.tsx`). Request: the owner of the client Profile page mounts it under Appearance. The choice is not stored server-side, because `ClientPortalPrefs` and its API are not in the shell's files.
- Checks: cp-css regenerated. tsc shows no errors in shell files. eslint shows 0 errors. vitest passes on shell, client-portal, `lib/client-portal` and `sidebar-folds` (14 files, 111 tests).

## Files changed

- src/components/shell/RoleSidebar.tsx: md breakpoint, head and logo, folds, counts, New tag, Your manager, sign out, pin Tip, drawer width, no hairline, dev badges, super in dev console, profile path.
- src/components/shell/SidebarNavGroup.tsx: groups start open, rail links to first child, plain child rows, tag and badge slots.
- src/components/shell/StaffSidebarFolds.tsx (new): clients fold, people fold, fold button, New tag, Your manager.
- src/components/shell/SidebarComplianceMini.tsx: rewritten (lead and manager, Monday first, status underlines from real work).
- src/components/shell/AppShell.tsx, TopBar.tsx, TabBar.tsx, ShortcutSheet.tsx, CommandPalette.tsx (super admin links).
- src/components/client-portal/Sidebar.tsx: pin, rail mode, hover open, profile row link and keyboard button.
- src/components/client-portal/routes.ts: `library` key, `PORTAL_ALIAS_KEYS`; SearchPalette.tsx skips aliases.
- src/components/client-portal/css-src/20-shell.css, 22-topbar.css (then `node scripts/cp-css.mjs`).
- src/db/repositories/sidebar-folds.ts and .test.ts (new, cross-tenant tests); app/api/shell/sidebar/route.ts (new).
- src/lib/auth-routes.ts: `roleProfilePath`.
- Round 1 work kept and checked: app/api/search, src/lib/search, src/lib/client-portal/search-hits.ts, client search route, Ask access, bells, AskPanel.

## New routes

- GET /api/shell/sidebar (any signed-in role; client and developer get empty lists).

## Schema needs

None.

## Requests for shared files

- app/globals.css: a 160 ms slide-in from 10 px left for the staff rail peek (F-311).
- app/providers.tsx: `defaultTheme="system"`, `enableSystem` (F-337).
- src/components/ui: a `Cols` layout helper (F-347).
- Super admin Risks count in the sidebar needs a light count endpoint (the super overview read is heavy).
- `src/components/shell/InternClientsNav.tsx` is no longer mounted (only `INTERN_CLIENTS_HREF` is used); the hub may remove it.

## Decisions

- Developer stays out of Ask VCFO (no data it may read).
- Manager/admin nav labels and tabs keep real routes (Projects, Approvals) rather than the prototype's Work/Clients names; the clients fold sits on Projects.
- "Your manager" mail button opens a mail draft (`mailto:`).
- Client rail stays 72 px wide.

## Checks

- `npx tsc --noEmit -p .`: no errors in my files. Remaining errors belong to other areas (dev/jobs/retry, team-sections, super-insights test, FilingsView/ObligationView, admin managers page, SuperPracticeRegistrations).
- `npx vitest run` on src/lib, src/components/shell, src/components/ask, src/components/client-portal and the new repo test: all pass (179 files, 1584 tests in the last run).
- `npx eslint` on my files: 0 errors.
