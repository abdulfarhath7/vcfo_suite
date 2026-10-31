'use client';

/**
 * Documents explorer, desktop and tablet (owner fix E1, 31 Oct 2026). The layout is the one from
 * before 30 Oct, made simpler: a toolbar, a folder tree on the left (folders open and close, like
 * a code editor's side panel) and the preview of the picked file on the right. Nothing sits in a
 * card: the parts sit on the page ground, and one 2 px line separates the tree from the preview.
 *
 * Kept from the 30 Oct table: the filter chips (All · Waiting on you · From SBC · Signed), one
 * line per document with the secondary text in faint ink, a status chip column, and every action
 * (preview, download, folder ZIP, upload against a request by button, menu or a dropped file,
 * open step, verify, copy link, deep links). The open-folder view (`Drill.tsx`) opens from the
 * progress bars. Under 1000 px the tree folds into a drop-down above the preview.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { OTHER_PHASE_ID, OTHER_PHASE_TITLE, type ClientDocumentsPayload, type DocNode } from '@/lib/client-portal/documents';
import type { PortalIncorporationModel } from '@/lib/client-portal/step-model';
import { usePortal } from '@/components/client-portal/PortalProvider';
import { stepHref } from '@/components/client-portal/routes';
import { LinkButton } from '@/components/client-portal/LinkButton';
import { onActivate } from '@/components/client-portal/a11y';
import { Chip } from '@/components/ui/spectrum-chip';
import { FileBadge } from '@/components/ui/file-badge';
import { fileTag, longDate, previewMode } from './file-types';
import {
  buildEntries,
  DOC_FILTERS,
  fileUrl,
  folderCounts,
  matchesFilter,
  missingLabel,
  STATUS_TONE,
  stripNo,
  tagStyle,
  tagText,
  tagTip,
  treeRows,
  type DocFilter,
  type TEntry,
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
const CHEV = 'M9 6l6 6-6 6';

/** The tree folds into a drop-down at this width and below (the phone board starts under 700 px). */
const NARROW = '(max-width: 999px)';

function Ico({ d, size = 15, sw = 1.6 }: { d: string; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Chev({ open, size = 15 }: { open: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transition: 'transform .15s', transform: `rotate(${open ? 90 : 0}deg)` }}>
      <path d={CHEV} />
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
function menuKeys(ev: KeyboardEvent<HTMLDivElement>, close: () => void) {
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
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isOpen = useCallback((id: string) => open[id] ?? true, [open]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<DocFilter>('all');
  const [hid, setHid] = useState(false);
  const [menu, setMenu] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [dropId, setDropId] = useState('');
  const [treeOpen, setTreeOpen] = useState(true);
  const treeRef = useRef<HTMLDivElement>(null);

  const ancestors = useCallback(
    (e: TEntry): string[] => {
      const out: string[] = [];
      let p = e.parent;
      while (p) {
        out.push(p);
        p = byId.get(p)?.parent ?? null;
      }
      return out;
    },
    [byId],
  );
  const files = useMemo(() => entries.filter((e): e is Extract<TEntry, { kind: 'file' }> => e.kind === 'file'), [entries]);
  const under = useCallback((id: string) => files.filter((f) => ancestors(f).includes(id)), [files, ancestors]);
  const ql = q.trim().toLowerCase();
  const pass = useCallback(
    (n: DocNode, f: DocFilter) => (hid || !n.replaced) && matchesFilter(n, f) && (!ql || n.label.toLowerCase().includes(ql) || n.fileName.toLowerCase().includes(ql)),
    [hid, ql],
  );
  const shown = useCallback((n: DocNode) => pass(n, filter), [pass, filter]);
  const counts = useMemo(() => Object.fromEntries(DOC_FILTERS.map((f) => [f.id, files.filter((x) => pass(x.node, f.id)).length])) as Record<DocFilter, number>, [files, pass]);

  const scrollTo = (id: string) => setTimeout(() => treeRef.current?.querySelector(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' }), 50);

  /* ---- default selection, deep links (?doc= / ?folder=), the row picked after an upload ---- */
  useEffect(() => {
    if (sel && byId.has(sel)) return;
    const params = new URLSearchParams(window.location.search);
    const docParam = selectId ?? params.get('doc');
    const folderParam = params.get('folder');
    if (folderParam && byId.has(folderParam)) {
      const o: Record<string, boolean> = {};
      for (const a of ancestors(byId.get(folderParam)!)) o[a] = true;
      o[folderParam] = true;
      setOpen((p) => ({ ...p, ...o }));
      setFocusId(folderParam);
      scrollTo(folderParam);
    }
    const target = docParam && byId.get(docParam)?.kind === 'file' ? docParam : null;
    const fallback =
      files.find((f) => f.node.status === 'Final' && !f.node.replaced)?.id ?? files.find((f) => !f.node.replaced && f.node.status !== 'Missing')?.id ?? files[0]?.id ?? null;
    setSel(target ?? fallback);
    if (target) scrollTo(target);
  }, [byId, files, ancestors, sel, selectId]);
  useEffect(() => {
    if (!selectId || !byId.has(selectId)) return;
    setSel(selectId);
    scrollTo(selectId);
  }, [selectId, byId]);

  const rows = useMemo(() => treeRows(entries, shown, isOpen, !!ql), [entries, shown, isOpen, ql]);
  const zipAllCount = files.filter((f) => !f.node.replaced && f.node.status !== 'Missing').length;
  const openReq = data.openRequests.length;

  /* ---- outside click closes a row menu; an open menu takes focus ---- */
  useEffect(() => {
    if (!menu) return;
    const out = (ev: globalThis.MouseEvent) => {
      const t = ev.target as HTMLElement;
      if (!t.closest('.menu') && !t.closest('.kb')) setMenu('');
    };
    document.addEventListener('mousedown', out);
    const t = setTimeout(() => (treeRef.current?.querySelector('.menu button:not(:disabled), .menu a') as HTMLElement | null)?.focus(), 10);
    return () => {
      document.removeEventListener('mousedown', out);
      clearTimeout(t);
    };
  }, [menu]);
  const closeMenu = () => {
    const id = menu;
    setMenu('');
    if (id) setTimeout(() => (treeRef.current?.querySelector(`[data-id="${CSS.escape(id)}"] .kb`) as HTMLElement | null)?.focus(), 0);
  };

  /** The viewer steps through the files the tree shows, in tree order. */
  const viewerList = useCallback(() => rows.flatMap((r) => (r.e.kind === 'file' && r.e.node.status !== 'Missing' ? [r.e.node] : [])), [rows]);

  const toggle = (id: string, v?: boolean) => setOpen((p) => ({ ...p, [id]: v ?? !(p[id] ?? true) }));
  const setMany = (ids: string[], v: boolean) => setOpen((p) => ({ ...p, ...Object.fromEntries(ids.map((i) => [i, v])) }));
  const subFolders = (id: string) => entries.filter((e) => e.kind === 'folder' && ancestors(e).includes(id)).map((e) => e.id);

  /** Pick a file: the preview shows it; on a narrow screen the tree drop-down closes. */
  const pick = (id: string) => {
    setSel(id);
    if (window.matchMedia(NARROW).matches) setTreeOpen(false);
  };

  const activate = (e: TEntry) => {
    setMenu('');
    setFocusId(e.id);
    if (e.kind === 'file') pick(e.id);
    else toggle(e.id);
  };

  const copy = async (param: 'doc' | 'folder', id: string) => {
    setMenu('');
    if (await copyText(docLink(param, id))) zip.copied();
  };

  const stepOf = (n: DocNode) => (n.stepId ? model.byId[n.stepId] : undefined);

  /* The open-folder view (unchanged): the drill-down over one folder's files. */
  const drillFor = (f: TFolder, part: number) => {
    const other = f.phaseId === OTHER_PHASE_ID;
    onDrill({
      title: f.label,
      name: stripNo(f.label),
      where: f.level === 'cat' ? 'Documents' : other ? OTHER_PHASE_TITLE : 'Incorporation',
      linkText: f.level === 'cat' || other ? null : 'Open Incorporation →',
      onLink: () => go('incorporation'),
      files: under(f.id).map((x) => x.node),
      tab: part,
    });
  };

  /* A double click on a file row opens it in the viewer (delegated from the tree). */
  const onTreeDoubleClick = (ev: MouseEvent<HTMLDivElement>) => {
    const id = (ev.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]')?.dataset.id;
    const e = rows.find((r) => r.e.id === id)?.e;
    if (e?.kind === 'file' && e.node.status !== 'Missing') onPreview(e.node, viewerList());
  };

  /* ---- WAI tree keys ---- */
  const onTreeKey = (ev: KeyboardEvent<HTMLDivElement>) => {
    if ((ev.target as HTMLElement).closest('.menu')) return;
    const idx = rows.findIndex((r) => r.e.id === (focusId ?? sel));
    const cur = rows[idx];
    const focusRow = (i: number) => {
      const r = rows[Math.max(0, Math.min(rows.length - 1, i))];
      if (!r) return;
      setFocusId(r.e.id);
      (treeRef.current?.querySelector(`[data-id="${CSS.escape(r.e.id)}"] .main`) as HTMLElement | null)?.focus();
    };
    switch (ev.key) {
      case 'ArrowDown':
        ev.preventDefault();
        focusRow(idx + 1);
        break;
      case 'ArrowUp':
        ev.preventDefault();
        focusRow(idx - 1);
        break;
      case 'Home':
        ev.preventDefault();
        focusRow(0);
        break;
      case 'End':
        ev.preventDefault();
        focusRow(rows.length - 1);
        break;
      case 'ArrowRight':
        if (cur?.e.kind === 'folder') {
          ev.preventDefault();
          if (!cur.open) toggle(cur.e.id, true);
          else focusRow(idx + 1);
        }
        break;
      case 'ArrowLeft':
        if (!cur) break;
        ev.preventDefault();
        if (cur.e.kind === 'folder' && cur.open) toggle(cur.e.id, false);
        else if (cur.e.parent) focusRow(rows.findIndex((r) => r.e.id === cur.e.parent));
        break;
      case 'Enter':
        if (cur?.e.kind === 'file' && sel === cur.e.id && cur.e.node.status !== 'Missing') {
          ev.preventDefault();
          onPreview(cur.e.node, viewerList());
        }
        break;
      default:
    }
  };

  const onRowDrop = (n: DocNode) => (e: DragEvent) => {
    e.preventDefault();
    setDropId('');
    const file = e.dataTransfer.files?.[0];
    if (file) onUpload(n.requestId, file);
  };

  const selEntry = sel ? byId.get(sel) : undefined;
  const sn = selEntry?.kind === 'file' ? selEntry.node : undefined;
  const snStep = sn ? stepOf(sn) : undefined;

  return (
    <section aria-label="Documents" className="vdoc-ex">
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
            <button
              key={f.id}
              type="button"
              className="sx-filter"
              aria-pressed={filter === f.id}
              onClick={() => {
                setMenu('');
                setFilter(f.id);
              }}
            >
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

      <div className="vdoc-body">
        <button type="button" className="vdoc-tt" aria-expanded={treeOpen} aria-controls="vdoc-tree" onClick={() => setTreeOpen((v) => !v)}>
          <Chev open={treeOpen} />
          <span className="vdoc-tt-l">Folders</span>
          {sn ? <span className="vdoc-sub">{sn.label}</span> : null}
        </button>
        <div
          id="vdoc-tree"
          role="tree"
          aria-label="Folders and files"
          className={`vdoc-tree${treeOpen ? '' : ' shut'}`}
          ref={treeRef}
          tabIndex={-1}
          onKeyDown={onTreeKey}
          onDoubleClick={onTreeDoubleClick}
        >
          {rows.map((r, i) => {
            const e = r.e;
            const f = e.kind === 'file' ? e.node : undefined;
            const folder = e.kind === 'folder' ? e : undefined;
            const selected = sel === e.id;
            const kids = folder ? under(folder.id).map((x) => x.node) : [];
            const c = folderCounts(kids);
            const isBar = folder && (folder.level === 'step' || folder.level === 'cat') && c.tot > 0;
            const missing = f?.status === 'Missing';
            const zipCount = kids.filter((x) => !x.replaced && x.status !== 'Missing').length;
            const tip = folder ? `${stripNo(folder.label)} · ${c.ok} received · ${c.rv} in review · ${c.ms} missing` : '';
            const tabbable = (focusId ?? sel ?? rows[0]?.e.id) === e.id || (!rows.some((x) => x.e.id === (focusId ?? sel)) && i === 0);
            const step = f ? stepOf(f) : undefined;
            const sub = !f ? null : f.replaced ? 'Replaced' : f.stale ? 'Older than 2 months' : f.note ? `“${f.note}”` : missing ? null : f.fileName;
            return (
              <div
                key={e.id}
                data-id={e.id}
                role="treeitem"
                tabIndex={-1}
                aria-level={r.depth + 1}
                aria-expanded={folder ? r.open : undefined}
                aria-selected={selected}
                className={`tr${folder ? ' fd' : ''}${selected ? ' sel' : ''}${f?.replaced ? ' hid' : ''}${f && glowId === f.id ? ' glow' : ''}${dropId === e.id ? ' over' : ''}`}
                onDragOver={
                  missing
                    ? (ev) => {
                        ev.preventDefault();
                        setDropId(e.id);
                      }
                    : undefined
                }
                onDragLeave={missing ? () => setDropId('') : undefined}
                onDrop={missing ? onRowDrop(f!) : undefined}
              >
                <button type="button" className="main" tabIndex={tabbable ? 0 : -1} onFocus={() => setFocusId(e.id)} onClick={() => activate(e)}>
                  {Array.from({ length: r.depth }, (_, k) => (
                    <span key={k} className="gd" />
                  ))}
                  <span className="ico chev">{folder ? <Chev open={r.open} /> : null}</span>
                  {folder ? (
                    <span className="fico" aria-hidden="true">
                      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3 18.5V5.5A1.5 1.5 0 0 1 4.5 4h4.2l2 2.4h8.8A1.5 1.5 0 0 1 21 7.9v10.6a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z" fill="currentColor" />
                      </svg>
                    </span>
                  ) : null}
                  {f && !missing ? (
                    <span className="ft tip" role="img" data-tip={tagTip(f)} aria-label={tagTip(f)} style={tagStyle(f)}>
                      {tagText(f)}
                    </span>
                  ) : null}
                  {missing ? <span className="ft-miss" role="img" aria-label="Not uploaded yet" /> : null}
                  <span className={`lb${f ? ' fl' : ''}${missing ? ' miss' : ''}`}>{f ? f.label : folder!.label}</span>
                  {f ? <span className="vdoc-sub">{sub}</span> : null}
                  {f ? (
                    <span className="vdoc-st">
                      {missing ? (
                        <Chip fixed raw tone={f.overdue ? 'bad' : 'warn'}>
                          {missingLabel(f)}
                        </Chip>
                      ) : (
                        <Chip fixed raw tone={STATUS_TONE[f.status]}>
                          {f.status}
                        </Chip>
                      )}
                    </span>
                  ) : null}
                  {folder && folder.level === 'phase' ? <span className="cnt">{kids.filter((x) => !x.replaced).length}</span> : null}
                </button>
                {isBar ? (
                  <LinkButton
                    className="pb"
                    data-tip={tip}
                    aria-label={`${tip}. Open the folder`}
                    onClick={(ev: MouseEvent<HTMLButtonElement>) => {
                      let part = 0;
                      const trk = (ev.currentTarget.querySelector('.trk') as HTMLElement | null)?.getBoundingClientRect();
                      if (ev.detail > 0 && trk && ev.clientX >= trk.left && ev.clientX <= trk.right) {
                        const x = (ev.clientX - trk.left) / trk.width;
                        part = x < c.ok / c.tot ? 1 : x < (c.ok + c.rv) / c.tot ? 2 : 3;
                      }
                      drillFor(folder!, part);
                    }}
                  >
                    <span className="trk">
                      <span style={{ background: 'oklch(var(--positive-mid))', width: `${(c.ok / c.tot) * 100}%` }} />
                      <span style={{ background: 'oklch(var(--brand))', width: `${(c.rv / c.tot) * 100}%` }} />
                      <span style={{ background: 'oklch(var(--warning-mid))', width: `${(c.ms / c.tot) * 100}%` }} />
                    </span>
                    <span className="cnt">
                      {c.ok}/{c.tot}
                    </span>
                  </LinkButton>
                ) : null}
                <button
                  type="button"
                  className={`kb tip${menu === e.id ? ' open' : ''}`}
                  data-tip="More actions"
                  aria-label={`More actions for ${f ? f.label : folder!.label}`}
                  aria-haspopup="menu"
                  aria-expanded={menu === e.id}
                  tabIndex={-1}
                  onClick={() => setMenu((m) => (m === e.id ? '' : e.id))}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="5.5" cy="12" r="1.7" />
                    <circle cx="12" cy="12" r="1.7" />
                    <circle cx="18.5" cy="12" r="1.7" />
                  </svg>
                </button>
                {menu === e.id ? (
                  <div className="menu" role="menu" aria-label={folder ? 'Folder actions' : 'Actions'} tabIndex={-1} onKeyDown={(ev) => menuKeys(ev, closeMenu)}>
                    {folder ? (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          disabled={!zipCount}
                          onClick={() => {
                            setMenu('');
                            void zip.startZip(folder.zipKey, stripNo(folder.label), zipCount);
                          }}
                        >
                          <Ico d={ZIP} />
                          Download folder as ZIP<span className="k">{zipCount} files</span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMany([folder.id, ...subFolders(folder.id)], true);
                            setMenu('');
                          }}
                        >
                          <Ico d="M7 9l5-5 5 5 M7 15l5 5 5-5" />
                          Expand all
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMany([folder.id, ...subFolders(folder.id)], false);
                            setMenu('');
                          }}
                        >
                          <Ico d="M7 4l5 5 5-5 M7 20l5-5 5 5" />
                          Collapse all
                        </button>
                        <hr />
                        <button type="button" role="menuitem" onClick={() => void copy('folder', folder.id)}>
                          <Ico d={LINK} />
                          Copy link to folder
                        </button>
                      </>
                    ) : (
                      <>
                        {missing ? (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenu('');
                              setSel(e.id);
                              onUpload(f!.requestId);
                            }}
                          >
                            <Ico d={UP} />
                            Upload
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setMenu('');
                                setSel(e.id);
                                onPreview(f!, viewerList());
                              }}
                            >
                              <Ico d={EYE} />
                              Preview
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setMenu('');
                                downloadNode(f!);
                              }}
                            >
                              <Ico d={DL} />
                              Download
                            </button>
                          </>
                        )}
                        {step && f?.stepId ? (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenu('');
                              go(stepHref(f.stepId!));
                            }}
                          >
                            <Ico d={STEP} />
                            Open step {step.n}
                          </button>
                        ) : null}
                        {f?.portal ? (
                          <a role="menuitem" href={f.portal.url} target="_blank" rel="noopener noreferrer" onClick={() => setMenu('')}>
                            <Ico d={OUT} />
                            Verify on {f.portal.label}
                            <span className="vdoc-sr"> (opens in a new tab)</span>
                          </a>
                        ) : null}
                        <hr />
                        <button type="button" role="menuitem" onClick={() => void copy('doc', e.id)}>
                          <Ico d={LINK} />
                          Copy link
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
          {rows.length === 0 ? (
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

        <Pane
          n={sn}
          company={company}
          stepLabel={snStep ? `${snStep.n} · ${snStep.title}` : '—'}
          accept={data.accept}
          onPreview={() => sn && onPreview(sn, viewerList())}
          onUpload={(file) => onUpload(sn?.requestId, file)}
        />
      </div>

      {zip.toast ? <ZipToast t={zip.toast} onClose={zip.dismiss} /> : null}
    </section>
  );
}

function Pane({
  n,
  company,
  stepLabel,
  accept,
  onPreview,
  onUpload,
}: {
  n?: DocNode;
  company: string;
  stepLabel: string;
  accept: { exts: string[]; maxLabel: string };
  onPreview: () => void;
  onUpload: (file?: File) => void;
}) {
  const [over, setOver] = useState(false);
  /* The same caption the upload dialog shows, from the real accept list and size limit. */
  const acceptCap = `${accept.exts
    .filter((e) => e !== 'jpeg' && e !== 'doc')
    .map((e) => e.toUpperCase())
    .join(' · ')} · up to ${accept.maxLabel}`;
  if (!n) {
    return (
      <div className="vdoc-pane">
        <div className="vdoc-pv" />
      </div>
    );
  }
  const missing = n.status === 'Missing';
  const mode = previewMode(fileTag(n.fileName, n.contentType));
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onUpload(file);
  };
  return (
    <div className="vdoc-pane" aria-label="Preview" role="region">
      <div className="vdoc-ph">
        {missing ? (
          <span className="ft-miss lg" role="img" aria-label="Not uploaded yet" />
        ) : (
          <span className="cp-tw tip" role="img" data-tip={tagTip(n)} aria-label={tagTip(n)}>
            <FileBadge name={n.fileName} />
          </span>
        )}
        <span className="vdoc-pt">{n.label}</span>
        <span className="cp-tw">
          {missing ? (
            <Chip fixed raw tone={n.overdue ? 'bad' : 'warn'}>
              {missingLabel(n)}
            </Chip>
          ) : (
            <Chip fixed raw tone={STATUS_TONE[n.status]}>
              {n.status}
            </Chip>
          )}
        </span>
        {!missing ? (
          <>
            <button type="button" className="sx-ib sm edge tip" data-tip="Preview" aria-label="Preview" onClick={onPreview}>
              <Ico d={EYE} />
            </button>
            <button type="button" className="sx-ib sm edge tip" data-tip="Download" aria-label="Download" onClick={() => downloadNode(n)}>
              <Ico d={DL} />
            </button>
          </>
        ) : null}
      </div>
      <div className="vdoc-pv">
        {!missing ? (
          mode === 'pdf' || mode === 'image' ? (
            <div role="button" tabIndex={0} aria-label="Open in viewer" className="vdoc-page real" data-paper="" onClick={() => onPreview()} onKeyDown={onActivate(onPreview)}>
              {mode === 'pdf' ? (
                <iframe key={n.id} title={`${n.label} — first page`} tabIndex={-1} loading="lazy" src={`${fileUrl(n.ref!)}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=Fit`} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={n.id} src={fileUrl(n.ref!)} alt="" loading="lazy" />
              )}
            </div>
          ) : (
            <div role="button" tabIndex={0} aria-label="Open in viewer" className="vdoc-page" data-paper="" onClick={() => onPreview()} onKeyDown={onActivate(onPreview)}>
              <span className="vdoc-pg-k">{tagTip(n)}</span>
              <span className="vdoc-pg-t">{n.label}</span>
              <span className="vdoc-pg-k">{company}</span>
              {[92, 84, 95, 66].map((w) => (
                <span key={w} className="vdoc-pg-ln" style={{ width: `${w}%` }} />
              ))}
            </div>
          )
        ) : (
          <LinkButton
            className={`vdoc-drop${over ? ' over' : ''}`}
            onClick={() => onUpload()}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            <span className="vdoc-drop-ic">
              <Ico d={UP} size={18} />
            </span>
            <b>{over ? 'Release to upload' : 'Drop the file here'}</b>
            {over ? null : <span className="vdoc-drop-cap">{acceptCap}</span>}
            {over ? null : <span className="sx-btn sm">Choose file</span>}
          </LinkButton>
        )}
      </div>
      <div className="vdoc-kv">
        <div className="kv">
          <span>Step</span>
          <span>{stepLabel}</span>
        </div>
        <div className="kv">
          <span>From</span>
          <span>{n.from}</span>
        </div>
        <div className="kv">
          <span>{missing ? 'Due' : 'Date'}</span>
          <span className="mono">{missing ? (n.due ? longDate(n.due) : '—') : longDate(n.date)}</span>
        </div>
        <div className="kv">
          <span>File</span>
          <span className="idm">{n.fileName}</span>
        </div>
        {n.note ? (
          <div className="kv">
            <span>Note</span>
            <span>“{n.note}”</span>
          </div>
        ) : null}
        {n.portal ? (
          <div className="kv">
            <span>Verify</span>
            <a href={n.portal.url} target="_blank" rel="noopener noreferrer">
              {n.portal.label}
              <span className="vdoc-sr"> (opens in a new tab)</span>
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
