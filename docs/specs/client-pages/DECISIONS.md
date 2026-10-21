# Client pages: owner decisions

On 2026-10-09 the owner said "go with picks for everything else". Every open question below now uses the main chat's pick.

## Shared

| Item | Decision |
|---|---|
| Flow-chart style | **E · Focus track** (Design Lab, https://claude.ai/artifact/D9fKo5KjbeTiTpXALZ6r9J) plus F's sub-step ticks. Use it everywhere a flow or timeline appears. Edge labels show on hover only. |
| Step status icons | Set A · Solid glyphs (rule 18) |
| Mobile drill-downs | Bottom sheet |
| Prototypes | None until the owner asks (process rule). Owner asked for prototype v6 as a downloadable HTML file (2026-10-12). |
| Icons (all pages) | Option 4 · Lucide 2 px coloured line in a 32 px pale-tint tile, 8 px radius, one glyph + colour per type (owner pick, 2026-10-12; https://claude.ai/artifact/NVSyHh8Bz8ubS6nZLGk598). Lucide everywhere else. |
| Before / After incorporation | Sliding toggle in the top bar switches the whole prototype state (owner, 2026-10-12) |
| Sidebar contacts | Compact rows, smaller avatars, hover actions (owner, 2026-10-12) |

## Home dashboard

| Question | Decision |
|---|---|
| Alerts before COI | Dated items only |
| Documents + activity | Bottom row |
| Step count | Both, labelled: "Step 7 of 14 · 7 of 38 tasks" |
| 👍/👎 on answers | Keep |
| "Pick up where you left off" | 1 item |
| First-visit bot note | Once per client |
| Bubble text | "Ask VCFO" |
| Robot while scrolling | Sinks down |
| Peek animation | Plays once when the chat opens |
| Antenna moods | Green = answered, grey = can't answer |
| Avatar face | Always smiling, in every state; moods show only via antenna / glow / motion (owner, 2026-10-12) |
| "SBC help desk" label | Keep, under "Your team" |
| Timeline change-request warning | Stays visible |
| Progress ring | SPICe+ steps only (43%) on every page |

## Compliances

| Question | Decision |
|---|---|
| Tile colour | By status |
| Areas | 5 (MCA · GST · Income tax · Payroll · FEMA) |
| Week starts | Monday |
| "You approve" step | Design now, build later |
| Mobile calendar | Week strip + agenda |
| Detail view | Calendar: pop-up · Filings: side panel |
| Timeline view: can clients drag filing windows? | Yes, the planning window only (move / resize / ←→ / Undo); due dates stay fixed and filed windows are locked. Permission checked in the repository (own company only). Owner, 2026-10-17 (TL-13). |
| Status chips filter the grid? | No. They open the drill-down only. |
| Header | Compact donut, top right above Next deadline (owner pick) |
| Next deadline card | A · Light card + navy accent (owner pick) |

## Incorporation

| Question | Decision |
|---|---|
| Landing | Option E final (owner pick + changes) is approved; redo screens #03–#26 to match |
| Loading | L1 skeleton (shown after 150 ms, held at least 300 ms) |
| Client uploads | Only files the lead asked for. Answers stay read-only. |
| Approve + Submit | One "Approve & submit" button with Undo |
| Approve without NOC | Blocked; scroll to the upload |
| /progress | Keep the redirect, no design |
| Registration group names | Check against the code before the build |
| Focus track on step page and phase map | Yes |
| "As in VCFO Suite" redesign | Approved (2026-10-12): phase progress bars, in-place accordions with → to step pages, What's this? per step, status brief + board resolution header buttons, Focus-track journey rail, Days-to-COI tile, set-A icons with tooltips |
| Days to COI before COI | Count down to the manager-set incorporation window end; after COI show the real date |
| Phase end date (Post-inc., Registration) | Latest step date in the phase |
| Progress ring | SPICe+ only (43%), not all 48 steps |
| What's this? | Opens the Ask VCFO drawer (as in the code) |
| Phase page | Steps open in place; the phase name still links to the phase page |

## Documents & Knowledge Bank

| Question | Decision |
|---|---|
| Documents layout | A refined (owner pick) + E's per-step progress bars |
| Bookshelf | Shelf A · Classic shelves |
| Folders | Phase → step by default; category as a toggle |
| Replaced files | Shown, hidden by default (h toggle) |
| File-type colours | Thin band only; status is always a separate badge |
| Default grouping | By step; the choice is remembered |
| Board resolution | A row with a "Final" badge, no separate card |
| Upload on the Documents page | Only against open requests |
| "Updated" chip | Blue |
| Sidebar name | "Knowledge Bank" (route stays /library) |
| Designer's 4 choices | Keep: real step names in ZIPs · missing files as dashed rows · readable row names · progress tooltip |
| Extras | Yes: ZIP download, stale-proof flag, topic → documents link, camera capture, shared preview. Later: version history, share by link. |

## Team, Updates, Audit, Settings

| Question | Decision |
|---|---|
| Who can invite | Primary contact only |
| Turning email off | Locked for documents, steps, deadlines and timeline; optional for news and the weekly summary |
| SBC staff in client Audit | Yes, by name and role; no emails or internal metadata |
| Invite method | Set-password link (temp password until it ships) |
| Merge Announcements + Notifications | Not now |
