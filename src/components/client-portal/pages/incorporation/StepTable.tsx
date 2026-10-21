'use client';

/**
 * The steps table — landing accordion (`stepTable`, FINAL incorporation.html:
 * "Portal · Proof" column, "Open →" text button, "Next" status) and the phase
 * page (`stepTable`, phase.html: ↗·📎 column, (?) and → square buttons).
 */
import type { PortalPhase, PortalStep } from '@/lib/client-portal/step-model';
import { internRegistrationHeadingForTitle } from '@/lib/intern-overview-progress';
import { extractItemResponses } from '@/lib/checklist-responses';
import { getStepAttachmentRequirements } from '@/lib/checklist-step-attachments';
import type { OwnershipType } from '@/data/engagements';
import { usePortal } from '../../PortalProvider';
import type { ViewerDoc } from '../documents/DocViewer';
import { BotSay, Ic, Own, Si } from './ui';
import {
  KL,
  PH,
  PHL,
  PH_WAIT,
  dateCell,
  glyph,
  kd,
  lkind,
  ownKey,
  signedUrlFor,
  stepAnswer,
  stepHrefOf,
  tipTxt,
  type LK,
} from './data';
import { portalFor } from './portals';

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

export function viewerDocsFor(s: PortalStep, files: StepFile[]): ViewerDoc[] {
  return files.map((f) => ({
    id: `${s.id}:${f.fieldId}`,
    name: f.fileName,
    url: () => signedUrlFor(f.path),
    meta: `Step ${s.n} · ${s.title}`,
  }));
}

function ltip(s: PortalStep, k: LK): string {
  return tipTxt(s, k);
}

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
  const { go, openChat, toast } = usePortal();
  const p = phase.no;
  const rows: React.ReactNode[] = [];
  let g = '';
  const landing = variant === 'landing';

  for (const x of phase.steps) {
    if (p === 4) {
      const gg = internRegistrationHeadingForTitle(x.title);
      if (gg !== g) {
        rows.push(
          <div className="grp" key={`g-${gg}`}>
            {gg}
          </div>,
        );
        g = gg;
      }
    }
    const k: LK = landing ? lkind(x) : kd(x);
    const o = ownKey(x);
    const portal = o !== 'You' && x.n !== 2 ? portalFor(x.item) : null;
    const files = stepFiles(x, ownershipType);
    let lk: React.ReactNode = null;
    if (landing) {
      lk = (
        <>
          {portal ? (
            <button
              type="button"
              className="lkb"
              aria-label={`Open ${portal.form} on the official portal`}
              data-tt={`${portal.form} · official portal`}
              data-notip=""
              onClick={() => {
                window.open(portal.url, '_blank', 'noopener,noreferrer');
                toast(`Opens ${portal.form} on the official portal in a new tab`);
              }}
            >
              <Ic n="external-link" />
            </button>
          ) : null}
          {portal && k === 'done' ? (
            files.length ? (
              <button
                type="button"
                className="prf"
                aria-label={`Proof of step ${x.n} · ${x.title}`}
                onClick={() => openViewer(viewerDocsFor(x, files), 0)}
              >
                <Ic n="paperclip" />
                Proof
              </button>
            ) : (
              <span className="prf pend" role="img" aria-label={`Proof pending · step ${x.n}`} data-tt="Proof pending · SBC uploads it">
                Proof pending
              </span>
            )
          ) : null}
        </>
      );
    } else if (files.length) {
      lk = (
        <a
          href={stepHrefOf(x)}
          className="lkb"
          aria-label={`Attachments of step ${x.n}`}
          data-tt="Attachments · open the step"
          data-notip=""
          onClick={(e) => {
            e.preventDefault();
            go(stepHrefOf(x));
          }}
        >
          <Ic n="paperclip" />
        </a>
      );
    } else if (portal) {
      lk = (
        <button
          type="button"
          className="lkb"
          aria-label={`Open ${portal.form} on the official portal`}
          data-tt={`${portal.form} · official portal`}
          data-notip=""
          onClick={() => {
            window.open(portal.url, '_blank', 'noopener,noreferrer');
            toast(`Opens ${portal.form} on the official portal in a new tab`);
          }}
        >
          <Ic n="external-link" />
        </button>
      );
    }
    rows.push(
      <div className={`str k-${k}${cur === x.id ? ' cur' : ''}`} id={`step-${x.n}`} key={x.id}>
        <Si k={glyph(x, k)} tip={ltip(x, k)} />
        <span className="nb">{x.n}</span>
        <span className="nm" title={x.title}>
          {x.title}
          {x.item.urgent ? <span className="urg">Urgent</span> : null}
        </span>
        <span className="c-own">
          <Own o={o} short={short} />
        </span>
        <span className="c-st">
          <span className={`chip ${k}`}>{KL[k]}</span>
        </span>
        <span className="dt c-dt">{dateCell(x, coi)}</span>
        <span className="lkc c-lk">{lk}</span>
        {landing ? (
          <a
            href={stepHrefOf(x)}
            className="btn sm so"
            aria-label={`Open step ${x.n} · ${x.title}`}
            onClick={(e) => {
              e.preventDefault();
              go(stepHrefOf(x));
            }}
          >
            Open
            <Ic n="arrow-right" />
          </a>
        ) : (
          <>
            <button
              type="button"
              className="sq"
              aria-label={`What’s this? ${x.title}`}
              data-tt="What’s this? · ask VCFO"
              data-notip=""
              onClick={() => openChat(`What’s this: ${x.title}?`, stepAnswer(x, short))}
            >
              <Ic n="circle-help" />
            </button>
            <a
              href={stepHrefOf(x)}
              className="sq"
              aria-label={`Open step ${x.n} · ${x.title}`}
              data-tt={`Open step ${x.n}`}
              data-notip=""
              onClick={(e) => {
                e.preventDefault();
                go(stepHrefOf(x));
              }}
            >
              <Ic n="arrow-right" />
            </a>
          </>
        )}
      </div>,
    );
  }

  const waitText = phase.state === 'up' && PH_WAIT[p - 1] ? PH_WAIT[p - 1] : '';
  const waitQ = landing ? `When does ${PHL[p - 1]} start?` : `When does Phase ${p} · ${PH[p - 1]} start?`;

  return (
    <>
      {waitText ? (
        <BotSay
          text={waitText}
          btn="Ask VCFO when it starts"
          aria={landing ? `Ask VCFO when ${PHL[p - 1]} starts` : `Ask VCFO when Phase ${p} starts`}
          onBtn={() => openChat(waitQ)}
        />
      ) : null}
      <div className="stt">
        <div className="sth" aria-hidden="true">
          <span />
          <span />
          <span>Step</span>
          <span className="c-own">Owner</span>
          <span className="c-st">Status</span>
          <span className="c-dt">Date</span>
          {landing ? (
            <span className="lk c-lk">Portal · Proof</span>
          ) : (
            <span className="lk c-lk">
              <Ic n="external-link" />·<Ic n="paperclip" />
            </span>
          )}
          <span />
          {landing ? null : <span />}
        </div>
        {rows}
      </div>
    </>
  );
}
