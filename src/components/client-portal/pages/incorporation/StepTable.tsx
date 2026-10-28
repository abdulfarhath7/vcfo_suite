'use client';

/**
 * The steps table (R-07, Stripe T1 clean rows; prototype PhaseScreen DataGrid and the
 * expanded timeline rows). Used by the landing timeline (a phase row opened) and the phase
 * page. Columns: the ST5 mark, the step, the owner, the status, the date, the portal and
 * proof. A row opens its step page.
 */
import { CircleHelp, ExternalLink, Paperclip } from 'lucide-react';
import { Fragment } from 'react';
import type { PortalPhase, PortalStep } from '@/lib/client-portal/step-model';
import { internRegistrationHeadingForTitle } from '@/lib/intern/intern-overview-progress';
import { extractItemResponses } from '@/lib/checklist/checklist-responses';
import { getStepAttachmentRequirements } from '@/lib/checklist/checklist-step-attachments';
import type { OwnershipType } from '@/data/engagements';
import { cn } from '@/lib/utils';
import { Chip, OwnerChip } from '@/components/ui/spectrum-chip';
import { StepMark } from '@/components/ui/step-track';
import { usePortal } from '../../PortalProvider';
import type { ViewerDoc } from '../documents/DocViewer';
import { PH, PHL, PH_WAIT, dateCell, kd, ownKey, signedUrlFor, stepAnswer, stepHrefOf, tipTxt } from './data';
import { portalFor } from './portals';
import { markState, markTone, stepChip, useGo } from './spectrum';

export interface StepFile {
  fieldId: string;
  label: string;
  path: string;
  fileName: string;
}

/** Uploaded files of a step (from the client-visible answers). */
export function stepFiles(s: PortalStep, ownershipType?: OwnershipType): StepFile[] {
  const responses = extractItemResponses(s.item, s.slice);
  return getStepAttachmentRequirements(s.item, responses, ownershipType)
    .filter((r) => r.uploaded && responses[r.fieldId])
    .map((r) => ({ fieldId: r.fieldId, label: r.label, path: responses[r.fieldId]!.trim(), fileName: r.fileName ?? r.label }));
}

function viewerDocsFor(s: PortalStep, files: StepFile[]): ViewerDoc[] {
  return files.map((f) => ({
    id: `${s.id}:${f.fieldId}`,
    name: f.fileName,
    url: () => signedUrlFor(f.path),
    meta: `Step ${s.n} · ${s.title}`,
  }));
}

const ICON_BTN = 'grid h-[30px] w-[30px] flex-none place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink';

export function StepTable({
  phase,
  variant,
  cur,
  short,
  coi,
  ownershipType,
  openViewer,
}: {
  phase: PortalPhase;
  variant: 'landing' | 'phase';
  cur?: string;
  short: string;
  coi?: string;
  ownershipType?: OwnershipType;
  openViewer: (docs: ViewerDoc[], i?: number) => void;
}) {
  const { openChat, toast, go } = usePortal();
  const goTo = useGo();
  const p = phase.no;
  const landing = variant === 'landing';
  let g = '';

  const waitText = phase.state === 'up' && PH_WAIT[p - 1] ? PH_WAIT[p - 1] : '';
  const waitQ = landing ? `When does ${PHL[p - 1]} start?` : `When does Phase ${p} · ${PH[p - 1]} start?`;

  const portalCell = (x: PortalStep) => {
    const o = ownKey(x);
    const portal = o !== 'You' && x.n !== 2 ? portalFor(x.item) : null;
    const files = stepFiles(x, ownershipType);
    const done = kd(x) === 'done';
    if (!portal && !files.length) return <span className="text-ink-faint">-</span>;
    return (
      <span className="flex items-center gap-1.5">
        {portal ? (
          <button
            type="button"
            className={ICON_BTN}
            aria-label={`Open ${portal.form} on the official portal`}
            data-tt={`${portal.form} · official portal`}
            data-notip=""
            onClick={(e) => {
              e.stopPropagation();
              window.open(portal.url, '_blank', 'noopener,noreferrer');
              toast(`Opens ${portal.form} on the official portal in a new tab`);
            }}
          >
            <ExternalLink size={15} strokeWidth={1.6} aria-hidden />
          </button>
        ) : null}
        {files.length ? (
          <button
            type="button"
            className="inline-flex h-[30px] items-center gap-1 rounded-md px-1.5 text-[12.5px] font-medium text-brand-text hover:bg-surface-sunken"
            aria-label={`${done ? 'Proof' : 'Attachments'} of step ${x.n} · ${x.title}`}
            onClick={(e) => {
              e.stopPropagation();
              openViewer(viewerDocsFor(x, files), 0);
            }}
          >
            <Paperclip size={14} strokeWidth={1.6} aria-hidden />
            {done ? 'Proof' : files.length}
          </button>
        ) : portal && done ? (
          <Chip tone="warn" data-tt="Proof pending · SBC uploads it">
            Proof pending
          </Chip>
        ) : null}
      </span>
    );
  };

  return (
    <div className="min-w-0">
      {waitText ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-2.5 text-[13px] text-ink-muted md:px-5">
          <span className="min-w-0 flex-1">{waitText}</span>
          <button
            type="button"
            className="text-[13px] font-medium text-brand-text hover:underline"
            aria-label={landing ? `Ask VCFO when ${PHL[p - 1]} starts` : `Ask VCFO when Phase ${p} starts`}
            onClick={() => openChat(waitQ)}
          >
            Ask VCFO
          </button>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="grid-table min-w-[720px]">
          <thead>
            <tr>
              <th className="w-10" aria-label="State" />
              <th>Step</th>
              <th className="w-[124px]">Owner</th>
              <th className="w-[124px]">Status</th>
              <th className="w-[128px]">Date</th>
              <th className="w-[120px]">Portal</th>
              {landing ? null : <th className="w-10" aria-label="Ask" />}
            </tr>
          </thead>
          <tbody>
            {phase.steps.map((x) => {
              const head = p === 4 ? internRegistrationHeadingForTitle(x.title) : '';
              const showHead = head && head !== g;
              if (head) g = head;
              const o = ownKey(x);
              const chip = stepChip(x);
              const dt = dateCell(x, coi);
              const late = x.late && kd(x) !== 'done';
              const href = stepHrefOf(x);
              return (
                <Fragment key={x.id}>
                  {showHead ? (
                    <tr>
                      <td colSpan={landing ? 6 : 7} className="!h-9 bg-surface-sunken text-[11.5px] font-medium uppercase tracking-[.07em] !text-ink-muted">
                        {head}
                      </td>
                    </tr>
                  ) : null}
                  <tr
                    id={`step-${x.n}`}
                    className={cn('cursor-pointer', cur === x.id && '[&>td]:!bg-brand-soft/50')}
                    onClick={() => go(href)}
                  >
                    <td className="text-center">
                      <span className="inline-grid" data-tt={tipTxt(x)}>
                        <StepMark state={markState(x)} tone={markTone(x)} size={20} label={chip.label} />
                      </span>
                    </td>
                    <td>
                      <a href={href} onClick={(e) => { e.stopPropagation(); goTo(href)(e); }} className="flex min-w-[200px] items-baseline gap-2" aria-label={`Open step ${x.n} · ${x.title}`}>
                        <span className="flex-none font-mono text-[12px] font-normal text-ink-muted">Step {x.n}</span>
                        <span className="truncate text-[14px] font-medium text-ink" title={x.title}>
                          {x.title}
                        </span>
                      </a>
                    </td>
                    <td>
                      <OwnerChip owner={o === 'You' ? 'client' : o === 'MCA' ? 'mca' : 'sbc'} label={o === 'You' ? short : undefined} />
                    </td>
                    <td>
                      <Chip tone={chip.tone} fixed>
                        {chip.label}
                      </Chip>
                    </td>
                    <td>
                      <span className={cn('whitespace-nowrap text-[13px]', late ? 'font-medium text-danger' : 'text-ink-muted')}>{dt}</span>
                    </td>
                    <td>{portalCell(x)}</td>
                    {landing ? null : (
                      <td>
                        <button
                          type="button"
                          className={ICON_BTN}
                          aria-label={`What’s this? ${x.title}`}
                          data-tt="What’s this? · ask VCFO"
                          data-notip=""
                          onClick={(e) => {
                            e.stopPropagation();
                            openChat(`What’s this: ${x.title}?`, stepAnswer(x, short));
                          }}
                        >
                          <CircleHelp size={15} strokeWidth={1.6} aria-hidden />
                        </button>
                      </td>
                    )}
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
