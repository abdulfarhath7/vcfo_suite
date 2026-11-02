/**
 * Multi-file upload helpers (G-09), pure so they can be tested. The client
 * portal sends several files in ONE multipart request (Home needs and document
 * requests). The browser only reports bytes sent for the whole body, and a
 * multipart body carries the files one after another, so the share of each
 * file is worked out from the running byte count.
 */

export interface UploadRow {
  name: string;
  size: number;
  /** 0–100 while sending; 100 once the server accepted it. */
  pct: number;
  state: 'waiting' | 'sending' | 'done' | 'failed';
  error?: string;
}

/**
 * Per-file percent from the overall progress of one request. `loaded / total`
 * is scaled onto the sum of the file sizes (the rest of the body is the small
 * multipart framing) and filled into the files in order. Never reaches 100:
 * a file is only done once the server answered.
 */
export function perFileProgress(sizes: number[], loaded: number, total: number): number[] {
  const sum = sizes.reduce((a, b) => a + Math.max(0, b), 0);
  if (!sizes.length) return [];
  if (!(total > 0) || sum === 0) return sizes.map(() => 0);
  let sent = Math.min(1, Math.max(0, loaded / total)) * sum;
  return sizes.map((raw) => {
    const size = Math.max(0, raw);
    if (size === 0) return 0;
    const part = Math.min(size, Math.max(0, sent));
    sent -= size;
    return Math.min(99, Math.floor((part / size) * 100));
  });
}

/** Rows for a fresh batch of files. */
export function startRows(files: Array<{ name: string; size: number }>): UploadRow[] {
  return files.map((f) => ({ name: f.name, size: f.size, pct: 0, state: 'waiting' }));
}

/** Rows after a progress event of the batch. */
export function progressRows(rows: UploadRow[], loaded: number, total: number): UploadRow[] {
  const pcts = perFileProgress(
    rows.map((r) => r.size),
    loaded,
    total,
  );
  return rows.map((r, i) => (r.state === 'failed' ? r : { ...r, pct: pcts[i] ?? 0, state: (pcts[i] ?? 0) > 0 ? 'sending' : 'waiting' }));
}

/**
 * Rows once the server answered. `rejected` names the refused files (by file
 * name, as the routes return them); every other file is done. A failed request
 * (`error` with no per-file list) marks every file failed with that reason.
 */
export function finishRows(
  rows: UploadRow[],
  answer: { ok: boolean; rejected?: Array<{ fileName: string; error: string }>; error?: string },
): UploadRow[] {
  const refused = new Map<string, string>();
  for (const r of answer.rejected ?? []) if (!refused.has(r.fileName)) refused.set(r.fileName, r.error);
  return rows.map((r) => {
    const why = refused.get(r.name);
    if (why) return { ...r, state: 'failed', error: why };
    if (!answer.ok) return { ...r, state: 'failed', error: answer.error ?? 'Upload failed' };
    return { ...r, pct: 100, state: 'done' };
  });
}

/** "2 of 3 files uploaded" style summary for the toast. */
export function batchSummary(rows: UploadRow[]): { done: number; failed: number; total: number } {
  return {
    done: rows.filter((r) => r.state === 'done').length,
    failed: rows.filter((r) => r.state === 'failed').length,
    total: rows.length,
  };
}
