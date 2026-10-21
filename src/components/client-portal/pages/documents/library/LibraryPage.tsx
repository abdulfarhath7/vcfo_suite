'use client';

/**
 * Library (/app/client/library) — prototype `knowledge-bank`:
 * bookshelf s/docs/lib_shelf_a.dc.html (category pill, books chip, Monthly
 * status brief, PDF brief, search, Recently read strip, shelves with planks,
 * books that lift and tilt, blue "Updated" ribbon, no-match bubble), the
 * recently-read drill (lib_recent_drill) and the empty library (lib_empty).
 * Data: saved items GET /api/client/library (not behind the Ask VCFO flag), reading progress
 * GET /api/client/library/reads (NEW), suggestions GET /api/client/library/topic.
 */
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePortal, usePortalOptional } from '@/components/client-portal/PortalProvider';
import type { LibraryItemView } from '@/hooks/ask/ask-api';
import LegacyClientLibrary from '@/views/client/ask/ClientLibrary';
import { BotFace, PagePortal, useDelayedLoading } from '../shared-ui';
import { catOf, fetchLibrary, fetchReads, LIBRARY_KEY, libraryExportHref, readerHref, readTip, READS_KEY, SHELF_CATS, type LibraryRead } from './library-model';
import '../../../css/library-shelf.css';

export function LibraryPage() {
  const portal = usePortalOptional();
  if (!portal) return <LegacyClientLibrary />;
  return <LibraryInner />;
}

function Bubble({ size, children, clear }: { size: number; children: React.ReactNode; clear?: { label: string; onClick: () => void } }) {
  const { openChat } = usePortal();
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'flex-end', gap: 10, justifyContent: 'center', textAlign: 'left' }}>
      <BotFace size={size} />
      <div className="vdoc-bubble">
        <span style={{ font: '600 13px/1.45 Manrope,sans-serif', color: 'var(--fg)' }}>{children}</span>
        {clear ? (
          <button type="button" onClick={clear.onClick} style={{ marginTop: 6, padding: 0, border: 0, background: 'none', font: '700 12px Manrope,sans-serif', color: 'var(--primary)', cursor: 'pointer' }}>
            {clear.label}
          </button>
        ) : null}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            openChat(typeof children === 'string' ? `Ask VCFO why: ${children}` : 'Why is my library like this?');
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}
        >
          Ask VCFO why
        </a>
      </div>
    </div>
  );
}

function LibraryInner() {
  const { shell } = usePortal();
  const company = shell?.companyShort ?? 'Your company';
  const lib = useQuery({ queryKey: LIBRARY_KEY, queryFn: fetchLibrary });
  const reads = useQuery({ queryKey: READS_KEY, queryFn: fetchReads });
  const items = useMemo(() => lib.data?.items ?? [], [lib.data]);
  const [c, setC] = useState(0);
  const [q, setQ] = useState('');
  const [drill, setDrill] = useState<number | null>(null);
  const skeleton = useDelayedLoading(lib.isLoading);

  const cats = useMemo(() => SHELF_CATS.filter((x) => x.id !== 'labour' || items.some((i) => i.category === 'labour')), [items]);
  const ql = q.trim().toLowerCase();
  const active = c === 0 ? null : cats[c - 1];
  const shelves = cats
    .map((cat) => ({
      cat,
      books: items.filter((b) => (b.category === cat.id || (!SHELF_CATS.some((s) => s.id === b.category) && cat.id === 'your-project')) && (!active || active.id === cat.id) && (!ql || b.title.toLowerCase().includes(ql))),
    }))
    .filter((s) => s.books.length);
  const shownIds = shelves.flatMap((s) => s.books.map((b) => b.id));
  const recent = (reads.data ?? []).slice(0, 3);
  const engagementId = shell?.engagementId;

  if (lib.isLoading) {
    return (
      <div className="cp-library">
        <div className="vlib">
          <div className="vlib-col">
            <main className="vlib-main" aria-busy="true">
              {skeleton ? (
                <>
                  <div className="vlib-tools">
                    <span className="lsk" style={{ width: 680, maxWidth: '100%', height: 34, borderRadius: 8 }} />
                    <span className="lsk" style={{ width: 60, height: 20 }} />
                    <span className="lsk" style={{ width: 160, height: 34, borderRadius: 6 }} />
                  </div>
                  <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', padding: '6px 0 18px' }}>
                    {[0, 1].map((s) => (
                      <section key={s} aria-hidden="true">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 28px 0' }}>
                          <span className="lsk" style={{ width: 10, height: 10, borderRadius: 3 }} />
                          <span className="lsk" style={{ width: 120, height: 12 }} />
                        </div>
                        <div className="shelf">
                          {[0, 1, 2, 3].map((b) => (
                            <span key={b} className="lsk" style={{ width: 128, height: 172, borderRadius: '2px 6px 6px 2px', flex: 'none' }} />
                          ))}
                        </div>
                        <div className="plank" style={{ margin: '0 16px' }} />
                      </section>
                    ))}
                  </div>
                </>
              ) : null}
            </main>
          </div>
        </div>
      </div>
    );
  }

  if (lib.isError) {
    return (
      <div className="cp-library">
        <div className="vlib">
          <div className="vlib-col">
            <main className="vlib-main">
              <div className="lerr" role="alert">
                <span style={{ flex: 1 }}>Could not load your library</span>
                <button type="button" className="btn btn-o" onClick={() => void lib.refetch()}>
                  Try again
                </button>
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  if (!items.length) return <EmptyLibrary company={company} />;

  return (
    <div className="cp-library">
      <div className="vlib">
        <div className="vlib-col">
          <main className="vlib-main">
            <div className="vlib-tools">
              <div className="vlib-segw">
                <div className="seg" role="tablist" aria-label="Category" style={{ minWidth: Math.max(680, (cats.length + 1) * 110) }}>
                  <span className="thumb" style={{ width: `calc((100% - 4px)/${cats.length + 1})`, transform: `translateX(${c * 100}%)` }} />
                  {[null, ...cats].map((cat, i) => {
                    const cnt = cat ? items.filter((b) => b.category === cat.id).length : items.length;
                    return (
                      <button key={cat?.id ?? 'all'} type="button" role="tab" aria-selected={c === i} className={c === i ? 'on' : ''} onClick={() => setC(i)}>
                        {cat ? cat.tab(company) : 'All'}
                        <span className="cnt">{cnt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <span className="chip" style={{ background: 'var(--primary-chip)', color: '#fff' }}>
                {items.length} books
              </span>
              {engagementId && lib.data?.features?.statusBrief ? (
                <a className="btn btn-o" href={`/api/ask/brief?engagementId=${encodeURIComponent(engagementId)}`}>
                  Monthly status brief
                </a>
              ) : null}
              <a className="btn btn-o" href={libraryExportHref(shownIds)} aria-disabled={!shownIds.length}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 4v11 M7.5 10.5 12 15l4.5-4.5 M5 19.5h14" />
                </svg>
                PDF brief
              </a>
              <label className="vlib-q" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--subtle)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M16 16l4 4" />
                </svg>
                <input type="search" aria-label="Search books" placeholder="Search books" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'none', font: '500 13px Manrope,sans-serif', color: 'var(--fg)' }} />
              </label>
            </div>

            {recent.length ? (
              <section className="vlib-recent">
                <h2 style={{ margin: 0, font: '800 11px Manrope,sans-serif', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--navy-ink,var(--navy))', width: 110 }}>Recently read</h2>
                {recent.map((r) => {
                  const cat = catOf(r.category);
                  const tip = readTip(r);
                  return (
                    <div key={r.ref} className="mini" style={{ ['--bc' as string]: cat.color }}>
                      <span className="cv" style={cat.gold ? { boxShadow: 'inset 4px 0 0 var(--gold)' } : undefined} />
                      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                        <Link href={readerHref(r)} style={{ fontSize: 12.5, color: 'var(--fg)' }}>
                          {r.title}
                        </Link>
                        <a
                          className="pbar tip"
                          href="#"
                          data-tip={tip}
                          aria-label={`${tip}. Open the reading list`}
                          onClick={(e) => {
                            e.preventDefault();
                            setDrill(r.progressPct >= 100 ? 2 : 1);
                          }}
                        >
                          <span className="bar">
                            <span style={{ width: `${r.progressPct}%` }} />
                          </span>
                        </a>
                      </span>
                    </div>
                  );
                })}
              </section>
            ) : null}

            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', padding: '6px 0 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {shelves.map(({ cat, books }) => (
                <section key={cat.id} aria-label={cat.title(company)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 28px 0' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: cat.color }} />
                    <h2 style={{ margin: 0, font: '700 13px Manrope,sans-serif', color: 'var(--navy-ink,var(--navy))' }}>{cat.title(company)}</h2>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--subtle)' }}>
                      {books.length}
                    </span>
                  </div>
                  <div className="shelf">
                    {books.map((b) => (
                      <Book key={b.id} b={b} company={company} />
                    ))}
                  </div>
                  <div className="plank" style={{ margin: '0 16px' }} />
                </section>
              ))}
              {shelves.length === 0 ? (
                <div style={{ padding: '40px 16px' }}>
                  <Bubble
                    size={40}
                    clear={{
                      label: 'Clear search',
                      onClick: () => {
                        setQ('');
                        setC(0);
                      },
                    }}
                  >
                    No book matches “{q}”.
                  </Bubble>
                </div>
              ) : null}
            </div>
          </main>
        </div>
      </div>
      {drill != null ? <RecentDrill reads={reads.data ?? []} tab={drill} onClose={() => setDrill(null)} /> : null}
    </div>
  );
}

function Book({ b, company }: { b: LibraryItemView; company: string }) {
  const cat = catOf(b.category);
  return (
    <Link className="book" href={`/app/client/library/${encodeURIComponent(b.id)}`} style={{ ['--bc' as string]: cat.color }} aria-label={`Open ${b.title}${b.updated ? ' (updated since you saved it)' : ''}`}>
      <span className="bk-band" />
      {b.updated ? <span className="rib" role="img" aria-label="Updated since you saved it" data-tip="Updated since you saved it" /> : null}
      <span className="bk-ic">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={cat.icon} />
        </svg>
      </span>
      <span className="bk-t">{b.title}</span>
      <span className="bk-c">{cat.short(company)}</span>
    </Link>
  );
}

export function RecentDrill({ reads, tab, onClose }: { reads: LibraryRead[]; tab: number; onClose: () => void }) {
  const { go } = usePortal();
  const [t, setT] = useState(tab);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);
  const k = (r: LibraryRead) => (r.progressPct >= 100 ? 2 : 1);
  const list = reads.filter((r) => t === 0 || k(r) === t);
  const close = useCallback(() => {
    onClose();
    (opener.current as HTMLElement | null)?.focus?.();
  }, [onClose]);
  useEffect(() => {
    opener.current = document.activeElement;
    const tm = setTimeout(() => closeRef.current?.focus(), 40);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      clearTimeout(tm);
      document.removeEventListener('keydown', key, true);
    };
  }, [close]);
  return (
    <PagePortal page="library">
      <div className="ld-root">
        <div className="ld-scrim" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div role="dialog" aria-modal="true" aria-label="Recently read" className="dlg" style={{ width: 600, maxWidth: '100%', background: 'var(--panel)', borderRadius: 12, boxShadow: '0 24px 60px -20px oklch(15% 0.05 258 / .55)', overflow: 'hidden', fontFamily: 'Manrope,system-ui,sans-serif', color: 'var(--fg)', fontSize: 13 }}>
            <div className="dd-top" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: 'var(--primary-light)', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)' }}>
              <span>These guides live in the Library</span>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  close();
                  go('knowledge-bank');
                }}
                style={{ marginLeft: 'auto', fontWeight: 800, fontSize: 12.5, whiteSpace: 'nowrap' }}
              >
                Open Library →
              </a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 56, padding: '0 12px 0 18px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0, font: '700 15px Manrope,sans-serif', color: 'var(--navy-ink,var(--navy))', flex: 1 }}>Recently read</h2>
              <button ref={closeRef} type="button" className="ib" aria-label="Close" onClick={close}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <div className="seg" role="tablist" aria-label="Reading status">
                <span className="thumb" style={{ width: 'calc((100% - 4px)/3)', transform: `translateX(${t * 100}%)` }} />
                {['All', 'In progress', 'Finished'].map((l, i) => (
                  <button key={l} type="button" role="tab" aria-selected={t === i} className={t === i ? 'on' : ''} onClick={() => setT(i)}>
                    {l}
                    <span className="c">{i === 0 ? reads.length : reads.filter((r) => k(r) === i).length}</span>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ paddingBottom: 6 }}>
              {list.map((r) => {
                const cat = catOf(r.category);
                return (
                  <Link key={r.ref} className="row" href={readerHref(r)} onClick={() => onClose()}>
                    <span className="cv" style={{ background: cat.color, ...(cat.gold ? { boxShadow: 'inset 4px 0 0 var(--gold)' } : {}) }} />
                    <span style={{ flex: 1, minWidth: 0, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                    <span className="bar" role="img" aria-label={readTip(r)}>
                      <span style={{ width: `${r.progressPct}%` }} />
                    </span>
                    <span className="mono" style={{ width: 56, textAlign: 'right', fontSize: 11.5, color: 'var(--subtle)' }}>
                      {r.progressPct >= 100 ? 'Done' : `${r.progressPct}%`}
                    </span>
                  </Link>
                );
              })}
              {list.length === 0 ? <div style={{ padding: '22px 16px', borderTop: '1px solid var(--hair)', color: 'var(--muted)', fontWeight: 600, textAlign: 'center' }}>Nothing here yet.</div> : null}
            </div>
          </div>
        </div>
      </div>
    </PagePortal>
  );
}

function EmptyLibrary({ company }: { company: string }) {
  const { openChat } = usePortal();
  const sugg = useQuery({
    queryKey: ['client-portal', 'library-suggestions'],
    queryFn: async () => {
      const res = await fetch('/api/client/library/topic');
      if (!res.ok) return [] as Array<{ slug: string; title: string; question: string }>;
      return ((await res.json()) as { suggestions: Array<{ slug: string; title: string; question: string }> }).suggestions;
    },
  });
  return (
    <div className="cp-library">
      <div className="le-root">
        <main style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h1 style={{ margin: 0, font: '700 22px Manrope,sans-serif', color: 'var(--navy-ink,var(--navy))' }}>Library</h1>
          <section className="card" style={{ minHeight: 580, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center', padding: 16 }}>
            <div aria-hidden="true" style={{ position: 'relative', width: 200, height: 110, borderBottom: '3px solid var(--violet-soft)' }}>
              <span className="bk" style={{ left: 30, width: 26, height: 78, background: 'var(--violet-chip)' }} />
              <span className="bk" style={{ left: 60, width: 22, height: 94, background: 'var(--navy)', animationDelay: '.08s' }} />
              <span className="bk" style={{ left: 86, width: 30, height: 64, background: 'var(--violet-soft)', animationDelay: '.16s' }} />
              <span className="bk" style={{ left: 122, width: 24, height: 86, background: 'var(--gold)', animationDelay: '.24s', transform: 'rotate(12deg)', transformOrigin: 'bottom left' }} />
            </div>
            <Bubble size={48}>
              {company}’s library is empty. Save an answer from Ask VCFO and it lands here as a book.
            </Bubble>
            <button type="button" className="btn btn-n" onClick={() => openChat()}>
              Ask VCFO
            </button>
            {sugg.data?.length ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
                {sugg.data.map((s) => (
                  <Link key={s.slug} className="q" href={`/app/client/learn/${encodeURIComponent(s.slug)}`}>
                    {s.question}
                  </Link>
                ))}
              </div>
            ) : null}
          </section>
        </main>
      </div>
    </div>
  );
}
