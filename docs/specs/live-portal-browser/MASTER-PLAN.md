# VCFO Suite agents — master plan in screens

Written 25 Nov 2026. It joins `PLAN.md`, `AGENTS.md`, `CARD-AGENTS.md`, `REVIEW-AND-BUILD.md`
and `GSTZEN.md`. The screens are sketches, not final design. They use the Spectrum shell.

## 0. The big picture

```
                          +--------------------------------------+
                          |            VCFO SUITE                |
                          |  cards: incorporation, registration, |
                          |  compliance . Ask VCFO . card robots |
                          +-------+---------------+--------------+
                                  |               |
              API route           |               |   browser route
       (GST returns, data)        |               |   (MCA, registrations)
                                  v               v
                 +----------------------+   +---------------------------+
                 |   GSTZEN (GSP API)   |   | LIVE BROWSER on SBC AWS   |
                 |  GSTR-1/3B/9/9C, 2B, |   | Mumbai, one per filing    |
                 |  ledger, notices,    |   | AgentCore or neko         |
                 |  GSTIN check         |   | + our engine and recipes  |
                 +----------+-----------+   +-------------+-------------+
                            |                             |
                            v                             v
                 +----------------------+   +---------------------------+
                 |  GSTN (official API) |   | MCA, REG-01, EPFO, ESIC,  |
                 +----------------------+   | DGFT, Udyam, State ...    |
                                            +---------------------------+

  THE PERSON ALWAYS: login . captcha . OTP . Aadhaar . DSC . Submit . Pay
```

## 1. Staff home: "Agents today"

```
+----------------------------------------------------------------------------------+
| VCFO  | Good morning, Divya                                       [Ask VCFO]     |
|-------+--------------------------------------------------------------------------|
| Home  |  AGENTS TODAY                                                            |
| Proj. |  +--------------+ +--------------+ +--------------+ +--------------+     |
| Regs  |  | YOUR TURN    | | RUNNING      | | FILED TODAY  | | DUE IN 7 DAYS|     |
| Comp. |  |     3        | |     2        | |     5        | |    11        |     |
| Runs  |  | needs you    | | watch live   | | ARN saved    | | ready: 8     |     |
| Ask   |  +--------------+ +--------------+ +--------------+ +--------------+     |
|       |                                                                          |
|       |  YOUR TURN (3)                                                           |
|       |  (robot) GSTR-3B Agent   Kestrel    Client OTP sent, waiting  [Open]     |
|       |  (robot) Name Res. Agent Orbit Labs Type the captcha          [Open]     |
|       |  (robot) GST Reg Agent   Nimbus     3 values missing          [Fix]      |
|       |                                                                          |
|       |  RUNNING (2)                                                             |
|       |  (robot) GSTR-1 Agent    Kestrel    Saving return  ####----   [Watch]    |
|       |  (robot) AOC-4 Agent     Vega Ltd   Page 4 of 9    ######--   [Watch]    |
+----------------------------------------------------------------------------------+
```

## 2. Registrations page: one robot on each box

```
+----------------------------------------------------------------------------------+
| Registrations                                                     [Search...]    |
|----------------------------------------------------------------------------------|
| +------------------+ +------------------+ +------------------+ +----------------+|
| | GST Registration | | LUT Filing       | | PF Registration  | | ESI Registr.   ||
| | (robot) GST Reg  | | (robot) LUT      | | (robot) PF       | | (robot) ESI    ||
| | [Prepares data]  | | [Prepares data]  | | [Coming]         | | [Coming]       ||
| | 12 of 18 granted | | 9 of 12 filed    | | 7 of 10 granted  | | 6 of 10        ||
| +------------------+ +------------------+ +------------------+ +----------------+|
| +------------------+ +------------------+ +------------------+ +----------------+|
| | Professional Tax | | IEC              | | Udyam (MSME)     | | Trademark      ||
| | (robot) PT       | | (robot) IEC      | | (robot) Udyam    | | (robot) TM     ||
| | [Coming]         | | [Coming]         | | [Coming]         | | [Coming]       ||
| +------------------+ +------------------+ +------------------+ +----------------+|
|                                                                                  |
| Badges:  [Ready] fills live . [Practice] mock only . [Prepares data] . [Coming]  |
+----------------------------------------------------------------------------------+
```

## 3. A card page with the two robots

```
+----------------------------------------------------------------------------------+
| Registrations > GST Registration > Kestrel Robotics                              |
|----------------------------------------------------------------------------------|
|  GST TRACKER                                              Scheduled: 28 Nov 2026 |
|  (1) Application filed  (2) Aadhaar  (3) SRN  (4) Outcome                        |
|   o----------------------o------------o-----------o                              |
|                                                                                  |
|  GST APPLICATION (REG-01)                     Data 85% ready                     |
|  [#############################------]                                           |
|                                                                                  |
|                                       +------------------------------------+     |
|                                       | (robot) GST Reg Agent         [x]  |     |
|                                       | Kestrel Robotics . REG-01          |     |
|                                       | Level: Prepares data only          |     |
|                                       | 4 required items missing           |     |
|                                       |                                    |     |
|                                       |            [ Start ]               |     |
|                                       +------------------------------------+     |
|                                        (robot) GST Reg Agent  (robot) Ask VCFO   |
+----------------------------------------------------------------------------------+
```

## 4. "Before I fill"

```
+----------------------------------------------------------------------------------+
| (robot) GST Reg Agent . Kestrel Robotics . REG-01               BEFORE I FILL    |
|----------------------------------------------------------------------------------|
| Needs 40 values + 6 docs    Have 34 + 4    Missing 6 + 2    [######----] 85%     |
|----------------------------------------------------------------------------------|
| READY (34)                                                         [show all v]  |
|   OK  Legal name     KESTREL ROBOTICS PVT LTD          from: tool                |
|   OK  PAN            AAKCK1234F                        from: tool                |
|   OK  Address proof  rent-agreement.pdf                from: SharePoint          |
|----------------------------------------------------------------------------------|
| NEEDS YOUR CONFIRMATION (2)                                       [Confirm all]  |
|   ?   Trade name     Kestrel Robotics                      [Confirm] [Edit]      |
|----------------------------------------------------------------------------------|
| MISSING - REQUIRED (4)                                                           |
|   X   District       client's address proof            [Get from SharePoint  v]  |
|   X   HSN codes      client                     [Ask the client  v] HSN check OK |
|   X   Signatory photo  document                        [Ask the client       v]  |
|   X   Jurisdiction   GST portal                        [I type on portal     v]  |
|----------------------------------------------------------------------------------|
| MISSING - OPTIONAL (2)                                                           |
|   -   Website        [Type it now: _______________ ]                             |
|----------------------------------------------------------------------------------|
|  [Save and come back]                                 [ Fill now ] (locked)      |
+----------------------------------------------------------------------------------+
```

## 5. Live mode: watching the fill (browser route)

```
+----------------------------------------------------------------------------------+
|  | MCA PORTAL - live, watch only                       | (robot) Name Res. Agent |
|s |                                                     | Orbit Labs . SPICe+ A   |
|i |  Proposed name 1  [ORBIT LABS PRIVATE LIMITED]      | Page 1 of 2             |
|d |  +=========================================+        | [##########----] 14/20  |
|e |  | Proposed name 2  [ORBIT TECH LABS PRI|] |  <-box | OK  Name 1              |
|  |  +=========================================+        | ... Name 2  (typing)    |
|  |  Significance     [ ...                  ]          |     Significance        |
|  |  Main object      [ ...                  ]          |     Main object         |
|  |                                                     |                         |
|  |               (cursor moves to each field)          | [Pause]  [Pop out]      |
+----------------------------------------------------------------------------------+
  sidebar folded        portal ~70%                          agent ~30%
```

## 6. "Your turn" (browser route)

```
 IN THE APP                                   PORTAL TAB  (title: "Your turn")
+---------------------------------------+    +-------------------------------------+
| (robot) Name Res. Agent               |    | MCA LOGIN                           |
| +-----------------------------------+ |    |  User ID   [ you type ]             |
| | YOUR TURN                         | |    |  Password  [ you type ]             |
| | Type the captcha on the           | |    |  +===============================+  |
| | portal tab.                       | |    |  | Captcha [ you type ]  <- box  |  |
| |        [ Go to portal tab ]       | |    |  +===============================+  |
| +-----------------------------------+ |    |  [Login]                            |
| sound . notice . title flash          |    +-------------------------------------+
+---------------------------------------+
           after you type:  "Thanks, I continue"  -> the fill starts again
```

## 7. GST return agent (API route, no browser)

```
+----------------------------------------------------------------------------------+
| Compliances > GSTR-3B > Kestrel Robotics > Oct 2026          (robot) GSTR-3B     |
|----------------------------------------------------------------------------------|
|  STEPS   (1)Data  (2)Consent  (3)Save  (4)Check  (5)Pay  (6)File  (7)ARN         |
|           OK        OK          OK      <now>                                    |
|----------------------------------------------------------------------------------|
|  PORTAL'S OWN FIGURES (from GSTZen)                                              |
|  +------------------+-------------+-------------+-------------+                  |
|  |                  |   IGST      |   CGST      |   SGST      |                  |
|  +------------------+-------------+-------------+-------------+                  |
|  | Tax due          |  1,20,000   |    45,000   |    45,000   |                  |
|  | ITC used         |    90,000   |    30,000   |    30,000   |                  |
|  | Cash to pay      |    30,000   |    15,000   |    15,000   |                  |
|  +------------------+-------------+-------------+-------------+                  |
|  Interest: 0      2B matched: 96%  (4 invoices not in 2B)  [See list]            |
|----------------------------------------------------------------------------------|
|  CERTIFIER CHECKS                                                                |
|  [ ] I checked the figures against the books                                     |
|  [ ] I checked the 4 unmatched invoices                                          |
|----------------------------------------------------------------------------------|
|  Next: YOUR TURN - pay Rs 60,000 from your own bank, then the EVC OTP            |
+----------------------------------------------------------------------------------+
```

## 8. Client portal: the client types their own OTP

```
+-------------------------------------------+
| Kestrel Robotics            (client view) |
|-------------------------------------------|
|  ACTION NEEDED                            |
|  +-------------------------------------+  |
|  | SBC is filing your GSTR-3B (Oct).   |  |
|  | The GST portal sent an OTP to       |  |
|  | your mobile ending 4821.            |  |
|  |                                     |  |
|  |   OTP  [ _ _ _ _ _ _ ]   [Send]     |  |
|  |                                     |  |
|  | SBC never sees or keeps this OTP    |  |
|  | after use.                          |  |
|  +-------------------------------------+  |
+-------------------------------------------+
```

The OTP goes straight to GSTZen (API route) or to the live portal (browser route). It is never
stored in Suite and never forwarded.

## 9. Agent runs: the control room (`/app/lead/assist-runs`)

```
+----------------------------------------------------------------------------------+
| Agent runs                     [All v] [This week v] [Agent v]     [Search...]   |
|----------------------------------------------------------------------------------|
| AGENT            CLIENT        ROUTE    STATE             TIME   RESULT          |
|----------------------------------------------------------------------------------|
| GSTR-3B          Kestrel       API      Your turn: OTP    4 m    -        [Open] |
| Name Res.        Orbit Labs    Browser  Your turn: login  1 m    -        [Open] |
| GSTR-1           Kestrel       API      Running  ####--   2 m    -       [Watch] |
| AOC-4            Vega Ltd      Browser  Running  ######-  9 m    -       [Watch] |
| SPICe+ Part B    Nimbus        Browser  Draft saved       -      SRN pending     |
| GSTR-3B          Vega Ltd      API      Filed             6 m    ARN AA29..  OK  |
| GST Reg          Nimbus        -        Waiting for data  -      3 missing       |
|----------------------------------------------------------------------------------|
| Open run: log . fields filled . refusals . heals . who did each "your turn" . IP |
+----------------------------------------------------------------------------------+
```

## 10. Admin: agent settings

```
+----------------------------------------------------------------------------------+
| Settings > Agents                                                 (admin only)   |
|----------------------------------------------------------------------------------|
|  KILL SWITCH         [ OFF ]   stops every agent at once                         |
|----------------------------------------------------------------------------------|
|  ROUTES             STATUS         LIVE      PILOT USERS          CS OPINION     |
|  GSTZen API         contracted     [ ON ]    all staff            not needed     |
|  MCA (browser)      mock only      [ OFF ]   Divya, Arjun         waiting        |
|  GST REG-01 (brw)   prepare only   [ OFF ]   -                    waiting        |
|  EPFO / ESIC        coming         [ OFF ]   -                    not asked      |
|----------------------------------------------------------------------------------|
|  LIMITS                                                                          |
|  Live browser hours this month     38 / 100   [###########-------------]         |
|  Idle stop  15 min    Hard stop  90 min    One run per portal login  [ON]        |
|----------------------------------------------------------------------------------|
|  RECIPES   5 MCA beta . 0 live . 2 patch proposals waiting  [Review patches]     |
+----------------------------------------------------------------------------------+
```

## 11. Agent results dashboard (owner)

```
+----------------------------------------------------------------------------------+
| Agent results                                           Nov 2026     [Export]    |
|----------------------------------------------------------------------------------|
| +----------------+ +----------------+ +----------------+ +----------------+      |
| | FILINGS        | | HOURS SAVED    | | AUTO-FILLED    | | BREAKS         |      |
| |   142          | |   96 h         | |   97% fields   | |   3 portals    |      |
| | +38 vs Oct     | | ~40 m / filing | | target 95%     | | 2 fixed        |      |
| +----------------+ +----------------+ +----------------+ +----------------+      |
|                                                                                  |
|  FILINGS BY AGENT                         TIME PER FILING (minutes)              |
|  GSTR-3B   ##################### 64       before  ########################## 55 |
|  GSTR-1    ############## 41              after   ########## 15                 |
|  SPICe+    ##### 12                                                              |
|  AOC-4     #### 9                         COST THIS MONTH                        |
|  Others    ######## 16                    GSTZen     Rs  x,xxx                   |
|                                           Browser    Rs  x,xxx (38 h)            |
+----------------------------------------------------------------------------------+
```

## 12. The build roadmap

```
 WEEK   0 ---- 1 ---- 2 ---- 3 ---- 4 ---- 5 ---- 6 ---- 7 ---- 8 ---- 9 ---- 10 -->
 OWNER  [CS letter][GSTZen contract + 7 questions][count filings]
 S1          [spike: AgentCore vs neko]
 S2               [card robots + Before I fill + Agents today]       <- legal now
 S3                      [GSTZen: consent OTP, GSTR-3B, GSTR-1]       <- after contract
 S4                             [client "Your turn" OTP . notices . GSTIN check]
 S5                      [live browser: adapter, sessions, live mode]
 S6                                    [Name reservation end to end, mock]
 S7                                           [control room, settings, results]
 S8                                                  [CS reply] -> live MCA pilot
 S9                                                         -> GST REG-01, others
```

| Stage | Screens | Route | Blocked by |
|---|---|---|---|
| S2 | 1, 2, 3, 4 | none | nothing |
| S3 | 7 | API | GSTZen contract |
| S4 | 8 | API | S3 |
| S5 | 5, 6 | browser | spike |
| S6 | 5, 6 | browser | S5 |
| S7 | 9, 10, 11 | both | S3, S5 |
| S8 | all | browser, live | CS reply, policy change |
| S9 | all | browser | CS reply |

## 13. Rules on every screen

| Rule | Screen |
|---|---|
| The agent never types a login, captcha or OTP | 6, 8 |
| The agent never signs, submits or pays | 6, 7 |
| Nothing fills before "Fill now" | 4 |
| The certifier ticks the checks before Submit | 7 |
| Clients see only their own "Your turn" | 8 |
| The kill switch stops everything | 10 |
| Every action is logged with the person, the time and the IP | 9 |
