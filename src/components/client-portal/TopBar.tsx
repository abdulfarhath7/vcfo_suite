'use client';

/**
 * Top bar — prototype s/team/topbar.dc.html: logo · location trail · Search ⌘K ·
 * Before/After pill (desktop) · Announcements · Notifications · Theme.
 * No profile and no Ask VCFO button in the top bar (design rule 2).
 */
import { Fragment, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { usePortal } from './PortalProvider';
import { crumbsFor, activeKeyFor } from './routes';
import { BeforeAfterPill, useBreakpoint } from './Sidebar';

export function PortalTopBar({ onSearch, hasAnnouncements }: { onSearch: () => void; hasAnnouncements: boolean }) {
  const pathname = usePathname();
  const { shell, go, theme, toggleTheme, setDrawerOpen, crumbs } = usePortal();
  const bp = useBreakpoint();
  const { mid, crumb } = crumbsFor(pathname);
  const act = activeKeyFor(pathname);
  const notif = shell?.badges.notifications ?? 0;
  const on = { background: 'var(--primary-light)', color: 'var(--primary)' };
  const off = { background: 'transparent', color: 'var(--muted)' };
  const themeLabel = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onSearch();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onSearch]);

  return (
    <div className="cp-top" data-vp="top">
      <header className="tbar">
        <span className="tbar-mw">
          <button type="button" className="tbar-menu" data-vp-menu="" aria-label="Open menu" onClick={() => setDrawerOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16 M4 12h16 M4 18h16" />
            </svg>
          </button>
          {/* the VCFO mark next to the hamburger on phones (shell.js mobileLogo) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="vp-mlogo" src="/client-portal/vcfo-mark.webp" alt="VCFO Suite" />
        </span>
        <a
          href="#"
          aria-label="SBC home"
          className="tbar-logo"
          data-tip-below=""
          onClick={(e) => {
            e.preventDefault();
            go('home');
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/client-portal/sbc-logo-top.webp" alt="SBC" style={{ height: 26, width: 'auto' }} />
        </a>
        <nav aria-label="Location" className="tbar-nav">
          <span className="tbar-ic">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4.5 4.5h6v7h-6Z M13.5 4.5h6v4h-6Z M13.5 12.5h6v7h-6Z M4.5 15.5h6v4h-6Z" />
            </svg>
          </span>
          <ol className="tbar-ol">
            {crumbs && crumbs.length ? (
              <>
                <li className="tbar-pre tbar-mid" style={{ color: 'var(--muted)', fontWeight: 500 }}>
                  Home
                </li>
                {crumbs.slice(0, -1).map((c, i) => (
                  <Fragment key={`${c}-${i}`}>
                    <li aria-hidden="true" className="tbar-pre tbar-mid" style={{ color: 'var(--subtle)' }}>
                      /
                    </li>
                    <li className="tbar-mid" style={{ color: 'var(--muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 28 }}>
                      {c}
                    </li>
                  </Fragment>
                ))}
                <li aria-hidden="true" className={crumbs.length > 1 ? 'tbar-mid' : 'tbar-pre tbar-mid'} style={{ color: 'var(--subtle)' }}>
                  /
                </li>
                <li aria-current="page" className="tbar-cur" style={{ minWidth: 48 }}>
                  {crumbs[crumbs.length - 1]}
                </li>
              </>
            ) : (
              <>
            {act !== 'home' ? (
              <li className="tbar-pre tbar-mid" style={{ color: 'var(--muted)', fontWeight: 500 }}>
                Home
              </li>
            ) : null}
            {mid ? (
              <>
                <li aria-hidden="true" className="tbar-pre tbar-mid" style={{ color: 'var(--subtle)' }}>
                  /
                </li>
                <li className="tbar-mid" style={{ color: 'var(--muted)', fontWeight: 500 }}>
                  {mid}
                </li>
              </>
            ) : null}
            {act !== 'home' ? (
              <li aria-hidden="true" className={mid ? 'tbar-mid' : 'tbar-pre tbar-mid'} style={{ color: 'var(--subtle)' }}>
                /
              </li>
            ) : null}
            <li aria-current="page" className="tbar-cur">
              {crumb}
            </li>
              </>
            )}
          </ol>
        </nav>
        <div className="tbar-r">
          {bp === 'desktop' ? (
            <div id="vp-ba-top" className="vp-ba-slot">
              <BeforeAfterPill />
            </div>
          ) : null}
          <button type="button" className="tbar-srch" aria-label="Search (⌘K)" data-tip-below="" onClick={onSearch}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ flex: 'none', color: 'oklch(54.6% 0.215 263 / .8)' }}>
              <path d="M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M16 16l4 4" />
            </svg>
            <span className="tbar-sl">Search</span>
            <span className="kbd">⌘</span>
            <span className="kbd">K</span>
          </button>
          <button
            type="button"
            className="tbar-ib"
            aria-label="Announcements"
            style={act === 'announcements' ? on : off}
            data-tip-below=""
            onClick={() => go('announcements')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path className="duo" d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
              <path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14 M8 6v8" />
            </svg>
            {hasAnnouncements && act !== 'announcements' ? (
              <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 99, background: 'var(--gold)', boxShadow: '0 0 0 2px var(--panel)' }} />
            ) : null}
          </button>
          <button
            type="button"
            className="tbar-ib"
            aria-label={notif ? `Notifications, ${notif} unread` : 'Notifications'}
            style={act === 'notifications' ? on : off}
            data-tip-below=""
            onClick={() => go('notifications')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path className="duo" d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
              <path d="M10.268 21a2 2 0 0 0 3.464 0 M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
            </svg>
            {notif > 0 ? <span className="tbar-badge">{notif}</span> : null}
          </button>
          <button
            type="button"
            className="tbar-ib tbar-theme"
            aria-label={themeLabel}
            aria-pressed={theme === 'dark'}
            data-tip={themeLabel}
            data-tip-below=""
            style={{ border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--muted)' }}
            onClick={toggleTheme}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7Z M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6 7 7 M17 17l1.4 1.4 M5.6 18.4 7 17 M17 7l1.4-1.4" />
            </svg>
          </button>
        </div>
      </header>
    </div>
  );
}
