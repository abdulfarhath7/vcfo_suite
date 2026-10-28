"use client";
import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { DEMO_HREF, GUIDE, GUIDE_HELLO } from "./content";

type Msg = { id: number; who: "bot" | "me"; text?: string; q?: number; typing?: boolean };

/**
 * Ask VCFO quick answers on the landing page, as on the old v6 landing: a fixed text button (R-04, no mascot)
 * and a small panel. The answers are the fixed marketing list in content.ts; nothing reads client data.
 */
export function AskGuide() {
  const [open, setOpen] = React.useState(false);
  const [log, setLog] = React.useState<Msg[]>([]);
  const [asked, setAsked] = React.useState<Set<number>>(new Set());
  const pill = React.useRef<HTMLButtonElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const logRef = React.useRef<HTMLDivElement>(null);
  const seq = React.useRef(1);

  React.useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>(".guide-qs button, .guide-x")?.focus();
  }, [open]);

  React.useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log]);

  const show = () => {
    if (!log.length) setLog([{ id: seq.current++, who: "bot", text: GUIDE_HELLO }]);
    setOpen(true);
  };
  const hide = () => {
    setOpen(false);
    requestAnimationFrame(() => pill.current?.focus({ preventScroll: true }));
  };
  const ask = (i: number) => {
    setAsked((s) => new Set(s).add(i));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const me: Msg = { id: seq.current++, who: "me", text: GUIDE[i].q };
    const bot: Msg = { id: seq.current++, who: "bot", q: i, typing: !reduce };
    setLog((l) => [...l, me, bot]);
    if (!reduce) setTimeout(() => setLog((l) => l.map((m) => (m.id === bot.id ? { ...m, typing: false } : m))), 320);
  };
  const scrollTo = (sec: string) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(sec)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  // Escape inside the open panel closes it and gives focus back to the pill.
  React.useEffect(() => {
    const el = panel.current;
    if (!open || !el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      requestAnimationFrame(() => pill.current?.focus({ preventScroll: true }));
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [open]);

  const left = GUIDE.map((g, i) => ({ g, i })).filter(({ i }) => !asked.has(i));

  return (
    <div className={`guide${open ? " open" : ""}`}>
      {open ? (
        <div
          ref={panel}
          className="guide-panel card"
          role="dialog"
          aria-modal="false"
          aria-labelledby="guide-t"
        >
          <div className="guide-head">
            <div>
              <b id="guide-t">Ask VCFO</b>
              <span>Quick answers about the product</span>
            </div>
            <button type="button" className="guide-x" aria-label="Close Ask VCFO" onClick={hide}>
              <X size={18} strokeWidth={1.6} />
            </button>
          </div>
          <div ref={logRef} className="guide-log" aria-live="polite">
            {log.map((m) => {
              if (m.typing)
                return (
                  <div key={m.id} className="msg bot typing" aria-hidden>
                    <i />
                    <i />
                    <i />
                  </div>
                );
              if (m.q === undefined)
                return (
                  <div key={m.id} className={`msg ${m.who}`}>
                    {m.text}
                  </div>
                );
              const g = GUIDE[m.q];
              return (
                <div key={m.id} className="msg bot">
                  {g.a}
                  <div className="acts">
                    <button type="button" className="btn btn-secondary" onClick={() => scrollTo(g.sec)}>
                      Show me
                    </button>
                    <Link className={`btn ${g.sales ? "btn-primary" : "btn-ghost"}`} href={DEMO_HREF}>
                      Book a demo
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="guide-qs" role="group" aria-label="Suggested questions">
            {left.length ? (
              left.map(({ g, i }) => (
                <button key={g.q} type="button" onClick={() => ask(i)}>
                  {g.q}
                </button>
              ))
            ) : (
              <Link className="btn btn-primary btn-sm" href={DEMO_HREF}>
                Book a demo
              </Link>
            )}
          </div>
        </div>
      ) : (
        <button ref={pill} type="button" className="guide-pill" aria-expanded={false} onClick={show}>
          Ask VCFO
        </button>
      )}
    </div>
  );
}
