"use client";
/* eslint-disable @next/next/no-img-element -- the landing logo is a fixed-size image */
/* eslint-disable jsx-a11y/no-noninteractive-element-to-interactive-role -- the journey and 180-day list rows are click-through items (role="button", tabIndex 0, Enter and Space handled on the root), kept as list items so the lists still read as lists */
import "./landing.css";
import * as React from "react";
import Link from "next/link";
import { SIGN_IN_HREF, SWAP_WORDS } from "./content";
import { CompareSection, HeroArt, Ic, SwapWord } from "./LandingParts";
import { st, useLandingMotion } from "./landing-motion";
import { playIntro } from "./intro";
import { AskGuide } from "./AskGuide";
import { BookDemoDialog } from "../BookDemoDialog";

type Intro = "pre" | "logo" | "done";

/**
 * The public landing, ported from the prototype's design/spectrum landing (C-0111), which is the old v6 landing
 * (reference/vcfo-suite-v6.html) with the comparison section added: same sections, copy, look and motion.
 * The prototype's click-through items keep their `data-app` marks, but there are no public demo portals,
 * so a click or Enter on any of them opens the Book a demo dialog (G-30), and the hover pill on a
 * screenshot says "Book a demo". Every "Book a demo" button opens the same dialog, which posts to
 * `/api/public/demo-request`; /contact keeps the same form as a page. "Sign in" goes to the real login page.
 */
export function LandingScreen({ fontClass = "" }: { fontClass?: string }) {
  const root = React.useRef<HTMLDivElement>(null);
  const [menu, setMenu] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [demo, setDemo] = React.useState(false);
  const [intro, setIntro] = React.useState<Intro>("pre");
  useLandingMotion(root, setScrolled);
  const openDemo = () => setDemo(true);
  const closeMenu = () => setMenu(false);
  const heroReady = intro !== "pre";

  // The logo reveal plays on every load, from the top of the page, and never under reduced motion.
  // A link from another page to a section ("/#journey" from /roles) lands on that section once the reveal ends.
  React.useEffect(() => {
    const el = root.current;
    const hero = el?.querySelector<HTMLElement>(".hero");
    const navImg = el?.querySelector<HTMLElement>(".nav-logo img");
    if (!el || !hero || !navImg || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIntro("done");
      return;
    }
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    const target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    if (location.hash) history.replaceState(history.state, "", location.pathname + location.search);
    scrollTo(0, 0);
    const finish = () => {
      setIntro("done");
      target?.scrollIntoView({ block: "start" });
    };
    return playIntro({ root: el, hero, navImg, release: () => setIntro("logo"), finish });
  }, []);


  // Cards, chips and screenshots carry `data-app`: a click, or Enter on a focused item, opens Book a demo.
  const open = (target: EventTarget | null, e: React.SyntheticEvent) => {
    const el = (target as Element | null)?.closest?.("[data-app]");
    if (!el) return;
    e.preventDefault();
    openDemo();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const el = e.target as Element;
    if (el.hasAttribute("data-app") && !/^(A|BUTTON)$/.test(el.tagName)) open(el, e);
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- one delegated handler for the data-app items; each item is focusable with role="button" and the keys are handled by onKeyDown
    <div ref={root} className={`lp ${fontClass} ${intro === "pre" ? "pre-reveal reveal-logo" : intro === "logo" ? "reveal-logo" : ""}`} onClick={(e) => open(e.target, e)} onKeyDown={onKeyDown}>
      <div className="nav-sentinel" aria-hidden="true" />
      <header className={`nav${scrolled ? " scrolled" : ""}${menu ? " open" : ""}`} id="top">
        <div className="container nav-row">
          <a className="nav-logo" href="#top" aria-label="VCFO Suite by SBC, home">
            <img src="/landing/vcfo-logo-on-black.webp" alt="VCFO Suite by SBC" width="138" height="30" />
          </a>
          <nav className="nav-links" aria-label="Primary">
            <a href="#journey">How it works</a>
            <a href="#record">The record</a>
            <a href="#trust">Security</a>
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
          <a onClick={closeMenu} href="#journey">How it works</a>
          <a onClick={closeMenu} href="#record">The record</a>
          <a onClick={closeMenu} href="#trust">Security</a>
          <a onClick={closeMenu} href="#faq">FAQ</a>
          <Link onClick={closeMenu} href={SIGN_IN_HREF}>Sign in</Link>
        </div>
      </header>

      <main>

      {/* Hero */}
      <section className="hero">
        <svg className="hero-beams" viewBox="0 0 1440 800" preserveAspectRatio="none" aria-hidden="true"><defs><radialGradient id="spotG" cx="30%" cy="0%" r="60%"><stop offset="0" className="spot-stop" stopOpacity=".18" /><stop offset="1" className="spot-stop" stopOpacity="0" /></radialGradient></defs><ellipse className="spot" cx="420" cy="0" rx="700" ry="420" /><path d="M-40 640 C 320 420, 760 700, 1480 260" /><path d="M-40 700 C 380 520, 820 760, 1480 380" /><path d="M-40 560 C 260 360, 700 620, 1480 160" /></svg>
        <div className="glow glow-brand glow-a"></div>
        <div className="glow glow-info glow-b"></div>
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="kicker enter d1">Incorporate. Register. Comply.</p>
            <h1 className="h1 enter d2">Your complete <span className="swap-line"><SwapWord words={SWAP_WORDS} start={heroReady} /></span> companion.</h1>
            <p className="lead enter d3">One record from the first form to every filing after. Your firm runs it. Your clients see it.</p>
            <div className="hero-ctas enter d4">
              <button className="btn btn-primary" type="button" onClick={openDemo}>Book a demo <span className="icon"><Ic><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></Ic></span></button>
              <a className="btn btn-secondary" href="#journey">See how it works</a>
              <Link className="btn btn-secondary" href={SIGN_IN_HREF}>Try it live <span className="icon"><Ic><path d="M14 4.1 12 6" /><path d="m5.1 8-2.9-.8" /><path d="m6 12-1.9 2" /><path d="M7.2 2.2 8 5.1" /><path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z" /></Ic></span></Link>
            </div>
          </div>
          <div className="hero-shot enter d4">
            {/* LP-02: no screenshot of the product; an abstract picture of the benefit. */}
            <div className="float float-a" aria-hidden="true"><span className="pill pill-positive">Filed</span><span className="t"><span>On time, with proof</span></span></div>
            <div className="float float-b" aria-hidden="true"><span className="pill pill-highlight">Needs you</span><span className="t"><span>One thing left to do</span></span></div>
            <div className="frame frame-art">
              <HeroArt />
            </div>
          </div>
        </div>
      </section>

      {/* Facts */}
      <section className="facts" aria-label="What the product tracks">
        <div className="container">
          <div className="facts-grid reveal">
            <div className="fact" data-stagger style={st("--i:0")} data-app="incorporation" role="button" aria-haspopup="dialog" tabIndex={0}><div className="num" data-count="25">0</div><p className="what">steps in every incorporation, from the name application to the post-incorporation filings. Registrations have their own page.</p></div>
            <div className="fact" data-stagger style={st("--i:1")} data-app="inc-phase-4" role="button" aria-haspopup="dialog" tabIndex={0}><div className="num" data-count="23">0</div><p className="what">registrations and RBI reportings after the certificate, from PAN and GST to FC-GPR.</p></div>
            <div className="fact" data-stagger style={st("--i:2")} data-app="compliances" role="button" aria-haspopup="dialog" tabIndex={0}><div className="num" data-count="6">0</div><p className="what">regulators on one statutory calendar: MCA, GST, Income tax, Payroll, FEMA and Labour.</p></div>
            <div className="fact" data-stagger style={st("--i:3")} data-app="audit" role="button" aria-haspopup="dialog" tabIndex={0}><div className="num" data-count="1">0</div><p className="what">record that the client, the parent entity and the firm all read, with the same status words.</p></div>
          </div>
        </div>
      </section>

      {/* Journey */}
      <section className="section" id="journey">
        <div className="glow glow-brand" style={st("width:800px;height:500px;right:-200px;top:0")}></div>
        <div className="container">
          <div className="section-head reveal">
            <h2 className="h2">What happens to a company, start to finish.</h2>
            <p className="body">Four stages happen once. The calendar repeats every year. The firm runs every step; the client sees every step, with who holds it and when it is due.</p>
          </div>
          <div className="journey reveal" data-reveal="journey">
            <svg viewBox="-30 0 1180 230" role="img" aria-label="The journey: name and papers, incorporation, certificate of incorporation, the first 180 days, registrations, then compliance every year.">
              <path className="line-glow" d="M 60 130 C 162 130 162 80 264 80 S 366 130 468 130 S 570 80 672 80 S 774 130 876 130 S 978 80 1080 80" />
              <path className="line" d="M 60 130 C 162 130 162 80 264 80 S 366 130 468 130 S 570 80 672 80 S 774 130 876 130 S 978 80 1080 80" />
              <g className="node" style={st("--i:0")} data-app="inc-phase-a" role="button" aria-haspopup="dialog" tabIndex={0}>
                <circle className="halo" cx="60" cy="130" r="30" /><circle className="c" cx="60" cy="130" r="18" /><text className="n" x="60" y="135">1</text>
                <text className="t" x="60" y="178">Name and papers</text><text className="s" x="60" y="196">5 steps, about 2 weeks</text><text className="w" x="60" y="214">CLIENT + FIRM</text>
              </g>
              <g className="node" style={st("--i:1")} data-app="inc-phase" role="button" aria-haspopup="dialog" tabIndex={0}>
                <circle className="halo" cx="264" cy="80" r="30" /><circle className="c" cx="264" cy="80" r="18" /><text className="n" x="264" y="85">2</text>
                <text className="t" x="264" y="30">Incorporation</text><text className="s" x="264" y="48">11 steps, SPICe+ with MCA</text><text className="w" x="264" y="14">FIRM + MCA</text>
              </g>
              <g className="node coi" style={st("--i:2")} data-app="inc-step-14" role="button" aria-haspopup="dialog" tabIndex={0}>
                <circle className="pulse" cx="468" cy="130" r="20" />
                <path className="d" d="M 468 112 L 486 130 L 468 148 L 450 130 Z" />
                <text className="t" x="468" y="178">Certificate of Incorporation</text><text className="s" x="468" y="196">CIN, PAN and TAN arrive</text><text className="w" x="468" y="214">DAY 0</text>
              </g>
              <g className="node" style={st("--i:3")} data-app="inc-phase-3" role="button" aria-haspopup="dialog" tabIndex={0}>
                <circle className="halo" cx="672" cy="80" r="30" /><circle className="c" cx="672" cy="80" r="18" /><text className="n" x="672" y="85">3</text>
                <text className="t" x="672" y="30">The first 180 days</text><text className="s" x="672" y="48">11 steps with statutory clocks</text><text className="w" x="672" y="14">FIRM</text>
              </g>
              <g className="node" style={st("--i:4")} data-app="inc-phase-4" role="button" aria-haspopup="dialog" tabIndex={0}>
                <circle className="halo" cx="876" cy="130" r="30" /><circle className="c" cx="876" cy="130" r="18" /><text className="n" x="876" y="135">4</text>
                <text className="t" x="876" y="178">Registrations</text><text className="s" x="876" y="196">23 items, only the ones that apply</text><text className="w" x="876" y="214">FIRM</text>
              </g>
              <g className="node loop" style={st("--i:5")} data-app="compliances" role="button" aria-haspopup="dialog" tabIndex={0}>
                <circle className="halo" cx="1080" cy="80" r="30" /><circle className="c" cx="1080" cy="80" r="18" />
                <path d="M 1072 80 a 8 8 0 1 1 3 6.3" className="loop-i" /><path d="M 1075 84 l 0 4 l -4 0" className="loop-i" />
                <text className="t" x="1080" y="30">Compliance, every year</text><text className="s" x="1080" y="48">monthly, quarterly, annual</text><text className="w" x="1080" y="14">FIRM + CLIENT</text>
              </g>
            </svg>
            <ol className="journey-list">
              <li data-n="1" data-app="inc-phase-a" role="button" aria-haspopup="dialog" tabIndex={0}><b>Name and papers</b><span>5 steps, about 2 weeks. Client and firm.</span></li>
              <li data-n="2" data-app="inc-phase" role="button" aria-haspopup="dialog" tabIndex={0}><b>Incorporation</b><span>11 steps, SPICe+ with MCA. Firm and MCA.</span></li>
              <li className="coi" data-app="inc-step-14" role="button" aria-haspopup="dialog" tabIndex={0}><b>Certificate of Incorporation</b><span>Day 0. CIN, PAN and TAN arrive.</span></li>
              <li data-n="3" data-app="inc-phase-3" role="button" aria-haspopup="dialog" tabIndex={0}><b>The first 180 days</b><span>11 steps with statutory clocks. The firm.</span></li>
              <li data-n="4" data-app="inc-phase-4" role="button" aria-haspopup="dialog" tabIndex={0}><b>Registrations</b><span>23 items, only the ones that apply. The firm.</span></li>
              <li className="loop" data-app="compliances" role="button" aria-haspopup="dialog" tabIndex={0}><b>Compliance, every year</b><span>Monthly, quarterly and annual filings. Firm and client.</span></li>
            </ol>
          </div>
          <p className="caption reveal"><span className="icon"><Ic><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="1" /></Ic></span>Every stage shows the same three things: who holds it, when it is due, and the document that proves it.</p>
        </div>
      </section>

      {/* The record */}
      <section className="section" id="record">
        <div className="container">
          <div className="split">
            <div className="reveal">
              <h2 className="h2">Every step has an owner, a date and a proof.</h2>
              <p className="body" style={st("margin-top:16px")}>Work enters as a step, a filing or a document request. The firm reviews it. It leaves as a status word with a date behind it, and the client reads the same word the firm reads.</p>
              <div className="facts-mini">
                <div data-stagger style={st("--i:0")}><span className="mono">Owner</span><p>The client, the firm or MCA. Never &quot;someone&quot;.</p></div>
                <div data-stagger style={st("--i:1")}><span className="mono">Due date</span><p>Statutory where the law sets one, agreed where it does not.</p></div>
                <div data-stagger style={st("--i:2")}><span className="mono">Document</span><p>The upload, the generated form or the filed acknowledgement.</p></div>
                <div data-stagger style={st("--i:3")}><span className="mono">Audit entry</span><p>Who changed what, and when. Clients can read their own trail.</p></div>
              </div>
            </div>
            <div className="lanes reveal" aria-hidden="true">
              <div className="lane"></div><div className="lane"></div><div className="lane"></div><div className="lane"></div><div className="lane"></div>
              <div className="boundary"></div>
              <span className="mono boundary-label">Firm review</span>
              <span className="mono boundary-label right">On record</span>
              <div className="rec l1"><span className="mono">Step</span><span className="t">A step</span></div>
              <div className="rec l2"><span className="mono">Filing</span><span className="t">A filing</span></div>
              <div className="rec l3"><span className="mono">Document</span><span className="t">A document</span></div>
              <div className="rec l4"><span className="mono">Filing</span><span className="t">A filing</span></div>
              <div className="rec l5"><span className="mono">Step</span><span className="t">A step</span></div>
              <div className="out l1"><span className="pill pill-brand">In progress</span></div>
              <div className="out l2"><span className="pill pill-positive">Filed</span></div>
              <div className="out l3"><span className="pill pill-highlight">Needs you</span></div>
              <div className="out l4"><span className="pill pill-warning">Due soon</span></div>
              <div className="out l5"><span className="pill pill-positive">Completed</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* The VCFO way vs. the old way (board C2) */}
      <CompareSection onDemo={openDemo} />

      {/* Trust */}
      <section className="section" id="trust">
        <div className="container">
          <div className="section-head reveal" style={st("margin-bottom:0")}>
            <h2 className="h2">Built by a firm that files, for firms that file.</h2>
            <p className="body">SBC, a company secretarial and compliance practice, built VCFO Suite and runs its own engagements on it every day. Your firm gets the same system: your people, your clients, one record.</p>
          </div>
          <div className="trust reveal">
            <div className="card card-hover" data-stagger style={st("--i:0")}><div className="tile"><span className="icon"><Ic><rect width="20" height="8" x="2" y="2" rx="2" ry="2" /><rect width="20" height="8" x="2" y="14" rx="2" ry="2" /><line x1="6" x2="6.01" y1="6" y2="6" /><line x1="6" x2="6.01" y1="18" y2="18" /></Ic></span></div><h3 className="h3">Hosted in India</h3><p>AWS Mumbai region, encrypted storage. Client data does not leave the country.</p></div>
            <div className="card card-hover" data-stagger style={st("--i:1")} data-app="credentials" role="button" aria-haspopup="dialog" tabIndex={0}><div className="tile"><span className="icon"><Ic><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" /><circle cx="16.5" cy="7.5" r=".5" fill="currentColor" /></Ic></span></div><h3 className="h3">Credentials stay sealed</h3><p>Portal and registration logins are stored encrypted and shown only to the people on the engagement.</p></div>
            <div className="card card-hover" data-stagger style={st("--i:2")} data-app="audit" role="button" aria-haspopup="dialog" tabIndex={0}><div className="tile"><span className="icon"><Ic><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /><path d="M14 2v5a1 1 0 0 0 1 1h5" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></Ic></span></div><h3 className="h3">An audit trail you can read</h3><p>Every change is logged with who and when. Clients see their own trail in the portal.</p></div>
            <div className="card card-hover" data-stagger style={st("--i:3")}><div className="tile"><span className="icon"><Ic><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" /><rect x="2" y="4" width="20" height="16" rx="2" /></Ic></span></div><h3 className="h3">Email is the record</h3><p>Every notice goes by email. WhatsApp is a reminder on top, never the only copy.</p></div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section" id="faq">
        <div className="container">
          <div className="section-head reveal">
            <h2 className="h2">Questions clients ask before the first step.</h2>
          </div>
          <div className="faq reveal">
            <details><summary>Who is VCFO Suite for?<span className="icon"><Ic><path d="m6 9 6 6 6-6" /></Ic></span></summary><p className="a">Firms that incorporate and keep companies compliant in India, and their clients: Indian founders, and foreign parents setting up a subsidiary or a global capability centre. The firm, the Indian team and the parent entity all log in to the same record.</p></details>
            <details><summary>Is it only for SBC?<span className="icon"><Ic><path d="m6 9 6 6 6-6" /></Ic></span></summary><p className="a">No. SBC built it and runs its own engagements on it. Another firm gets its own workspace, with its own people, clients and calendar.</p></details>
            <details><summary>What does the client actually do in the portal?<span className="icon"><Ic><path d="m6 9 6 6 6-6" /></Ic></span></summary><p className="a">Answer the questionnaire, upload the documents each step asks for, approve board resolutions, sign with a DSC, and watch the timeline. Questions go to Ask VCFO or to the people named on the engagement.</p></details>
            <details><summary>Which filings does the calendar cover?<span className="icon"><Ic><path d="m6 9 6 6 6-6" /></Ic></span></summary><p className="a">MCA, GST, Income tax, Payroll, FEMA and Labour obligations for the financial year, generated from the certificate date and the registrations the company holds. Each one carries its statutory due date.</p></details>
            <details><summary>How are we reminded?<span className="icon"><Ic><path d="m6 9 6 6 6-6" /></Ic></span></summary><p className="a">Every due date emails the owner of the step. With consent, a WhatsApp reminder goes out as well. The email is always the record; WhatsApp never replaces it.</p></details>
            <details><summary>Where is our data hosted, and who can see it?<span className="icon"><Ic><path d="m6 9 6 6 6-6" /></Ic></span></summary><p className="a">On AWS in the Mumbai region, with encrypted storage. Access is scoped by role, so a client sees only their own companies and the firm&apos;s people assigned to them.</p></details>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section cta" id="demo">
        <div className="glow glow-brand glow-a"></div>
        <div className="container reveal">
          <p className="big"><span style={st("--i:0")}>Your clients.</span><span style={st("--i:1")}>Their filings.</span><span style={st("--i:2")}>Your team.</span><span className="last" style={st("--i:3")}>All on one record.</span></p>
          <div className="cta-actions">
            <button className="btn btn-primary" type="button" onClick={openDemo}>Book a demo <span className="icon"><Ic><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></Ic></span></button>
            <Link className="btn btn-secondary" href={SIGN_IN_HREF}>Try it live <span className="icon"><Ic><path d="M14 4.1 12 6" /><path d="m5.1 8-2.9-.8" /><path d="m6 12-1.9 2" /><path d="M7.2 2.2 8 5.1" /><path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z" /></Ic></span></Link>
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
                <li><a href="#journey">How it works</a></li>
                <li><a href="#record">The record</a></li>
                <li><a href="#trust">Security</a></li>
                <li><a href="#faq">FAQ</a></li>
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
