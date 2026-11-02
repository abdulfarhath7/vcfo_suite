# Motion and interactions the Spectrum port removed (35b7b2a → HEAD)

Written in ASD-STE100. Owner, 30 Oct 2026: bring back row 35 only (the announcement popup that flies back to the bell); leave the rest as they are. Rows marked
"Bring back" get restored on top of the Spectrum look (restyle, keep the behaviour).

| No. | Screen | Before the port | Now | Owner |
|---|---|---|---|---|
| 1 | Client Home on a phone | A phone board: skeleton, cards fade up one by one, numbers count up, bars and donut draw in, a pulsing "now" ring, bottom-sheet drills, a bobbing Ask launcher. | Phones get the desktop cards in one column. No motion. | Leave out |
| 2 | Client Home, desktop | Cards fade up one by one. Cards lift 2 px on hover. | Plain cards. No entry, no hover lift. | Leave out |
| 3 | Client Home, Steps rows | A click opens the step popup on Home. | A click goes to the step page. | Leave out |
| 4 | Client Home, Compliance card | A click opens the compliance popup. | A click opens the Spectrum drill. | Leave out |
| 5 | Client Home, greeting | A navy band with a stats strip and a ring stat. | The Spectrum home card. | Leave out |
| 6 | Client Home, Steps card | Phase groups expand; the chevron turns and the body slides in. | A flat step card. No expand motion. | Leave out |
| 7 | Client toasts | The toast slides up, fades in and fades out. | The toast fades in only. No exit motion. | Leave out |
| 8 | Client drills | Scrim fades in, the dialog slides in, close waits so it animates out. Bottom sheet on phones. | A Spectrum dialog with fade and zoom. No custom slide, no animated close. | Leave out |
| 9 | Greeting card, every role | "Ambient" motion: 14 floating, twinkling particles. | No particles. The Ambient choice does nothing. | Leave out |
| 10 | Greeting card, settings button | A sliders button opens a popover for hero skin, sidebar skin and motion. | No button. The settings are in Profile › Appearance. | Leave out |
| 11 | Client Incorporation | "Days to COI" counts up from 0. | A plain number. | Leave out |
| 12 | Client Incorporation pages | Cards fade up and lift on hover. Bars grow in. Phase rings. Four donuts with clickable parts. | No card motion. Split bars, no rings, no donuts. | Leave out |
| 13 | Client Filings | A donut whose numbers count up. | A "Filings by month" chart. No count-up. | Leave out |
| 14 | Client filing detail and side panel | The detail fades up, the side panel slides in, phones get a sliding sheet, the day popover fades up. | They appear at once. | Leave out |
| 15 | Client Compliances, focus track | The current step dot pulses. | No pulse. | Leave out |
| 16 | Client segmented switches | A thumb slides under the active segment. | Plain buttons. (Credentials keeps its thumb.) | Leave out |
| 17 | Client empty and error states | A bobbing robot face with a speech bubble and "Ask VCFO why". | The plain empty state. | Leave out |
| 18 | Client first visit | An Ask VCFO note rises above the launcher with a greeting and two questions. | Removed. | Leave out |
| 19 | Client Credentials loading | A shimmering skeleton. | "…" in the ID tiles. | Leave out |
| 20 | Client Library, empty | Four book bars grow up one after another. | Static bars. | Leave out |
| 21 | Client Library, book hover | A springy lift and tilt with a shadow, a press-in on click. | A plain lift and tilt, no shadow. | Leave out |
| 22 | Client Documents and Library skeletons | A shimmer sweep. | A weaker opacity pulse. | Leave out |
| 23 | Staff Ask VCFO panel | A drawer slides in from the right with a scrim. | A floating card fades up. No scrim. | Leave out |
| 24 | Lead sidebar, Clients | Clients opens a list of each client; rows stagger in and the active pill slides. | No client list under Clients. | Leave out |
| 25 | Lead Clients page | Cards stagger in, lift on hover, press down on click. | Static cards. | Leave out |
| 26 | Manager Projects | A pill slides between Table and Board; the views crossfade; cards stagger in. | Instant switch, no stagger. | Leave out |
| 27 | Manager dashboard, phase timeline | Phase bars grow from 0. | Static bars. | Leave out |
| 28 | Manager dashboard sections | Rows fade up one by one; progress bars grow. | Static. | Leave out |
| 29 | Manager dashboard, Due soon | Rows slide in from the left one by one. | Static. | Leave out |
| 30 | Sign-in page | The headline reveals word by word with a blur; showcase items stagger; the form card springs up. | A static sign-in screen. | Leave out |
| 31 | Public landing | Tilt cards, magnet buttons, shiny text, blur reveals, a product plane, count-up. | A new landing with its own scroll reveal and count-up. A swap, not a full loss. | Leave out |
| 32 | Staff Audit log | Rows fade up one by one. | Static. | Leave out |
| 33 | Staff Knowledge bank | Cards fade up one by one. | Static. | Leave out |
| 34 | Staff Vault | Cards fade up one by one. | Static. | Leave out |
| 35 | Staff Announcements page | A click on a row opens the live popup that flies back to the bell. | A click opens a static dialog with previous and next. | Bring back (done) |
| 36 | Top bar, Notifications bell | Every role has the bell and its popup. | Back for the super admin (a05c539). The developer has none. | Leave out |
| 37 | Staff accent buttons | The button scales down when pressed. | The plain button, no press scale. | Leave out |
| 38 | Client Documents and Credentials controls | Smooth colour change on segments; cards ease border and shadow on hover. | No transitions. | Leave out |

Kept and still working: the bell popups that fly back (genie), the staff sidebar hover peek, the
Visor and Ask launcher peek, the L1 loading skeletons, the phase celebration (unused before too).
Note: a global rule now turns off all motion when the device or Profile › Appearance asks for
reduced motion.
