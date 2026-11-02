'use client';

/**
 * KNOWLEDGE BANK — /app/manager/knowledge-bank and /app/intern/knowledge-bank
 * (prototype mxRenderers.knowledge, a59s: shelves as spines on a shelf, and
 * mxUploadKb). The live library (src/views/knowledge-bank/*) in the console's
 * look, with the same data and rules:
 *   - GET /api/knowledge-bank (files + folders), refreshed on the live poll
 *   - the top-level folders are the shelves; a shelf opens its folder, folders
 *     nest (?folder=<id>, as live), the path goes back up
 *   - search (also ?q=): folders by name, files by title, file name,
 *     description, folder path or uploader, across the whole library
 *   - Upload document (title, file, "when to use" = description, folder) into
 *     S3 through /api/knowledge-bank/upload + register; New folder
 *   - Preview and Download through the file's short-lived link
 *   - Delete files and empty folders: managers (and admins) only, as live
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { useRealtimeKnowledgeBank } from '@/hooks/use-realtime-knowledge-bank';
import { isAdminOrManager } from '@/lib/auth';
import {
  isKnowledgeBankFolderEmpty,
  knowledgeBankChildFolders,
  knowledgeBankFilesInFolder,
  knowledgeBankFolderAncestors,
  knowledgeBankFolderPath,
} from '@/lib/knowledge-bank/knowledge-bank-folders';
import { removeKnowledgeBankStorageObject, uploadKnowledgeBankFile, validateKnowledgeBankUploadFile } from '@/lib/knowledge-bank/knowledge-bank-storage';
import { isUuid } from '@/lib/slug';
import { errorMessage } from '@/lib/toast-errors';
import { KNOWLEDGE_BANK_EXTENSIONS, maxUploadSizeLabel, resolveUploadContentType } from '@/lib/upload-limits';
import type { KnowledgeBankFile, KnowledgeBankFolder } from '@/views/knowledge-bank/knowledge-bank-ui-state';
import { useConsole, useConsolePalette, useCrumbs, type PaletteItem } from '../../runtime';
import { ModalBody } from '../../overlays';
import { Btn, Icon, hueOf } from '../../ui';
import { dayLabel, kbSearch, kbShelfOf, kbShelves, kbSubtree, kbUploaderLabel, plural, shelfColor, sizeLabel } from './model';
import { ConfirmBox, ErrorLine, FilePreview, PanelLoading } from './shared';

const KB_KEY = ['knowledge-bank'] as const;

type Library = { files: KnowledgeBankFile[]; folders: KnowledgeBankFolder[] };

/** Live fetchKnowledgeBankLibrary (older servers sent a bare file array). */
async function fetchLibrary(): Promise<Library> {
  const res = await fetch('/api/knowledge-bank');
  const data: unknown = await res.json();
  const body = data as { ok?: boolean; files?: KnowledgeBankFile[]; folders?: KnowledgeBankFolder[]; error?: string };
  if (!res.ok || (body && typeof body === 'object' && !Array.isArray(body) && body.ok === false)) throw new Error(body?.error ?? 'fetch_failed');
  if (Array.isArray(data)) return { files: data as KnowledgeBankFile[], folders: [] };
  return { files: Array.isArray(body?.files) ? body.files : [], folders: Array.isArray(body?.folders) ? body.folders : [] };
}

async function downloadUrl(file: KnowledgeBankFile): Promise<string | null> {
  try {
    const res = await fetch(`/api/knowledge-bank/${file.id}/download`);
    const data = (await res.json()) as { ok: boolean; url?: string };
    return res.ok && data.ok && data.url ? data.url : null;
  } catch {
    return null;
  }
}

export function KnowledgePage() {
  useCrumbs(['Knowledge bank']);
  return (
    <Suspense fallback={<PanelLoading label="Loading the library…" />}>
      <Library />
    </Suspense>
  );
}

function Library() {
  const { base, go, toast, openModal } = useConsole();
  const { user } = useApp();
  const qc = useQueryClient();
  useRealtimeKnowledgeBank({ user, queryClient: qc });
  const canDelete = isAdminOrManager(user?.role);
  const home = `${base}/knowledge-bank`;

  const lib = useQuery({ queryKey: KB_KEY, queryFn: fetchLibrary, staleTime: 30_000 });
  const folders = useMemo(() => lib.data?.folders ?? [], [lib.data]);
  const files = useMemo(() => lib.data?.files ?? [], [lib.data]);

  const params = useSearchParams();
  const urlQ = params?.get('q') ?? '';
  const [q, setQ] = useState(urlQ);
  useEffect(() => setQ(urlQ), [urlQ]);
  const folderParam = params?.get('folder') ?? null;
  const requested = folderParam && isUuid(folderParam) ? folderParam : null;
  const current = requested && (lib.isPending || folders.some((f) => f.id === requested)) ? requested : null;

  const ancestors = useMemo(() => knowledgeBankFolderAncestors(current, folders), [current, folders]);
  const currentName = ancestors.at(-1)?.name;
  const shelves = useMemo(() => kbShelves(folders, files), [folders, files]);
  const openShelf = kbShelfOf(current, folders);
  const searching = q.trim().length > 0;
  const view = useMemo(() => {
    if (searching) return kbSearch(q, folders, files);
    return { folders: knowledgeBankChildFolders(current, folders), files: knowledgeBankFilesInFolder(current, files) };
  }, [searching, q, folders, files, current]);
  // at the top the shelves are the folders, so the list holds only the loose files
  const listFolders = !searching && !current ? [] : view.folders;

  const colorOf = (folderId: string | null): string => {
    const top = kbShelfOf(folderId, folders);
    if (!top) return 'var(--ice)';
    const f = folders.find((x) => x.id === top);
    return (f && shelfColor(f.name)) ?? hueOf(top);
  };
  const openFolder = (id: string | null) => {
    setQ('');
    go(id ? `${home}?folder=${id}` : home);
  };
  const refresh = () => qc.invalidateQueries({ queryKey: KB_KEY });

  /* ---------- actions */
  const upload = () => openModal(<UploadDoc folders={folders} into={current} onDone={(folderId) => openFolder(folderId)} />, { label: 'Upload to the library' });
  const newFolder = () => openModal(<NewFolder parentId={current} parentName={currentName} />, { label: 'New folder' });
  const download = async (file: KnowledgeBankFile) => {
    const url = await downloadUrl(file);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else toast('Download failed.');
  };
  const preview = (file: KnowledgeBankFile) =>
    openModal(
      <FilePreview
        title={file.title}
        fileName={file.fileName}
        contentType={file.mimeType}
        meta={[file.fileName, file.folderPath || 'Knowledge bank', sizeLabel(file.sizeBytes), `${dayLabel(file.createdAt)} · ${kbUploaderLabel(file)}`].filter(Boolean).join(' · ')}
        load={() => downloadUrl(file)}
        openLabel="Download"
      />,
      { cls: 'ws-prevm', label: 'Document preview' },
    );
  const delFile = (file: KnowledgeBankFile) =>
    openModal(
      <ConfirmBox
        title="Delete this document?"
        sub={`"${file.title}" will be permanently removed from the Knowledge Bank. This cannot be undone.`}
        confirm="Delete"
        danger
        onConfirm={async () => {
          const res = await fetch(`/api/knowledge-bank/${file.id}`, { method: 'DELETE' }).catch(() => null);
          const data = (res ? await res.json().catch(() => ({})) : {}) as { ok?: boolean; error?: string };
          if (!res || !res.ok || !data.ok) return data.error ?? 'Delete failed.';
          toast('Document removed from Knowledge Bank.');
          await refresh();
        }}
      />,
      { label: 'Delete this document' },
    );
  const delFolder = (folder: KnowledgeBankFolder) =>
    openModal(
      <ConfirmBox
        title="Delete this folder?"
        sub={`"${folder.name}" will be removed. Only empty folders can be deleted.`}
        confirm="Delete"
        danger
        onConfirm={async () => {
          const res = await fetch(`/api/knowledge-bank/folders/${folder.id}`, { method: 'DELETE' }).catch(() => null);
          const data = (res ? await res.json().catch(() => ({})) : {}) as { ok?: boolean; error?: string };
          if (!res || !res.ok || !data.ok) return data.error === 'folder_not_empty' ? 'Remove files and subfolders first.' : data.error ?? 'Delete failed.';
          toast('Folder removed.');
          if (current === folder.id) openFolder(folder.parentId);
          await refresh();
        }}
      />,
      { label: 'Delete this folder' },
    );

  /* ---------- search palette */
  const palette = useMemo<PaletteItem[]>(
    () => [
      ...files.map((f) => ({
        id: `kb:${f.id}`,
        label: f.title,
        kind: `Knowledge bank · ${f.folderPath || 'Top level'}`,
        sw: 'var(--law-FEMA)',
        go: () => go(f.folderId ? `${home}?folder=${f.folderId}` : `${home}?q=${encodeURIComponent(f.title)}`),
      })),
      ...folders.map((f) => ({ id: `kbf:${f.id}`, label: f.name, kind: 'Knowledge bank folder', sw: 'var(--law-FEMA)', go: () => go(`${home}?folder=${f.id}`) })),
    ],
    [files, folders, go, home],
  );
  useConsolePalette('knowledge-bank', palette);

  const currentEmpty = current ? isKnowledgeBankFolderEmpty(current, folders, files) : false;

  return (
    <>
      <div className="sec-h">
        <h2>Knowledge bank</h2>
        <span className="sec-count">{lib.isPending ? 'Loading…' : `${plural(files.length, 'document')} · ${plural(folders.length, 'folder')}`}</span>
        <span className="sp" />
        <div className="search mx-q">
          <Icon name="search" />
          <input placeholder="Search the library" aria-label="Search the library" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Btn cls="sm" ico="folder" onClick={newFolder}>
          New folder
        </Btn>
        <Btn cls="sm pri" ico="up" onClick={upload}>
          Upload document
        </Btn>
      </div>

      {lib.isPending ? (
        <PanelLoading label="Loading the library…" />
      ) : lib.isError ? (
        <section className="glass panel mx-p">
          <ErrorLine text="Could not load the knowledge bank." onRetry={() => void lib.refetch()} />
        </section>
      ) : (
        <>
          {shelves.length ? (
            <section className="glass mx-shelfw">
              <div className="mx-spines" role="group" aria-label="Shelves">
                {shelves.map((s) => {
                  const on = openShelf === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={'mx-spine' + (on ? ' on' : '')}
                      aria-pressed={on}
                      style={{ ['--sc' as string]: shelfColor(s.name) ?? hueOf(s.id), height: 150 + (s.files % 5) * 12, width: 46 + Math.min(s.files, 14) * 2 }}
                      title={`${s.name} · ${plural(s.files, 'document')}${s.folders ? ` · ${plural(s.folders, 'folder')}` : ''}${on && current === s.id ? ' · click to close' : ''}`}
                      onClick={() => openFolder(current === s.id ? null : s.id)}
                    >
                      <b>{s.name}</b>
                      <span>{s.files}</span>
                    </button>
                  );
                })}
                <span className="mx-bookend" />
              </div>
              <div className="mx-shelfb" />
              <div className="mx-shelft">
                <span className="small">{currentName ? `Open: ${ancestors.map((a) => a.name).join(' › ')}` : 'Pick a spine to open its shelf · its width and number show how many documents it holds'}</span>
                <span className="sp" />
                <span className="small">
                  <Icon name="lock" size={12} /> {canDelete ? 'You can delete files and empty folders; leads can upload and read.' : 'Only managers can delete files here; you can upload and read.'}
                </span>
              </div>
            </section>
          ) : null}

          <section className="glass panel mx-p">
            <div className="ph">
              <nav className="mx-path" aria-label="Folder path">
                <button type="button" className="mx-cb" onClick={() => openFolder(null)}>
                  All
                </button>
                {searching ? (
                  <>
                    <span aria-hidden="true">›</span>
                    <b>Search</b>
                  </>
                ) : (
                  ancestors.map((a, i) => (
                    <span key={a.id} className="ws-crumb">
                      <span aria-hidden="true">›</span>
                      {i === ancestors.length - 1 ? (
                        <b className="ws-ell" aria-current="page">
                          {a.name}
                        </b>
                      ) : (
                        <button type="button" className="mx-cb ws-ell" onClick={() => openFolder(a.id)}>
                          {a.name}
                        </button>
                      )}
                    </span>
                  ))
                )}
              </nav>
              <span className="sp" />
              <span className="small ws-num">
                {searching ? plural(view.folders.length + view.files.length, 'match', 'matches') : [listFolders.length ? plural(listFolders.length, 'folder') : '', plural(view.files.length, 'document')].filter(Boolean).join(' · ')}
              </span>
              {!searching && current && canDelete && currentEmpty ? (
                <Btn cls="sm danger-ghost" ico="x" onClick={() => delFolder(ancestors.at(-1)!)}>
                  Delete folder
                </Btn>
              ) : null}
            </div>

            {!listFolders.length && !view.files.length ? (
              <div className="mx-empty">
                <Icon name={searching ? 'search' : 'folder'} />
                <b>{searching ? 'No documents match your search' : current ? 'This folder is empty' : shelves.length ? 'Pick a shelf above to open it' : 'No documents yet'}</b>
                {searching ? (
                  <span>Try a title, a file name, a few words of when to use it, or who uploaded it.</span>
                ) : current || !shelves.length ? (
                  <div className="mx-chips">
                    <Btn cls="sm pri" ico="up" onClick={upload}>
                      Upload document
                    </Btn>
                  </div>
                ) : (
                  <span>Documents filed at the top of the library, outside any folder, are listed here.</span>
                )}
              </div>
            ) : (
              <div className="mx-kbl">
                {listFolders.map((f) => {
                  const ids = kbSubtree(f.id, folders);
                  const n = files.filter((x) => x.folderId !== null && ids.has(x.folderId)).length;
                  const empty = isKnowledgeBankFolderEmpty(f.id, folders, files);
                  const path = knowledgeBankFolderPath(f.parentId, folders);
                  return (
                    <div key={f.id} className="mx-kbi" style={{ ['--sc' as string]: colorOf(f.id) }}>
                      <span className="mx-kbb" />
                      <button type="button" className="ws-kbopen" onClick={() => openFolder(f.id)}>
                        <span className="mx-ni">
                          <Icon name="folder" />
                        </span>
                        <span className="mx-dt">
                          <b className="ws-ell" title={f.name}>
                            {f.name}
                          </b>
                          <span>{`Folder · ${plural(n, 'document')}${searching && path ? ` · in ${path}` : ''}`}</span>
                        </span>
                      </button>
                      <div className="mx-moves">
                        <Btn cls="sm" ico="chev" onClick={() => openFolder(f.id)} ariaLabel={`Open ${f.name}`}>
                          Open
                        </Btn>
                        {canDelete && empty ? (
                          <Btn cls="sm danger-ghost" ico="x" onClick={() => delFolder(f)} ariaLabel={`Delete ${f.name}`}>
                            Delete
                          </Btn>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {view.files.map((f) => (
                  <div key={f.id} className="mx-kbi" style={{ ['--sc' as string]: colorOf(f.folderId) }}>
                    <span className="mx-kbb" />
                    <span className="mx-dt">
                      <b className="ws-ell" title={`${f.title} · ${f.fileName}`}>
                        {f.title}
                      </b>
                      <span className="ws-ell2" title={f.description?.trim() || f.fileName}>
                        {f.description?.trim() ? `When to use: ${f.description.trim()}` : f.fileName}
                      </span>
                      <span className="small ws-ell">
                        {[dayLabel(f.createdAt), sizeLabel(f.sizeBytes), kbUploaderLabel(f), searching ? f.folderPath || 'Knowledge bank' : ''].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <div className="mx-moves">
                      <Btn cls="sm" ico="eye" onClick={() => preview(f)} ariaLabel={`Preview ${f.title}`}>
                        Preview
                      </Btn>
                      <button type="button" className="ib sm" aria-label={`Download ${f.title}`} title="Download" onClick={() => void download(f)}>
                        <Icon name="dl" />
                      </button>
                      {canDelete ? (
                        <Btn cls="sm danger-ghost" ico="x" onClick={() => delFile(f)} ariaLabel={`Delete ${f.title} (managers only)`} title="Delete · managers only">
                          Delete
                        </Btn>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- upload (live handleUpload) */

function UploadDoc({ folders, into, onDone }: { folders: KnowledgeBankFolder[]; into: string | null; onDone: (folderId: string | null) => void }) {
  const { closeModal, toast } = useConsole();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [folderId, setFolderId] = useState<string>(into ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const options = useMemo(
    () => folders.map((f) => ({ id: f.id, label: knowledgeBankFolderPath(f.id, folders) })).sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' })),
    [folders],
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!file) return setErr('Choose a file to upload.');
    if (!title.trim()) return setErr('Enter a title for this document.');
    const invalid = validateKnowledgeBankUploadFile(file);
    if (invalid) return setErr(invalid);
    setBusy(true);
    setErr('');
    try {
      const { path: storagePath, fileId } = await uploadKnowledgeBankFile(file);
      const res = await fetch('/api/knowledge-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: fileId,
          title: title.trim(),
          description: description.trim() || undefined,
          storagePath,
          fileName: file.name,
          mimeType: resolveUploadContentType(file, KNOWLEDGE_BANK_EXTENSIONS),
          sizeBytes: file.size,
          folderId: folderId || null,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        await removeKnowledgeBankStorageObject(storagePath).catch(() => undefined);
        setErr(data.error ?? 'Upload failed.');
        return;
      }
      toast('Document added to Knowledge Bank.');
      closeModal();
      await qc.invalidateQueries({ queryKey: KB_KEY });
      if ((folderId || null) !== into) onDone(folderId || null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalBody
      title="Upload to the library"
      sub='A one-line "when to use" helps every lead find it at the right moment.'
      foot={
        <>
          <Btn onClick={closeModal} disabled={busy}>
            Cancel
          </Btn>
          <span className="sp" />
          <Btn cls="pri" ico="up" disabled={busy} onClick={() => void submit()}>
            {busy ? 'Uploading…' : 'Upload to library'}
          </Btn>
        </>
      }
    >
      <div className="mx-form2 one">
        <label className="mx-f">
          <span className="mx-fl">Title</span>
          <input className="mx-in" value={title} maxLength={200} placeholder="e.g. Board resolution checklist" disabled={busy} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="mx-f">
          <span className="mx-fl">File</span>
          <input
            ref={fileRef}
            className="mx-in"
            type="file"
            accept=".pdf,.doc,.docx,.xlsx,.pptx,.txt,.jpg,.jpeg,.png,.webp"
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <span className="mx-fh">{`PDF, Office, text, or image · max ${maxUploadSizeLabel()}`}</span>
        </label>
        <label className="mx-f">
          <span className="mx-fl">When to use this document (optional)</span>
          <textarea className="mx-in" rows={3} value={description} maxLength={2000} placeholder="When to use this document…" disabled={busy} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="mx-f">
          <span className="mx-fl">Folder</span>
          <select className="lsel full" value={folderId} disabled={busy} onChange={(e) => setFolderId(e.target.value)}>
            <option value="">Knowledge bank (top level)</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {err ? (
        <p className="ws-err" role="alert">
          {err}
        </p>
      ) : null}
    </ModalBody>
  );
}

/* ---------------------------------------------------------------- new folder (live handleCreateFolder) */

function NewFolder({ parentId, parentName }: { parentId: string | null; parentName?: string }) {
  const { closeModal, toast } = useConsole();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    if (!name.trim()) return setErr('Enter a folder name.');
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/knowledge-bank/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim(), parentId }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErr(
          data.error === 'duplicate_folder_name'
            ? 'A folder with that name already exists here.'
            : data.error === 'folder_too_deep'
              ? 'This folder is nested too deeply.'
              : data.error ?? 'Could not create folder.',
        );
        return;
      }
      toast('Folder created.');
      closeModal();
      await qc.invalidateQueries({ queryKey: KB_KEY });
    } catch (e) {
      setErr(errorMessage(e, 'Could not create folder.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <ModalBody
      title="New folder"
      sub={parentName ? `Inside ${parentName}` : 'In Knowledge Bank · a top-level folder becomes a shelf'}
      foot={
        <>
          <Btn onClick={closeModal} disabled={busy}>
            Cancel
          </Btn>
          <span className="sp" />
          <Btn cls="pri" ico="folder" disabled={busy || !name.trim()} onClick={() => void submit()}>
            {busy ? 'Creating…' : 'Create folder'}
          </Btn>
        </>
      }
    >
      <div className="mx-form2 one">
        <label className="mx-f">
          <span className="mx-fl">Name</span>
          <input
            className="mx-in"
            value={name}
            maxLength={80}
            placeholder="e.g. GST"
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) void submit();
            }}
          />
        </label>
      </div>
      {err ? (
        <p className="ws-err" role="alert">
          {err}
        </p>
      ) : null}
    </ModalBody>
  );
}
