'use client';

/**
 * UPDATES (prototype a3_inc.js notesCard / annsCard / openNotes / openAnns, badges):
 * the Notifications and Announcements popovers anchored at the bell / megaphone,
 * their badges, and a "See all" history modal with filters.
 *
 * CONTRACT (used by the sidebar and the top bar — keep the signature):
 *   useUpdatesActions() → { unread, annUnread, openNotes(anchor), openAnns(anchor) }
 *   unread    = unread notifications (bell count, sidebar "Notifications" badge)
 *   annUnread = unread announcements (megaphone dot, sidebar "Announcements" badge)
 *   openNotes / openAnns open the popover anchored at the clicked button; a second
 *   click on the same button closes it.
 *
 * Real data: `/api/client/notifications` (GET history; POST read / unread / read_all),
 * `/api/announcements` (SBC's posts + approved official updates), the caller's
 * read marks `/api/client/announcements/reads`, and the unread count
 * `/api/client/portal/announcements-unread`. A notification's link navigates
 * inside the portal (links.ts → intent); the `notes` / `anns` route intents
 * open the popovers at the top-bar buttons.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppNotification } from '@/lib/checklist-notifications';
import { ANNOUNCEMENT_KIND_LABEL, type Announcement } from '@/lib/announcements';
import { useIntent, usePortal, type Intent } from '../../runtime';
import { getJson, QK, sendJson } from '../../data';
import { ModalBox, PopHead } from '../../overlays';
import { Btn, Icon, Pill, Seg, initials, type IconName } from '../../ui';
import { hrefToIntent } from './links';

/* ---------------------------------------------------------------- data */

const ANN_KEY = ['announcements', 'all'] as const;
const READS_KEY = ['portal', 'announcement-reads'] as const;

function useNotifications() {
  return useQuery({
    queryKey: QK.notifications,
    queryFn: async () => (await getJson<{ notifications: AppNotification[] }>('/api/client/notifications'))?.notifications ?? [],
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
function useAnnouncements() {
  return useQuery({
    queryKey: ANN_KEY,
    queryFn: async () => (await getJson<{ announcements: Announcement[] }>('/api/announcements'))?.announcements ?? [],
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
function useAnnReads() {
  return useQuery({
    queryKey: READS_KEY,
    queryFn: async () => (await getJson<{ readIds: string[] }>('/api/client/announcements/reads'))?.readIds ?? [],
    staleTime: 30_000,
  });
}
function useAnnUnreadCount() {
  return useQuery({
    queryKey: QK.announcementsUnread,
    queryFn: async () => (await getJson<{ unread: number }>('/api/client/portal/announcements-unread'))?.unread ?? 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** Mark notifications read / unread (optimistic; the shell badge refreshes after). */
function useMarkNotes() {
  const qc = useQueryClient();
  const setRead = useCallback(
    (ids: string[], read: boolean) => {
      const set = new Set(ids);
      qc.setQueryData<AppNotification[]>(QK.notifications, (o) => (o ? o.map((n) => (set.has(n.id) ? { ...n, read } : n)) : o));
    },
    [qc],
  );
  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: QK.shell });
    void qc.invalidateQueries({ queryKey: QK.notifications });
  }, [qc]);
  const markRead = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      setRead(ids, true);
      void sendJson('/api/client/notifications', 'POST', { action: 'read', ids }).then(refresh, () => setRead(ids, false));
    },
    [setRead, refresh],
  );
  const markUnread = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      setRead(ids, false);
      void sendJson('/api/client/notifications', 'POST', { action: 'unread', ids }).then(refresh, () => setRead(ids, true));
    },
    [setRead, refresh],
  );
  const markAll = useCallback(
    async (fallbackIds: string[]) => {
      setRead(fallbackIds, true);
      try {
        const r = await sendJson<{ ids: string[] }>('/api/client/notifications', 'POST', { action: 'read_all' });
        refresh();
        return r.ids.length ? r.ids : fallbackIds;
      } catch {
        setRead(fallbackIds, false);
        return null;
      }
    },
    [setRead, refresh],
  );
  return { markRead, markUnread, markAll };
}

function useMarkAnns() {
  const qc = useQueryClient();
  return useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      qc.setQueryData<string[]>(READS_KEY, (o) => [...new Set([...(o ?? []), ...ids])]);
      void sendJson('/api/client/announcements/reads', 'POST', { action: 'read', ids })
        .then(() => qc.invalidateQueries({ queryKey: QK.announcementsUnread }))
        .catch(() => qc.invalidateQueries({ queryKey: READS_KEY }));
    },
    [qc],
  );
}

/* ---------------------------------------------------------------- notification model (pure, from the previous portal) */

type Ty = 'doc' | 'back' | 'step' | 'time' | 'deadline' | 'mail' | 'ann' | 'team';
type Grp = 'Documents' | 'Steps' | 'Deadlines' | 'Messages';

const T: Record<Ty, { grp: Grp; ic: IconName; col: [string, string]; link: string; kind: string }> = {
  doc: { grp: 'Documents', ic: 'doc', col: ['var(--due-bg)', 'var(--due-ink)'], link: 'Open the document', kind: 'Request' },
  back: { grp: 'Documents', ic: 'alert', col: ['var(--over-bg)', 'var(--over-ink)'], link: 'Open the document', kind: 'Sent back' },
  step: { grp: 'Steps', ic: 'check', col: ['rgba(52,211,153,.14)', 'var(--ok-green)'], link: 'Open the step', kind: 'Step' },
  time: { grp: 'Steps', ic: 'clock', col: ['var(--ice-soft)', 'var(--ice)'], link: 'See the timeline', kind: 'Timeline' },
  deadline: { grp: 'Deadlines', ic: 'clock', col: ['var(--due-bg)', 'var(--due-ink)'], link: 'Open the filing', kind: 'Deadline' },
  mail: { grp: 'Messages', ic: 'mail', col: ['var(--hi)', 'var(--ink-2)'], link: 'Email settings', kind: 'Email' },
  ann: { grp: 'Messages', ic: 'mega', col: ['var(--ice-soft)', 'var(--ice)'], link: 'Read it', kind: 'Announcement' },
  team: { grp: 'Messages', ic: 'team', col: ['var(--hi)', 'var(--ink-2)'], link: 'Open Team', kind: 'Team' },
};

/** Real notification kinds → the eight display types (copied from the previous NotificationsPage). */
export function typeOf(n: AppNotification): Ty {
  const k = String(n.kind);
  const t = `${n.title} ${n.body}`.toLowerCase();
  if (k.startsWith('email.')) return 'mail';
  if (k.startsWith('team.')) return 'team';
  if (k === 'request.created' || k === 'docs.share') return 'doc';
  if (k === 'request.sent_back' || ((k === 'checklist.review' || k === 'request.uploaded') && /sent back|reject|changes|fix|re-?upload/.test(t))) return 'back';
  if (k === 'request.uploaded') return 'doc';
  if (k.startsWith('timeline.') || /timeline|end date|moved to|schedule/.test(t)) return 'time';
  if (k.startsWith('compliance.') || /\bdue (in|on|today|tomorrow)\b|deadline/.test(t)) return 'deadline';
  if (k.startsWith('announcement.') || k.startsWith('regulatory.')) return 'ann';
  return 'step';
}

const FALLBACK: Record<Ty, Intent> = {
  doc: { kind: 'section', key: 'documents' },
  back: { kind: 'section', key: 'documents' },
  step: { kind: 'section', key: 'incorporation' },
  time: { kind: 'section', key: 'incorporation' },
  deadline: { kind: 'section', key: 'filings' },
  mail: { kind: 'section', key: 'settings' },
  ann: { kind: 'anns' },
  team: { kind: 'section', key: 'team' },
};

/** Where a notification leads inside the portal: its link when it is a portal path, else its type's home. */
export function intentOf(n: AppNotification, ty: Ty): Intent {
  return hrefToIntent(n.href) ?? FALLBACK[ty];
}

function istDay(iso: string): string {
  return new Date(Date.parse(iso) + 330 * 60_000).toISOString().slice(0, 10);
}
function groupOf(iso: string, today: string, weekStart: string): 0 | 1 | 2 {
  const d = istDay(iso);
  if (d === today) return 0;
  if (d >= weekStart) return 1;
  return 2;
}
function whenText(iso: string, g: number): string {
  const dt = new Date(iso);
  if (g === 0) return dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
  if (g === 1) return dt.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Asia/Kolkata' });
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}
const GL = ['TODAY', 'THIS WEEK', 'EARLIER'];

interface Item {
  n: AppNotification;
  ty: Ty;
  g: 0 | 1 | 2;
  w: string;
}

function useItems(list: AppNotification[] | undefined): Item[] {
  return useMemo(() => {
    const today = istDay(new Date().toISOString());
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // week starts Monday
    const weekStart = d.toISOString().slice(0, 10);
    return (list ?? []).map((n) => {
      const g = groupOf(n.createdAt, today, weekStart);
      return { n, ty: typeOf(n), g, w: whenText(n.createdAt, g) };
    });
  }, [list]);
}

/* ---------------------------------------------------------------- notification row */

function NoteRow({ it, onOpen, onToggleRead }: { it: Item; onOpen: () => void; onToggleRead?: () => void }) {
  const t = T[it.ty];
  const u = !it.n.read;
  return (
    <div className={'nit' + (u ? '' : ' read')} style={{ cursor: 'pointer' }} role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <span className="ic" style={{ background: t.col[0], color: t.col[1] }}>
        <Icon name={t.ic} />
      </span>
      <div style={{ minWidth: 0 }}>
        <b>{it.n.title}</b>
        {it.n.body ? <div className="d">{it.n.body}</div> : null}
        <div className="d" style={{ color: 'var(--ice)', fontWeight: 600 }}>
          {t.link} →
        </div>
      </div>
      <div className="m">
        <span>{it.w}</span>
        {onToggleRead ? (
          <button
            type="button"
            className="dot"
            style={{ cursor: 'pointer', display: 'block', opacity: u ? 1 : 0.35, background: u ? 'var(--ice)' : 'var(--line)' }}
            aria-label={u ? 'Unread · mark as read' : 'Mark as unread'}
            title={u ? 'Mark as read' : 'Mark as unread'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleRead();
            }}
          />
        ) : (
          <i className="dot" aria-label="Unread" />
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- notifications popover */

function NotesCard() {
  const { closePop, setIntent, toast, openModal } = usePortal();
  const q = useNotifications();
  const items = useItems(q.data);
  const { markRead, markAll } = useMarkNotes();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const unread = items.filter((x) => !x.n.read);
  const u = unread.length;
  const list = tab === 'all' ? items : unread;

  const open = (it: Item) => {
    if (!it.n.read) markRead([it.n.id]);
    const none = u <= 1 && !it.n.read;
    closePop();
    window.setTimeout(() => setIntent(intentOf(it.n, it.ty)), none ? 200 : 120);
  };

  const rows: ReactNode[] = [];
  let g = -1;
  for (const it of list) {
    if (it.g !== g) {
      g = it.g;
      rows.push(
        <div key={'g' + g} className="ngrp">
          {GL[g]}
        </div>,
      );
    }
    rows.push(<NoteRow key={it.n.id} it={it} onOpen={() => open(it)} />);
  }

  return (
    <div>
      <PopHead title="Notifications" sub={q.isPending ? 'Loading…' : u ? `${u} unread` : 'All caught up'} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
        <Seg<'all' | 'unread'> options={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread', n: u || undefined }]} value={tab} onChange={setTab} ariaLabel="Filter notifications" />
        <span className="sp" />
        {u ? (
          <Btn
            cls="sm"
            ico="check"
            onClick={async () => {
              const ids = await markAll(unread.map((x) => x.n.id));
              toast(ids ? 'All marked read' : 'Could not mark all read');
              if (ids) window.setTimeout(() => closePop(), 900);
            }}
          >
            Mark all read
          </Btn>
        ) : null}
        <Btn cls="sm" ico="hist" onClick={() => { closePop(); openModal(<NotesHistory />, { label: 'All notifications' }); }}>
          See all
        </Btn>
      </div>
      {q.isError ? (
        <div className="sec-empty">Notifications could not load.</div>
      ) : !q.isPending && !list.length ? (
        <div className="allread">
          <Icon name="check" />
          {tab === 'unread' || !items.length ? (items.length ? 'You have read everything' : 'Nothing yet. SBC’s updates land here.') : 'You have read everything'}
        </div>
      ) : (
        <div className="nlist">{rows}</div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- full history modal ("See all") */

const HIST_TABS: Array<{ k: string; label: string; f: (x: Item) => boolean }> = [
  { k: 'all', label: 'All', f: () => true },
  { k: 'unread', label: 'Unread', f: (x) => !x.n.read },
  { k: 'Documents', label: 'Documents', f: (x) => T[x.ty].grp === 'Documents' },
  { k: 'Steps', label: 'Steps', f: (x) => T[x.ty].grp === 'Steps' },
  { k: 'Deadlines', label: 'Deadlines', f: (x) => T[x.ty].grp === 'Deadlines' },
  { k: 'Messages', label: 'Messages', f: (x) => T[x.ty].grp === 'Messages' },
];

export function NotesHistory() {
  const { closeModal, setIntent, toast } = usePortal();
  const q = useNotifications();
  const items = useItems(q.data);
  const { markRead, markUnread, markAll } = useMarkNotes();
  const [tab, setTab] = useState('all');
  const [undo, setUndo] = useState<string[] | null>(null);
  const f = HIST_TABS.find((t) => t.k === tab)!.f;
  const list = items.filter(f);
  const unread = items.filter((x) => !x.n.read);

  const open = (it: Item) => {
    if (!it.n.read) markRead([it.n.id]);
    closeModal();
    window.setTimeout(() => setIntent(intentOf(it.n, it.ty)), 150);
  };

  const rows: ReactNode[] = [];
  let g = -1;
  for (const it of list) {
    if (it.g !== g) {
      g = it.g;
      rows.push(
        <div key={'g' + g} className="ngrp">
          {GL[g]}
        </div>,
      );
    }
    rows.push(<NoteRow key={it.n.id} it={it} onOpen={() => open(it)} onToggleRead={() => (it.n.read ? markUnread([it.n.id]) : markRead([it.n.id]))} />);
  }

  return (
    <ModalBox
      title="Notifications"
      sub={`${items.length} in your history · ${unread.length} unread`}
      width={720}
      label="All notifications"
      foot={
        <>
          {undo ? (
            <Btn
              ico="back"
              onClick={() => {
                markUnread(undo);
                setUndo(null);
              }}
            >
              Undo mark all read
            </Btn>
          ) : unread.length ? (
            <Btn
              ico="check"
              onClick={async () => {
                const ids = await markAll(unread.map((x) => x.n.id));
                if (ids) setUndo(ids);
                toast(ids ? 'All marked read' : 'Could not mark all read');
              }}
            >
              Mark all read
            </Btn>
          ) : null}
          <span className="sp" />
          <Btn cls="pri" onClick={closeModal}>
            Done
          </Btn>
        </>
      }
    >
      <div style={{ marginTop: 14 }}>
        <Seg options={HIST_TABS.map((t) => ({ value: t.k, label: t.label, n: items.filter(t.f).length || undefined }))} value={tab} onChange={setTab} ariaLabel="Filter notifications" />
      </div>
      {q.isPending ? (
        <div className="sec-load">Loading…</div>
      ) : !list.length ? (
        <div className="allread">
          <Icon name="check" />
          {tab === 'unread' ? 'You have read everything' : 'Nothing here yet'}
        </div>
      ) : (
        <div className="nlist" style={{ maxHeight: 'min(60vh, 520px)' }}>
          {rows}
        </div>
      )}
    </ModalBox>
  );
}

/* ---------------------------------------------------------------- announcements */

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
const annWhen = (iso: string): string => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
const annTag = (a: Announcement, company: string): string => (a.origin === 'feed' ? 'Official update' : a.authorRole === 'client' ? company : 'From SBC');

function AnnsCard() {
  const { shell, openPop, openChat, closePop } = usePortal();
  const q = useAnnouncements();
  const reads = useAnnReads();
  const markAnns = useMarkAnns();
  const [tab, setTab] = useState<'all' | 'imp' | 'gen'>('all');
  const readSet = useMemo(() => new Set(reads.data ?? []), [reads.data]);
  const all = q.data ?? [];
  const rows = all.filter((a) => (tab === 'all' ? true : tab === 'imp' ? imp(a) : !imp(a)));
  const unread = reads.isSuccess ? all.filter((a) => !readSet.has(a.id)) : [];
  const company = shell?.companyShort ?? 'You';

  const open = (a: Announcement) => {
    markAnns([a.id]);
    openPop(null, <AnnDetail id={a.id} />, { push: true, cls: 'wide', kind: 'anns' });
  };

  return (
    <div>
      <PopHead title="Announcements" sub={q.isPending ? 'Loading…' : unread.length ? `${unread.length} new · From SBC and the official portals` : 'From SBC and the official portals'} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
        <Seg<'all' | 'imp' | 'gen'>
          options={[
            { value: 'all', label: 'All', n: all.length || undefined },
            { value: 'imp', label: 'Important', n: all.filter(imp).length || undefined },
            { value: 'gen', label: 'General' },
          ]}
          value={tab}
          onChange={setTab}
          ariaLabel="Filter announcements"
        />
        <span className="sp" />
        {unread.length ? (
          <Btn cls="sm" ico="check" onClick={() => markAnns(unread.map((a) => a.id))}>
            Mark all read
          </Btn>
        ) : null}
      </div>
      {q.isError ? (
        <div className="sec-empty">Announcements could not load.</div>
      ) : !q.isPending && !rows.length ? (
        <div className="allread">
          <Icon name="check" />
          {all.length ? 'Nothing in this group' : 'No announcements yet. Deadlines show up here first.'}
        </div>
      ) : (
        <div className="nlist" style={{ marginTop: 8 }}>
          {rows.map((a) => {
            const u = reads.isSuccess && !readSet.has(a.id);
            const h = host(a);
            return (
              <div key={a.id} className="ann" role="button" tabIndex={0} style={{ cursor: 'pointer', opacity: u || !reads.isSuccess ? 1 : 0.72 }} onClick={() => open(a)} onKeyDown={(e) => e.key === 'Enter' && open(a)}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className={'pill ' + (imp(a) ? 'due' : 'mut')}>{annTag(a, company)}</span>
                  <span className="pill mut">{ANNOUNCEMENT_KIND_LABEL[a.kind]}</span>
                  {a.origin === 'feed' && h ? <span className="small">{h}</span> : null}
                  <span className="small" style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                    {annWhen(a.publishedAt)}
                    {u ? <i className="dot" aria-label="Unread" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ice)', display: 'inline-block' }} /> : null}
                  </span>
                </div>
                <b>{a.title}</b>
                <p style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.body?.trim() || a.title}</p>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <span className="sp" />
        <Btn
          cls="sm"
          ico="chat"
          onClick={() => {
            closePop();
            openChat('What changed in the latest announcements?');
          }}
        >
          Ask VCFO
        </Btn>
      </div>
    </div>
  );
}

/** One announcement, read from the live list (pushed on the popover stack under Back). */
function AnnDetail({ id }: { id: string }) {
  const { shell, openChat, closePop } = usePortal();
  const q = useAnnouncements();
  const a = q.data?.find((x) => x.id === id);
  if (!a) return <PopHead title="Announcement" sub="This update is no longer on the board." />;
  const feed = a.origin === 'feed';
  const author = shell?.team.find((t) => t.id === a.authorId);
  const authorName = author?.name ?? a.authorName.split('@')[0]!;
  const roleLabel = author?.role ?? (a.authorRole === 'manager' ? 'Project Manager' : a.authorRole === 'intern' ? 'Project Lead' : 'SBC');
  const when = new Date(a.publishedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
  const h = host(a);
  return (
    <div>
      <PopHead title={a.title} sub={`${ANNOUNCEMENT_KIND_LABEL[a.kind]} · ${when}`} lead={<span className={'pill ' + (imp(a) ? 'due' : 'mut')}>{imp(a) ? 'Important' : 'General'}</span>} />
      <p className="lede" style={{ marginTop: 12, whiteSpace: 'pre-line', lineHeight: 1.55 }}>
        {a.body?.trim() || a.title}
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 12, background: 'var(--hi)', marginTop: 12 }}>
        {feed ? (
          <>
            <Icon name="globe" style={{ width: 18, height: 18, color: 'var(--ink-3)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ font: '600 13.5px var(--f-disp)' }}>Official update</b>
              <div className="small">{h || a.sourceName || 'Government portal'} · reviewed by SBC</div>
            </div>
            {a.sourceUrl ? (
              <a className="btn sm" href={a.sourceUrl} target="_blank" rel="noopener noreferrer">
                <Icon name="ext" />
                Open source
              </a>
            ) : null}
          </>
        ) : (
          <>
            <span className="av">{initials(authorName)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ font: '600 13.5px var(--f-disp)' }}>{authorName}</b>
              <div className="small">{roleLabel} · SBC</div>
            </div>
          </>
        )}
      </div>
      <div className="mfoot" style={{ marginTop: 14 }}>
        <Btn
          ico="chat"
          onClick={() => {
            closePop();
            openChat(`Tell me about ${a.title}`);
          }}
        >
          Ask VCFO about this
        </Btn>
        <Btn cls="pri" ico="check" onClick={() => closePop()}>
          Got it
        </Btn>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- the contract */

export interface UpdatesActions {
  unread: number;
  annUnread: number;
  openNotes: (anchor?: Element | null) => void;
  openAnns: (anchor?: Element | null) => void;
}

const topBtn = (label: string): Element | null => document.querySelector(`.cpx .top .ib[aria-label="${label}"]`);

/* The hook is mounted twice (sidebar + top bar); only the first instance owns the route intents. */
let owner: symbol | null = null;

export function useUpdatesActions(): UpdatesActions {
  const { shell, pop, openPop, closePop } = usePortal();
  const notes = useNotifications();
  const annCount = useAnnUnreadCount();
  const unread = notes.data ? notes.data.filter((n) => !n.read).length : (shell?.badges.notifications ?? 0);
  const annUnread = annCount.data ?? 0;

  /* A second click on the same button closes the card. The outside mousedown
     (PopHost) already closed it before the click lands, so remember what just
     closed and treat the click that follows within 400 ms as the close. */
  const kind = pop?.kind;
  const lastOpen = useRef<{ kind: string | undefined; at: number }>({ kind: undefined, at: 0 });
  useEffect(() => {
    if (kind) lastOpen.current = { kind, at: 0 };
    else if (lastOpen.current.kind) lastOpen.current.at = Date.now();
  }, [kind]);
  const justClosed = (k: string) => lastOpen.current.kind === k && Date.now() - lastOpen.current.at < 400;
  const openNotes = useCallback(
    (anchor?: Element | null) => {
      if (kind === 'notes' || justClosed('notes')) {
        lastOpen.current = { kind: undefined, at: 0 };
        return closePop();
      }
      openPop(anchor ?? topBtn('Notifications'), <NotesCard />, { cls: 'wide', kind: 'notes' });
    },
    [kind, openPop, closePop],
  );
  const openAnns = useCallback(
    (anchor?: Element | null) => {
      if (kind === 'anns' || justClosed('anns')) {
        lastOpen.current = { kind: undefined, at: 0 };
        return closePop();
      }
      openPop(anchor ?? topBtn('Announcements'), <AnnsCard />, { cls: 'wide', kind: 'anns' });
    },
    [kind, openPop, closePop],
  );

  const [me] = useState(() => Symbol('updates'));
  const [own, setOwn] = useState(false);
  useEffect(() => {
    if (owner === null) {
      owner = me;
      setOwn(true);
    }
    return () => {
      if (owner === me) owner = null;
    };
  }, [me]);
  useIntent(['notes', 'anns'], own && Boolean(shell), (i) => {
    // land on the top bar first so the anchored card is in view
    window.scrollTo({ top: 0, behavior: 'auto' });
    window.setTimeout(() => {
      if (i.kind === 'notes') openPop(topBtn('Notifications'), <NotesCard />, { cls: 'wide', kind: 'notes' });
      else openPop(topBtn('Announcements'), <AnnsCard />, { cls: 'wide', kind: 'anns' });
    }, 80);
  });

  return { unread, annUnread, openNotes, openAnns };
}

/** Kept for sections that want the pill of a notification type (Home's dock, Search). */
export function NoteKindPill({ n }: { n: AppNotification }) {
  const ty = typeOf(n);
  return <Pill kind={ty === 'back' ? 'over' : ty === 'doc' || ty === 'deadline' ? 'due' : ty === 'step' ? 'ok' : 'mut'}>{T[ty].kind}</Pill>;
}
