import { stepHref } from '@/components/client-portal/routes';
import { stagesOf } from './Popups';
import { dHeader, dShort, dayMon, days, rel } from './derive';
import { I, Si, stepK, Tile, MSeg, Bot, Card, Count, type DRow } from './MobileParts';
import type { MobileHomeState } from './useMobileHome';

/** Phone Home cards, part one: greeting, needs, holds, timeline, alerts and SBC. */
export function createMobileCardsA(ctx: MobileHomeState) {
  const {
    h,
    onEditTimeline,
    phases,
    portal,
    company,
    after,
    today,
    ready,
    drawn,
    drill,
    spice,
    stepSub,
    stepsDrill,
    groupIdx,
    C,
    ring,
    stats,
    reportHref,
    needTab,
    setNeedTab,
    NT,
    needAct,
    needRows,
    doneBefore,
    around,
    more,
    cur,
    ph1,
    gantt,
    sbc,
    sbcDrill,
  } = ctx;

  const greet = (
    <section className="greet" id="greet">
      <div className="top">
        <div>
          <div className="d">{dHeader(today)}</div>
          <h1>{h.companyName}</h1>
        </div>
        <button className="ring" type="button" aria-label={`${after ? 'Setup' : 'Incorporation'} ${ring}% — open steps`} onClick={() => (after ? drill('Post-incorporation setup', [['Open', h.post.open.length], ['Completed', h.post.done.length]], 0, postRows) : stepsDrill(0))}>
          <svg width="62" height="62" viewBox="0 0 62 62">
            <circle cx="31" cy="31" r="26" fill="none" stroke="oklch(100% 0 0 / .14)" strokeWidth="6" />
            <circle cx="31" cy="31" r="26" fill="none" stroke="var(--gold)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${drawn ? (ring / 100) * C : 0} ${C}`} style={{ transition: 'stroke-dasharray 1s cubic-bezier(.22,1,.36,1)' }} />
          </svg>
          <span className="v">
            <Count v={ring} ready={ready} />%
          </span>
          <span className="l">{after ? 'SETUP' : 'SPICE+'}</span>
        </button>
      </div>
      <div className="stats">
        {stats.slice(0, 3).map((s) => (
          <button key={s.l} className="stat" type="button" onClick={s.on}>
            <b>
              <Count v={s.v} ready={ready} />
            </b>
            <span>{s.l}</span>
          </button>
        ))}
      </div>
      <div className="stats" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))', marginTop: 6 }}>
        {stats.slice(3).map((s) => (
          <button key={s.l} className="stat" type="button" onClick={s.on}>
            <b>{s.v}</b>
            <span>{s.l}</span>
          </button>
        ))}
      </div>
      <div className="rep">
        {reportHref ? (
          <a className="btn btn-g" href={reportHref} download onClick={() => portal.toast(`Preparing ${company}’s progress report (PDF)…`)}>
            <I n="dl" s={15} />
            Download report
          </a>
        ) : null}
        <button className="btn btn-gl" type="button" onClick={() => portal.go('incorporation')}>
          Open Incorporation
        </button>
      </div>
    </section>
  );
  function postRows(i: number): DRow[] {
    return i
      ? h.post.done.map((s) => ({ k: 'done', t: s.title, s: `Completed${s.doneOn ? ` · ${dShort(s.doneOn)}` : ''}`, route: stepHref(s.id) }))
      : h.post.open.map((p) => ({
          k: p.overDays ? 'late' : p.owner === 'client' ? 'you' : 'sbc',
          t: p.step.title,
          s: `${p.owner === 'client' ? company : 'SBC'} · ${p.overDays ? `overdue ${p.overDays} day${p.overDays === 1 ? '' : 's'} · ` : ''}${dShort(p.dueDate)}`,
          route: stepHref(p.step.id),
        }));
  }

  const needsCard = (
    <Card id="needs" title={`Needs from ${company}`} info={`Items ${company}’s project lead asked for. Upload, fill, correct or sign them here.`}>
      <MSeg id="needs" tabs={NT.map(([k, l]) => [l, h.needs.filter((n) => n.kind === k).length])} sel={needTab} onSel={setNeedTab} />
      <div>
        {needRows.length ? (
          needRows.map((n) => {
            const over = Boolean(n.due && n.due < today);
            const sub = n.kind === 'correct' ? `Sent back${n.note ? ` · ${n.note}` : n.sub ? ` · ${n.sub}` : ''}` : [n.area, n.askedBy ? `${n.area ? 'asked' : 'Asked'} by ${n.askedBy}` : ''].filter(Boolean).join(' · ') || n.sub;
            return (
              <div key={n.key} className="row" style={{ cursor: 'default' }}>
                {n.due ? <Tile iso={n.due} kind={over ? 'over' : days(today, n.due) <= 7 ? 'due' : 'up'} /> : <span className="tile" style={{ background: 'var(--raised)', color: 'var(--fg)' }}>—</span>}
                <span className="t">
                  <b>{n.title}</b>
                  <span title={sub} style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{over && n.kind !== 'correct' ? `Overdue ${days(n.due!, today)} day${days(n.due!, today) === 1 ? '' : 's'}` : sub}</span>
                </span>
                <button className={`btn btn-sm ${over ? 'btn-n' : 'btn-o'}`} type="button" onClick={() => needAct(n)}>
                  {n.kind === 'correct' ? 'Fix' : NT.find((x) => x[0] === n.kind)![1]}
                </button>
              </div>
            );
          })
        ) : (
          <Bot text={`Nothing to ${NT[needTab]![1].toLowerCase()} right now. You are all caught up here.`} />
        )}
      </div>
    </Card>
  );

  const holdsCard = (
    <Card id="holds" title="Who holds it now" info={`${company}’s current step and the steps around it. Tap a step for its details.`} foot={cur ? [`Open step ${cur.n}`, () => portal.go(stepHref(cur.id))] : ['Open Incorporation', () => portal.go('incorporation')]}>
      <div className="ft">
        <div className="rail">
          <i style={{ height: drawn ? `${Math.round((doneBefore / Math.max(1, spice.length)) * 100)}%` : 0 }} />
        </div>
        {doneBefore > 0 ? (
          <button className="fold" type="button" onClick={() => stepsDrill(0)}>
            <I n="check" s={12} w={3} />
            {doneBefore} done{ph1 && ph1.state === 'done' ? ' · Phase 1' : ''}
          </button>
        ) : null}
        {around.map((s) => {
          if (cur && s.id === cur.id) {
            const st = stagesOf(h, s);
            return (
              <button key={s.id} className="fs cur" type="button" onClick={() => stepsDrill(groupIdx(s))}>
                <Si k="now" tip={s.kind === 'you' ? `Waiting on ${company}${s.due ? ` · due ${dShort(s.due)}` : ''}` : 'In progress'} />
                <span className="t">
                  <span className="eb">Now · step {s.n} of {spice.length}</span>
                  <b>{s.title}</b>
                  <span>
                    Step {s.n} · {s.owner === 'client' ? company : 'SBC'}
                    {s.due ? ` · due ${dShort(s.due)}` : ''}
                  </span>
                  <span className="ticks" style={{ margin: '6px 0 0' }}>
                    {st.map((x) => (
                      <i key={x.name} className={x.state === 'done' ? 'd' : x.state === 'now' ? 'n' : undefined} />
                    ))}
                  </span>
                </span>
              </button>
            );
          }
          const k = stepK(s);
          return (
            <button key={s.id} className="fs" type="button" onClick={() => stepsDrill(groupIdx(s))}>
              <Si k={k} tip={k === 'you' ? 'In progress · You' : k === 'sbc' ? 'With SBC' : undefined} />
              <span className="t">
                <b>{s.title}</b>
                <span>{s.kind === 'up' || s.kind === 'next' ? `Step ${s.n} · ${s.owner === 'client' ? company : 'SBC'}${s.windowFrom ? ` · from ${dShort(s.windowFrom)}` : ''}` : stepSub(s)}</span>
              </span>
            </button>
          );
        })}
        {more > 0 ? (
          <button className="fold" type="button" style={{ background: 'light-dark(#fff, oklch(13% 0 89.9))', color: 'var(--muted)', boxShadow: 'inset 0 0 0 1.5px var(--up)' }} onClick={() => stepsDrill(3)}>
            +{more} more · SPICe+ filing → COI
          </button>
        ) : null}
      </div>
    </Card>
  );

  const timelineCard = (
    <Card
      id="timeline"
      title="Timeline"
      info={after ? 'Incorporation is complete.' : 'Planned dates for each phase. The red line is today.'}
      foot={['Open Incorporation', () => portal.go('incorporation')]}
      right={
        !after && phases ? (
          <button className="btn btn-sm btn-o r" type="button" style={{ marginLeft: 'auto', order: 3 }} onClick={onEditTimeline}>
            Edit
          </button>
        ) : null
      }
    >
      {h.home?.timeline.pending && !after ? (
        <div style={{ padding: '0 14px 8px' }}>
          <button type="button" className="tle-pend" onClick={() => portal.toast(`Waiting for ${h.manager ?? 'your project manager'} to approve · “${h.home!.timeline.pending!.reason.slice(0, 60)}”`)}>
            Change request pending{h.home.timeline.pending.coiTo ? ` · COI ${dShort(h.home.timeline.pending.coiTo)}` : ''}
          </button>
        </div>
      ) : null}
      {gantt ?? <Bot text="SBC has not planned the dates yet." q="When will SBC plan the incorporation dates?" />}
    </Card>
  );

  const alertsCard = (
    <Card id="alerts" title="Important alerts" info="Dated items only, nearest first.">
      {h.alerts.rows.length ? (
        h.alerts.rows.map((a) => (
          <button key={a.key} className="row" type="button" onClick={() => drill('Important alerts', [['15 days', h.alerts.rows.filter((x) => days(today, x.date) <= 15).length], ['30 days', h.alerts.rows.filter((x) => days(today, x.date) <= 30).length]], 0, (i) => h.alerts.rows.filter((x) => days(today, x.date) <= (i ? 30 : 15)).map((x) => ({ k: x.tone === 'due' ? 'you' : 'up', t: x.title, s: `${dayMon(x.date).join(' ')} · ${rel(today, x.date)}`, route: x.href })))}>
            <Tile iso={a.date} kind={a.tone === 'due' ? 'due' : 'up'} />
            <span className="t">
              <b>{a.title}</b>
              <span>{rel(today, a.date)}</span>
            </span>
            <I n="go" s={14} w={2.4} />
          </button>
        ))
      ) : (
        <Bot text="Nothing dated coming up." act="" />
      )}
    </Card>
  );

  const sbcCard = (
    <Card id="sbcdo" title="What SBC is doing" info={after ? 'Work the SBC team is doing now.' : 'Work the SBC team is doing now. Tap for the detail.'}>
      {sbc.length ? (
        sbc.map((s) => (
          <button key={s.key} className="row" type="button" onClick={() => sbcDrill(s.pct === 0 ? 1 : 0)}>
            <Si k={s.pct === 0 ? 'up' : 'sbc'} tip={s.pct ? `With SBC · ${s.pct}%` : s.pct === 0 ? 'Upcoming' : 'With SBC'} />
            <span className="t">
              <b>{s.title}</b>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span className="pb">
                  <i style={{ width: `${s.pct ?? 100}%`, background: s.pct == null ? 'var(--prog-light)' : 'oklch(56% .19 262)' }} />
                </span>
                {s.pct != null ? <span className="mono" style={{ fontSize: 11 }}>{s.pct}%</span> : null}
              </span>
            </span>
          </button>
        ))
      ) : (
        <Bot text={`SBC has nothing open for ${company} right now.`} act="" />
      )}
    </Card>
  );


  return {
    greet,
    postRows,
    needsCard,
    holdsCard,
    timelineCard,
    alertsCard,
    sbcCard,
  };
}

export type MobileCardsA = ReturnType<typeof createMobileCardsA>;
