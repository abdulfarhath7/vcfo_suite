'use client';

/**
 * Workspace pages (Email, Document vault, Knowledge bank) — the pieces they
 * share: the file preview modal (a PDF in a frame, an image, or "no preview"
 * with the live open-in-a-new-tab action), a confirm box for deletes, quiet
 * loading / error states and a small JSON fetch helper.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useConsole } from '../../runtime';
import { ModalBody } from '../../overlays';
import { Btn, Icon } from '../../ui';
import { fileTag, previewModeOf } from './model';
import '../../css/96-workspace.css';

/* ---------------------------------------------------------------- fetch */

/** GET / POST JSON; throws an Error carrying the API's `error` code (mapped to words by the caller). */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!res.ok || data?.ok === false) {
    const err = new Error(data?.error || `request_failed_${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---------------------------------------------------------------- small hooks */

/** The value, settled for `ms` (the email preview redraws after typing pauses). */
export function useSettled<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/* ---------------------------------------------------------------- states */

export function PanelLoading({ label }: { label: string }) {
  return (
    <section className="glass panel mx-p">
      <div className="sec-load">{label}</div>
    </section>
  );
}

export function ErrorLine({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="sec-err">
      <Icon name="alert" />
      <span>{text}</span>
      <span className="sp" />
      {onRetry ? (
        <button type="button" className="btn sm" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- confirm */

/** A delete (or other one-way) confirmation in the console modal. */
export function ConfirmBox({
  title,
  sub,
  confirm,
  danger,
  onConfirm,
}: {
  title: string;
  sub: ReactNode;
  confirm: string;
  danger?: boolean;
  /** resolve to close; return a message to show it and keep the box open */
  onConfirm: () => Promise<string | void>;
}) {
  const { closeModal } = useConsole();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async () => {
    setBusy(true);
    setErr('');
    try {
      const msg = await onConfirm();
      if (msg) setErr(msg);
      else closeModal();
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <ModalBody
      title={title}
      sub={sub}
      foot={
        <>
          <Btn onClick={closeModal} disabled={busy}>
            Cancel
          </Btn>
          <span className="sp" />
          <Btn cls={danger ? 'danger' : 'pri'} ico={danger ? 'x' : 'check'} disabled={busy} onClick={() => void run()}>
            {busy ? 'Working…' : confirm}
          </Btn>
        </>
      }
    >
      {err ? <p className="ws-err">{err}</p> : null}
    </ModalBody>
  );
}

/* ---------------------------------------------------------------- file preview */

type Loaded = { state: 'loading' } | { state: 'error' } | { state: 'ready'; url: string };

/**
 * The preview modal (prototype mxDocPreview; client portal #docm). The file is
 * opened through the same short-lived link the live page opens in a new tab;
 * a PDF draws in a frame, an image as itself, anything else says so and keeps
 * the open / download action.
 */
export function FilePreview({
  title,
  fileName,
  contentType,
  meta,
  load,
  openLabel = 'Open in a new tab',
  extra,
}: {
  title: string;
  fileName: string;
  contentType?: string | null;
  meta?: ReactNode;
  /** the signed link, or null when it is not available */
  load: () => Promise<string | null>;
  openLabel?: string;
  /** more footer actions (e.g. Open step) */
  extra?: ReactNode;
}) {
  const { closeModal } = useConsole();
  const [file, setFile] = useState<Loaded>({ state: 'loading' });
  const [n, setN] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setFile({ state: 'loading' });
    load()
      .then((url) => {
        if (!cancelled) setFile(url ? { state: 'ready', url } : { state: 'error' });
      })
      .catch(() => {
        if (!cancelled) setFile({ state: 'error' });
      });
    return () => {
      cancelled = true;
    };
    // load is a fresh closure per render; the file is fetched once per open (and per Try again)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);
  const mode = previewModeOf(fileName, contentType);
  const tag = fileTag(fileName, contentType);
  const url = file.state === 'ready' ? file.url : null;
  return (
    <div className="ws-prev">
      <div className="docm-h">
        <span className={'mx-ft2 big ' + tag.cls}>{tag.text}</span>
        <h3 className="ws-prevt" title={title}>
          {title}
        </h3>
        <button type="button" className="ib x" aria-label="Close" onClick={closeModal}>
          <Icon name="x" />
        </button>
      </div>
      {meta ? <div className="small ws-prevm-sub">{meta}</div> : null}
      <div className="ws-prevb">
        {file.state === 'loading' ? (
          <div className="ws-pnone">
            <span className="small">Opening…</span>
          </div>
        ) : file.state === 'error' ? (
          <div className="ws-pnone">
            <Icon name="alert" size={26} />
            <b>The link to this file is not available</b>
            <span className="small">The file may have been removed, or its step is not shared with you yet.</span>
            <Btn cls="sm" onClick={() => setN((x) => x + 1)}>
              Try again
            </Btn>
          </div>
        ) : mode === 'pdf' && url ? (
          <iframe className="ws-pframe" src={`${url}#view=FitH`} title={fileName} />
        ) : mode === 'image' && url ? (
          // eslint-disable-next-line @next/next/no-img-element -- a signed storage link, not a static asset
          <img className="ws-pimg" src={url} alt={title} />
        ) : (
          <div className="ws-pnone">
            <span className={'mx-ft2 big ' + tag.cls}>{tag.text}</span>
            <b>No preview for this file type</b>
            <span className="small">{`${openLabel === 'Download' ? 'Download it' : 'Open it in a new tab'} to read it or save it.`}</span>
          </div>
        )}
      </div>
      <div className="mfoot">
        {extra ?? null}
        <span className="sp" />
        <Btn onClick={closeModal}>Close</Btn>
        {url ? (
          <a className="btn pri" href={url} target="_blank" rel="noopener noreferrer">
            <Icon name={openLabel === 'Download' ? 'dl' : 'ext'} />
            {openLabel}
          </a>
        ) : (
          <button type="button" className="btn pri" disabled>
            <Icon name={openLabel === 'Download' ? 'dl' : 'ext'} />
            {openLabel}
          </button>
        )}
      </div>
    </div>
  );
}
