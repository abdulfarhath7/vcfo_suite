import 'server-only';

import type { LlmProvider } from '@/lib/ask/provider';
import { maskIdentityNumbers } from '@/lib/ask/mask';
import { candidatesFor } from './candidates';
import { chooseFields, type ChoiceInput } from './choose';
import { ReadRefused } from './read';
import type { AttachedFile, PlacedValue } from './plan';
import type { ReadResult } from './types';

/**
 * Finds the place for every value that was read: code first, then one small-model call for the rest.
 * A value that is not clearly readable, or that fits nowhere, comes back as a question.
 */
export interface SourceRead {
  result: ReadResult;
  /** The file it came from; null for a paste, and a stored paste counts as one. */
  attachment: { id: string; kind: string; fileName: string } | null;
}

const MIN_CONFIDENCE = 0.6;
const UNPLACED_MAX_CHARS = 300;

export async function placeValues(
  reads: readonly SourceRead[],
  deps: { instruction: string; provider: () => Promise<LlmProvider>; model: string },
): Promise<{ placed: PlacedValue[]; questions: string[]; unplaced: string[]; files: AttachedFile[]; chooseCalls: number }> {
  const { instruction } = deps;
  const subjectHint = /subscriber|shareholder/i.test(instruction) ? 'subscriber' : /director|promoter/i.test(instruction) ? 'director' : null;
  const asked = /\b(?:director|subscriber|shareholder|promoter)\s*(?:no\.?\s*)?\d+\b/i.exec(instruction)?.[0] ?? subjectHint;
  const questions: string[] = [];
  // Lines read as a label and a value that fit no field: the card lists them ("I could not place
  // this"), so nothing the person pasted or dropped disappears without a word.
  const unplaced: string[] = [];
  const unplace = (value: { label: string; value: string }) => {
    const text = maskIdentityNumbers(`${value.label}: ${value.value}`).slice(0, UNPLACED_MAX_CHARS);
    if (!unplaced.includes(text)) unplaced.push(text);
  };
  const placed: PlacedValue[] = [];
  const toChoose: Array<ChoiceInput & { source: PlacedValue['source'] }> = [];
  for (const { result, attachment } of reads) {
    const source: PlacedValue['source'] = attachment?.kind === 'file' ? { kind: 'attachment', attachmentId: attachment.id, fileName: attachment.fileName } : { kind: 'paste' };
    // A certificate of incorporation states the name of record. Anywhere else a company's name only
    // tells which client this is for, so it fills no field.
    const named = result.docType === 'incorporation_certificate' && result.company ? [{ label: 'Company name', value: result.company, page: null, person: null, confidence: 1 }] : [];
    for (const raw of [...result.values, ...named]) {
      const value = { ...raw, person: raw.person ?? asked };
      const here = { ...source, ...(value.page ? { page: value.page } : {}) };
      if (value.confidence < MIN_CONFIDENCE) {
        questions.push(`I could not read "${value.label}" clearly. Please type it in.`);
        continue;
      }
      const subject = /subscriber|shareholder/i.test(value.person ?? '') ? 'subscriber' : /director|promoter/i.test(value.person ?? '') ? 'director' : subjectHint;
      const { exact, candidates } = candidatesFor(value, subject);
      if ((exact ?? candidates[0])?.key === 'company.name' && named.length === 0) continue;
      if (exact) placed.push({ value, entry: exact, source: here });
      else if (candidates.length > 0) toChoose.push({ value, candidates, source: here });
      // Nothing fits: a short label is a field the catalog does not know; a long one may be a
      // sentence that held a colon, or a label with a name in it. Either way the card shows it.
      else unplace(value);
    }
  }
  if (toChoose.length > 0) {
    try {
      const chosen = await chooseFields(await deps.provider(), deps.model, toChoose);
      toChoose.forEach((item, index) => {
        const entry = chosen.get(index);
        if (entry?.key === 'company.name') return;
        if (entry) placed.push({ value: item.value, entry, source: item.source });
        else unplace(item.value);
      });
    } catch (error) {
      if (!(error instanceof ReadRefused)) console.error('[ask-vcfo] field choice failed', error);
      for (const item of toChoose) unplace(item.value);
    }
  }
  const files: AttachedFile[] = reads.flatMap(({ result, attachment }) =>
    attachment?.kind === 'file' ? [{ attachmentId: attachment.id, fileName: attachment.fileName, docType: result.docType, person: result.values.find((v) => v.person)?.person ?? asked }] : [],
  );
  return { placed, questions, unplaced, files, chooseCalls: toChoose.length };
}
