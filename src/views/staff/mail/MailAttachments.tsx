'use client';

import { useMemo, useRef, useState } from 'react';
import { FolderOpen, Paperclip, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileBadge } from '@/components/ui/file-badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { attachmentLimitError } from '@/lib/outlook/mail-extras';
import { formatUploadFileSize } from '@/lib/upload-limits';
import { toastError } from '@/lib/toast-errors';

/*
 * Attachments on the Email screen (G-23; prototype email-parts `Attachments`): files from this
 * computer and documents already in the vault. Vault documents travel by id; the send route
 * reads them through the scoped documents repository, so nothing is downloaded here.
 */

export interface VaultAttachment {
  id: string;
  fileName: string;
  sizeBytes: number | null;
  companyName?: string | null;
}

type Props = {
  files: File[];
  onFilesChange: (files: File[]) => void;
  vaultDocs: VaultAttachment[];
  onVaultDocsChange: (docs: VaultAttachment[]) => void;
  disabled?: boolean;
};

function sizesOf(files: File[], docs: VaultAttachment[]) {
  return [
    ...files.map((f) => ({ name: f.name, size: f.size })),
    ...docs.map((d) => ({ name: d.fileName, size: d.sizeBytes ?? 0 })),
  ];
}

function Pill({ name, size, onRemove }: { name: string; size: number | null; onRemove: () => void }) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-md border border-line py-1 pl-2 pr-1">
      <FileBadge name={name} className="h-[18px] w-[30px] text-[9px]" />
      <span className="min-w-0 truncate text-[12.5px] text-ink">{name}</span>
      {size != null ? <span className="flex-none text-[11.5px] tabular-nums text-ink-muted">{formatUploadFileSize(size)}</span> : null}
      <Button type="button" size="icon" variant="ghost" className="h-6 w-6 min-w-0" onClick={onRemove} aria-label={`Remove ${name}`}>
        <X className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </span>
  );
}

function VaultPicker({
  chosen,
  onPick,
  disabled,
}: {
  chosen: VaultAttachment[];
  onPick: (doc: VaultAttachment) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<VaultAttachment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');

  async function load() {
    if (docs || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/documents');
      const json = (await res.json()) as {
        documents?: Array<{ id: string; fileName: string; sizeBytes: number | null; companyName?: string | null }>;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || 'fetch_failed');
      setDocs(
        (json.documents ?? []).map((d) => ({
          id: d.id,
          fileName: d.fileName,
          sizeBytes: d.sizeBytes,
          companyName: d.companyName ?? null,
        })),
      );
    } catch {
      setDocs([]);
      toastError('Could not load the vault');
    } finally {
      setLoading(false);
    }
  }

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    const taken = new Set(chosen.map((d) => d.id));
    return (docs ?? [])
      .filter((d) => !taken.has(d.id))
      .filter(
        (d) => !query || d.fileName.toLowerCase().includes(query) || (d.companyName ?? '').toLowerCase().includes(query),
      )
      .slice(0, 60);
  }, [docs, q, chosen]);

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) void load();
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="ghost" disabled={disabled}>
          <FolderOpen aria-hidden /> From vault
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] p-1.5">
        <label className="mb-1 flex h-8 items-center gap-2 rounded-md border-1.5 border-line-strong bg-surface-raised px-2 focus-within:border-brand">
          <Search className="h-3.5 w-3.5 flex-none text-ink-muted" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="File or client"
            aria-label="Filter vault documents"
            className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-faint"
          />
        </label>
        <div className="max-h-60 overflow-y-auto" role="listbox" aria-label="Vault documents">
          {loading ? (
            <p className="px-2 py-3 text-[13px] text-ink-muted">Loading…</p>
          ) : shown.length === 0 ? (
            <p className="px-2 py-3 text-[13px] text-ink-muted">No documents</p>
          ) : (
            shown.map((d) => (
              <button
                key={d.id}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  onPick(d);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left hover:bg-surface-sunken"
              >
                <FileBadge name={d.fileName} className="h-[18px] w-[30px] text-[9px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{d.fileName}</span>
                  {d.companyName ? <span className="block truncate text-[11.5px] text-ink-muted">{d.companyName}</span> : null}
                </span>
                {d.sizeBytes != null ? (
                  <span className="flex-none text-[11.5px] tabular-nums text-ink-muted">{formatUploadFileSize(d.sizeBytes)}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function MailAttachments({ files, onFilesChange, vaultDocs, onVaultDocsChange, disabled }: Props) {
  const input = useRef<HTMLInputElement>(null);

  function addFiles(picked: File[]) {
    const fresh = picked.filter((f) => !files.some((x) => x.name === f.name && x.size === f.size));
    const next = [...files, ...fresh];
    const error = attachmentLimitError(sizesOf(next, vaultDocs));
    if (error) {
      toastError("File wasn't attached", error);
      return;
    }
    onFilesChange(next);
  }

  function addVault(doc: VaultAttachment) {
    const next = [...vaultDocs, doc];
    const error = attachmentLimitError(sizesOf(files, next));
    if (error) {
      toastError("Document wasn't attached", error);
      return;
    }
    onVaultDocsChange(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {files.map((f) => (
        <Pill
          key={`file:${f.name}:${f.size}`}
          name={f.name}
          size={f.size}
          onRemove={() => onFilesChange(files.filter((x) => x !== f))}
        />
      ))}
      {vaultDocs.map((d) => (
        <Pill
          key={`doc:${d.id}`}
          name={d.fileName}
          size={d.sizeBytes}
          onRemove={() => onVaultDocsChange(vaultDocs.filter((x) => x.id !== d.id))}
        />
      ))}
      <input
        ref={input}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles([...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />
      <Button type="button" size="sm" variant="ghost" onClick={() => input.current?.click()} disabled={disabled}>
        <Paperclip aria-hidden /> Attach
      </Button>
      <VaultPicker chosen={vaultDocs} onPick={addVault} disabled={disabled} />
    </div>
  );
}
