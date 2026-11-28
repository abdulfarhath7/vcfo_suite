import 'server-only';

import type { LlmProvider } from '@/lib/ask/provider';
import { catalogEntry, placedEntry } from '@/lib/ask/field-catalog';
import { maskIdentityNumbers } from '@/lib/ask/mask';
import { candidatesFor } from './candidates';
import { chooseFields, type ChoiceInput } from './choose';
import { ReadRefused } from './read';
import { docTypeWords } from './targeted';
import type { AttachedFile, PlacedValue } from './plan';
import type { ReadResult, ReadValue } from './types';
import type { CatalogEntry } from '@/lib/ask/field-catalog/types';

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
const QUOTE_MAX_CHARS = 300;

/**
 * Where a value came from, for the card: the file, the attachment inside it (an email's PDF), the
 * page, and the words it was read from. A quote is kept masked, because the card shows it as is.
 */
function sourceOf(base: PlacedValue['source'], value: { page: number | null; from?: string; quote?: string }): PlacedValue['source'] {
  const fileName = base.fileName && value.from ? `${base.fileName} › ${maskIdentityNumbers(value.from)}` : base.fileName;
  return {
    ...base,
    ...(fileName ? { fileName } : {}),
    ...(value.page ? { page: value.page } : {}),
    ...(value.quote ? { quote: maskIdentityNumbers(value.quote).slice(0, QUOTE_MAX_CHARS) } : {}),
  };
}

const SHEET_FILE = /\.(xlsx|xlsm|csv)$/i;

/**
 * Why a value may not fill this entry, or null when it may. A strict fact (`onlyFrom`) is taken
 * from a file only when the file is a document that states it; a workbook counts as the client's
 * details sheet (`form`). Pasted text is not limited, because the person typed the label. A value
 * must also look like the fact (`valueMatches`), so an address never becomes "Rented".
 */
export function placementRefusal(
  entry: CatalogEntry,
  value: string,
  from: { docType: string; fileName: string } | null,
  opts: { matchValue?: boolean } = {},
): string | null {
  if (opts.matchValue !== false && entry.valueMatches && !new RegExp(entry.valueMatches, 'i').test(value)) return `this does not say how the premises are held, so it is not "${entry.label}"`;
  if (!from || !entry.onlyFrom?.length) return null;
  const docType = SHEET_FILE.test(from.fileName) ? 'form' : from.docType;
  if (entry.onlyFrom.includes(docType)) return null;
  const allowed = [...new Set(entry.onlyFrom.map((t) => (t === 'form' || t === 'incorporation_data' ? "the client's details sheet" : `a ${docTypeWords(t)}`)))];
  const list = allowed.length > 1 ? `${allowed.slice(0, -1).join(', ')} or ${allowed.at(-1)}` : allowed[0];
  return `"${entry.label}" is taken only from ${list}, not from a ${docTypeWords(from.docType)}`;
}

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
  const unplace = (value: { label: string; value: string }, reason?: string) => {
    const text = maskIdentityNumbers(`${value.label}: ${value.value}${reason ? ` (${reason})` : ''}`).slice(0, UNPLACED_MAX_CHARS);
    if (!unplaced.includes(text)) unplaced.push(text);
  };
  const placed: PlacedValue[] = [];
  // Every place goes through the strict-fact rule; a refused value is listed with its reason.
  const place = (item: PlacedValue, from: { docType: string; fileName: string } | null) => {
    const reason = placementRefusal(item.entry, item.value.value, from);
    if (reason) unplace(item.value, reason);
    else placed.push(item);
  };
  const toChoose: Array<ChoiceInput & { source: PlacedValue['source']; from: { docType: string; fileName: string } | null }> = [];
  for (const { result, attachment } of reads) {
    const from = attachment?.kind === 'file' ? { docType: result.docType, fileName: attachment.fileName } : null;
    const source: PlacedValue['source'] = attachment?.kind === 'file' ? { kind: 'attachment', attachmentId: attachment.id, fileName: attachment.fileName } : { kind: 'paste' };
    // A certificate of incorporation states the name of record. Anywhere else a company's name only
    // tells which client this is for, so it fills no field.
    const named: ReadValue[] = result.docType === 'incorporation_certificate' && result.company ? [{ label: 'Company name', value: result.company, page: null, person: null, confidence: 1 }] : [];
    for (const raw of [...result.values, ...named]) {
      const value = { ...raw, person: raw.person ?? asked };
      const here = sourceOf(source, value);
      if (value.confidence < MIN_CONFIDENCE) {
        questions.push(`I could not read "${value.label}" clearly. Please type it in.`);
        continue;
      }
      // A targeted read asked for this very fact, so it needs no name to match.
      const targeted = value.targetKey ? catalogEntry(value.targetKey) : undefined;
      if (targeted) {
        place({ value, entry: placedEntry(targeted), source: here }, from);
        continue;
      }
      const subject = /subscriber|shareholder/i.test(value.person ?? '') ? 'subscriber' : /director|promoter/i.test(value.person ?? '') ? 'director' : subjectHint;
      const { exact, candidates } = candidatesFor(value, subject);
      if ((exact ?? candidates[0])?.key === 'company.name' && named.length === 0) continue;
      if (exact) place({ value, entry: placedEntry(exact), source: here }, from);
      else if (candidates.length > 0) {
        // A value that could be a strict fact this file does not state (an NOC's "Date" could be the
        // date of incorporation) is not sent on to the next date field either: it is listed with the
        // reason. Otherwise the small model chooses only among the fields this file may fill.
        const strict = candidates.map((c) => placementRefusal(placedEntry(c), value.value, from, { matchValue: false })).find(Boolean);
        const allowed = candidates.filter((c) => !placementRefusal(placedEntry(c), value.value, from));
        if (strict) unplace(value, strict);
        else if (allowed.length > 0) toChoose.push({ value, candidates: allowed, source: here, from });
        else unplace(value, placementRefusal(placedEntry(candidates[0]!), value.value, from)!);
      }
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
        if (entry) place({ value: item.value, entry: placedEntry(entry), source: item.source }, item.from);
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
  // A fact read for its own field comes before one that only fills it (the main objects fill the
  // business description), so the card keeps the description and offers the main objects beside it.
  const filler = (item: PlacedValue) => (item.value.targetKey && catalogEntry(item.value.targetKey)?.fills ? 1 : 0);
  const ordered = placed.map((item, index) => ({ item, index })).sort((a, b) => filler(a.item) - filler(b.item) || a.index - b.index).map(({ item }) => item);
  return { placed: ordered, questions, unplaced, files, chooseCalls: toChoose.length };
}
