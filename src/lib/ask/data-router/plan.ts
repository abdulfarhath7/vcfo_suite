import { randomUUID } from 'node:crypto';
import { getItem } from '@/data/checklist';
import { checkResponseRow, displayValue, fieldOf, needsManagerApproval, responseKey, stepGateKind, type ResponseTarget, type RowEngagement } from '@/lib/actions/checklist/rules';
import { checkSubjectFieldRow, subjectFieldSide, type SubjectFieldTarget } from '@/lib/actions/registrations/field-rules';
import type { ChangesetDraft, ChangesetRowDraft, RowCheck, RowSource } from '@/lib/ask/changeset/types';
import { catalogEntry, writableUses } from '@/lib/ask/field-catalog';
import { COPY_FIELD_BY_DOC } from '@/lib/ask/field-catalog/upload-fields';
import { normalizeLabel } from '@/lib/ask/field-catalog/rules';
import type { CatalogEntry, FieldUse } from '@/lib/ask/field-catalog/types';
import { maskIdentityValue } from '@/lib/ask/mask';
import { isRepeatField, repeatEntries, type RepeatEntry } from '@/lib/checklist/checklist-repeat';
import { getClientResponseFields } from '@/lib/checklist/checklist-responses';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { checkFormat } from './formats';
import type { ReadValue } from './types';

/**
 * Step 4: turns placed values into the rows of a review card. This is plain code over one
 * engagement's saved state. It reads the screen's own rules through `checkResponseRow`, writes
 * nothing, and sends anything it cannot settle back as a question.
 */
export interface PlacedValue {
  value: ReadValue;
  entry: CatalogEntry;
  source: RowSource;
}

export interface AttachedFile {
  attachmentId: string;
  fileName: string;
  docType: string;
  person: string | null;
}

export interface PlanInput {
  role: string;
  engagementId: string;
  companyName: string;
  engagement: RowEngagement;
  state: Record<string, ChecklistItemStateSlice | undefined>;
  placed: PlacedValue[];
  files?: AttachedFile[];
  /** What the person asked, for "director 2". */
  instruction: string;
  /**
   * The GST step's fields as saved (`reg-4`, both sides). With them a value REG-01 needs that no
   * checklist step holds gets a row on the GST step, and a value whose checklist step is finished
   * goes to the GST copy instead of waiting for the step to be reopened. Absent leaves them out.
   */
  registration?: { key: string; client: Record<string, string | null>; sbc: Record<string, string | null> };
  /** The run is about GST registration: a value whose checklist step is not open yet also goes to the GST copy. */
  gst?: boolean;
}

export interface PlanResult {
  draft: ChangesetDraft;
  questions: string[];
}

/** The lists a person's facts live on, and the field that names them. */
const PERSON_LISTS = {
  director: { noun: 'Director', step: 'pre-15', group: 'directors', pan: 'panNumber' },
  subscriber: { noun: 'Subscriber', step: 'pre-16', group: 'subscribers', pan: null },
} as const;
type PersonSubject = keyof typeof PERSON_LISTS;

const listOf = (subject: PersonSubject, state: PlanInput['state']): RepeatEntry[] => {
  const { step, group } = PERSON_LISTS[subject];
  const item = getItem(step);
  const field = item ? getClientResponseFields(item).find((f) => f.id === group) : undefined;
  return field && isRepeatField(field) ? repeatEntries(state[step]?.responses ?? {}, field) : [];
};

const nameOfEntry = (entry: RepeatEntry) =>
  normalizeLabel(entry.values.name || [entry.values.firstName, entry.values.middleName, entry.values.lastName].filter(Boolean).join(' '));

/** Two spellings are one person when first and last names agree: "Asha Rao", "Asha K Rao". */
function samePerson(a: string, b: string): boolean {
  const [x, y] = [a.split(' ').filter(Boolean), b.split(' ').filter(Boolean)];
  return x.length > 0 && y.length > 0 && x[0] === y[0] && x.at(-1) === y.at(-1);
}

const HEADING_NUMBER = /\b(?:director|subscriber|shareholder|promoter)\s*(?:no\.?\s*)?(\d+)\b/i;

interface PersonTarget {
  entryId: string;
  newEntry: boolean;
  position: number;
}

/** Finds one person's entry on a list: by PAN, by name, then by "director 2"; else a new entry. */
function personTargeter(subject: PersonSubject, input: PlanInput) {
  const entries = listOf(subject, input.state);
  const groups = new Map<string, PersonTarget>();
  let added = 0;
  const askedNumber = Number(HEADING_NUMBER.exec(input.instruction)?.[1] ?? 0);
  const fresh = (): PersonTarget => {
    added += 1;
    return { entryId: `ask${randomUUID().slice(0, 8)}`, newEntry: true, position: entries.length + added };
  };
  return (person: string | null, values: readonly PlacedValue[]): PersonTarget | null => {
    const name = person && !HEADING_NUMBER.test(person) ? normalizeLabel(person) : '';
    const numbered = Number(person ? HEADING_NUMBER.exec(person)?.[1] ?? 0 : 0) || askedNumber;
    const groupKey = name || (person ? normalizeLabel(person) : '') || '-';
    const known = [...groups.entries()].find(([key]) => key === groupKey || (name && samePerson(key, name)))?.[1];
    if (known) return known;
    const panField = PERSON_LISTS[subject].pan;
    const pan = panField ? values.find((v) => v.entry.format === 'pan')?.value.value.toUpperCase() : undefined;
    const byPan = pan ? entries.find((e) => e.values[panField!]?.toUpperCase() === pan) : undefined;
    const byName = name ? entries.find((e) => samePerson(nameOfEntry(e), name)) : undefined;
    const byNumber = numbered ? entries[numbered - 1] : undefined;
    const match = byPan ?? byName ?? byNumber;
    let target: PersonTarget | null;
    if (match) target = { entryId: match.id, newEntry: false, position: match.index };
    else if (name || numbered || entries.length === 0) target = fresh();
    else target = null; // A value with no name, on a list that already has people: ask.
    if (target) groups.set(groupKey, target);
    return target;
  };
}

/** A whole name fills first, middle and last name. */
function expandValue(placed: PlacedValue): PlacedValue[] {
  if (!placed.entry.expands?.length) return [placed];
  const parts = placed.value.value.trim().split(/\s+/);
  const [first, last] = [parts[0] ?? '', parts.length > 1 ? parts.at(-1)! : ''];
  const middle = parts.slice(1, -1).join(' ');
  const piece = (suffix: string, value: string) => {
    const entry = placed.entry.expands!.map(catalogEntry).find((e) => e?.key.endsWith(suffix));
    return entry && value ? [{ ...placed, entry, value: { ...placed.value, value } }] : [];
  };
  return [...piece('first_name', first), ...piece('middle_name', middle), ...piece('last_name', last)];
}

const displayLabel = (subject: PersonSubject | null, target: PersonTarget | null, person: string | null, field: string) =>
  subject && target
    ? `${PERSON_LISTS[subject].noun} ${target.position}${target.newEntry && person ? ` (new: ${person})` : target.newEntry ? ' (new)' : ''} · ${field}`
    : field;

function maskedAnswer(entry: CatalogEntry, value: string): string {
  return entry.sensitivity === 'identity' ? maskIdentityValue(value) : value;
}

export function planRows(input: PlanInput): PlanResult {
  const questions: string[] = [];
  const rows: ChangesetRowDraft[] = [];
  const seen = new Map<string, ChangesetRowDraft>();

  const makeRow = (target: ResponseTarget, value: string, label: string, source: RowSource | null, extra: { action?: string; isFile?: boolean } = {}): ChangesetRowDraft | null => {
    const fullTarget: ResponseTarget = { ...target, ...(needsManagerApproval(target.stepId) ? { needsManager: true } : {}) };
    const checked = checkResponseRow({ role: input.role, target: fullTarget, value, state: input.state, engagement: input.engagement, isFile: extra.isFile });
    // The same value is already there, so there is nothing to review.
    if (checked.oldValue && checked.oldValue === checked.value) return null;
    const field = fieldOf(fullTarget);
    return {
      action: extra.action ?? 'checklist.setResponse',
      target: { ...fullTarget },
      label,
      oldValue: checked.oldValue,
      newValue: extra.isFile ? value : checked.value,
      displayOld: displayValue(checked.oldValue, checked.sensitive, field?.options),
      displayNew: displayValue(checked.value, checked.sensitive, field?.options),
      sensitive: checked.sensitive,
      source,
      checks: checked.checks,
      ...(checked.heldReason ? { heldReason: checked.heldReason } : {}),
    };
  };

  /** A row on a registration step's field (`registrations.setField`); `position` fills a director slot. */
  const registrationRow = (
    entry: CatalogEntry,
    use: FieldUse,
    value: string,
    label: string,
    source: RowSource | null,
    extra: { position?: number; home?: { step: string; field: string } } = {},
  ): { key: string; row: ChangesetRowDraft | null } | null => {
    const reg = input.registration;
    if (!reg || use.ref !== reg.key) return null;
    if (use.field.includes('#') && !extra.position) return null;
    const fieldKey = use.field.replace('#', String(extra.position ?? ''));
    const side = subjectFieldSide(use.ref, fieldKey);
    if (!side) return null;
    const target: SubjectFieldTarget = {
      engagementId: input.engagementId,
      kind: 'registration',
      key: use.ref,
      side,
      fieldKey,
      catalogKey: entry.key,
      ...(extra.home ? { homeStep: extra.home.step, homeField: extra.home.field } : {}),
    };
    const oldValue = (reg[side][fieldKey] ?? '').trim();
    const homeValue = extra.home ? input.state[extra.home.step]?.responses?.[extra.home.field] : undefined;
    const checked = checkSubjectFieldRow({ role: input.role, target, value, oldValue, homeValue });
    const key = `${use.ref}#${side}/${fieldKey}`;
    if (checked.oldValue && checked.oldValue === checked.value) return { key, row: null };
    return {
      key,
      row: {
        action: 'registrations.setField',
        target: Object.fromEntries(Object.entries(target).filter(([, v]) => v !== undefined)) as ChangesetRowDraft['target'],
        label,
        oldValue: checked.oldValue,
        newValue: checked.value,
        displayOld: checked.oldValue,
        displayNew: checked.value,
        sensitive: false,
        source,
        checks: checked.checks,
        ...(checked.heldReason ? { heldReason: checked.heldReason } : {}),
      },
    };
  };

  /**
   * A checklist row held only by its step's gate goes to the registration's copy of the field: always
   * when the step is finished (it is never reopened for a registration), and on a GST run also when
   * the step is not open yet. A field another role fills stays held.
   */
  const copyInstead = (row: ChangesetRowDraft, stepId: string): boolean =>
    Boolean(input.registration) &&
    row.checks.some((check) => check.rule === 'gate' && !check.ok) &&
    !row.checks.some((check) => check.rule === 'owner' && !check.ok) &&
    (input.gst === true || stepGateKind(input.state, input.role, stepId) === 'done');

  const registrationUse = (entry: CatalogEntry): FieldUse | undefined =>
    input.registration ? writableUses(entry).find((use) => use.source === 'registration' && use.ref === input.registration!.key) : undefined;

  /** The first place this person may fill now; else the first place, held with the reason. */
  const companyUse = (entry: CatalogEntry): FieldUse | null => {
    const uses = writableUses(entry).filter((use) => use.source === 'checklist');
    const open = uses.find((use) => {
      const { checks } = checkResponseRow({
        role: input.role,
        target: { engagementId: input.engagementId, stepId: use.ref, fieldId: use.field },
        value: '',
        state: input.state,
        engagement: input.engagement,
        isFile: true,
      });
      return !checks.some((check) => !check.ok && (check.rule === 'gate' || check.rule === 'owner'));
    });
    return open ?? uses[0] ?? null;
  };

  const placed = input.placed.flatMap(expandValue);
  const personTargets = new Map<string, PersonTarget | null>();
  const targeters = { director: personTargeter('director', input), subscriber: personTargeter('subscriber', input) };
  const targetFor = (subject: PersonSubject, person: string | null) => {
    const key = `${subject}:${person ?? ''}`;
    if (!personTargets.has(key)) {
      const theirs = placed.filter((p) => p.entry.subject === subject && p.value.person === person);
      personTargets.set(key, targeters[subject](person, theirs));
    }
    return personTargets.get(key)!;
  };

  for (const item of placed) {
    const { entry, value, source } = item;
    const subject = entry.subject === 'director' || entry.subject === 'subscriber' ? entry.subject : null;
    const person = subject && targetFor(subject, value.person);
    if (subject && !person) {
      questions.push(`Which ${PERSON_LISTS[subject].noun.toLowerCase()} is the ${entry.label} ${maskedAnswer(entry, value.value)} for? Tell me a name or a number.`);
      continue;
    }
    const use = subject ? writableUses(entry).find((u) => u.repeat === PERSON_LISTS[subject].group) : companyUse(entry);
    const regUse = registrationUse(entry);
    const keepRegistrationRow = (made: { key: string; row: ChangesetRowDraft | null } | null): boolean => {
      if (!made) return false;
      const earlier = seen.get(made.key);
      if (earlier) {
        const normal = checkFormat(entry, value.value).value;
        if (earlier.newValue !== normal) earlier.checks.push({ rule: 'documents_differ', ok: false, message: `Another source says ${maskedAnswer(entry, normal)}.` });
        return true;
      }
      if (made.row) {
        seen.set(made.key, made.row);
        rows.push(made.row);
      }
      return true;
    };
    if (!use) {
      // A value only the GST step holds (district, premises, SAC codes …).
      if (regUse && !subject && keepRegistrationRow(registrationRow(entry, regUse, value.value, `GST registration · ${entry.label}`, source))) continue;
      questions.push(`I have no place to save "${value.label}".`);
      continue;
    }
    const target: ResponseTarget = {
      engagementId: input.engagementId,
      stepId: use.ref,
      fieldId: use.field,
      ...(use.repeat && person ? { group: use.repeat, entryId: person.entryId, ...(person.newEntry ? { newEntry: true } : {}) } : {}),
    };
    const key = `${use.ref}/${responseKey(target)}`;
    const earlier = seen.get(key);
    if (earlier) {
      // Two documents on one fact: keep the first and show the difference. Code never picks.
      const normal = checkFormat(entry, value.value).value;
      if (earlier.newValue !== normal) {
        const check: RowCheck = { rule: 'documents_differ', ok: false, message: `Another source says ${maskedAnswer(entry, normal)}.` };
        earlier.checks.push(check);
      }
      continue;
    }
    const row = makeRow(target, value.value, displayLabel(subject, person, value.person, entry.label), source);
    if (!row) continue;
    // The checklist step is finished (or, on a GST run, not open yet): the GST copy takes the value.
    if (regUse && copyInstead(row, use.ref) && (!person || !person.newEntry)) {
      const copy = registrationRow(entry, regUse, value.value, `${displayLabel(subject, person, value.person, entry.label)} (GST copy)`, source, {
        position: person?.position,
        home: { step: use.ref, field: responseKey(target) },
      });
      if (keepRegistrationRow(copy)) continue;
    }
    seen.set(key, row);
    rows.push(row);
  }

  // A row whose field depends on an empty answer gets a row asking for it, placed before it.
  for (const row of [...rows]) {
    const target = row.target as unknown as ResponseTarget;
    const field = fieldOf(target);
    if (!field?.showWhen || !row.checks.some((check) => check.rule === 'condition' && !check.ok)) continue;
    if (input.state[target.stepId]?.responses?.[field.showWhen.field]?.trim()) continue;
    const parentId = field.showWhen.field.split('.').pop()!;
    const parentTarget: ResponseTarget = { ...target, fieldId: parentId };
    const key = `${target.stepId}/${responseKey(parentTarget)}`;
    if (seen.has(key)) continue;
    const parent = fieldOf(parentTarget);
    if (!parent) continue;
    const person = row.label.includes(' · ') ? row.label.split(' · ')[0]! : null;
    const question = makeRow(parentTarget, '', person ? `${person} · ${parent.label}` : parent.label, null);
    if (!question) continue;
    seen.set(key, question);
    rows.splice(rows.indexOf(row), 0, question);
  }

  // The copy of an identity document goes on the same person's entry, as its own row.
  for (const file of input.files ?? []) {
    const fieldId = COPY_FIELD_BY_DOC[file.docType];
    const person = fieldId ? targetFor('director', file.person) : null;
    if (!fieldId || !person) continue;
    const target: ResponseTarget = {
      engagementId: input.engagementId,
      stepId: PERSON_LISTS.director.step,
      fieldId,
      group: PERSON_LISTS.director.group,
      entryId: person.entryId,
      ...(person.newEntry ? { newEntry: true } : {}),
      attachmentId: file.attachmentId,
    };
    const field = fieldOf(target);
    const row = makeRow(target, file.fileName, displayLabel('director', person, file.person, field?.label ?? 'Copy'), { kind: 'attachment', attachmentId: file.attachmentId }, { action: 'checklist.attachFile', isFile: true });
    if (row) rows.push({ ...row, displayNew: file.fileName, displayOld: row.oldValue ? 'A file is already attached' : '', sensitive: false });
  }

  return {
    draft: { title: `Details for ${input.companyName}`, tier: 'T2', engagementId: input.engagementId, rows },
    questions,
  };
}
