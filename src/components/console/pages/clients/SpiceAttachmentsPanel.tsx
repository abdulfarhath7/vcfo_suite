'use client';

/**
 * SPICe+ ATTACHMENTS (spec T6, docs/ui-port/fixes/overnight-m8.md) in the console's own panel
 * form: the documents SPICe+ Part B needs, each from its checklist step, with Not started /
 * Waiting / Done derived from records that already exist (`GET
 * /api/engagements/:id/spice-attachments`, `useSpiceAttachments`). The accepted board
 * resolution opens its Vault copy. Staff only (the route refuses clients), so this lives on the
 * staff client page and not in the client portal.
 */
import type { Engagement } from '@/data/engagements';
import { useSpiceAttachments } from '@/hooks/use-spice-attachments';
import { SPICE_ATTACHMENT_STATUS_LABEL, type SpiceAttachmentStatus } from '@/lib/spice-attachments/derive';
import { useConsole } from '../../runtime';
import { Btn, Panel } from '../../ui';
import { stepCode } from './model';
import '../../css/96-spice.css';

/** Status → the console's pill vocabulary: green done, amber needs someone, grey not started. */
const STATUS_PILL: Record<SpiceAttachmentStatus, string> = { done: 'ok', waiting: 'due', 'not-started': 'mut' };

export function SpiceAttachmentsPanel({ eng }: { eng: Engagement }) {
  const { base, go } = useConsole();
  const query = useSpiceAttachments(eng.id);
  const list = query.data;
  return (
    <Panel
      id="cx-spice"
      title="SPICe+ attachments"
      sub="What SPICe+ Part B needs, each read from its step · Done, Waiting or Not started"
      need="inc"
      act={list ? <span className="small">{`${list.done} of ${list.total} done`}</span> : undefined}
    >
      {query.isPending ? (
        <p className="small">Loading…</p>
      ) : query.isError ? (
        <div className="mx-tb">
          <span className="small">Could not load the SPICe+ attachments.</span>
          <Btn cls="sm" onClick={() => void query.refetch()}>
            Try again
          </Btn>
        </div>
      ) : !list?.items.length ? (
        <p className="small">No attachments to show for this company.</p>
      ) : (
        <>
          <div className="mx-th cx-sp" aria-hidden="true">
            <span>Document</span>
            <span>From</span>
            <span>State</span>
            <span>Status</span>
            <span />
          </div>
          {list.items.map((row) => (
            <div key={row.key} className="mx-tr static cx-sp" title={`${row.label} · ${row.stepTitle} · ${row.detail} · ${SPICE_ATTACHMENT_STATUS_LABEL[row.status]}`}>
              <b className="cx-ell cx-sp-doc">{row.label}</b>
              <span className="small cx-sp-from">{`${stepCode(row.stepId)} ${row.stepTitle}`}</span>
              <span className="small cx-sp-state">{row.detail}</span>
              <span className={'pill sm ' + STATUS_PILL[row.status]}>{SPICE_ATTACHMENT_STATUS_LABEL[row.status]}</span>
              {row.vaultDocumentId ? (
                <button type="button" className="link" onClick={() => go(`${base}/vault/view/${encodeURIComponent(row.vaultDocumentId!)}`)} title="Open the accepted copy in the Document vault">
                  Open copy
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
          <p className="small cx-sp-note">Nothing is stored for this list: it reads the step status, the document pack and the board resolution as they are now.</p>
        </>
      )}
    </Panel>
  );
}
