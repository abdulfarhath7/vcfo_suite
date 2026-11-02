'use client';

/**
 * The portal's overlays, rendered once inside the `.cpx` root:
 *  - PopHost:     `.pop` (small anchored card, Back stack, placement as the prototype's placePop)
 *  - WizardHost:  `.wiz` (full-screen step-by-step walkthrough)
 *  - ModalHost:   `.modal-wrap` (one modal at a time; click the scrim or [data-close] to close)
 *  - SearchPalette: Ctrl K over every item the sections published
 * and the generic WizardView a section renders inside openWizard(...).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Btn, Icon, Pill, type IconName } from './ui';
import { useFx, usePortal, type PaletteItem } from './runtime';

/* ================================================================ popover */

export function PopHost() {
  const { pop, closePop, popBack } = usePortal();
  const { mounted, shown } = useFx(Boolean(pop), 240);
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef(pop);
  if (pop) last.current = pop;
  const cur = pop ?? last.current;

  const place = useCallback(() => {
    const el = ref.current;
    if (!el || !cur) return;
    const a = cur.anchor;
    const r = a ? (a instanceof Element ? a.getBoundingClientRect() : a) : null;
    const W = el.offsetWidth;
    const H = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const m = 12;
    let x: number;
    let y: number;
    if (!r) {
      x = (vw - W) / 2;
      y = (vh - H) / 2;
    } else if (r.right + 10 + W < vw - m) {
      x = r.right + 10;
      y = r.top - 10;
    } else if (r.left - 10 - W > m) {
      x = r.left - 10 - W;
      y = r.top - 10;
    } else {
      x = Math.min(Math.max(m, r.right - W), vw - W - m);
      y = r.bottom + 8;
      if (y + H > vh - m) y = r.top - H - 8;
    }
    el.style.left = Math.round(Math.min(Math.max(m, x), vw - W - m)) + 'px';
    el.style.top = Math.round(Math.min(Math.max(m, y), vh - H - m)) + 'px';
  }, [cur]);

  useLayoutEffect(() => {
    if (mounted) place();
  });

  useEffect(() => {
    if (!pop) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t || ref.current?.contains(t)) return;
      if (t.closest('.wiz,.modal-wrap,.chat,[data-open],[data-pop-anchor],.acct-menu')) return;
      closePop();
    };
    const onScroll = () => {
      const a = pop.anchor;
      if (a instanceof Element) {
        const r = a.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) closePop();
        else place();
      }
    };
    const onResize = () => place();
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [pop, closePop, place]);

  // focus the first primary button (or any button) when a card opens
  const seq = pop?.seq;
  useEffect(() => {
    if (!seq) return;
    const el = ref.current?.querySelector<HTMLElement>('.btn.pri, button');
    el?.focus({ preventScroll: true });
  }, [seq]);

  if (!mounted || !cur) return null;
  const top = cur.stack[cur.stack.length - 1];
  return (
    <div ref={ref} className={'pop fx' + (cur.cls ? ' ' + cur.cls : '') + (shown && pop ? ' show' : '')} role="dialog" aria-label="Details" data-kind={cur.kind}>
      {cur.stack.length > 1 ? (
        <button type="button" className="back" onClick={popBack}>
          <Icon name="back" />
          Back
        </button>
      ) : null}
      <div key={cur.stack.length} className={cur.stack.length > 1 ? 'fadein' : undefined}>
        {top}
      </div>
    </div>
  );
}

/** Popover header: optional lead element, title, sub line, close button (prototype popHead). */
export function PopHead({ title, sub, lead }: { title: ReactNode; sub?: ReactNode; lead?: ReactNode }) {
  const { closePop } = usePortal();
  return (
    <div className="pop-h">
      {lead ?? null}
      <div style={{ minWidth: 0 }}>
        <h4>{title}</h4>
        {sub ? <div className="sb">{sub}</div> : null}
      </div>
      <button type="button" className="ib x" aria-label="Close" onClick={() => closePop()}>
        <Icon name="x" />
      </button>
    </div>
  );
}

/* ================================================================ walkthrough */

/** The `.wiz` overlay. Its content (bar, rail, card) is a WizardView rendered by the section that opened it. */
export function WizardHost() {
  const { wizard } = usePortal();
  const { mounted, shown } = useFx(Boolean(wizard), 300);
  const last = useRef(wizard);
  if (wizard) last.current = wizard;
  const cur = wizard ?? last.current;
  if (!mounted || !cur) return null;
  return (
    <div className={'wiz fx' + (shown && wizard ? ' show' : '')} role="dialog" aria-modal="true" aria-labelledby="wz-t">
      <div key={cur.seq} style={{ display: 'contents' }}>
        {cur.node}
      </div>
    </div>
  );
}

export type WizWho = 'YOU' | 'SBC' | 'GOVT' | 'BANK' | 'MCA';
export type WizState = 'done' | 'now' | 'stuck' | 'up' | 'na';

export interface WizStep {
  who: WizWho;
  title: string;
  /** main text under the "who" box */
  body?: string;
  /** why it is stuck (shown in a red banner when state = stuck) */
  sub?: string;
  state: WizState;
  /** extra content under the body: an upload drop, the real step form, a document stage … */
  extra?: ReactNode;
  /** hide the Next / Back footer (when `extra` brings its own actions) */
  noFoot?: boolean;
}

const WHO_COPY = (manager: string, company: string): Record<WizWho, [string, string, string, string, string]> => ({
  YOU: ['YOU', 'This one is yours', 'Only you can do this. Everything after it waits for you.', 'var(--due-bg)', 'var(--due-ink)'],
  SBC: ['SBC', 'SBC does this', `${manager}’s team handles it. Nothing for you to do.`, 'var(--ice-soft)', 'var(--ice)'],
  GOVT: ['GOV', 'The government processes this', 'SBC tracks it daily and tells you when it clears.', 'var(--hi)', 'var(--ink-2)'],
  MCA: ['MCA', 'The Ministry of Corporate Affairs processes this', 'SBC tracks it daily and tells you when it clears.', 'var(--hi)', 'var(--ink-2)'],
  BANK: ['BANK', 'Your bank does this', 'SBC has asked them and follows up every two days.', 'var(--hi)', 'var(--ink-2)'],
});
const WST: Record<WizState, ['ok' | 'up' | 'over' | 'mut', IconName, string]> = {
  done: ['ok', 'check', 'Done'],
  now: ['up', 'clock', 'Happening now'],
  stuck: ['over', 'alert', 'Stuck here'],
  up: ['mut', 'clock', 'Not started yet'],
  na: ['mut', 'check', 'Not needed'],
};
const ND: Record<WizState, string> = { done: 'done', now: 'prog', stuck: 'over', up: 'up', na: 'na' };

/**
 * The generic walkthrough (prototype openWizard / paintWizard): a rail of steps,
 * a progress bar, one card per step and a Summary card at the end. Arrow keys
 * move between steps when focus is not in a field.
 */
export function WizardView({
  title,
  sub,
  steps,
  start,
  what,
  docs,
  pen,
  ask,
  summary = true,
}: {
  title: string;
  sub: string;
  steps: WizStep[];
  /** index to open on; default: the first stuck / now step */
  start?: number;
  what?: string;
  docs?: string[];
  pen?: string;
  /** question sent to Ask VCFO from the bar */
  ask?: string;
  /** show the Summary card after the last step (prototype: always) */
  summary?: boolean;
}) {
  const { closeWizard, openChat, shell } = usePortal();
  const N = steps.length;
  const first = steps.findIndex((s) => s.state === 'stuck' || s.state === 'now');
  const [i, setI] = useState(start ?? (first >= 0 ? first : 0));
  const manager = shell?.team.find((t) => t.role === 'Project Manager')?.name ?? 'Your project manager';
  const WHO = useMemo(() => WHO_COPY(manager, shell?.companyShort ?? ''), [manager, shell?.companyShort]);
  const max = summary ? N : N - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = document.activeElement;
      if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
      if ((a as HTMLElement | null)?.isContentEditable) return;
      if (document.querySelector('.cpx .modal-wrap')) return;
      if (e.key === 'ArrowRight') setI((v) => Math.min(v + 1, max));
      if (e.key === 'ArrowLeft') setI((v) => Math.max(v - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [max]);

  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const doneN = steps.filter((s) => s.state === 'done').length;
  const s = i < N ? steps[i] : undefined;

  return (
    <>
      <div className="wz-bar">
        <button ref={closeRef} type="button" className="btn" onClick={closeWizard}>
          <Icon name="back" />
          Back
        </button>
        <div className="tt">
          <b id="wz-t">{title}</b>
          <span>{sub}</span>
        </div>
        <span className="sp" />
        <button type="button" className="btn" onClick={() => openChat(ask ?? title)}>
          <Icon name="chat" />
          Ask VCFO
        </button>
      </div>
      <div className="wz-prog">
        {steps.map((st, n) => (
          <i key={n} className={st.state === 'done' ? 'd' : n === i ? 'c' : ''} />
        ))}
      </div>
      <div className="wz-in">
        <nav className="glass wz-rail" aria-label="Steps">
          <div className="eyebrow" style={{ padding: '4px 10px 8px' }}>
            {N} step{N === 1 ? '' : 's'}
          </div>
          {steps.map((st, n) => (
            <button key={n} type="button" className={n === i ? 'cur' : ''} onClick={() => setI(n)}>
              <span className={'nd ' + ND[st.state]}>{st.state === 'done' ? <Icon name="check" /> : st.state === 'stuck' ? '!' : String(n + 1)}</span>
              <b>{st.title}</b>
              <span>
                {(WHO[st.who] ?? WHO.SBC)[0]} · {WST[st.state][2]}
              </span>
            </button>
          ))}
          {summary ? (
            <button type="button" className={i === N ? 'cur' : ''} onClick={() => setI(N)}>
              <span className="nd up">
                <Icon name="check" />
              </span>
              <b>Summary</b>
              <span>PAPERS · IF MISSED</span>
            </button>
          ) : null}
        </nav>
        <section key={i} className="glass wz-card fadein">
          {s ? (
            <>
              <div className="kick">
                <Pill kind="mut">
                  Step {i + 1} of {N}
                </Pill>
                <Pill kind={WST[s.state][0]} icon={WST[s.state][1]}>
                  {WST[s.state][2]}
                </Pill>
              </div>
              <h2 id="wz-h">{s.title}</h2>
              <div className="who-big">
                <span className="wa" style={{ background: (WHO[s.who] ?? WHO.SBC)[3], color: (WHO[s.who] ?? WHO.SBC)[4] }}>
                  {(WHO[s.who] ?? WHO.SBC)[0]}
                </span>
                <div>
                  <b>{(WHO[s.who] ?? WHO.SBC)[1]}</b>
                  <span>{(WHO[s.who] ?? WHO.SBC)[2]}</span>
                </div>
              </div>
              {s.body ? (
                <p className="sx" style={{ marginTop: 16 }}>
                  {s.body}
                </p>
              ) : null}
              {s.state === 'stuck' && s.sub ? (
                <div className="banner over">
                  <Icon name="alert" />
                  <div>
                    <b>Why it is stuck</b>
                    <span>{s.sub}</span>
                  </div>
                </div>
              ) : null}
              {s.extra ?? null}
              {s.noFoot ? null : (
                <div className="wz-foot">
                  <Btn ico="back" onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0}>
                    Back
                  </Btn>
                  <span className="sp" />
                  <Btn ico="chat" onClick={() => openChat(s.title)}>
                    Ask about this step
                  </Btn>
                  {i < max ? (
                    <Btn cls="pri" ico="chev" onClick={() => setI((v) => v + 1)}>
                      {i === N - 1 ? 'See the summary' : 'Next step'}
                    </Btn>
                  ) : (
                    <Btn cls="pri" ico="check" onClick={closeWizard}>
                      Done
                    </Btn>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="kick">
                <Pill kind="mut">Summary</Pill>
                <Pill kind={doneN === N ? 'ok' : 'up'}>
                  {doneN} of {N} done
                </Pill>
              </div>
              <h2>{doneN === N ? 'Every step is done.' : 'That is the whole procedure.'}</h2>
              {what ? <p className="sx">{what}</p> : null}
              {docs && docs.length ? (
                <>
                  <div className="eyebrow" style={{ marginTop: 20 }}>
                    Papers involved
                  </div>
                  <div className="needs">
                    {docs.map((d) => (
                      <div key={d} className="need">
                        <Icon name="doc" size={18} />
                        {d}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
              {pen ? (
                <div className="banner over">
                  <Icon name="alert" />
                  <div>
                    <b>If it is missed</b>
                    <span>{pen}</span>
                  </div>
                </div>
              ) : null}
              <div className="wz-foot">
                <Btn ico="back" onClick={() => setI(N - 1)}>
                  Back
                </Btn>
                <span className="sp" />
                <Btn onClick={() => setI(0)}>Start again</Btn>
                <Btn cls="pri" ico="check" onClick={closeWizard}>
                  Done
                </Btn>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

/* ================================================================ modal */

export function ModalHost() {
  const { modal, closeModal } = usePortal();
  const { mounted, shown } = useFx(Boolean(modal), modal?.opts.soft ? 450 : 280);
  const last = useRef(modal);
  if (modal) last.current = modal;
  const cur = modal ?? last.current;
  if (!mounted || !cur) return null;
  return (
    <div
      className={'modal-wrap fx' + (cur.opts.soft ? ' soft' : '') + (shown && modal ? ' show' : '')}
      style={cur.opts.top ? { placeItems: 'start center' } : undefined}
      role="presentation"
      onClick={(e) => {
        const t = e.target as Element;
        if (t === e.currentTarget || t.closest('[data-close]')) closeModal();
      }}
      onKeyDown={(e) => {
        // Escape is also handled globally (runtime.tsx); this keeps the scrim's click/keyboard pair explicit
        if (e.key === 'Escape') closeModal();
      }}
    >
      <div key={cur.seq} style={{ display: 'contents' }}>
        {cur.node}
      </div>
    </div>
  );
}

/** A standard `.modal` box: title, optional sub line, body and footer. */
export function ModalBox({
  title,
  sub,
  eyebrow,
  children,
  foot,
  width,
  className,
  label,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  eyebrow?: ReactNode;
  children?: ReactNode;
  foot?: ReactNode;
  width?: number;
  className?: string;
  label?: string;
}) {
  return (
    <div className={'modal' + (className ? ' ' + className : '')} role="dialog" aria-modal="true" aria-label={label ?? (typeof title === 'string' ? title : undefined)} style={width ? { width: `min(${width}px, 100%)` } : undefined}>
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      {title ? <h3 style={eyebrow ? { marginTop: 6 } : undefined}>{title}</h3> : null}
      {sub ? <div className="subx">{sub}</div> : null}
      {children}
      {foot ? <div className="mfoot">{foot}</div> : null}
    </div>
  );
}

/* ================================================================ search palette */

/** Opens the palette in the modal host whenever `openSearch()` is called (Ctrl K, the top-bar button). */
export function SearchBridge() {
  const { searchSeq, openModal, closeModal } = usePortal();
  useEffect(() => {
    if (searchSeq > 0) openModal(<SearchPalette onClose={closeModal} />, { top: true, label: 'Search' });
  }, [searchSeq, openModal, closeModal]);
  return null;
}

const SEARCH_HINT = 'Nothing matches. Try a form name like GSTR-1, a step like PT Registration, or a portal like EPFO.';

export function SearchPalette({ onClose }: { onClose: () => void }) {
  const { paletteItems } = usePortal();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  const all = useMemo(() => paletteItems(), [paletteItems]);
  const items: PaletteItem[] = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? all.filter((i) => i.label.toLowerCase().includes(t) || i.kind.toLowerCase().includes(t)) : all.slice(0, 12)).slice(0, 14);
  }, [q, all]);
  const cur = Math.min(sel, Math.max(items.length - 1, 0));
  const pick = (it: PaletteItem | undefined) => {
    if (!it) return;
    onClose();
    it.go();
  };
  return (
    <div className="pal" role="dialog" aria-modal="true" aria-label="Search">
      <input
        ref={inputRef}
        value={q}
        placeholder="Search filings, steps, documents, books or portals…"
        aria-label="Search"
        onChange={(e) => {
          setQ(e.target.value);
          setSel(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSel(Math.min(cur + 1, items.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSel(Math.max(cur - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            pick(items[cur]);
          }
        }}
      />
      <div className="pal-l">
        {items.length ? (
          items.map((it, n) => (
            <button key={it.id} type="button" className={'pal-i' + (n === cur ? ' sel' : '')} onClick={() => pick(it)} onMouseEnter={() => setSel(n)}>
              <i style={{ background: it.sw }} />
              <span>{it.label}</span>
              <span className="k">{it.kind}</span>
            </button>
          ))
        ) : (
          <div className="lede" style={{ padding: 16 }}>
            {SEARCH_HINT}
          </div>
        )}
      </div>
    </div>
  );
}
