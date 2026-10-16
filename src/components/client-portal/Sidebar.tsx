'use client';

/**
 * The navy sidebar — React port of prototype shell.js.
 *   desktop ≥1280: full 248 px sidebar · tablet 768–1279: 72 px icon rail with
 *   tooltips and fly-outs · phone ≤767: a drawer opened from the top bar.
 * The active pill + 3 px rail slide from where they were on the last screen
 * (sessionStorage) with the shell spring.
 */
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Lu, ShellIcon, type LuName } from './icons';
import { usePortal } from './PortalProvider';
import { activeKeyFor, portalHref, PORTAL_TITLES, type PortalRouteKey } from './routes';
import type { ClientPortalContact } from '@/lib/client-portal/types';

type Bp = 'phone' | 'tablet' | 'desktop';

export function bpOf(w: number): Bp {
  return w <= 767 ? 'phone' : w < 1280 ? 'tablet' : 'desktop';
}

export function useBreakpoint(): Bp {
  const [bp, setBp] = useState<Bp>('desktop');
  useEffect(() => {
    const on = () => setBp(bpOf(window.innerWidth));
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return bp;
}

interface NavLeaf {
  k: PortalRouteKey;
  t: string;
  badge?: string;
  hot?: boolean;
}
interface NavItem extends Partial<NavLeaf> {
  g?: string;
  t: string;
  i: LuName;
  kids?: NavLeaf[];
}

function useNav(): NavItem[] {
  const { shell } = usePortal();
  const unread = shell?.badges.notifications ?? 0;
  const inc = shell ? `${shell.badges.spiceDone}/${shell.badges.spiceTotal}` : undefined;
  const docs = shell?.badges.documents ?? 0;
  return [
    { k: 'home', t: 'Home', i: 'layout-dashboard' },
    {
      g: 'updates',
      t: 'Updates',
      i: 'megaphone',
      badge: unread ? String(unread) : undefined,
      hot: unread > 0,
      kids: [
        { k: 'announcements', t: 'Announcements' },
        { k: 'notifications', t: 'Notifications', badge: unread ? String(unread) : undefined, hot: unread > 0 },
      ],
    },
    { k: 'incorporation', t: 'Incorporation', i: 'building-2', badge: inc },
    {
      g: 'compliances',
      t: 'Compliances',
      i: 'calendar-check',
      kids: [
        { k: 'compliances', t: 'Calendar' },
        { k: 'filings', t: 'Filings' },
      ],
    },
    { k: 'documents', t: 'Documents', i: 'folder-open', badge: docs ? String(docs) : undefined },
    { k: 'knowledge-bank', t: 'Library', i: 'library' },
    { k: 'credentials', t: 'Credentials', i: 'key-round' },
    { k: 'team', t: 'Team', i: 'users' },
    { k: 'audit', t: 'Audit', i: 'history' },
    { k: 'settings', t: 'Settings', i: 'settings' },
  ];
}

function Badge({ b, hot }: { b?: string; hot?: boolean }) {
  if (!b) return null;
  return <span className={`vps-b${hot ? ' hot' : ''}`}>{b}</span>;
}

const VERB = { wa: 'WhatsApp', call: 'Call', mail: 'Email', teams: 'Teams' } as const;
type Channel = keyof typeof VERB;

function channelsFor(p: ClientPortalContact): Channel[] {
  return p.support ? ['wa', 'mail', 'teams', 'call'] : ['wa', 'call', 'mail', 'teams'];
}

/** Real deep links: wa.me, tel:, mailto:, Teams chat. */
function contactUrl(p: ClientPortalContact, c: Channel): string | null {
  const digits = (s?: string) => (s ? s.replace(/[^\d]/g, '') : '');
  if (c === 'wa') return p.whatsappE164 ? `https://wa.me/${digits(p.whatsappE164)}` : null;
  if (c === 'call') return p.phoneE164 ? `tel:${p.phoneE164.replace(/[^\d+]/g, '')}` : null;
  if (c === 'mail') return p.email ? `mailto:${p.email}` : null;
  if (c === 'teams') return p.email ? `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(p.email)}` : null;
  return null;
}

function useContact() {
  const { toast } = usePortal();
  return useCallback(
    (p: ClientPortalContact, c: Channel) => {
      const who = p.support ? 'support' : p.name;
      const url = contactUrl(p, c);
      if (!url) {
        toast(`${VERB[c]} is not set up for ${who} yet`);
        return;
      }
      toast(`Opening ${VERB[c]} ${who}…`);
      if (url.startsWith('http')) window.open(url, '_blank', 'noopener');
      else window.location.href = url;
    },
    [toast],
  );
}

function ContactBtn({ p, c, fly }: { p: ClientPortalContact; c: Channel; fly?: boolean }) {
  const contact = useContact();
  const who = p.support ? 'support' : p.name;
  return (
    <button
      type="button"
      className={`${c}${fly ? ' vps-fi' : ''}`}
      role={fly ? 'menuitem' : undefined}
      aria-label={`${VERB[c]} ${who}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        contact(p, c);
      }}
    >
      <ShellIcon name={c} size={fly ? 16 : 14} />
      {fly ? <span className="vps-ft">{VERB[c]}</span> : null}
    </button>
  );
}

function Avatar({ p }: { p: ClientPortalContact }) {
  return <span className="vps-av">{p.support ? <ShellIcon name="head" size={14} /> : p.initials}</span>;
}

/** Before | After pill — horizontal in the top bar and drawer, vertical in the rail. */
export function BeforeAfterPill({ vertical }: { vertical?: boolean }) {
  const { after, setAfter } = usePortal();
  return (
    <div className={`vp-ba${vertical ? ' vp-ba-v' : ''}`} role="group" aria-label="Before or after incorporation" data-on={after ? 1 : 0}>
      <span className="vp-ba-th" aria-hidden="true" />
      <button type="button" data-ba="0" aria-pressed={!after} onClick={() => setAfter(false)}>
        Before
      </button>
      <button type="button" data-ba="1" aria-pressed={after} onClick={() => setAfter(true)}>
        After
      </button>
    </div>
  );
}

function readPill(mode: string): { y: number; h: number } | null {
  try {
    return JSON.parse(sessionStorage.getItem(`vcfo.pill-${mode}`) ?? 'null');
  } catch {
    return null;
  }
}

/** Active pill: slides from where it was on the last screen to the current item. */
function usePill(navRef: React.RefObject<HTMLElement | null>, mode: string, deps: unknown[]) {
  const pillRef = useRef<HTMLSpanElement>(null);
  const railRef = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  const place = useCallback(
    (animate: boolean) => {
      const nav = navRef.current;
      const pill = pillRef.current;
      const rail = railRef.current;
      if (!nav || !pill || !rail) return;
      let a = nav.querySelector<HTMLElement>('[aria-current=page]') ?? nav.querySelector<HTMLElement>('[data-cur]');
      const sub = a?.closest('.vps-sub');
      if (a && sub && !sub.classList.contains('open')) a = sub.previousElementSibling as HTMLElement | null;
      if (!a) {
        pill.style.opacity = '0';
        rail.style.opacity = '0';
        return;
      }
      const y = Math.round(a.getBoundingClientRect().top - nav.getBoundingClientRect().top + nav.scrollTop);
      const h = a.offsetHeight;
      if (!animate) pill.style.transition = rail.style.transition = 'none';
      pill.style.opacity = rail.style.opacity = '1';
      pill.style.height = `${h}px`;
      pill.style.transform = `translateY(${y}px)`;
      rail.style.transform = `translateY(${y + (h - 20) / 2}px)`;
      if (!animate) {
        void pill.offsetWidth;
        pill.style.transition = rail.style.transition = '';
      }
      try {
        sessionStorage.setItem(`vcfo.pill-${mode}`, JSON.stringify({ y, h }));
      } catch {
        /* ignore */
      }
    },
    [navRef, mode],
  );
  useLayoutEffect(() => {
    const pill = pillRef.current;
    const rail = railRef.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (first.current && pill && rail) {
      first.current = false;
      const prev = readPill(mode);
      if (prev && !reduce) {
        pill.style.transition = rail.style.transition = 'none';
        pill.style.height = `${prev.h}px`;
        pill.style.transform = `translateY(${prev.y}px)`;
        rail.style.transform = `translateY(${prev.y + (prev.h - 20) / 2}px)`;
        void pill.offsetWidth;
        pill.style.transition = rail.style.transition = '';
        requestAnimationFrame(() => requestAnimationFrame(() => place(true)));
        return;
      }
      place(false);
      return;
    }
    place(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    const on = () => place(false);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [place]);
  return { pillRef, railRef, place };
}

function SidebarFull({ drawer }: { drawer?: boolean }) {
  const pathname = usePathname();
  const act = activeKeyFor(pathname);
  const nav = useNav();
  const { shell, prefs, savePrefs, toast, go, setDrawerOpen } = usePortal();
  const navRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => setOpen(prefs?.navOpen ?? {}), [prefs?.navOpen]);
  const { pillRef, railRef, place } = usePill(navRef, drawer ? 'drawer' : 'full', [act, JSON.stringify(open)]);

  const isOpen = (n: NavItem) => {
    const has = n.kids?.some((c) => c.k === act) ?? false;
    return open[n.g!] === undefined ? has : open[n.g!]!;
  };
  const toggleGroup = (g: string, value: boolean) => {
    const next = { ...open, [g]: value };
    setOpen(next);
    savePrefs({ navOpen: next });
    let steps = 0;
    const follow = () => {
      place(true);
      if (++steps < 20) requestAnimationFrame(follow);
    };
    follow();
  };
  const onLeaf = (e: React.MouseEvent, k: PortalRouteKey, label: string) => {
    e.preventDefault();
    if (k === act && k !== 'home') {
      toast(`You are already on ${label}`);
      return;
    }
    go(k);
  };

  const company = shell?.companyShort ?? '';
  const team = shell?.team ?? [];
  const me = shell?.me;

  return (
    <>
      {drawer ? (
        <>
          <div className="vps-hd">
            <LogoLink />
            <button type="button" className="vps-x" aria-label="Close menu" onClick={() => setDrawerOpen(false)} data-close>
              <ShellIcon name="x" size={18} />
            </button>
          </div>
          <div className="vp-ba-drawer">
            <BeforeAfterPill />
          </div>
        </>
      ) : (
        <LogoLink />
      )}
      <nav className="vps-nav" aria-label="Main" ref={navRef}>
        <span className="vps-pill" aria-hidden="true" ref={pillRef} />
        <span className="vps-rail" aria-hidden="true" ref={railRef} />
        {nav.map((n) => {
          if (n.kids) {
            const o = isOpen(n);
            const has = n.kids.some((c) => c.k === act);
            return (
              <Fragment key={n.g}>
                <button
                  type="button"
                  className="vps-i vps-g"
                  data-group={n.g}
                  aria-expanded={o}
                  data-holds={has && !o ? '1' : undefined}
                  onClick={() => toggleGroup(n.g!, !o)}
                >
                  <span className="vps-ic">
                    <Lu name={n.i} />
                  </span>
                  <span className="vps-t">{n.t}</span>
                  <Badge b={n.badge} hot={n.hot} />
                  <span className="vps-cv">
                    <ShellIcon name="chev" size={14} />
                  </span>
                </button>
                <div className={`vps-sub${o ? ' open' : ''}`} data-sub={n.g}>
                  <div inert={!o ? true : undefined}>
                    {n.kids.map((c) => (
                      <a
                        key={c.k}
                        href={portalHref(c.k)}
                        className="vps-i"
                        aria-current={c.k === act ? 'page' : undefined}
                        tabIndex={o ? undefined : -1}
                        onClick={(e) => onLeaf(e, c.k, c.t)}
                      >
                        <span className="vps-t">{c.t}</span>
                        <Badge b={c.badge} hot={c.hot} />
                      </a>
                    ))}
                  </div>
                </div>
              </Fragment>
            );
          }
          return (
            <a
              key={n.k}
              href={portalHref(n.k!)}
              className="vps-i"
              aria-current={n.k === act ? 'page' : undefined}
              onClick={(e) => onLeaf(e, n.k!, n.t)}
            >
              <span className="vps-ic">
                <Lu name={n.i} />
              </span>
              <span className="vps-t">{n.t}</span>
              <Badge b={n.badge} />
            </a>
          );
        })}
      </nav>
      <div className="vps-team">
        <div className="vps-lbl">{company ? `${company}’s team` : 'Your team'}</div>
        {team.map((p) => (
          <div
            key={p.id}
            className="vps-p"
            tabIndex={drawer ? undefined : 0}
            role={drawer ? undefined : 'group'}
            aria-label={drawer ? undefined : `${p.name}, ${p.role} · contact`}
          >
            <Avatar p={p} />
            <span className="vps-nm">
              <b>{p.name}</b> <small>{drawer ? '' : '· '}{p.role}</small>
            </span>
            <span className="vps-c">
              {channelsFor(p).map((c) => (
                <ContactBtn key={c} p={p} c={c} />
              ))}
            </span>
          </div>
        ))}
      </div>
      <div className="vps-me">
        <div className="vps-mest">
          <span className="vps-a">{me?.initials ?? ''}</span>
          <span className="vps-nm">
            <b>{me?.name ?? ''}</b>
            <small>{me?.roleLabel ?? ''}</small>
          </span>
          <SignOutBtn />
        </div>
      </div>
    </>
  );
}

function LogoLink({ rail }: { rail?: boolean }) {
  const { go } = usePortal();
  return (
    <a
      className="vps-logo"
      href={portalHref('home')}
      aria-label="VCFO Suite · Home"
      data-tip={rail ? 'VCFO Suite · Home' : undefined}
      onClick={(e) => {
        e.preventDefault();
        go('home');
      }}
    >
      {rail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/client-portal/vcfo-mark.webp" alt="VCFO Suite" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/client-portal/vcfo-logo-on-black.webp" alt="VCFO Suite by SBC" height={34} />
      )}
    </a>
  );
}

function SignOutBtn() {
  const { toast } = usePortal();
  return (
    <button
      type="button"
      className="vps-out"
      aria-label="Sign out"
      data-tip="Sign out"
      onClick={() => {
        toast('Signing out…');
        void signOut({ callbackUrl: '/login' });
      }}
    >
      <ShellIcon name="out" size={16} />
    </button>
  );
}

/** Tablet: 72 px icon rail; groups, people and the account open a fly-out; every icon has a tooltip. */
function SidebarRail() {
  const pathname = usePathname();
  const act = activeKeyFor(pathname);
  const nav = useNav();
  const { shell, go, toast } = usePortal();
  const rootRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const { pillRef, railRef } = usePill(navRef, 'rail', [act]);
  const [fly, setFly] = useState<{ key: string; top: number; left: number } | null>(null);
  const flyRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ text: string; top: number; left: number } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const flyBtn = useRef<HTMLElement | null>(null);

  const closeFly = useCallback((focus?: boolean) => {
    const b = flyBtn.current;
    flyBtn.current = null;
    setFly(null);
    if (focus) b?.focus({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    if (!fly || !flyRef.current || !flyBtn.current || !rootRef.current) return;
    const r = flyBtn.current.getBoundingClientRect();
    const sr = rootRef.current.getBoundingClientRect();
    const fh = flyRef.current.offsetHeight;
    const top = fly.key === 'me' ? r.bottom - fh : r.top - 6;
    const next = { left: Math.round(sr.right + 8), top: Math.round(Math.max(8, Math.min(window.innerHeight - fh - 8, top))) };
    if (next.left !== fly.left || next.top !== fly.top) setFly({ ...fly, ...next });
  }, [fly]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) closeFly();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && flyBtn.current) closeFly(true);
    };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [closeFly]);

  const openFly = (e: React.MouseEvent<HTMLElement>, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    const btn = e.currentTarget;
    if (flyBtn.current === btn) {
      closeFly(e.detail === 0);
      return;
    }
    setTip(null);
    flyBtn.current = btn;
    const r = btn.getBoundingClientRect();
    setFly({ key, top: r.top - 6, left: Math.round((rootRef.current?.getBoundingClientRect().right ?? 72) + 8) });
  };

  const showTip = (el: HTMLElement | null) => {
    if (!el || el === flyBtn.current || !rootRef.current) {
      setTip(null);
      return;
    }
    const text = el.getAttribute('data-tip');
    if (!text) {
      setTip(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const sr = rootRef.current.getBoundingClientRect();
    const h = tipRef.current?.offsetHeight ?? 28;
    setTip({ text, left: Math.round(sr.right + 8), top: Math.round(Math.max(4, Math.min(window.innerHeight - h - 4, r.top + r.height / 2 - h / 2))) });
  };

  const team = shell?.team ?? [];
  const me = shell?.me;
  const incBadge = shell ? `${shell.badges.spiceDone}/${shell.badges.spiceTotal}` : '';

  let flyBody: ReactNode = null;
  if (fly) {
    if (fly.key.startsWith('g:')) {
      const n = nav.find((x) => x.g === fly.key.slice(2));
      flyBody = (
        <>
          <div className="vps-fh">{n?.t}</div>
          {n?.kids?.map((c) => (
            <a
              key={c.k}
              href={portalHref(c.k)}
              className="vps-fi"
              role="menuitem"
              aria-current={c.k === act ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                closeFly();
                if (c.k === act) toast(`You are already on ${c.t}`);
                else go(c.k);
              }}
            >
              <span className="vps-ft">{c.t}</span>
              <Badge b={c.badge} hot={c.hot} />
            </a>
          ))}
        </>
      );
    } else if (fly.key.startsWith('p:')) {
      const p = team[Number(fly.key.slice(2))];
      if (p)
        flyBody = (
          <>
            <div className="vps-fh who">
              {p.name}
              <small>{p.role}</small>
            </div>
            {channelsFor(p).map((c) => (
              <ContactBtn key={c} p={p} c={c} fly />
            ))}
          </>
        );
    }
  }

  return (
    <aside
      id="vp-side"
      className="vps vps-icons"
      data-mode="rail"
      aria-label="Sidebar"
      ref={rootRef}
      onMouseOver={(e) => {
        const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
        if (el && !el.closest('.vps-fly')) showTip(el);
        else setTip(null);
      }}
      onMouseLeave={() => setTip(null)}
      onFocus={(e) => {
        const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
        let fv = false;
        try {
          fv = (e.target as HTMLElement).matches(':focus-visible');
        } catch {
          /* old browsers */
        }
        if (el && fv && !el.closest('.vps-fly')) showTip(el);
      }}
      onBlur={() => setTip(null)}
      onScroll={() => {
        setTip(null);
        closeFly();
      }}
      onPointerDown={() => setTip(null)}
    >
      <LogoLink rail />
      <nav className="vps-nav" aria-label="Main" ref={navRef}>
        <span className="vps-pill" aria-hidden="true" ref={pillRef} />
        <span className="vps-rail" aria-hidden="true" ref={railRef} />
        {nav.map((n) => {
          if (n.kids) {
            const has = n.kids.some((c) => c.k === act);
            return (
              <button
                key={n.g}
                type="button"
                className="vps-i vps-g"
                aria-haspopup="true"
                aria-expanded={fly?.key === `g:${n.g}`}
                data-cur={has ? '1' : undefined}
                data-tip={`${n.t}${n.badge ? ` · ${n.badge} new` : ''}`}
                onClick={(e) => openFly(e, `g:${n.g}`)}
              >
                <span className="vps-ic">
                  <Lu name={n.i} size={20} />
                </span>
                <span className="vps-t">{n.t}</span>
                <Badge b={n.badge} hot={n.hot} />
              </button>
            );
          }
          const isInc = n.k === 'incorporation';
          return (
            <a
              key={n.k}
              href={portalHref(n.k!)}
              className="vps-i"
              aria-current={n.k === act ? 'page' : undefined}
              data-tip={`${n.t}${isInc ? ` · ${incBadge} steps` : n.badge ? ` · ${n.badge}` : ''}`}
              onClick={(e) => {
                e.preventDefault();
                closeFly();
                if (n.k === act && n.k !== 'home') toast(`You are already on ${PORTAL_TITLES[n.k!]}`);
                else go(n.k!);
              }}
            >
              <span className="vps-ic">
                <Lu name={n.i} size={20} />
              </span>
              <span className="vps-t">
                {n.t}
                {isInc ? ` · ${incBadge} steps` : ''}
              </span>
              {n.badge && !isInc ? <Badge b={n.badge} /> : null}
            </a>
          );
        })}
      </nav>
      <div className="vps-bar" data-tip="Show the company before or after incorporation">
        <BeforeAfterPill vertical />
      </div>
      <div className="vps-team">
        <div className="vps-lbl" aria-hidden="true">
          Team
        </div>
        {team.map((p, i) => (
          <button
            key={p.id}
            type="button"
            className="vps-i vps-pa"
            aria-haspopup="true"
            aria-expanded={fly?.key === `p:${i}`}
            aria-label={`${p.name}, ${p.role} · contact`}
            data-tip={`${p.name} · ${p.role}`}
            onClick={(e) => openFly(e, `p:${i}`)}
          >
            <Avatar p={p} />
          </button>
        ))}
      </div>
      <div className="vps-me">
        <div className="vps-mest vps-mest-rail">
          <span className="vps-a" role="img" aria-label={`${me?.name ?? ''}, ${me?.roleLabel ?? ''}`} data-tip={`${me?.name ?? ''} · ${me?.roleLabel ?? ''}`}>
            {me?.initials ?? ''}
          </span>
          <SignOutBtn />
        </div>
      </div>
      <div className="vps-fly" role="menu" hidden={!fly} ref={flyRef} style={fly ? { top: fly.top, left: fly.left } : undefined}>
        {flyBody}
      </div>
      <div className={`vps-tip${tip ? ' on' : ''}`} aria-hidden="true" ref={tipRef} style={tip ? { top: tip.top, left: tip.left } : undefined}>
        {tip?.text}
      </div>
    </aside>
  );
}

/** Phone drawer (also any size via the top-bar menu button). */
function Drawer() {
  const { drawerOpen, setDrawerOpen } = usePortal();
  const ref = useRef<HTMLElement>(null);
  const last = useRef<Element | null>(null);
  useEffect(() => {
    if (drawerOpen) {
      last.current = document.activeElement;
      requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('[data-close]')?.focus({ preventScroll: true }));
    } else {
      (last.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    }
  }, [drawerOpen]);
  useEffect(() => {
    if (!drawerOpen) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
      else if (e.key === 'Tab' && ref.current) {
        const f = Array.from(ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(
          (x) => x.getAttribute('tabindex') !== '-1' && x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden',
        );
        if (!f.length) return;
        const first = f[0]!;
        const lastEl = f[f.length - 1]!;
        const a = document.activeElement;
        if (e.shiftKey && (a === first || !ref.current.contains(a))) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && (a === lastEl || !ref.current.contains(a))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [drawerOpen, setDrawerOpen]);
  return (
    <>
      <div id="vp-drawer-scrim" className={drawerOpen ? 'on' : undefined} onClick={() => setDrawerOpen(false)} />
      <aside
        id="vp-drawer"
        ref={ref}
        className={`vps${drawerOpen ? ' on' : ''}`}
        aria-label="Menu"
        role="dialog"
        aria-modal="true"
        aria-hidden={!drawerOpen}
        inert={!drawerOpen ? true : undefined}
      >
        {drawerOpen ? <SidebarFull drawer /> : null}
      </aside>
    </>
  );
}

export function PortalSidebar() {
  const bp = useBreakpoint();
  return (
    <>
      {bp === 'desktop' ? (
        <aside id="vp-side" className="vps" data-mode="full" aria-label="Sidebar">
          <SidebarFull />
        </aside>
      ) : bp === 'tablet' ? (
        <SidebarRail />
      ) : null}
      <Drawer />
    </>
  );
}
