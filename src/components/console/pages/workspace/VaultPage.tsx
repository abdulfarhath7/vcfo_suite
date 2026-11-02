'use client';

/**
 * DOCUMENT VAULT — /app/manager/vault and /app/intern/vault (prototype
 * mxRenderers.vault, a59s: client chips and file tiles). The live vault
 * (src/views/vault/DocumentVaultPage.tsx, the same view for manager and lead)
 * in the console's look, with the same data:
 *   - every file uploaded on a checklist step (from each engagement's full
 *     checklist, reloaded on open as live does) plus the documents-table index
 *     (GET /api/documents), de-duplicated and kept to the caller's engagements;
 *     a lead sees only the clients they lead (internVisibleDocuments)
 *   - one chip per client with its file count (every client, files or not)
 *   - the chosen client's files By step (phase → step → section, as live) or
 *     By type (the prototype's "By category", by file type)
 *   - search by document, step, section or client name (also ?q=), results
 *     across the book with where each file sits
 *   - Preview, and Open in a new tab through the same short-lived link
 *   - Open client / Open step
 * The vault is read-only, as live: uploads and replacements happen on the step.
 * Clients follow the top-bar Stage filter.
 */
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { getItem } from '@/data/checklist';
import { useApp } from '@/context/AppContext';
import { internVisibleDocuments } from '@/lib/document-access';
import { engagementIdAliases } from '@/lib/legacy-engagement-ids';
import { getMilestoneDocumentSignedUrl, isMilestoneStoragePath } from '@/lib/milestone-document-storage';
import { stepSlugForItemId } from '@/lib/slug';
import { getIndexedDocumentSignedUrl, useIndexedDocuments } from '@/lib/use-vault-documents';
import {
  collectIndexedVaultDocuments,
  collectVaultDocuments,
  filterVaultEntityGroups,
  groupVaultDocuments,
  mergeVaultDocuments,
  scopeVaultDocumentsToEngagements,
  vaultLocationLabel,
  vaultSearchHits,
  type VaultDocument,
  type VaultEntityGroup,
} from '@/lib/vault-documents';
import { useConsole, useConsolePalette, useCrumbs, type PaletteItem } from '../../runtime';
import { Btn, ClientAv, Icon, Seg, hueOf } from '../../ui';
import { companyInitials, stageOf, stepCode } from '../clients/model';
import { dayLabel, fileTag, groupByFamily, plural } from './model';
import { ErrorLine, FilePreview, PanelLoading } from './shared';

type By = 'step' | 'type';
const CLIENT_KEY = 'vcfo-vault-client';
const BY_KEY = 'vcfo-vault-by';

function signedUrlOf(doc: VaultDocument): Promise<string | null> {
  if (doc.source === 'index' && doc.documentId && !isMilestoneStoragePath(doc.storagePath)) return getIndexedDocumentSignedUrl(doc.documentId);
  if (!doc.storagePath.trim()) return Promise.resolve(null);
  return getMilestoneDocumentSignedUrl(doc.storagePath);
}

function stepName(milestoneId: string, title: string): string {
  const code = stepCode(milestoneId);
  return code !== milestoneId ? `${code} · ${title}` : title;
}

export function VaultPage() {
  useCrumbs(['Document vault']);
  return (
    <Suspense fallback={<Frame count="Loading…" body={<PanelLoading label="Loading documents…" />} />}>
      <Vault />
    </Suspense>
  );
}

function Frame({ count, q, setQ, body }: { count: string; q?: string; setQ?: (v: string) => void; body: ReactNode }) {
  return (
    <>
      <div className="sec-h">
        <h2>Document vault</h2>
        <span className="sec-count">{count}</span>
        <span className="sp" />
        <div className="search mx-q">
          <Icon name="search" />
          <input placeholder="Search by document name" aria-label="Search by document name" value={q ?? ''} onChange={(e) => setQ?.(e.target.value)} disabled={!setQ} />
        </div>
      </div>
      {body}
    </>
  );
}

function Vault() {
  const { base, seat, go, scope, openModal, toast } = useConsole();
  const { user, engagements, engagementsLoading, engagementsSettled, getStateForEngagement, refreshEngagementChecklist } = useApp();
  const params = useSearchParams();
  const urlQ = params?.get('q') ?? '';
  const [q, setQ] = useState(urlQ);
  useEffect(() => setQ(urlQ), [urlQ]);
  const isLead = seat === 'lead' || user?.role === 'intern';

  /* ---------- the full checklist of every engagement (live), loading shown the first time only */
  const indexed = useIndexedDocuments(Boolean(user) && !engagementsLoading);
  const idsKey = useMemo(() => engagements.map((e) => e.id).join(','), [engagements]);
  const refreshRef = useRef(refreshEngagementChecklist);
  useEffect(() => {
    refreshRef.current = refreshEngagementChecklist;
  }, [refreshEngagementChecklist]);
  const [refreshed, setRefreshed] = useState<string | null>(null);
  useEffect(() => {
    if (engagementsLoading) return;
    if (!idsKey) {
      setRefreshed('');
      return;
    }
    let cancelled = false;
    void Promise.all(idsKey.split(',').map((id) => refreshRef.current(id))).finally(() => {
      if (!cancelled) setRefreshed(idsKey);
    });
    return () => {
      cancelled = true;
    };
  }, [idsKey, engagementsLoading]);
  const loading = !engagementsSettled || engagementsLoading || refreshed === null;

  /* ---------- documents (live DocumentVaultPage) */
  const allDocs = useMemo(() => {
    const milestoneDocs = collectVaultDocuments(engagements, getStateForEngagement);
    const indexedDocs = collectIndexedVaultDocuments(indexed.data ?? [], engagements);
    const merged = scopeVaultDocumentsToEngagements(mergeVaultDocuments(milestoneDocs, indexedDocs), engagements);
    return user?.role === 'intern' ? internVisibleDocuments(user.internId, merged, engagements) : merged;
  }, [engagements, getStateForEngagement, indexed.data, user?.internId, user?.role]);

  /* ---------- Stage filter */
  const stageOfId = useMemo(() => {
    const m = new Map<string, 'inc' | 'cmp'>();
    for (const e of engagements) {
      const st = stageOf(e, getStateForEngagement(e));
      for (const id of engagementIdAliases(e.id)) m.set(id, st);
    }
    return m;
  }, [engagements, getStateForEngagement]);
  const docs = useMemo(() => allDocs.filter((d) => scope === 'all' || (stageOfId.get(d.engagementId) ?? scope) === scope), [allDocs, scope, stageOfId]);
  const groups = useMemo(
    () => groupVaultDocuments(allDocs, engagements, { includeEmpty: true }).filter((g) => scope === 'all' || (stageOfId.get(g.engagementId) ?? scope) === scope),
    [allDocs, engagements, scope, stageOfId],
  );
  const filtered = useMemo(() => filterVaultEntityGroups(groups, q), [groups, q]);
  const hits = useMemo(() => vaultSearchHits(docs, q), [docs, q]);
  const searching = q.trim().length > 0;

  /* ---------- chosen client and grouping (remembered for the session) */
  const [active, setActive] = useState<string | null>(null);
  const [by, setByState] = useState<By>('step');
  useEffect(() => {
    try {
      setActive(sessionStorage.getItem(CLIENT_KEY));
      if (sessionStorage.getItem(BY_KEY) === 'type') setByState('type');
    } catch {
      /* storage unavailable */
    }
  }, []);
  const pick = (id: string) => {
    setActive(id);
    try {
      sessionStorage.setItem(CLIENT_KEY, id);
    } catch {
      /* storage unavailable */
    }
  };
  const setBy = (v: By) => {
    setByState(v);
    try {
      sessionStorage.setItem(BY_KEY, v);
    } catch {
      /* storage unavailable */
    }
  };
  const selectedId = (active && filtered.some((g) => g.engagementId === active) ? active : null) ?? filtered[0]?.engagementId ?? null;
  const selected = filtered.find((g) => g.engagementId === selectedId) ?? null;

  const projectHref = (g: Pick<VaultEntityGroup, 'engagementId' | 'slug'>) => `${base}/projects/${g.slug ?? engagements.find((e) => e.id === g.engagementId)?.slug ?? g.engagementId}`;
  const stepHref = (doc: VaultDocument) => {
    if (!getItem(doc.milestoneId)) return null;
    const slug = engagements.find((e) => engagementIdAliases(e.id).includes(doc.engagementId))?.slug ?? doc.engagementId;
    return `${base}/projects/${slug}/step/${stepSlugForItemId(doc.milestoneId)}`;
  };

  const openFile = async (doc: VaultDocument) => {
    const url = await signedUrlOf(doc);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else toast(`The link to ${doc.fileName} is not available`);
  };
  const preview = (doc: VaultDocument) => {
    const href = stepHref(doc);
    openModal(
      <FilePreview
        title={doc.fileName}
        fileName={doc.fileName}
        meta={[doc.companyName, vaultLocationLabel(doc), doc.fieldLabel !== doc.fileName ? doc.fieldLabel : '', doc.uploadedAt ? `Uploaded ${dayLabel(doc.uploadedAt)}` : ''].filter(Boolean).join(' · ')}
        load={() => signedUrlOf(doc)}
        extra={
          href ? (
            <Btn ico="step" onClick={() => go(href)}>
              Open step
            </Btn>
          ) : null
        }
      />,
      { cls: 'ws-prevm', label: 'Document preview' },
    );
  };

  /* ---------- search palette: every document in view */
  const palette = useMemo<PaletteItem[]>(
    () =>
      docs.map((d) => ({
        id: `vault:${d.id}`,
        label: d.fileName,
        kind: `Document · ${d.companyName}`,
        sw: hueOf(d.engagementId),
        go: () => go(`${base}/vault?q=${encodeURIComponent(d.fileName)}`),
      })),
    [docs, go, base],
  );
  useConsolePalette('vault-docs', palette);

  if (loading) return <Frame count="Loading…" q={q} setQ={setQ} body={<PanelLoading label="Loading documents…" />} />;

  const count = `${plural(docs.length, 'document')} · ${plural(groups.length, 'client')}`;

  if (!engagements.length) {
    return (
      <Frame
        count={count}
        q={q}
        setQ={setQ}
        body={
          <section className="glass panel mx-p">
            <div className="mx-empty">
              <Icon name="folder" />
              <b>{isLead ? 'No clients assigned yet' : 'No submitted documents yet'}</b>
              <span>{isLead ? 'Files appear here once a client is assigned to you.' : 'Files clients and leads upload on checklist steps appear here.'}</span>
            </div>
            <div className="ws-center">
              <Btn cls="sm" ico="grid" onClick={() => go(isLead ? `${base}/clients` : `${base}/projects`)}>
                Open clients
              </Btn>
            </div>
          </section>
        }
      />
    );
  }

  const tile = (doc: VaultDocument, flat: boolean, withClient: boolean) => {
    const tag = fileTag(doc.fileName);
    const what = doc.fieldLabel && doc.fieldLabel.toLowerCase() !== doc.fileName.toLowerCase() ? doc.fieldLabel : doc.section !== doc.milestoneTitle ? doc.section : '';
    const where = [withClient ? doc.companyName : '', flat ? stepName(doc.milestoneId, doc.milestoneTitle) : ''].filter(Boolean).join(' · ');
    return (
      <div key={doc.id} className="glass mx-ftile">
        <div className="mx-fth">
          <span className={'mx-ft2 big ' + tag.cls}>{tag.text}</span>
          <span className="small ws-num" title={doc.uploadedAt ? `Uploaded ${dayLabel(doc.uploadedAt)}` : 'Upload date not recorded'}>
            {dayLabel(doc.uploadedAt)}
          </span>
        </div>
        <b className="ws-ell2" title={doc.fileName}>
          {doc.fileName}
        </b>
        {what ? (
          <span className="small ws-ell" title={what}>
            {what}
          </span>
        ) : null}
        {where ? (
          <span className="small ws-ell" title={where}>
            {where}
          </span>
        ) : null}
        <div className="mx-ftf">
          <Btn cls="sm" ico="eye" onClick={() => preview(doc)} ariaLabel={`Preview ${doc.fileName}`}>
            Preview
          </Btn>
          <button type="button" className="ib sm" aria-label={`Open ${doc.fileName} in a new tab`} title="Open in a new tab" onClick={() => void openFile(doc)}>
            <Icon name="ext" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <Frame
      count={count}
      q={q}
      setQ={setQ}
      body={
        <>
          {indexed.isError ? <ErrorLine text="Some files could not be loaded (the document index). Files on checklist steps are all here." onRetry={() => void indexed.refetch()} /> : null}

          {filtered.length ? (
            <div className="mx-vchips" role="group" aria-label="Clients">
              {filtered.map((g) => (
                <button
                  key={g.engagementId}
                  type="button"
                  className={'mx-vchip' + (g.engagementId === selectedId ? ' on' : '')}
                  style={{ ['--cc' as string]: hueOf(g.engagementId) }}
                  aria-pressed={g.engagementId === selectedId}
                  title={`${g.companyName} · ${plural(g.docCount, 'file')}`}
                  onClick={() => pick(g.engagementId)}
                >
                  <ClientAv id={g.engagementId} label={companyInitials(g.companyName)} />
                  <span className="mx-dt">
                    <b className="ws-ell">{g.companyName}</b>
                    <span>{plural(g.docCount, 'file')}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {searching ? (
            <section className="glass panel mx-p">
              <div className="ph">
                <div className="mx-pt">
                  <h3>Results</h3>
                  <span className="small">{`${plural(hits.length, 'file')} matching “${q.trim()}”`}</span>
                </div>
                <span className="sp" />
                <button type="button" className="link" onClick={() => setQ('')}>
                  Clear search
                </button>
              </div>
              {hits.length ? (
                <div className="mx-ftiles">{hits.map((h) => tile(h.doc, true, true))}</div>
              ) : (
                <div className="mx-empty">
                  <Icon name="search" />
                  <b>No documents match your search</b>
                  <span>Try a file name, a step like Registered Office Address, or a client.</span>
                </div>
              )}
            </section>
          ) : !selected ? (
            <section className="glass panel mx-p">
              <div className="mx-empty">
                <Icon name="grid" />
                <b>{scope === 'inc' ? 'No incorporating client is in your book' : scope === 'cmp' ? 'No client in the compliance stage is in your book' : 'No clients to show'}</b>
                <span>Switch the stage to All to see every client.</span>
              </div>
            </section>
          ) : (
            <>
              <div className="mx-tb">
                <h3 className="mx-h3 ws-ell" title={selected.companyName}>
                  {selected.companyName}
                </h3>
                <span className="small ws-num">{`${plural(selected.docCount, 'document')} · ${selected.stage}`}</span>
                <Seg<By>
                  className="sm"
                  ariaLabel="Group the files"
                  value={by}
                  onChange={setBy}
                  options={[
                    { value: 'step', label: 'By step' },
                    { value: 'type', label: 'By type' },
                  ]}
                />
                <span className="sp" />
                <button type="button" className="link" onClick={() => go(projectHref(selected))}>
                  Open client
                  <Icon name="chev" size={14} />
                </button>
              </div>
              {selected.docCount === 0 ? (
                <section className="glass panel mx-p">
                  <div className="mx-empty">
                    <Icon name="folder" />
                    <b>No files for this client yet</b>
                    <span>Files uploaded on the client&apos;s checklist steps appear here.</span>
                  </div>
                </section>
              ) : by === 'step' ? (
                selected.phases.map((phase) => (
                  <section key={phase.phaseKey} className="glass panel mx-p" aria-label={phase.phaseLabel}>
                    <div className="ph">
                      <div className="mx-pt">
                        <h3>{phase.phaseLabel}</h3>
                        <span className="small">{`${plural(phase.docCount, 'file')} · ${plural(phase.milestones.length, 'step')}`}</span>
                      </div>
                    </div>
                    {phase.milestones.map((m, mi) => {
                      const first = m.sections[0]?.docs[0];
                      const href = first ? stepHref(first) : null;
                      return (
                        <div key={m.milestoneId} className="mx-vg">
                          <div className={'mx-sub-h' + (mi === 0 ? ' ws-first' : '')}>
                            <span className="eyebrow ws-ell" title={m.milestoneTitle}>
                              {stepName(m.milestoneId, m.milestoneTitle)}
                            </span>
                            <span className="small ws-num">{plural(m.docCount, 'file')}</span>
                            {href ? (
                              <button type="button" className="link ws-steplink" onClick={() => go(href)}>
                                Open step
                              </button>
                            ) : null}
                          </div>
                          {m.sections.map((s) => (
                            <div key={s.section} className="ws-sec">
                              {m.sections.length > 1 ? <span className="small ws-secl">{s.section}</span> : null}
                              <div className="mx-ftiles">{s.docs.map((d) => tile(d, false, false))}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </section>
                ))
              ) : (
                groupByFamily(
                  selected.milestones.flatMap((m) => m.sections.flatMap((s) => s.docs)),
                  (d) => d.fileName,
                  (d) => d.uploadedAt,
                ).map((g) => (
                  <section key={g.family} className="glass panel mx-p" aria-label={g.label}>
                    <div className="ph">
                      <div className="mx-pt">
                        <h3>{g.label}</h3>
                        <span className="small">{plural(g.items.length, 'file')}</span>
                      </div>
                    </div>
                    <div className="mx-ftiles">{g.items.map((d) => tile(d, true, false))}</div>
                  </section>
                ))
              )}
            </>
          )}
        </>
      }
    />
  );
}
