'use client';

import type { ChecklistItem } from '@/data/checklist';
import { getClientResponseFields, type ChecklistItemResponses } from '@/lib/checklist-responses';
import { isDeliveredToClient } from '@/lib/checklist-state-key';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';

/**
 * What a step will capture, shown to the client before it is their turn.
 *
 * A step the firm has not reached yet used to render one "nothing here" line,
 * which told the client nothing about what is coming. This lists the step's
 * fields so they can see what will be asked for and prepare — values appear
 * only where the client is entitled to them, and `—` everywhere else.
 *
 * >>> WHAT THIS DELIBERATELY DOES NOT SHOW <<<
 *  - Firm-side values before the step is delivered to the client. Delivery
 *    (`isDeliveredToClient`) is the existing release mechanism; this reuses it
 *    rather than inventing a second rule.
 *  - Internal working notes, at all — they are firm chatter, not a field the
 *    client is ever waiting on.
 *  - File links for firm-filled documents. The label appears so the client
 *    knows the document is coming; the link does not, so an unreleased board
 *    resolution or incorporation draft cannot leak through this surface.
 */

/** Firm free-text working notes — never surfaced to a client. */
function isInternalNote(fieldId: string, label: string): boolean {
  return /notes?$/i.test(fieldId) || /\bnotes?\b/i.test(label);
}

export function ClientStepFieldPreview({
  item,
  responses,
  itemState,
}: {
  item: ChecklistItem;
  responses?: ChecklistItemResponses;
  itemState?: ChecklistItemStateSlice;
}) {
  const released = isDeliveredToClient(itemState);

  const fields = getClientResponseFields(item).filter(
    (field) => !isInternalNote(field.id, field.label),
  );
  if (fields.length === 0) return null;

  return (
    // `.surface` so an unstarted step sits in the same card a filled one does.
    <div className="surface milestone-record-panel">
      <p className="mb-3 text-[12.5px] text-muted-foreground">
        Your team prepares this step. Here is what it captures.
      </p>
      <dl className="milestone-record">
        {fields.map((field) => {
          const firmOwned = field.filledBy === 'intern';
          const raw = (responses?.[field.id] ?? '').trim();
          // A firm value is shown only once the step has been delivered, and a
          // firm-held document is never linked from here — only named.
          const showValue = raw && (!firmOwned || released) && field.type !== 'file';

          return (
            <div key={field.id} className="milestone-record-row">
              <dt className="milestone-record-label">{field.label}</dt>
              <dd className="milestone-record-value">
                <p className={showValue ? 'text-sm text-foreground' : 'text-sm text-muted-foreground'}>
                  {showValue ? raw : '—'}
                </p>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
