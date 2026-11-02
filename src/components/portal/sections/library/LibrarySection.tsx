'use client';

/**
 * Library (prototype a5_docs.js BOOKS / renderLibrary, body.txt LIBRARY + #readerm).
 * The real library is the client's saved Ask VCFO answers (GET /api/client/library,
 * not behind the Ask VCFO flag) with their reading progress (GET /api/client/library/reads).
 * Tier 01 shows the books read most recently as covers; the other books stand in
 * one stack per topic category. A book opens in the reader modal (Reader.tsx).
 * Empty library: a plain line, Ask VCFO, and SBC's suggested explanations
 * (GET /api/client/library/topic) which open in the same reader and can be saved.
 * Route intents /app/client/library/:id and /app/client/learn/:slug open the reader.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useIntent, usePaletteItems, usePortal, type PaletteItem } from '../../runtime';
import { getJson, sendJson } from '../../data';
import { Btn, Icon, SecError, SecHead, SecLoading, Seg } from '../../ui';
import { CATS, catOf, filterBooks, spine, tiers, yearOf, type LibraryFeatures, type LibraryItem, type LibraryRead, type Suggestion } from './model';
import { Cover, LIB_QK, Reader, type ReaderTarget } from './Reader';
import '../../css/95-library.css';

export function LibrarySection() {
  const { shell, openModal, openChat, toast, go } = usePortal();
  const company = shell?.companyShort ?? 'Your company';
  const lib = useQuery({
    queryKey: LIB_QK.list,
    queryFn: async () => getJson<{ items: LibraryItem[]; features?: LibraryFeatures }>('/api/client/library'),
    staleTime: 30_000,
  });
  const reads = useQuery({
    queryKey: LIB_QK.reads,
    queryFn: async () => (await getJson<{ reads: LibraryRead[] }>('/api/client/library/reads'))?.reads ?? [],
    staleTime: 30_000,
  });
  const items = useMemo(() => lib.data?.items ?? [], [lib.data]);
  const sugg = useQuery({
    queryKey: [...LIB_QK.list, 'suggestions'],
    queryFn: async () => (await getJson<{ suggestions: Suggestion[] }>('/api/client/library/topic'))?.suggestions ?? [],
    enabled: lib.isSuccess && items.length === 0,
    staleTime: 300_000,
  });
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');

  const open = useCallback(
    (t: ReaderTarget) => {
      openModal(<Reader target={t} onOpen={(n) => open(n)} />, { label: 'Book' });
    },
    [openModal],
  );

  /* route intents: /app/client/library/:id → saved book, /app/client/learn/:slug → a firm explanation */
  useIntent(['reader'], Boolean(shell), (i) => {
    go('library');
    open(i.mode === 'saved' ? { mode: 'saved', id: i.id } : { mode: 'learn', slug: i.id });
  });

  /* Undo for a removal made in the reader (soft remove → DELETE restores) */
  const [undo, setUndo] = useState<{ id: string; title: string } | null>(null);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; title: string }>).detail;
      setUndo(d);
    };
    window.addEventListener('portal:library-removed', on);
    return () => window.removeEventListener('portal:library-removed', on);
  }, []);
  useEffect(() => {
    if (!undo) return;
    const t = window.setTimeout(() => setUndo(null), 15_000);
    return () => window.clearTimeout(t);
  }, [undo]);
  const restore = async () => {
    if (!undo) return;
    try {
      await sendJson(`/api/client/library/${encodeURIComponent(undo.id)}/remove`, 'DELETE');
      toast(`${undo.title} is back in your library`);
      setUndo(null);
      void lib.refetch();
      void reads.refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not restore the book');
    }
  };

  /* search palette */
  const palette = useMemo<PaletteItem[]>(
    () =>
      items.map((b) => ({
        id: `book:${b.id}`,
        label: b.title,
        kind: 'Library',
        sw: catOf(b.category).cover[1],
        go: () => {
          go('library');
          open({ mode: 'saved', id: b.id });
        },
      })),
    [items, go, open],
  );
  usePaletteItems('library', palette);

  if (lib.isPending) {
    return (
      <>
        <SecHead title="Library" />
        <SecLoading />
      </>
    );
  }
  if (lib.isError) {
    return (
      <>
        <SecHead title="Library" />
        <SecError message="Your library could not load." onRetry={() => void lib.refetch()} />
      </>
    );
  }

  const present = CATS.filter((c) => items.some((b) => catOf(b.category).id === c.id));
  const tabOpts = [{ value: 'all', label: 'All', n: items.length }, ...present.map((c) => ({ value: c.id, label: c.tab(company), n: items.filter((b) => catOf(b.category).id === c.id).length }))];
  const shown = filterBooks(items, tab, q);
  const T = tiers(shown, reads.data ?? [], company);
  const features = lib.data?.features;

  return (
    <>
      <SecHead title="Library" count={items.length ? `${items.length} book${items.length === 1 ? '' : 's'}` : undefined}>
        {undo ? (
          <Btn ico="back" onClick={() => void restore()}>
            Undo remove
          </Btn>
        ) : null}
        {items.length ? (
          <>
            {features?.statusBrief && shell?.engagementId ? (
              <a className="btn" href={`/api/ask/brief?engagementId=${encodeURIComponent(shell.engagementId)}`}>
                <Icon name="brief" />
                Monthly status brief
              </a>
            ) : null}
            <a className="btn" href={`/api/client/library/export?ids=${encodeURIComponent(shown.map((b) => b.id).join(','))}`} aria-disabled={!shown.length}>
              <Icon name="dl" />
              PDF brief
            </a>
            {present.length > 1 ? <Seg options={tabOpts} value={tab} onChange={setTab} ariaLabel="Shelf" /> : null}
            <label className="dfilter" style={{ minWidth: 200 }}>
              <Icon name="search" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search books" />
            </label>
          </>
        ) : null}
      </SecHead>

      {items.length === 0 ? (
        <EmptyLibrary company={company} askEnabled={features?.askEnabled ?? false} suggestions={sugg.data ?? []} onOpen={open} onAsk={() => openChat()} />
      ) : T.length === 0 ? (
        <p className="small" style={{ padding: '20px 0' }}>
          No books match.
        </p>
      ) : (
        <div id="lshelves">
          {T.filter((t) => t.covers).map((t) => (
            <div key={t.rank} className="tier fadein">
              <div className="tier-h">
                <span className="rank">{t.rank}</span>
                <h3>{t.name}</h3>
                <span className="pill mut">{t.books.length}</span>
              </div>
              <div className="ess">
                {t.books.map((b, i) => (
                  <button key={b.id} type="button" className="book" onClick={() => open({ mode: 'saved', id: b.id })} aria-label={`Open ${b.title}`}>
                    <span className="no">{i + 1}</span>
                    {b.updated ? <span className="lib-upd" title="Updated since you saved it">Updated</span> : null}
                    <Cover title={b.title} category={b.category} year={yearOf(b.savedAt)} company={company} />
                  </button>
                ))}
              </div>
            </div>
          ))}
          {T.some((t) => !t.covers) ? (
            <div className="stacks">
              {T.filter((t) => !t.covers).map((t) => (
                <div key={t.rank} className="stack fadein">
                  <div className="stack-h">
                    <span className="rank">{t.rank}</span>
                    <h3>{t.name}</h3>
                    <span className="pill mut">{t.books.length}</span>
                  </div>
                  {t.books.map((b, i) => {
                    const c = catOf(b.category);
                    const w = 100 - ((b.title.length * 13 + i * 7) % 12);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        className="slab"
                        style={{ width: `${w}%`, background: `linear-gradient(90deg, ${c.cover[0]}, ${c.cover[1]} 70%)` }}
                        title={`${b.title} · ${b.answer.line}`}
                        aria-label={b.title}
                        onClick={() => open({ mode: 'saved', id: b.id })}
                      >
                        <b>{spine(b.title)}</b>
                        {b.updated ? <span>UPDATED</span> : <span>{yearOf(b.savedAt)}</span>}
                      </button>
                    );
                  })}
                  <div className="stack-base" />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}

function EmptyLibrary({ company, askEnabled, suggestions, onOpen, onAsk }: { company: string; askEnabled: boolean; suggestions: Suggestion[]; onOpen: (t: ReaderTarget) => void; onAsk: () => void }) {
  return (
    <section className="glass panel lib-empty">
      <p className="lede">
        {company}’s library is empty. {askEnabled ? 'Save an answer from Ask VCFO and it lands here as a book.' : 'Explanations SBC publishes for your company land here as books.'}
      </p>
      {askEnabled ? (
        <div className="acts-row">
          <Btn cls="pri" ico="chat" onClick={onAsk}>
            Ask VCFO
          </Btn>
        </div>
      ) : null}
      {suggestions.length ? (
        <div className="stack fadein" style={{ marginTop: 18, maxWidth: 420 }}>
          <div className="stack-h">
            <span className="rank">01</span>
            <h3>Start here</h3>
            <span className="pill mut">{suggestions.length}</span>
          </div>
          {suggestions.map((s, i) => {
            const c = CATS[i % 3]!;
            return (
              <button key={s.slug} type="button" className="slab" style={{ width: `${100 - ((s.title.length * 13 + i * 7) % 12)}%`, background: `linear-gradient(90deg, ${c.cover[0]}, ${c.cover[1]} 70%)` }} title={s.question} aria-label={s.title} onClick={() => onOpen({ mode: 'learn', slug: s.slug })}>
                <b>{spine(s.title)}</b>
                <span>SBC</span>
              </button>
            );
          })}
          <div className="stack-base" />
        </div>
      ) : null}
    </section>
  );
}
