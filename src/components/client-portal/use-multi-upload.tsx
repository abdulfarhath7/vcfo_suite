'use client';

/**
 * Several files in one upload (G-09), shared by Home (open needs) and Documents (document
 * requests). One multipart request carries every file under the field `file`; the routes check
 * each file on its own and answer with `rejected` for the refused ones. Progress per file comes
 * from the one request's byte count (`perFileProgress`), so each row shows its own bar, and a
 * refused file shows its own reason.
 */
import { useCallback, useRef, useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileBadge } from '@/components/ui/file-badge';
import { finishRows, progressRows, startRows, type UploadRow } from '@/lib/client-portal/multi-upload';

export interface MultiUploadAnswer {
  ok: boolean;
  status: number;
  body: Record<string, unknown> & { error?: string; rejected?: Array<{ fileName: string; error: string }> };
}

/** POST `files` to `url` as one multipart request, with per-file rows. */
export function useMultiUpload() {
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [busy, setBusy] = useState(false);
  const xhr = useRef<XMLHttpRequest | null>(null);

  const send = useCallback((url: string, files: File[]): Promise<MultiUploadAnswer> => {
    const start = startRows(files);
    setRows(start);
    setBusy(true);
    return new Promise((resolve) => {
      const body = new FormData();
      for (const f of files) body.append('file', f);
      const x = new XMLHttpRequest();
      xhr.current = x;
      x.open('POST', url);
      x.upload.onprogress = (e) => {
        if (e.lengthComputable) setRows((r) => progressRows(r.length ? r : start, e.loaded, e.total));
      };
      const done = (answer: MultiUploadAnswer) => {
        xhr.current = null;
        setBusy(false);
        setRows((r) => finishRows(r.length ? r : start, { ok: answer.ok, rejected: answer.body.rejected, error: answer.body.error }));
        resolve(answer);
      };
      x.onload = () => {
        let json: MultiUploadAnswer['body'] = {};
        try {
          json = JSON.parse(x.responseText || '{}');
        } catch {
          /* not JSON */
        }
        done({ ok: x.status >= 200 && x.status < 300, status: x.status, body: json });
      };
      x.onerror = () => done({ ok: false, status: 0, body: { error: 'Upload failed. Check your connection.' } });
      x.onabort = () => done({ ok: false, status: 0, body: { error: 'Upload cancelled' } });
      x.send(body);
    });
  }, []);

  const cancel = useCallback(() => xhr.current?.abort(), []);
  const clear = useCallback(() => setRows([]), []);
  return { rows, busy, send, cancel, clear };
}

/** One row per file: badge, name, its own bar while sending, a tick or the reason after. */
export function UploadRowsList({ rows, className }: { rows: UploadRow[]; className?: string }) {
  if (!rows.length) return null;
  return (
    <ul className={cn('grid gap-1.5', className)} aria-label="Files">
      {rows.map((r, i) => (
        <li key={`${r.name}:${i}`} className="grid gap-1 rounded-md border-1.5 border-line bg-surface-raised px-3 py-2">
          <span className="flex min-w-0 items-center gap-2.5">
            <FileBadge name={r.name} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{r.name}</span>
            {r.state === 'done' ? (
              <Check size={16} strokeWidth={2} className="flex-none text-positive" aria-label="Uploaded" />
            ) : r.state === 'failed' ? (
              <AlertTriangle size={16} strokeWidth={1.8} className="flex-none text-danger" aria-label="Not uploaded" />
            ) : (
              <span className="flex-none font-mono text-[12px] text-ink-muted">{r.pct}%</span>
            )}
          </span>
          {r.state === 'sending' || r.state === 'waiting' ? (
            <span
              className="block h-1 overflow-hidden rounded-full bg-surface-sunken"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={r.pct}
              aria-label={`Upload progress · ${r.name}`}
            >
              <span className="block h-full rounded-full bg-brand transition-[width]" style={{ width: `${r.pct}%` }} />
            </span>
          ) : null}
          {r.state === 'failed' && r.error ? (
            <span role="alert" className="text-[12.5px] text-danger">
              {r.error}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** A small floating tray for uploads started outside a dialog (Home's Upload buttons). */
export function UploadTray({ title, rows, busy, onCancel, onClose }: { title: string; rows: UploadRow[]; busy: boolean; onCancel: () => void; onClose: () => void }) {
  if (!rows.length) return null;
  return (
    <div className="cp-tw fixed bottom-4 right-4 z-50 w-[340px] max-w-[calc(100vw-32px)] rounded-md border-1.5 border-line bg-surface-raised shadow-float" role="status" aria-live="polite">
      <div className="flex h-11 items-center gap-2 border-b border-line-soft px-3">
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">{title}</span>
        {busy ? (
          <button type="button" className="text-[12.5px] font-medium text-brand-text hover:underline" onClick={onCancel}>
            Cancel
          </button>
        ) : (
          <button type="button" className="grid h-7 w-7 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken" aria-label="Close" onClick={onClose}>
            <X size={15} strokeWidth={1.6} aria-hidden />
          </button>
        )}
      </div>
      <UploadRowsList rows={rows} className="max-h-[260px] overflow-auto p-2" />
    </div>
  );
}
