'use client';

/**
 * Month navigator + month / year picker (C-02, C-03; prototype monthNav() +
 * cal-views.js picker()). ‹ › step ±1 month across years; "October ▾" /
 * "2026 ▾" open a 304 px dialog (3×4 months or 4×8 years), Today in the footer.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { MON, MONTHS } from '@/lib/client-portal/compliances';
import { I, useDismiss } from './bits';

const CHEV = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);
const ARL = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
const ARR = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export function MonthNav({
  month,
  nowKey,
  onMonth,
  onStep,
  hidden,
}: {
  month: string;
  nowKey: string;
  onMonth: (key: string) => void;
  onStep: (k: number) => void;
  hidden?: boolean;
}) {
  const [cy, cmRaw] = month.split('-').map(Number) as [number, number];
  const cm = cmRaw - 1;
  const [ny, nmRaw] = nowKey.split('-').map(Number) as [number, number];
  const nm = nmRaw - 1;
  const [mode, setMode] = useState<'m' | 'y' | null>(null);
  const [viewY, setViewY] = useState(cy);
  const [base, setBase] = useState(0);
  const anchor = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const close = useCallback((back?: boolean) => {
    setMode(null);
    if (back) opener.current?.focus();
  }, []);
  useDismiss(mode !== null, pop, () => close(true), (t) => Boolean(t.closest?.('[data-pk]')));

  const open = (m: 'm' | 'y', btn: HTMLButtonElement) => {
    if (mode === m) {
      close();
      return;
    }
    setViewY(cy);
    setBase(cy - 10 - ((((cy - 10) % 4) + 4) % 4));
    setMode(m);
    opener.current = btn;
  };

  // focus the selected cell on open; centre the selected year
  useEffect(() => {
    if (!mode) return;
    const g = gridRef.current;
    const on = g?.querySelector<HTMLElement>('.on') ?? g?.querySelector<HTMLElement>('button');
    on?.focus({ preventScroll: true });
    if (mode === 'y' && g && on) g.scrollTop = on.offsetTop - g.clientHeight / 2 + on.offsetHeight / 2;
  }, [mode]);

  return (
    <div data-calnavr="" ref={anchor} style={hidden ? { visibility: 'hidden' } : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, padding: 2 }}>
        <button type="button" className="ibtn" style={{ border: 0, width: 28, height: 28 }} aria-label="Previous month" onClick={() => onStep(-1)}>
          {I.chevL(15)}
        </button>
        <span className="mpk-lbl">
          <button
            type="button"
            className="mpk-b"
            data-pk="m"
            aria-haspopup="dialog"
            aria-expanded={mode === 'm'}
            aria-label="Choose month"
            data-notip=""
            onClick={(e) => open('m', e.currentTarget)}
          >
            <span>{MONTHS[cm]}</span>
            {CHEV}
          </button>
          <button
            type="button"
            className="mpk-b"
            data-pk="y"
            aria-haspopup="dialog"
            aria-expanded={mode === 'y'}
            aria-label="Choose year"
            data-notip=""
            onClick={(e) => open('y', e.currentTarget)}
          >
            <span>{cy}</span>
            {CHEV}
          </button>
        </span>
        <button type="button" className="ibtn" style={{ border: 0, width: 28, height: 28 }} aria-label="Next month" onClick={() => onStep(1)}>
          {I.chevR(15)}
        </button>
      </div>
      {mode ? (
        <div className="mpk-pop" role="dialog" aria-label="Choose month and year" ref={pop}>
          <div className="mpk-hd">
            <button
              type="button"
              className="mpk-ar"
              aria-label={mode === 'm' ? 'Previous year' : 'Earlier years'}
              onClick={() => (mode === 'm' ? setViewY((y) => y - 1) : setBase((b) => b - 32))}
            >
              {ARL}
            </button>
            <span className="mpk-mid">
              <button type="button" className={`mpk-hb${mode === 'm' ? ' on' : ''}`} onClick={() => setMode('m')}>
                {MONTHS[cm]}
                {CHEV}
              </button>
              <button type="button" className={`mpk-hb${mode === 'y' ? ' on' : ''}`} onClick={() => setMode('y')}>
                {viewY}
                {CHEV}
              </button>
            </span>
            <button
              type="button"
              className="mpk-ar"
              aria-label={mode === 'm' ? 'Next year' : 'Later years'}
              onClick={() => (mode === 'm' ? setViewY((y) => y + 1) : setBase((b) => b + 32))}
            >
              {ARR}
            </button>
          </div>
          {mode === 'm' ? (
            <div className="mpk-g m" role="grid" aria-label={`Months of ${viewY}`} ref={gridRef}>
              {MON.map((s, k) => {
                const on = viewY === cy && k === cm;
                const now = viewY === ny && k === nm;
                return (
                  <button
                    key={s}
                    type="button"
                    aria-label={`${MONTHS[k]} ${viewY}`}
                    className={on ? 'on' : now ? 'now' : undefined}
                    aria-current={on ? 'date' : undefined}
                    onClick={() => {
                      onMonth(`${viewY}-${String(k + 1).padStart(2, '0')}`);
                      close(true);
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mpk-g y" role="grid" aria-label="Years" ref={gridRef}>
              {Array.from({ length: 32 }, (_, i) => base + i).map((y) => (
                <button
                  key={y}
                  type="button"
                  className={y === cy ? 'on' : y === ny ? 'now' : undefined}
                  aria-current={y === cy ? 'date' : undefined}
                  onClick={() => {
                    onMonth(`${y}-${String(cm + 1).padStart(2, '0')}`);
                    close(true);
                  }}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
          <div className="mpk-ft">
            <button
              type="button"
              onClick={() => {
                onMonth(nowKey);
                close(true);
              }}
            >
              Today
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
