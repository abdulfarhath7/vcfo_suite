'use client';

/**
 * Library reader (prototype s/docs/lib_reader.dc.html, mode `saved` for
 * /app/client/library/[id], `learn` for /app/client/learn/[slug]): navy hero
 * with category / Reviewed by SBC / Updated chips, depth pill, read time,
 * official link; lead line; Focus-track timeline (or the answer's own
 * visual); facts grid at "More detail"; Why it matters; sources; actions
 * (Saved / Save to library, PDF brief, Ask a follow-up, Remove with Undo);
 * side cards In <Company>'s project · Related · Documents for this.
 * Reading progress is recorded per section (NEW client_library_reads).
 */
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AnswerDepth, AnswerEnvelope, Visual } from '@/data/ask/schema';
import { usePortal, usePortalCrumbs, usePortalOptional } from '@/components/client-portal/PortalProvider';
import { usePortalIncorporation, todayIST } from '@/components/client-portal/hooks';
import { portalHref, stepHref } from '@/components/client-portal/routes';
import { LinkButton } from '@/components/client-portal/LinkButton';
import { VisualRenderer } from '@/components/ask/visuals/VisualRenderer';
import { VisorHead } from '@/components/client-portal/Visor';
import LegacyClientLibraryItem from '@/views/client/ask/ClientLibraryItem';
import LegacyClientLearnTopic from '@/views/client/ask/ClientLearnTopic';
import { DocViewer, type ViewerDoc } from '../DocViewer';
import { dayMonth, MONTHS_SHORT } from '../file-types';
import { STATUS_STYLE, tagStyle, tagText } from '../model';
import { BotFace, toViewerDoc, useClientDocuments } from '../shared-ui';
import { categoryName, fetchLibrary, fetchLibraryItem, fetchTopicAnswer, LIBRARY_KEY, libraryItemExportHref, READS_KEY, saveToLibrary } from './library-model';
import '../../../css/library-reader.css';

const DEPTHS: Array<{ label: string; d: AnswerDepth }> = [
  { label: 'Simpler', d: 'simple' },
  { label: 'Normal', d: 'normal' },
  { label: 'More detail', d: 'detail' },
];

interface TopicMeta {
  slug: string;
  title: string;
  category: string;
  reviewed: boolean;
  reviewedAt: string | null;
  stepIds: string[];
  related: Array<{ slug: string; title: string; category: string }>;
  citations: Array<{ id: string; label: string; url?: string }>;
  obligationId: string | null;
}

const OFFICIAL: Array<[RegExp, string]> = [
  [/firms\.rbi\.org\.in/i, 'RBI FIRMS'],
  [/rbi\.org\.in/i, 'RBI'],
  [/mca\.gov\.in/i, 'MCA portal'],
  [/gst\.gov\.in/i, 'GST portal'],
  [/incometax\.gov\.in/i, 'Income-tax e-filing'],
  [/tdscpc\.gov\.in|traces/i, 'TRACES'],
  [/epfindia\.gov\.in/i, 'EPFO'],
  [/esic\.gov\.in/i, 'ESIC'],
  [/dgft\.gov\.in/i, 'DGFT'],
  [/udyamregistration\.gov\.in/i, 'Udyam'],
  [/ipindia\.gov\.in/i, 'IP India'],
  [/\.gov\.in|\.nic\.in/i, ''],
];

function officialLink(cites: Array<{ label: string; url?: string }>): { label: string; url: string } | null {
  for (const c of cites) {
    if (!c.url) continue;
    for (const [re, name] of OFFICIAL) {
      if (re.test(c.url)) {
        let host = name;
        if (!host) {
          try {
            host = new URL(c.url).hostname.replace(/^www\./, '');
          } catch {
            host = c.label;
          }
        }
        return { label: host, url: c.url };
      }
    }
  }
  return null;
}

function visualText(v?: Visual): string {
  if (!v) return '';
  return JSON.stringify(v).replace(/[{}[\]",:]/g, ' ');
}

function readMinutes(a: AnswerEnvelope): number {
  const words = `${a.line} ${a.why ?? ''} ${visualText(a.visual)}`.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function parseWhen(when: string, today: string): 'done' | 'future' | null {
  const m = when.match(/(\d{1,2}\s+[A-Za-z]{3,9}(?:\s+\d{4})?|\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  let s = m[1]!;
  if (!/\d{4}/.test(s)) s = `${s} ${today.slice(0, 4)}`;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10) <= today ? 'done' : 'future';
}

export function ReaderPage({ mode }: { mode: 'saved' | 'learn' }) {
  const portal = usePortalOptional();
  if (!portal) return mode === 'saved' ? <LegacyClientLibraryItem /> : <LegacyClientLearnTopic />;
  return <ReaderInner mode={mode} />;
}

function ReaderInner({ mode }: { mode: 'saved' | 'learn' }) {
  const params = useParams<{ id?: string; slug?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { shell, openChat, toast, go } = usePortal();
  const company = shell?.companyShort ?? 'Your company';
  const engagementId = shell?.engagementId ?? null;
  const { model } = usePortalIncorporation();
  const docsQ = useClientDocuments();
  const [viewer, setViewer] = useState<{ docs: ViewerDoc[]; i: number } | null>(null);

  const itemQ = useQuery({
    queryKey: ['ask', 'library', 'item', params?.id],
    queryFn: () => fetchLibraryItem(params!.id!),
    enabled: mode === 'saved' && !!params?.id,
    retry: false,
  });
  const item = itemQ.data?.item;
  const slug = mode === 'learn' ? params?.slug ?? '' : item?.topicSlug ?? '';
  const savedDepth = item?.answer.depth ?? 'normal';
  const [depth, setDepth] = useState<AnswerDepth | null>(null);
  const curDepth = depth ?? (mode === 'saved' ? savedDepth : 'normal');

  const topicQ = useQuery({
    queryKey: ['ask', 'topic', slug, curDepth, engagementId],
    queryFn: () => fetchTopicAnswer(slug, { depth: curDepth, engagementId }),
    enabled: !!slug && !!engagementId && (mode === 'learn' || (depth != null && depth !== savedDepth)),
    placeholderData: (p) => p,
    retry: false,
  });
  const metaQ = useQuery({
    queryKey: ['client-portal', 'topic-meta', slug],
    queryFn: async () => {
      const res = await fetch(`/api/client/library/topic?slug=${encodeURIComponent(slug)}`);
      if (!res.ok) return null;
      return ((await res.json()) as { topic: TopicMeta }).topic;
    },
    enabled: !!slug,
  });
  const libQ = useQuery({ queryKey: LIBRARY_KEY, queryFn: fetchLibrary });
  const filingsQ = useQuery({
    queryKey: ['client-portal', 'filings-for-reader', engagementId],
    queryFn: async () => {
      const res = await fetch(`/api/filings${engagementId ? `?engagementId=${encodeURIComponent(engagementId)}` : ''}`);
      if (!res.ok) return [];
      return ((await res.json()) as { rows: Array<{ id: string; obligationId: string; particular: string; dueDate: string; filedOn: string | null; periodLabel: string | null }> }).rows;
    },
    enabled: !!metaQ.data?.obligationId,
  });

  const answer: AnswerEnvelope | undefined = (topicQ.data?.answer && (mode === 'learn' || depth != null)) ? topicQ.data.answer : item?.answer;
  const title = mode === 'learn' ? topicQ.data?.topic.title ?? metaQ.data?.title ?? '' : item?.title ?? '';
  usePortalCrumbs(['Library', title || 'Reading']);
  const category = mode === 'learn' ? topicQ.data?.topic.category ?? metaQ.data?.category ?? '' : item?.category ?? '';
  const savedItem = mode === 'learn' ? libQ.data?.items.find((x) => x.topicSlug === slug) : item;
  const loading = mode === 'saved' ? itemQ.isLoading : topicQ.isPending;
  const failed = mode === 'saved' ? itemQ.isError || (!itemQ.isLoading && !item) : topicQ.isError;

  /* ---------- reading progress ---------- */
  const sectionsRef = useRef<Array<HTMLElement | null>>([]);
  const seen = useRef<Set<number>>(new Set());
  const posted = useRef(0);
  useEffect(() => {
    if (!answer) return;
    seen.current = new Set();
    posted.current = 0;
    const els = sectionsRef.current.filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const total = els.length;
    const body = mode === 'saved' && item ? { itemId: item.id } : slug ? { topicSlug: slug } : null;
    if (!body) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      if (seen.current.size <= posted.current) return;
      posted.current = seen.current.size;
      void fetch('/api/client/library/reads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, sectionsRead: seen.current.size, sectionsTotal: total }),
      }).then(() => void qc.invalidateQueries({ queryKey: READS_KEY }));
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) seen.current.add(els.indexOf(e.target as HTMLElement));
        }
        if (timer) clearTimeout(timer);
        timer = setTimeout(flush, 800);
      },
      { threshold: 0.6 },
    );
    els.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
      flush();
    };
  }, [answer, item, slug, mode, qc]);

  /* ---------- actions ---------- */
  const [saving, setSaving] = useState(false);
  const save = useCallback(async () => {
    if (!engagementId || !answer || !slug) return;
    setSaving(true);
    try {
      const { item: saved } = await saveToLibrary({ engagementId, topicSlug: slug, answer });
      void qc.invalidateQueries({ queryKey: LIBRARY_KEY });
      toast('Saved to library');
      router.replace(`/app/client/library/${encodeURIComponent(saved.id)}`);
    } catch {
      toast('Could not save to your library');
    } finally {
      setSaving(false);
    }
  }, [engagementId, answer, slug, qc, toast, router]);

  const remove = useCallback(async () => {
    if (!item) return;
    const res = await fetch(`/api/client/library/${encodeURIComponent(item.id)}/remove`, { method: 'POST' });
    if (!res.ok) {
      toast('Could not remove this item');
      return;
    }
    void qc.invalidateQueries({ queryKey: LIBRARY_KEY });
    void qc.invalidateQueries({ queryKey: READS_KEY });
    toast('Removed from library', {
      undo: () => {
        void fetch(`/api/client/library/${encodeURIComponent(item.id)}/remove`, { method: 'DELETE' }).then(() => {
          void qc.invalidateQueries({ queryKey: LIBRARY_KEY });
          void qc.invalidateQueries({ queryKey: READS_KEY });
          router.push(`/app/client/library/${encodeURIComponent(item.id)}`);
        });
      },
    });
    go('knowledge-bank');
  }, [item, qc, toast, go, router]);

  /* ---------- side data ---------- */
  const meta = metaQ.data;
  const stepIds = meta?.stepIds ?? (answer?.target?.stepId ? [answer.target.stepId] : []);
  const projectCard = useMemo(() => {
    const today = todayIST();
    if (meta?.obligationId && filingsQ.data?.length) {
      const rows = filingsQ.data.filter((r) => r.obligationId === meta.obligationId).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const next = rows.find((r) => !r.filedOn) ?? rows[rows.length - 1];
      if (next) {
        const days = Math.round((Date.parse(next.dueDate) - Date.parse(today)) / 86_400_000);
        return {
          date: next.dueDate,
          title: `${next.particular}${next.periodLabel ? ` · ${next.periodLabel}` : ''}`,
          chip: next.filedOn ? { t: `Filed ${dayMonth(next.filedOn)}`, s: STATUS_STYLE.Approved } : days < 0 ? { t: `${-days} days late`, s: { background: 'var(--over-light)', color: 'var(--over-text)' } } : { t: `${days} days left`, s: { background: 'var(--due-light)', color: 'var(--due-text)' } },
          owner: 'SBC files',
          link: { text: 'Open in Compliances', href: `${portalHref('filings')}?filing=${encodeURIComponent(next.id)}` },
          done: !!next.filedOn,
        };
      }
    }
    const steps = stepIds.map((id) => model.byId[id]).filter(Boolean);
    const s = steps.find((x) => x!.kind !== 'done') ?? steps[steps.length - 1];
    if (!s) return null;
    const date = s.kind === 'done' ? s.doneOn : s.due;
    const days = date ? Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000) : null;
    return {
      date,
      title: `Step ${s.n} · ${s.title}`,
      chip: s.kind === 'done' ? { t: 'Done', s: STATUS_STYLE.Approved } : s.late ? { t: `${s.lateDays} days late`, s: { background: 'var(--over-light)', color: 'var(--over-text)' } } : days != null ? { t: `${days} days left`, s: { background: 'var(--due-light)', color: 'var(--due-text)' } } : null,
      owner: s.owner === 'client' ? `${company} does this` : s.owner === 'mca' ? 'MCA reviews' : 'SBC files',
      link: { text: 'Open in Incorporation', href: stepHref(s.id) },
      done: s.kind === 'done',
    };
  }, [meta, filingsQ.data, stepIds, model, company]);
  const relDocs = (docsQ.data?.nodes ?? []).filter((n) => n.stepId && stepIds.includes(n.stepId) && !n.replaced && n.status !== 'Missing' && n.ref);
  const related = (meta?.related ?? []).map((r) => {
    const saved = libQ.data?.items.find((x) => x.topicSlug === r.slug);
    return { ...r, href: saved ? `/app/client/library/${encodeURIComponent(saved.id)}` : `/app/client/learn/${encodeURIComponent(r.slug)}` };
  });

  if (loading) {
    return (
      <div className="cp-reader">
        <div className="vrd">
          <div className="vrd-col">
            <main className="vrd-main" aria-busy="true">
              <article className="vrd-art">
                <span className="lsk" style={{ height: 150, borderRadius: 10 }} />
                <span className="lsk" style={{ height: 320, borderRadius: 10 }} />
              </article>
              <aside className="vrd-side">
                <span className="lsk" style={{ height: 120, borderRadius: 10 }} />
              </aside>
            </main>
          </div>
        </div>
      </div>
    );
  }
  if (failed || !answer) {
    return (
      <div className="cp-reader">
        <div className="vrd">
          <div className="vrd-col">
            <main className="vrd-main" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
              <section className="card" style={{ minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <div role="alert" style={{ display: 'flex', alignItems: 'flex-end', gap: 10, textAlign: 'left' }}>
                  <BotFace size={48} />
                  <div className="vdoc-bubble">
                    <span style={{ font: '600 13px/1.45 var(--font-sans),sans-serif', color: 'var(--fg)' }}>
                      {mode === 'saved' ? 'This book is not in your library any more.' : 'This explanation is not available yet.'}
                    </span>
                    <Link href={portalHref('knowledge-bank')} style={{ marginTop: 6, fontSize: 12, fontWeight: 700 }}>
                      Back to library →
                    </Link>
                  </div>
                </div>
              </section>
            </main>
          </div>
        </div>
      </div>
    );
  }

  const di = DEPTHS.findIndex((d) => d.d === curDepth);
  const reviewed = answer.origin === 'reviewed' && !answer.draft;
  const official = officialLink(answer.citations);
  const timeline = answer.visual?.type === 'timeline' ? answer.visual : null;
  const facts = answer.visual?.type === 'keyFacts' ? answer.visual : null;
  const otherVisual = answer.visual && !timeline && !facts ? answer.visual : null;
  const today = todayIST();
  const tlKinds = timeline
    ? (() => {
        const k = timeline.events.map((e) => parseWhen(e.when, today));
        let cur = k.findIndex((x) => x !== 'done');
        if (cur < 0) cur = k.length - 1;
        return k.map((x, i) => (i < cur ? 'done' : i === cur ? 'now' : 'next'));
      })()
    : [];
  const secRef = (i: number) => (el: HTMLElement | null) => {
    sectionsRef.current[i] = el;
  };
  const showPill = !!slug;
  const updatedChip = mode === 'saved' && item?.updated;
  const updatedDate = meta?.reviewedAt ? dayMonth(meta.reviewedAt) : null;

  return (
    <div className="cp-reader">
      <div className="vrd">
        <div className="vrd-col">
          <main className="vrd-main">
            <article className="vrd-art">
              <section className="vrd-hero" style={{ position: 'relative', borderRadius: 10, padding: '22px 24px 20px', background: 'linear-gradient(115deg,var(--navy-deep,var(--navy)) 0%,var(--navy-2-deep,var(--navy-2)) 62%,oklch(38% 0.12 292) 100%)', color: '#fff', overflow: 'hidden' }}>
                <div className="vrd-chips">
                  <span className="chip" style={{ background: 'oklch(100% 0 0 / .14)', color: '#fff', boxShadow: 'inset 0 0 0 1px oklch(100% 0 0 / .25)' }}>
                    {categoryName(category, company)}
                  </span>
                  {reviewed ? (
                    <span className="chip" style={{ background: 'var(--ok-chip)', color: '#fff', minWidth: 116, justifyContent: 'center' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                      Reviewed by SBC
                    </span>
                  ) : null}
                  {updatedChip ? (
                    <span className="chip" data-tip="Updated since you saved it" style={{ background: 'var(--prog-chip)', color: '#fff', minWidth: 116, justifyContent: 'center' }}>
                      {updatedDate ? `Updated ${updatedDate}` : 'Updated'}
                    </span>
                  ) : null}
                </div>
                <h1 style={{ margin: '12px 0 0', font: '600 28px/1.2 var(--font-sans),sans-serif', letterSpacing: '-.015em', color: '#fff' }}>{title}</h1>
                <div className="vrd-hrow">
                  {showPill ? (
                    <div className="seg" role="group" aria-label="Depth" style={{ background: 'oklch(100% 0 0 / .1)', boxShadow: 'inset 0 0 0 1px oklch(100% 0 0 / .2)' }}>
                      <span className="thumb" style={{ width: 'calc((100% - 4px)/3)', background: 'light-dark(#fff, oklch(13% 0 89.9))', transform: `translateX(${Math.max(0, di) * 100}%)` }} />
                      {DEPTHS.map((d, i) => (
                        <button
                          key={d.d}
                          type="button"
                          aria-pressed={di === i}
                          aria-busy={topicQ.isFetching && di === i}
                          onClick={() => setDepth(d.d)}
                          style={di === i ? { color: 'var(--navy-ink,var(--navy))', fontWeight: 700 } : { color: 'oklch(100% 0 0 / .78)' }}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <span style={{ flex: 1 }} />
                  <span className="mono" style={{ fontSize: 11, opacity: 0.7 }}>
                    {readMinutes(answer)} min read
                  </span>
                  {official ? (
                    <a href={official.url} target="_blank" rel="noopener noreferrer" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px', borderRadius: 6, background: 'oklch(100% 0 0 / .12)', boxShadow: 'inset 0 0 0 1px oklch(100% 0 0 / .28)', color: '#fff', fontSize: 12 }}>
                      Official link · {official.label}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M8 16L16 8 M9 8h7v7" />
                      </svg>
                      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}> (opens in a new tab)</span>
                    </a>
                  ) : null}
                </div>
                <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'linear-gradient(90deg,var(--gold),oklch(78% 0.1 85 / 0) 70%)' }} />
              </section>

              <section className="card vrd-body" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <p ref={secRef(0)} className="vrd-lead" style={{ margin: 0, fontSize: 17, lineHeight: 1.6, fontWeight: 500, whiteSpace: 'pre-line' }}>
                  {answer.line}
                </p>
                {timeline ? (
                  <div ref={secRef(1)} style={{ borderRadius: 10, background: 'var(--primary-light)', padding: '22px 20px' }}>
                    <div className="lbl" style={{ color: 'var(--violet-text)', marginBottom: 16 }}>
                      Timeline
                    </div>
                    <div className="vrd-tl">
                      {timeline.events.map((ev, i) => {
                        const k = tlKinds[i];
                        return (
                          <span key={`${ev.label}-${i}`} style={{ display: 'contents' }}>
                            {i > 0 ? <span className={`lnk${k === 'done' || (k === 'now' && tlKinds[i - 1] === 'done') ? '' : ' dash'}`} style={{ background: k === 'done' || (k === 'now' && tlKinds[i - 1] === 'done') ? 'var(--ok)' : 'repeating-linear-gradient(90deg,var(--primary) 0 6px,transparent 6px 11px)' }} /> : null}
                            <div className="node">
                              {k === 'done' ? (
                                <span className="dot" style={{ background: 'var(--ok-chip)', color: '#fff' }} role="img" aria-label="Done">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                                  </svg>
                                </span>
                              ) : k === 'now' ? (
                                <span className="dot pulse" style={{ background: 'var(--navy)', color: '#fff', boxShadow: '0 0 0 3px var(--gold)' }} aria-label="Now">
                                  {i + 1}
                                </span>
                              ) : (
                                <span className="dot" style={{ background: 'var(--panel)', color: 'var(--violet-text)', border: '2px dashed var(--primary)', boxSizing: 'border-box' }}>
                                  {i + 1}
                                </span>
                              )}
                              <span style={{ fontWeight: 700, fontSize: 13 }}>{ev.label}</span>
                              <span className="mono cap">{ev.when}</span>
                            </div>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ) : otherVisual ? (
                  <div ref={secRef(1)} className="vrd-visual">
                    <div className="cp-tw">
                      <VisualRenderer visual={otherVisual} />
                    </div>
                  </div>
                ) : null}
                {facts && curDepth === 'detail' ? (
                  <div className="vrd-facts" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 }}>
                    {facts.facts.map((f) => (
                      <div key={f.k} style={{ padding: 12, borderRadius: 8, background: 'var(--raised)' }}>
                        <div className="lbl">{f.k}</div>
                        <div style={{ fontWeight: 700, marginTop: 4 }}>{f.v}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {answer.why ? (
                  <div ref={secRef(2)} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 8, background: 'var(--gold-soft)', border: '1px solid oklch(75% 0.1 85 / .45)' }}>
                    <span style={{ width: 28, height: 28, borderRadius: 99, background: 'var(--gold)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7Z" />
                      </svg>
                    </span>
                    <div>
                      <h2 style={{ margin: 0, font: '600 13px var(--font-sans),sans-serif', color: 'var(--gold-text)' }}>Why it matters to {company}</h2>
                      <p style={{ margin: '4px 0 0', fontSize: 13.5, lineHeight: 1.55 }}>{answer.why}</p>
                    </div>
                  </div>
                ) : null}
                {answer.citations.length ? (
                  <div ref={secRef(3)}>
                    <div className="lbl" style={{ marginBottom: 6 }}>
                      Sources
                    </div>
                    <ul className="vrd-src" style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {answer.citations.map((c) => (
                        <li key={c.id}>
                          {c.url ? (
                            <a href={c.url} target="_blank" rel="noopener noreferrer" className="chip" style={{ height: 26, padding: '0 9px', background: 'var(--raised)', color: 'var(--fg)', boxShadow: 'inset 0 0 0 1px var(--border)', fontWeight: 600 }}>
                              {c.label} ↗
                            </a>
                          ) : (
                            <span className="chip" style={{ height: 26, padding: '0 9px', background: 'var(--raised)', color: 'var(--fg)', boxShadow: 'inset 0 0 0 1px var(--border)', fontWeight: 600 }}>
                              {c.label}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  {savedItem ? (
                    <span className="btn btn-ok">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                      Saved to library
                    </span>
                  ) : (
                    <button type="button" className="btn btn-n" disabled={saving || !engagementId} onClick={() => void save()}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M6.5 4h11v16l-5.5-4-5.5 4Z" />
                      </svg>
                      Save to library
                    </button>
                  )}
                  {savedItem ? (
                    <a className="btn btn-o" href={libraryItemExportHref(savedItem.id)}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 4v11 M7.5 10.5 12 15l4.5-4.5 M5 19.5h14" />
                      </svg>
                      PDF brief
                    </a>
                  ) : null}
                  <button type="button" className="btn btn-o" onClick={() => openChat(`Tell me more about ${title}`)}>
                    <span className="vrd-bot" aria-hidden="true" style={{ width: 18, height: 18, background: 'none' }}>
                      <VisorHead style={{ width: 14, height: 18, marginTop: 3 }} />
                    </span>
                    Ask a follow-up
                  </button>
                  <span style={{ flex: 1 }} />
                  {mode === 'saved' && item ? (
                    <button type="button" className="ib" aria-label="Remove from library" data-tip="Remove from library" onClick={() => void remove()}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4.5 7h15 M9.5 7V4.5h5V7 M6.5 7l1 12.5h9l1-12.5" />
                      </svg>
                    </button>
                  ) : null}
                </div>
              </section>
            </article>

            <aside className="vrd-side">
              {projectCard ? (
                <section className="card t" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <h2 style={{ margin: 0, font: '600 13px var(--font-sans),sans-serif', color: 'var(--navy-ink,var(--navy))' }}>In {company}’s project</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {projectCard.date ? (
                      <span style={{ width: 50, height: 54, borderRadius: 8, background: projectCard.done ? 'var(--ok-chip)' : 'var(--due-chip)', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <span style={{ font: '600 11px var(--font-sans),sans-serif', letterSpacing: '.06em' }}>{MONTHS_SHORT[new Date(`${projectCard.date.slice(0, 10)}T00:00:00`).getMonth()]!.toUpperCase()}</span>
                        <span style={{ font: "600 20px/1 var(--font-sans)" }}>{new Date(`${projectCard.date.slice(0, 10)}T00:00:00`).getDate()}</span>
                      </span>
                    ) : null}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{projectCard.title}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        {projectCard.chip ? (
                          <span className="chip" style={projectCard.chip.s}>
                            {projectCard.chip.t}
                          </span>
                        ) : null}
                        <span className="chip" style={{ background: 'var(--raised)', color: 'var(--muted)' }}>
                          {projectCard.owner}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Link href={projectCard.link.href} style={{ fontSize: 12 }}>
                    {projectCard.link.text}
                  </Link>
                </section>
              ) : null}
              {related.length ? (
                <section className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <h2 style={{ margin: '0 0 6px', font: '600 13px var(--font-sans),sans-serif', color: 'var(--navy-ink,var(--navy))' }}>Related in {company}’s library</h2>
                  {related.map((r, i) => (
                    <Link key={r.slug} href={r.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--hair)', color: 'var(--fg)', fontWeight: 600 }}>
                      <span style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--primary-light)', color: 'var(--violet-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <path d={i % 2 ? 'M7 7h10 M7 12h10 M7 17h6' : 'M5 6h4v4H5Z M15 14h4v4h-4Z M9 8h4a2 2 0 0 1 2 2v4'} />
                        </svg>
                      </span>
                      {r.title}
                    </Link>
                  ))}
                </section>
              ) : null}
              {relDocs.length ? (
                <section className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <h2 style={{ margin: 0, font: '600 13px var(--font-sans),sans-serif', color: 'var(--navy-ink,var(--navy))' }}>Documents for this</h2>
                  {relDocs.map((n, i) => (
                    <LinkButton
                      key={n.id}
                      className="w-full max-[767px]:min-h-[40px]"
                      onClick={() => setViewer({ docs: relDocs.map((x) => toViewerDoc(x)), i })}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--fg)', fontWeight: 600 }}
                    >
                      <span className="mono" style={{ fontSize: 11, fontWeight: 600, padding: '2px 5px', borderRadius: 4, ...tagStyle(n) }}>
                        {tagText(n)}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>{n.label}</span>
                      <span className="chip" style={STATUS_STYLE[n.status]}>
                        {n.status}
                      </span>
                    </LinkButton>
                  ))}
                </section>
              ) : null}
            </aside>
          </main>
        </div>
      </div>
      {viewer ? <DocViewer docs={viewer.docs} index={viewer.i} onClose={() => setViewer(null)} onIndexChange={(i) => setViewer((v) => (v ? { ...v, i } : v))} /> : null}
    </div>
  );
}
