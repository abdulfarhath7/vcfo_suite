/** Match `<w:r>` runs only ΓÇö not `<w:rPr>`, `<w:rFonts>`, etc. */
const WORD_TEXT_RUN_PATTERN = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/;

function eachWordTextRun(paraXml: string): Iterable<RegExpMatchArray> {
  return paraXml.matchAll(new RegExp(WORD_TEXT_RUN_PATTERN.source, 'g'));
}

/** Split stored board resolution plain text into paragraph lines for docx body patching. */

export function splitBoardResolutionContent(content: string): string[] {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!normalized.trim()) return [''];
  return normalized.split('\n');
}

export type BoardResolutionParagraphAlignment = 'left' | 'center' | 'right' | 'justify';

export type BoardResolutionParagraphPatch = {
  /** Plain text without markup ΓÇö used for display and fallback patching. */
  text: string;
  /** Inline `<strong>` markers when only bold changed (plain-text transport). */
  line?: string;
  /** Set when preview applied explicit paragraph alignment via the toolbar. */
  align?: BoardResolutionParagraphAlignment;
};

const STRUCTURED_CONTENT_PREFIX = '{"br":';

function stripInlineBoldMarkup(line: string): string {
  return line.replace(/<\/?(?:strong|b)(?:\s[^>]*)?>/gi, '');
}

/** Parse stored draft content into paragraph patches (plain, HTML-bold, or structured JSON). */
export function parseBoardResolutionPatchContent(content: string): BoardResolutionParagraphPatch[] {
  const trimmed = content.trimStart();
  if (trimmed.startsWith(STRUCTURED_CONTENT_PREFIX)) {
    try {
      const parsed = JSON.parse(content) as {
        br?: number;
        paragraphs?: BoardResolutionParagraphPatch[];
      };
      if (parsed.br === 1 && Array.isArray(parsed.paragraphs)) {
        return parsed.paragraphs.map((paragraph) => ({
          text: paragraph.text ?? stripInlineBoldMarkup(paragraph.line ?? ''),
          line: paragraph.line,
          align: paragraph.align,
        }));
      }
    } catch {
      // Fall through to plain-text parsing.
    }
  }

  return splitBoardResolutionContent(content).map((line) => ({
    text: stripInlineBoldMarkup(line),
    line,
  }));
}

/** Serialize paragraph patches for storage and docx patching. */
export function serializeBoardResolutionPatchContent(
  paragraphs: BoardResolutionParagraphPatch[],
): string {
  const hasExplicitAlignment = paragraphs.some((paragraph) => paragraph.align !== undefined);
  const hasInlineBold = paragraphs.some(
    (paragraph) => paragraph.line && /<(strong|b)[\s>]/i.test(paragraph.line),
  );

  if (hasExplicitAlignment) {
    return JSON.stringify({ br: 1, paragraphs });
  }

  if (hasInlineBold) {
    return paragraphs.map((paragraph) => paragraph.line ?? paragraph.text).join('\n');
  }

  return paragraphs.map((paragraph) => paragraph.text).join('\n');
}

export type FormattedTextSegment = {
  text: string;
  bold: boolean;
};

const FORMATTED_LINE_TAG = /<\/?(?:strong|b)(?:\s[^>]*)?>/gi;

/** Parse inline `<strong>` / `<b>` markers into text runs for Word patching. */
export function parseFormattedLine(line: string): FormattedTextSegment[] {
  if (!FORMATTED_LINE_TAG.test(line)) {
    return [{ text: line, bold: false }];
  }

  FORMATTED_LINE_TAG.lastIndex = 0;

  const segments: FormattedTextSegment[] = [];
  let lastIndex = 0;
  let bold = false;
  let match: RegExpExecArray | null;

  while ((match = FORMATTED_LINE_TAG.exec(line)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: line.slice(lastIndex, match.index), bold });
    }

    const tag = match[0].toLowerCase();
    bold = !tag.startsWith('</');
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    segments.push({ text: line.slice(lastIndex), bold });
  }

  return mergeFormattedSegments(segments);
}

function mergeFormattedSegments(segments: FormattedTextSegment[]): FormattedTextSegment[] {
  const merged: FormattedTextSegment[] = [];

  for (const segment of segments) {
    if (!segment.text) continue;
    const previous = merged[merged.length - 1];
    if (previous && previous.bold === segment.bold) {
      previous.text += segment.text;
    } else {
      merged.push({ ...segment });
    }
  }

  return merged.length > 0 ? merged : [{ text: '', bold: false }];
}

function sanitizePatchLineText(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code <= 0x1f && code !== 0x09 && code !== 0x0a && code !== 0x0d) continue;
    if (code === 0xfffe || code === 0xffff) continue;
    out += ch;
  }
  return out;
}

function escapeXml(text: string): string {
  return sanitizePatchLineText(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripXmlSpaceAttr(attrs: string): string {
  return attrs.replace(/\s+xml:space="[^"]*"/gi, '');
}

function textRunXml(text: string, attrs: string, rPr: string): string {
  const needsPreserve = text.startsWith(' ') || text.endsWith(' ') || text.includes('  ');
  const spaceAttr = needsPreserve ? ' xml:space="preserve"' : '';
  const cleanAttrs = stripXmlSpaceAttr(attrs);
  return `<w:r>${rPr}<w:t${cleanAttrs}${spaceAttr}>${escapeXml(text)}</w:t></w:r>`;
}

function paragraphOpenTag(paraXml: string): string {
  return paraXml.match(/^<w:p[^>]*>/)?.[0] ?? '<w:p>';
}

function paragraphProperties(paraXml: string): string {
  return paraXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? '';
}

function firstTextRunProperties(paraXml: string): string {
  for (const match of eachWordTextRun(paraXml)) {
    const runXml = match[0];
    if (!/<w:t[\s>]/.test(runXml)) continue;
    const rPr = runXml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0];
    if (rPr) return rPr;
  }

  const fromPara = paraXml.match(/<w:pPr>[\s\S]*?<w:rPr>[\s\S]*?<\/w:rPr>[\s\S]*?<\/w:pPr>/);
  const paraRPr = fromPara?.[0].match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0];
  return paraRPr ?? '';
}

function textRunAttrs(paraXml: string): string {
  const match = paraXml.match(/<w:t(?:\s([^>]*))?>/) ;
  if (!match?.[1]) return '';
  return stripXmlSpaceAttr(` ${match[1]}`);
}

/** Remove duplicate attributes on XML opening tags (e.g. repeated xml:space). */
export function dedupeXmlAttributes(xml: string): string {
  return xml.replace(/<([^\s>/]+)((?:\s[^>]*?)*)>/g, (full, tagName: string, attrPart: string) => {
    if (!attrPart.trim()) return full;

    const seen = new Set<string>();
    const deduped = attrPart.replace(
      /\s([^\s=]+)(?:="[^"]*"|='[^']*'|=\S+)/g,
      (match, name: string) => {
        const key = name.toLowerCase();
        if (seen.has(key)) return '';
        seen.add(key);
        return match;
      },
    );

    return `<${tagName}${deduped}>`;
  });
}

function addBoldToRunProperties(rPr: string): string {
  if (!rPr) return '<w:rPr><w:b/></w:rPr>';
  if (/<w:b[\s/>]/.test(rPr)) return rPr;
  return rPr.replace('</w:rPr>', '<w:b/></w:rPr>');
}

function removeBoldFromRunProperties(rPr: string): string {
  if (!rPr) return '';
  return rPr
    .replace(/<w:b\s*\/>/g, '')
    .replace(/<w:b>[\s\S]*?<\/w:b>/g, '')
    .replace(/<w:rPr>\s*<\/w:rPr>/g, '');
}

function runPropertiesForSegment(baseRPr: string, bold: boolean): string {
  return bold ? addBoldToRunProperties(baseRPr) : removeBoldFromRunProperties(baseRPr);
}

function wordJustificationValue(
  align: BoardResolutionParagraphAlignment,
): 'left' | 'center' | 'right' | 'both' {
  if (align === 'justify') return 'both';
  return align;
}

function applyParagraphAlignment(
  pPr: string,
  align: BoardResolutionParagraphAlignment | undefined,
): string {
  if (!align) return pPr;

  const jcVal = wordJustificationValue(align);
  if (/<w:jc[\s/>]/.test(pPr)) {
    if (/<w:jc[^>]*\/>/.test(pPr)) {
      return pPr.replace(/<w:jc[^>]*\/>/, `<w:jc w:val="${jcVal}"/>`);
    }
    return pPr.replace(/<w:jc[^>]*>[\s\S]*?<\/w:jc>/, `<w:jc w:val="${jcVal}"/>`);
  }

  if (pPr.includes('<w:pPr>')) {
    return pPr.replace('<w:pPr>', `<w:pPr><w:jc w:val="${jcVal}"/>`);
  }

  return `<w:pPr><w:jc w:val="${jcVal}"/></w:pPr>`;
}

/** Non-text children (bookmarks, fields, drawings) preserved when rewriting text runs. */
function nonTextRuns(paraXml: string): string {
  const runs: string[] = [];
  for (const match of eachWordTextRun(paraXml)) {
    if (/<w:t[\s>]/.test(match[0])) continue;
    runs.push(match[0]);
  }
  return runs.join('');
}

/**
 * Update paragraph body text in-place: keep w:pPr and non-text runs; replace text runs only.
 */
export function patchParagraphText(
  paraXml: string,
  patch: string | BoardResolutionParagraphPatch,
): string {
  const line = typeof patch === 'string' ? patch : (patch.line ?? patch.text);
  const align = typeof patch === 'string' ? undefined : patch.align;

  const open = paragraphOpenTag(paraXml);
  let pPr = paragraphProperties(paraXml);
  if (align !== undefined) {
    pPr = applyParagraphAlignment(pPr, align);
  }
  const preserved = nonTextRuns(paraXml);
  const baseRPr = firstTextRunProperties(paraXml);
  const tAttrs = textRunAttrs(paraXml);
  const segments = parseFormattedLine(line);

  const textRuns = segments
    .map((segment) => textRunXml(segment.text, tAttrs, runPropertiesForSegment(baseRPr, segment.bold)))
    .join('');

  return `${open}${pPr}${preserved}${textRuns}</w:p>`;
}

/**
 * Patch document.xml body text line-by-line while preserving paragraph structure and styling.
 * Extra preview lines are ignored; extra Word paragraphs are left unchanged.
 */
export function patchDocumentBodyParagraphs(documentXml: string, content: string): string {
  const bodyMatch = documentXml.match(/<w:body>([\s\S]*?)<\/w:body>/);
  if (!bodyMatch) return documentXml;

  const bodyInner = bodyMatch[1];
  const sectPrMatch = bodyInner.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  const sectPr = sectPrMatch?.[0] ?? '';
  const bodyWithoutSect = sectPr ? bodyInner.replace(sectPr, '') : bodyInner;

  const paragraphs = parseBoardResolutionPatchContent(content);
  let lineIndex = 0;

  const patchedBody = bodyWithoutSect.replace(/<w:p[\s\S]*?<\/w:p>/g, (paraXml) => {
    if (lineIndex >= paragraphs.length) return paraXml;
    const patched = patchParagraphText(paraXml, paragraphs[lineIndex] ?? { text: '' });
    lineIndex += 1;
    return patched;
  });

  const newBodyInner = `${patchedBody}${sectPr}`;
  const patched = documentXml.replace(bodyMatch[0], `<w:body>${newBodyInner}</w:body>`);
  return dedupeXmlAttributes(patched);
}
