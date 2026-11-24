'use client';

import { useEffect, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

/** The same pill as the CC control beside it, so the record head keeps one style. */
const PILL = 'inline-flex h-6 shrink-0 items-center rounded-full border border-line/80 bg-surface-sunken/50 text-[10.5px] text-ink';

interface FolderView {
  configured: boolean;
  link: { folderId: string; folderName: string } | null;
  folders?: { id: string; name: string }[];
  error?: string;
}

/**
 * The project's SharePoint folder, beside the CC control: the linked folder's name, and a list of
 * the folders under Clients to pick or change it. Ask VCFO links the folder itself the first time
 * it finds one clear match; this is for the cases it cannot decide. Hidden when the app has no
 * SharePoint site set.
 */
export function SharepointFolderControl({ engagementId, className }: { engagementId: string; className?: string }) {
  const [view, setView] = useState<FolderView | null>(null);
  const [open, setOpen] = useState(false);
  const [folders, setFolders] = useState<{ id: string; name: string }[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/engagements/${encodeURIComponent(engagementId)}/sharepoint`)
      .then((res) => (res.ok ? (res.json() as Promise<FolderView>) : null))
      .then((json) => {
        if (!cancelled) setView(json);
      })
      .catch(() => {
        if (!cancelled) setView(null);
      });
    return () => {
      cancelled = true;
    };
  }, [engagementId]);

  useEffect(() => {
    if (!open || folders) return;
    let cancelled = false;
    setProblem(null);
    fetch(`/api/engagements/${encodeURIComponent(engagementId)}/sharepoint?folders=1`)
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as FolderView;
        if (cancelled) return;
        if (!res.ok) setProblem(json.error || 'Could not read SharePoint.');
        else setFolders(json.folders ?? []);
      })
      .catch(() => {
        if (!cancelled) setProblem('Could not read SharePoint.');
      });
    return () => {
      cancelled = true;
    };
  }, [open, folders, engagementId]);

  if (!view?.configured) return null;

  async function pick(folderId: string | null) {
    setSaving(true);
    try {
      const res = await fetch(`/api/engagements/${encodeURIComponent(engagementId)}/sharepoint`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      });
      const json = (await res.json().catch(() => ({}))) as { link?: FolderView['link']; error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not link the folder.');
      setView((v) => (v ? { ...v, link: json.link ?? null } : v));
      setOpen(false);
      toastSuccess(json.link ? `Linked ${json.link.folderName}` : 'SharePoint folder unlinked');
    } catch (err) {
      toastError('SharePoint folder not changed', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  const linked = view.link;
  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <span className="shrink-0 text-[9.5px] font-semibold tracking-[0.16em] text-ink-faint" title="The client's folder under Clients in SharePoint. Ask VCFO reads it when you ask.">
        SHAREPOINT
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={cn(PILL, 'min-w-0 max-w-[11rem] px-2 hover:bg-surface-sunken')} aria-label="SharePoint folder">
            <span className={cn('min-w-0 truncate', linked ? 'text-ink' : 'text-ink-faint')}>{linked ? linked.folderName : 'Not linked'}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-2">
          {problem ? (
            <p className="px-1.5 py-1 text-[12px] text-ink-muted">{problem}</p>
          ) : !folders ? (
            <p className="px-1.5 py-1 text-[12px] text-ink-faint">Loading folders…</p>
          ) : folders.length === 0 ? (
            <p className="px-1.5 py-1 text-[12px] text-ink-muted">There are no folders under Clients.</p>
          ) : (
            <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
              {folders.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void pick(f.id)}
                    className={cn(
                      'w-full truncate rounded-md px-1.5 py-1 text-left text-[12px] hover:bg-surface-sunken/60 disabled:opacity-50',
                      linked?.folderId === f.id ? 'font-medium text-ink' : 'text-ink',
                    )}
                    aria-current={linked?.folderId === f.id ? 'true' : undefined}
                  >
                    {f.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {linked ? (
            <button type="button" disabled={saving} onClick={() => void pick(null)} className="mt-1.5 px-1.5 text-[11.5px] text-ink-muted hover:text-ink disabled:opacity-50">
              Unlink
            </button>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
