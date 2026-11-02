'use client';

/**
 * Who holds the ball (prototype mxBall): the same items as Focus, split by who
 * acts next — you and your leads, the clients, MCA — as one bar; each part
 * opens its list. Client items carry Send reminder (a drafted email).
 */
import { useState, type CSSProperties } from 'react';
import { SecLoading } from '@/components/portal/ui';
import { Icon, Panel } from '../../ui';
import { useConsole } from '../../runtime';
import { CDot } from './bits';
import { age, dShort, plural, type Holder, type QItem, type TodayModel } from './model';

const GROUPS: Array<{ h: Holder; label: string; tone: string }> = [
  { h: 'you', label: 'You and your leads', tone: 'var(--mx-run)' },
  { h: 'client', label: 'Clients', tone: 'var(--mx-wait)' },
  { h: 'mca', label: 'MCA', tone: 'var(--law-MCA)' },
];

function when(q: QItem, today: string): string {
  if (q.state === 'over' || q.state === 'due' || q.source === 'filing') return q.status;
  if (q.days === undefined) return q.status;
  return `${age(q.days)}${q.since ? ` · since ${dShort(q.since, today)}` : ''}`;
}

export function Ball({ m, loading }: { m: TodayModel; loading: boolean }) {
  const { go } = useConsole();
  const [open, setOpen] = useState(0);
  const groups = GROUPS.map((g) => ({ ...g, items: m.queue.filter((q) => q.holder === g.h) }));
  const total = m.queue.length;

  return (
    <Panel id="mx-ball" title="Who holds the ball" sub={loading ? 'Loading…' : `${plural(total, 'open item')}, by who acts next`}>
      {loading ? (
        <SecLoading label="Loading your book…" />
      ) : (
        <>
          <div className="mx-bbar" role="group" aria-label="Open items by who acts next">
            {groups.map((g, i) => (
              <button
                key={g.h}
                type="button"
                className={i === open ? 'on' : ''}
                style={{ flex: g.items.length || 0.2, ['--bc' as string]: g.tone } as CSSProperties}
                title={`${g.label} · ${g.items.length}`}
                aria-pressed={i === open}
                onClick={() => setOpen(i)}
              >
                <b>{g.items.length}</b>
              </button>
            ))}
          </div>
          <div className="mx-bacc">
            {groups.map((g, i) => (
              <div key={g.h} className={'mx-bg' + (i === open ? ' open' : '')}>
                <button type="button" className="mx-bgh" aria-expanded={i === open} onClick={() => setOpen(i === open ? -1 : i)}>
                  <i style={{ background: g.tone }} />
                  <b>{g.label}</b>
                  <span className="mx-n">{g.items.length}</span>
                  <Icon name="down" />
                </button>
                {i === open ? (
                  <div className="mx-bgl">
                    {g.items.length === 0 ? (
                      <span className="small">{g.h === 'you' ? 'Nothing is with you or your leads.' : g.h === 'client' ? 'No client owes you anything.' : 'Nothing is waiting on MCA.'}</span>
                    ) : (
                      g.items.map((q) => {
                        const c = m.byId[q.clientId]!;
                        return (
                          <div key={q.id} className="mx-cti">
                            <CDot c={c} />
                            <span className="mx-dt">
                              <b className="tdy-ell" title={`${q.title} · ${c.name}`}>
                                {q.title} · {c.short}
                              </b>
                              <span>{when(q, m.today)}</span>
                            </span>
                            <button type="button" className="btn sm" onClick={() => go(q.cta.href)}>
                              {q.cta.label}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}
