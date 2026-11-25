import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { getAskChangesetSummary } from '@/db/repositories/ask-changesets';
import { fieldOf, rowCanApply, type ResponseTarget } from '@/lib/actions/checklist/rules';
import { SLOT_LABEL } from '@/lib/actions/labour/upload-sheet';
import { statesForPicker } from '@/data/labour-registers/states';
import { catalogEntry } from '@/lib/ask/field-catalog';
import { canDecideRow, rowEditable, rowStateEditable } from './apply';
import { groupChangesetRows, rowPlace } from './view-groups';
import type { ChangesetRowStatus, ChangesetStatus } from './types';
import type { ChangesetRowView, ChangesetView } from './view-types';

const QUOTE_SHOWN = 160;

/**
 * Where a row's value came from, as the card shows it: the file (and the attachment inside it, for
 * an email), the page, and the words it was read from, so a summary such as the business
 * description can be checked against its document at a glance.
 */
export function rowSourceText(source: { kind: string; fileName?: string; page?: number; quote?: string } | null | undefined): string | null {
  if (!source) return null;
  const pageNote = source.page ? `page ${source.page}` : '';
  const quote = source.quote?.trim() ? `“${source.quote.trim().length > QUOTE_SHOWN ? `${source.quote.trim().slice(0, QUOTE_SHOWN - 1).trimEnd()}…` : source.quote.trim()}”` : '';
  const where =
    source.kind === 'attachment' ? [source.fileName, pageNote].filter(Boolean).join(', ') || 'Attached file' : source.kind === 'paste' ? 'Pasted text' : source.kind === 'message' ? 'Your message' : null;
  if (!where) return null;
  return quote ? `${where}: ${quote}` : where;
}

export async function loadChangesetView(ctx: AuthContext, id: string): Promise<ChangesetView | null> {
  const found = await getAskChangesetSummary(ctx, id);
  if (!found) return null;
  const { changeset } = found;
  const rows = found.rows.map((row): ChangesetRowView => {
    const target = row.target as unknown as ResponseTarget;
    const field = target.stepId ? fieldOf(target) : null;
    const source = rowSourceText(row.source);
    const place = rowPlace(row, (slot) => SLOT_LABEL[slot as keyof typeof SLOT_LABEL] ?? slot);
    const open = row.status === 'proposed' || row.status === 'edited' || row.status === 'held' || row.status === 'failed';
    // A labour sheet's state is chosen from the list of states; the edit sends the state code.
    const stateEdit = rowStateEditable(row.action);
    // A registration field row takes its choices and its date editor from the catalog entry it was placed under.
    const entry = row.action === 'registrations.setField' && typeof row.target.catalogKey === 'string' ? catalogEntry(row.target.catalogKey) : undefined;
    const options = stateEdit ? statesForPicker().map((s) => ({ value: s.code, label: s.name })) : (field?.options ?? entry?.options)?.map((o) => ({ value: o.value, label: o.label }));
    return {
      id: row.id,
      stepId: target.stepId ?? null,
      stepTitle: place.stepTitle,
      label: place.label,
      displayOld: row.displayOld,
      displayNew: row.displayNew,
      sensitive: row.sensitive,
      source,
      checks: row.checks,
      status: row.status as ChangesetRowStatus,
      heldReason: row.heldReason,
      error: row.error,
      canDecide: canDecideRow(found, row),
      canAccept: open && rowCanApply(row.checks),
      needsLook: row.checks.some((check) => !check.ok),
      editable: open && rowEditable(row.action),
      ...(options?.length ? { options } : {}),
      ...(stateEdit && typeof row.target.stateCode === 'string' ? { editValue: row.target.stateCode, editLabel: `State for ${place.label}` } : {}),
      inputType: options?.length ? 'choice' : field?.type === 'date' || entry?.format === 'date' ? 'date' : 'text',
      groupKey: place.groupKey,
      groupTitle: place.groupTitle,
      groupKind: place.kind,
      sourceFile: place.sourceFile,
    };
  });
  return {
    id: changeset.id,
    title: changeset.title,
    tier: changeset.tier === 'T3' ? 'T3' : 'T2',
    recipients: (changeset.recipients ?? []).map((r) => ({ name: r.name, ...(r.email ? { email: r.email } : {}) })),
    companyName: found.companyName,
    engagementId: changeset.engagementId,
    status: changeset.status as ChangesetStatus,
    contentHash: changeset.contentHash,
    expiresAt: changeset.expiresAt.toISOString(),
    canUndo: (found.owner || changeset.decidedById === ctx.userId) && found.rows.some((row) => row.status === 'applied'),
    rows,
    groups: groupChangesetRows(rows),
  };
}
