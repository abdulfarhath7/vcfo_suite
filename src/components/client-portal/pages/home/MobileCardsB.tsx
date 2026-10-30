import { copyText } from './ui';
import { RevealCountdown } from '@/components/client-portal/pages/credentials/IdsRevealDialog';
import {
  BUCKET_LABEL,
  BUCKETS,
  bucketOf,
  dShort,
  days,
  filingName,
  filingPortal,
  FT_PHONE,
  rel,
} from './derive';
import { I, type K, Si, Tile, MSeg, Bot, Card, Count } from './MobileParts';
import type { MobileHomeState } from './useMobileHome';
import type { MobileCardsA } from './MobileCardsA';

/** Phone Home cards, part two: next filings, compliance, IDs, registrations, post-inc, documents, activity. */
export function createMobileCardsB(ctx: MobileHomeState & MobileCardsA) {
  const {
    h,
    onOpenDocs,
    portal,
    company,
    today,
    ready,
    drawn,
    drill,
    dueDrill,
    regDrill,
    nextTab,
    setNextTab,
    nextList,
    c15,
    c30,
    total,
    compCols,
    compDrill,
    setReveal,
    idRows,
    download,
    actTab,
    setActTab,
    acts,
    actRows,
    postRows,
  } = ctx;

  const nextCard = (
    <Card id="next" title="What is next" info="Filings due in the next 15 or 30 days. ↗ opens the official portal." foot={['Open Compliances', () => portal.go('compliances')]}>
      <MSeg
        id="next"
        tabs={[
          ['15 days', c15],
          ['30 days', c30],
        ]}
        sel={nextTab}
        onSel={setNextTab}
      />
      {nextList.length ? (
        nextList.map((f) => {
          const over = bucketOf(f, today) === 'overdue';
          const p = filingPortal(f);
          return (
            <div key={f.id} className="row" style={{ cursor: 'default' }}>
              <Tile iso={f.dueDate} kind={over ? 'over' : days(today, f.dueDate) <= 7 ? 'due' : 'up'} />
              <span className="t">
                <b>{filingName(f)}</b>
                <span>
                  {over ? `Overdue ${days(f.dueDate, today)} day${days(f.dueDate, today) === 1 ? '' : 's'}` : rel(today, f.dueDate)}
                  {f.owner === 'client' ? ` · ${company}` : f.owner ? ' · SBC' : ''}
                </span>
              </span>
              {p ? (
                <a className="ic" href={p[0]} target="_blank" rel="noopener noreferrer" aria-label={`Open ${p[1]}`}>
                  <I n="ext" s={14} />
                </a>
              ) : null}
              <button className="ic" type="button" aria-label={`Open ${f.title}`} onClick={() => dueDrill(over ? 0 : 1)}>
                <I n="go" s={14} w={2.4} />
              </button>
            </div>
          );
        })
      ) : (
        <Bot text={`No filings due in the next ${nextTab ? 30 : 15} days.`} act="" />
      )}
    </Card>
  );

  const compCard = (() => {
    const Cc = 2 * Math.PI * 44;
    let off = 0;
    return (
      <Card id="comp" title="Compliance status" info="Hover a slice for its count · click a slice, a legend row or the centre to see the list" foot={['Open Filings', () => portal.go('filings')]}>
        <div className="dn">
          <svg width="110" height="110" viewBox="0 0 110 110">
            {BUCKETS.map((b, i) => {
              const len = total ? (h.buckets[b] / total) * Cc : 0;
              const el = (
                <circle
                  key={b}
                  className="s"
                  cx="55"
                  cy="55"
                  r="44"
                  fill="none"
                  stroke={compCols[i]}
                  strokeWidth="14"
                  strokeDasharray={`${drawn ? len : 0} ${Cc}`}
                  strokeDashoffset={-off}
                  tabIndex={0}
                  role="button"
                  aria-label={`${BUCKET_LABEL[b]} · ${h.buckets[b]}`}
                  onClick={() => compDrill(i)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && compDrill(i)}
                >
                  <title>{`${BUCKET_LABEL[b]} · ${h.buckets[b]}`}</title>
                </circle>
              );
              off += len;
              return el;
            })}
          </svg>
          <div className="lg">
            <div style={{ font: "600 26px var(--font-sans)", letterSpacing: '-.03em' }}>
              <Count v={total} ready={ready} /> <span style={{ font: '600 11px var(--font-sans),sans-serif', color: 'var(--muted)', letterSpacing: 0 }}>this FY</span>
            </div>
            {BUCKETS.map((b, i) => (
              <button key={b} type="button" onClick={() => compDrill(i)}>
                <i style={{ background: compCols[i] }} />
                {BUCKET_LABEL[b]}
                <b>{h.buckets[b]}</b>
              </button>
            ))}
          </div>
        </div>
      </Card>
    );
  })();

  const idsCard = (
    <Card id="ids" title="Company IDs" info="PAN and TAN stay hidden. Reveal asks for your password and hides again after 60 s.">
      {idRows.map(([k, v, secret, url, clear]) => (
        <div key={k} className="idr">
          <span className="k">{k}</span>
          <span className="v" style={clear ? { color: 'var(--ok-text)' } : undefined}>
            {clear ?? v ?? '—'}
          </span>
          {clear && secret ? <RevealCountdown field={secret} className="mono" style={{ fontSize: 12, color: 'var(--ok-text)' }} /> : null}
          {v && secret ? (
            <button className="ic" type="button" aria-label={`Reveal ${k}`} onClick={() => setReveal(secret)}>
              <I n="eye" s={15} />
            </button>
          ) : v ? (
            <button className="ic" type="button" aria-label={`Copy ${k}`} onClick={() => void copyText(v).then((ok) => portal.toast(ok ? `Copied · ${v}` : 'Copy blocked by this browser'))}>
              <I n="copy" s={14} />
            </button>
          ) : null}
          <a className="ic" href={url} target="_blank" rel="noopener noreferrer" aria-label="Open the official portal">
            <I n="ext" s={14} />
          </a>
        </div>
      ))}
    </Card>
  );

  // Phone shows a short list (mobile.html#after): done, in progress and the
  // next upcoming ones; the rest live in the Registrations sheet (HM-10).
  const regsShown = [...h.regs.filter((r) => r.status !== 'Upcoming'), ...h.regs.filter((r) => r.status === 'Upcoming').slice(0, 2)];
  const regsCard = (
    <Card
      id="regs"
      title="Registrations"
      info="Every registration with its portal ↗ and its proof 📎."
      foot={regsShown.length < h.regs.length ? [`All ${h.regs.length} registrations`, () => regDrill(regsShown.some((r) => r.status === 'Registered') ? 0 : 2)] : undefined}
    >
      {regsShown.map((r) => {
        const k: K = r.status === 'Registered' ? 'done' : r.status === 'In progress' ? 'sbc' : 'up';
        return (
          <div key={r.step.id} className="row" style={{ cursor: 'default' }}>
            <Si k={k} />
            <span className="t">
              <b>{r.name}</b>
              <span>
                {r.authority} · {r.dateLabel}
              </span>
            </span>
            {r.status === 'Registered' ? (
              r.certPath ? (
                <button className="pr" type="button" aria-label={`Open proof for ${r.name}`} onClick={() => onOpenDocs([{ id: `${r.step.id}:cert`, name: r.certName!, type: 'PDF', from: 'firm', kind: 'milestone', ref: r.certPath! }], 0)}>
                  <I n="clip" s={12} />
                  Proof
                </button>
              ) : (
                <span className="pr pend" title="Filed, proof not uploaded yet">
                  Proof pending
                </span>
              )
            ) : null}
            {r.portal ? (
              <a className="ic" href={r.portal} target="_blank" rel="noopener noreferrer" aria-label="Open the official portal">
                <I n="ext" s={14} />
              </a>
            ) : null}
          </div>
        );
      })}
    </Card>
  );

  const postCard = (
    <Card id="post" title="Post-incorporation setup" info="Statutory windows that started on the COI date.">
      {h.post.open.map((p) => {
        const pct = Math.round(p.usedPct);
        return (
          <button key={p.step.id} className="row" type="button" onClick={() => drill('Post-incorporation setup', [['Open', h.post.open.length], ['Completed', h.post.done.length]], 0, postRows)}>
            <span className="t">
              <b>{p.step.title}</b>
              <span>
                {p.owner === 'client' ? company : 'SBC'} · {p.dueDate ? dShort(p.dueDate) : '—'}
                {p.overDays ? (
                  <i style={{ color: 'var(--over-text)', fontWeight: 700, fontStyle: 'normal', display: 'inline' }}> · overdue {p.overDays} day{p.overDays === 1 ? '' : 's'}</i>
                ) : p.limitDays && p.day != null ? (
                  ` · day ${p.day} of ${p.limitDays}`
                ) : (
                  ''
                )}
              </span>
              <span style={{ display: 'flex', marginTop: 5 }}>
                <span className="pb">
                  <i style={{ width: `${pct}%`, background: p.overDays ? 'var(--over)' : pct > 45 ? 'var(--due)' : 'var(--navy-3)' }} />
                </span>
              </span>
            </span>
          </button>
        );
      })}
      {h.post.open.length === 0 ? <Bot text="Every post-incorporation step is done." act="" /> : null}
    </Card>
  );

  const docsCard = (
    <Card id="docs" title="Recent documents" info={`The newest files from ${company}’s project. 👁 previews, ⬇ downloads.`} foot={['Open Documents', () => portal.go('documents')]}>
      {h.docs.length ? (
        h.docs.map((d, i) => (
          <div key={d.id} className="row" style={{ cursor: 'default' }}>
            <span className="mono" style={{ width: 38, height: 20, borderRadius: 3, background: FT_PHONE[d.type] ?? 'var(--subtle)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center', flex: 'none' }}>
              {d.type}
            </span>
            <span className="t">
              <b>{d.name}</b>
              <span>{dShort(d.date)}</span>
            </span>
            <button className="ic" type="button" aria-label={`Preview ${d.name}`} onClick={() => onOpenDocs(h.docs, i)}>
              <I n="eye" s={15} />
            </button>
            <button className="ic" type="button" aria-label={`Download ${d.name}`} onClick={() => void download(d)}>
              <I n="dl" s={15} />
            </button>
          </div>
        ))
      ) : (
        <Bot text={`No documents yet. Files from ${company} and SBC show up here.`} act="" />
      )}
    </Card>
  );

  const actCard = (
    // C1: the latest five rows in a fixed height, then "View all" opens the Audit page.
    <Card id="act" title="Recent activity" info="Who did what, newest first." foot={['View all', () => portal.go('audit')]}>
      <MSeg
        id="act"
        tabs={[
          ['All', acts.length],
          ['SBC', acts.filter((a) => a.actorKind !== 'client').length],
          [company, acts.filter((a) => a.actorKind === 'client').length],
        ]}
        sel={actTab}
        onSel={setActTab}
      />
      <div style={{ height: 290, overflow: 'hidden' }}>
        {actRows.length ? (
          actRows.slice(0, 5).map((a) => (
            <div key={a.id} className="row" style={{ cursor: 'default' }}>
              <Si k={a.actorKind === 'client' ? 'you' : a.actorKind === 'system' ? 'late' : 'done'} tip={a.actorKind === 'client' ? company : a.actorName} />
              <span className="t">
                <b>{a.label}</b>
                <span>
                  {dShort(a.at.slice(0, 10))} · {a.actorKind === 'client' ? company : a.actorName}
                </span>
              </span>
            </div>
          ))
        ) : (
          <Bot text="Nothing here yet." act="" />
        )}
      </div>
    </Card>
  );


  return {
    nextCard,
    compCard,
    idsCard,
    regsShown,
    regsCard,
    postCard,
    docsCard,
    actCard,
  };
}
