"use client";
/* eslint-disable @next/next/no-img-element -- the landing shows fixed screenshots at their own sizes, as the old v6 landing did */
/* eslint-disable jsx-a11y/no-noninteractive-element-to-interactive-role -- the phone list of the 180-day markers keeps click-through rows (role="button", tabIndex 0, Enter and Space handled on the root) as list items, so the list still reads as a list */
import "./landing.css";
import * as React from "react";
import Link from "next/link";
import { INC_STEPS, SIGN_IN_HREF, SWAP_WORDS } from "./content";
import { AskBubble, BusyWeeks, CompareSection, ComplianceRing, HeroStatus, Ic, RegulatorRibbon, SwapWord } from "./LandingParts";
import { replay, st, useLandingMotion } from "./landing-motion";
import { playIntro } from "./intro";
import { AskGuide } from "./AskGuide";
import { BookDemoDialog } from "../BookDemoDialog";

type Tab = "client" | "lead" | "manager" | "admin" | "super";
const TABS: Tab[] = ["client", "lead", "manager", "admin", "super"];
type Intro = "pre" | "logo" | "done";

const TAB_LINE: Record<Tab, string> = {
  client: "What is waiting on the client, what the firm holds, and when the certificate is expected.",
  lead: "Today's action queue across every company the lead runs.",
  manager: "Every task the team owns, and each project lead's workload side by side.",
  admin: "Every client, every manager, and where things are stuck, on one screen.",
  super: "The whole firm in one place: clients, admins, managers, work and risk.",
};
const TAB_NAME: Record<Tab, string> = { client: "Client", lead: "Project lead", manager: "Manager", admin: "Admin", super: "Super admin" };

/** The step rail under the flow chart reads this when it is at rest (every step lit). */
const STEPS_REST = "16 steps · name to certificate";

/**
 * The public landing, v2 (R-53, the prototype's docs/LANDING-V2.md). It keeps the v6 look (Public Sans, IBM Plex
 * Mono labels, the dark theme, the real logo and the C2 comparison) and every visual of the v6 port, with the text
 * cut to one headline, one sentence and the labels inside each diagram. Nine sections:
 * hero (with the number strip and the regulator ribbon), #incorporate (pinned), #after, #register, #comply
 * (pinned), #compare, #portals (with the Ask VCFO bubble), #trust (with the FAQ) and the final call to action.
 * Nothing starts hidden: every diagram is complete at rest and motion only adds to it (landing-motion.ts).
 * Click-through items carry `data-app`; a click or Enter on any of them opens Book a demo, as before.
 */
export function LandingScreen({ fontClass = "" }: { fontClass?: string }) {
  const root = React.useRef<HTMLDivElement>(null);
  const [menu, setMenu] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [demo, setDemo] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>("client");
  const [intro, setIntro] = React.useState<Intro>("done");
  const tabsRef = React.useRef<HTMLDivElement>(null);
  const stopIntro = React.useRef<(() => void) | null>(null);
  useLandingMotion(root, setScrolled);
  const openDemo = () => setDemo(true);
  const closeMenu = () => setMenu(false);

  // F3: the logo does not move on load, so the hero is on screen from the first paint. The v6 logo reveal is kept
  // as a replay: a click on the nav logo goes back to the top and plays it (never under reduced motion).
  const playLogo = (e: React.MouseEvent) => {
    const el = root.current;
    const hero = el?.querySelector<HTMLElement>(".hero");
    const navImg = el?.querySelector<HTMLElement>(".nav-logo img");
    if (!el || !hero || !navImg || intro !== "done" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    setIntro("pre");
    stopIntro.current = playIntro({
      root: el,
      hero,
      navImg,
      release: () => setIntro("logo"),
      finish: () => {
        setIntro("done");
        stopIntro.current = null;
      },
    });
  };
  React.useEffect(() => () => stopIntro.current?.(), []);

  const tabKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const i = TABS.indexOf(tab);
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const t = TABS[(next + TABS.length) % TABS.length];
    setTab(t);
    tabsRef.current?.querySelector<HTMLButtonElement>(`#tab-${t}`)?.focus();
  };

  // Cards, chips and screenshots carry `data-app`: a click, or Enter on a focused item, opens Book a demo.
  // A click anywhere else on a played diagram plays it again (R6).
  const open = (target: EventTarget | null, e: React.SyntheticEvent) => {
    const el = (target as Element | null)?.closest?.("[data-app]");
    if (!el) {
      if (e.type === "click") replay(target as Element | null);
      return;
    }
    e.preventDefault();
    openDemo();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const el = e.target as Element;
    if (el.hasAttribute("data-app") && !/^(A|BUTTON)$/.test(el.tagName)) open(el, e);
  };

  const tryLive = <span className="icon"><Ic><path d="M14 4.1 12 6" /><path d="m5.1 8-2.9-.8" /><path d="m6 12-1.9 2" /><path d="M7.2 2.2 8 5.1" /><path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z" /></Ic></span>;
  const chevron = <span className="icon"><Ic><path d="m6 9 6 6 6-6" /></Ic></span>;

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- one delegated handler for the data-app items; each item is focusable with role="button" and the keys are handled by onKeyDown
    <div ref={root} className={`lp ${fontClass} ${intro === "pre" ? "pre-reveal reveal-logo" : intro === "logo" ? "reveal-logo" : ""}`} onClick={(e) => open(e.target, e)} onKeyDown={onKeyDown}>
      <div className="nav-sentinel" aria-hidden="true" />
      <header className={`nav${scrolled ? " scrolled" : ""}${menu ? " open" : ""}`} id="top">
        <div className="container nav-row">
          <a className="nav-logo" href="#top" aria-label="VCFO Suite by SBC, home" onClick={playLogo}>
            <img src="/landing/vcfo-logo-on-black.webp" alt="VCFO Suite by SBC" width="138" height="30" />
          </a>
          <nav className="nav-links" aria-label="Primary">
            <a href="#incorporate">How it works</a>
            <a href="#comply">Compliance</a>
            <a href="#compare">Compare</a>
            <a href="#portals">Portals</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="nav-actions">
            <Link className="btn btn-ghost btn-sm" href={SIGN_IN_HREF}>Sign in</Link>
            <button className="btn btn-primary btn-sm" type="button" onClick={openDemo}>Book a demo</button>
            <button className="nav-toggle" type="button" aria-expanded={menu} aria-controls="nav-mobile" aria-label="Menu" onClick={() => setMenu((m) => !m)}>
              <span className="icon ic-menu"><Ic><path d="M4 5h16" /><path d="M4 12h16" /><path d="M4 19h16" /></Ic></span>
              <span className="icon ic-close"><Ic><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Ic></span>
            </button>
          </div>
        </div>
        <div className="nav-mobile container" id="nav-mobile">
          <a onClick={closeMenu} href="#incorporate">How it works</a>
          <a onClick={closeMenu} href="#comply">Compliance</a>
          <a onClick={closeMenu} href="#compare">Compare</a>
          <a onClick={closeMenu} href="#portals">Portals</a>
          <a onClick={closeMenu} href="#faq">FAQ</a>
          <Link onClick={closeMenu} href={SIGN_IN_HREF}>Sign in</Link>
        </div>
      </header>

      <main>

      {/* 1. Hero, with the regulator ribbon (V3) and the number strip */}
      <section className="hero">
        <svg className="hero-beams" viewBox="0 0 1440 800" preserveAspectRatio="none" aria-hidden="true"><defs><radialGradient id="spotG" cx="30%" cy="0%" r="60%"><stop offset="0" className="spot-stop" stopOpacity=".18" /><stop offset="1" className="spot-stop" stopOpacity="0" /></radialGradient></defs><ellipse className="spot" cx="420" cy="0" rx="700" ry="420" /><path d="M-40 640 C 320 420, 760 700, 1480 260" /><path d="M-40 700 C 380 520, 820 760, 1480 380" /><path d="M-40 560 C 260 360, 700 620, 1480 160" /></svg>
        <div className="glow glow-brand glow-a"></div>
        <div className="glow glow-info glow-b"></div>
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="kicker enter d1">Incorporate. Register. Comply.</p>
            <h1 className="h1 enter d2">Your complete <span className="swap-line"><SwapWord words={SWAP_WORDS} start={intro === "done"} /></span> companion.</h1>
            <p className="lead enter d3">One record from the first form to every filing after, run by your firm and seen by your clients.</p>
            <div className="hero-ctas enter d4">
              <button className="btn btn-primary" type="button" onClick={openDemo}>Book a demo <span className="icon"><Ic><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></Ic></span></button>
              <Link className="btn btn-secondary" href={SIGN_IN_HREF}>Try it live {tryLive}</Link>
            </div>
          </div>
          <div className="hero-shot enter d4">
            <div className="float float-a" data-app="filings" aria-label="Book a demo to see the filings screen" role="button" aria-haspopup="dialog" tabIndex={0}><span className="pill pill-positive">Filed</span><span className="t"><span>GSTR-3B, September</span><span className="mono">Acknowledgement attached</span></span></div>
            <div className="float float-b" data-app="inc-step-7" aria-label="Book a demo to see step 7, registered office address" role="button" aria-haspopup="dialog" tabIndex={0}><span className="pill pill-highlight">Needs you</span><span className="t"><span>Utility bill for the office</span><span className="mono">Due 9 Oct</span></span></div>
            <div className="frame" data-app="incorporation" aria-label="Book a demo to see the incorporation screen" role="button" aria-haspopup="dialog" tabIndex={0}>
              <img src="/landing/hero-incorporation.webp" alt="VCFO Suite client portal, incorporation view for Northwind Technologies India Pvt Ltd: 22 days to the Certificate of Incorporation, 6 of 25 steps done, the current steps with who holds each one, this week's tasks and the incorporation status." width="2400" height="1375" fetchPriority="high" />
            </div>
            <HeroStatus />
          </div>
        </div>
        <div className="container hero-foot">
          <RegulatorRibbon />
          <div className="facts reveal" aria-label="What the product tracks">
            <div className="facts-grid">
              <div className="fact" data-stagger style={st("--i:0")} data-app="incorporation" role="button" aria-haspopup="dialog" tabIndex={0}><div className="num" data-count="25">25</div><p className="what">steps in every incorporation</p></div>
              <div className="fact" data-stagger style={st("--i:1")} data-app="inc-phase-4" role="button" aria-haspopup="dialog" tabIndex={0}><div className="num" data-count="23">23</div><p className="what">registrations and RBI reportings</p></div>
              <div className="fact" data-stagger style={st("--i:2")} data-app="compliances" role="button" aria-haspopup="dialog" tabIndex={0}><div className="num" data-count="6">6</div><p className="what">regulators on one calendar</p></div>
              <div className="fact" data-stagger style={st("--i:3")} data-app="audit" role="button" aria-haspopup="dialog" tabIndex={0}><div className="num" data-count="1">1</div><p className="what">record for the client, the parent and the firm</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Journey · Incorporate (pinned: the 16 steps light up with the scroll). The stage rail is the old #journey line. */}
      <section className="section pinned" id="incorporate" data-pin="story">
        <div className="pin-stage">
          <div className="container story">
            <div className="story-side">
              <span className="stage"><b>1</b>Stages 1 and 2</span>
              <h2 className="h2">From a name on a wish list to a certificate from MCA.</h2>
              <p className="body">Sixteen steps pass between the client, the firm and MCA, one document at a time.</p>
              <div className="journey rail reveal" id="journey" data-play>
                <svg viewBox="0 0 300 406" role="img" aria-label="The journey: name and papers, incorporation, certificate of incorporation, the first 180 days, registrations, then compliance every year.">
                  <path className="line-glow" d="M 22 22 L 22 382" />
                  <path className="line" d="M 22 22 L 22 382" />
                  <g className="node" data-stage="1" style={st("--i:0")} data-app="inc-phase-a" role="button" aria-haspopup="dialog" tabIndex={0}>
                    <circle className="halo" cx="22" cy="22" r="20" /><circle className="c" cx="22" cy="22" r="13" /><text className="n" x="22" y="26.5">1</text>
                    <text className="t" x="52" y="21">Name and papers</text><text className="w" x="52" y="38">5 STEPS · CLIENT + FIRM</text>
                  </g>
                  <g className="node" data-stage="2" style={st("--i:1")} data-app="inc-phase" role="button" aria-haspopup="dialog" tabIndex={0}>
                    <circle className="halo" cx="22" cy="94" r="20" /><circle className="c" cx="22" cy="94" r="13" /><text className="n" x="22" y="98.5">2</text>
                    <text className="t" x="52" y="93">Incorporation</text><text className="w" x="52" y="110">11 STEPS · FIRM + MCA</text>
                  </g>
                  <g className="node coi" data-stage="coi" style={st("--i:2")} data-app="inc-step-14" role="button" aria-haspopup="dialog" tabIndex={0}>
                    <circle className="pulse" cx="22" cy="166" r="14" />
                    <path className="d" d="M 22 152 L 36 166 L 22 180 L 8 166 Z" />
                    <text className="t" x="52" y="165">Certificate of Incorporation</text><text className="w" x="52" y="182">DAY 0 · CIN, PAN, TAN</text>
                  </g>
                  <g className="node" style={st("--i:3")} data-app="inc-phase-3" role="button" aria-haspopup="dialog" tabIndex={0}>
                    <circle className="halo" cx="22" cy="238" r="20" /><circle className="c" cx="22" cy="238" r="13" /><text className="n" x="22" y="242.5">3</text>
                    <text className="t" x="52" y="237">The first 180 days</text><text className="w" x="52" y="254">11 STEPS · FIRM</text>
                  </g>
                  <g className="node" style={st("--i:4")} data-app="inc-phase-4" role="button" aria-haspopup="dialog" tabIndex={0}>
                    <circle className="halo" cx="22" cy="310" r="20" /><circle className="c" cx="22" cy="310" r="13" /><text className="n" x="22" y="314.5">4</text>
                    <text className="t" x="52" y="309">Registrations</text><text className="w" x="52" y="326">23 ITEMS · FIRM</text>
                  </g>
                  <g className="node loop" style={st("--i:5")} data-app="compliances" role="button" aria-haspopup="dialog" tabIndex={0}>
                    <circle className="halo" cx="22" cy="382" r="20" /><circle className="c" cx="22" cy="382" r="13" />
                    <path d="M 16 382 a 6 6 0 1 1 2.2 4.7" className="loop-i" /><path d="M 18.2 385 l 0 3 l -3 0" className="loop-i" />
                    <text className="t" x="52" y="381">Compliance, every year</text><text className="w" x="52" y="398">FIRM + CLIENT</text>
                  </g>
                </svg>
              </div>
            </div>
            <div className="card stage-panel">
              <svg className="swim" viewBox="0 0 600 690" role="img" aria-label="Flow chart with three columns, Client, Firm and MCA, showing how the documents of the 16 incorporation steps move between them, with the NOC decision for a foreign subsidiary.">
                <defs>
                  <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path className="ah" d="M 0 0 L 10 5 L 0 10 z" /></marker>
                  <marker id="ah2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path className="ah2" d="M 0 0 L 10 5 L 0 10 z" /></marker>
                </defs>
                {/* columns */}
                <rect className="col-h" x="20" y="14" width="160" height="34" rx="8" /><text className="col-t" x="100" y="36">CLIENT</text>
                <rect className="col-h" x="220" y="14" width="160" height="34" rx="8" /><text className="col-t" x="300" y="36">FIRM</text>
                <rect className="col-h" x="420" y="14" width="160" height="34" rx="8" /><text className="col-t" x="500" y="36">MCA</text>
                <line className="lane" x1="100" y1="60" x2="100" y2="612" /><line className="lane" x1="300" y1="60" x2="300" y2="612" /><line className="lane" x1="500" y1="60" x2="500" y2="612" />
                {/* step 1: questionnaire */}
                <g className="sg s1" data-g="s1">
                  <rect className="doc" x="30" y="72" width="140" height="58" rx="8" />
                  <line className="doc-l" x1="46" y1="90" x2="140" y2="90" /><line className="doc-l" x1="46" y1="102" x2="118" y2="102" /><line className="doc-l" x1="46" y1="114" x2="130" y2="114" />
                  <text className="lbl" x="100" y="148" textAnchor="middle">Company details</text>
                  <path className="arrow" d="M 176 101 L 222 101" />
                  <rect className="doc" x="228" y="83" width="144" height="36" rx="8" />
                  <text className="lbl" x="300" y="105" textAnchor="middle">Firm reviews</text>
                </g>
                {/* steps 2 and 3: board resolution */}
                <g className="sg s2" data-g="s2">
                  <rect className="doc" x="225" y="166" width="150" height="48" rx="8" />
                  <text className="lbl" x="300" y="186" textAnchor="middle">Board resolution</text><text className="sub" x="300" y="202" textAnchor="middle">drafted from the answers</text>
                  <path className="arrow back" d="M 219 190 L 181 190" />
                  <rect className="doc" x="25" y="166" width="150" height="48" rx="8" />
                  <text className="lbl" x="100" y="186" textAnchor="middle">Signed, uploaded</text><text className="sub" x="100" y="202" textAnchor="middle">on letterhead</text>
                  <circle className="badge" cx="171" cy="168" r="9" /><path className="tick" d="M 167 168 l 3 3 l 5.5 -6" />
                </g>
                {/* V1: the NOC decision, lit as one group with the signed resolution */}
                <g className="sg noc" data-g="noc">
                  <text className="noc-t" x="20" y="240">NOC CHECK</text>
                  <rect className="dn" x="20" y="250" width="116" height="34" rx="17" /><text className="lbl" x="78" y="271" textAnchor="middle">Ownership</text>
                  <path className="arrow" d="M 140 267 L 160 267" />
                  <rect className="dn" x="166" y="250" width="116" height="34" rx="17" /><text className="lbl" x="224" y="271" textAnchor="middle">Subsidiary</text>
                  <path className="arrow" d="M 286 267 L 306 267" />
                  <rect className="dn" x="312" y="250" width="132" height="34" rx="17" /><text className="lbl" x="378" y="271" textAnchor="middle">Foreign subsidiary</text>
                  <path className="arrow" d="M 448 267 L 468 267" />
                  <rect className="dn yes" x="474" y="250" width="106" height="34" rx="17" /><text className="noc-y" x="527" y="271">NOC</text>
                </g>
                <g transform="translate(0 64)">
                  {/* steps 4 and 5: name reservation */}
                  <g className="sg s3" data-g="s3">
                    <rect className="doc" x="225" y="242" width="150" height="48" rx="8" />
                    <text className="lbl" x="300" y="262" textAnchor="middle">Name application</text><text className="sub" x="300" y="278" textAnchor="middle">RUN, Part A</text>
                    <path className="arrow" d="M 381 266 L 419 266" />
                    <rect className="badge" x="425" y="242" width="150" height="48" rx="8" />
                    <text className="badge-t" x="500" y="262">Name approved</text><text className="sub" x="500" y="278" textAnchor="middle">held for 20 days</text>
                  </g>
                  {/* steps 6 to 12: generated documents and DSC */}
                  <g className="sg s4" data-g="s4">
                    <rect className="doc" x="231" y="318" width="150" height="48" rx="8" transform="rotate(-5 306 342)" />
                    <rect className="doc" x="228" y="321" width="150" height="48" rx="8" transform="rotate(-2.5 303 345)" />
                    <rect className="doc" x="225" y="324" width="150" height="48" rx="8" />
                    <text className="lbl" x="300" y="344" textAnchor="middle">MOA, AOA, DIR-2</text><text className="sub" x="300" y="360" textAnchor="middle">INC-9, declarations</text>
                    <path className="arrow back" d="M 219 348 L 181 348" />
                    <rect className="doc" x="25" y="324" width="150" height="48" rx="8" />
                    <text className="lbl" x="100" y="344" textAnchor="middle">Signed with DSC</text><text className="sub" x="100" y="360" textAnchor="middle">each director</text>
                    <circle className="badge" cx="171" cy="326" r="9" /><path className="tick" d="M 167 326 l 3 3 l 5.5 -6" />
                  </g>
                  {/* steps 13 to 16: SPICe+ and the certificate */}
                  <g className="sg s5" data-g="s5">
                    <rect className="doc" x="225" y="400" width="150" height="48" rx="8" />
                    <text className="lbl" x="300" y="420" textAnchor="middle">SPICe+ Part B</text><text className="sub" x="300" y="436" textAnchor="middle">with AGILE-PRO-S</text>
                    <path className="arrow" d="M 381 424 L 500 424 L 500 456" />
                    <rect className="cert-glow" x="418" y="460" width="164" height="88" rx="14" />
                    <rect className="cert" x="428" y="468" width="144" height="72" rx="10" />
                    <text className="lbl" x="500" y="492" textAnchor="middle">Certificate</text>
                    <text className="sub" x="500" y="508" textAnchor="middle">of Incorporation</text>
                    <text className="sub" x="500" y="526" textAnchor="middle" style={st("font-family: var(--lp-font-mono); font-size: 10px; letter-spacing: .06em")}>CIN · PAN · TAN</text>
                    <circle className="badge" cx="568" cy="470" r="9" /><path className="tick" d="M 564 470 l 3 3 l 5.5 -6" />
                  </g>
                </g>
                {/* the 16 steps, lit one by one with the scroll */}
                <g className="tks">
                  {INC_STEPS.map((s, i) => (
                    <circle key={s.t} className="tk" data-g={s.g} cx={60 + i * 32} cy={638} r={6}>
                      <title>{`Step ${i + 1}: ${s.t}`}</title>
                    </circle>
                  ))}
                  <text className="tk-label" x="300" y="672" data-rest={STEPS_REST}>{STEPS_REST}</text>
                </g>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Journey · First 180 days: the timeline, one label per marker (D3), and the filing windows (V4) */}
      <section className="section" id="after">
        <div className="glow glow-info" style={st("width:700px;height:500px;left:-200px;top:20%")}></div>
        <div className="container">
          <div className="section-head duo reveal">
            <div><span className="stage"><b>3</b>Stage 3</span>
            <h2 className="h2">The first 180 days after the certificate.</h2></div>
            <p className="body">Eleven steps, most with a statutory clock that starts the day the certificate arrives.</p>
          </div>
          <div className="tl reveal" data-play aria-label="Timeline of the first 180 days after incorporation">
            <div className="axis"><div className="axis-fill"></div>
              <span className="tick" style={st("left:0%")}>DAY 0</span><span className="tick" style={st("left:16.7%")}>30</span><span className="tick" style={st("left:33.3%")}>60</span><span className="tick" style={st("left:50%")}>90</span><span className="tick" style={st("left:66.7%")}>120</span><span className="tick" style={st("left:83.3%")}>150</span><span className="tick" style={st("left:100%")}>180</span>
            </div>
            <div className="pin coi up first" style={st("left:0%;--i:0")}><div className="card pc" data-app="inc-step-14" role="button" aria-haspopup="dialog" tabIndex={0}><span className="mono">Day 0</span><b>Certificate of Incorporation</b></div><span className="stem"></span><span className="dot"></span></div>
            <div className="pin down" style={st("left:16.7%;--i:1")}><div className="card pc" data-app="inc-step-15" role="button" aria-haspopup="dialog" tabIndex={0}><span className="mono">Within 30 days</span><b>Board meeting, ADT-1, INC-22</b></div><span className="stem"></span><span className="dot"></span></div>
            <div className="pin up" style={st("left:33.3%;--i:2")}><div className="card pc" data-app="inc-step-19" role="button" aria-haspopup="dialog" tabIndex={0}><span className="mono">Within 60 days</span><b>Share certificates (SH-1)</b></div><span className="stem"></span><span className="dot"></span></div>
            <div className="pin down" style={st("left:56%;--i:3")}><div className="card pc" data-app="inc-step-17" role="button" aria-haspopup="dialog" tabIndex={0}><span className="mono">No statutory clock</span><b>Bank account, then capital</b></div><span className="stem"></span><span className="dot"></span></div>
            <div className="pin up" style={st("left:78%;--i:4")}><div className="card pc" data-app="inc-step-22" role="button" aria-haspopup="dialog" tabIndex={0}><span className="mono">30 days after allotment</span><b>FC-GPR to the RBI</b></div><span className="stem"></span><span className="dot"></span></div>
            <div className="pin down last" style={st("left:100%;--i:5")}><div className="card pc" data-app="inc-step-20" role="button" aria-haspopup="dialog" tabIndex={0}><span className="mono">Within 180 days</span><b>Commencement (INC-20A)</b></div><span className="stem"></span><span className="dot"></span></div>
          </div>
          <ol className="tl-list reveal">
            <li className="card" data-app="inc-step-14" role="button" aria-haspopup="dialog" tabIndex={0}><span className="mono">Day 0</span><b>Certificate of Incorporation</b></li>
            <li className="card" data-app="inc-step-15" role="button" aria-haspopup="dialog" tabIndex={0}><span className="mono">Within 30 days</span><b>Board meeting, ADT-1, INC-22</b></li>
            <li className="card" data-app="inc-step-19" role="button" aria-haspopup="dialog" tabIndex={0}><span className="mono">Within 60 days</span><b>Share certificates (SH-1)</b></li>
            <li className="card" data-app="inc-step-17" role="button" aria-haspopup="dialog" tabIndex={0}><span className="mono">No statutory clock</span><b>Bank account, then capital</b></li>
            <li className="card" data-app="inc-step-22" role="button" aria-haspopup="dialog" tabIndex={0}><span className="mono">30 days after allotment</span><b>FC-GPR to the RBI</b></li>
            <li className="card" data-app="inc-step-20" role="button" aria-haspopup="dialog" tabIndex={0}><span className="mono">Within 180 days</span><b>Commencement (INC-20A)</b></li>
          </ol>
          {/* V4: the statutory filing windows on the same 180-day scale */}
          <div className="gantt reveal" data-play aria-label="Filing windows: the board meeting, ADT-1 and INC-22 within 30 days, SH-1 within 60, FC-GPR within 30 days of allotment, INC-20A within 180.">
            <div className="g-row" style={st("--i:0")}><span className="g-l">Board meeting · ADT-1 · INC-22</span><div className="g-track"><i className="g-bar" style={st("left:0%;width:16.7%")} /></div></div>
            <div className="g-row" style={st("--i:1")}><span className="g-l">SH-1</span><div className="g-track"><i className="g-bar" style={st("left:0%;width:33.3%")} /></div></div>
            <div className="g-row" style={st("--i:2")}><span className="g-l">FC-GPR · after allotment</span><div className="g-track"><i className="g-bar dashed" style={st("left:61.3%;width:16.7%")} /></div></div>
            <div className="g-row" style={st("--i:3")}><span className="g-l">INC-20A</span><div className="g-track"><i className="g-bar end" style={st("left:0%;width:100%")} /></div></div>
          </div>
        </div>
      </section>

      {/* 4. Journey · Register: the company and its regulators (D4: no text under the groups) */}
      <section className="section" id="register">
        <div className="container">
          <div className="section-head duo reveal">
            <div><span className="stage"><b>4</b>Stage 4</span>
            <h2 className="h2">Every registration the company needs, and none it does not.</h2></div>
            <p className="body">The firm switches on only the registrations that apply, and each becomes a step with an owner and a date.</p>
          </div>
          <div className="hub reveal" data-play>
            <svg className="wires" viewBox="0 0 1120 560" preserveAspectRatio="none" aria-hidden="true">
              <path className="wire" style={st("--i:0")} d="M 560 280 C 460 280 300 123 157 123" />
              <path className="wire" style={st("--i:1")} d="M 560 280 C 660 280 820 123 963 123" />
              <path className="wire" style={st("--i:2")} d="M 560 280 C 460 280 300 437 157 437" />
              <path className="wire" style={st("--i:3")} d="M 560 280 C 660 280 820 437 963 437" />
              <path className="wire" style={st("--i:4")} d="M 560 280 L 560 515" />
            </svg>
            <div className="card centre"><span className="ring1"></span><span className="ring2"></span><b>Your company</b><span className="mono">CIN · PAN · TAN</span></div>
            <div className="card cluster c-tax card-hover" data-app="inc-phase-4" style={st("--i:0")} role="button" aria-haspopup="dialog" tabIndex={0}><header><span className="tile"><span className="icon"><Ic><path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z" /><path d="M8 11h8" /><path d="M8 7h8" /><path d="M9 7a4 4 0 0 1 0 8H8l3 2" /></Ic></span></span><b>Tax</b><span>4</span></header><div className="chips"><span className="chip">PAN and TAN</span><span className="chip" data-app="inc-step-26" role="button" aria-haspopup="dialog" tabIndex={0}>GST</span><span className="chip" data-app="inc-step-34" role="button" aria-haspopup="dialog" tabIndex={0}>LUT for exports</span><span className="chip" data-app="inc-step-29" role="button" aria-haspopup="dialog" tabIndex={0}>Professional tax</span></div></div>
            <div className="card cluster c-lab card-hover" data-app="inc-phase-4" style={st("--i:1")} role="button" aria-haspopup="dialog" tabIndex={0}><header><span className="tile"><span className="icon"><Ic><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><path d="M16 3.128a4 4 0 0 1 0 7.744" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><circle cx="9" cy="7" r="4" /></Ic></span></span><b>Labour</b><span>5</span></header><div className="chips"><span className="chip" data-app="inc-step-27" role="button" aria-haspopup="dialog" tabIndex={0}>PF</span><span className="chip" data-app="inc-step-28" role="button" aria-haspopup="dialog" tabIndex={0}>ESI</span><span className="chip" data-app="inc-step-36" role="button" aria-haspopup="dialog" tabIndex={0}>Shops and Establishment</span><span className="chip" data-app="inc-step-37" role="button" aria-haspopup="dialog" tabIndex={0}>CLRA</span><span className="chip" data-app="inc-step-38" role="button" aria-haspopup="dialog" tabIndex={0}>POSH committee</span></div></div>
            <div className="card cluster c-trade card-hover" data-app="inc-phase-4" style={st("--i:2")} role="button" aria-haspopup="dialog" tabIndex={0}><header><span className="tile"><span className="icon"><Ic><path d="M12 16h.01" /><path d="M16 16h.01" /><path d="M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z" /><path d="M8 16h.01" /></Ic></span></span><b>Trade</b><span>6</span></header><div className="chips"><span className="chip" data-app="inc-step-33" role="button" aria-haspopup="dialog" tabIndex={0}>IEC</span><span className="chip" data-app="inc-step-32" role="button" aria-haspopup="dialog" tabIndex={0}>ICEGATE</span><span className="chip" data-app="inc-step-39" role="button" aria-haspopup="dialog" tabIndex={0}>Trade licence</span><span className="chip" data-app="inc-step-31" role="button" aria-haspopup="dialog" tabIndex={0}>MSME</span><span className="chip" data-app="inc-step-30" role="button" aria-haspopup="dialog" tabIndex={0}>LEI</span><span className="chip" data-app="inc-step-35" role="button" aria-haspopup="dialog" tabIndex={0}>STPI</span></div></div>
            <div className="card cluster c-rbi card-hover" data-app="inc-phase-4" style={st("--i:3")} role="button" aria-haspopup="dialog" tabIndex={0}><header><span className="tile"><span className="icon"><Ic><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></Ic></span></span><b>RBI and FEMA</b><span>5</span></header><div className="chips"><span className="chip" data-app="inc-step-44" role="button" aria-haspopup="dialog" tabIndex={0}>FC-GPR</span><span className="chip" data-app="inc-step-45" role="button" aria-haspopup="dialog" tabIndex={0}>FDI reporting</span><span className="chip" data-app="inc-step-46" role="button" aria-haspopup="dialog" tabIndex={0}>ODI reporting</span><span className="chip" data-app="inc-step-47" role="button" aria-haspopup="dialog" tabIndex={0}>FLA return</span><span className="chip" data-app="inc-step-48" role="button" aria-haspopup="dialog" tabIndex={0}>FC-TRS</span></div></div>
            <div className="card cluster c-ip card-hover" data-app="inc-phase-4" style={st("--i:4")} role="button" aria-haspopup="dialog" tabIndex={0}><header><span className="tile"><span className="icon"><Ic><path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13" /><path d="M20 15.5a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1z" /><path d="M5 22h14" /></Ic></span></span><b>Intellectual property</b><span>3</span></header><div className="chips"><span className="chip" data-app="inc-step-40" role="button" aria-haspopup="dialog" tabIndex={0}>Trademark</span><span className="chip" data-app="inc-step-41" role="button" aria-haspopup="dialog" tabIndex={0}>Trademark renewal</span><span className="chip" data-app="inc-step-42" role="button" aria-haspopup="dialog" tabIndex={0}>Patent</span></div></div>
          </div>
        </div>
      </section>

      {/* 5. Journey · Every year (pinned: the ring turns month by month), the busy weeks (V5) and one screenshot (D5) */}
      <section className="section pinned" id="comply" data-pin="ring">
        <div className="glow glow-brand" style={st("width:900px;height:600px;left:-300px;top:10%")}></div>
        <div className="pin-stage">
          <div className="container comply-grid">
            <div className="comply-side">
              <span className="stage loop"><b>∞</b>Every year</span>
              <h2 className="h2">Then the calendar takes over.</h2>
              <p className="body">Every statutory date of the year has an owner, a due date and a reminder in the portal.</p>
              <div className="comply-vis">
                <BusyWeeks />
                <div className="card nudge" data-app="notifications" aria-label="How a reminder works: due date, reminder, filed. Book a demo to see notifications." role="button" aria-haspopup="dialog" tabIndex={0}>
                  <div className="box"><span className="icon"><Ic><path d="M8 2v3" /><path d="M16 2v3" /><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M8 13h.01" /><path d="M12 13h.01" /><path d="M16 13h.01" /><path d="M8 17h.01" /><path d="M12 17h.01" /><path d="M16 17h.01" /></Ic></span><b>Due date</b></div>
                  <div className="arr a"><i></i></div>
                  <div className="box"><span className="icon"><Ic><path d="M10.268 21a2 2 0 0 0 3.464 0" /><path d="M22 8c0-2.3-.8-4.3-2-6" /><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" /><path d="M4 2C2.8 3.7 2 5.7 2 8" /></Ic></span><b>Reminder</b></div>
                  <div className="arr b"><i></i></div>
                  <div className="box"><span className="icon"><Ic><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></Ic></span><b>Filed</b></div>
                </div>
              </div>
              <div className="frame cal-shot" data-app="compliances" aria-label="Book a demo to see the compliance calendar" role="button" aria-haspopup="dialog" tabIndex={0}>
                <img src="/landing/calendar-client.webp" alt="Client compliance calendar for Northwind Technologies: October grid with TDS, GST, PF and ESI dates, the next deadline GSTR-1 in 3 days, and the coming-up list with status words." width="2000" height="1146" />
              </div>
            </div>
            <div className="ring-wrap reveal" data-play data-app="compliances" aria-label="Book a demo to see the compliance calendar" role="button" aria-haspopup="dialog" tabIndex={0}>
              <ComplianceRing />
            </div>
          </div>
        </div>
      </section>

      {/* 6. The VCFO way vs. the old way (board C2) */}
      <CompareSection onDemo={openDemo} />

      {/* 7. One record, every role: one screenshot with the 5 role tabs and the Ask VCFO bubble (D8) */}
      <section className="section" id="portals">
        <div className="glow glow-info" style={st("width:800px;height:500px;right:-250px;top:30%")}></div>
        <div className="container">
          <div className="section-head reveal">
            <h2 className="h2">One record, every role.</h2>
          </div>
          <div className="reveal">
            <div className="tab-head">
              <div className="tabs" role="tablist" aria-label="Portals" ref={tabsRef}>
                {TABS.map((t) => (
                  <button key={t} className="tab" type="button" role="tab" id={`tab-${t}`} aria-selected={tab === t} aria-controls={`panel-${t}`} tabIndex={tab === t ? 0 : -1} onClick={() => setTab(t)} onKeyDown={tabKey}>{TAB_NAME[t]}</button>
                ))}
              </div>
              <p className="tab-desc" aria-live="polite">{TAB_LINE[tab]}</p>
            </div>
            <div className="tabpanel">
              <div className="frame" role="tabpanel" id="panel-client" aria-labelledby="tab-client" hidden={tab !== "client"} data-app="home">
                <img src="/landing/portal-client.webp" alt="Client portal home for Northwind Technologies India Pvt Ltd: the home card with five numbers, the incorporation steps with who holds each one, what is needed from Northwind and the timeline." width="2000" height="1146" />
              </div>
              <div className="frame" role="tabpanel" id="panel-lead" aria-labelledby="tab-lead" hidden={tab !== "lead"} data-app="lead-home">
                <img src="/landing/portal-lead.webp" alt="Project lead Today screen for Bharath: the home card with five numbers, the action queue by company, the inbox and phase progress." width="2000" height="1146" />
              </div>
              <div className="frame" role="tabpanel" id="panel-manager" aria-labelledby="tab-manager" hidden={tab !== "manager"} data-app="mgr-home">
                <img src="/landing/portal-manager.webp" alt="Manager Today screen for Pranay: the home card with five numbers, team tasks with filters, approvals, the task status donut and workload by project lead." width="2000" height="1146" />
              </div>
              <div className="frame" role="tabpanel" id="panel-admin" aria-labelledby="tab-admin" hidden={tab !== "admin"} data-app="admin-home">
                <img src="/landing/portal-admin.webp" alt="Admin Today screen for Krishna: the home card, the practice areas, fourteen clients with their stage, manager and health, and the managers' load." width="2000" height="1146" />
              </div>
              <div className="frame" role="tabpanel" id="panel-super" aria-labelledby="tab-super" hidden={tab !== "super"} data-app="super-home">
                <img src="/landing/portal-super.webp" alt="Super admin overview for Mithilesh: the home card with the firm's numbers, the practice areas side by side, top risks and clients needing attention." width="2000" height="1146" />
              </div>
              {tab === "client" ? <AskBubble /> : null}
            </div>
          </div>
        </div>
      </section>

      {/* 8. Trust: the four points as one row of icon tiles, then the four questions (D10) */}
      <section className="section" id="trust">
        <div className="container">
          <div className="section-head duo reveal">
            <h2 className="h2">Built by a firm that files, for firms that file.</h2>
            <p className="body">SBC built VCFO Suite and runs its own engagements on it every day.</p>
          </div>
          <div className="trust reveal">
            <div className="card card-hover" data-stagger style={st("--i:0")}><div className="tile"><span className="icon"><Ic><rect width="20" height="8" x="2" y="2" rx="2" ry="2" /><rect width="20" height="8" x="2" y="14" rx="2" ry="2" /><line x1="6" x2="6.01" y1="6" y2="6" /><line x1="6" x2="6.01" y1="18" y2="18" /></Ic></span></div><h3 className="h3">Hosted in India</h3></div>
            <div className="card card-hover" data-stagger style={st("--i:1")} data-app="credentials" role="button" aria-haspopup="dialog" tabIndex={0}><div className="tile"><span className="icon"><Ic><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" /><circle cx="16.5" cy="7.5" r=".5" fill="currentColor" /></Ic></span></div><h3 className="h3">Credentials stay sealed</h3></div>
            <div className="card card-hover" data-stagger style={st("--i:2")} data-app="audit" role="button" aria-haspopup="dialog" tabIndex={0}><div className="tile"><span className="icon"><Ic><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /><path d="M14 2v5a1 1 0 0 0 1 1h5" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></Ic></span></div><h3 className="h3">An audit trail you can read</h3></div>
            <div className="card card-hover" data-stagger style={st("--i:3")}><div className="tile"><span className="icon"><Ic><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" /><rect x="2" y="4" width="20" height="16" rx="2" /></Ic></span></div><h3 className="h3">Email is the record</h3></div>
          </div>
          <div className="faq reveal" id="faq">
            <h3 className="mono faq-t">Questions</h3>
            <details><summary>Who is VCFO Suite for?{chevron}</summary><p className="a">Firms that incorporate and keep companies compliant in India, and their clients, from Indian founders to foreign parents setting up a subsidiary.</p></details>
            <details><summary>What does the client do in the portal?{chevron}</summary><p className="a">Answers the questionnaire, uploads what each step asks for, approves and signs, and watches the timeline.</p></details>
            <details><summary>Which filings does the calendar cover?{chevron}</summary><p className="a">MCA, GST, Income tax, Payroll, FEMA and Labour, generated from the certificate date and the registrations the company holds.</p></details>
            <details><summary>Where is the data held, and who can see it?{chevron}</summary><p className="a">On AWS in the Mumbai region with encrypted storage, and a client sees only their own companies.</p></details>
          </div>
        </div>
      </section>

      {/* 9. Final call to action */}
      <section className="section cta" id="demo">
        <div className="glow glow-brand glow-a"></div>
        <div className="container reveal">
          <p className="big"><span style={st("--i:0")}>Your clients.</span><span style={st("--i:1")}>Their filings.</span><span style={st("--i:2")}>Your team.</span><span className="last" style={st("--i:3")}>All on one record.</span></p>
          <div className="cta-actions">
            <button className="btn btn-primary" type="button" onClick={openDemo}>Book a demo <span className="icon"><Ic><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></Ic></span></button>
            <Link className="btn btn-secondary" href={SIGN_IN_HREF}>Try it live {tryLive}</Link>
          </div>
        </div>
      </section>

      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-logo">
              <img src="/landing/vcfo-logo-on-black.webp" alt="VCFO Suite by SBC" width="156" height="34" />
              <p>Company secretarial, incorporation and compliance for India companies, on one record.</p>
            </div>
            <div>
              <span className="mono">Product</span>
              <ul>
                <li><a href="#incorporate">How it works</a></li>
                <li><a href="#incorporate">Incorporation</a></li>
                <li><a href="#comply">Compliance calendar</a></li>
                <li><a href="#portals">Portals</a></li>
                <li><a href="#portals">Ask VCFO</a></li>
              </ul>
            </div>
            <div>
              <span className="mono">Account</span>
              <ul>
                <li><Link href={SIGN_IN_HREF}>Sign in</Link></li>
                <li><a href="#demo" onClick={(e) => { e.preventDefault(); openDemo(); }}>Book a demo</a></li>
              </ul>
            </div>
            <div>
              <span className="mono">SBC</span>
              <ul>
                <li><a href="https://sbcllp.in">sbcllp.in</a></li>
                <li><a href="mailto:info@sbcllp.in">info@sbcllp.in</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>&copy; 2026 SBC. VCFO Suite is a product of SBC.</span>
            <span>Local connect. Global outlook.</span>
          </div>
        </div>
      </footer>

      <AskGuide onDemo={openDemo} />
      <BookDemoDialog open={demo} onOpenChange={setDemo} />
    </div>
  );
}
