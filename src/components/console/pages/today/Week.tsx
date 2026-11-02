'use client';

/**
 * This week (prototype mxWeekLanes): Monday to Sunday as columns, one lane per
 * kind of date — statutory filings, step deadlines (the manager's schedule
 * windows), team tasks, and what closed each day. A day header filters the
 * page to that day (Team tasks follows); a chip opens its item.
 *
 * The prototype's "Nudges due" lane has no source in the tool (nothing
 * schedules a nudge), so it is not drawn; team tasks due that day take its row.
 */
import type { CSSProperties } from 'react';
import { SecLoading } from '@/components/portal/ui';
import { fmtL } from '@/components/portal/dates';
import { Empty, Icon, Panel, type IconName } from '../../ui';
import { CDot } from './bits';
import { dShort, plural, weekday, type TodayModel, type WItem, type WLane } from './model';

const LANE: Record<WLane, { label: string; icon: IconName; kind: string }> = {
  filing: { label: 'Statutory filings', icon: 'calc', kind: 'Statutory filing' },
  step: { label: 'Step deadlines', icon: 'step', kind: 'Step deadline' },
  task: { label: 'Team tasks', icon: 'team', kind: 'Team task' },
  done: { label: 'Done', icon: 'check', kind: 'Done' },
};

export function Week({
  m,
  loading,
  showCmp,
  day,
  setDay,
  openItem,
  color,
}: {
  m: TodayModel;
  loading: boolean;
  showCmp: boolean;
  day: string;
  setDay: (d: string) => void;
  openItem: (w: WItem) => void;
  color: (w: WItem) => string;
}) {
  const lanes = (['filing', 'step', 'task', 'done'] as WLane[]).filter((l) => l !== 'filing' || showCmp);
  const items = m.week7.filter((w) => lanes.includes(w.lane));
  const openOn = (d: string) => items.filter((w) => w.day === d && w.open).length;
  const selItems = day ? items.filter((w) => w.day === day) : [];
  const sun = m.week[6]!;
  const mon = m.week[0]!;

  return (
    <Panel
      id="mx-week"
      title="This week"
      sub={
        loading
          ? 'Loading…'
          : `${weekday(mon)} ${dShort(mon, m.today)} to ${weekday(sun)} ${dShort(sun, m.today)} · ${m.kpi.weekOpen.length} open · click a day for everything on it`
      }
    >
      {loading ? (
        <SecLoading label="Loading your week…" />
      ) : (
        <>
          <div className="tdy-scrollx">
            <div className="mx-lanes" style={{ gridTemplateColumns: '150px repeat(7, minmax(0, 1fr))' }}>
              <span />
              {m.week.map((d) => {
                const n = openOn(d);
                return (
                  <button
                    key={d}
                    type="button"
                    className={'mx-lnd' + (d === m.today ? ' now' : '') + (d === day ? ' sel' : '')}
                    aria-pressed={d === day}
                    title={`${fmtL(d)} · ${plural(n, 'open item')}${d === m.today ? ' · today' : ''}`}
                    onClick={() => setDay(d === day ? '' : d)}
                  >
                    <span>{weekday(d)}</span>
                    <b>{Number(d.slice(8, 10))}</b>
                    <em>{n || ''}</em>
                  </button>
                );
              })}
              {lanes.map((lane) => (
                <LaneRow key={lane} lane={lane} m={m} items={items} day={day} setDay={setDay} openItem={openItem} color={color} />
              ))}
            </div>
          </div>
          <div className="mx-phleg" aria-label="What the colours mean">
            <span>
              <i className="tdy-sw" style={{ background: 'var(--over)' }} />
              Open and past its day
            </span>
            <span>
              <i className="tdy-sw" style={{ background: 'var(--due)' }} />
              Due today or later this week
            </span>
            <span>
              <i className="tdy-sw" style={{ background: 'var(--mx-ok)' }} />
              Done
            </span>
          </div>
          {day ? (
            <div className="mx-wsel">
              <div className="co-row">
                <b>
                  {fmtL(day)} · {plural(selItems.length, 'item')}
                </b>
                <span className="sp" />
                <button type="button" className="link" onClick={() => setDay('')}>
                  Show the whole week
                </button>
              </div>
              <div className="mx-wlist">
                {selItems.length ? (
                  selItems.map((w) => {
                    const c = m.byId[w.clientId];
                    return (
                      <button key={w.id} type="button" className="mx-wl tdy-wl" onClick={() => openItem(w)}>
                        <i style={{ background: color(w) }} />
                        {c ? <CDot c={c} /> : null}
                        <span className="tdy-ell" title={w.title}>
                          {w.title}
                        </span>
                        <span className="small">{LANE[w.lane].kind}</span>
                      </button>
                    );
                  })
                ) : (
                  <Empty title="Nothing on this day" sub="No filings, deadlines or team tasks fall on it." />
                )}
              </div>
              <div className="small" style={{ marginTop: 8 }}>
                Team tasks below are filtered to this day too.
              </div>
            </div>
          ) : null}
        </>
      )}
    </Panel>
  );
}

function LaneRow({
  lane,
  m,
  items,
  day,
  setDay,
  openItem,
  color,
}: {
  lane: WLane;
  m: TodayModel;
  items: WItem[];
  day: string;
  setDay: (d: string) => void;
  openItem: (w: WItem) => void;
  color: (w: WItem) => string;
}) {
  return (
    <>
      <span className="mx-lnl">
        <Icon name={LANE[lane].icon} size={16} />
        {LANE[lane].label}
      </span>
      {m.week.map((d) => {
        const mine = items.filter((w) => w.lane === lane && w.day === d);
        const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
        return (
          <div key={d} className={'mx-lnc' + (d === m.today ? ' now' : '') + (d === day ? ' sel' : '') + (wd === 0 || wd === 6 ? ' wk' : '')}>
            {mine.slice(0, 2).map((w) => {
              const c = m.byId[w.clientId];
              return (
                <button key={w.id} type="button" className="mx-lni" style={{ ['--cc' as string]: color(w) } as CSSProperties} title={w.title} onClick={() => openItem(w)}>
                  {c ? <CDot c={c} size={7} /> : null}
                  {w.title.split(' · ')[0]}
                </button>
              );
            })}
            {mine.length > 2 ? (
              <button type="button" className="mx-more" title={`${mine.length - 2} more on ${fmtL(d)}`} onClick={() => setDay(d)}>
                +{mine.length - 2}
              </button>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
