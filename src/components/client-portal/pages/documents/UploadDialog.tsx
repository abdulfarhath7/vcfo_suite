'use client';

/**
 * Upload flow (prototype s/docs/docs_upload.dc.html): "Upload a document"
 * dialog listing ONLY the open requests (DECISIONS: upload only against open
 * requests) · drop zone with the dragging state · real progress bar with
 * cancel · refused-file error with Try again · SBC's re-upload note.
 * The file goes to POST /api/client/documents/requests/[id]/upload.
 */
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import type { OpenRequest } from '@/lib/client-portal/documents';
import { validateMilestoneUploadFile } from '@/lib/documents/milestone-document-storage';
import { PagePortal } from './shared-ui';
import { fileTag, TAG_STYLE } from './file-types';
import { missingLabel, missingStyle } from './model';

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
  const tag = file ? fileTag(file.name, file.type) : 'FILE';

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
          <div className="vup-dlg" role="dialog" aria-modal="true" aria-label="Upload a document" style={{ background: 'var(--panel)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 24px 60px -20px oklch(15% 0.05 258 / 0.4)', overflow: 'hidden', fontFamily: 'Manrope,system-ui,sans-serif', color: 'var(--fg)', fontSize: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0, font: '700 15px Manrope,sans-serif', color: 'var(--navy-ink,var(--navy))', flex: 1 }}>Upload a document</h2>
              <button ref={closeRef} type="button" aria-label="Close" onClick={close} style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span id="up-for" style={{ fontSize: 12, fontWeight: 700 }}>
                  For
                </span>
                <div className="vup-for" role="radiogroup" aria-labelledby="up-for" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
                  {shown.map((r) => {
                    const on = r.id === sel;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={uploading}
                        onClick={() => setSel(r.id)}
                        style={{
                          textAlign: 'left',
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: on ? '2px solid var(--navy)' : '1px solid var(--border)',
                          background: on ? 'var(--primary-light)' : 'var(--panel)',
                          font: '700 12.5px Manrope,sans-serif',
                          color: on ? 'var(--navy-ink,var(--navy))' : 'var(--fg)',
                          cursor: 'pointer',
                        }}
                      >
                        {r.label}
                        <span style={{ display: 'block', marginTop: 4 }}>
                          {r.reupload ? (
                            <span className="chip" style={{ background: 'var(--over-chip)', color: '#fff' }}>
                              Re-upload
                            </span>
                          ) : (
                            <span className="chip" style={{ ...missingStyle(r), minWidth: r.overdue ? undefined : 116, justifyContent: 'center' }}>
                              {missingLabel(r)}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {req?.note ? (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 6, background: 'var(--raised)', fontSize: 12 }}>
                  <span className="mono" role="img" aria-label={req.noteBy ?? 'SBC'} data-tip={req.noteBy ?? 'SBC'} style={{ fontSize: 10, fontWeight: 700, padding: '2px 5px', borderRadius: 4, background: 'var(--navy)', color: '#fff' }}>
                    {initials(req.noteBy)}
                  </span>
                  <span>“{req.note}”</span>
                </div>
              ) : null}
              {error ? (
                <div role="alert" style={{ border: '1.5px solid oklch(57% 0.2 22 / .5)', borderRadius: 8, background: 'var(--over-light)', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                  <span style={{ width: 28, height: 28, borderRadius: 99, background: 'var(--over-chip)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                      <path d="M12 7v6 M12 16.5h.01" />
                    </svg>
                  </span>
                  <span style={{ flex: 1, fontSize: 12.5, color: 'var(--over-text)', fontWeight: 600, overflowWrap: 'anywhere' }}>{error}</span>
                  <button
                    type="button"
                    className="btn btn-o"
                    style={{ height: 28, fontSize: 12 }}
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
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="mono" style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 4, ...TAG_STYLE[tag] }}>
                      {tag}
                    </span>
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                    <span className="mono cap">{pct}%</span>
                    <button
                      type="button"
                      aria-label="Cancel upload"
                      onClick={() => {
                        xhr.current?.abort();
                        xhr.current = null;
                        setPct(null);
                      }}
                      style={{ width: 24, height: 24, borderRadius: 6, border: 0, background: 'none', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
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
                  <span style={{ width: 44, height: 44, borderRadius: 99, background: 'var(--navy)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d={UP_ICON} />
                    </svg>
                  </span>
                  {over ? (
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy-ink,var(--navy))' }}>Release to upload</span>
                  ) : file ? (
                    <span style={{ fontSize: 14, fontWeight: 700, overflowWrap: 'anywhere', textAlign: 'center' }}>{file.name}</span>
                  ) : (
                    <span style={{ fontSize: 14, fontWeight: 700 }}>
                      {req?.reupload ? 'Drop the new file here or ' : 'Drop files here or '}
                      {/* link-styled word only: the whole drop zone around it is the button that opens the picker */}
                      <span className="font-bold text-[color:var(--primary)] hover:text-[color:var(--primary-dark)]">browse</span>
                    </span>
                  )}
                  <span className="mono" style={{ fontSize: 11, color: 'var(--subtle)' }}>
                    {caption}
                  </span>
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
            <div className="vup-foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--raised)' }}>
              <button type="button" className="btn btn-o" onClick={close}>
                Cancel
              </button>
              <button type="button" className="btn btn-n" disabled={!file || !req || uploading || !!error} onClick={() => start()}>
                Upload
              </button>
            </div>
          </div>
        </div>
      </div>
    </PagePortal>
  );
}
