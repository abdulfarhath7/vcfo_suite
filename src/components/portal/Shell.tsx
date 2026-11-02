'use client';

/**
 * The portal frame (prototype body.txt / newc_body.txt): brand sidebar with
 * hover-open groups and badges, sticky top bar (crumb, search, announcements,
 * notifications, status brief, theme, account), the phone tab row, and one
 * `<section class="sec">` frame per section in page order.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { signOut } from 'next-auth/react';
import { Icon, IconBtn, Sym, type IconName } from './ui';
import { SECTION_CRUMB, SECTION_LABEL, secId, usePortal, type SectionKey } from './runtime';
import { SECTION_COMPONENTS } from './section-registry';
import { useUpdatesActions } from './sections/updates/updates';
import { useBriefAction } from './sections/home/brief';

/* ---------------------------------------------------------------- sidebar */

const ICON: Partial<Record<SectionKey, IconName>> = {
  home: 'home',
  incorporation: 'build',
  registrations: 'key',
  obligations: 'notes',
  master: 'gantt',
  documents: 'folder',
  library: 'lib',
  credentials: 'key',
  team: 'team',
  audit: 'hist',
  settings: 'gear',
  nhome: 'step',
  nmd: 'notes',
  nsign: 'doc',
};

function Badge({ v, hot }: { v: number | string | undefined; hot?: boolean }) {
  if (v === undefined || v === 0 || v === '') return null;
  return <span className={'bd' + (hot ? ' hot' : '')}>{v}</span>;
}

/** A sidebar group that opens on hover / focus and stays open after a tap (prototype #snav .grp). */
function Group({
  id,
  icon,
  label,
  extra,
  childOn,
  children,
}: {
  id: string;
  icon: IconName;
  label: string;
  extra?: ReactNode;
  childOn?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState(false);
  const t = useRef(0);
  const hover = useRef(false);
  useEffect(() => () => window.clearTimeout(t.current), []);
  return (
    <div
      className={'grp' + (open ? ' open' : '') + (pin ? ' pin' : '')}
      id={id}
      onMouseEnter={() => {
        hover.current = true;
        window.clearTimeout(t.current);
        t.current = window.setTimeout(() => setOpen(true), 90);
      }}
      onMouseLeave={() => {
        hover.current = false;
        window.clearTimeout(t.current);
        if (!pin) t.current = window.setTimeout(() => setOpen(false), 220);
      }}
      onFocus={() => {
        window.clearTimeout(t.current);
        setOpen(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null) && !pin) setOpen(false);
      }}
    >
      <button
        type="button"
        className={'si' + (childOn ? ' child-on' : '')}
        aria-expanded={open}
        onClick={() => {
          const p = !pin;
          setPin(p);
          setOpen(p || hover.current);
        }}
      >
        <Icon name={icon} />
        {label}
        {extra}
        <svg className="chev" aria-hidden="true">
          <use href="#i-down" />
        </svg>
      </button>
      <div className="sub-x">
        <div className="sub">{children}</div>
      </div>
    </div>
  );
}

function Sidebar() {
  const { active, go, badges, shell } = usePortal();
  const updates = useUpdatesActions();
  const pm = shell?.team.find((t) => t.role === 'Project Manager') ?? shell?.team.find((t) => !t.support);
  const item = (k: SectionKey, badge?: ReactNode) => (
    <button key={k} type="button" className={'si' + (active === k ? ' on' : '')} data-go={k} onClick={() => go(k)}>
      <Icon name={ICON[k] ?? 'home'} />
      {SECTION_LABEL[k]}
      {badge}
    </button>
  );
  const inCmp = active === 'obligations' || active === 'calendar' || active === 'filings';
  return (
    <aside className="side" aria-label="Sections">
      <div className="logo">
        <Sym id="logo" width={40} height={37} />
        <div>
          <b>
            VCFO <span>Suite</span>
          </b>
          <small>BY SBC</small>
        </div>
      </div>
      <nav className="snav">
        {item('home')}
        <Group id="g-upd" icon="mega" label="Updates" extra={<span className={'gdot' + (updates.unread > 0 || updates.annUnread > 0 ? ' on' : '')} />}>
          <button type="button" data-open="anns" onClick={(e) => updates.openAnns(e.currentTarget)}>
            Announcements
            <Badge v={updates.annUnread} />
          </button>
          <button type="button" data-open="notes" onClick={(e) => updates.openNotes(e.currentTarget)}>
            Notifications
            <Badge v={updates.unread} />
          </button>
        </Group>
        {item('incorporation', <Badge v={badges.incorporation} />)}
        {/* the prototype's "Client · SBC-GCC" screens, now part of the one client portal */}
        {item('nhome')}
        {item('nmd', <Badge v={badges.nmd} hot />)}
        {item('nsign', <Badge v={badges.nsign} hot />)}
        {item('registrations', <Badge v={badges.registrations} />)}
        {item('master')}
        <Group id="g-cmp" icon="calc" label="Compliances" childOn={inCmp} extra={<span className="gcur">{inCmp ? SECTION_LABEL[active] : ''}</span>}>
          <button type="button" className={active === 'obligations' ? 'on' : ''} data-go="obligations" onClick={() => go('obligations')}>
            Obligations
            <Badge v={badges.obligations} />
          </button>
          <button type="button" className={active === 'calendar' ? 'on' : ''} data-go="calendar" onClick={() => go('calendar')}>
            Calendar
            <Badge v={badges.calendar} />
          </button>
          <button type="button" className={active === 'filings' ? 'on' : ''} data-go="filings" onClick={() => go('filings')}>
            Filings
            <Badge v={badges.filings} />
          </button>
        </Group>
        {item('documents', <Badge v={badges.documents} hot={Number(badges.documents) > 0} />)}
        {item('library')}
        {item('credentials', <Badge v={badges.credentials} />)}
        {item('team')}
        {item('audit')}
        {item('settings')}
      </nav>
      <div className="sfoot">
        <div className="lbl">{shell ? `${shell.companyShort.toUpperCase()}’S TEAM` : 'YOUR TEAM'}</div>
        {pm ? (
          <div className="who">
            <span className="av">{pm.initials}</span>
            <div>
              <b>{pm.name}</b>
              <span>{pm.role === 'SBC help desk' ? 'SBC help desk' : `${pm.role} · SBC`}</span>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

/* ---------------------------------------------------------------- top bar */

function AccountButton() {
  const { shell } = usePortal();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const r = btn.current?.getBoundingClientRect();
    const W = menu.current?.offsetWidth ?? 260;
    const H = menu.current?.offsetHeight ?? 120;
    if (r) setPos({ left: Math.max(8, Math.min(r.right - W, window.innerWidth - W - 8)), top: Math.max(8, Math.min(r.bottom + 8, window.innerHeight - H - 8)) });
    const close = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    window.addEventListener('resize', () => setOpen(false), { once: true });
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  if (!shell) return null;
  return (
    <>
      <button
        ref={btn}
        type="button"
        className="ib acct-b"
        aria-label={`Account · ${shell.me.name}`}
        title={`${shell.me.name} · Client`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {shell.me.initials}
      </button>
      {open ? (
        <div ref={menu} className="acct-menu" role="menu" aria-label="Account" style={pos ?? { visibility: 'hidden' }}>
          <div className="acct-who">
            <span className="acct-av">{shell.me.initials}</span>
            <div>
              <b>{shell.me.name}</b>
              <span>{shell.me.email}</span>
              <em>Client · {shell.companyShort}</em>
            </div>
          </div>
          <button type="button" className="acct-it out" role="menuitem" onClick={() => void signOut({ callbackUrl: '/login' })}>
            <Icon name="ext" />
            Sign out
          </button>
        </div>
      ) : null}
    </>
  );
}

function TopBar() {
  const { active, isLight, setTheme, openSearch } = usePortal();
  const updates = useUpdatesActions();
  const brief = useBriefAction();
  const crumb = SECTION_CRUMB[active] ?? SECTION_LABEL[active];
  return (
    <header className="top">
      <div className="crumb">
        <span className="co">SBC</span>
        <span>/</span>
        <b>{crumb}</b>
      </div>
      <span className="sp" />
      <button type="button" className="search" onClick={openSearch}>
        <Icon name="search" />
        <span>Search</span>
        <kbd>Ctrl K</kbd>
      </button>
      <IconBtn ico="mega" label="Announcements" dot={updates.annUnread > 0} onClick={(e) => updates.openAnns(e.currentTarget)} />
      <IconBtn ico="bell" label="Notifications" count={updates.unread} onClick={(e) => updates.openNotes(e.currentTarget)} />
      <IconBtn ico="brief" label="Status brief" onClick={brief} />
      <IconBtn ico={isLight ? 'moon' : 'sun'} label="Switch theme" onClick={() => setTheme(isLight ? 'dark' : 'light')} />
      <AccountButton />
    </header>
  );
}

function MobileNav() {
  const { sections, active, go } = usePortal();
  return (
    <nav className="mobile-nav" aria-label="Sections">
      {sections.map((k) => (
        <button key={k} type="button" className={active === k ? 'on' : ''} data-go={k} onClick={() => go(k)}>
          {SECTION_LABEL[k]}
        </button>
      ))}
    </nav>
  );
}

/* ---------------------------------------------------------------- page */

export function Shell() {
  const { sections } = usePortal();
  return (
    <div className="app" id="app-client">
      <Sidebar />
      <div className="main">
        <TopBar />
        <MobileNav />
        {sections.map((k, i) => {
          const C = SECTION_COMPONENTS[k];
          return (
            <section key={k} className="sec" id={secId(k)} data-sec={k} style={i === 0 ? { paddingTop: 0 } : undefined}>
              <C />
            </section>
          );
        })}
      </div>
    </div>
  );
}
