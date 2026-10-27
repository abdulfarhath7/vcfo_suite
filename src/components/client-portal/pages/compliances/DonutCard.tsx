'use client';

/** Compact status donut (C-22, prototype donutCard()): every part drills down (rule 14). */
import type { KeyboardEvent } from 'react';
import { ST, countByStatus, type CompStatus, type PortalFiling } from '@/lib/client-portal/compliances';
import { CountUp } from './bits';
import { useComp } from './ctx';

const ORDER: CompStatus[] = ['ok', 'due', 'over', 'up'];

export function DonutCard({ rows, label, drillTitle }: { rows: PortalFiling[]; label: string; drillTitle: string }) {
  const { today, openDrill } = useComp();
  const c = countByStatus(rows, today);
  const tot = rows.length;
  const C = 2 * Math.PI * 35;
  let acc = 0;
  const open = (k: string) => openDrill({ kind: 'status', k, title: drillTitle, rows });
  const key = (k: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open(k);
    }
  };
  return (
    <div className="card t donut" style={{ padding: '12px 16px', display: 'flex', gap: 16, alignItems: 'center' }}>
      <svg width="88" height="88" viewBox="0 0 88 88" role="group" aria-label={`${label} · ${tot} filings`}>
        {tot === 0 ? <circle cx="44" cy="44" r="35" fill="none" stroke="var(--raised)" strokeWidth="11" /> : null}
        {tot > 0
          ? ORDER.map((s) => {
              const len = (C * c[s]) / tot;
              const el = (
                <circle
                  key={s}
                  data-dd="status"
                  data-tip={`${ST[s].l} · ${c[s]}`}
                  role="button"
                  tabIndex={c[s] ? 0 : -1}
                  aria-label={`${ST[s].l} · ${c[s]}`}
                  cx="44"
                  cy="44"
                  r="35"
                  fill="none"
                  stroke={`var(${s === 'up' ? '--up' : ST[s].v})`}
                  strokeWidth="11"
                  strokeDasharray={`${Math.max(len - 2, 0)} ${C}`}
                  strokeDashoffset={-acc}
                  transform="rotate(-90 44 44)"
                  onClick={() => open(s)}
                  onKeyDown={key(s)}
                />
              );
              acc += len;
              return el;
            })
          : null}
        <circle
          data-dd="status"
          data-tip={`All filings · ${tot}`}
          role="button"
          tabIndex={0}
          aria-label={`All filings · ${tot}`}
          cx="44"
          cy="44"
          r="29"
          fill="transparent"
          onClick={() => open('all')}
          onKeyDown={key('all')}
        />
        <text pointerEvents="none" x="44" y="42" textAnchor="middle" fontFamily="var(--font-sans)" fontWeight="600" fontSize="20" fill="var(--fg)">
          <CountUp n={tot} svg />
        </text>
        <text pointerEvents="none" x="44" y="57" textAnchor="middle" fontFamily="var(--font-sans)" fontWeight="600" fontSize={label.length > 7 ? 9.5 : 11} fill="var(--muted)">
          {label}
        </text>
      </svg>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(118px,1fr))', gap: '6px 16px', flex: '1 1 220px', minWidth: 0 }}>
        {ORDER.map((s) => (
          <div
            key={s}
            data-dd="status"
            data-tip={`${ST[s].l} · ${c[s]}`}
            role="button"
            tabIndex={0}
            aria-label={`${ST[s].l} · ${c[s]} · show the list`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, borderRadius: 4 }}
            onClick={() => open(s)}
            onKeyDown={key(s)}
          >
            <i style={{ width: 10, height: 10, borderRadius: 3, background: `var(${s === 'up' ? '--up' : ST[s].v})` }} />
            <span style={{ flex: 1 }}>{ST[s].l}</span>
            <b className="mono">
              <CountUp n={c[s]} />
            </b>
          </div>
        ))}
      </div>
    </div>
  );
}
