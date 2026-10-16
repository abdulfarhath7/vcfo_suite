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

interface Hit {
  group: 'Pages' | 'Steps' | 'Documents' | 'Filings';
  title: string;
  meta?: string;
  href: string;
}

const PAGE_KEYS = Object.keys(PORTAL_PATHS) as PortalRouteKey[];

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
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
    const pages: Hit[] = PAGE_KEYS.map((k) => ({ group: 'Pages' as const, title: PORTAL_TITLES[k], href: PORTAL_PATHS[k] }));
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
  let lastGroup = '';
  return (
    <div id="vp-drill-scrim" className="on cp-search" onClick={(e) => e.target === e.currentTarget && onClose()}>
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
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSel((s) => Math.min(hits.length - 1, s + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              } else if (e.key === 'Enter' && hits[sel]) go(hits[sel]!);
            }}
          />
          <span className="kbd">Esc</span>
        </div>
        <div className="list" role="listbox">
          {hits.length === 0 ? <div style={{ padding: '16px 0', color: '#5a6b82' }}>Nothing found.</div> : null}
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
                  style={i === sel ? { background: 'light-dark(#f5f7fa, oklch(16.7% 0.005 258.3))' } : undefined}
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
