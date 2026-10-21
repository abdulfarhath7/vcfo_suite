'use client';

/**
 * Announcements — prototype s/team/ann_redesign.dc.html (+ ann_detail, ann_empty).
 * List: `/api/announcements` (live head poll, `useAnnouncements`); read state:
 * NEW `announcement_reads` via `/api/client/announcements/reads`; next-deadline
 * banner: `/api/client/overview` compliance runway; portals: `VCFO_PORTAL_TASKS`.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useClientOverview } from '@/hooks/use-client-overview';
import { ANNOUNCEMENT_KIND_LABEL, type Announcement } from '@/lib/notifications/announcements';
import { VCFO_PORTAL_TASKS, type VcfoPortalTask } from '@/lib/notifications/announcement-portals';
import { usePortal } from '../../PortalProvider';
import { VisorHead } from '../../Visor';
import { LinkButton } from '../../LinkButton';
import { todayIST } from '../../hooks';
import {
  AskWhy,
  BotBubble,
  CloseBtn,
  Dialog,
  P,
  Seg,
  Svg,
  api,
  avatarColor,
  contactHref,
  dayMonth,
  initialsOf,
  useSkeleton,
} from './common';
import '../../css/team-00-contract.css';
import '../../css/team-ann.css';

const PORTAL_CAP = 8;
const READS_KEY = ['client-portal', 'announcement-reads'] as const;
const UNREAD_KEY = ['client-portal', 'announcements-unread'] as const;

const NEUTRAL = { background: 'var(--raised)', color: 'var(--navy-ink,var(--navy))', boxShadow: 'inset 0 0 0 1px var(--border)' };
const KC: Record<string, React.CSSProperties> = {
  deadline: { background: 'var(--due-chip)', color: '#fff' },
  compliance: { background: 'var(--prog-chip)', color: '#fff' },
};
const imp = (a: Announcement) => a.kind === 'deadline' || a.kind === 'compliance';
const host = (a: Announcement): string => {
  if (a.sourceUrl) {
    try {
      return new URL(a.sourceUrl).hostname.replace(/^www\./, '');
    } catch {
      /* fall through */
    }
  }
  return a.sourceName ?? '';
};

const SETUP_HEADS = ['Incorporation', 'Registrations', 'FEMA', 'Customs', 'Foreign Trade', 'Labour', 'Local Compliance', 'IP/Brand'];
const RECUR: Record<string, string> = {
  'Monthly Compliances': 'Monthly',
  'Quarterly Compliances': 'Quarterly',
  'Half-yearly Compliances': 'Half-yearly',
  'Yearly Compliances': 'Yearly',
};

export function AnnouncementsPage() {
  const { shell, go, openChat } = usePortal();
  const qc = useQueryClient();
  const list = useAnnouncements();
  const reads = useQuery({
    queryKey: READS_KEY,
    queryFn: () => api<{ readIds: string[] }>('/api/client/announcements/reads'),
  });
  const ov = useClientOverview();
  const sk = useSkeleton(list.isLoading);
  const [tab, setTab] = useState(0);
  const [pt, setPt] = useState(0);
  const [portalsAll, setPortalsAll] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const all = useMemo(() => list.data?.announcements ?? [], [list.data]);
  const readSet = useMemo(() => new Set(reads.data?.readIds ?? []), [reads.data]);
  const isUnread = (a: Announcement) => reads.isSuccess && !readSet.has(a.id);
  const F = [() => true, imp, (a: Announcement) => !imp(a)];
  const rows = all.filter(F[tab]);

  const markRead = (ids: string[]) => {
    const fresh = ids.filter((id) => !readSet.has(id));
    if (!fresh.length) return;
    qc.setQueryData<{ readIds: string[] }>(READS_KEY, (o) => ({ readIds: [...(o?.readIds ?? []), ...fresh] }));
    void api('/api/client/announcements/reads', { method: 'POST', json: { action: 'read', ids: fresh } })
      .then(() => qc.invalidateQueries({ queryKey: UNREAD_KEY }))
      .catch(() => qc.invalidateQueries({ queryKey: READS_KEY }));
  };

  // next deadline (G10: only when there is one)
  const next = ov.data?.overview?.compliance.upcoming?.[0];
  const days = next ? Math.round((Date.parse(`${next.dueDate.slice(0, 10)}T00:00:00Z`) - Date.parse(`${todayIST()}T00:00:00Z`)) / 86_400_000) : 0;
  const dueText = days > 1 ? `in ${days} days` : days === 1 ? 'tomorrow' : days === 0 ? 'today' : `${-days} days late`;

  // portals (real task list; a row needs at least one official link)
  const tasks = VCFO_PORTAL_TASKS.filter((t) => t.portalUrl || t.circularUrl);
  const setup = tasks.filter((t) => SETUP_HEADS.includes(t.head));
  const recurring = tasks.filter((t) => RECUR[t.head]);
  /* compact card (prototype shows ~8 rows): the first PORTAL_CAP rows, then "Show all" */
  const plist = pt === 0 ? setup : recurring;
  const capped = !portalsAll && plist.length > PORTAL_CAP;
  const groups = (capped ? plist.slice(0, PORTAL_CAP) : plist).reduce<Array<{ h: string; rows: VcfoPortalTask[] }>>((acc, t) => {
    const h = RECUR[t.head] ?? t.head;
    const g = acc.find((x) => x.h === h);
    if (g) g.rows.push(t);
    else acc.push({ h, rows: [t] });
    return acc;
  }, []);

  const openAt = (i: number) => {
    setOpenIdx(i);
    const a = rows[i];
    if (a) markRead([a.id]);
  };

  return (
    <div className="cp-team">
      <main className="pg tb-wrap tp-ann">
        {next ? (
          <section
            className="tb-focus"
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '14px 18px',
              borderRadius: 10,
              background: 'var(--due-light)',
              border: '1px solid oklch(66% 0.17 48 / .35)',
            }}
          >
            <div className="dtile" style={{ background: 'var(--due-chip)', color: '#fff' }}>
              <span className="d">{dayMonth(`${next.dueDate.slice(0, 10)}T12:00:00Z`).d}</span>
              <span className="m">{dayMonth(`${next.dueDate.slice(0, 10)}T12:00:00Z`).m}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="lbl" style={{ color: 'var(--due-text)' }}>
                Next deadline · {dueText}
              </div>
              <div style={{ font: '700 16px Manrope', color: 'var(--fg)', marginTop: 3 }}>
                {next.title}
                {next.periodLabel ? ` for ${next.periodLabel}` : ''}
              </div>
            </div>
            <a
              href={`/app/client/compliances/filings?open=${encodeURIComponent(next.id)}`}
              className="btn btn-o btn-sm"
              onClick={(e) => {
                e.preventDefault();
                go(`/app/client/compliances/filings?open=${encodeURIComponent(next.id)}`);
              }}
            >
              Open
            </a>
          </section>
        ) : null}

        <div className="tb-g12">
          <section className="card tb-s8">
            <div className="tb-hd">
              <h2 className="h3">Latest</h2>
              <Seg
                tabs={['All', 'Important', 'General'].map((l, i) => ({ label: l, cnt: all.filter(F[i]).length }))}
                active={tab}
                onPick={setTab}
                label="Filter announcements"
                grid={false}
              />
            </div>
            {list.isLoading ? (
              sk ? (
                [0, 1, 2, 3].map((i) => (
                  <div key={i} className="row">
                    <span className="sk" style={{ width: 50, height: 54, borderRadius: 8 }} />
                    <div style={{ flex: 1 }}>
                      <div className="sk" style={{ width: '30%', height: 12 }} />
                      <div className="sk" style={{ width: '70%', height: 14, marginTop: 8 }} />
                    </div>
                  </div>
                ))
              ) : null
            ) : rows.length === 0 ? (
              <BotBubble size={52} padding="56px 16px 64px">
                <div className="rt" style={{ fontWeight: 700 }}>
                  {tab === 1 ? 'No important updates right now.' : tab === 2 ? 'No general updates right now.' : 'No announcements yet.'}
                </div>
                <div className="cap" style={{ marginTop: 2 }}>
                  Deadlines will show up here first.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  {tab !== 0 ? (
                    <button type="button" className="btn btn-o btn-sm" onClick={() => setTab(0)}>
                      See all
                    </button>
                  ) : null}
                  <AskWhy q="Why are there no important updates right now?" />
                </div>
              </BotBubble>
            ) : (
              rows.map((a, i) => {
                const unread = isUnread(a);
                const dm = dayMonth(a.publishedAt);
                const feed = a.origin === 'feed';
                const h = host(a);
                return (
                  <LinkButton
                    key={a.id}
                    className={unread ? 'row unread w-full' : 'row w-full'}
                    style={{ color: 'inherit', fontWeight: 'inherit', textDecoration: 'none' }}
                    onClick={() => openAt(i)}
                  >
                    <div
                      className="dtile"
                      style={
                        a.kind === 'deadline'
                          ? { background: 'var(--due-light)', color: 'var(--due-text)' }
                          : { background: 'var(--primary-light)', color: 'var(--navy-ink,var(--navy))' }
                      }
                    >
                      <span className="d">{dm.d}</span>
                      <span className="m">{dm.m}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px 8px', flexWrap: 'wrap' }}>
                        <span className="chip" style={KC[a.kind] ?? NEUTRAL}>
                          {ANNOUNCEMENT_KIND_LABEL[a.kind]}
                        </span>
                        <span className="cap">{feed ? 'Official feed' : `From ${a.authorName.split('@')[0]}`}</span>
                        {feed && h ? (
                          <span className="chip tb-m tb-iflex" style={{ background: 'var(--raised)', color: 'var(--muted)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
                            {h}
                          </span>
                        ) : null}
                      </div>
                      <div className="rt" style={{ marginTop: 4, fontSize: 14, fontWeight: unread ? 800 : 600 }}>
                        {a.title}
                      </div>
                    </div>
                    {feed && h ? (
                      <span className="chip tb-d" style={{ background: 'var(--raised)', color: 'var(--muted)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
                        {h}
                      </span>
                    ) : null}
                    {unread ? <span className="udot" role="img" aria-label="Unread" data-tip="Unread" /> : null}
                  </LinkButton>
                );
              })
            )}
          </section>

          <section className="card t tb-s4">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px' }}>
              <span className="ic" style={{ background: 'var(--navy)' }}>
                <Svg d={P.bank} />
              </span>
              <h2 className="h3">Official portals</h2>
            </div>
            <div style={{ padding: '0 16px 10px' }}>
              <Seg
                tabs={[
                  { label: 'Setup', cnt: setup.length },
                  { label: 'Recurring', cnt: recurring.length },
                ]}
                active={pt}
                onPick={setPt}
                label="Portal groups"
                style={{ width: '100%' }}
                wrap={false}
              />
            </div>
            <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {groups.map((g) => (
                <div key={g.h}>
                  <div className="lbl" style={{ marginBottom: 6 }}>
                    {g.h}
                  </div>
                  {g.rows.map((r) => (
                    <div key={r.task} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid var(--hair)' }}>
                      <span className="rt" style={{ flex: 1, minWidth: 0 }}>
                        {r.task}
                      </span>
                      {r.portalUrl ? (
                        <a href={r.portalUrl} target="_blank" rel="noopener noreferrer" className="ibtn" aria-label={`Open portal for ${r.task}`} data-tip={`Open portal for ${r.task}`}>
                          <Svg d={P.ext} size={14} />
                        </a>
                      ) : null}
                      {r.circularUrl ? (
                        <a href={r.circularUrl} target="_blank" rel="noopener noreferrer" className="ibtn" aria-label={`Read circular for ${r.task}`} data-tip={`Read circular for ${r.task}`}>
                          <Svg d={P.circular} size={14} sw={1.8} />
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              ))}
              {plist.length > PORTAL_CAP ? (
                <button type="button" className="btn btn-g btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setPortalsAll((v) => !v)}>
                  {capped ? `Show all ${plist.length}` : 'Show fewer'}
                </button>
              ) : null}
            </div>
          </section>
        </div>
      </main>

      {openIdx !== null && rows[openIdx] ? (
        <AnnDetail
          a={rows[openIdx]}
          index={openIdx}
          total={rows.length}
          team={shell?.team ?? []}
          onClose={() => setOpenIdx(null)}
          onStep={(d) => {
            const n = (openIdx + d + rows.length) % rows.length;
            openAt(n);
          }}
          openChat={openChat}
        />
      ) : null}
    </div>
  );
}

function AnnDetail({
  a,
  index,
  total,
  team,
  onClose,
  onStep,
  openChat,
}: {
  a: Announcement;
  index: number;
  total: number;
  team: Array<{ id: string; name: string; role: string; email?: string; phoneE164?: string; whatsappE164?: string }>;
  onClose: () => void;
  onStep: (d: number) => void;
  openChat: (q?: string) => void;
}) {
  const dm = dayMonth(a.publishedAt);
  const feed = a.origin === 'feed';
  const author = team.find((t) => t.id === a.authorId);
  const authorName = author?.name ?? a.authorName.split('@')[0];
  const roleLabel = author?.role ?? (a.authorRole === 'manager' ? 'Project Manager' : a.authorRole === 'intern' ? 'Project Lead' : 'SBC');
  const when = new Date(a.publishedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
  const h = host(a);
  const wa = author ? contactHref('wa', author) : null;
  const em = author ? contactHref('email', author) : null;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') onStep(-1);
      if (e.key === 'ArrowRight') onStep(1);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onStep]);
  return (
    <Dialog labelledBy="ad-t" width={560} top onClose={onClose} tp="tp-ann">
      <div className="dlg-h" style={{ alignItems: 'flex-start' }}>
        <div
          className="dtile"
          style={a.kind === 'deadline' ? { background: 'var(--due-light)', color: 'var(--due-text)' } : { background: 'var(--primary-light)', color: 'var(--navy-ink,var(--navy))' }}
        >
          <span className="d">{dm.d}</span>
          <span className="m">{dm.m}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className="chip" style={{ ...(KC[a.kind] ?? NEUTRAL), minWidth: 116, justifyContent: 'center' }}>
              {ANNOUNCEMENT_KIND_LABEL[a.kind]}
            </span>
            {imp(a) ? (
              <span className="chip" style={{ background: 'var(--raised)', color: 'var(--muted)' }}>
                Important
              </span>
            ) : null}
          </div>
          <h2 id="ad-t" style={{ margin: '6px 0 0', font: '700 18px/1.3 Space Grotesk', color: 'var(--navy-ink,var(--navy))' }}>
            {a.title}
          </h2>
        </div>
        <CloseBtn onClick={onClose} />
      </div>
      <div className="dlg-b" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
        <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{a.body?.trim() || a.title}</p>
        {feed ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--raised)' }}>
            <div style={{ flex: 1 }}>
              <div className="rt">Official feed</div>
              <div className="cap">
                {h || a.sourceName} · {when}
              </div>
            </div>
            {a.sourceUrl ? (
              <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, fontWeight: 700 }}>
                Open on {h} ↗
              </a>
            ) : null}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--raised)' }}>
            <span className="av" style={{ width: 30, height: 30, fontSize: 10, background: avatarColor(a.authorId ?? authorName) }}>
              {initialsOf(authorName)}
            </span>
            <div style={{ flex: 1 }}>
              <div className="rt">{authorName}</div>
              <div className="cap">
                {roleLabel} · {when}
              </div>
            </div>
            {wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="ibtn wa" aria-label={`WhatsApp ${authorName}`}>
                <Svg d={P.waShort} sw={1.8} />
              </a>
            ) : null}
            {em ? (
              <a href={em} className="ibtn" aria-label={`Email ${authorName}`}>
                <Svg d={P.mail} sw={1.8} />
              </a>
            ) : null}
          </div>
        )}
        <LinkButton
          className="ask w-full"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
          onClick={() => {
            onClose();
            openChat(`Tell me about ${a.title}`);
          }}
        >
          <span style={{ width: 18, height: 18, display: 'inline-flex', overflow: 'hidden' }}>
            <VisorHead style={{ width: 18, height: 23, marginTop: 2 }} />
          </span>
          Ask VCFO about this
        </LinkButton>
      </div>
      <div className="dlg-f" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="ibtn" aria-label="Previous announcement" data-tip="Previous announcement" disabled={total < 2} onClick={() => onStep(-1)}>
            <Svg d={P.prev} join={false} />
          </button>
          <button type="button" className="ibtn" aria-label="Next announcement" data-tip="Next announcement" disabled={total < 2} onClick={() => onStep(1)}>
            <Svg d={P.next} join={false} />
          </button>
          <span className="mono cap" style={{ alignSelf: 'center' }}>
            {index + 1} / {total}
          </span>
        </div>
        <button type="button" className="btn btn-n" onClick={onClose}>
          Got it
        </button>
      </div>
    </Dialog>
  );
}
