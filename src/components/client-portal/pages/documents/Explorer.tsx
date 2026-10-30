'use client';

/**
 * Documents explorer, desktop and tablet: the "All documents" card (owner item E1, 30 Oct 2026).
 * One card that holds one flat table. A toolbar (filter field, the filter chips All · Waiting on
 * you · From SBC · Signed, Replaced, By step · By category, Download all (ZIP), Upload · N
 * requested) sits above it. Rows are grouped by folder (phase or category) under one thin header
 * row, one line per document: file badge · name · folder · from · date · status chip · row menu.
 * The open-folder view (the progress drill-down, `Drill.tsx`) is unchanged and opens from the
 * folder counts. Every action of the old tree and preview pane stays: preview, download, upload
 * against a request (button, menu or a dropped file), open step, verify, copy link, ZIP.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { OTHER_PHASE_ID, OTHER_PHASE_TITLE, type ClientDocumentsPayload, type DocNode } from '@/lib/client-portal/documents';
import type { PortalIncorporationModel } from '@/lib/client-portal/step-model';
import { usePortal } from '@/components/client-portal/PortalProvider';
import { stepHref } from '@/components/client-portal/routes';
import { LinkButton } from '@/components/client-portal/LinkButton';
import { Chip } from '@/components/ui/spectrum-chip';
import { FileBadge } from '@/components/ui/file-badge';
import { longDate } from './file-types';
import {
  buildEntries,
  DOC_FILTERS,
  folderCounts,
  groupEntries,
  matchesFilter,
  missingLabel,
  STATUS_TONE,
  stripNo,
  tagTip,
  type DocFilter,
  type TFolder,
  type View,
} from './model';
import { copyText, docLink, downloadNode, ZipToast, type useZipToast } from './shared-ui';
import type { DrillTarget } from './Drill';

const EYE = 'M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z';
const DL = 'M12 4v11 M7.5 10.5 12 15l4.5-4.5 M5 19.5h14';
const UP = 'M12 15V4 M7.5 8.5 12 4l4.5 4.5 M5 19.5h14';
const ZIP = 'M6 3.5h8l4 4v13H6Z M10 3.5v2 M10 7.5v2 M10 11.5v2 M9 16h2v3H9Z';
const STEP = 'M4.5 4.5h15v15h-15Z M9 12h6 M12 9l3 3-3 3';
const LINK = 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1';
const OUT = 'M14 4.5h5.5V10 M19.5 4.5 11 13 M17 14v5.5H4.5V7H10';
const EYE_OFF = 'M3 3l18 18 M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.6 3.3 M6.6 6.6C3.9 8.4 2.5 12 2.5 12s3.5 6 9.5 6a9 9 0 0 0 4.4-1.1 M9.9 9.9a3 3 0 0 0 4.2 4.2';

function Ico({ d, size = 15, sw = 1.6 }: { d: string; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Dots() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5.5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="18.5" cy="12" r="1.7" />
    </svg>
  );
}

export interface ExplorerProps {
  data: ClientDocumentsPayload;
  model: PortalIncorporationModel;
  view: View;
  setView: (v: View) => void;
  zip: ReturnType<typeof useZipToast>;
  glowId: string | null;
  selectId: string | null;
  onPreview: (n: DocNode, list: DocNode[]) => void;
  onUpload: (requestId?: string, file?: File) => void;
  onDrill: (t: DrillTarget) => void;
}

/** The menu keys: arrows, Home, End move; Escape closes and gives focus back to the ⋯ button. */
function menuKeys(ev: React.KeyboardEvent<HTMLDivElement>, close: () => void) {
  const items = [...ev.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a')];
  const at = items.indexOf(document.activeElement as HTMLElement);
  const to = (i: number) => {
    ev.preventDefault();
    items[(i + items.length) % items.length]?.focus();
  };
  if (ev.key === 'Escape') {
    ev.preventDefault();
    ev.stopPropagation();
    close();
  } else if (ev.key === 'ArrowDown') to(at + 1);
  else if (ev.key === 'ArrowUp') to(at - 1);
  else if (ev.key === 'Home') to(0);
  else if (ev.key === 'End') to(items.length - 1);
}

export function DocsExplorer({ data, model, view, setView, zip, glowId, selectId, onPreview, onUpload, onDrill }: ExplorerProps) {
  const { go } = usePortal();
  const company = data.companyShort;
  const entries = useMemo(() => buildEntries(data.nodes, model, view), [data.nodes, model, view]);
  const groups = useMemo(() => groupEntries(entries), [entries]);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<DocFilter>('all');
  const [hid, setHid] = useState(false);
  const [menu, setMenu] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [dropId, setDropId] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const ql = q.trim().toLowerCase();
  const visible = useCallback(
    (n: DocNode, f: DocFilter = filter) => (hid || !n.replaced) && matchesFilter(n, f) && (!ql || n.label.toLowerCase().includes(ql) || n.fileName.toLowerCase().includes(ql)),
    [hid, ql, filter],
  );
  const allFiles = useMemo(() => groups.flatMap((g) => g.files.map((x) => x.node)), [groups]);
  const counts = useMemo(() => Object.fromEntries(DOC_FILTERS.map((f) => [f.id, allFiles.filter((n) => visible(n, f.id)).length])) as Record<DocFilter, number>, [allFiles, visible]);
  const shownGroups = useMemo(() => groups.map((g) => ({ ...g, rows: g.files.filter((x) => visible(x.node)) })).filter((g) => g.rows.length > 0), [groups, visible]);
  const zipAllCount = allFiles.filter((n) => !n.replaced && n.status !== 'Missing').length;
  const openReq = data.openRequests.length;

  const scrollTo = (id: string) => setTimeout(() => wrapRef.current?.querySelector(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' }), 50);

  /* ---- deep links (?doc= / ?folder=) and the row picked after an upload ---- */
  const linked = useRef(false);
  useEffect(() => {
    if (linked.current || !entries.length) return;
    linked.current = true;
    const params = new URLSearchParams(window.location.search);
    const doc = params.get('doc');
    const folder = params.get('folder');
    if (folder) {
      const e = entries.find((x) => x.id === folder);
      const root = e?.parent ?? (e ? e.id : null);
      if (root) {
        setClosed((p) => ({ ...p, [root]: false }));
        scrollTo(folder);
      }
    }
    if (doc && allFiles.some((n) => n.id === doc)) {
      setSel(doc);
      scrollTo(doc);
    }
  }, [entries, allFiles]);
  useEffect(() => {
    if (!selectId) return;
    setSel(selectId);
    scrollTo(selectId);
  }, [selectId]);

  /* ---- outside click closes a row menu; an open menu takes focus ---- */
  useEffect(() => {
    if (!menu) return;
    const out = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement;
      if (!t.closest('.menu') && !t.closest('.kb')) setMenu('');
    };
    document.addEventListener('mousedown', out);
    const t = setTimeout(() => (wrapRef.current?.querySelector('.menu button:not(:disabled), .menu a') as HTMLElement | null)?.focus(), 10);
    return () => {
      document.removeEventListener('mousedown', out);
      clearTimeout(t);
    };
  }, [menu]);
  const closeMenu = () => {
    const id = menu;
    setMenu('');
    if (id) setTimeout(() => (wrapRef.current?.querySelector(`[data-menu="${CSS.escape(id)}"]`) as HTMLElement | null)?.focus(), 0);
  };

  /** The viewer steps through the files the table shows, in table order. */
  const viewerList = useCallback(() => shownGroups.flatMap((g) => (closed[g.folder.id] ? [] : g.rows.map((x) => x.node))).filter((n) => n.status !== 'Missing'), [shownGroups, closed]);

  const copy = async (param: 'doc' | 'folder', id: string) => {
    setMenu('');
    if (await copyText(docLink(param, id))) zip.copied();
  };

  const stepOf = (n: DocNode) => (n.stepId ? model.byId[n.stepId] : undefined);

  /* The open-folder view (unchanged): the drill-down over one folder's files. */
  const drillFor = (f: TFolder, files: DocNode[]) => {
    const other = f.phaseId === OTHER_PHASE_ID;
    onDrill({
      title: f.label,
      name: stripNo(f.label),
      where: f.level === 'cat' ? 'Documents' : other ? OTHER_PHASE_TITLE : 'Incorporation',
      linkText: f.level === 'cat' || other ? null : 'Open Incorporation →',
      onLink: () => go('incorporation'),
      files,
      tab: 0,
    });
  };

  const open = (n: DocNode) => {
    setMenu('');
    setSel(n.id);
    if (n.status === 'Missing') onUpload(n.requestId);
    else onPreview(n, viewerList());
  };

  const onDrop = (n: DocNode) => (e: DragEvent) => {
    e.preventDefault();
    setDropId('');
    const file = e.dataTransfer.files?.[0];
    if (file) onUpload(n.requestId, file);
  };

  return (
    <section aria-label="All documents" className="sx-card vdoc-card vdoc-flat">
      <div className="vdoc-tools">
        <label className="vdoc-q sx-in sm">
          <Ico d="M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M16 16l4 4" />
          <input
            type="search"
            aria-label="Filter documents"
            placeholder="Filter documents"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setMenu('');
            }}
          />
        </label>
        <div className="vdoc-chips" role="group" aria-label="Show">
          {DOC_FILTERS.map((f) => (
            <button key={f.id} type="button" className="sx-filter" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
              <b className="mono">{counts[f.id]}</b>
            </button>
          ))}
        </div>
        <button type="button" className="sx-filter tip" data-tip="Show files that were replaced" aria-pressed={hid} onClick={() => setHid((v) => !v)}>
          <Ico d={EYE_OFF} size={14} />
          Replaced
        </button>
        <span className="vdoc-sp" />
        <div className="sx-seg" role="tablist" aria-label="Arrange by">
          {(['By step', 'By category'] as const).map((l, i) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={view === i}
              className={view === i ? 'on' : ''}
              onClick={() => {
                setMenu('');
                setView(i as View);
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <span className="vdoc-acts">
          <button type="button" className="sx-btn sm" disabled={!zipAllCount} onClick={() => void zip.startZip('all', `${company} documents`, zipAllCount)}>
            <Ico d={DL} />
            Download all (ZIP)
          </button>
          {openReq > 0 ? (
            <button type="button" className="sx-btn sm p" onClick={() => onUpload()}>
              <Ico d={UP} />
              Upload · {openReq} requested
            </button>
          ) : null}
        </span>
      </div>

      <div className="vdoc-wrap" ref={wrapRef}>
        <table className="vdoc-tbl">
          <colgroup>
            <col className="c-ft" />
            <col className="c-nm" />
            <col className="c-fd" />
            <col className="c-fr" />
            <col className="c-dt" />
            <col className="c-st" />
            <col className="c-mn" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">
                <span className="vdoc-sr">Type</span>
              </th>
              <th scope="col">Name</th>
              <th scope="col" className="c-fd">
                Folder
              </th>
              <th scope="col" className="c-fr">
                From
              </th>
              <th scope="col">Date</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="vdoc-sr">Actions</span>
              </th>
            </tr>
          </thead>
          {shownGroups.map((g) => {
            const gf = g.folder;
            const isClosed = !ql && closed[gf.id];
            const kids = g.files.map((x) => x.node);
            const c = folderCounts(kids);
            const zipCount = kids.filter((x) => !x.replaced && x.status !== 'Missing').length;
            const gMenu = `g:${gf.id}`;
            return (
              <tbody key={gf.id}>
                <tr className="vdoc-grp" data-id={gf.id}>
                  <th colSpan={6} scope="rowgroup">
                    <span className="vdoc-gh">
                      <button
                        type="button"
                        className="vdoc-gt"
                        aria-expanded={!isClosed}
                        onClick={() => setClosed((p) => ({ ...p, [gf.id]: !p[gf.id] }))}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transition: 'transform .15s', transform: `rotate(${isClosed ? 0 : 90}deg)` }}>
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                        {gf.label}
                      </button>
                      {c.tot > 0 ? (
                        <LinkButton className="vdoc-gc tip" data-tip={`${c.ok} received · ${c.rv} in review · ${c.ms} missing`} aria-label={`${stripNo(gf.label)}: ${c.ok} of ${c.tot} received. Open the folder`} onClick={() => drillFor(gf, kids)}>
                          {c.ok}/{c.tot}
                        </LinkButton>
                      ) : null}
                    </span>
                  </th>
                  <td className="vdoc-mc">
                    <button
                      type="button"
                      className={`kb${menu === gMenu ? ' open' : ''}`}
                      data-menu={gMenu}
                      aria-label={`More actions for ${gf.label}`}
                      aria-haspopup="menu"
                      aria-expanded={menu === gMenu}
                      onClick={() => setMenu((m) => (m === gMenu ? '' : gMenu))}
                    >
                      <Dots />
                    </button>
                    {menu === gMenu ? (
                      <div className="menu" role="menu" aria-label="Folder actions" tabIndex={-1} onKeyDown={(ev) => menuKeys(ev, closeMenu)}>
                        <button
                          type="button"
                          role="menuitem"
                          disabled={!zipCount}
                          onClick={() => {
                            setMenu('');
                            void zip.startZip(gf.zipKey, stripNo(gf.label), zipCount);
                          }}
                        >
                          <Ico d={ZIP} />
                          Download folder as ZIP<span className="k">{zipCount} files</span>
                        </button>
                        <hr />
                        <button type="button" role="menuitem" onClick={() => void copy('folder', gf.id)}>
                          <Ico d={LINK} />
                          Copy link to folder
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
                {isClosed
                  ? null
                  : g.rows.map(({ node: n, leaf }) => {
                      const missing = n.status === 'Missing';
                      const step = stepOf(n);
                      const folderText = leaf.level === 'cat' ? (step ? `${step.n} · ${step.title}` : OTHER_PHASE_TITLE) : leaf.label;
                      const leafFiles = view === 0 ? g.files.filter((x) => x.leaf.id === leaf.id).map((x) => x.node) : [];
                      const leafZip = leafFiles.filter((x) => !x.replaced && x.status !== 'Missing').length;
                      const sub = n.replaced ? 'Replaced' : n.stale ? 'Older than 2 months' : n.note ? `“${n.note}”` : missing ? null : n.fileName;
                      return (
                        <tr
                          key={n.id}
                          data-id={n.id}
                          className={`vdoc-row${sel === n.id ? ' sel' : ''}${n.replaced ? ' hid' : ''}${glowId === n.id ? ' glow' : ''}${dropId === n.id ? ' over' : ''}`}
                          onDragOver={
                            missing
                              ? (e) => {
                                  e.preventDefault();
                                  setDropId(n.id);
                                }
                              : undefined
                          }
                          onDragLeave={missing ? () => setDropId('') : undefined}
                          onDrop={missing ? onDrop(n) : undefined}
                        >
                          <td className="c-ft">
                            {missing ? (
                              <span className="ft-miss" role="img" aria-label="Not uploaded yet" />
                            ) : (
                              <span className="cp-tw tip" role="img" data-tip={tagTip(n)} aria-label={tagTip(n)}>
                                <FileBadge name={n.fileName} />
                              </span>
                            )}
                          </td>
                          <td className="c-nm">
                            <button type="button" className="vdoc-nm" onClick={() => open(n)} aria-label={missing ? `Upload ${n.label}` : `Preview ${n.label}`}>
                              <span className={missing ? 'lb miss' : 'lb'}>{n.label}</span>
                              {sub ? <span className="vdoc-sub">{sub}</span> : null}
                            </button>
                          </td>
                          <td className="c-fd">
                            {leafFiles.length ? (
                              <LinkButton className="vdoc-fd" onClick={() => drillFor(leaf, leafFiles)}>
                                {folderText}
                              </LinkButton>
                            ) : (
                              <span className="vdoc-fd">{folderText}</span>
                            )}
                          </td>
                          <td className="c-fr">
                            <span className="vdoc-tx">{n.from}</span>
                          </td>
                          <td className="c-dt">
                            <span className="vdoc-tx mono">{missing ? (n.due ? longDate(n.due) : '—') : longDate(n.date)}</span>
                          </td>
                          <td className="c-st">
                            {missing ? (
                              <Chip fixed raw tone={n.overdue ? 'bad' : 'warn'}>
                                {missingLabel(n)}
                              </Chip>
                            ) : (
                              <Chip fixed raw tone={STATUS_TONE[n.status]}>
                                {n.status}
                              </Chip>
                            )}
                          </td>
                          <td className="vdoc-mc">
                            <button
                              type="button"
                              className={`kb${menu === n.id ? ' open' : ''}`}
                              data-menu={n.id}
                              aria-label={`More actions for ${n.label}`}
                              aria-haspopup="menu"
                              aria-expanded={menu === n.id}
                              onClick={() => setMenu((m) => (m === n.id ? '' : n.id))}
                            >
                              <Dots />
                            </button>
                            {menu === n.id ? (
                              <div className="menu" role="menu" aria-label="Actions" tabIndex={-1} onKeyDown={(ev) => menuKeys(ev, closeMenu)}>
                                {missing ? (
                                  <button type="button" role="menuitem" onClick={() => open(n)}>
                                    <Ico d={UP} />
                                    Upload
                                  </button>
                                ) : (
                                  <>
                                    <button type="button" role="menuitem" onClick={() => open(n)}>
                                      <Ico d={EYE} />
                                      Preview
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        setMenu('');
                                        downloadNode(n);
                                      }}
                                    >
                                      <Ico d={DL} />
                                      Download
                                    </button>
                                  </>
                                )}
                                {step && n.stepId ? (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setMenu('');
                                      go(stepHref(n.stepId!));
                                    }}
                                  >
                                    <Ico d={STEP} />
                                    Open step {step.n}
                                  </button>
                                ) : null}
                                {leafFiles.length ? (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    disabled={!leafZip}
                                    onClick={() => {
                                      setMenu('');
                                      void zip.startZip(leaf.zipKey, stripNo(leaf.label), leafZip);
                                    }}
                                  >
                                    <Ico d={ZIP} />
                                    Download folder as ZIP<span className="k">{leafZip} files</span>
                                  </button>
                                ) : null}
                                {n.portal ? (
                                  <a role="menuitem" href={n.portal.url} target="_blank" rel="noopener noreferrer" onClick={() => setMenu('')}>
                                    <Ico d={OUT} />
                                    Verify on {n.portal.label}
                                    <span className="vdoc-sr"> (opens in a new tab)</span>
                                  </a>
                                ) : null}
                                <hr />
                                <button type="button" role="menuitem" onClick={() => void copy('doc', n.id)}>
                                  <Ico d={LINK} />
                                  Copy link
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            );
          })}
        </table>
        {shownGroups.length === 0 ? (
          <div className="sx-empty" role="status">
            <span>No documents here</span>
            <button
              type="button"
              className="sx-btn sm"
              onClick={() => {
                setQ('');
                setFilter('all');
              }}
            >
              Show all
            </button>
          </div>
        ) : null}
      </div>

      {zip.toast ? <ZipToast t={zip.toast} onClose={zip.dismiss} /> : null}
    </section>
  );
}
