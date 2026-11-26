'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, m } from 'framer-motion';
import { AlertCircle, Check, ExternalLink, FileDown, Hand, Pause, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip, type ChipTone } from '@/components/ui/spectrum-chip';
import { cn } from '@/lib/utils';
import type { LiveFieldView, LiveSessionStatus, LiveViewState } from '@/lib/live-browser/contract';
import { LIVE_STATUS_LABEL, type LiveSessionView } from '@/lib/live-browser/types';
import type { LiveStream } from './use-live-stream';

/**
 * The agent rail beside the live portal (MASTER-PLAN.md screens 5 and 6): the progress bar, the
 * fields ticking off, the "Your turn" banner, Pause, Pop out and Close. The same rail serves the
 * in-app live mode (`watch`) and the portal tab (`act`); only the act rail offers the PDF to sign
 * and the signed PDF drop. The confirm table (G13) shows values only when the agent asks.
 */

const STATUS_TONE: Record<LiveSessionStatus, ChipTone> = {
  starting: 'idle',
  ready: 'prog',
  your_turn: 'teal',
  running: 'prog',
  paused: 'warn',
  done: 'ok',
  cancelled: 'idle',
  failed: 'bad',
  expired: 'idle',
};

function FieldMark({ status, typing }: { status: string; typing: boolean }) {
  if (status === 'filled')
    return (
      <m.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="grid h-4 w-4 flex-none place-items-center rounded-full bg-positive-soft text-positive">
        <Check className="h-3 w-3" strokeWidth={2} aria-hidden />
      </m.span>
    );
  if (typing)
    return (
      <span className="relative grid h-4 w-4 flex-none place-items-center" aria-hidden>
        <span className="h-2 w-2 rounded-full bg-brand" />
        <span className="absolute h-3.5 w-3.5 animate-ping rounded-full bg-brand/25" />
      </span>
    );
  if (status === 'refused' || status === 'failed') return <AlertCircle className="h-4 w-4 flex-none text-danger" strokeWidth={1.8} aria-hidden />;
  if (status === 'missing' || status === 'user' || status === 'placeholder') return <Hand className="h-4 w-4 flex-none text-warning" strokeWidth={1.8} aria-hidden />;
  return <span className="h-4 w-4 flex-none rounded-full border-1.5 border-line-strong" aria-hidden />;
}

const FIELD_WORD: Record<string, string> = {
  filled: 'filled',
  planned: 'next',
  missing: 'you fill this',
  user: 'you fill this',
  placeholder: 'you fill this from the records',
  refused: 'refused: yours',
  failed: 'not filled',
  pending: 'waiting',
};

function FieldRow({ f, typing }: { f: LiveFieldView; typing: boolean }) {
  return (
    <li className="flex items-start gap-2 py-1 text-[13px]" data-testid="live-field" data-status={f.status}>
      <FieldMark status={f.status} typing={typing} />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate', f.status === 'filled' ? 'text-ink' : 'text-ink-2')}>{f.label}</span>
        <span className="block text-[11px] text-ink-muted">{typing ? 'typing…' : (FIELD_WORD[f.status] ?? f.status)}</span>
      </span>
    </li>
  );
}

export interface LiveRailProps {
  stream: LiveStream;
  session: LiveSessionView | null;
  agentName: string;
  form: string;
  mode: 'watch' | 'act';
  /** `lead`, `manager`, `admin` or `super`: the shell the links open in. */
  segment: string;
  onPopOut?: () => void;
  onGoToPortal?: () => void;
  onClose?: () => void;
  onStop?: () => void;
}

export function LiveRail({ stream, session, agentName, form, mode, segment, onPopOut, onGoToPortal, onClose, onStop }: LiveRailProps) {
  const s: LiveViewState | null = stream.state;
  const status: LiveSessionStatus = s?.status ?? session?.status ?? 'starting';
  const done = s?.fieldsDone ?? session?.fieldsDone ?? 0;
  const total = s?.fieldsTotal ?? session?.fieldsTotal ?? 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const yourTurn = status === 'your_turn';
  const [thanks, setThanks] = useState(false);
  const was = useRef<LiveSessionStatus | null>(null);

  // "Thanks, I continue" once the person's step is done and the agent goes on.
  useEffect(() => {
    if (was.current === 'your_turn' && (status === 'running' || status === 'ready')) {
      setThanks(true);
      const t = setTimeout(() => setThanks(false), 3500);
      was.current = status;
      return () => clearTimeout(t);
    }
    was.current = status;
  }, [status]);

  const gate = s?.gate ?? null;
  const confirming = gate === 'CONFIRM';
  const runId = session?.runId;

  return (
    <aside className="flex h-full min-h-0 flex-col gap-3 overflow-hidden" aria-label={`${agentName} agent`} data-testid="live-rail">
      <header className="flex items-start gap-2">
        <span className="mt-1 h-2.5 w-2.5 flex-none rounded-full bg-brand" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-ink">{agentName}</p>
          <p className="truncate text-[12px] text-ink-muted">
            {session?.companyName ?? ''}
            {session?.companyName ? ' · ' : ''}
            {form}
          </p>
        </div>
        <Chip tone={STATUS_TONE[status]} data-testid="live-status">
          {LIVE_STATUS_LABEL[status]}
        </Chip>
      </header>

      <div>
        <div className="mb-1 flex items-center justify-between text-[12px] text-ink-muted">
          <span>{s && s.pageCount > 1 ? `Page ${s.page + 1} of ${s.pageCount}` : (s?.pageTitle ?? 'Portal')}</span>
          <span data-testid="live-count">
            {done} / {total}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-ink/[.08]" role="progressbar" aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={done} aria-label="Fields filled">
          <m.div className="h-full rounded-full bg-brand" initial={false} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {yourTurn ? (
          <m.section
            key="turn"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-lg border-1.5 border-warning/50 bg-warning-soft px-3 py-2.5"
            role="status"
            data-testid="your-turn"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-warning-text">Your turn</p>
            <p className="mt-0.5 text-[13px] text-ink">{s?.line ?? session?.progressText}</p>
            {mode === 'watch' && onGoToPortal && !confirming && gate !== 'CERTIFIER' ? (
              <Button size="sm" className="mt-2" onClick={onGoToPortal} data-testid="go-to-portal">
                <ExternalLink aria-hidden /> Go to portal tab
              </Button>
            ) : null}
            {gate === 'CERTIFIER' && runId ? (
              <Button asChild size="sm" variant="secondary" className="mt-2">
                <Link href={`/app/${segment}/assist-runs?run=${runId}`} target="_blank">
                  Record the certifier&apos;s checks
                </Link>
              </Button>
            ) : null}
            {gate === 'CHECK' || gate === 'PAGE' || gate === 'STEP' ? (
              <Button size="sm" variant="secondary" className="mt-2" onClick={() => stream.send({ t: 'event', event: 'RETRY' })}>
                Try again
              </Button>
            ) : null}
            {gate === 'TEACH' ? (
              <Button size="sm" variant="secondary" className="mt-2" onClick={() => stream.send({ t: 'event', event: 'SKIP_TEACH' })}>
                Skip this field
              </Button>
            ) : null}
          </m.section>
        ) : thanks ? (
          <m.p key="thanks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-lg bg-positive-soft px-3 py-2 text-[13px] text-positive" role="status">
            Thanks, I continue.
          </m.p>
        ) : (
          <p key="line" className="text-[13px] text-ink-2" data-testid="live-line">
            {s?.line ?? session?.progressText ?? 'Starting the live browser…'}
          </p>
        )}
      </AnimatePresence>

      {confirming ? (
        <section className="rounded-lg border border-line p-2" aria-label="What the agent will write">
          <p className="mb-1 text-[12px] font-medium text-ink">The agent will write these values. Check them, then fill the page.</p>
          <table className="w-full text-[12px]">
            <tbody>
              {(s?.fields ?? [])
                .filter((f) => f.status === 'planned')
                .map((f) => (
                  <tr key={f.key} className="border-t border-line">
                    <td className="py-1 pr-2 text-ink-muted">{f.label}</td>
                    <td className="py-1 font-mono text-ink">{f.value}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <Button size="sm" className="mt-2 w-full" onClick={() => stream.send({ t: 'event', event: 'CONFIRM_FILL' })} data-testid="confirm-fill">
            Fill page
          </Button>
        </section>
      ) : null}

      <ul className="min-h-0 flex-1 overflow-y-auto pr-1" aria-label="Fields">
        {(s?.fields ?? []).map((f) => (
          <FieldRow key={f.key} f={f} typing={s?.typing === f.label && f.status === 'planned'} />
        ))}
      </ul>

      {s?.srn ? (
        <p className="rounded-lg bg-positive-soft px-3 py-2 text-[13px] text-positive" data-testid="live-srn">
          SRN <span className="font-mono font-semibold">{s.srn}</span> saved in VCFO Suite.
        </p>
      ) : null}

      {mode === 'act' ? <DscTools stream={stream} /> : null}

      <footer className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
        {session?.open !== false && status !== 'done' ? (
          s?.paused ? (
            <Button size="sm" variant="secondary" onClick={() => stream.send({ t: 'resume' })} data-testid="live-resume">
              <Play aria-hidden /> Resume
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => stream.send({ t: 'pause' })} data-testid="live-pause">
              <Pause aria-hidden /> Pause
            </Button>
          )
        ) : null}
        {onPopOut ? (
          <Button size="sm" variant="secondary" onClick={onPopOut} data-testid="live-popout">
            <ExternalLink aria-hidden /> Pop out
          </Button>
        ) : null}
        {onStop && session?.open ? (
          <Button size="sm" variant="quiet" onClick={onStop}>
            Stop session
          </Button>
        ) : null}
        {onClose ? (
          <Button size="sm" variant="quiet" className="ml-auto" onClick={onClose} data-testid="live-close">
            <X aria-hidden /> Close
          </Button>
        ) : null}
      </footer>
    </aside>
  );
}

/** The DSC step in the portal tab: the portal's PDF to sign, and the signed PDF back (G6, G14). */
function DscTools({ stream }: { stream: LiveStream }) {
  const s = stream.state;
  const [signers, setSigners] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!s?.pdfReady && !s?.signers?.length) return null;
  const drop = async (file: File) => {
    if (!stream.access?.signedPdfUrl || !signers.length) {
      setNote('Choose who signed first.');
      return;
    }
    setBusy(true);
    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]!);
    const res = await fetch(stream.access.signedPdfUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: file.name, base64: btoa(bin), signers }) }).catch(() => null);
    setBusy(false);
    setNote(res?.ok ? 'Signed PDF sent. The agent attaches it unchanged.' : 'The signed PDF was not taken. Try again.');
  };
  return (
    <section className="space-y-2 rounded-lg border border-line p-2 text-[12px]" aria-label="Sign with DSC">
      {s.pdfReady && stream.access?.pdfUrl ? (
        <a className="inline-flex items-center gap-1 text-brand-text underline" href={stream.access.pdfUrl} download>
          <FileDown className="h-3.5 w-3.5" aria-hidden /> Download the form to sign
        </a>
      ) : null}
      {s.signers?.length ? (
        <>
          <fieldset>
            <legend className="mb-1 font-medium text-ink">Who signed?</legend>
            {s.signers.map((c) => (
              <label key={c.ref} className="flex items-center gap-2">
                <input type="checkbox" checked={signers.includes(c.ref)} onChange={(e) => setSigners((x) => (e.target.checked ? [...x, c.ref] : x.filter((r) => r !== c.ref)))} />
                {c.label}
              </label>
            ))}
          </fieldset>
          <label className="block">
            <span className="text-ink">Signed PDF</span>
            <input type="file" accept="application/pdf" disabled={busy} className="mt-1 block w-full" onChange={(e) => e.target.files?.[0] && void drop(e.target.files[0])} />
          </label>
        </>
      ) : null}
      {note ? <p className="text-ink-muted">{note}</p> : null}
    </section>
  );
}
