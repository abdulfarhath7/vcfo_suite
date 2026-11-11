'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tag } from '@/components/ui/spectrum-chip';
import { useApp } from '@/context/AppContext';
import type { PublicDownloadGroup } from '@/lib/document-downloads/catalog';
import {
  groupTickState,
  initialSelection,
  publicFilesIn,
  quickPicks,
  readyKeysIn,
  toggleGroup,
  type TickState,
} from '@/lib/document-downloads/selection';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

type Layout = 'folders' | 'flat';
type Catalog = { companyName: string; root: PublicDownloadGroup };

const apiPath = (engagementId: string) => `/api/engagements/${encodeURIComponent(engagementId)}/document-downloads`;

/** The last choice, per person, so a Lead who always takes "Part B" finds it ticked. */
function rememberKey(userId: string | undefined) {
  return `vcfo.document-downloads.${userId ?? 'staff'}`;
}

function readRemembered(userId: string | undefined): { keys: string[]; layout: Layout } | null {
  try {
    const raw = window.localStorage.getItem(rememberKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { keys?: unknown; layout?: unknown };
    return {
      keys: Array.isArray(parsed.keys) ? parsed.keys.filter((k): k is string => typeof k === 'string') : [],
      layout: parsed.layout === 'flat' ? 'flat' : 'folders',
    };
  } catch {
    return null;
  }
}

function writeRemembered(userId: string | undefined, keys: string[], layout: Layout) {
  try {
    window.localStorage.setItem(rememberKey(userId), JSON.stringify({ keys, layout }));
  } catch {
    // Private windows may refuse storage; the choice is simply not remembered.
  }
}

function fileNameFrom(disposition: string | null, fallback: string): string {
  const star = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (star) return decodeURIComponent(star);
  return disposition?.match(/filename="([^"]+)"/i)?.[1] ?? fallback;
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
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
  const total = publicFilesIn(group).length;
  const ready = readyKeysIn(group).length;
  return (
    <li className={cn(depth === 0 && 'border-b border-line py-2 last:border-b-0')}>
      <label className="flex cursor-pointer items-start gap-2 py-1" style={{ paddingLeft: depth * 20 }}>
        <TickBox
          label={group.label}
          state={groupTickState(group, selected)}
          disabled={ready === 0}
          onChange={() => setSelected(toggleGroup(group, selected))}
        />
        <span className={cn('min-w-0 flex-1 text-[14px] text-ink', depth === 0 && 'font-medium')}>{group.label}</span>
        <span className="flex-none text-[12px] text-ink-muted">
          {ready === total ? `${total} ${total === 1 ? 'file' : 'files'}` : `${ready} of ${total} ready`}
        </span>
      </label>
      <ul>
        {group.files.map((file) => (
          <li key={file.key}>
            <label
              className={cn('flex items-start gap-2 py-1', file.ready ? 'cursor-pointer' : 'cursor-not-allowed text-ink-muted')}
              style={{ paddingLeft: (depth + 1) * 20 }}
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
    </li>
  );
}

/**
 * "Download documents" pop-up (CR-2026-11, staff only): quick picks, the tree of every document by
 * part, section and director, Word files only for now, and folders or one flat folder. One file
 * downloads as itself; a large set is made in the background with a link in the bell.
 */
export function DownloadDocumentsDialog({
  engagementId,
  open,
  onOpenChange,
  selectAll = false,
}: {
  engagementId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Start with every ready document ticked, not the remembered choice ("Download project (ZIP)"). */
  selectAll?: boolean;
}) {
  const { user } = useApp();
  const query = useQuery({
    queryKey: ['document-downloads', engagementId],
    enabled: open,
    staleTime: 0,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Catalog> => {
      const res = await fetch(apiPath(engagementId), { cache: 'no-store' });
      const out = (await res.json().catch(() => ({}))) as Catalog & { error?: string };
      if (!res.ok) throw new Error(out.error || 'The document list could not be loaded.');
      return out;
    },
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [layout, setLayout] = useState<Layout>('folders');
  const [busy, setBusy] = useState(false);
  const root = query.data?.root;

  useEffect(() => {
    if (!open || !root) return;
    const remembered = readRemembered(user?.id);
    setSelected(initialSelection(root, selectAll ? null : remembered?.keys ?? null));
    setLayout(remembered?.layout ?? 'folders');
  }, [open, root, user?.id, selectAll]);

  const picks = useMemo(() => (root ? quickPicks(root) : []), [root]);
  const count = selected.size;

  async function download() {
    if (!count) return;
    setBusy(true);
    const keys = [...selected];
    writeRemembered(user?.id, keys, layout);
    try {
      const res = await fetch(apiPath(engagementId), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ keys, layout }),
      });
      if (res.status === 202) {
        const out = (await res.json().catch(() => ({}))) as { fileName?: string };
        toastSuccess('Making the ZIP', `${out.fileName ?? 'Your documents'} will be in your notifications when it is ready. You can keep working.`);
        onOpenChange(false);
        return;
      }
      if (!res.ok) {
        const out = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(out.error || 'The download did not start.');
      }
      saveBlob(await res.blob(), fileNameFrom(res.headers.get('content-disposition'), 'Documents.zip'));
      onOpenChange(false);
    } catch (err) {
      toastError('The download did not start', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="download-documents-dialog">
        <DialogHeader>
          <DialogTitle>Download documents</DialogTitle>
          <DialogDescription>
            {query.data?.companyName ?? 'Choose the documents you want.'} Pick a set below, then add or remove single documents.
          </DialogDescription>
        </DialogHeader>

        {query.isLoading ? (
          <div className="flex items-center gap-2 py-8 text-[14px] text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading the documents…
          </div>
        ) : query.isError ? (
          <p className="py-6 text-[14px] text-danger">{errorMessage(query.error)}</p>
        ) : root && root.groups.length ? (
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Quick picks">
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
            {count} {count === 1 ? 'file' : 'files'} chosen
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={download} disabled={!count || busy} data-testid="download-documents-submit">
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : <Download className="mr-1 h-4 w-4" aria-hidden />}
              {count === 1 ? 'Download file' : 'Download ZIP'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The "Download documents" button beside the project name. Hidden for clients. With `selectAll`
 * it is PR-02's "Download project (ZIP)": the same pop-up, with every ready document ticked.
 */
export function DownloadDocumentsButton({
  engagementId,
  className,
  selectAll = false,
  label = 'Download documents',
  testId = 'download-documents',
}: {
  engagementId: string;
  className?: string;
  selectAll?: boolean;
  label?: string;
  testId?: string;
}) {
  const { user } = useApp();
  const [open, setOpen] = useState(false);
  if (!user || user.role === 'client') return null;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className={cn('flex-none', className)} data-testid={testId}>
        <Download className="mr-1 h-4 w-4" aria-hidden />
        {label}
      </Button>
      <DownloadDocumentsDialog engagementId={engagementId} open={open} onOpenChange={setOpen} selectAll={selectAll} />
    </>
  );
}
