'use client';

/**
 * Portfolio orbit (prototype mxOrbit): you at the centre, one ring per project
 * lead, one planet per client in that lead's colour ring. A planet's colour is
 * the client's, its halo the client's health; clients outside the Stage filter
 * stay on their ring, dimmed. A planet opens the client card; a ring's key
 * opens that lead's workload.
 */
import { useId, type CSSProperties } from 'react';
import { Btn, GoArrow, hueOf } from '../../ui';
import { PopHead } from '../../overlays';
import { useConsole } from '../../runtime';
import { CAv } from './bits';
import {
  HEALTH_COLOR,
  HEALTH_LABEL,
  HEALTH_ORDER,
  HOLDER_LABEL,
  age,
  plural,
  stepCode,
  type TClient,
  type TodayModel,
} from './model';

const W = 400;
const C = W / 2;
const RING_LABEL = ['Inner ring', 'Middle ring', 'Outer ring'];

interface Ring {
  key: string;
  name: string;
  hue: string;
  clients: TClient[];
  open: number;
  /** a real lead (links to the lead page) */
  lead: boolean;
}

function radii(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [128];
  if (n === 2) return [100, 160];
  if (n === 3) return [82, 128, 174];
  return Array.from({ length: n }, (_, i) => Math.round(70 + (i * (178 - 70)) / (n - 1)));
}

export function mailTo(c: Pick<TClient, 'e' | 'name'>, base: string): string {
  const q = new URLSearchParams();
  if (c.e.clientEmail) q.set('to', c.e.clientEmail);
  q.set('subject', c.name);
  return `${base}/mail?${q.toString()}`;
}

export function PhaseStrip({ c }: { c: TClient }) {
  return (
    <div className="mx-pbar" title={c.model.phases.map((p) => p.name).join(' · ')}>
      {c.model.phases.map((p) => (
        <span key={p.id} style={{ flex: p.total }} title={`${p.name} · ${p.done} of ${p.total}`}>
          <i style={{ width: `${Math.round((p.done / Math.max(1, p.total)) * 100)}%` }} />
        </span>
      ))}
    </div>
  );
}

/** The client card a planet (or a client mark elsewhere on Today) opens. */
export function ClientPop({ c }: { c: TClient }) {
  const { go, base, closePop } = useConsole();
  const cur = c.current;
  return (
    <div>
      <PopHead
        title={c.name}
        sub={`${c.stage === 'inc' ? 'Incorporating' : 'Compliance'} · ${c.leadName ? `lead ${c.leadName}` : 'no lead yet'}`}
        lead={<CAv c={c} big />}
      />
      <div className="mx-facts">
        <div>
          <span>Now</span>
          <b>{cur ? `${stepCode(cur.id) ? stepCode(cur.id) + ' ' : ''}${cur.title}` : `All ${c.total} steps done`}</b>
        </div>
        <div>
          <span>With</span>
          <b>{c.holder ? `${HOLDER_LABEL[c.holder]} · ${age(c.heldDays ?? 0)}` : 'Nothing open'}</b>
        </div>
        <div>
          <span>Done</span>
          <b>
            {c.done} of {c.total} steps
          </b>
        </div>
        <div>
          <span>Health</span>
          <b style={{ color: HEALTH_COLOR[c.health] }} title={c.healthWhy}>
            {HEALTH_LABEL[c.health]}
          </b>
        </div>
      </div>
      <PhaseStrip c={c} />
      <div className="pop-foot">
        <Btn
          cls="sm"
          ico="mail"
          onClick={() => {
            closePop();
            go(mailTo(c, base));
          }}
        >
          Email client
        </Btn>
        <span className="sp" />
        <GoArrow
          label="Open client"
          onClick={() => {
            closePop();
            go(c.href);
          }}
        />
      </div>
    </div>
  );
}

export function Orbit({ m, meInitials }: { m: TodayModel; meInitials: string }) {
  const { go, base, openPop } = useConsole();
  const gid = useId().replace(/:/g, '');

  const leadRings: Ring[] = m.leads
    .filter((l) => l.clientIds.length > 0)
    .map((l) => ({ key: l.key, name: l.name, hue: hueOf(l.key), clients: l.clientIds.map((id) => m.byId[id]!).filter(Boolean), open: l.open.length, lead: true }));
  const placed = new Set(leadRings.flatMap((r) => r.clients.map((c) => c.id)));
  const loose = m.all.filter((c) => !placed.has(c.id));
  let rings: Ring[] = loose.length ? [...leadRings, { key: '@none', name: 'No lead', hue: 'var(--ink-3)', clients: loose, open: 0, lead: false }] : leadRings;
  if (rings.length > 6) {
    const rest = rings.slice(5);
    rings = [...rings.slice(0, 5), { key: '@more', name: `${rest.length} more leads`, hue: 'var(--ink-3)', clients: rest.flatMap((r) => r.clients), open: rest.reduce((n, r) => n + r.open, 0), lead: false }];
  }
  const R = radii(rings.length);

  return (
    <div className="mx-orw">
      <svg viewBox={`0 0 ${W} ${W}`} className="mx-orbit" role="img" aria-label={`Your ${plural(m.all.length, 'client')} by project lead`}>
        <defs>
          <radialGradient id={`sun${gid}`}>
            <stop offset="0" stopColor="var(--mx-sun1)" />
            <stop offset="1" stopColor="var(--mx-sun2)" />
          </radialGradient>
        </defs>
        {rings.map((r, i) => (
          <circle key={r.key} cx={C} cy={C} r={R[i]} className="mx-ring" style={{ ['--lc' as string]: r.hue } as CSSProperties} />
        ))}
        {rings.map((r, i) => {
          const dur = `${150 + i * 60}s`;
          return (
            <g key={r.key} className="mx-rot" style={{ ['--dur' as string]: dur, ['--dir' as string]: i % 2 ? 'reverse' : 'normal' } as CSSProperties}>
              {r.clients.map((c, j) => {
                const ang = (j / r.clients.length) * Math.PI * 2 + i * 1.1 - Math.PI / 2;
                const x = C + R[i]! * Math.cos(ang);
                const y = C + R[i]! * Math.sin(ang);
                const open = (el: Element) => openPop(el, <ClientPop c={c} />);
                return (
                  <g
                    key={c.id}
                    className={'mx-pl' + (c.inScope ? '' : ' dim')}
                    tabIndex={0}
                    role="button"
                    aria-label={`${c.name}, ${HEALTH_LABEL[c.health]}${c.inScope ? '' : ', outside the Stage filter'}`}
                    onClick={(e) => open(e.currentTarget)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        open(e.currentTarget);
                      }
                    }}
                  >
                    <title>{`${c.name} · ${HEALTH_LABEL[c.health]} · ${c.healthWhy}`}</title>
                    <g className="mx-plc" style={{ transformOrigin: `${x}px ${y}px`, ['--dur' as string]: dur, ['--dir' as string]: i % 2 ? 'normal' : 'reverse' } as CSSProperties}>
                      <circle cx={x} cy={y} r={21} className="mx-halo" stroke={HEALTH_COLOR[c.health]} />
                      <circle cx={x} cy={y} r={15} fill={hueOf(c.id)} className="mx-pc" />
                      <text x={x} y={y + 4} textAnchor="middle" className="mx-pt2">
                        {c.initials}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          );
        })}
        <circle cx={C} cy={C} r={40} fill={`url(#sun${gid})`} className="mx-sun" />
        <text x={C} y={C - 2} textAnchor="middle" className="mx-sun-t">
          {meInitials}
        </text>
        <text x={C} y={C + 15} textAnchor="middle" className="mx-sun-s">
          {plural(m.all.length, 'client')}
        </text>
      </svg>
      <div className="mx-okey">
        {rings.length === 0 ? <span className="small">No clients in your book yet.</span> : null}
        {rings.map((r, i) =>
          r.lead ? (
            <button
              key={r.key}
              type="button"
              className="mx-ok"
              title={`Open ${r.name}'s workload · ${plural(r.open, 'open item')}`}
              onClick={() => go(`${base}/leads?lead=${encodeURIComponent(r.key)}`)}
            >
              <i style={{ borderColor: r.hue }} />
              <span>{RING_LABEL[i] ?? `Ring ${i + 1}`}</span>
              <b className="tdy-ell">{r.name}</b>
              <em>{r.open} open</em>
            </button>
          ) : (
            <div key={r.key} className="mx-ok tdy-static" title={`${plural(r.clients.length, 'client')} with no project lead`}>
              <i style={{ borderColor: r.hue }} />
              <span>{RING_LABEL[i] ?? `Ring ${i + 1}`}</span>
              <b className="tdy-ell">{r.name}</b>
              <em>{plural(r.clients.length, 'client')}</em>
            </div>
          ),
        )}
        <div className="mx-ohl" aria-label="Halo colour is the client's health">
          {HEALTH_ORDER.map((h) => (
            <span key={h} title={`Halo colour: ${HEALTH_LABEL[h]}`}>
              <i style={{ borderColor: HEALTH_COLOR[h] }} />
              {HEALTH_LABEL[h]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
