# Client dashboard v6: finalized card picks

Owner decision, 2026-10-08. Source: the "v5 options – card by card" page on
https://claude.ai/artifact/V5wFoBBsQ3E2FFebgQ4rvW (18 rows, options A–E).

v6 contains only the finalized cards, each designed on its own. After the owner approves them, v7 merges the cards into the full client dashboard.

| # | Card | Pick | Owner changes |
|---|---|---|---|
| 1 | Greeting + metrics | **B** | Put a report button beside the 50% ring: download icon + the word "Report", without the word "Download". Move items closer to lower the height. Keep it simple and clean. |
| 2 | Current step | **D** | Add simple status badges on the steps: Completed · In progress · Waiting for you |
| 3 | Needs from you | **E** | Unchanged |
| 4 | What SBC is doing | **D** | Every sub-item (for example "Subscriber Details review") gets a link icon that opens that exact step |
| 5 | Progress + milestones | **D** (timeline bars with a today line) | See "Card 5: editable timeline" below |
| 6 | Step list | **B** + the **Owner** column from A | — |
| 7 | Compliance status | **A** (donut + legend) | See "Card 7: drill-down pop-up" below |
| 8 | Compliance by area | **A** + the top sliding selector from **E** | Selector: All · MCA · GST · Income tax · Payroll · FEMA. It sits inside A. |
| 9 | What is next | **A** + the urgency sub-card from **E** | The urgency sub-card (one deadline in focus) sits inside A |
| 10 | Registrations | Same pattern as card 8 | Table with a sliding selector: All · Tax · Labour · Business · IP · FEMA |
| 11 | Post-incorporation setup | **New design** | None of A–E was accepted. The designer proposes a new card. |
| 12 | Company IDs | **A** | Eye (i) button → password pop-up ("Confirm it's you") → value shown, as in the brief |
| 13 | Team / contact | **Sidebar** | Simple. Real photo of the Project Manager and the Project Lead. **Icons only**: WhatsApp · Phone · Email · Microsoft Teams |
| 14 | Alerts | Same pattern as card 9 | — |
| 15 | Recent documents | **B** | — |
| 16 | Recent activity | **E** | Date first, then the activity name |
| 17 | Ask VCFO card | **Removed** | Replaced by the bot launcher (see "Ask VCFO bot" below) |
| 18 | Help strip | **Removed** | Moves into the sidebar as **Customer support**: Farhat, +91 90597 90014. Icons: WhatsApp · Email · Teams · Call |

## Card 5: editable timeline

| Item | Rule |
|---|---|
| Display | Timeline bars per phase (Part A, Part B, …) with a "today" line. Bars move when dates change (for example, Part A extended). |
| Who edits | Admin and manager edit directly. The client can edit, but saving sends a **change request** for approval. |
| Editor | "Edit" opens a pop-up with a timeline editor in the style of a video-editing tool (inspiration only, not a copy). Drag the start and end handles, stretch or compress a phase, move a phase, snap to days, show the date read-out, undo, and preview the effect on the following phases. |
| Client request | The same editor, with a reason field and a "Send request" button. The request shows as pending until a manager approves or rejects it. |
| Notifications | On every approved change, an email and a WhatsApp message go to everyone on the client: admin, manager, lead and client. Design previews of both messages. |
| Impress managers | Clear before/after comparison of the dates, a "slipped by N days" figure, a record of who changed what and when, and a critical-path highlight |

## Card 7: drill-down pop-up

| Trigger | Result |
|---|---|
| Hover over a donut slice | A small chat-bubble tooltip naming the status and count, for example "Filed · 12" |
| Click a slice or a legend item (Filed · Due soon · Overdue · Upcoming) | A pop-up that lists exactly those items |
| Click the centre number | The same pop-up, showing all items |
| Inside the pop-up | A sliding segmented selector at the top (All · Filed · Due soon · Overdue · Upcoming, styled like card 3 E). The clicked status is pre-selected, and the user can switch between statuses inside the pop-up. |

## Ask VCFO bot (replaces card 17)

| Item | Rule |
|---|---|
| Launcher | An animated robot-like character in the **bottom-right** corner. It pops up from the bottom with the label "Ask VCFO" above it. |
| Click | Opens the chatbot window |
| Assets | The owner will share the bot animation and chatbot screens later. Design a placeholder bot and a chatbot window now, then refactor when the assets arrive. |

## Sidebar additions

| Block | Content |
|---|---|
| Your team | Project Manager and Project Lead: photo, name, role, icon buttons (WhatsApp, Phone, Email, Teams) |
| Customer support | Farhat · +91 90597 90014 · icon buttons (WhatsApp, Email, Teams, Call) |
