"use client";
import * as React from "react";
import { ArrowRight, Check, Minus, X } from "lucide-react";
import { ASK_A, ASK_Q, COMPARE, COMPARE_COLS, MONTHS, REGULATORS, busyWeeks, ringItems, type Mark } from "./content";
import { reduceMotion } from "./landing-motion";

/** A 24 px line icon, drawn the way the old landing drew them (stroke 1.75). */
export function Ic({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** The hero stage word: typed, held, erased and retyped, one stage after the other. */
export function SwapWord({ words, start }: { words: string[]; start: boolean }) {
  const [text, setText] = React.useState(words[0]);
  React.useEffect(() => {
    if (!start || reduceMotion()) return;
    let wi = 0;
    let cur = words[0];
    let timer: ReturnType<typeof setTimeout>;
    const type = (word: string, i: number) => {
      cur = word.slice(0, i);
      setText(cur);
      if (i >= word.length) return cycle();
      timer = setTimeout(() => type(word, i + 1), 72);
    };
    const erase = () => {
      if (!cur.length) {
        wi = (wi + 1) % words.length;
        timer = setTimeout(() => type(words[wi], 1), 260);
        return;
      }
      cur = cur.slice(0, -1);
      setText(cur);
      timer = setTimeout(erase, 40);
    };
    const cycle = () => {
      timer = setTimeout(erase, 2400);
    };
    cycle();
    return () => clearTimeout(timer);
  }, [words, start]);
  return <span className="swap">{text}</span>;
}

/** Fixed decimals, so the server and the browser print the same coordinates. */
const f2 = (n: number) => n.toFixed(2);

/** The ring tracks, outside in, with the short label drawn inside each track at twelve o'clock. */
const RING = [
  { s: "gst", r: 214, l: "GST" },
  { s: "it", r: 192, l: "TAX" },
  { s: "mca", r: 170, l: "MCA" },
  { s: "lab", r: 148, l: "LAB" },
  { s: "rbi", r: 126, l: "RBI" },
] as const;

/**
 * The year ring: one track per regulator, a dot for every statutory date, a sweeping hand.
 * Each dot carries its month (`data-m`), so the pinned #comply section can turn the ring month by month.
 * The one label in the centre is "each filing: owner · date · proof" (D7, the old #record section).
 */
export function ComplianceRing() {
  const C = 260;
  const R = Object.fromEntries(RING.map((t) => [t.s, t.r])) as Record<(typeof RING)[number]["s"], number>;
  const items = ringItems();
  const pos = (m: number, d: number, r: number) => {
    const a = ((m + (d - 1) / 31) / 12) * Math.PI * 2 - Math.PI / 2;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };
  return (
    <svg id="ring" viewBox="0 0 520 520" role="img" aria-label="A year ring from April to March with dots for every statutory filing: GST, income tax, MCA, labour and RBI. Each filing has an owner, a date and a proof.">
      {RING.map((t) => (
        <circle key={t.s} className="track" cx={C} cy={C} r={t.r} />
      ))}
      {RING.map((t) => (
        <text key={`l-${t.s}`} className={`trk-l s-${t.s}`} x={C - 6} y={C - t.r + 3.5}>
          {t.l}
        </text>
      ))}
      {MONTHS.map((mo, i) => {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const am = ((i + 0.5) / 12) * Math.PI * 2 - Math.PI / 2;
        return (
          <React.Fragment key={mo}>
            <line className="mline" x1={f2(C + 112 * Math.cos(a))} y1={f2(C + 112 * Math.sin(a))} x2={f2(C + 228 * Math.cos(a))} y2={f2(C + 228 * Math.sin(a))} />
            <text className="month" data-m={i} x={f2(C + 246 * Math.cos(am))} y={f2(C + 246 * Math.sin(am) + 4)}>
              {mo.toUpperCase()}
            </text>
          </React.Fragment>
        );
      })}
      {items.map((it, idx) => {
        const [x, y] = pos(it.m, it.d, R[it.s]);
        const small = it.t.indexOf("GSTR") === 0 || it.t === "TDS payment" || it.s === "lab";
        return (
          <circle key={idx} className={`dot s-${it.s}`} data-m={it.m} cx={x.toFixed(1)} cy={y.toFixed(1)} r={small ? 3.2 : 4.6} style={{ "--i": idx } as React.CSSProperties}>
            <title>{`${it.t}, ${it.d} ${MONTHS[it.m]}`}</title>
          </circle>
        );
      })}
      <g className="hand-g">
        <line className="hand" x1={C} y1={C} x2={C} y2={C - 222} />
        <circle className="hand-cap" cx={C} cy={C - 222} r={3} />
      </g>
      <circle className="ctr" cx={C} cy={C} r={100} />
      <text className="ctr-t" x={C} y={C - 12}>
        FY 2026-27
      </text>
      <text className="ctr-s" x={C} y={C + 10}>
        {items.length} statutory dates
      </text>
      <text className="ctr-l" x={C} y={C + 36}>
        each filing: owner · date · proof
      </text>
    </svg>
  );
}

/**
 * V5: the busy weeks of the year beside the ring, one column per month and one cell per week of the month,
 * darker where more statutory dates fall. Counted from the ring's own dates.
 */
export function BusyWeeks() {
  const grid = busyWeeks();
  const max = Math.max(...grid.flat());
  return (
    <figure className="heat" aria-label="Busy weeks: how many statutory dates fall in each week of the financial year. The second and third week of every month are the busiest.">
      <figcaption className="mono">Busy weeks</figcaption>
      <div className="heat-grid" aria-hidden="true">
        {grid.map((weeks, m) => (
          <div className="heat-col" key={MONTHS[m]} data-m={m}>
            {weeks.map((n, w) => (
              <span key={w} className="heat-cell" title={`${MONTHS[m]}, week ${w + 1}: ${n} ${n === 1 ? "date" : "dates"}`} style={{ "--h": n / max } as React.CSSProperties} />
            ))}
            <span className="heat-m">{MONTHS[m].slice(0, 1)}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

/**
 * V2: one status chip on the hero screenshot that changes from "In progress" to "Done" once, about two seconds
 * after load. Under reduced motion it shows "Done" at once and still.
 */
export function HeroStatus() {
  const [done, setDone] = React.useState(false);
  React.useEffect(() => {
    if (reduceMotion()) {
      setDone(true);
      return;
    }
    const t = setTimeout(() => setDone(true), 2200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="status-chip" aria-live="polite">
      <span className="t">Name approval</span>
      <span className={`pill ${done ? "pill-positive is-done" : "pill-brand"}`}>{done ? "Done" : "In progress"}</span>
    </div>
  );
}

/** V3: the six-colour regulator ribbon under the hero, one band per regulator on the calendar. */
export function RegulatorRibbon() {
  return (
    <ul className="ribbon" aria-label="Six regulators on one calendar">
      {REGULATORS.map((r, i) => (
        <li key={r.name} style={{ "--c": r.c, "--i": i } as React.CSSProperties}>
          {r.name}
        </li>
      ))}
    </ul>
  );
}

/**
 * D8: the Ask VCFO bubble on the portal screenshot. The page renders the whole answer; when the bubble first
 * comes into view it types the answer once. Under reduced motion, or without IntersectionObserver, it stays whole.
 */
export function AskBubble() {
  const ref = React.useRef<HTMLDivElement>(null);
  const [typed, setTyped] = React.useState(ASK_A);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || reduceMotion() || !("IntersectionObserver" in window)) return;
    let timer: ReturnType<typeof setTimeout>;
    const type = (i: number) => {
      setTyped(ASK_A.slice(0, i));
      if (i < ASK_A.length) timer = setTimeout(() => type(i + 1), 28);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        timer = setTimeout(() => type(0), 500);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, []);
  const typing = typed.length < ASK_A.length;
  return (
    <div ref={ref} className="ask-bubble card" data-app="home-chat" aria-label="Book a demo to try Ask VCFO" role="button" aria-haspopup="dialog" tabIndex={0}>
      <span className="mono">Ask VCFO</span>
      <p className="msg me">{ASK_Q}</p>
      <p className={`msg bot${typing ? " typing-on" : ""}`}>
        <span aria-hidden="true">{typed}</span>
        <span className="sr">{ASK_A}</span>
      </p>
    </div>
  );
}

function CompareMark({ m }: { m: Mark }) {
  if (m === "yes") return <Check className="cmp-yes" size={22} strokeWidth={2.2} role="img" aria-label="Yes" />;
  if (m === "no") return <X className="cmp-no" size={20} strokeWidth={1.8} role="img" aria-label="No" />;
  return (
    <span className="cmp-part">
      <Minus size={18} strokeWidth={1.8} role="img" aria-label="Partly" />
      By hand
    </span>
  );
}

/**
 * Board C2: VCFO Suite against a generic task tool and spreadsheets. On a phone the task-tool column drops out.
 * "Book a demo" opens the landing's Book a demo dialog through `onDemo`.
 */
export function CompareSection({ onDemo }: { onDemo: () => void }) {
  return (
    <section className="cmp" id="compare" aria-labelledby="cmp-t">
      <div className="cmp-in">
        <div className="cmp-head reveal">
          <span className="cmp-kicker">The VCFO way vs. the old way</span>
          <h2 className="cmp-h" id="cmp-t">
            Spreadsheets break when compliance stops being <span>routine.</span>
          </h2>
        </div>
        <div className="cmp-card reveal" data-play>
          <table className="cmp-table">
            <caption className="sr">VCFO Suite compared with the old way</caption>
            <colgroup>
              <col className="c-label" />
              <col className="c-vcfo" />
              <col className="c-tool" />
              <col className="c-sheet" />
            </colgroup>
            <thead>
              <tr>
                <td className="cmp-corner" />
                <th scope="col" className="cmp-vh">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a fixed logo at its own size, as on the old landing */}
                  <img src="/landing/vcfo-logo-on-black.webp" alt={COMPARE_COLS[0]} width="1104" height="240" />
                </th>
                <th scope="col" className="cmp-oh c-tool">
                  {COMPARE_COLS[1]}
                </th>
                <th scope="col" className="cmp-oh">
                  {COMPARE_COLS[2]}
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((r, i) => (
                <tr key={r.label} style={{ "--r": i } as React.CSSProperties}>
                  <th scope="row">{r.label}</th>
                  <td className="cmp-v">
                    <CompareMark m={r.vcfo} />
                  </td>
                  <td className="c-tool">
                    <CompareMark m={r.tool} />
                  </td>
                  <td>
                    <CompareMark m={r.sheet} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="cmp-acts reveal">
          <button className="cmp-btn" type="button" onClick={onDemo}>
            Book a demo <ArrowRight size={16} strokeWidth={2} aria-hidden />
          </button>
          <a className="cmp-link" href="#incorporate">
            See how it works
          </a>
        </div>
      </div>
    </section>
  );
}
