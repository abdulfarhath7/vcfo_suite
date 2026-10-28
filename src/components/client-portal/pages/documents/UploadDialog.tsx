'use client';

/**
 * Upload flow (prototype s/docs/docs_upload.dc.html): "Upload a document"
 * dialog listing ONLY the open requests (DECISIONS: upload only against open
 * requests) · drop zone with the dragging state · real progress bar with
 * cancel · refused-file error with Try again · SBC's re-upload note.
 * The file goes to POST /api/client/documents/requests/[id]/upload.
 * VCFO Spectrum (prototype src/components/cards/UploadDialog.tsx): a 52 px head,
 * the requests as one radio list with due chips, a dashed drop zone, file rows
 * with R-26 badges, Cancel and a blurple Upload in the footer.
 */
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import type { OpenRequest } from '@/lib/client-portal/documents';
import { validateMilestoneUploadFile } from '@/lib/documents/milestone-document-storage';
import { Chip } from '@/components/ui/spectrum-chip';
import { FileBadge } from '@/components/ui/file-badge';
import { PagePortal } from './shared-ui';
import { missingLabel } from './model';

const UP_ICON = 'M12 15V4 M7.5 8.5 12 4l4.5 4.5 M5 19.5h14';

function initials(name?: string): string {
  const p = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return 'SBC';
  return (p.length === 1 ? p[0]!.slice(0, 2) : p[0]![0]! + p[p.length - 1]![0]!).toUpperCase();
}

export function UploadDialog({
  requests,
  initialRequestId,
  initialFile,
  accept,
  onClose,
  onUploaded,
}: {
  requests: OpenRequest[];
  initialRequestId?: string;
  initialFile?: File | null;
  accept: { exts: string[]; maxLabel: string };
  onClose: () => void;
  onUploaded: (r: { fileId: string; requestId: string; label: string }) => void;
}) {
  const [sel, setSel] = useState<string>(initialRequestId && requests.some((r) => r.id === initialRequestId) ? initialRequestId : requests[0]?.id ?? '');
  // Phone: a missing row's sheet opens the upload for that one request (docs_a_mobile_menu).
  const [phone] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width:700px)').matches);
  const shown = phone && initialRequestId && requests.some((r) => r.id === initialRequestId) ? requests.filter((r) => r.id === initialRequestId) : requests;
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [over, setOver] = useState(false);
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);
  const req = requests.find((r) => r.id === sel);
  const exts = accept.exts.filter((e) => e !== 'jpeg' && e !== 'doc');
  const caption = `${exts.map((e) => e.toUpperCase()).join(' · ')} · up to ${accept.maxLabel}`;

  const close = useCallback(() => {
    xhr.current?.abort();
    onClose();
    (opener.current as HTMLElement | null)?.focus?.({ preventScroll: true });
  }, [onClose]);

  useEffect(() => {
    opener.current = document.activeElement;
    const t = setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 30);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', key, true);
    };
  }, [close]);

  const start = useCallback(
    (f: File | null = file) => {
      if (!f || !req) return;
      setError(null);
      const bad = validateMilestoneUploadFile(f);
      if (bad) {
        setError(/type|Use PDF/i.test(bad) ? `${f.name} · this file type can't be opened` : `${f.name} · ${bad}`);
        return;
      }
      const body = new FormData();
      body.append('file', f);
      const x = new XMLHttpRequest();
      xhr.current = x;
      x.open('POST', `/api/client/documents/requests/${encodeURIComponent(req.id)}/upload`);
      x.upload.onprogress = (e) => {
        if (e.lengthComputable) setPct(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      };
      x.onload = () => {
        xhr.current = null;
        let json: { fileId?: string; error?: string } = {};
        try {
          json = JSON.parse(x.responseText || '{}');
        } catch {
          /* empty */
        }
        if (x.status >= 200 && x.status < 300 && json.fileId) {
          setPct(100);
          onUploaded({ fileId: json.fileId, requestId: req.id, label: req.label });
        } else {
          setPct(null);
          setError(json.error ? (json.error.includes(f.name) ? json.error : `${f.name} · ${json.error}`) : `${f.name} · upload failed`);
        }
      };
      x.onerror = () => {
        xhr.current = null;
        setPct(null);
        setError(`${f.name} · upload failed`);
      };
      setPct(1);
      x.send(body);
    },
    [file, req, onUploaded],
  );

  // a file handed in (pane drop zone, phone camera) starts at once
  useEffect(() => {
    if (initialFile && req) start(initialFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setError(null);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    pick(e.dataTransfer.files?.[0] ?? null);
  };

  const uploading = pct != null;

  return (
    <PagePortal>
      <div className="vup">
        <div
          className="vup-scrim"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !uploading) close();
          }}
        >
          <div className="vup-dlg" role="dialog" aria-modal="true" aria-labelledby="vup-title">
            <div className="vup-hd">
              <h2 id="vup-title">Upload a document</h2>
              <button ref={closeRef} type="button" className="sx-ib sm" aria-label="Close" onClick={close}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="vup-bd">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span id="up-for" className="vup-lbl">
                  For
                </span>
                <div className="vup-for" role="radiogroup" aria-labelledby="up-for">
                  {shown.map((r) => {
                    const on = r.id === sel;
                    return (
                      <button key={r.id} type="button" role="radio" aria-checked={on} disabled={uploading} onClick={() => setSel(r.id)}>
                        <span className="vup-radio" aria-hidden="true" />
                        <span className="vup-rl">{r.label}</span>
                        <span className="cp-tw">
                          {r.reupload ? (
                            <Chip fixed tone="bad">
                              Re-upload
                            </Chip>
                          ) : (
                            <Chip fixed tone={r.overdue ? 'bad' : 'warn'}>
                              {missingLabel(r)}
                            </Chip>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {req?.note ? (
                <div className="vup-note">
                  <span className="vup-ini" role="img" aria-label={req.noteBy ?? 'SBC'} data-tip={req.noteBy ?? 'SBC'}>
                    {initials(req.noteBy)}
                  </span>
                  <span>“{req.note}”</span>
                </div>
              ) : null}
              {error ? (
                <div role="alert" className="vup-file err">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
                    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z M12 9v4 M12 17h.01" />
                  </svg>
                  <span className="vup-fn">{error}</span>
                  <button
                    type="button"
                    className="sx-btn sm"
                    onClick={() => {
                      setError(null);
                      setFile(null);
                      input.current?.click();
                    }}
                  >
                    Try again
                  </button>
                </div>
              ) : uploading && file ? (
                <div className="vup-file up">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="cp-tw">
                      <FileBadge name={file.name} />
                    </span>
                    <span className="vup-fn idm">{file.name}</span>
                    <span className="mono cap">{pct}%</span>
                    <button
                      type="button"
                      className="sx-ib sm"
                      aria-label="Cancel upload"
                      onClick={() => {
                        xhr.current?.abort();
                        xhr.current = null;
                        setPct(null);
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                  <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? 0} aria-label="Upload progress">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ) : (
                <div
                  className={`vup-big${over ? ' over' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label="Choose a file to upload"
                  onClick={() => input.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      input.current?.click();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOver(true);
                  }}
                  onDragLeave={() => setOver(false)}
                  onDrop={onDrop}
                >
                  <svg className="vup-up" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d={UP_ICON} />
                  </svg>
                  {over ? (
                    <span className="vup-dt">Release to upload</span>
                  ) : file ? (
                    <span className="vup-dt" style={{ overflowWrap: 'anywhere' }}>
                      <span className="cp-tw" style={{ marginRight: 8, verticalAlign: 'middle' }}>
                        <FileBadge name={file.name} />
                      </span>
                      {file.name}
                    </span>
                  ) : (
                    <span className="vup-dt">
                      {req?.reupload ? 'Drop the new file here or ' : 'Drop files here or '}
                      {/* link-styled word only: the whole drop zone around it is the button that opens the picker */}
                      <span className="vup-browse">browse</span>
                    </span>
                  )}
                  <span className="vup-cap">{caption}</span>
                </div>
              )}
              <input
                ref={input}
                type="file"
                hidden
                style={{ display: 'none' }}
                accept={accept.exts.map((e) => `.${e}`).join(',')}
                onChange={(e) => {
                  pick(e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
              />
            </div>
            <div className="vup-foot">
              <button type="button" className="sx-btn" onClick={close}>
                Cancel
              </button>
              <button type="button" className="sx-btn p" disabled={!file || !req || uploading || !!error} onClick={() => start()}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={UP_ICON} />
                </svg>
                Upload
              </button>
            </div>
          </div>
        </div>
      </div>
    </PagePortal>
  );
}
