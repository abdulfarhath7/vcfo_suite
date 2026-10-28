'use client';

/**
 * Search ⌘K — prototype: "Search · type to find steps, filings and documents".
 * Finds pages, incorporation steps (the client-visible catalog) and, through
 * /api/client/portal/search, the client's own documents and filings.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getActiveCatalogItems } from '@/data/checklist';
import { PORTAL_PATHS, PORTAL_TITLES, stepHref, type PortalRouteKey } from './routes';
import { useBreakpoint } from './Sidebar';
import { SHELL_PATHS } from './icons';

/** Phone result-row glyph per group (shell icon set). */
const GROUP_ICON: Record<Hit['group'], keyof typeof SHELL_PATHS> = { Pages: 'home', Steps: 'inc', Documents: 'docs', Filings: 'comp' };
const PAGE_ICON: Partial<Record<PortalRouteKey, keyof typeof SHELL_PATHS>> = {
  announcements: 'updates',
  notifications: 'updates',
  incorporation: 'inc',
  'board-resolution': 'inc',
  compliances: 'comp',
  filings: 'comp',
  documents: 'docs',
  'knowledge-bank': 'lib',
  credentials: 'person',
  team: 'team',
  audit: 'audit',
  settings: 'gear',
};
const GROUP_SUB: Record<Hit['group'], string> = { Pages: 'Page', Steps: 'Incorporation', Documents: 'Document', Filings: 'Filing' };

interface Hit {
  group: 'Pages' | 'Steps' | 'Documents' | 'Filings';
  title: string;
  meta?: string;
  href: string;
  icon?: keyof typeof SHELL_PATHS;
}

const PAGE_KEYS = Object.keys(PORTAL_PATHS) as PortalRouteKey[];

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const phone = useBreakpoint() === 'phone';
  /* phone: the search is a bottom sheet; like the prototype's sheets it sends the launcher away (sheet-open) */
  useEffect(() => {
    if (!open || !phone) return;
    const cp = document.querySelector('.cp');
    cp?.classList.add('sheet-open');
    return () => cp?.classList.remove('sheet-open');
  }, [open, phone]);
  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const remote = useQuery({
    queryKey: ['client-portal', 'search', q.trim().toLowerCase()],
    queryFn: async () => {
      const res = await fetch(`/api/client/portal/search?q=${encodeURIComponent(q.trim())}`);
      if (!res.ok) return { hits: [] as Hit[] };
      return (await res.json()) as { hits: Hit[] };
    },
    enabled: open && q.trim().length >= 2,
    staleTime: 30_000,
  });

  const hits = useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase();
    const pages: Hit[] = PAGE_KEYS.map((k) => ({ group: 'Pages' as const, title: PORTAL_TITLES[k], href: PORTAL_PATHS[k], icon: PAGE_ICON[k] }));
    const steps: Hit[] = getActiveCatalogItems().map((it, i) => ({
      group: 'Steps' as const,
      title: `Step ${i + 1} · ${it.title}`,
      meta: it.forms?.join(' · '),
      href: stepHref(it.id),
    }));
    const local = [...pages, ...steps].filter((h) => !term || `${h.title} ${h.meta ?? ''}`.toLowerCase().includes(term));
    const out = term ? [...local, ...(remote.data?.hits ?? [])] : pages;
    return out.slice(0, 40);
  }, [q, remote.data]);

  if (!open) return null;
  const go = (h: Hit) => {
    onClose();
    router.push(h.href);
  };
  const onKey = (e: { key: string; preventDefault: () => void }) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(hits.length - 1, s + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === 'Enter' && hits[sel]) go(hits[sel]!);
  };
  if (phone)
    /* phone: s/home/mobile.html "Search" sheet (M-25) — grab, title + close, 44 px input, icon rows with a subtitle */
    return (
      <>
        <div className="cp-ss-scrim" aria-hidden="true" onClick={onClose} />
        <div className="cp-ssheet" role="dialog" aria-modal="true" aria-labelledby="cp-ss-t">
          <div className="grab" aria-hidden="true">
            <i />
          </div>
          <div className="sh">
            <h3 id="cp-ss-t">Search</h3>
            <button type="button" className="x" aria-label="Close" onClick={onClose}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div className="in">
            <input
              ref={inputRef}
              value={q}
              placeholder="Search steps, filings, documents"
              aria-label="Search"
              onChange={(e) => {
                setQ(e.target.value);
                setSel(0);
              }}
              onKeyDown={onKey}
            />
          </div>
          <div className="body" role="listbox" aria-label="Results">
            {hits.length === 0 ? <div className="none">Nothing found.</div> : null}
            {hits.map((h, i) => (
              <a
                key={`${h.group}-${h.href}-${i}`}
                href={h.href}
                className="row"
                role="option"
                aria-selected={i === sel}
                onClick={(e) => {
                  e.preventDefault();
                  go(h);
                }}
              >
                <span className="si" aria-hidden="true">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={SHELL_PATHS[h.icon ?? GROUP_ICON[h.group]]} />
                  </svg>
                </span>
                <span className="t">
                  <b>{h.title}</b>
                  <span>{h.meta ? `${GROUP_SUB[h.group]} · ${h.meta}` : GROUP_SUB[h.group]}</span>
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </>
    );
  let lastGroup = '';
  return (
    <div id="vp-drill-scrim" className="on cp-search" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div id="vp-drill" role="dialog" aria-modal="true" aria-label="Search">
        <div className="cp-search-in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M16 16l4 4" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            placeholder="Find steps, filings and documents"
            aria-label="Search"
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={onKey}
          />
          <span className="kbd">Esc</span>
        </div>
        <div className="list" role="listbox">
          {hits.length === 0 ? <div style={{ padding: '16px 0', color: 'var(--muted)' }}>Nothing found.</div> : null}
          {hits.map((h, i) => {
            const head = h.group !== lastGroup ? <div className="cp-search-g">{h.group}</div> : null;
            lastGroup = h.group;
            return (
              <div key={`${h.group}-${h.href}-${i}`}>
                {head}
                <a
                  href={h.href}
                  className="r"
                  role="option"
                  aria-selected={i === sel}
                  style={i === sel ? { background: 'oklch(var(--surface-sunken))' } : undefined}
                  onMouseEnter={() => setSel(i)}
                  onClick={(e) => {
                    e.preventDefault();
                    go(h);
                  }}
                >
                  <b>{h.title}</b>
                  <em>{h.meta ?? ''}</em>
                  <span />
                  <span className="a">→</span>
                </a>
              </div>
            );
          })}
        </div>
        <div className="ft">↑ ↓ to move · Enter to open · Esc to close</div>
      </div>
    </div>
  );
}
