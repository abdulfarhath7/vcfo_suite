'use client';

/**
 * Search ⌘K (VCFO Spectrum Palette, Q3): a centred 600 px dialog on a scrim (a bottom sheet
 * on phones). Groups in the prototype's order: steps, filings, obligations, registrations,
 * documents, pages. Regulator and Status chips under the field narrow the records; pages
 * have neither, so they hide while a chip is set. Each record row has an 8 px status square,
 * the title, grey sub text and a mono code. ↑ ↓ move, Enter opens, Esc closes.
 *
 * Data, all through the caller's own scoped reads: steps and registrations come from the
 * client-redacted step model (`usePortalIncorporation`, the same model the Incorporation and
 * Registrations pages draw); documents, filings and obligations come from
 * /api/client/portal/search (scoped repositories). Before the model loads, steps fall back to
 * the client-visible catalogue without a status.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getActiveCatalogItems } from '@/data/checklist';
import { toneFor } from '@/components/ui/spectrum-chip';
import { hitPasses, regLabelOf, REG_LABEL, STATUS_WORDS, type SearchGroup, type SearchHit } from '@/lib/client-portal/search-hits';
import { PORTAL_ALIAS_KEYS, PORTAL_PATHS, PORTAL_TITLES, stepHref, type PortalRouteKey } from './routes';
import { useBreakpoint } from './Sidebar';
import { SHELL_PATHS } from './icons';
import { usePortalIncorporation } from './hooks';
import { stepChip } from './pages/incorporation/spectrum';
import { buildRegistrations } from './pages/registrations/model';
import { registrationHref } from './pages/registrations/parts';

type Hit = SearchHit & { icon?: keyof typeof SHELL_PATHS };

/** Group order (prototype Palette). */
const ORDER: SearchGroup[] = ['Steps', 'Filings', 'Obligations', 'Registrations', 'Documents', 'Pages'];
/** Records shown per group. */
const PER_GROUP = 6;

/** Phone result-row glyph per group (shell icon set). */
const GROUP_ICON: Record<SearchGroup, keyof typeof SHELL_PATHS> = {
  Pages: 'home',
  Steps: 'inc',
  Filings: 'comp',
  Obligations: 'comp',
  Registrations: 'comp',
  Documents: 'docs',
};
const PAGE_ICON: Partial<Record<PortalRouteKey, keyof typeof SHELL_PATHS>> = {
  announcements: 'updates',
  notifications: 'updates',
  incorporation: 'inc',
  'board-resolution': 'inc',
  compliances: 'comp',
  filings: 'comp',
  obligations: 'comp',
  registrations: 'comp',
  documents: 'docs',
  'knowledge-bank': 'lib',
  credentials: 'person',
  team: 'team',
  audit: 'audit',
  settings: 'gear',
};
const GROUP_SUB: Record<SearchGroup, string> = {
  Pages: 'Page',
  Steps: 'Incorporation',
  Filings: 'Filing',
  Obligations: 'Obligation',
  Registrations: 'Registration',
  Documents: 'Document',
};

const PAGE_KEYS = (Object.keys(PORTAL_PATHS) as PortalRouteKey[]).filter((k) => !PORTAL_ALIAS_KEYS.has(k));
const REG_OPTIONS = Object.values(REG_LABEL);

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <SearchBody onClose={onClose} />;
}

/** One filter chip (R-10) with its own menu inside the dialog, so the menu sits above the scrim. */
function ChipMenu({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void }) {
  const [menu, setMenu] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menu) return;
    wrap.current?.querySelector<HTMLElement>('[role=option][aria-selected=true], [role=option]')?.focus();
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menu]);
  const close = () => {
    setMenu(false);
    btn.current?.focus();
  };
  const onMenuKey = (e: React.KeyboardEvent) => {
    const items = Array.from(wrap.current?.querySelectorAll<HTMLElement>('[role=option]') ?? []);
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      const next = e.key === 'ArrowDown' ? Math.min(items.length - 1, at + 1) : Math.max(0, at - 1);
      items[next]?.focus();
    }
  };
  return (
    <span className="cp-chipw" ref={wrap}>
      <button
        ref={btn}
        type="button"
        className={`sx-filter${value ? ' on' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={menu}
        onClick={() => setMenu((m) => !m)}
      >
        {label}
        {value ? <b>{value}</b> : null}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {value ? (
        <button type="button" className="cp-chipx" aria-label={`Clear ${label}`} onClick={() => onChange('')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      ) : null}
      {menu ? (
        <span className="cp-chipm" role="listbox" aria-label={label} onKeyDown={onMenuKey}>
          {options.map((o) => (
            <button
              key={o}
              type="button"
              role="option"
              aria-selected={o === value}
              onClick={() => {
                onChange(o === value ? '' : o);
                close();
              }}
            >
              <span>{o}</span>
              {o === value ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : null}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}

function Kbd({ children }: { children: string }) {
  return <kbd className="cp-kbd">{children}</kbd>;
}

function SearchBody({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [reg, setReg] = useState('');
  const [status, setStatus] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const phone = useBreakpoint() === 'phone';
  const { model } = usePortalIncorporation();
  const term = q.trim().toLowerCase();
  const anyChip = Boolean(reg || status);
  /* phone: the search is a bottom sheet; like the prototype's sheets it sends the launcher away (sheet-open) */
  useEffect(() => {
    if (!phone) return;
    const cp = document.querySelector('.cp');
    cp?.classList.add('sheet-open');
    return () => cp?.classList.remove('sheet-open');
  }, [phone]);
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => setSel(0), [term, reg, status]);

  const browse = anyChip && term.length < 2;
  const remote = useQuery({
    queryKey: ['client-portal', 'search', browse ? '*' : term],
    queryFn: async () => {
      const qs = browse ? 'all=1' : `q=${encodeURIComponent(term)}`;
      const res = await fetch(`/api/client/portal/search?${qs}`);
      if (!res.ok) return { hits: [] as Hit[] };
      return (await res.json()) as { hits: Hit[] };
    },
    enabled: term.length >= 2 || browse,
    staleTime: 30_000,
  });

  const groups = useMemo(() => {
    const has = (...parts: Array<string | undefined>) => !term || parts.filter(Boolean).join(' ').toLowerCase().includes(term);
    const regs = buildRegistrations(model);
    const regIds = new Set(regs.map((r) => r.stepId));
    const steps: Hit[] = model.steps.length
      ? model.steps
          .filter((s) => !regIds.has(s.id))
          .map((s) => ({
            group: 'Steps' as const,
            title: `Step ${s.n} · ${s.title}`,
            meta: s.item.forms?.join(' · '),
            href: stepHref(s.id),
            status: stepChip(s).label,
            code: s.item.forms?.[0],
          }))
      : getActiveCatalogItems().map((it, i) => ({
          group: 'Steps' as const,
          title: `Step ${i + 1} · ${it.title}`,
          meta: it.forms?.join(' · '),
          href: stepHref(it.id),
          code: it.forms?.[0],
        }));
    const registrations: Hit[] = regs
      .filter((r) => !r.notNeeded)
      .map((r) => ({
        group: 'Registrations' as const,
        title: r.name,
        meta: r.area,
        href: registrationHref(r.id),
        reg: regLabelOf(r.area),
        status: r.status,
        code: r.number ?? undefined,
      }));
    const pages: Hit[] = PAGE_KEYS.map((k) => ({ group: 'Pages' as const, title: PORTAL_TITLES[k], href: PORTAL_PATHS[k], icon: PAGE_ICON[k] }));
    const local = [...steps, ...registrations].filter((h) => has(h.title, h.meta, h.code));
    const records = term || anyChip ? [...local, ...(remote.data?.hits ?? [])] : [];
    const shown = (anyChip ? records.filter((h) => hitPasses(h, reg, status)) : records).concat(
      anyChip ? [] : pages.filter((h) => has(h.title)),
    );
    return ORDER.map((g) => ({ group: g, hits: shown.filter((h) => h.group === g).slice(0, PER_GROUP) })).filter((g) => g.hits.length);
  }, [term, anyChip, reg, status, model, remote.data]);
  const hits = useMemo(() => groups.flatMap((g) => g.hits), [groups]);

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

  const chips = (
    <div className="cp-search-chips">
      <ChipMenu label="Regulator" value={reg} options={REG_OPTIONS} onChange={setReg} />
      <ChipMenu label="Status" value={status} options={STATUS_WORDS} onChange={setStatus} />
      {anyChip ? (
        <button
          type="button"
          className="cp-search-clear"
          onClick={() => {
            setReg('');
            setStatus('');
            inputRef.current?.focus();
          }}
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
  /* The 8 px status square takes the tone of the status word (R-13). */
  const square = (h: Hit) => (h.status ? <i className={`cp-sq ${toneFor(h.status)}`} aria-hidden="true" /> : null);
  const starts = groups.map((_, gi) => groups.slice(0, gi).reduce((n, g) => n + g.hits.length, 0));

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
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKey}
            />
          </div>
          {chips}
          <div className="body" role="listbox" aria-label="Results">
            {hits.length === 0 ? <div className="none">No match</div> : null}
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
                  <span>
                    {[GROUP_SUB[h.group], h.status, h.meta].filter(Boolean).join(' · ')}
                  </span>
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
  return (
    <div id="vp-drill-scrim" className="on cp-search" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div id="vp-drill" role="dialog" aria-modal="true" aria-label="Search">
        <div className="cp-search-in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M16 16l4 4" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            placeholder="Search steps, filings, documents"
            aria-label="Search"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
          />
          <Kbd>Esc</Kbd>
        </div>
        {chips}
        <div className="list" role="listbox" aria-label="Results">
          {hits.length === 0 ? <p className="cp-search-none">No match</p> : null}
          {groups.map((g, gi) => (
            <div key={g.group} role="group" aria-label={g.group}>
              <div className="cp-search-g">{g.group}</div>
              {g.hits.map((h, hi) => {
                const i = starts[gi]! + hi;
                return (
                  <a
                    key={`${h.group}-${h.href}-${i}`}
                    href={h.href}
                    className="cp-search-r"
                    role="option"
                    aria-selected={i === sel}
                    onMouseEnter={() => setSel(i)}
                    onClick={(e) => {
                      e.preventDefault();
                      go(h);
                    }}
                  >
                    {square(h)}
                    <span className="t">
                      <b>{h.title}</b>
                      {h.meta ? <em>{h.meta}</em> : null}
                    </span>
                    {h.code ? <code>{h.code}</code> : null}
                  </a>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cp-search-ft">
          <span>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> Move
          </span>
          <span>
            <Kbd>Enter</Kbd> Open
          </span>
          <span>
            <Kbd>Esc</Kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}
