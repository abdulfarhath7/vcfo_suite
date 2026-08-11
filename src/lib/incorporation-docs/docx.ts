import 'server-only';

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

import { patchDocumentBodyParagraphs } from '@/lib/board-resolution-docx-body';
import {
  sanitizeIncorpDocxBuffer,
  sanitizeIncorpDocumentXml,
} from '@/lib/incorporation-docs/docx-sanitize';
import { assertIncorpDocxWordXmlValid } from '@/lib/incorporation-docs/docx-validate';
import {
  ACCEPTANCE_LETTER_MERGE_FIELD_KEYS,
  buildAcceptanceLetterMergeFields,
  type AcceptanceLetterMergeFields,
} from '@/lib/incorporation-docs/acceptance-letter';
import {
  AUTHORISATION_LETTER_MERGE_FIELD_KEYS,
  buildAuthorisationLetterMergeFields,
  type AuthorisationLetterMergeFields,
} from '@/lib/incorporation-docs/authorisation-letter';
import { buildAoaMergeFields, AOA_MERGE_FIELD_KEYS, type AoaMergeFields } from '@/lib/incorporation-docs/aoa';
import { buildDir2MergeFields, DIR2_MERGE_FIELD_KEYS, type Dir2MergeFields } from '@/lib/incorporation-docs/dir2';
import { buildDir8MergeFields, DIR8_MERGE_FIELD_KEYS, type Dir8MergeFields } from '@/lib/incorporation-docs/dir8';
import { buildInc9MergeFields, INC9_MERGE_FIELD_KEYS, type Inc9MergeFields } from '@/lib/incorporation-docs/inc9';
import {
  buildMoaMergeFields,
  MOA_MERGE_FIELD_KEYS,
  type MoaMergeFields,
  type MoaMergeInput,
} from '@/lib/incorporation-docs/moa';
import {
  buildPanUndertakingMergeFields,
  PAN_UNDERTAKING_MERGE_FIELD_KEYS,
  type PanUndertakingMergeFields,
} from '@/lib/incorporation-docs/pan-undertaking';
import type { IncorpMergeInput } from '@/lib/incorporation-docs/shared';
import {
  buildSubscriptionSheetMergeFields,
  subscriptionSheetVariantForDoc,
  SUBSCRIPTION_SHEET_MERGE_FIELD_KEYS,
  type SubscriptionSheetMergeFields,
} from '@/lib/incorporation-docs/subscription-sheet';
import { INCORP_DOC_DEFINITIONS, type IncorpDocKind } from '@/lib/incorporation-docs/types';

function nullGetterForKeys(keys: readonly string[]) {
  const set = new Set<string>(keys);
  return (part: { value?: string }) => {
    const tag = part.value?.trim() ?? '';
    if (!tag) return '';
    if (set.has(tag)) return '';
    return tag;
  };
}

function sanitizeMergeValueForDocx(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code <= 0x1f && code !== 0x09 && code !== 0x0a && code !== 0x0d) continue;
    if (code === 0xfffe || code === 0xffff) continue;
    out += ch;
  }
  return out;
}

function fieldsToDocxData<T extends object>(
  keys: readonly (keyof T & string)[],
  fields: T,
): Record<string, string> {
  const data: Record<string, string> = {};
  for (const key of keys) {
    data[key] = sanitizeMergeValueForDocx(String((fields as Record<string, string>)[key] ?? ''));
  }
  return data;
}

function renderDocx(templateRelative: string, keys: readonly string[], data: Record<string, string>): Buffer {
  const templatePath = path.join(process.cwd(), templateRelative);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template missing at ${templatePath}.`);
  }

  const zip = new PizZip(fs.readFileSync(templatePath));
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: nullGetterForKeys(keys),
  });

  doc.setData(data);
  doc.render();

  const rendered = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  }) as Buffer;

  const sanitized = sanitizeIncorpDocxBuffer(rendered);
  assertIncorpDocxWordXmlValid(sanitized);
  return sanitized;
}

export function incorpTemplatePath(doc: IncorpDocKind): string {
  return path.join(process.cwd(), INCORP_DOC_DEFINITIONS[doc].templateRelative);
}

export function getIncorpTemplateFingerprint(doc: IncorpDocKind): string {
  const templatePath = incorpTemplatePath(doc);
  if (!fs.existsSync(templatePath)) {
    throw new Error(
      `Template missing at ${templatePath}. Run the prepare script for ${INCORP_DOC_DEFINITIONS[doc].label}.`,
    );
  }
  return crypto.createHash('sha256').update(fs.readFileSync(templatePath)).digest('hex');
}

export function renderDir2DocxBuffer(input: IncorpMergeInput): Buffer {
  const fields = buildDir2MergeFields(input);
  return renderDocx(
    INCORP_DOC_DEFINITIONS['dir-2'].templateRelative,
    DIR2_MERGE_FIELD_KEYS,
    fieldsToDocxData(DIR2_MERGE_FIELD_KEYS, fields),
  );
}

export function renderDir8DocxBuffer(input: IncorpMergeInput): Buffer {
  const fields = buildDir8MergeFields(input);
  return renderDocx(
    INCORP_DOC_DEFINITIONS['dir-8'].templateRelative,
    DIR8_MERGE_FIELD_KEYS,
    fieldsToDocxData(DIR8_MERGE_FIELD_KEYS, fields),
  );
}

export function renderInc9DocxBuffer(input: IncorpMergeInput): Buffer {
  const fields = buildInc9MergeFields(input);
  return renderDocx(
    INCORP_DOC_DEFINITIONS['inc-9'].templateRelative,
    INC9_MERGE_FIELD_KEYS,
    fieldsToDocxData(INC9_MERGE_FIELD_KEYS, fields),
  );
}

export function renderPanUndertakingDocxBuffer(input: IncorpMergeInput): Buffer {
  const fields = buildPanUndertakingMergeFields(input);
  return renderDocx(
    INCORP_DOC_DEFINITIONS['pan-undertaking'].templateRelative,
    PAN_UNDERTAKING_MERGE_FIELD_KEYS,
    fieldsToDocxData(PAN_UNDERTAKING_MERGE_FIELD_KEYS, fields),
  );
}

export function renderMoaDocxBuffer(input: MoaMergeInput): Buffer {
  const fields = buildMoaMergeFields(input);
  return renderDocx(
    INCORP_DOC_DEFINITIONS.moa.templateRelative,
    MOA_MERGE_FIELD_KEYS,
    fieldsToDocxData(MOA_MERGE_FIELD_KEYS, fields),
  );
}

export function renderAoaDocxBuffer(input: IncorpMergeInput): Buffer {
  const fields = buildAoaMergeFields(input);
  return renderDocx(
    INCORP_DOC_DEFINITIONS.aoa.templateRelative,
    AOA_MERGE_FIELD_KEYS,
    fieldsToDocxData(AOA_MERGE_FIELD_KEYS, fields),
  );
}

export function renderAuthorisationLetterDocxBuffer(input: IncorpMergeInput): Buffer {
  const fields = buildAuthorisationLetterMergeFields(input);
  return renderDocx(
    INCORP_DOC_DEFINITIONS['authorisation-letter'].templateRelative,
    AUTHORISATION_LETTER_MERGE_FIELD_KEYS,
    fieldsToDocxData(AUTHORISATION_LETTER_MERGE_FIELD_KEYS, fields),
  );
}

export function renderAcceptanceLetterDocxBuffer(input: IncorpMergeInput): Buffer {
  const fields = buildAcceptanceLetterMergeFields(input);
  return renderDocx(
    INCORP_DOC_DEFINITIONS['acceptance-letter'].templateRelative,
    ACCEPTANCE_LETTER_MERGE_FIELD_KEYS,
    fieldsToDocxData(ACCEPTANCE_LETTER_MERGE_FIELD_KEYS, fields),
  );
}

export function renderSubscriptionSheetDocxBuffer(
  doc: 'moa-subscription-sheet' | 'aoa-subscription-sheet',
  input: IncorpMergeInput,
): Buffer {
  const variant = subscriptionSheetVariantForDoc(doc);
  const fields = buildSubscriptionSheetMergeFields({ ...input, variant });
  return renderDocx(
    INCORP_DOC_DEFINITIONS[doc].templateRelative,
    SUBSCRIPTION_SHEET_MERGE_FIELD_KEYS,
    fieldsToDocxData(SUBSCRIPTION_SHEET_MERGE_FIELD_KEYS, fields),
  );
}

/** Surgically patch paragraph text in an existing incorporation .docx (preserves layout). */
export function patchIncorpDocxBuffer(existingDocx: Buffer, content: string): Buffer {
  const sanitizedDocx = sanitizeIncorpDocxBuffer(existingDocx);
  const zip = new PizZip(sanitizedDocx);
  const documentXml = zip.file('word/document.xml')?.asText();
  if (!documentXml) {
    throw new Error('Incorporation document is missing word/document.xml.');
  }

  const sanitizedInput = sanitizeIncorpDocumentXml(documentXml);
  zip.file('word/document.xml', patchDocumentBodyParagraphs(sanitizedInput, content));

  const patched = zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  }) as Buffer;

  const sanitized = sanitizeIncorpDocxBuffer(patched);
  assertIncorpDocxWordXmlValid(sanitized);
  return sanitized;
}

export function renderIncorpDocxBuffer(doc: IncorpDocKind, input: IncorpMergeInput): Buffer {
  switch (doc) {
    case 'dir-2':
      return renderDir2DocxBuffer(input);
    case 'dir-8':
      return renderDir8DocxBuffer(input);
    case 'inc-9':
      return renderInc9DocxBuffer(input);
    case 'pan-undertaking':
      return renderPanUndertakingDocxBuffer(input);
    case 'moa':
      return renderMoaDocxBuffer(input);
    case 'aoa':
      return renderAoaDocxBuffer(input);
    case 'authorisation-letter':
      return renderAuthorisationLetterDocxBuffer(input);
    case 'acceptance-letter':
      return renderAcceptanceLetterDocxBuffer(input);
    case 'moa-subscription-sheet':
      return renderSubscriptionSheetDocxBuffer(doc, input);
    case 'aoa-subscription-sheet':
      return renderSubscriptionSheetDocxBuffer(doc, input);
    default:
      throw new Error(`Unknown incorporation document: ${doc satisfies never}`);
  }
}

export type {
  Dir2MergeFields,
  Dir8MergeFields,
  Inc9MergeFields,
  MoaMergeFields,
  AoaMergeFields,
  PanUndertakingMergeFields,
  AuthorisationLetterMergeFields,
  AcceptanceLetterMergeFields,
  SubscriptionSheetMergeFields,
};
