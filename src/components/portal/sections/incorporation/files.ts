'use client';

/**
 * Step answers and files as the client sees them — the read-only rows and the
 * attachment list the previous portal's step page showed (copied from
 * src/components/client-portal/pages/incorporation/{StepPage.tsx answerRows,
 * StepTable.tsx stepFiles}, which is deleted with that folder). Field visibility
 * goes through the same shared rules (filterFieldsByViewer 'client',
 * fieldsForOwnership, showWhen, repeat groups), so nothing lead-only leaks.
 */
import type { ChecklistField } from '@/data/checklist';
import type { OwnershipType } from '@/data/engagements';
import type { PortalStep } from '@/lib/client-portal/step-model';
import { extractItemResponses, fieldsForOwnership, getClientResponseFields } from '@/lib/checklist-responses';
import { filterFieldsByViewer } from '@/lib/checklist-field-access';
import { applyShowWhen, expandRepeatFields, isRepeatField, repeatFieldLabel, resolveFieldLabels } from '@/lib/checklist-repeat';
import { withoutUnusedDirectorSlots } from '@/lib/incorp-director-slots';
import { getStepAttachmentRequirements } from '@/lib/checklist-step-attachments';
import { fileNameFromStoragePath, isMilestoneStoragePath } from '@/lib/milestone-document-storage';
import { fmt, fmtL } from '../../dates';

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

export interface AnswerRow {
  label: string;
  value: string;
  file?: string;
}

/**
 * Read-only answer rows. Direct-flow steps show every client field; SBC steps
 * list what they capture from the item's infoRequired. File fields already in
 * the files list (`inDocs`) are left out.
 */
export function answerRows(s: PortalStep, ownershipType: OwnershipType | undefined, inDocs: Set<string>): AnswerRow[] {
  const responses = extractItemResponses(s.item, s.slice);
  const base = withoutUnusedDirectorSlots(
    s.item.id,
    filterFieldsByViewer(fieldsForOwnership(s.item.id, getClientResponseFields(s.item), ownershipType), 'client', s.item.id),
    responses,
  );
  const fields = resolveFieldLabels(applyShowWhen(expandRepeatFields(base, responses), responses), responses);
  const rows: AnswerRow[] = [];
  for (const f of fields as ChecklistField[]) {
    if (isRepeatField(f)) continue;
    const raw = String(responses[f.id] ?? '').trim();
    const label = repeatFieldLabel(base, responses, f.id) ?? f.label;
    if (f.type === 'file') {
      if (inDocs.has(f.id)) continue;
      const m = !raw ? /^(.*\S)\s+\d+$/.exec(label) : null;
      if (m) {
        const prev = rows.at(-1);
        if (prev && prev.value === '—' && (prev.label === `${m[1]}s` || prev.label === m[1])) {
          prev.label = `${m[1]}s`;
          continue;
        }
      }
      rows.push({ label: m ? m[1]! : label, value: raw ? fileNameFromStoragePath(raw) : '—', file: raw && isMilestoneStoragePath(raw) ? raw : undefined });
      continue;
    }
    let v = raw;
    if (raw && (f.type === 'select' || f.type === 'segmented')) v = f.options?.find((o) => o.value === raw)?.label ?? raw;
    if (raw && f.type === 'date' && /^\d{4}-\d{2}-\d{2}/.test(raw)) v = fmtL(raw.slice(0, 10));
    rows.push({ label, value: v || '—' });
  }
  if (!rows.some((r) => !/^remarks/i.test(r.label)) && s.owner !== 'client' && s.item.infoRequired.length) {
    const done = s.kind === 'done';
    for (const q of s.item.infoRequired) {
      rows.splice(rows.length - (rows.length && /^remarks/i.test(rows.at(-1)!.label) ? 1 : 0), 0, {
        label: q.split(' — ')[0]!.replace(/\s*\((?:if any|attachment)\)\s*$/i, ''),
        value: done ? `Provided${s.doneOn ? ` · ${fmt(s.doneOn)}` : ''}` : '—',
      });
    }
  }
  return rows.filter((r) => !(/^remarks/i.test(r.label) && r.value === '—'));
}

/** Signed URL for a milestone document path (`/api/milestone-documents/signed-url`). */
export async function signedUrlFor(path: string): Promise<string> {
  const res = await fetch(`/api/milestone-documents/signed-url?path=${encodeURIComponent(path)}`);
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !body.url) throw new Error(body.error ?? 'Could not open the file');
  return body.url;
}

/** Open a file in a new tab. The tab opens synchronously (no pop-up block), then loads the signed URL. */
export function openInTab(url: string | (() => Promise<string>), onError?: (msg: string) => void) {
  if (typeof url === 'string') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  const w = window.open('', '_blank');
  url()
    .then((u) => {
      if (w) w.location.href = u;
      else window.open(u, '_blank', 'noopener');
    })
    .catch((e: unknown) => {
      w?.close();
      onError?.(e instanceof Error ? e.message : 'Could not open the file');
    });
}

export function firstName(n?: string | null): string {
  return (n ?? '').trim().split(/\s+/)[0] ?? '';
}
