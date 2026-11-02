# Public pages: landing, Ask guide, Book a demo, sign in (P-381 to P-475)

P-378 to P-380 are Developer · Audit rows (all ✓). They are not in the public area, so the developer part covers them.

| No. | New status | What you did, or why it stays |
|---|---|---|
| P-381 | ✓ | It was already the same. |
| P-382 | ✓ | It was already the same. |
| P-383 | ✓ | It was already the same. |
| P-384 | ◐ (real only) | The landing still scrolls to a `#section` after the intro, so the "/#journey" links from /roles keep working. |
| P-385 | ✓ | It was already the same. |
| P-386 | ✓ | It was already the same. |
| P-387 | ◐ (stays) | "Sign in" goes to `/login`, which is the real Auth.js page. The tool has no `/sign-in` route, and renaming the route is outside this task. |
| P-388 | ✓ | The nav "Book a demo" is now a button that opens the Book a demo dialog. |
| P-389 | ✓ | It was already the same. |
| P-390 | ✓ | It was already the same. The prototype's phone menu has no Book a demo item either. |
| P-391 | ✓ | It was already the same. |
| P-392 | ✓ | The hero "Book a demo" opens the dialog. |
| P-393 | ✓ | It was already the same. |
| P-394 | ◐ (stays) | "Try it live" opens `/login`, which is the real sign-in page (see P-387). |
| P-395 | ✓ | It was already the same. |
| P-396 | ✓ | The hero frame and both floating cards now carry `data-app` and `role="button"`. A click or Enter opens Book a demo. They cannot open a live screen because the tool has no public demo portal. |
| P-397 | ✓ | I ported the prototype's `[data-app]` CSS rules to `landing.css` with the `--lp-*` tokens. The hover and focus pill says "Book a demo", not "Open live screen". |
| P-398 | ✓ | It was already the same. |
| P-399 | ✓ | Each fact is a click-through item. On hover the number turns blue. |
| P-400 | ✓ | It was already the same. |
| P-401 | ✓ | The journey nodes and list rows are click-through items. A node gets the brighter ring on hover or focus. |
| P-402 | ✓ | It was already the same. |
| P-403 | ✓ | It was already the same. |
| P-404 | ✓ | The pin cards and the phone list cards are click-through items. |
| P-405 | ✓ | It was already the same. |
| P-406 | ✓ | The cluster cards and the registration chips are click-through items. A chip gets the blue edge and fill on hover. |
| P-407 | ✓ | It was already the same. The ring is also a click-through item now. |
| P-408 | ✓ | The reminder card is a click-through item ("Book a demo to see notifications"). |
| P-409 | ✓ | All three screenshots are click-through items. |
| P-410 | ✓ | It was already the same. |
| P-411 | ✓ | It was already the same. |
| P-412 | ✓ | The comparison "Book a demo" is a button that opens the dialog. |
| P-413 | ✓ | It was already the same. |
| P-414 | ◐ (kept) | Each portal screenshot now opens Book a demo, as in the prototype. I kept the "See the ... portal" buttons as a visible keyboard path, and they now open the dialog instead of going to `/contact`. |
| P-415 | ✓ | The portal screenshots (tab panels) carry `data-app`. A click opens Book a demo. |
| P-416 | ✓ | It was already the same. |
| P-417 | ✓ | The Ask panel and its three questions are click-through items ("Book a demo to try Ask VCFO"). |
| P-418 | ✓ | It was already the same. |
| P-419 | ✓ | The credentials card and the audit card are click-through items. |
| P-420 | ✓ | It was already the same. |
| P-421 | ◐ | The closing "Book a demo" opens the dialog. "Try it live" still opens `/login` (see P-387). |
| P-422 | ✓ | The footer "Book a demo" opens the dialog, as in the prototype (`href="#demo"`, the click is prevented). |
| P-423 | ✓ | Every `data-app` item has `tabIndex={0}`, `role="button"` and `aria-haspopup="dialog"`, and shows a focus outline. Enter (and Space) opens the dialog. I used `role="button"`, not "link", because the item opens a dialog and goes to no page. |
| P-424 | ✓ | It was already the same. |
| P-425 | ✓ | It was already the same. |
| P-426 | ✓ | It was already the same. |
| P-427 | ✓ | It was already the same. |
| P-428 | ✓ | It was already the same. |
| P-429 | ✓ | It was already the same. |
| P-430 | ◐ (stays) | "Every answer can show you where it sits on this page" is the true sentence. The real landing has no screen to open (see P-434). |
| P-431 | ✓ | It was already the same. |
| P-432 | ✓ | It was already the same. |
| P-433 | ✓ | It was already the same. |
| P-434 | ✗ (stays) | No data: there is no public demo portal, so "Open the screen" has no screen to open. "Book a demo" covers this action. |
| P-435 | ✓ | "Book a demo" in an answer is a button that opens the dialog. It is primary for sales answers and ghost for the others. |
| P-436 | ✓ | The small primary "Book a demo" opens the dialog. |
| P-437 | ✓ | It was already the same. |
| P-438 | ✓ | The new `BookDemoDialog` is the prototype's small modal (420 px on the scrim, 52 px head, footer). It opens over the landing and the sign-in page. `/contact` still works as a page for direct links and the marketing nav. |
| P-439 | ◐ (stays) | `/contact` stays inside `MarketingShell`, which also frames `/roles` and carries the marketing nav. The dialog is the prototype part. |
| P-440 | ✓ | I removed the Aurora wash from `/contact`. The page has a plain surface and the dialog look. |
| P-441 | ✓ | The dialog title is "Book a demo". `/contact` uses the same 52 px head and no longer has the eyebrow, the rule or the serif heading. |
| P-442 | ✓ | The dialog has three required fields: Name, Firm and Work email. `/contact` keeps "How can we help?" as an extra field, now optional (the route already accepts no message), and Firm is required there too. |
| P-443 | ✓ | The dialog and `/contact` use the R-47 `Input`/`Textarea` (40 px, 1.5 px edge, 6 px corners) with a 13 px label above (`DemoField`). |
| P-444 | ✓ | The footer button says "Send" ("Sending" while the request posts). |
| P-445 | ✓ | The sent state says "Request sent to SBC. The reply goes to <email>." and shows a primary Close button. |
| P-446 | ◐ (real only) | The real dialog really posts to `/api/public/demo-request`, so a red error line shows when the post fails (rate limit, bad email). The prototype sends nothing. |
| P-447 | ◐ (real only) | The dialog has no sign-in link. `/contact` keeps a small "Already have an account? Sign in" line under the card. |
| P-448 | ◐ (stays) | The route stays `/login` (see P-387). |
| P-449 | ✓ | It was already the same. |
| P-450 | ✓ | It was already the same. |
| P-451 | ✓ | The middle peak band is `fill-highlight-bright` at 7%, which is the orange brand colour. |
| P-452 | ◐ (stays) | No token matches navy-2 and stays dark in both modes. `navy-fill-hover` flips to light in dark mode, so the band stays on `side-hover`. Request: add a `side-deep` token (navy-2, #0F2D4D light, #111C30 dark). |
| P-453 | ✓ | It was already the same. |
| P-454 | ✗ (stays) | The tool has no sample mode, so it would be false to say "Live prototype, sample data". When `NEXT_PUBLIC_DEMO_LOGINS=on`, the card shows the honest label "Demo accounts" over the buttons. |
| P-455 | ✓ | It was already the same. |
| P-456 | ◐ (stays) | The card keeps `shadow-dialog`. The prototype value is an rgba literal, and components may not hold colour literals. Request: add a `shadow-signin` token if the exact value matters. |
| P-457 | ✓ | The card peak band is `bg-brand-text` at 7%, the darker accent blurple that the prototype's `--accent` maps to. |
| P-458 | ✓ | The 30 px "V" tile is `bg-highlight-bright` (orange) with `text-on-brand` (white). |
| P-459 | ✓ | It was already the same. |
| P-460 | ◐ (real only) | I kept the theme toggle in the logo row. It is a real feature. |
| P-461 | ✓ | It was already the same. |
| P-462 | ✓ | It was already the same. |
| P-463 | ◐ (real only) | I kept the show-password button. It is a real feature. |
| P-464 | ◐ (real only) | The error line keeps the Auth.js message, which can say more than a mismatch (locked out, two-step). |
| P-465 | ✓ | The button now has the dark-mode accent edge (`dark:border dark:border-brand-line`). It stays disabled until both fields have text, which is real only. |
| P-466 | ◐ (real only) | I kept the spinner and "Signing in". Real sign-in takes time. |
| P-467 | ✓ | The "Demo accounts" grid (three a row, outline buttons, a hairline above) shows only when `NEXT_PUBLIC_DEMO_LOGINS === 'on'`. A button only fills the work email with a seeded login and focuses the password field. No password is in the bundle. There are five buttons (Client, Lead, Manager, Admin, Super admin) because the seed creates no developer login. |
| P-468 | ◐ (real only) | I kept the "Forgot your password?" button and its "Need a new password?" dialog. The words around it are the same as the prototype. |
| P-469 | ✓ | "No account yet? Book a demo" is a button that opens the Book a demo dialog on the sign-in page. |
| P-470 | ✗ (stays) | It is the same reason as P-454: the tool has no sample data. |
| P-471 | ◐ (real only) | I kept the two-step code step. |
| P-472 | ◐ (real only) | I kept the notices. |
| P-473 | ✓ | It was already the same. |
| P-474 | ✗ (stays) | No data: the tool has no public demo portals to list. |
| P-475 | ◐ (real only) | I left `/roles` as it is. The marketing footer links to it. |

## Files changed

- `src/components/marketing/BookDemoDialog.tsx` (new): the Book a demo modal and the shared R-47 `DemoField`.
- `src/components/marketing/use-demo-request.ts` (new): the shared post to `/api/public/demo-request` (state, error, send, reset).
- `src/components/marketing/BookDemoDialog.test.tsx` (new): posts the body, shows the sent state and Close, shows the route error.
- `src/components/marketing/ContactForm.tsx`: R-47 inputs, the shared hook, "Send", the new sent words, optional message, required firm.
- `src/components/marketing/ContactForm.test.tsx`: updated for "Send" and "Request sent to SBC.".
- `app/contact/page.tsx`: no Aurora, eyebrow or serif heading. It has a dialog-style card with a 52 px head and a sign-in line.
- `src/components/marketing/landing/LandingScreen.tsx`: `data-app` click-through items (52 lines from the prototype), one delegated click and Enter/Space handler, the dialog state, every Book a demo as a button, the reworded aria-labels, and "See the ... portal" buttons that open the dialog.
- `src/components/marketing/landing/landing.css`: the ported `[data-app]` rules (cursor, hover pill "Book a demo", hover edges, chip fill, fact number, node ring, focus outline).
- `src/components/marketing/landing/LandingParts.tsx`: `CompareSection({ onDemo })` and its button.
- `src/components/marketing/landing/AskGuide.tsx`: `AskGuide({ onDemo })` and its buttons.
- `src/components/marketing/landing/LandingScreen.test.tsx`: tests for the dialog from the buttons, a click-through item, Enter on a chip and the portal button.
- `src/components/auth/demo-accounts.ts` (new): the five seeded login emails and `demoLoginsOn()`.
- `src/components/auth/LoginFormCard.tsx`: the orange logo tile, the accent card band, the dark-mode button edge, the demo-account grid behind the flag, and `onBookDemo`.
- `src/components/auth/LoginFormCard.test.tsx` (new): the flag check, hidden by default, email-only fill and password focus, `onBookDemo`.
- `src/components/auth/SignInScreen.tsx`: the orange middle band and the Book a demo dialog.
- `src/components/auth/SignInScreen.test.tsx`: "Book a demo" opens the dialog.

## New routes

None. The work reuses `POST /api/public/demo-request` without edits. It already accepts `message` as optional.

## Schema needs

None.

## Requests for shared files

- `.env.example`: document `NEXT_PUBLIC_DEMO_LOGINS` ("on" shows the demo account buttons on /login; never set it in production; the buttons fill the email only).
- Tokens: add `side-deep` (navy-2, #0F2D4D light, #111C30 dark) for the sign-in front band (P-452). Add an optional `shadow-signin` (`0 30px 80px -30px rgba(0,0,0,.6)`) for the card (P-456).
- `infra/` and App Runner: make sure `NEXT_PUBLIC_DEMO_LOGINS` is never set for the production build.

## Decisions

- Click-through items open the Book a demo dialog. They do not navigate, because the tool has no public demo portal. They use `role="button"` with `aria-haspopup="dialog"`, not "link", and their aria-labels say "Book a demo to see ...".
- I kept the "See the ... portal" buttons and changed them to open the dialog, so no real path is lost.
- `/contact` stays as a page inside `MarketingShell`, with the dialog's look, so direct links and the marketing nav keep working.
- The message on `/contact` is now optional and Firm is required, to match the dialog. The route did not change.
- There are five demo buttons, not six, because no developer login is seeded.
- `LandingScreen.tsx` has a file-level `jsx-a11y/no-noninteractive-element-to-interactive-role` disable, because the click-through list rows are `<li role="button">`.
- Typecheck errors are only in files outside this area: `app/api/dev/jobs/retry/route.ts`, `src/views/compliances/FilingsView.tsx`, `ObligationView.tsx` and `filing-windows.tsx`. ESLint shows 0 errors on these files and one existing fast-refresh warning. Vitest passes 21 of 21 tests in `src/components/marketing` and `src/components/auth`.
