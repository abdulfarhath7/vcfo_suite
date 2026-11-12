import { getActiveCatalogItems, type ChecklistField } from '@/data/checklist';
import { CLIENT_RESPONSE_FIELDS } from '@/lib/checklist/checklist-responses';
import { orderByMcaSection } from '@/lib/checklist/part-b-sections';
import {
  expandRepeatFields,
  isRepeatField,
  repeatEntries,
  repeatFieldLabel,
  type RepeatField,
} from '@/lib/checklist/checklist-repeat';
import type { ExportTable, TableCell } from '@/lib/exports/table-xlsx';

/** PR-02: the project records' spreadsheets (pure, so they can be tested). The "Download documents"
 * pop-up offers them under "Project records". */

export type Responses = Record<string, string>;

function displayValue(field: ChecklistField, raw: string | undefined): string {
  const value = (raw ?? '').trim();
  if (!value) return '';
  if (field.type === 'file') return value.split('/').pop() ?? value;
  const option = field.options?.find((o) => o.value === value);
  return option?.label ?? value;
}

/**
 * Every step's answers: one sheet, one row per question (a repeat entry's questions numbered).
 * SB-01: the SPICe+ Part B steps follow the MCA form order, so a Lead can copy them into the MCA
 * portal one section after another.
 */
export function answersTable(state: Record<string, { responses?: Responses } | undefined>): ExportTable {
  const rows: TableCell[][] = [];
  for (const item of orderByMcaSection(getActiveCatalogItems(), (i) => i.id)) {
    const responses = state[item.id]?.responses ?? {};
    const fields = CLIENT_RESPONSE_FIELDS[item.id] ?? [];
    if (!fields.length) continue;
    for (const field of expandRepeatFields(fields, responses)) {
      if (isRepeatField(field)) continue;
      const answer = displayValue(field, responses[field.id]);
      if (!answer) continue;
      rows.push([item.title, field.section ?? '', repeatFieldLabel(fields, responses, field.id) ?? field.label, answer]);
    }
  }
  return { sheet: 'Answers', columns: ['Step', 'Section', 'Question', 'Answer'], rows };
}

/** One row per entry of a repeat group, one column per question. */
export function entriesTable(sheet: string, group: RepeatField | undefined, responses: Responses): ExportTable {
  if (!group) return { sheet, columns: ['No entries'], rows: [] };
  const fields = group.entryFields;
  return {
    sheet,
    columns: ['#', ...fields.map((f) => f.label)],
    rows: repeatEntries(responses, group).map((entry) => [entry.index, ...fields.map((f) => displayValue(f, entry.values[f.id]))]),
  };
}

export function groupOf(itemId: string, groupId: string): RepeatField | undefined {
  return (CLIENT_RESPONSE_FIELDS[itemId] ?? []).find((f): f is RepeatField => f.id === groupId && isRepeatField(f));
}

