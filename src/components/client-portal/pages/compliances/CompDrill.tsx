'use client';

/**
 * Rule 14 drill-down for the compliances pages (prototype openDD(), I:994-1021):
 * primary-light top link, title + (i), full-width navy pill with the clicked
 * part pre-selected, a 7-row table, "Showing n of m" footer, raised footer bar.
 * Esc / ✕ / scrim close; focus is trapped; phones get a bottom sheet (CSS).
 */
import { useRef, useState } from 'react';
import { InfoPopover, BotSays } from '../../shared';
import {
  AREAS,
  ST,
  fmtDM,
  fmtDMY,
  sortByDue,
  statusOf,
  type AreaFilter,
  type CompStatus,
  type PortalFiling,
} from '@/lib/client-portal/compliances';
import { AreaChip, I, NameWithLinks, ProofChip, SOLID, Seg, useModal } from './bits';

export interface DrillState {
  kind: 'status' | 'area';
  /** Pre-selected tab key: all | ok | due | over | up | MCA | … */
  k: string;
  title: string;
  rows: PortalFiling[];
  n: number;
}

const TABS: Record<'status' | 'area', [string, string][]> = {
  status: [
    ['all', 'All'],
    ['ok', 'Filed'],
    ['due', 'Due soon'],
    ['over', 'Overdue'],
    ['up', 'Upcoming'],
  ],
  area: AREAS.map((a) => [a.id, a.label]),
};

export function CompDrill({
  state,
  today,
  link,
  onClose,
  onRow,
  onProof,
}: {
  state: DrillState;
  today: string;
  link: { text: string; onClick: () => void };
  onClose: () => void;
  onRow: (f: PortalFiling) => void;
  onProof: (f: PortalFiling) => void;
}) {
  const tabs = TABS[state.kind];
  const match = (r: PortalFiling, k: string) =>
    k === 'all' || (state.kind === 'status' ? statusOf(r, today) === (k as CompStatus) : r.area === (k as AreaFilter));
  const [on, setOn] = useState(Math.max(0, tabs.findIndex((t) => t[0] === state.k)));
  const ref = useRef<HTMLDivElement>(null);
  useModal(ref, onClose);
  const k = tabs[on]![0];
  const list = sortByDue(state.rows.filter((r) => match(r, k)));
  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Esc closes (useModal) */}
      <div className="ddscrim" onClick={onClose} />
      <div className="dd" role="dialog" aria-modal="true" aria-labelledby="comp-dd-t" ref={ref}>
        <span className="sheet-grab" aria-hidden="true" />
        <div
          className="dd-top"
          style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '9px 18px', background: 'var(--primary-light)', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)' }}
        >
          <span>These filings live in Compliances · Filings</span>
          <button
            type="button"
            style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', marginLeft: 'auto', fontWeight: 800, fontSize: 12.5, whiteSpace: 'nowrap', color: 'var(--primary)' }}
            onClick={() => {
              onClose();
              link.onClick();
            }}
          >
            {link.text}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div id="comp-dd-t" style={{ flex: 1, font: '700 15px Manrope', color: 'var(--navy-ink,var(--navy))', display: 'flex', alignItems: 'center', gap: 4 }}>
            {state.title}
            <InfoPopover askAbout={state.title} label="About this">
              As of {fmtDMY(today)}.
            </InfoPopover>
          </div>
          <button type="button" className="ibtn" aria-label="Close" onClick={onClose}>
            {I.x(13)}
          </button>
        </div>
        <div style={{ padding: '16px 18px' }}>
          <div className="seg-scroll dd-segw">
            <Seg
              opts={tabs.map((t) => t[1])}
              on={on}
              onPick={setOn}
              counts={tabs.map((t) => state.rows.filter((r) => match(r, t[0])).length)}
              label={state.kind === 'status' ? 'Status' : 'Area'}
            />
          </div>
          {list.length ? (
            <div className="dd-tw">
              <table style={{ marginTop: 12, fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th>Filing</th>
                    <th>Period</th>
                    <th>Area</th>
                    <th style={{ textAlign: 'right' }}>Due / filed</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.slice(0, 7).map((r) => {
                    const st = statusOf(r, today);
                    return (
                      <tr
                        key={r.id}
                        tabIndex={0}
                        onClick={() => onRow(r)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRow(r);
                          }
                        }}
                      >
                        <td>
                          <NameWithLinks f={r} /> <ProofChip f={r} onOpen={onProof} />
                        </td>
                        <td style={{ color: 'var(--muted)' }}>{r.period}</td>
                        <td>
                          <AreaChip a={r.area} />
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontSize: 12 }}>
                          {r.filedOn ? `Filed ${fmtDM(r.filedOn)}` : fmtDM(r.dueDate)}
                        </td>
                        <td>
                          <span className="chip" style={{ background: SOLID[st], color: '#fff' }}>
                            {ST[st].l}
                          </span>
                        </td>
                        <td style={{ color: 'var(--subtle)' }}>{I.chevR(14)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="ddempty" style={{ padding: '18px 4px 6px' }}>
              {k === 'over' ? (
                <BotSays size={44} action="">
                  Nothing overdue. Nice work.
                </BotSays>
              ) : (
                <BotSays size={44} question={`Why are there no ${tabs[on]![1].toLowerCase()} filings in ${state.title}?`}>
                  No filings here yet.
                </BotSays>
              )}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }} hidden={!list.length}>
            {list.length > 7 ? `Showing 7 of ${list.length} · full list in Filings` : `Showing all ${list.length}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--raised)' }}>
          <button
            type="button"
            className="btn btn-o btn-s"
            onClick={() => {
              onClose();
              link.onClick();
            }}
          >
            Open Filings
          </button>
        </div>
      </div>
    </>
  );
}
