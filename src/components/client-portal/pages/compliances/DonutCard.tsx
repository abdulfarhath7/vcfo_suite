'use client';

/**
 * Status donut (R-25, C1): the ring in status colours with the total in the centre and the
 * legend beside it. Every part drills down (rule 14): a ring part or a legend row opens that
 * status, the centre opens all rows.
 */
import type { KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { countByStatus, type CompStatus, type PortalFiling } from '@/lib/client-portal/compliances';
import { CountUp } from './bits';
import { useComp } from './ctx';
import { FILL, Island, STROKE, WORD } from './spectrum';

const ORDER: CompStatus[] = ['ok', 'due', 'over', 'up'];

export function DonutCard({ rows, label, drillTitle, className }: { rows: PortalFiling[]; label: string; drillTitle: string; className?: string }) {
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
    <Island className={cn('flex items-center gap-4 rounded-md border-1.5 border-line bg-surface-raised px-4 py-3', className)}>
      <svg width="88" height="88" viewBox="0 0 88 88" role="group" aria-label={`${label} · ${tot} filings`} className="flex-none">
        <circle cx="44" cy="44" r="35" fill="none" stroke="oklch(var(--line-soft))" strokeWidth="11" />
        {tot > 0
          ? ORDER.map((s) => {
              const len = (C * c[s]) / tot;
              const el = c[s] ? (
                <circle
                  key={s}
                  data-tip={`${WORD[s]} · ${c[s]}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${WORD[s]} · ${c[s]}`}
                  cx="44"
                  cy="44"
                  r="35"
                  fill="none"
                  stroke={STROKE[s]}
                  strokeWidth="11"
                  strokeDasharray={`${Math.max(len - 2, 0)} ${C}`}
                  strokeDashoffset={-acc}
                  transform="rotate(-90 44 44)"
                  className="cursor-pointer outline-none transition-[stroke-width] hover:[stroke-width:14] focus-visible:[stroke-width:14]"
                  onClick={() => open(s)}
                  onKeyDown={key(s)}
                />
              ) : null;
              acc += len;
              return el;
            })
          : null}
        <circle
          data-tip={`All filings · ${tot}`}
          role="button"
          tabIndex={0}
          aria-label={`All filings · ${tot}`}
          cx="44"
          cy="44"
          r="29"
          fill="transparent"
          className="cursor-pointer outline-none"
          onClick={() => open('all')}
          onKeyDown={key('all')}
        />
        <text pointerEvents="none" x="44" y="43" textAnchor="middle" fontFamily="var(--font-sans)" fontWeight="600" fontSize="20" fill="oklch(var(--ink))">
          <CountUp n={tot} svg />
        </text>
        <text pointerEvents="none" x="44" y="58" textAnchor="middle" fontFamily="var(--font-sans)" fontWeight="600" fontSize={label.length > 7 ? 9.5 : 11} fill="oklch(var(--ink-muted))">
          {label}
        </text>
      </svg>
      <ul className="grid min-w-0 flex-1 grid-cols-1 gap-1.5">
        {ORDER.map((s) => (
          <li key={s}>
            <button
              type="button"
              data-tip={`${WORD[s]} · ${c[s]}`}
              aria-label={`${WORD[s]} · ${c[s]} · show the list`}
              onClick={() => open(s)}
              className="flex w-full items-center gap-2 rounded-sm text-left text-[12.5px] font-semibold text-ink-2 hover:text-brand-text"
            >
              <i className={cn('h-2.5 w-2.5 flex-none rounded-[3px]', FILL[s])} aria-hidden />
              <span className="flex-1">{WORD[s]}</span>
              <b className="font-semibold tabular-nums text-ink">
                <CountUp n={c[s]} />
              </b>
            </button>
          </li>
        ))}
      </ul>
    </Island>
  );
}
