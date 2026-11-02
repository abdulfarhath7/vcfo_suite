'use client';

/**
 * The console frame (prototype mgr_body.txt + a59y_console.js "Graphite
 * console"): a 56 px icon rail with one icon per section, a context panel that
 * opens while the pointer is over the sidebar and shows the hovered (or the
 * current) section's pages, a sticky top bar (crumb, stage filter, search,
 * announcements, notifications, theme, account) and the page.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useApp } from '@/context/AppContext';
import { Icon, IconBtn, Seg, Sym } from './ui';
import { SEAT_LABEL, useConsole, type StageScope } from './runtime';
import { activeLeaf, groupOf, isParent, navLeaves, SEAT_NAV, type NavGroup, type NavItem, type NavParent } from './nav';
import { useConsoleUpdates } from './updates';
import { SEAT_EXTRAS } from './seats/extras';

/* ---------------------------------------------------------------- sidebar */

function Badge({ k }: { k: string }) {
  const { badges } = useConsole();
  const b = badges[k];
  if (!b) return null;
  return <span className={'bd' + (b.tone ? ' ' + b.tone : '')}>{b.n}</span>;
}

function hasHot(g: NavGroup, badges: ReturnType<typeof useConsole>['badges']): boolean {
  const keys = g.items.flatMap((x) => (isParent(x) ? [x.key, ...x.kids.map((k) => k.key)] : [x.key]));
  return keys.some((k) => badges[k]?.tone === 'hot');
}

function Leaf({ item, active, onGo }: { item: NavItem; active: boolean; onGo: (href: string) => void }) {
  const { seat } = useConsole();
  const Extra = SEAT_EXTRAS[seat]?.[item.key];
  const [open, setOpen] = useState(true);
  return (
    <>
      <div className="mx-si">
        <button type="button" className={'si' + (active ? ' on' : '')} aria-current={active ? 'page' : undefined} onClick={() => onGo(item.href)}>
          <Icon name={item.icon} />
          {item.label}
          <Badge k={item.key} />
        </button>
        {Extra ? (
          <button type="button" className="mx-fold" aria-label={(open ? 'Fold ' : 'Unfold ') + item.label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <Icon name="down" />
          </button>
        ) : null}
      </div>
      {Extra && open ? <Extra /> : null}
    </>
  );
}

function Parent({ item, activeKey, onGo }: { item: NavParent; activeKey?: string; onGo: (href: string) => void }) {
  const childOn = item.kids.some((k) => k.key === activeKey);
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" className={'si' + (childOn ? ' child-on' : '')} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name={item.icon} />
        {item.label}
        <Badge k={item.key} />
        <svg className="chev" aria-hidden="true">
          <use href="#i-down" />
        </svg>
      </button>
      {open ? (
        <div className="sub">
          {item.kids.map((k) => (
            <button key={k.key} type="button" className={k.key === activeKey ? 'on' : ''} aria-current={k.key === activeKey ? 'page' : undefined} onClick={() => onGo(k.href)}>
              {k.label}
              <Badge k={k.key} />
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

function Sidebar({ groups, activeKey }: { groups: NavGroup[]; activeKey?: string }) {
  const { seat, me, go, badges } = useConsole();
  const { engagements } = useApp();
  const current = groupOf(groups, activeKey) ?? groups[0]!;
  const [preview, setPreview] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const t = useRef(0);
  const shown = groups.find((g) => g.label === preview) ?? current;
  const MiniCal = SEAT_EXTRAS[seat]?.['@mini'];

  const close = (now?: boolean) => {
    window.clearTimeout(t.current);
    t.current = window.setTimeout(
      () => {
        setOpen(false);
        setPreview(null);
      },
      now ? 0 : 220,
    );
  };
  useEffect(() => () => window.clearTimeout(t.current), []);
  const onGo = (href: string) => {
    close(true);
    go(href);
  };
  const clients = engagements.length;
  const leads = useMemo(() => new Set(engagements.flatMap((e) => e.leadIds ?? (e.internId ? [e.internId] : []))).size, [engagements]);

  return (
    <aside
      className={'side mx-side' + (open ? ' gx-open' : '')}
      aria-label={`${SEAT_LABEL[seat]} sections`}
      onMouseEnter={() => {
        window.clearTimeout(t.current);
        setOpen(true);
      }}
      onMouseLeave={() => close()}
      onFocus={(e) => {
        if ((e.target as HTMLElement).matches(':focus-visible')) {
          window.clearTimeout(t.current);
          setOpen(true);
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close(true);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          close(true);
          (document.activeElement as HTMLElement | null)?.blur();
        }
      }}
    >
      <div className="gx-rail">
        <div className="gx-mark" title="VCFO Suite">
          <Sym id="logo" width={30} height={28} />
        </div>
        <nav className="gx-ri" aria-label="Sections">
          {groups.map((g) => (
            <button
              key={g.label}
              type="button"
              className={'gx-rbtn' + (g === current ? ' on' : '') + (g === shown && g !== current ? ' pv' : '')}
              aria-label={g.label}
              aria-current={g === current ? 'true' : undefined}
              onMouseEnter={() => setPreview(g.label)}
              onFocus={() => setPreview(g.label)}
              onClick={() => {
                const first = navLeaves([g])[0];
                if (g === current) {
                  setPreview(null);
                  setOpen(true);
                  return;
                }
                if (first) onGo(first.href);
              }}
            >
              <Icon name={g.icon} />
              <span className="gx-tip">{g.label}</span>
              {hasHot(g, badges) ? <i className="gx-hot" /> : null}
            </button>
          ))}
        </nav>
        <div className="gx-rb">
          <span className="gx-me" title={me ? `${me.name} · ${SEAT_LABEL[seat]}` : undefined}>
            {me?.initials ?? '··'}
          </span>
        </div>
      </div>
      <div className="gx-ctx">
        <div className="logo">
          <div>
            <b>
              VCFO <span>Suite</span>
            </b>
            <small>{SEAT_LABEL[seat].toUpperCase()}</small>
          </div>
        </div>
        <div className="gx-ch">
          <span className="gx-seat">{SEAT_LABEL[seat]}</span>
          <b>{shown.label}</b>
        </div>
        <nav className="snav mx-snav" aria-label={shown.label}>
          {shown.items.map((x) =>
            isParent(x) ? <Parent key={x.key} item={x} activeKey={activeKey} onGo={onGo} /> : <Leaf key={x.key} item={x} active={x.key === activeKey} onGo={onGo} />,
          )}
        </nav>
        {MiniCal ? (
          <div className="mx-mini">
            <MiniCal />
          </div>
        ) : null}
        <div className="sfoot">
          <div className="lbl">SBC · {SEAT_LABEL[seat].toUpperCase()}</div>
          {me ? (
            <div className="who">
              <span className="av" style={{ background: 'linear-gradient(140deg,#0ea5e9,#8b5cf6)' }}>
                {me.initials}
              </span>
              <div>
                <b>{me.name}</b>
                <span>
                  {seat === 'mgr' ? `${leads} lead${leads === 1 ? '' : 's'} · ${clients} client${clients === 1 ? '' : 's'}` : SEAT_LABEL[seat]}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

/* ---------------------------------------------------------------- top bar */

function AccountButton() {
  const { me, seat } = useConsole();
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
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  if (!me) return null;
  return (
    <>
      <button ref={btn} type="button" className="ib acct-b" aria-label={`Account · ${me.name}`} title={`${me.name} · ${SEAT_LABEL[seat]}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {me.initials}
      </button>
      {open ? (
        <div ref={menu} className="acct-menu" role="menu" aria-label="Account" style={pos ?? { visibility: 'hidden' }}>
          <div className="acct-who">
            <span className="acct-av">{me.initials}</span>
            <div>
              <b>{me.name}</b>
              <span>{me.email}</span>
              <em>{SEAT_LABEL[seat]}</em>
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

const SCOPES: Array<{ value: StageScope; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'inc', label: 'Incorporating' },
  { value: 'cmp', label: 'Compliance' },
];

function TopBar({ leaf, pathname }: { leaf?: NavItem; pathname: string }) {
  const { me, crumbs, scope, setScope, theme, setTheme, openSearch, seat } = useConsole();
  const updates = useConsoleUpdates();
  const own = crumbs.path === pathname && crumbs.trail.length ? crumbs.trail : null;
  const trail = own ?? (leaf ? [leaf.label] : []);
  return (
    <header className="top mx-top">
      <div className="crumb">
        <span className="co">{me?.name.split(/\s+/)[0] ?? SEAT_LABEL[seat]}</span>
        {trail.map((c, i) => (
          <span key={`${i}-${c}`} style={{ display: 'contents' }}>
            <span>/</span>
            {i === trail.length - 1 ? <b>{c}</b> : <span>{c}</span>}
          </span>
        ))}
      </div>
      <span className="sp" />
      {seat !== 'dev' ? (
        <div className="mx-stage">
          <span className="mx-sw-l">Stage</span>
          <Seg options={SCOPES} value={scope} onChange={setScope} ariaLabel="Show clients by stage" />
        </div>
      ) : null}
      <button type="button" className="search" onClick={openSearch}>
        <Icon name="search" />
        <span>Search</span>
        <kbd>Ctrl K</kbd>
      </button>
      <IconBtn ico="mega" label="Announcements" count={updates.annUnread} onClick={(e) => updates.openAnns(e.currentTarget)} />
      <IconBtn ico="bell" label="Notifications" count={updates.unread} onClick={(e) => updates.openNotes(e.currentTarget)} />
      <IconBtn ico={theme === 'light' ? 'moon' : 'sun'} label="Switch theme" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} />
      <AccountButton />
    </header>
  );
}

function MobileNav({ groups, activeKey }: { groups: NavGroup[]; activeKey?: string }) {
  const { go } = useConsole();
  return (
    <nav className="mobile-nav" aria-label="Pages">
      {navLeaves(groups).map((k) => (
        <button key={k.key} type="button" className={k.key === activeKey ? 'on' : ''} onClick={() => go(k.href)}>
          {k.label}
        </button>
      ))}
    </nav>
  );
}

/* ---------------------------------------------------------------- page */

export function Frame({ children }: { children: ReactNode }) {
  const { seat } = useConsole();
  const pathname = usePathname() ?? '';
  const groups = SEAT_NAV[seat] ?? [];
  const leaf = activeLeaf(groups, pathname);
  return (
    <div className="app mgr" id="app-mgr">
      <Sidebar groups={groups} activeKey={leaf?.key} />
      <div className="main mx-main">
        <TopBar leaf={leaf} pathname={pathname} />
        <MobileNav groups={groups} activeKey={leaf?.key} />
        <div key={pathname} className="mx-view in">
          {children}
        </div>
      </div>
    </div>
  );
}
