import crypto from 'crypto';

import fs from 'fs';

import path from 'path';

import Docxtemplater from 'docxtemplater';

import PizZip from 'pizzip';

import {
  dedupeXmlAttributes,
  patchDocumentBodyParagraphs,
} from '@/lib/board-resolution-docx-body';

import {

  BOARD_RESOLUTION_MERGE_FIELD_KEYS,

  buildBoardResolutionMergeFields,

  generateBoardResolutionDraft,

  type BoardResolutionMergeFields,

  type BoardResolutionMergeInput,

} from '@/lib/board-resolution';



const BOARD_RESOLUTION_MERGE_FIELD_SET = new Set<string>(BOARD_RESOLUTION_MERGE_FIELD_KEYS);



/** Unknown `{tags}` in the template (e.g. header instructions) render as plain text, not "undefined". */

function boardResolutionNullGetter(part: { value?: string }): string {

  const tag = part.value?.trim() ?? '';

  if (!tag) return '';

  if (BOARD_RESOLUTION_MERGE_FIELD_SET.has(tag)) return '';

  return tag;

}



/**

 * Uses `public/templates/boardResolution.docx` — your Word file with layout/fonts preserved.

 * Placeholders must be contiguous in Word, e.g. `{PARENT_ENTITY_NAME}`.

 * Regenerate tagged template from repo root `boardResolution.docx`:

 *   node scripts/prepare-board-resolution-docx.mjs

 */

const BOARD_RESOLUTION_TEMPLATE_RELATIVE = 'public/templates/boardResolution.docx';

const LEGACY_TEMPLATE_RELATIVE = 'public/templates/board-resolution-template.docx';



function boardResolutionTemplatePath(): string {

  return path.join(process.cwd(), BOARD_RESOLUTION_TEMPLATE_RELATIVE);

}



export type BoardResolutionTemplateInfo = {
  path: string;
  fingerprint: string;
  modifiedAtMs: number;
  /** Repo-root source used by prepare-board-resolution-docx.mjs, when present. */
  rootSourcePath: string | null;
  rootSourceModifiedAtMs: number | null;
};

/** Server-only metadata for the on-disk Word template. */
export function getBoardResolutionTemplateInfo(): BoardResolutionTemplateInfo {
  const templatePath = boardResolutionTemplatePath();

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Board resolution template missing at ${templatePath}.`);
  }

  const stat = fs.statSync(templatePath);
  const fingerprint = crypto
    .createHash('sha256')
    .update(fs.readFileSync(templatePath))
    .digest('hex');

  const rootSourcePath = path.join(process.cwd(), 'boardResolution.docx');
  const rootSourceModifiedAtMs = fs.existsSync(rootSourcePath)
    ? fs.statSync(rootSourcePath).mtimeMs
    : null;

  return {
    path: templatePath,
    fingerprint,
    modifiedAtMs: stat.mtimeMs,
    rootSourcePath: rootSourceModifiedAtMs != null ? rootSourcePath : null,
    rootSourceModifiedAtMs,
  };
}

/** Server-only fingerprint of the on-disk Word template (sha256 hex). */
export function getBoardResolutionTemplateFingerprint(): string {
  return getBoardResolutionTemplateInfo().fingerprint;
}



/** Keys must match tags inside boardResolution.docx exactly (UPPER_SNAKE). */

function boardResolutionFieldsToDocxData(

  fields: BoardResolutionMergeFields,

): Record<string, string> {

  const data: Record<string, string> = {

    PARENT_ENTITY_NAME: fields.PARENT_ENTITY_NAME ?? '',

    PARENT_ENTITY_ADDRESS: fields.PARENT_ENTITY_ADDRESS ?? '',

    RESOLUTION_EFFECTIVE_DATE: fields.RESOLUTION_EFFECTIVE_DATE ?? '',

    PARENT_JURISDICTION: fields.PARENT_JURISDICTION ?? '',

    PARENT_STATE: fields.PARENT_STATE ?? '',

    PROPOSED_NAME_1: fields.PROPOSED_NAME_1 ?? '',

    NIC_CODES: fields.NIC_CODES ?? '',

    AUTHORISED_CAPITAL: fields.AUTHORISED_CAPITAL ?? '',

    PAID_UP_CAPITAL: fields.PAID_UP_CAPITAL ?? '',

    INDIAN_DIRECTOR_LINE: fields.INDIAN_DIRECTOR_LINE ?? '',

    SECOND_DIRECTOR_LINE: fields.SECOND_DIRECTOR_LINE ?? '',

    SIGNATORY_NAME: fields.SIGNATORY_NAME ?? '',

    SIGNATORY_DESIGNATION: fields.SIGNATORY_DESIGNATION ?? '',

    CERTIFICATION_DATE: fields.CERTIFICATION_DATE ?? '',

    CERTIFICATION_PLACE: fields.CERTIFICATION_PLACE ?? '',

  };



  for (const key of BOARD_RESOLUTION_MERGE_FIELD_KEYS) {

    data[key] ??= '';

  }



  return data;

}



/** Remove duplicate XML attributes (e.g. repeated xml:space) from word/document.xml. */
function sanitizeBoardResolutionDocumentXml(documentXml: string): string {
  return dedupeXmlAttributes(documentXml);
}

/** Dedupe word/document.xml inside a .docx buffer (no-op when already clean). */
export function sanitizeBoardResolutionDocxBuffer(docx: Buffer): Buffer {
  const zip = new PizZip(docx);
  const documentXml = zip.file('word/document.xml')?.asText();
  if (!documentXml) return docx;

  const cleaned = sanitizeBoardResolutionDocumentXml(documentXml);
  if (cleaned === documentXml) return docx;

  zip.file('word/document.xml', cleaned);
  return zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  }) as Buffer;
}

export function renderBoardResolutionDocxBuffer(

  input: BoardResolutionMergeInput,

): Buffer {

  const templatePath = boardResolutionTemplatePath();

  if (!fs.existsSync(templatePath)) {

    const legacyPath = path.join(process.cwd(), LEGACY_TEMPLATE_RELATIVE);

    const legacyHint = fs.existsSync(legacyPath)

      ? ` Legacy template found at ${legacyPath}; generate the required ${templatePath} with: node scripts/prepare-board-resolution-docx.mjs`

      : '';

    throw new Error(

      `Board resolution template missing at ${templatePath}. Copy boardResolution.docx there or run: node scripts/prepare-board-resolution-docx.mjs.${legacyHint}`,

    );

  }



  const fields = buildBoardResolutionMergeFields(input);

  const content = fs.readFileSync(templatePath);

  const zip = new PizZip(content);

  const doc = new Docxtemplater(zip, {

    paragraphLoop: true,

    linebreaks: true,

    nullGetter: boardResolutionNullGetter,

  });



  doc.setData(boardResolutionFieldsToDocxData(fields));

  doc.render();



  const rendered = doc.getZip().generate({

    type: 'nodebuffer',

    compression: 'DEFLATE',

  }) as Buffer;

  return sanitizeBoardResolutionDocxBuffer(rendered);

}



/** Surgically patch paragraph text in an existing .docx (preserves layout from last generate). */

export function patchBoardResolutionDocxBuffer(existingDocx: Buffer, content: string): Buffer {

  const zip = new PizZip(existingDocx);

  const documentXml = zip.file('word/document.xml')?.asText();

  if (!documentXml) {

    throw new Error('Board resolution document is missing word/document.xml.');

  }



  const sanitizedInput = sanitizeBoardResolutionDocumentXml(documentXml);

  zip.file('word/document.xml', patchDocumentBodyParagraphs(sanitizedInput, content));

  const patched = zip.generate({

    type: 'nodebuffer',

    compression: 'DEFLATE',

  }) as Buffer;

  return sanitizeBoardResolutionDocxBuffer(patched);

}



/** Plain-text draft plus docx bytes for persistence. */

export function generateBoardResolutionArtifacts(

  input: BoardResolutionMergeInput,

  options?: { content?: string; existingDocx?: Buffer },

): {

  content: string;

  docx: Buffer;

} {

  const editedContent = options?.content?.trim();



  if (editedContent && options?.existingDocx) {

    return {

      content: editedContent,

      docx: patchBoardResolutionDocxBuffer(options.existingDocx, editedContent),

    };

  }



  const docx = renderBoardResolutionDocxBuffer(input);

  const content = editedContent ?? generateBoardResolutionDraft(input);

  return { content, docx };

}


