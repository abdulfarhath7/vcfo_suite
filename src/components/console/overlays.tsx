'use client';

/**
 * Console overlays, rendered once inside the console root (prototype
 * mgr_body.txt): `.pop` (anchored card), `.modal-wrap > .modal.mx-modal`,
 * `.mx-scrim + .mx-drawer`, `.toast.mx-toast` (with Undo), the Ctrl K
 * palette, plus the two pop-over bodies every page uses: the breakdown
 * ("every donut and every count is a door") and the action menu.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { GoArrow, Icon, type IconName } from '@/components/portal/ui';
import { useConsole, useFx, type PaletteItem } from './runtime';
import { Empty } from './ui';

/* ================================================================ popover */

export function PopHost() {
  const { pop, closePop, popBack } = useConsole();
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
      if (t.closest('.modal-wrap,.mx-drawer,.chat,[data-pop-anchor],.acct-menu')) return;
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
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', place);
    };
  }, [pop, closePop, place]);

  const seq = pop?.seq;
  useEffect(() => {
    if (!seq) return;
    ref.current?.querySelector<HTMLElement>('.btn.pri, button')?.focus({ preventScroll: true });
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

/** Popover header: optional lead element, title, sub line, close (prototype popHead). */
export function PopHead({ title, sub, lead }: { title: ReactNode; sub?: ReactNode; lead?: ReactNode }) {
  const { closePop } = useConsole();
  return (
    <div className="pop-h">
      {lead ?? null}
      <div style={{ minWidth: 0 }}>
        <h4>{title}</h4>
        {sub ? <div className="sb">{sub}</div> : null}
      </div>
      <button type="button" className="ib x" aria-label="Close" onClick={closePop}>
        <Icon name="x" />
      </button>
    </div>
  );
}

/* ================================================================ breakdown (mxDrill) */

export interface DrillRow {
  id: string;
  title: string;
  meta?: string;
  /** right-hand state text */
  state?: string;
  /** colour of the left mark */
  color?: string;
  onOpen?: () => void;
}
export interface DrillTab {
  label: string;
  color?: string;
  rows: DrillRow[];
}

/** The breakdown pop-up: a tab per status or type, rows that open their page, and where the full list lives. */
export function Drill({ title, sub, tabs, active = 0, link }: { title: string; sub?: string; tabs: DrillTab[]; active?: number; link?: { text: string; onClick: () => void } }) {
  const { closePop } = useConsole();
  const [act, setAct] = useState(Math.min(active, Math.max(tabs.length - 1, 0)));
  const tab = tabs[act];
  const rows = tab?.rows ?? [];
  return (
    <div className="mx-drill">
      <PopHead title={title} sub={sub} />
      <div className="mx-dtabs" role="tablist">
        {tabs.map((t, i) => (
          <button key={t.label} type="button" role="tab" aria-pressed={i === act} aria-selected={i === act} onClick={() => setAct(i)}>
            {t.color ? <i style={{ background: t.color }} /> : null}
            {t.label}
            <b>{t.rows.length}</b>
          </button>
        ))}
      </div>
      <div className="mx-drows">
        {rows.length ? (
          rows.slice(0, 12).map((r) => (
            <button
              key={r.id}
              type="button"
              className="mx-drow"
              onClick={() => {
                closePop();
                r.onOpen?.();
              }}
            >
              <i style={{ background: r.color ?? 'var(--ink-3)' }} />
              <span className="mx-dt">
                <b>{r.title}</b>
                {r.meta ? <span>{r.meta}</span> : null}
              </span>
              {r.state ? <span className="mx-ds">{r.state}</span> : null}
            </button>
          ))
        ) : (
          <Empty title="Nothing here" sub="This list is clear." />
        )}
      </div>
      {link ? (
        <div className="pop-foot">
          <span className="small">{rows.length > 12 ? `Showing 12 of ${rows.length}` : `Showing all ${rows.length}`}</span>
          <span className="sp" />
          <GoArrow
            label={link.text}
            onClick={() => {
              closePop();
              link.onClick();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/* ================================================================ menu (mxMenu) */

export interface MenuItem {
  label: string;
  sub?: string;
  ico?: IconName;
  lead?: ReactNode;
  on?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export function Menu({ title, items }: { title?: string; items: Array<MenuItem | '-'> }) {
  const { closePop } = useConsole();
  return (
    <div className="mx-menu" role="menu">
      {title ? <div className="eyebrow">{title}</div> : null}
      {items.map((it, i) =>
        it === '-' ? (
          <hr key={`hr${i}`} />
        ) : (
          <button
            key={it.label}
            type="button"
            role="menuitem"
            disabled={it.disabled}
            className={'mx-mi' + (it.on ? ' on' : '') + (it.danger ? ' danger' : '')}
            onClick={() => {
              closePop();
              it.onSelect();
            }}
          >
            {it.lead ?? (it.ico ? <Icon name={it.ico} /> : null)}
            <span className="mx-mt">
              <b>{it.label}</b>
              {it.sub ? <span>{it.sub}</span> : null}
            </span>
          </button>
        ),
      )}
    </div>
  );
}

/* ================================================================ modal */

export function ModalHost() {
  const { modal, closeModal } = useConsole();
  const { mounted, shown } = useFx(Boolean(modal), 280);
  const last = useRef(modal);
  if (modal) last.current = modal;
  const cur = modal ?? last.current;
  const boxRef = useRef<HTMLDivElement>(null);
  const seq = modal?.seq;
  useEffect(() => {
    if (!seq) return;
    const t = setTimeout(() => boxRef.current?.querySelector<HTMLElement>('input,textarea,select')?.focus(), 60);
    return () => clearTimeout(t);
  }, [seq]);
  if (!mounted || !cur) return null;
  return (
    <div
      className={'modal-wrap fx' + (shown && modal ? ' show' : '')}
      style={cur.opts.top ? { placeItems: 'start center' } : undefined}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
      onClick={(e) => {
        if ((e.target as Element).closest('[data-close]')) closeModal();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') closeModal();
      }}
    >
      {cur.opts.bare ? (
        <div key={cur.seq} ref={boxRef} style={{ display: 'contents' }}>
          {cur.node}
        </div>
      ) : (
        <div key={cur.seq} ref={boxRef} className={'modal mx-modal' + (cur.opts.cls ? ' ' + cur.opts.cls : '')} role="dialog" aria-modal="true" aria-label={cur.opts.label}>
          {cur.node}
        </div>
      )}
    </div>
  );
}

/** Standard modal content: title, sub line, body and a footer of actions. */
export function ModalBody({ title, sub, eyebrow, children, foot }: { title?: ReactNode; sub?: ReactNode; eyebrow?: ReactNode; children?: ReactNode; foot?: ReactNode }) {
  return (
    <>
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      {title ? <h3 style={eyebrow ? { marginTop: 6 } : undefined}>{title}</h3> : null}
      {sub ? <div className="subx">{sub}</div> : null}
      {children}
      {foot ? <div className="mfoot">{foot}</div> : null}
    </>
  );
}

/* ================================================================ drawer */

export function DrawerHost() {
  const { drawer, closeDrawer } = useConsole();
  const { mounted, shown } = useFx(Boolean(drawer), 300);
  const last = useRef(drawer);
  if (drawer) last.current = drawer;
  const cur = drawer ?? last.current;
  if (!mounted || !cur) return null;
  return (
    <>
      <button type="button" className={'mx-scrim' + (shown && drawer ? ' show' : '')} aria-label="Close the details" onClick={closeDrawer} />
      <aside className={'mx-drawer fx' + (shown && drawer ? ' show' : '')} role="dialog" aria-label="Details">
        <div key={cur.seq} style={{ display: 'contents' }}>
          {cur.node}
        </div>
      </aside>
    </>
  );
}

/** Drawer header (prototype mxDrawHead): eyebrow, title, chips, close. */
export function DrawerHead({ eyebrow, title, chips }: { eyebrow?: ReactNode; title: ReactNode; chips?: ReactNode }) {
  const { closeDrawer } = useConsole();
  return (
    <div className="mx-dh">
      <div className="mx-dh-t">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h3>{title}</h3>
        {chips ? <div className="mx-chips">{chips}</div> : null}
      </div>
      <button type="button" className="ib" aria-label="Close" onClick={closeDrawer}>
        <Icon name="x" />
      </button>
    </div>
  );
}

/* ================================================================ toast (with Undo) */

export function ToastView() {
  const { toastMsg, clearToast } = useConsole();
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!toastMsg) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), toastMsg.undo ? 5200 : 3000);
    return () => clearTimeout(t);
  }, [toastMsg]);
  return (
    <div className={'toast mx-toast' + (on ? ' on' : '')} role="status" aria-live="polite">
      {toastMsg ? <span>{toastMsg.msg}</span> : null}
      {toastMsg?.undo ? (
        <button
          type="button"
          onClick={() => {
            setOn(false);
            const u = toastMsg.undo;
            clearToast();
            u?.();
          }}
        >
          Undo
        </button>
      ) : null}
    </div>
  );
}

/* ================================================================ search palette */

export function SearchBridge() {
  const { searchSeq, openModal, closeModal } = useConsole();
  useEffect(() => {
    if (searchSeq > 0) openModal(<SearchPalette onClose={closeModal} />, { top: true, bare: true, label: 'Search' });
  }, [searchSeq, openModal, closeModal]);
  return null;
}

function SearchPalette({ onClose }: { onClose: () => void }) {
  const { paletteItems } = useConsole();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  const all = useMemo(() => paletteItems(), [paletteItems]);
  const items: PaletteItem[] = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? all.filter((i) => `${i.label} ${i.kind}`.toLowerCase().includes(t)) : all.filter((i) => i.kind === 'Page' || i.kind.startsWith('Client'))).slice(0, 14);
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
        placeholder="Search clients, steps, leads, documents, filings or a page…"
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
            Nothing matches. Try a client name, a step like Registered office address, a form like GSTR-3B, or a page like Approvals.
          </div>
        )}
      </div>
    </div>
  );
}
