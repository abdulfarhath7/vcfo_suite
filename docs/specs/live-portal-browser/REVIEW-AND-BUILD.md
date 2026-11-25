# Card agents and the live portal: review, gaps, and how to build it

Written 25 Nov 2026 in ASD-STE100 style. Read `CARD-AGENTS.md` and `PLAN.md` first.

## 1. Criticism of the plan (honest)

| # | Problem | Why it matters | Do this instead |
|---|---|---|---|
| C1 | Legal comes last in the plan | The GST terms forbid unofficial interfaces. The CS has not answered. Firm policy SBC-STD-AI-02 blocks portals. Weeks of build can be wasted. | Send the CS letter this week (questions 30 and 32). Build only what is legal now until the reply. |
| C2 | The value is not in typing | Typing a GST form takes about 30 minutes. Collecting the data takes days. | Build the "Before I fill" check and document collection first. They are legal now and save the most time. |
| C3 | No volume numbers | If SBC files 10 GST registrations a month, weeks of browser work may not pay back. | Count filings per form per month. Build agents for the top 5 forms only. |
| C4 | A browser for everything | Some portals have an official machine interface. A browser is the weakest route there. | GST returns: a GSP (GST Suvidha Provider) API. ITR: the Income Tax ERI route. TDS returns: the FVU file (already planned). Use the browser only where no official interface exists (MCA, most registrations). |
| C5 | Upkeep is not planned | Portals change their forms. Each recipe breaks some day. 50 recipes means steady repair work. | Give one person ownership of recipes. Keep the healer and the recorder. Track breaks per portal. |
| C6 | The OTP goes to the client's phone, not to staff | For GST and many portals, the OTP and the Aadhaar link go to the director's or the signatory's mobile. Forwarding the OTP is prohibited in the legal review. | Let the client join the "Your turn" step from their client portal and type their own OTP (see G1 in section 2). |
| C7 | GST Aadhaar authentication is a separate step | After REG-01, the portal sends a link to each promoter and the signatory. They act on their own phones. | The status tracker sends each person a reminder and tracks who has finished. |
| C8 | DSC cannot work in a cloud browser | The USB token is on the signer's computer. | Save the draft (TRN or PDF). The signer signs on their own PC. EVC works in the cloud browser. |
| C9 | One SBC IP address for all clients | A portal can flag many logins from one IP as a bot. | Ask the CS (question 32). Keep the extension as a fallback that uses the user's own IP. |
| C10 | "Copy and paste code from somewhere" | Pasted code has no updates, unclear licences and hidden bugs. The tools that file Indian portals for you (Skyvern, TaxPido and others) solve captchas or store passwords, which the legal review rates Prohibited. | Use maintained open-source projects as dependencies (images or packages), not pasted source. Reuse our own code (section 4). |

## 2. What the plan is missing

| # | Missing item | Add |
|---|---|---|
| G1 | The client as a participant | "Your turn" can go to the client portal. The client types their own OTP in the live view. Staff watch. |
| G2 | Portal session timeouts | The GST portal logs out after a short idle time. The agent saves the draft before a timeout and tells the user. |
| G3 | Portal down or slow | Retry, then "Portal is not responding. Your draft is saved." Never re-submit. |
| G4 | Draft and resume | A run can stop and resume later with the TRN or SRN. The card shows "Draft saved". |
| G5 | Several signatories and directors | One gate per person. The card lists who has finished. |
| G6 | Payment failure | The agent reads the payment status. It never pays again by itself. |
| G7 | Evidence for ICAI and ICSI | Keep who prepared, who checked, who signed, the IP address and the time for each filing (G14, G17). |
| G8 | Metrics | Minutes saved per form, fields filled, heals and breaks per portal, cost per run. |
| G9 | Training | A practice mode on the mock portals, so staff learn without the live site. |
| G10 | Rollout control | A per-portal switch, a per-user pilot list and the kill switch. |
| G11 | Data protection (DPDP Act) | The AWS data processing terms, Mumbai region only, and a client consent line in the engagement letter. |
| G12 | Cost limits | A cap on live browser hours per month and an alert. |

## 3. Open-source and ready-made parts

There is no open-source "Indian government portal filing agent" that is legal to use. Every
infrastructure part exists already.

| Need | Option | Licence | Verdict |
|---|---|---|---|
| Cloud browser with live view and human take-over | Amazon Bedrock AgentCore Browser (managed) | AWS service | First choice for the spike. It has live view with take-over, Playwright over CDP, Chrome policies, a custom root CA and custom extensions. Confirm the Mumbai region in the console. |
| Self-hosted interactive browser stream | neko (`m1k1o/neko`, Docker, WebRTC) | Apache-2.0 | Second choice, if AgentCore is not in Mumbai or cannot be embedded in Suite. Built for "watch and take control". |
| Self-hosted browser API with a session viewer | Steel Browser (`steel-dev/steel-browser`) | Apache-2.0 | Good CDP API. Human control in the self-hosted viewer is not confirmed. |
| Simple screen stream | noVNC + Xvfb + x11vnc | MPL-2.0 / GPL | Works everywhere. Slower and plainer than WebRTC. |
| Browserless | `browserless/browserless` | SSPL-1.0 or commercial | Avoid. Live streaming is a paid feature, and SSPL is a risk for a closed product. |
| Skyvern | AI browser agent | AGPL | Do not use. It solves captchas (Prohibited) and is AGPL. |
| browser-use, Stagehand | AI browser agents | MIT | Not needed. Our recipes are fixed steps and the AI only picks a field (G10). |

## 4. What is already built in this repository

| Part | Where | Reuse level |
|---|---|---|
| Run engine, safety guards, heal ladder, signed recipes, 5 MCA recipes | `extensions/vcfo-assist/src/` | About 80% of the agent. Only the browser adapter changes. |
| Browser adapter interface | `extensions/vcfo-assist/src/engine/ports.ts` (`PortalPort`) | Write one Playwright version of it. |
| Field highlight on the portal | `extensions/vcfo-assist/src/portal/overlay.ts` | As is |
| Fill animation (typing, cursor, progress) | `src/components/ask/fill/` | As is |
| "Before I fill" data (missing items, sources, SharePoint, ask the client) | `GstApplicationCard.tsx`, `ConfirmClientValues.tsx`, `use-gst-registration.ts`, `use-assist-profile.ts` | As is |
| Task list mapped to cards | `src/lib/assist-agents/catalog.ts`, `src/components/assist-profile/agent-hint.ts` | Extend |
| Robot avatar with moods | `extensions/vcfo-assist/src/ui/Robot.tsx` | Move into Suite |
| Ask VCFO corner dock | `src/components/ask/AskShellMount.tsx`, `AskAvatarLauncher.tsx` | Extend |
| ARN and SRN write-back, certifier checks, kill switch | `src/lib/assist-agents/`, `src/lib/registrations/gst-assist.ts` | As is |

New code is about five pieces: the Playwright adapter, the session API, the card dock, the
"Before I fill" screen (mostly existing parts) and the live mode view.

## 5. How to build it

```
 WEEK  0 ----- 1 ----- 2 ----- 3 ----- 4 ----- 5 ----- 6 ----- 7 ----- 8 ----->
 S0    [CS letter + volume count]
 S1          [SPIKE: AgentCore vs neko, 3 days]
 S2                [Card robot + "Before I fill"]  <- legal now, value now
 S3                        [Playwright adapter + session API]
 S4                                [Live mode + fill animation, MCA mock]
 S5                                        [Part A end to end on mock]
 S6                                                [CS reply?] -> live MCA pilot
 S7                                                        -> GST (if the CS allows)
```

| Stage | Work | Exit check |
|---|---|---|
| S0 | Send the CS letter. Count filings per form per month. Pick the top 5 forms. | Letter sent. Top 5 list agreed. |
| S1 | Spike: open a public page of mca.gov.in and gst.gov.in from Mumbai in AgentCore Browser and in neko. Embed each live view in a test Suite page. Type into it. Measure the delay. Check that no portal blocks the IP. No login. | One option chosen, with numbers. |
| S2 | One robot per card. "Before I fill" screen with the actions (SharePoint, Zoho, ask the client, type now, I type on the portal, skip). | Works for GST, SPICe+ Part A and AOC-4 cards. `npm run check` passes. |
| S3 | `PlaywrightPortalPort` (CDP to the chosen browser), session API, one session per filing, time limits, staff-only stream token. | Engine tests pass with the new adapter on the mock pages. |
| S4 | Live mode inside the card page: watch only, fill animation, "Your turn" banner, portal tab for input, pop-out. | A person can watch a fill and type the mock login in the portal tab. |
| S5 | SPICe+ Part A on the mock: Start, Before I fill, login, fill, certifier, Submit, SRN saved. | Playwright end-to-end test passes. |
| S6 | Live MCA pilot after the CS reply and the policy change. | Agreed number of supervised filings, zero guard breaks. |
| S7 | GST REG-01 (recording, mock, recipe), only if the CS allows it. Else the GSP route. | Mock run reaches the TRN. |

## 6. Decisions for the owner

| # | Decision | Recommendation |
|---|---|---|
| D1 | Send the CS letter now | Yes, this week |
| D2 | Count monthly filings per form | Yes, before S2 |
| D3 | Cloud browser option | Spike AgentCore Browser first, neko second |
| D4 | GST returns through a GSP API | Yes, ask the CS and get a GSP quote |
| D5 | Clients type their own OTP from the client portal | Yes |
| D6 | Keep the extension as a fallback | Yes |

## Sources

- Steel Browser: https://github.com/steel-dev/steel-browser
- neko: https://github.com/m1k1o/neko
- Browserless licence: https://github.com/browserless/browserless and https://www.browserless.io/platform/self-hosted
- AgentCore Browser: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/browser-onboarding.html
- AgentCore regions: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agentcore-regions.html and https://aws.amazon.com/bedrock/agentcore/faqs/
- AgentCore custom extensions: https://aws.amazon.com/about-aws/whats-new/2026/01/amazon-bedrock-agentcore-browser-custom-extensions
- AgentCore Chrome policies and root CA: https://aws.amazon.com/about-aws/whats-new/2026/03/agentcore-browser-policies-root-ca
- AgentCore live view: https://docs.aws.amazon.com/it_it/bedrock-agentcore/latest/devguide/session-replay-console-usage.html
