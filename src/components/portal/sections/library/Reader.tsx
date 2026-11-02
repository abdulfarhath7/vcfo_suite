'use client';

/**
 * The book reader (prototype #readerm / openBook): cover + contents on the
 * left, the page on the right. Real content:
 *   saved  → GET /api/client/library/:id (owner only; an updated topic opens at its current version)
 *   learn  → GET /api/client/library/topic/:slug?depth=&engagementId= (a firm topic as an answer)
 * plus GET /api/client/library/topic?slug= for the review date, related topics and sources.
 * Real actions: depth (Simpler / Normal / More detail, re-read from the topic),
 * Save to library (POST /api/client/library), Remove (POST …/:id/remove, Undo = DELETE),
 * PDF brief (/api/client/library/:id/export), the official source, Ask VCFO,
 * and reading progress (POST /api/client/library/reads) per section read.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AnswerDepth, AnswerEnvelope, Visual } from '@/data/ask/schema';
import { usePortal } from '../../runtime';
import { getJson, PK, sendJson } from '../../data';
import { fmtY } from '../../dates';
import { Btn, Icon, Pill, Seg } from '../../ui';
import { catOf, officialSource, sectionsOf, visualTitle, yearOf, type LibraryItem } from './model';

export const LIB_QK = {
  list: [PK, 'library'] as const,
  reads: [PK, 'library-reads'] as const,
  item: (id: string) => [PK, 'library-item', id] as const,
  topic: (slug: string, depth: string, eng: string) => [PK, 'library-topic', slug, depth, eng] as const,
  meta: (slug: string) => [PK, 'library-topic-meta', slug] as const,
};

interface TopicMeta {
  slug: string;
  title: string;
  category: string;
  reviewed: boolean;
  reviewedAt: string | null;
  stepIds: string[];
  related: Array<{ slug: string; title: string; category: string }>;
  citations: Array<{ id: string; label: string; url?: string }>;
}

export type ReaderTarget = { mode: 'saved'; id: string } | { mode: 'learn'; slug: string };

const DEPTHS: { value: AnswerDepth; label: string }[] = [
  { value: 'simple', label: 'Simpler' },
  { value: 'normal', label: 'Normal' },
  { value: 'detail', label: 'More detail' },
];

/** Cover of a book (prototype coverEl). */
export function Cover({ title, category, year, small, company }: { title: string; category: string; year: string; small?: boolean; company: string }) {
  const c = catOf(category);
  return (
    <div className="cover" style={{ background: `linear-gradient(150deg, ${c.cover[1]}, ${c.cover[0]} 75%)`, padding: small ? 12 : undefined }}>
      <span className="emb">{c.id === 'your-project' ? company.slice(0, 3).toUpperCase() : c.emb}</span>
      <div className="ct1" style={{ paddingRight: 28 }}>
        {title}
      </div>
      <div className="bot">
        <span>{c.name(company).split(' ')[0]}</span>
        <span>{year}</span>
      </div>
    </div>
  );
}

export function Reader({ target, onOpen }: { target: ReaderTarget; onOpen: (t: ReaderTarget) => void }) {
  const { shell, openChat, closeModal, toast } = usePortal();
  const qc = useQueryClient();
  const company = shell?.companyShort ?? 'Your company';
  const engagementId = shell?.engagementId ?? '';

  const itemQ = useQuery({
    queryKey: LIB_QK.item(target.mode === 'saved' ? target.id : ''),
    queryFn: async () => getJson<{ item: LibraryItem; notice: string | null }>(`/api/client/library/${encodeURIComponent((target as { id: string }).id)}`),
    enabled: target.mode === 'saved',
    retry: false,
  });
  const item = itemQ.data?.item;
  const slug = target.mode === 'learn' ? target.slug : item?.topicSlug ?? '';
  const savedDepth = item?.answer.depth ?? 'normal';
  const [depth, setDepth] = useState<AnswerDepth | null>(null);
  const cur: AnswerDepth = depth ?? (target.mode === 'saved' ? savedDepth : 'normal');
  const wantTopic = Boolean(slug) && Boolean(engagementId) && (target.mode === 'learn' || (depth != null && depth !== savedDepth));

  const topicQ = useQuery({
    queryKey: LIB_QK.topic(slug, cur, engagementId),
    queryFn: async () => getJson<{ topic: { slug: string; title: string; category: string; version: number }; answer: AnswerEnvelope }>(`/api/client/library/topic/${encodeURIComponent(slug)}?depth=${cur}&engagementId=${encodeURIComponent(engagementId)}`),
    enabled: wantTopic,
    placeholderData: (p) => p,
    retry: false,
  });
  const metaQ = useQuery({
    queryKey: LIB_QK.meta(slug),
    queryFn: async () => (await getJson<{ topic: TopicMeta }>(`/api/client/library/topic?slug=${encodeURIComponent(slug)}`))?.topic ?? null,
    enabled: Boolean(slug),
    retry: false,
  });
  const libQ = useQuery({
    queryKey: LIB_QK.list,
    queryFn: async () => getJson<{ items: LibraryItem[] }>('/api/client/library'),
  });

  const answer: AnswerEnvelope | undefined = wantTopic && topicQ.data?.answer ? topicQ.data.answer : item?.answer;
  const title = target.mode === 'learn' ? topicQ.data?.topic.title ?? metaQ.data?.title ?? '' : item?.title ?? '';
  const category = target.mode === 'learn' ? topicQ.data?.topic.category ?? metaQ.data?.category ?? 'your-project' : item?.category ?? 'your-project';
  const savedCopy = target.mode === 'learn' ? libQ.data?.items.find((x) => x.topicSlug === slug) : item;
  const loading = target.mode === 'saved' ? itemQ.isPending : topicQ.isPending;
  const failed = target.mode === 'saved' ? itemQ.isError || (!itemQ.isPending && !item) : topicQ.isError || (!topicQ.isPending && !topicQ.data);
  const meta = metaQ.data;
  const reviewed = answer ? answer.origin === 'reviewed' && !answer.draft : false;
  const sections = useMemo(() => (answer ? sectionsOf(answer) : []), [answer]);
  const official = officialSource(answer);
  const year = item ? yearOf(item.savedAt) : meta?.reviewedAt ? yearOf(meta.reviewedAt) : String(new Date().getFullYear());

  /* ---------- reading progress: one section = one block of the page */
  const blocks = useRef<Array<HTMLElement | null>>([]);
  useEffect(() => {
    if (!answer) return;
    const els = blocks.current.filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const seen = new Set<number>();
    let posted = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const body = target.mode === 'saved' && item ? { itemId: item.id } : slug ? { topicSlug: slug } : null;
    if (!body) return;
    const flush = () => {
      if (seen.size <= posted) return;
      posted = seen.size;
      void sendJson('/api/client/library/reads', 'POST', { ...body, sectionsRead: seen.size, sectionsTotal: els.length })
        .then(() => qc.invalidateQueries({ queryKey: LIB_QK.reads }))
        .catch(() => undefined);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) seen.add(els.indexOf(e.target as HTMLElement));
        if (timer) clearTimeout(timer);
        timer = setTimeout(flush, 800);
      },
      { threshold: 0.5 },
    );
    els.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
      flush();
    };
  }, [answer, item, slug, target.mode, qc]);

  /* ---------- actions */
  const [busy, setBusy] = useState(false);
  const save = useCallback(async () => {
    if (!engagementId || !answer || !slug) return;
    setBusy(true);
    try {
      const out = await sendJson<{ item: LibraryItem }>('/api/client/library', 'POST', { engagementId, topicSlug: slug, answer });
      void qc.invalidateQueries({ queryKey: LIB_QK.list });
      toast('Saved to your library');
      onOpen({ mode: 'saved', id: out.item.id });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save to your library');
    } finally {
      setBusy(false);
    }
  }, [engagementId, answer, slug, qc, toast, onOpen]);

  const remove = useCallback(async () => {
    if (!item) return;
    setBusy(true);
    try {
      await sendJson(`/api/client/library/${encodeURIComponent(item.id)}/remove`, 'POST');
      void qc.invalidateQueries({ queryKey: LIB_QK.list });
      void qc.invalidateQueries({ queryKey: LIB_QK.reads });
      window.dispatchEvent(new CustomEvent('portal:library-removed', { detail: { id: item.id, title: item.title } }));
      closeModal();
      toast('Removed from your library');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not remove this book');
    } finally {
      setBusy(false);
    }
  }, [item, qc, closeModal, toast]);

  const askAbout = () => {
    closeModal();
    openChat(`Explain ${title || 'this'} in simple words`);
  };

  let page: ReactNode;
  if (loading) {
    page = (
      <div className="page" style={{ marginTop: 16 }}>
        <div className="cap1">{company.toUpperCase()}</div>
        <div className="t">Opening…</div>
        <div className="lines">
          {[100, 96, 88, 100, 92, 64].map((w, i) => (
            <i key={i} style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  } else if (failed || !answer) {
    page = (
      <div className="page" style={{ marginTop: 16 }}>
        <div className="t">{target.mode === 'saved' ? 'This book is not in your library any more.' : 'This explanation is not available yet.'}</div>
        <p className="small" style={{ marginTop: 8 }}>
          {target.mode === 'saved' ? 'It may have been removed. Ask VCFO can answer the question again.' : 'SBC has not published it for your company yet. Ask VCFO instead.'}
        </p>
      </div>
    );
  } else {
    let n = 0;
    const block = (key: string, body: ReactNode) => {
      const idx = n++;
      return (
      <div
        key={key}
        ref={(el) => {
          blocks.current[idx] = el;
        }}
        className="rd-sec"
      >
        {body}
      </div>
      );
    };
    const parts: ReactNode[] = [];
    parts.push(
      block(
        'line',
        <>
          <div className="t">{sections[0]}</div>
          <p className="rd-line">{answer.line}</p>
        </>,
      ),
    );
    if (answer.visual) parts.push(block('visual', <VisualBlock v={answer.visual} />));
    if (answer.why) parts.push(block('why', <><div className="t rd-t2">Why it matters</div><p className="rd-why">{answer.why}</p></>));
    if (answer.citations.length)
      parts.push(
        block(
          'sources',
          <>
            <div className="t rd-t2">Sources</div>
            <ul className="rd-src">
              {answer.citations.map((c) => (
                <li key={c.id}>
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noopener noreferrer">
                      {c.label}
                      <Icon name="ext" />
                    </a>
                  ) : (
                    c.label
                  )}
                </li>
              ))}
            </ul>
          </>,
        ),
      );
    page = (
      <div className="page rd-page" style={{ marginTop: 16 }}>
        <div className="cap1">{company.toUpperCase()}</div>
        {parts}
      </div>
    );
  }

  const related = (meta?.related ?? []).map((r) => {
    const saved = libQ.data?.items.find((x) => x.topicSlug === r.slug);
    return { ...r, target: saved ? ({ mode: 'saved', id: saved.id } as ReaderTarget) : ({ mode: 'learn', slug: r.slug } as ReaderTarget) };
  });

  return (
    <div className="modal rd-modal" role="dialog" aria-modal="true" aria-label="Book" style={{ width: 'min(940px, 100%)' }}>
      <div className="reader">
        <div>
          <Cover title={title || '…'} category={category} year={year} small company={company} />
          <ol className="toc">
            {sections.map((s) => (
              <li key={s}>{s}</li>
            ))}
            {related.length ? <li>Related</li> : null}
          </ol>
          {related.length ? (
            <div className="rd-rel">
              <span className="eyebrow">Related</span>
              {related.map((r) => (
                <button key={r.slug} type="button" className="rd-rel-b" onClick={() => onOpen(r.target)}>
                  <Icon name="lib" />
                  <span>{r.title}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="rd-kick">
            <span className="eyebrow">{catOf(category).name(company)}</span>
            {answer ? (
              reviewed ? (
                <Pill kind="ok" icon="check">
                  Reviewed by SBC{meta?.reviewedAt ? ` · ${fmtY(meta.reviewedAt)}` : ''}
                </Pill>
              ) : (
                <Pill kind="mut">{answer.draft || answer.topicSlug ? 'Draft · not yet reviewed by SBC' : answer.origin === 'generated' ? 'AI answer · not yet reviewed' : 'Not yet reviewed by SBC'}</Pill>
              )
            ) : null}
            {item?.updated ? <Pill kind="up">Updated since you saved it</Pill> : null}
            <span className="sp" />
            <button type="button" className="ib x" aria-label="Close" data-close>
              <Icon name="x" />
            </button>
          </div>
          <h3 style={{ marginTop: 6 }}>{title || (loading ? 'Opening…' : 'Book')}</h3>
          {itemQ.data?.notice && item?.updated ? <p className="small" style={{ marginTop: 6 }}>{itemQ.data.notice}. You are reading the current version.</p> : null}
          {slug && engagementId && answer ? (
            <div style={{ marginTop: 12 }}>
              <Seg options={DEPTHS} value={cur} onChange={(v) => setDepth(v)} ariaLabel="How much detail" />
            </div>
          ) : null}
          {page}
          <div className="mfoot">
            <button type="button" className="btn" data-close>
              Close
            </button>
            {official ? (
              <a className="btn" href={official.url} target="_blank" rel="noopener noreferrer">
                <Icon name="ext" />
                Official source
              </a>
            ) : null}
            {item ? (
              <a className="btn" href={`/api/client/library/${encodeURIComponent(item.id)}/export`}>
                <Icon name="dl" />
                PDF brief
              </a>
            ) : null}
            {target.mode === 'learn' && answer && !savedCopy && engagementId ? (
              <Btn ico="lib" onClick={() => void save()} disabled={busy}>
                Save to library
              </Btn>
            ) : null}
            {target.mode === 'learn' && savedCopy ? (
              <Btn ico="check" onClick={() => onOpen({ mode: 'saved', id: savedCopy.id })}>
                In your library
              </Btn>
            ) : null}
            {item ? (
              <Btn ico="x" onClick={() => void remove()} disabled={busy} title="Remove from your library">
                Remove
              </Btn>
            ) : null}
            <Btn cls="pri" ico="chat" onClick={askAbout}>
              Ask about it
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- visuals, in the prototype's own markup */

function VisualBlock({ v }: { v: Visual }) {
  const t = <div className="t rd-t2">{visualTitle(v.type)}</div>;
  switch (v.type) {
    case 'flow':
      return (
        <>
          {t}
          <ol className="rd-flow">
            {v.stages.map((s, i) => (
              <li key={i} className={s.state}>
                <span className={'nd ' + (s.state === 'done' ? 'done' : s.state === 'here' ? 'prog' : 'up')}>{s.state === 'done' ? <Icon name="check" /> : i + 1}</span>
                <div>
                  <b>{s.label}</b>
                  {s.sub ? <span>{s.sub}</span> : null}
                  {s.state === 'here' ? <span className="rd-here">You are here</span> : null}
                </div>
              </li>
            ))}
          </ol>
        </>
      );
    case 'steps':
      return (
        <>
          {t}
          <ol className="rd-flow">
            {v.items.map((s, i) => (
              <li key={i}>
                <span className="nd up">{i + 1}</span>
                <div>
                  <b>{s.label}</b>
                  {s.form ? <span>{s.form}</span> : null}
                </div>
              </li>
            ))}
          </ol>
        </>
      );
    case 'compare':
      return (
        <>
          {t}
          <div className="rd-cmp">
            {[v.left, v.right].map((p) => (
              <div key={p.title}>
                <b>{p.title}</b>
                <ul>
                  {p.points.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      );
    case 'timeline':
      return (
        <>
          {t}
          <dl className="meta">
            {v.events.map((e, i) => (
              <div key={i}>
                <dt>{e.when}</dt>
                <dd>{e.label}</dd>
              </div>
            ))}
          </dl>
        </>
      );
    case 'keyFacts':
      return (
        <>
          {t}
          <dl className="meta">
            {v.facts.map((f) => (
              <div key={f.k}>
                <dt>{f.k}</dt>
                <dd>{f.v}</dd>
              </div>
            ))}
          </dl>
        </>
      );
    case 'nextStep':
      return (
        <>
          {t}
          <p className="rd-line">
            <b>{v.title}</b>
            {v.dueLabel ? ` · ${v.dueLabel}` : ''}
          </p>
          {v.items.length ? (
            <ul className="rd-src">
              {v.items.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : null}
        </>
      );
    default:
      return null;
  }
}
