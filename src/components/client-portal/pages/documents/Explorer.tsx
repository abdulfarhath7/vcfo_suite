'use client';

/**
 * Documents explorer — desktop / tablet (prototype s/docs/docs_a_refined.dc.html):
 * toolbar (filter + counter, Status / Replaced toggles, By step · By category
 * pill, Download all ZIP, Upload · N requested), WAI tree (phase → step or
 * category → file, per-step progress bars → drill-down, row kebab menus),
 * preview pane (first page, status badge, Step / From / Date / File / Verify),
 * ZIP / copy toast.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { OTHER_PHASE_ID, OTHER_PHASE_TITLE, type ClientDocumentsPayload, type DocNode } from '@/lib/client-portal/documents';
import type { PortalIncorporationModel } from '@/lib/client-portal/step-model';
import { usePortal } from '@/components/client-portal/PortalProvider';
import { stepHref } from '@/components/client-portal/routes';
import { fileTag, longDate, previewMode } from './file-types';
import {
  buildEntries,
  fileUrl,
  folderCounts,
  GLYPH,
  glyphKey,
  missingLabel,
  missingStyle,
  STATUS_STYLE,
  statusTip,
  stripNo,
  tagStyle,
  tagText,
  tagTip,
  type TEntry,
  type TFolder,
  type View,
} from './model';
import { BotBubble, copyText, docLink, downloadNode, ZipToast, type useZipToast } from './shared-ui';
import type { DrillTarget } from './Drill';

const EYE = 'M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z';
const DL = 'M12 4v11 M7.5 10.5 12 15l4.5-4.5 M5 19.5h14';
const UP = 'M12 15V4 M7.5 8.5 12 4l4.5 4.5 M5 19.5h14';
const ZIP = 'M6 3.5h8l4 4v13H6Z M10 3.5v2 M10 7.5v2 M10 11.5v2 M9 16h2v3H9Z';
const STEP = 'M4.5 4.5h15v15h-15Z M9 12h6 M12 9l3 3-3 3';
const LINK = 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1';
const EYE_OFF = 'M3 3l18 18 M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.6 3.3 M6.6 6.6C3.9 8.4 2.5 12 2.5 12s3.5 6 9.5 6a9 9 0 0 0 4.4-1.1 M9.9 9.9a3 3 0 0 0 4.2 4.2';

function Ico({ d, size = 15, sw = 1.9 }: { d: string; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

interface Row {
  e: TEntry;
  depth: number;
  open: boolean;
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

export function DocsExplorer({ data, model, view, setView, zip, glowId, selectId, onPreview, onUpload, onDrill }: ExplorerProps) {
  const { go } = usePortal();
  const company = data.companyShort;
  const entries = useMemo(() => buildEntries(data.nodes, model, view), [data.nodes, model, view]);
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isOpen = useCallback((id: string) => open[id] ?? true, [open]);
  const [q, setQ] = useState('');
  const [statusOn, setStatusOn] = useState(true);
  const [hid, setHid] = useState(false);
  const [menu, setMenu] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
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
  const shown = useCallback((n: DocNode) => (hid || !n.replaced) && (!ql || n.label.toLowerCase().includes(ql)), [hid, ql]);

  /* ---- default selection, deep links (?doc= / ?folder=) ---- */
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
      setTimeout(() => treeRef.current?.querySelector(`[data-id="${CSS.escape(folderParam)}"]`)?.scrollIntoView({ block: 'nearest' }), 50);
    }
    const target = docParam && byId.get(docParam)?.kind === 'file' ? docParam : null;
    const fallback =
      files.find((f) => f.node.status === 'Final' && !f.node.replaced)?.id ?? files.find((f) => !f.node.replaced && f.node.status !== 'Missing')?.id ?? files[0]?.id ?? null;
    const pick = target ?? fallback;
    setSel(pick);
    if (target) setTimeout(() => treeRef.current?.querySelector(`[data-id="${CSS.escape(target)}"]`)?.scrollIntoView({ block: 'nearest' }), 50);
  }, [byId, files, ancestors, sel, selectId]);
  useEffect(() => {
    if (selectId && byId.has(selectId)) setSel(selectId);
  }, [selectId, byId]);

  /* ---- visible rows (prototype renderVals) ---- */
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const e of entries) {
      const anc = ancestors(e);
      if (!ql && anc.some((a) => !isOpen(a))) continue;
      if (e.kind === 'file') {
        if (!shown(e.node)) continue;
      } else if (!under(e.id).some((f) => shown(f.node))) continue;
      out.push({ e, depth: anc.length, open: ql ? true : isOpen(e.id) });
    }
    return out;
  }, [entries, ancestors, ql, isOpen, shown, under]);

  const totalFiles = files.length;
  const shownFiles = files.filter((f) => shown(f.node)).length;
  const zipAllCount = files.filter((f) => !f.node.replaced && f.node.status !== 'Missing').length;
  const openReq = data.openRequests.length;

  /* ---- outside click closes a row menu ---- */
  useEffect(() => {
    if (!menu) return;
    const out = (ev: globalThis.MouseEvent) => {
      const t = ev.target as HTMLElement;
      if (!t.closest('.menu') && !t.closest('.kb')) setMenu('');
    };
    document.addEventListener('mousedown', out);
    return () => document.removeEventListener('mousedown', out);
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const t = setTimeout(() => (treeRef.current?.querySelector('.menu button') as HTMLElement | null)?.focus(), 10);
    return () => clearTimeout(t);
  }, [menu]);

  const closeMenu = useCallback(
    (refocus = false) => {
      const id = menu;
      setMenu('');
      if (refocus && id) setTimeout(() => (treeRef.current?.querySelector(`[data-id="${CSS.escape(id)}"] .kb`) as HTMLElement | null)?.focus(), 0);
    },
    [menu],
  );

  const viewerList = useCallback(() => rows.filter((r) => r.e.kind === 'file' && r.e.node.status !== 'Missing').map((r) => (r.e as Extract<TEntry, { kind: 'file' }>).node), [rows]);

  const toggle = (id: string, v?: boolean) => setOpen((p) => ({ ...p, [id]: v ?? !(p[id] ?? true) }));
  const setMany = (ids: string[], v: boolean) => setOpen((p) => ({ ...p, ...Object.fromEntries(ids.map((i) => [i, v])) }));
  const subFolders = (id: string) => entries.filter((e) => e.kind === 'folder' && ancestors(e).includes(id)).map((e) => e.id);

  const activate = (e: TEntry) => {
    setMenu('');
    setFocusId(e.id);
    if (e.kind === 'file') setSel(e.id);
    else toggle(e.id);
  };

  const copy = async (param: 'doc' | 'folder', id: string) => {
    setMenu('');
    if (await copyText(docLink(param, id))) zip.copied();
  };

  const stepNoOf = (n: DocNode) => (n.stepId ? model.byId[n.stepId]?.n : undefined);
  const stepLabelOf = (n: DocNode) => {
    const s = n.stepId ? model.byId[n.stepId] : undefined;
    return s ? `${s.n} · ${s.title}` : '—';
  };

  const drillFor = (f: TFolder, part: number) => {
    const kids = under(f.id).map((x) => x.node);
    const name = stripNo(f.label);
    // docs_a_drill banner: "These documents are for <step> in Incorporation · Open Incorporation →".
    // Step-less files ("Other documents") and categories are not in Incorporation: no phase link.
    const other = f.phaseId === OTHER_PHASE_ID;
    onDrill({
      title: f.label,
      name,
      where: f.level === 'cat' ? 'Documents' : other ? OTHER_PHASE_TITLE : 'Incorporation',
      linkText: f.level === 'cat' || other ? null : 'Open Incorporation →',
      onLink: () => go('incorporation'),
      files: kids,
      tab: part,
    });
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
          const list = viewerList();
          onPreview(cur.e.node, list);
        }
        break;
      default:
    }
  };

  const selEntry = sel ? byId.get(sel) : undefined;
  const sn = selEntry?.kind === 'file' ? selEntry.node : undefined;

  return (
    <section
      aria-label="Document explorer"
      style={{ position: 'relative', flex: 1, minHeight: 0, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column' }}
    >
      <div className="vdoc-tools">
        <label className="vdoc-q" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--subtle)', boxSizing: 'border-box' }}>
          <Ico d="M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M16 16l4 4" size={14} sw={2} />
          <input
            type="search"
            aria-label="Filter documents"
            placeholder="Filter documents"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setMenu('');
            }}
            style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'none', font: '500 13px Manrope,sans-serif', color: 'var(--fg)' }}
          />
          <span className="mono" style={{ fontSize: 11, color: 'var(--subtle)' }}>
            {shownFiles}/{totalFiles}
          </span>
        </label>
        <button type="button" className={`tg${statusOn ? ' on' : ''}`} data-tip="Show status icons" aria-pressed={statusOn} onClick={() => setStatusOn((v) => !v)}>
          <span style={{ display: 'flex', gap: 2 }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--ok)' }} />
            <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--prog)' }} />
            <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--due)' }} />
          </span>
          Status
        </button>
        <button type="button" className={`tg${hid ? ' on' : ''}`} data-tip="Show files that were replaced" aria-pressed={hid} onClick={() => setHid((v) => !v)}>
          <Ico d={EYE_OFF} size={14} />
          Replaced
        </button>
        <div className="seg" role="tablist" aria-label="Arrange by" style={{ width: 190 }}>
          <span className="thumb" style={{ width: 'calc((100% - 4px)/2)', transform: `translateX(${view * 100}%)` }} />
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
        <span className="vdoc-sp" />
        <span className="vdoc-acts">
          <button type="button" className="btn btn-o" disabled={!zipAllCount} onClick={() => void zip.startZip('all', `${company} documents`, zipAllCount)}>
            <Ico d={DL} size={14} />
            Download all (ZIP)
          </button>
          {openReq > 0 ? (
            <button type="button" className="btn btn-n" style={{ height: 32 }} onClick={() => onUpload()}>
              <Ico d={UP} size={14} sw={2} />
              Upload · {openReq} requested
            </button>
          ) : null}
        </span>
      </div>

      <div className="vdoc-body">
        <div role="tree" aria-label="Folders and files" className="vdoc-tree" ref={treeRef} onKeyDown={onTreeKey}>
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
            const g = f ? GLYPH[glyphKey(f)] : null;
            const stepNo = f ? stepNoOf(f) : undefined;
            return (
              <div
                key={e.id}
                data-id={e.id}
                role="treeitem"
                aria-level={r.depth + 1}
                aria-expanded={folder ? r.open : undefined}
                aria-selected={selected}
                className={`tr${selected ? ' sel' : ''}${f?.replaced ? ' hid' : ''}${f && glowId === f.id ? ' glow' : ''}`}
                onDoubleClick={() => f && !missing && onPreview(f, viewerList())}
              >
                <button type="button" className="main" tabIndex={tabbable ? 0 : -1} onFocus={() => setFocusId(e.id)} onClick={() => activate(e)}>
                  {Array.from({ length: r.depth }, (_, k) => (
                    <span key={k} className="gd" />
                  ))}
                  <span className="ico" style={{ color: 'var(--subtle)' }}>
                    {folder ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transition: 'transform .15s', transform: `rotate(${r.open ? 90 : 0}deg)` }}>
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    ) : null}
                  </span>
                  {folder ? (
                    <span className="ico">
                      <svg className="fold" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3 18.5V5.5A1.5 1.5 0 0 1 4.5 4h4.2l2 2.4h8.8A1.5 1.5 0 0 1 21 7.9v10.6a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z" fill={r.open ? 'var(--folder-open)' : 'var(--folder)'} />
                        <path className="ln" d="M3 9.2h18" stroke="oklch(100% 0 0 / .35)" strokeWidth="1.3" />
                      </svg>
                    </span>
                  ) : null}
                  {f && !missing ? (
                    <span className="ft tip" role="img" data-tip={tagTip(f)} aria-label={tagTip(f)} style={tagStyle(f)}>
                      {tagText(f)}
                    </span>
                  ) : null}
                  {missing ? (
                    <span className="ico">
                      <span style={{ width: 14, height: 14, borderRadius: 3, border: '1.5px dashed var(--due)', boxSizing: 'border-box' }} />
                    </span>
                  ) : null}
                  <span className="lb">{f ? f.label : folder!.label}</span>
                  {f?.stale ? (
                    <span className="badge tip" data-tip="Bill is older than 2 months. SBC may ask for a newer one." style={{ background: 'var(--due-light)', color: 'var(--due-text)', height: 18, fontSize: 11 }}>
                      Older than 2 months
                    </span>
                  ) : null}
                  {f?.replaced ? (
                    <span className="tip" role="img" data-tip="Replaced by a newer file" aria-label="Replaced by a newer file" style={{ display: 'flex' }}>
                      <Ico d={EYE_OFF} size={14} />
                    </span>
                  ) : null}
                  {missing ? (
                    <span className="badge" style={missingStyle(f!)}>
                      {missingLabel(f!)}
                    </span>
                  ) : null}
                  {f && statusOn && !f.replaced && g ? (
                    <span className="sg tip" role="img" data-tip={statusTip(f, company)} aria-label={statusTip(f, company)} style={g[0]}>
                      <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true">
                        {g[1] ? <path d={g[1]} fill="#fff" /> : null}
                        {g[2] ? <path d={g[2]} fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /> : null}
                      </svg>
                    </span>
                  ) : null}
                  {folder && folder.level === 'phase' ? <span className="cnt">{kids.filter((x) => !x.replaced).length}</span> : null}
                </button>
                {isBar ? (
                  <a
                    className="pb"
                    href="#"
                    data-tip={tip}
                    aria-label={`${tip}. Open the list`}
                    onClick={(ev: MouseEvent<HTMLAnchorElement>) => {
                      ev.preventDefault();
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
                      <span style={{ background: 'var(--ok)', width: `${(c.ok / c.tot) * 100}%` }} />
                      <span style={{ background: 'var(--prog)', width: `${(c.rv / c.tot) * 100}%` }} />
                      <span style={{ background: 'var(--due)', width: `${(c.ms / c.tot) * 100}%` }} />
                    </span>
                    <span className="cnt">
                      {c.ok}/{c.tot}
                    </span>
                  </a>
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
                    <circle cx="12" cy="5.5" r="1.7" />
                    <circle cx="12" cy="12" r="1.7" />
                    <circle cx="12" cy="18.5" r="1.7" />
                  </svg>
                </button>
                {menu === e.id ? (
                  <div
                    className="menu"
                    role="menu"
                    aria-label="Actions"
                    onKeyDown={(ev) => {
                      const items = [...ev.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
                      const at = items.indexOf(document.activeElement as HTMLButtonElement);
                      if (ev.key === 'Escape') {
                        ev.preventDefault();
                        ev.stopPropagation();
                        closeMenu(true);
                      } else if (ev.key === 'ArrowDown') {
                        ev.preventDefault();
                        items[(at + 1) % items.length]?.focus();
                      } else if (ev.key === 'ArrowUp') {
                        ev.preventDefault();
                        items[(at - 1 + items.length) % items.length]?.focus();
                      } else if (ev.key === 'Home') {
                        ev.preventDefault();
                        items[0]?.focus();
                      } else if (ev.key === 'End') {
                        ev.preventDefault();
                        items[items.length - 1]?.focus();
                      }
                    }}
                  >
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
                            <Ico d={UP} sw={1.9} />
                            Upload
                          </button>
                        ) : (
                          <>
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
                          </>
                        )}
                        {stepNo && f?.stepId ? (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenu('');
                              go(stepHref(f.stepId!));
                            }}
                          >
                            <Ico d={STEP} />
                            Open step {stepNo}
                          </button>
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
            <div style={{ padding: '40px 16px' }}>
              <BotBubble size={40} clear={{ label: 'Clear filter', onClick: () => setQ('') }} question={`Why can't I find "${q}" in my documents?`}>
                No document matches “{q}”.
              </BotBubble>
            </div>
          ) : null}
        </div>

        <Pane
          n={sn}
          company={company}
          stepLabel={sn ? stepLabelOf(sn) : '—'}
          onPreview={() => sn && onPreview(sn, viewerList())}
          onUpload={(file) => onUpload(sn?.requestId, file)}
        />
      </div>

      {zip.toast ? <ZipToast t={zip.toast} onClose={zip.dismiss} /> : null}
    </section>
  );
}

function Pane({ n, company, stepLabel, onPreview, onUpload }: { n?: DocNode; company: string; stepLabel: string; onPreview: () => void; onUpload: (file?: File) => void }) {
  const [over, setOver] = useState(false);
  if (!n) {
    return (
      <div className="vdoc-pane">
        <div className="vdoc-pv" />
      </div>
    );
  }
  const missing = n.status === 'Missing';
  const tag = fileTag(n.fileName, n.contentType);
  const mode = previewMode(tag);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onUpload(file);
  };
  return (
    <div className="vdoc-pane">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 52, padding: '0 12px 0 16px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
        <span
          className="ft tip"
          role="img"
          data-tip={missing ? 'Not uploaded yet' : tagTip(n)}
          aria-label={missing ? 'Not uploaded yet' : tagTip(n)}
          style={{ minWidth: 34, width: 'auto', padding: '0 4px', height: 20, lineHeight: '20px', fontSize: 11, ...(missing ? { background: 'var(--due-chip)', color: '#fff' } : tagStyle(n)) }}
        >
          {missing ? '—' : tagText(n)}
        </span>
        <span style={{ font: '700 14px Manrope,sans-serif', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.label}</span>
        <span className="badge" style={STATUS_STYLE[n.status]}>
          {n.status}
        </span>
        {!missing ? (
          <>
            <button type="button" className="ib tip" data-tip="Preview" aria-label="Preview" onClick={onPreview}>
              <Ico d={EYE} />
            </button>
            <button type="button" className="ib tip" data-tip="Download" aria-label="Download" onClick={() => downloadNode(n)}>
              <Ico d={DL} />
            </button>
          </>
        ) : null}
      </div>
      <div className="vdoc-pv">
        {!missing ? (
          mode === 'pdf' || mode === 'image' ? (
            <a
              href="#"
              aria-label="Open in viewer"
              className="vdoc-page real"
              data-paper=""
              onClick={(e) => {
                e.preventDefault();
                onPreview();
              }}
            >
              {mode === 'pdf' ? (
                <iframe key={n.id} title={`${n.label} — first page`} tabIndex={-1} loading="lazy" src={`${fileUrl(n.ref!)}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=Fit`} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={n.id} src={fileUrl(n.ref!)} alt="" loading="lazy" />
              )}
            </a>
          ) : (
            <a
              href="#"
              aria-label="Open in viewer"
              className="vdoc-page"
              data-paper=""
              onClick={(e) => {
                e.preventDefault();
                onPreview();
              }}
            >
              <span style={{ display: 'block', fontSize: 11, letterSpacing: '.1em', color: 'var(--muted)', textTransform: 'uppercase' }}>{tagTip(n)}</span>
              <span style={{ display: 'block', font: "600 18px 'Space Grotesk'", marginTop: 10 }}>{n.label}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{company}</span>
              {[92, 84, 95, 66].map((w, i) => (
                <span key={w} style={{ display: 'block', height: 6, borderRadius: 3, background: 'light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255))', width: `${w}%`, marginTop: i ? 9 : 18 }} />
              ))}
            </a>
          )
        ) : (
          <a
            href="#"
            className={`vdoc-drop${over ? ' over' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              onUpload();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
            style={{ border: '1.5px dashed var(--due)', borderRadius: 10, background: 'var(--due-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--due-text)' }}
          >
            <span style={{ width: 40, height: 40, borderRadius: 99, background: over ? 'var(--navy)' : 'var(--due-chip)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Ico d={UP} size={18} sw={2} />
            </span>
            {over ? (
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--navy-ink,var(--navy))' }}>Release to upload</span>
            ) : (
              <span style={{ fontSize: 13.5 }}>
                Drop the file or <span style={{ color: 'var(--primary)' }}>browse</span>
              </span>
            )}
          </a>
        )}
      </div>
      <div style={{ flex: 'none' }}>
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
          <span className="mono" style={{ fontSize: 12 }}>
            {missing ? (n.due ? longDate(n.due) : '—') : longDate(n.date)}
          </span>
        </div>
        <div className="kv">
          <span>File</span>
          <span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>
            {n.fileName}
          </span>
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
            <a className="tip" data-tip={`Open ${n.portal.label}`} href={n.portal.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {n.portal.label}
              <Ico d="M8 16L16 8 M9 8h7v7" size={12} sw={2.2} />
              <span className="vdoc-sr"> (opens in a new tab)</span>
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}

