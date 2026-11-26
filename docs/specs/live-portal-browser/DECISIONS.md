# Card agents — build decisions (26 Nov 2026)

The owner asked for the whole plan to be built without waiting for approvals. These are the
decisions taken. Each one can be changed later; the reason is given so it can be judged.

| # | Decision | Reason |
|---|---|---|
| B1 | The live browser is our own small Node service (`services/live-browser/`). It runs Chromium with Playwright and streams the screen with the Chrome DevTools screencast over a WebSocket. Input from the portal tab goes back through CDP input events. No VNC, no X server. | It runs and tests with the Chromium and Playwright already used by the e2e suite, needs no extra images, and keeps the portal session inside SBC's AWS account. AgentCore Browser or neko can replace it later behind the same broker API. |
| B2 | The live browser service imports the VCFO Assist engine, guards and recipes straight from `extensions/vcfo-assist/src` and adds a Playwright `PortalPort`. The files are not moved. | The extension keeps working unchanged; one copy of the engine and the guards. |
| B3 | One Chromium process per session, in a pool service on ECS Fargate (Mumbai). A fresh temporary profile per session, deleted at the end. | Fast start (no task launch per session), full isolation between clients, nothing kept. |
| B4 | Everything is OFF by default. A route is live only when its env is configured AND the admin turns it on in Settings > Agents. Live portal hosts still need their pack to be `cs-cleared` and listed in `ASSIST_LIVE_PACKS`. | The code can be deployed today without changing what anyone can do. |
| B5 | GST returns (GSTR-1, GSTR-3B, GSTR-9, GSTR-9C), GST notices and GSTIN checks use the GSTZen API (`kind: 'api-file'`). | Firm policy SBC-STD-AI-02 already allows a contracted GSP with the taxpayer's consent. |
| B6 | One migration, `0073_card_agents` (six new tables, additive). | Safe to apply on RDS before deploy; nothing existing changes. |
| B7 | OTPs are never stored. An OTP typed by staff or the client goes straight to GSTZen or the portal; Suite keeps only that it was asked for and answered. | Legal review: OTP forwarding and storage are prohibited. |
| B8 | API-route tasks are hidden from the Chrome extension's catalog. | They are not browser work. |
