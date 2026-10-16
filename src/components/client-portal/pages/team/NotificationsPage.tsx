'use client';

/**
 * Notifications — prototype s/team/notif_redesign.dc.html (+ notif_drill, notif_empty).
 * Rows: `/api/client/notifications` (own history incl. cleared); read / unread /
 * read-all through the same route (Undo restores exactly the ids it changed).
 * Channel card: `/api/account/profile` (WhatsApp opt-in).
 */
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppNotification } from '@/lib/checklist-notifications';
import { usePortal, PORTAL_SHELL_KEY } from '../../PortalProvider';
import { portalHref } from '../../routes';
import { BotBubble, CloseBtn, Dialog, P, Seg, Svg, api, useIsPhone, useScrollAfterClose, useSkeleton } from './common';
import '../../css/team-00-contract.css';
import '../../css/team-notif.css';

const NOTIF_KEY = ['client-portal', 'notifications'] as const;
export const PROFILE_KEY = ['client-portal', 'profile'] as const;

type Ty = 'doc' | 'back' | 'step' | 'time' | 'deadline' | 'mail' | 'ann' | 'team';
type Grp = 'Documents' | 'Steps' | 'Deadlines' | 'Messages';

/* OPTION 4 icon set (notif_redesign.dc.html:186-200) */
const K = {
  document: {
    p1: 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z M14 2v5a1 1 0 0 0 1 1h5 M10 9H8 M16 13H8 M16 17H8',
    col: 'oklch(54.6% 0.215 263)',
    tint: 'light-dark(oklch(96.6% 0.02 260), oklch(24% 0.058 260))',
  },
  step: { p1: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0 M16 9l-5.5 5.5L8 12', col: 'oklch(56% 0.13 168)', tint: 'light-dark(oklch(96% 0.028 170), oklch(24.4% 0.077 170))' },
  deadline: {
    p1: 'M16 14v2.2l1.6 1 M16 2v3 M21 7.338V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h2.338 M3 9h5.859 M8 2v3 M10 16a6 6 0 1 0 12 0a6 6 0 1 0 -12 0',
    col: 'oklch(55% 0.17 42)',
    tint: 'light-dark(oklch(96.8% 0.04 55), oklch(23.9% 0.106 55))',
  },
  email: {
    p1: 'M22 7l-8.991 5.727a2 2 0 0 1-2.009 0L2 7 M4 4H20a2 2 0 0 1 2 2V18a2 2 0 0 1 -2 2H4a2 2 0 0 1 -2 -2V6a2 2 0 0 1 2 -2z',
    col: 'oklch(54% 0.17 292)',
    tint: 'light-dark(oklch(96.4% 0.032 292), oklch(24.2% 0.087 292))',
  },
  announcement: {
    p1: 'M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14 M8 6v8',
    col: 'oklch(52% 0.17 40)',
    tint: 'light-dark(oklch(96.6% 0.04 45), oklch(24% 0.106 45))',
  },
  team: {
    p1: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3.128a4 4 0 0 1 0 7.744 M22 21v-2a4 4 0 0 0-3-3.87 M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
    col: 'oklch(49% 0.12 230)',
    tint: 'light-dark(oklch(96.4% 0.026 228), oklch(24.2% 0.072 228))',
  },
};
const T: Record<Ty, [keyof typeof K, Grp, string, React.CSSProperties, string]> = {
  doc: ['document', 'Documents', 'Request', { background: 'var(--due-light)', color: 'var(--due-text)' }, 'Document request'],
  back: ['document', 'Documents', 'Sent back', { background: 'var(--over-light)', color: 'var(--over-text)' }, 'Document sent back · fix needed'],
  step: ['step', 'Steps', 'Step', { background: 'var(--ok-light)', color: 'var(--ok-text)' }, 'Step done'],
  time: ['step', 'Steps', 'Timeline', { background: 'var(--prog-light)', color: 'var(--prog-text)' }, 'Timeline changed'],
  deadline: [
    'deadline',
    'Deadlines',
    'Deadline',
    { background: 'light-dark(oklch(96.8% 0.05 85), oklch(23.9% 0.12 85))', color: 'light-dark(oklch(45% 0.12 70), oklch(82% 0.084 70))' },
    'Deadline coming up',
  ],
  mail: ['email', 'Messages', 'Email', { background: 'var(--sky-light)', color: 'var(--sky-chip)' }, 'Email sent'],
  ann: [
    'announcement',
    'Messages',
    'Announcement',
    { background: 'light-dark(oklch(96.6% 0.04 55), oklch(24% 0.106 55))', color: 'light-dark(oklch(48% 0.15 42), oklch(80.8% 0.105 42))' },
    'Announcement',
  ],
  team: [
    'team',
    'Messages',
    'Team',
    { background: 'light-dark(oklch(96.5% 0.03 230), oklch(24.1% 0.082 230))', color: 'light-dark(oklch(45% 0.11 235), oklch(82% 0.077 235))' },
    'Team change',
  ],
};

/** Real notification kinds → the board's eight types. */
function typeOf(n: AppNotification): Ty {
  const k = String(n.kind);
  const t = `${n.title} ${n.body}`.toLowerCase();
  if (k.startsWith('email.')) return 'mail';
  if (k.startsWith('team.')) return 'team';
  if (k === 'request.created' || k === 'docs.share') return 'doc';
  if (k === 'request.sent_back' || ((k === 'checklist.review' || k === 'request.uploaded') && /sent back|reject|changes|fix|re-?upload/.test(t))) return 'back';
  if (k === 'request.uploaded') return 'doc';
  if (k.startsWith('timeline.') || /timeline|end date|moved to|schedule/.test(t)) return 'time';
  if (k.startsWith('compliance.') || /\bdue (in|on|today|tomorrow)\b|deadline/.test(t)) return 'deadline';
  if (k.startsWith('announcement.')) return 'ann';
  return 'step';
}

function istDay(iso: string): string {
  return new Date(Date.parse(iso) + 330 * 60_000).toISOString().slice(0, 10);
}
function groupOf(iso: string, today: string, monday: string): 0 | 1 | 2 {
  const d = istDay(iso);
  if (d === today) return 0;
  if (d >= monday) return 1;
  return 2;
}
function whenText(iso: string, g: number): string {
  const dt = new Date(iso);
  if (g === 0) return dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
  if (g === 1) return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).replace(',', '');
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}

/** Only portal pages are followed; anything else falls back to the type's own page. */
function targetOf(n: AppNotification, ty: Ty): string {
  if (n.href && n.href.startsWith('/app/client')) return n.href;
  if (ty === 'doc' || ty === 'back') return portalHref('documents');
  if (ty === 'deadline') return portalHref('filings');
  if (ty === 'mail') return portalHref('settings') + '#notifications';
  if (ty === 'ann') return portalHref('announcements');
  if (ty === 'team') return portalHref('team');
  return portalHref('incorporation');
}

export function NotificationsPage() {
  const { go, toast, shell } = usePortal();
  const qc = useQueryClient();
  const isPhone = useIsPhone();
  const scrollAfter = useScrollAfterClose();
  const q = useQuery({
    queryKey: NOTIF_KEY,
    queryFn: () => api<{ notifications: AppNotification[] }>('/api/client/notifications'),
    refetchInterval: 30_000,
  });
  const profile = useQuery({
    queryKey: PROFILE_KEY,
    queryFn: () => api<{ profile: { whatsappOptIn: boolean; phoneE164: string | null } }>('/api/account/profile'),
  });
  const sk = useSkeleton(q.isLoading);
  const [tab, setTab] = useState(0);
  const [hv, setHv] = useState<number | null>(null);
  const [drill, setDrill] = useState<number | null>(null);

  const today = istDay(new Date().toISOString());
  const monday = useMemo(() => {
    const d = new Date(`${today}T00:00:00Z`);
    const dow = (d.getUTCDay() + 6) % 7; // Monday = 0 (DECISIONS: week starts Monday)
    d.setUTCDate(d.getUTCDate() - dow);
    return d.toISOString().slice(0, 10);
  }, [today]);

  const N = useMemo(
    () =>
      (q.data?.notifications ?? []).map((n) => {
        const ty = typeOf(n);
        const g = groupOf(n.createdAt, today, monday);
        return { n, ty, g, grp: T[ty][1], w: whenText(n.createdAt, g), href: targetOf(n, ty) };
      }),
    [q.data, today, monday],
  );
  type Item = (typeof N)[number];

  const setRead = (ids: string[], read: boolean) => {
    const set = new Set(ids);
    qc.setQueryData<{ notifications: AppNotification[] }>(NOTIF_KEY, (o) =>
      o ? { notifications: o.notifications.map((n) => (set.has(n.id) ? { ...n, read } : n)) } : o,
    );
  };
  const refreshBadges = () => void qc.invalidateQueries({ queryKey: PORTAL_SHELL_KEY });
  const markRead = (it: Item) => {
    if (it.n.read) return;
    setRead([it.n.id], true);
    void api('/api/client/notifications', { method: 'POST', json: { action: 'read', ids: [it.n.id] } }).then(refreshBadges, () => setRead([it.n.id], false));
  };
  const open = (it: Item) => {
    markRead(it);
    go(it.href);
  };
  const unreadIds = N.filter((x) => !x.n.read).map((x) => x.n.id);
  const markAll = async () => {
    if (!unreadIds.length) return;
    const before = unreadIds;
    setRead(before, true);
    try {
      const r = await api<{ ids: string[] }>('/api/client/notifications', { method: 'POST', json: { action: 'read_all' } });
      refreshBadges();
      const changed = r.ids.length ? r.ids : before;
      toast('All marked read', {
        undo: () => {
          setRead(changed, false);
          void api('/api/client/notifications', { method: 'POST', json: { action: 'unread', ids: changed } }).then(refreshBadges);
        },
      });
    } catch {
      setRead(before, false);
      toast('Could not mark all read');
    }
  };

  const TABS: Array<[string, (x: Item) => boolean]> = [
    ['All', () => true],
    ['Unread', (x) => !x.n.read],
    ['Documents', (x) => x.grp === 'Documents'],
    ['Steps', (x) => x.grp === 'Steps'],
    ['Deadlines', (x) => x.grp === 'Deadlines'],
    ['Messages', (x) => x.grp === 'Messages'],
  ];
  const shown = N.filter(TABS[tab][1]);
  const GL = ['Today', 'Earlier this week', 'Earlier'];
  const groups = GL.map((label, gi) => ({ label, items: shown.filter((x) => x.g === gi) })).filter((g) => g.items.length);

  // donut: this IST month
  const month = today.slice(0, 7);
  const M = N.filter((x) => istDay(x.n.createdAt).startsWith(month));
  const DT: Array<'All' | Grp> = ['All', 'Documents', 'Steps', 'Deadlines', 'Messages'];
  const cnt = (k: Grp) => M.filter((x) => x.grp === k).length;
  const tot = M.length;
  const C = 2 * Math.PI * 54;
  let acc = 0;
  const SEGC = ['var(--due-chip)', 'var(--prog-chip)', 'oklch(70% 0.15 80)', 'var(--sky-chip)'];
  const segs = [1, 2, 3, 4].map((i) => {
    const len = tot ? (cnt(DT[i] as Grp) / tot) * C : 0;
    const out = { i, len, da: `${Math.max(len - 2, 0)} ${C - len + 2}`, off: -acc };
    acc += len;
    return out;
  });
  const tip = hv === null ? '' : hv === 0 ? `All · ${tot}` : `${DT[hv]} · ${cnt(DT[hv] as Grp)}`;
  const waOn = profile.data?.profile.whatsappOptIn ?? false;
  const company = shell?.companyShort ?? 'You';

  const icon = (ty: Ty) => {
    const k = K[T[ty][0]];
    return (
      <span className="nic" role="img" aria-label={T[ty][4]} data-tip={T[ty][4]} style={{ background: k.tint }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={k.col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={k.p1} />
        </svg>
      </span>
    );
  };

  return (
    <div className="cp-team">
      <main className="pg tb-wrap tp-notif">
        <div className="tb-g12">
          <section className="card tb-s9">
            <div className="tb-hd">
              <Seg
                tabs={TABS.map(([l, f]) => ({ label: l, cnt: N.filter(f).length }))}
                active={tab}
                onPick={setTab}
                label="Filter notifications"
              />
              {unreadIds.length > 0 ? (
                <button type="button" className="btn btn-g btn-sm tb-mark" onClick={() => void markAll()}>
                  Mark all read
                </button>
              ) : null}
            </div>
            {q.isLoading ? (
              sk ? (
                [0, 1, 2, 3].map((i) => (
                  <div key={i} className="row">
                    <span className="sk" style={{ width: 32, height: 32, borderRadius: 8 }} />
                    <div style={{ flex: 1 }}>
                      <div className="sk" style={{ width: '45%', height: 12 }} />
                      <div className="sk" style={{ width: '70%', height: 10, marginTop: 6 }} />
                    </div>
                  </div>
                ))
              ) : null
            ) : groups.length === 0 ? (
              <BotBubble size={52} answered react padding="56px 16px 64px">
                <div className="rt" style={{ fontWeight: 700 }}>
                  {tab === 1 || tab === 0 ? 'All caught up. Nothing unread.' : `No ${TABS[tab][0].toLowerCase()} yet.`}
                </div>
                {tab !== 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    <button type="button" className="btn btn-o btn-sm" onClick={() => setTab(0)}>
                      See all
                    </button>
                  </div>
                ) : null}
              </BotBubble>
            ) : (
              groups.map((g) => (
                <div key={g.label}>
                  <div className="lbl" style={{ padding: '12px 16px 6px', color: 'var(--navy-ink,var(--navy))' }}>
                    {g.label}
                  </div>
                  {g.items.map((x) => {
                    const u = !x.n.read;
                    const [, , kind, chip] = T[x.ty];
                    return (
                      <div key={x.n.id} className={u ? 'row unread' : 'row'}>
                        {icon(x.ty)}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span className="tb-tl">
                            <a
                              href={x.href}
                              className="rt nt"
                              style={{ fontWeight: u ? 800 : 600, color: 'var(--fg)' }}
                              onClick={(e) => {
                                e.preventDefault();
                                open(x);
                              }}
                            >
                              {x.n.title}
                            </a>
                          </span>
                          {x.n.body ? <span className="nb">{x.n.body}</span> : null}
                          <span className="mono tb-m" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                            {x.w}
                          </span>
                        </div>
                        <span className="nkind">
                          <span className="chip" style={chip}>
                            {kind}
                          </span>
                        </span>
                        <span className="mono tb-d" style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                          {x.w}
                        </span>
                        {u ? (
                          <button
                            type="button"
                            className="udot pulse"
                            aria-label="Unread · mark as read"
                            onClick={() => markRead(x)}
                            style={{ border: 0, padding: 0, cursor: 'pointer' }}
                          />
                        ) : (
                          <span style={{ width: 8 }} />
                        )}
                        <a
                          href={x.href}
                          className="ibtn"
                          aria-label={`Open ${x.n.title}`}
                          onClick={(e) => {
                            e.preventDefault();
                            open(x);
                          }}
                        >
                          <Svg d={P.go} />
                        </a>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </section>

          <div className="tb-s3">
            <section className="card t" style={{ padding: 16, gap: 12, alignItems: 'center' }}>
              <h2 className="st" style={{ alignSelf: 'flex-start' }}>
                This month
              </h2>
              <div style={{ position: 'relative', width: 140, height: 140 }}>
                <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true" style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
                  <circle cx="70" cy="70" r="54" fill="none" stroke="var(--raised)" strokeWidth="18" />
                  {segs.map((s) =>
                    s.len > 0 ? (
                      <circle
                        key={s.i}
                        cx="70"
                        cy="70"
                        r="54"
                        fill="none"
                        stroke={SEGC[s.i - 1]}
                        strokeWidth={hv === s.i ? 24 : 18}
                        strokeDasharray={s.da}
                        strokeDashoffset={s.off}
                        onMouseEnter={() => setHv(s.i)}
                        onMouseLeave={() => setHv(null)}
                        onClick={() => {
                          setHv(null);
                          setDrill(s.i);
                        }}
                        style={{ cursor: 'pointer', transition: 'stroke-width .15s' }}
                      />
                    ) : null,
                  )}
                </svg>
                <button
                  type="button"
                  onClick={() => {
                    setHv(null);
                    setDrill(0);
                  }}
                  onMouseEnter={() => setHv(0)}
                  onMouseLeave={() => setHv(null)}
                  onFocus={() => setHv(0)}
                  onBlur={() => setHv(null)}
                  aria-label={`Show all ${tot} notifications`}
                  style={{
                    position: 'absolute',
                    inset: 26,
                    borderRadius: 99,
                    border: 0,
                    background: 'var(--panel)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    font: 'inherit',
                    color: 'inherit',
                  }}
                >
                  <span className="metric" style={{ fontSize: 30, lineHeight: 1 }}>
                    {tot}
                  </span>
                  <span className="cap">this month</span>
                </button>
                {hv !== null ? (
                  <span
                    role="tooltip"
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: -6,
                      transform: 'translate(-50%,-100%)',
                      background: 'var(--navy)',
                      color: '#fff',
                      font: '700 12px Manrope',
                      padding: '4px 9px',
                      borderRadius: 6,
                      whiteSpace: 'nowrap',
                      zIndex: 5,
                      boxShadow: '0 6px 16px -6px oklch(21% 0.042 264 / .5)',
                    }}
                  >
                    {tip}
                    <span style={{ position: 'absolute', left: '50%', bottom: -4, width: 8, height: 8, background: 'var(--navy)', transform: 'translateX(-50%) rotate(45deg)' }} />
                  </span>
                ) : null}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignSelf: 'stretch' }}>
                {[1, 2, 3, 4].map((i) => (
                  <button
                    key={i}
                    type="button"
                    className="tb-leg"
                    onClick={() => {
                      setHv(null);
                      setDrill(i);
                    }}
                    onMouseEnter={() => setHv(i)}
                    onMouseLeave={() => setHv(null)}
                    onFocus={() => setHv(i)}
                    onBlur={() => setHv(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      font: '600 12px Manrope',
                      color: 'var(--fg)',
                      border: 0,
                      background: hv === i ? 'var(--raised)' : 'none',
                      padding: '5px 6px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: SEGC[i - 1] }} />
                    <span style={{ flex: 1 }}>{DT[i]}</span>
                    <span className="mono">{cnt(DT[i] as Grp)}</span>
                  </button>
                ))}
              </div>
            </section>
            <section className="card" style={{ padding: '14px 16px', gap: 10 }}>
              <h2 className="h3">{company} gets these by</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="chip" style={{ background: 'var(--prog-light)', color: 'var(--prog-text)', padding: '4px 8px' }}>
                  ✓ Email
                </span>
                {waOn ? (
                  <span className="chip" style={{ background: 'var(--ok-light)', color: 'var(--ok-text)', padding: '4px 8px' }}>
                    ✓ WhatsApp
                  </span>
                ) : null}
              </div>
              <a
                href={`${portalHref('settings')}#notifications`}
                style={{ fontSize: 12 }}
                onClick={(e) => {
                  e.preventDefault();
                  go(`${portalHref('settings')}#notifications`);
                }}
              >
                Change in Settings →
              </a>
            </section>
          </div>
        </div>
      </main>

      {drill !== null ? (
        <NotifDrill
          drill={drill}
          setDrill={setDrill}
          items={M}
          icon={icon}
          company={company}
          sheet={isPhone}
          onOpen={(x) => {
            setDrill(null);
            open(x);
          }}
          onLink={(where) => {
            setDrill(null);
            if (where) go(where);
            else scrollAfter(200);
          }}
        />
      ) : null}
    </div>
  );
}

function NotifDrill<I extends { n: AppNotification; ty: Ty; grp: Grp; w: string; href: string }>({
  drill,
  setDrill,
  items,
  icon,
  company,
  sheet,
  onOpen,
  onLink,
}: {
  drill: number;
  setDrill: (d: number | null) => void;
  items: I[];
  icon: (t: Ty) => React.ReactNode;
  company: string;
  sheet: boolean;
  onOpen: (x: I) => void;
  onLink: (where: string) => void;
}) {
  const DT: Array<'All' | Grp> = ['All', 'Documents', 'Steps', 'Deadlines', 'Messages'];
  const LINK: Array<[string, string, string]> = [
    [`These live in ${company}’s Notifications list`, 'Show in the list ↓', ''],
    ['These items live in Documents', 'Open Documents →', portalHref('documents')],
    ['These steps live in Incorporation', 'Open Incorporation →', portalHref('incorporation')],
    ['These deadlines live in Compliances · Filings', 'Open Filings →', portalHref('filings')],
    ['These messages live in Announcements', 'Open Announcements →', portalHref('announcements')],
  ];
  const L = LINK[drill];
  const list = items.filter((x) => drill === 0 || x.grp === DT[drill]);
  return (
    <Dialog labelledBy="nd-t" width={600} top sheet={sheet} onClose={() => setDrill(null)} tp="tp-notif" dlgStyle={{ display: 'flex', flexDirection: 'column' }}>
      <div
        className="dd-top"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 18px',
          background: 'var(--primary-light)',
          borderBottom: '1px solid var(--border)',
          fontSize: 12,
          color: 'var(--muted)',
        }}
      >
        <span>{L[0]}</span>
        <a
          href={L[2] || '#'}
          style={{ marginLeft: 'auto', fontWeight: 800, fontSize: 12.5, whiteSpace: 'nowrap' }}
          onClick={(e) => {
            e.preventDefault();
            onLink(L[2]);
          }}
        >
          {L[1]}
        </a>
      </div>
      <div className="dlg-h">
        <span className="ic" style={{ background: 'var(--navy)' }}>
          <Svg d={P.bell} join={false} />
        </span>
        <h2 id="nd-t" style={{ margin: 0, font: '700 16px Manrope', color: 'var(--navy-ink,var(--navy))' }}>
          Notifications this month
        </h2>
        <CloseBtn onClick={() => setDrill(null)} />
      </div>
      <div style={{ padding: '12px 18px 0' }}>
        <Seg
          tabs={DT.map((l, i) => ({ label: l, cnt: i === 0 ? items.length : items.filter((x) => x.grp === l).length }))}
          active={drill}
          onPick={(i) => setDrill(i)}
          label="Filter by type"
        />
      </div>
      <div style={{ padding: '8px 0 10px', maxHeight: 'min(420px,52dvh)', overflow: 'auto' }}>
        {list.length === 0 ? (
          <div className="cap" style={{ padding: '16px 18px' }}>
            Nothing here this month.
          </div>
        ) : (
          list.map((x) => (
            <a
              key={x.n.id}
              href={x.href}
              className="row"
              style={{ color: 'inherit', fontWeight: 'inherit', padding: '10px 18px' }}
              onClick={(e) => {
                e.preventDefault();
                onOpen(x);
              }}
            >
              {icon(x.ty)}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="rt" style={{ display: 'block' }}>
                  {x.n.title}
                </span>
                <span className="mono cap">{x.w}</span>
              </span>
              <span className="chip" style={T[x.ty][3]}>
                {T[x.ty][2]}
              </span>
              <span style={{ color: 'var(--primary)', display: 'flex' }}>
                <Svg d={P.go} />
              </span>
            </a>
          ))
        )}
      </div>
    </Dialog>
  );
}
