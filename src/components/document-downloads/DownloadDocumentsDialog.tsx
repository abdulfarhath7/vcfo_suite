'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Download, Eye, Loader2 } from 'lucide-react';

import { useDocViewer } from '@/components/client-portal/pages/documents/DocViewer';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tag } from '@/components/ui/spectrum-chip';
import { useApp } from '@/context/AppContext';
import { useDocumentCatalog } from '@/hooks/use-document-downloads';
import { useExportReadyToast } from '@/hooks/use-export-ready-toast';
import type { PublicDownloadGroup } from '@/lib/document-downloads/catalog';
import { catalogViewerDocs, downloadDocumentKeys, type DownloadLayout } from '@/lib/document-downloads/client';
import {
  groupTickState,
  publicFilesIn,
  quickPicks,
  readyKeysIn,
  toggleGroup,
  type TickState,
} from '@/lib/document-downloads/selection';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

type Layout = DownloadLayout;

/** Only the layout is remembered, per person; the pop-up always opens with nothing ticked. */
function rememberKey(userId: string | undefined) {
  return `vcfo.document-downloads.layout.${userId ?? 'staff'}`;
}

function readLayout(userId: string | undefined): Layout {
  try {
    return window.localStorage.getItem(rememberKey(userId)) === 'flat' ? 'flat' : 'folders';
  } catch {
    return 'folders';
  }
}

function writeLayout(userId: string | undefined, layout: Layout) {
  try {
    window.localStorage.setItem(rememberKey(userId), layout);
  } catch {
    // Private windows may refuse storage; the layout is simply not remembered.
  }
}

function TickBox({ state, disabled, onChange, label }: { state: TickState; disabled?: boolean; onChange: () => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'some';
  }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={state === 'all'}
      disabled={disabled}
      onChange={onChange}
      className="mt-0.5 flex-none"
    />
  );
}

function GroupRows({
  group,
  depth,
  selected,
  setSelected,
}: {
  group: PublicDownloadGroup;
  depth: number;
  selected: Set<string>;
  setSelected: (next: Set<string>) => void;
}) {
  // Every section starts closed, so the not-ready rows of a new project do not fill the list.
  const [expanded, setExpanded] = useState(false);
  const total = publicFilesIn(group).length;
  const ready = readyKeysIn(group).length;
  const listId = `dl-group-${group.id.replace(/[^\w-]/g, '-')}`;
  return (
    <li className={cn(depth === 0 && 'border-b border-line py-1.5 last:border-b-0')}>
      <div className="flex items-center gap-1.5 py-1" style={{ paddingLeft: depth * 20 }}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={listId}
          aria-label={`${expanded ? 'Hide' : 'Show'} ${group.label}`}
          className="grid h-6 w-6 flex-none place-items-center rounded text-ink-muted hover:bg-surface-sunken hover:text-ink"
        >
          <ChevronRight className={cn('h-4 w-4 transition-transform', expanded && 'rotate-90')} aria-hidden />
        </button>
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
          <TickBox
            label={group.label}
            state={groupTickState(group, selected)}
            disabled={ready === 0}
            onChange={() => setSelected(toggleGroup(group, selected))}
          />
          <span className={cn('min-w-0 flex-1 text-[14px] text-ink', depth === 0 && 'font-medium')}>{group.label}</span>
          <span className="flex-none text-[12px] tabular-nums text-ink-muted">
            {ready === total ? `${total} ${total === 1 ? 'file' : 'files'}` : `${ready} of ${total} ready`}
          </span>
        </label>
      </div>
      {expanded ? (
        <ul id={listId}>
          {group.files.map((file) => (
            <li key={file.key}>
              <label
                className={cn('flex items-start gap-2 py-1', file.ready ? 'cursor-pointer' : 'cursor-not-allowed text-ink-muted')}
                style={{ paddingLeft: (depth + 1) * 20 + 30 }}
                title={file.ready ? file.fileName : file.reason}
              >
                <TickBox
                  label={file.label}
                  state={selected.has(file.key) ? 'all' : 'none'}
                  disabled={!file.ready}
                  onChange={() => {
                    const next = new Set(selected);
                    if (next.has(file.key)) next.delete(file.key);
                    else next.add(file.key);
                    setSelected(next);
                  }}
                />
                <span className="min-w-0 flex-1 text-[13px]">{file.label}</span>
                {file.ready ? (
                  file.kind === 'uploaded' ? <Tag className="flex-none">Uploaded</Tag> : null
                ) : (
                  <Tag tone="warn" className="flex-none">Not ready</Tag>
                )}
              </label>
            </li>
          ))}
          {group.groups.map((sub) => (
            <GroupRows key={sub.id} group={sub} depth={depth + 1} selected={selected} setSelected={setSelected} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * "Download documents" pop-up (CR-2026-11, staff only). The top row downloads the whole project in
 * one click (it replaced the separate "Download project (ZIP)" button). Below it, quick picks and
 * the tree of every document by part, section and director, each section closed until opened, and
 * nothing ticked until the person picks. Word files only for now; folders or one flat folder. One
 * file downloads as itself; a large set is made in the background with a link in the bell.
 * "Preview all" and "Preview" open the shared viewer (`DocViewer`) on the whole project or on the
 * chosen files; the pop-up hides while the viewer is open and comes back with the same ticks.
 */
export function DownloadDocumentsDialog({
  engagementId,
  open,
  onOpenChange,
}: {
  engagementId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useApp();
  const query = useDocumentCatalog(engagementId, open);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [layout, setLayout] = useState<Layout>('folders');
  const [busy, setBusy] = useState<'project' | 'picked' | null>(null);
  const watchExport = useExportReadyToast();
  const root = query.data?.root;

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setLayout(readLayout(user?.id));
  }, [open, user?.id]);

  const viewer = useDocViewer();
  const picks = useMemo(() => (root ? quickPicks(root) : []), [root]);
  const projectKeys = useMemo(() => (root ? readyKeysIn(root) : []), [root]);
  const count = selected.size;

  /** Open the viewer on these files, in the tree's order. */
  function preview(keys: readonly string[]) {
    if (!root || !keys.length) return;
    const wanted = new Set(keys);
    viewer.open(catalogViewerDocs(engagementId, publicFilesIn(root).filter((f) => wanted.has(f.key))), 0);
  }

  async function download(keys: string[], which: 'project' | 'picked') {
    if (!keys.length || busy) return;
    setBusy(which);
    writeLayout(user?.id, layout);
    try {
      const out = await downloadDocumentKeys(engagementId, keys, layout);
      if (out.queued) {
        if (out.fileName) watchExport(out.fileName);
        toastSuccess('Making the ZIP', `${out.fileName ?? 'Your documents'} will be in your notifications when it is ready. You can keep working.`);
      }
      onOpenChange(false);
    } catch (err) {
      toastError('The download did not start', errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Dialog open={open && !viewer.isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl" data-testid="download-documents-dialog">
          <DialogHeader>
            <DialogTitle>Download documents</DialogTitle>
            <DialogDescription>{query.data?.companyName ?? 'Download the whole project or choose documents.'}</DialogDescription>
          </DialogHeader>

          {query.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-[14px] text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading the documents…
            </div>
          ) : query.isError ? (
            <p className="py-6 text-[14px] text-danger">{errorMessage(query.error)}</p>
          ) : root && root.groups.length ? (
            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface-sunken/40 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-ink">Whole project (ZIP)</p>
                  <p className="text-[12.5px] text-ink-muted">
                    Every ready document, upload and project record · {projectKeys.length} {projectKeys.length === 1 ? 'file' : 'files'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => preview(projectKeys)}
                  disabled={!projectKeys.length}
                  data-testid="preview-whole-project"
                >
                  <Eye className="mr-1 h-4 w-4" aria-hidden />
                  Preview all
                </Button>
                <Button
                  type="button"
                  onClick={() => void download(projectKeys, 'project')}
                  disabled={!projectKeys.length || busy !== null}
                  data-testid="download-whole-project"
                >
                  {busy === 'project' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : <Download className="mr-1 h-4 w-4" aria-hidden />}
                  Download all
                </Button>
              </div>

              <p className="text-[12px] font-medium uppercase tracking-[.07em] text-ink-muted">Or choose documents</p>
              <div className="-mt-2 flex flex-wrap gap-2" role="group" aria-label="Quick picks">
                {picks.map((pick) => (
                  <Button key={pick.id} type="button" size="sm" variant="outline" onClick={() => setSelected(new Set(pick.keys))}>
                    {pick.label}
                  </Button>
                ))}
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              </div>

              <ul className="max-h-[46vh] overflow-y-auto rounded-md border border-line px-3" aria-label="Documents">
                {root.groups.map((g) => (
                  <GroupRows key={g.id} group={g} depth={0} selected={selected} setSelected={setSelected} />
                ))}
              </ul>

              <div className="grid gap-3 text-[13px] sm:grid-cols-2">
                <div>
                  <p className="mb-1 font-medium text-ink">Format</p>
                  <p className="text-ink-muted">Word (.docx); project records in Excel. Uploaded files come as they were sent.</p>
                </div>
                <div>
                  <p className="mb-1 font-medium text-ink">Layout</p>
                  <RadioGroup value={layout} onValueChange={(v) => setLayout(v === 'flat' ? 'flat' : 'folders')} className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="folders" id="dl-layout-folders" />
                      <Label htmlFor="dl-layout-folders">Folders by section</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="flat" id="dl-layout-flat" />
                      <Label htmlFor="dl-layout-flat">One flat folder</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>
          ) : (
            <p className="py-6 text-[14px] text-ink-muted">No document is ready to download yet.</p>
          )}

          <DialogFooter className="items-center gap-2 sm:justify-between">
            <span className="text-[13px] text-ink-muted" aria-live="polite">
              {count ? `${count} ${count === 1 ? 'file' : 'files'} chosen` : 'Nothing chosen yet'}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" variant="outline" onClick={() => preview([...selected])} disabled={!count} data-testid="preview-chosen">
                <Eye className="mr-1 h-4 w-4" aria-hidden />
                Preview
              </Button>
              <Button type="button" onClick={() => void download([...selected], 'picked')} disabled={!count || busy !== null} data-testid="download-documents-submit">
                {busy === 'picked' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : <Download className="mr-1 h-4 w-4" aria-hidden />}
                {count === 1 ? 'Download file' : 'Download chosen'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {viewer.node}
    </>
  );
}

/**
 * The one "Download documents" button on the project header and the document pack page. Hidden for
 * clients. The whole project is the top row of its pop-up.
 */
export function DownloadDocumentsButton({ engagementId, className }: { engagementId: string; className?: string }) {
  const { user } = useApp();
  const [open, setOpen] = useState(false);
  if (!user || user.role === 'client') return null;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className={cn('flex-none', className)} data-testid="download-documents">
        <Download className="mr-1 h-4 w-4" aria-hidden />
        Download documents
      </Button>
      <DownloadDocumentsDialog engagementId={engagementId} open={open} onOpenChange={setOpen} />
    </>
  );
}
