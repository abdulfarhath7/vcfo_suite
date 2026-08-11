/**
 * Shared helpers for injecting docxtemplater placeholders into Word templates.
 * Yellow-highlighted sample runs in source .docx files become `{TAG}` runs that keep
 * the highlight formatting (same pattern as prepare-board-resolution-docx.mjs).
 */
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import { SaxesParser } from 'saxes';

/** Match `<w:r>` runs only — not `<w:rPr>`, `<w:rFonts>`, etc. */
export const WORD_RUN_RE = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g;

const YELLOW_HIGHLIGHT = '<w:highlight w:val="yellow"/>';

export function isYellowRun(runXml) {
  return /w:highlight[^>]*w:val="yellow"/i.test(runXml);
}

function runText(runXml) {
  return [...runXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
}

export function makeTaggedRun(sampleRunXml, tag) {
  const rPr = sampleRunXml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? '';
  const rsid = sampleRunXml.match(/<w:r\s+([^>]+)>/)?.[1] ?? 'w:rsidR="00000000"';
  return `<w:r ${rsid}>${rPr}<w:t xml:space="preserve">{${tag}}</w:t></w:r>`;
}

function collectWordRuns(xml) {
  const runs = [];
  let match;
  const runRe = new RegExp(WORD_RUN_RE.source, 'g');
  while ((match = runRe.exec(xml)) !== null) {
    runs.push({ start: match.index, end: match.index + match[0].length, xml: match[0] });
  }
  return runs;
}

export function collectYellowRuns(xml) {
  return collectWordRuns(xml).filter((run) => isYellowRun(run.xml));
}

function collectYellowGroups(xml) {
  const runs = collectWordRuns(xml);

  const groups = [];
  let current = null;
  for (const run of runs) {
    if (isYellowRun(run.xml)) {
      if (!current) current = [];
      current.push(run);
    } else if (current) {
      groups.push(current);
      current = null;
    }
  }
  if (current) groups.push(current);
  return groups;
}

export function injectYellowTagsByGroup(xml, groupTags) {
  const groups = collectYellowGroups(xml);
  if (groups.length !== groupTags.length) {
    throw new Error(`Expected ${groupTags.length} yellow groups, got ${groups.length}`);
  }

  let out = xml;
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const group = groups[i];
    const tag = groupTags[i];
    const start = group[0].start;
    const end = group[group.length - 1].end;
    out = out.slice(0, start) + makeTaggedRun(group[0].xml, tag) + out.slice(end);
  }
  return out;
}

export function injectYellowTagsByRun(xml, runTags) {
  const yellowRuns = collectYellowRuns(xml);
  if (yellowRuns.length !== runTags.length) {
    throw new Error(`Expected ${runTags.length} yellow runs, got ${yellowRuns.length}`);
  }

  let out = xml;
  for (let i = yellowRuns.length - 1; i >= 0; i -= 1) {
    const run = yellowRuns[i];
    const tag = runTags[i];
    out = out.slice(0, run.start) + makeTaggedRun(run.xml, tag) + out.slice(run.end);
  }
  return out;
}

function findMergeTags(xml) {
  return [...new Set([...xml.matchAll(/\{([A-Z][A-Z0-9_]*)\}/g)].map((m) => m[1]))];
}

export function missingMergeTags(xml, requiredKeys) {
  const found = new Set(findMergeTags(xml));
  return requiredKeys.filter((key) => !found.has(key));
}

/** Runs whose text is exactly `{TAG}` (docxtemplater placeholders). */
export function collectMergeTagRuns(xml) {
  return collectWordRuns(xml).filter((run) => /\{[A-Z][A-Z0-9_]*\}/.test(runText(run.xml)));
}

export function mergeTagRunsLackYellow(xml) {
  const tagRuns = collectMergeTagRuns(xml);
  if (tagRuns.length === 0) return false;
  return tagRuns.some((run) => !isYellowRun(run.xml));
}

function yellowGroupTexts(xml) {
  return collectYellowGroups(xml).map((group) => group.map((run) => runText(run.xml)).join(''));
}

/** Ensure every `{TAG}` run is yellow-highlighted in the prepared template. */
export function ensureYellowHighlightOnMergeTagRuns(xml) {
  let out = xml;
  const tagRuns = collectMergeTagRuns(out);
  for (let i = tagRuns.length - 1; i >= 0; i -= 1) {
    const run = tagRuns[i];
    if (isYellowRun(run.xml)) continue;

    let runXml = run.xml;
    if (/<w:rPr>/.test(runXml)) {
      runXml = runXml.replace(/<w:rPr>/, `<w:rPr>${YELLOW_HIGHLIGHT}`);
    } else {
      runXml = runXml.replace(/<w:r(?:\s[^>]*)?>/, (open) => `${open}<w:rPr>${YELLOW_HIGHLIGHT}</w:rPr>`);
    }
    out = out.slice(0, run.start) + runXml + out.slice(run.end);
  }
  return out;
}

function logYellowGroups(xml, label = 'document') {
  const texts = yellowGroupTexts(xml);
  console.log(`${label}: ${texts.length} yellow group(s)`);
  texts.forEach((text, i) => console.log(`  ${i + 1}. ${JSON.stringify(text)}`));
}

/** Remove duplicate attributes on XML opening tags (e.g. repeated xml:space). */
function dedupeXmlAttributes(xml) {
  return xml.replace(/<([^\s>/]+)((?:\s[^>]*?)*)>/g, (full, tagName, attrPart) => {
    if (!attrPart.trim()) return full;
    const seen = new Set();
    const deduped = attrPart.replace(/\s([^\s=]+)(?:="[^"]*"|='[^']*'|=\S+)/g, (match, name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return '';
      seen.add(key);
      return match;
    });
    return `<${tagName}${deduped}>`;
  });
}

export function parseWordXmlOrError(xml) {
  const parser = new SaxesParser({ xmlns: false });
  let error = null;
  parser.onerror = (err) => {
    error = err.message;
  };
  try {
    parser.write(xml).close();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  return error;
}

function validateDocxWordXmlParts(docxBuffer) {
  const zip = new PizZip(docxBuffer);
  for (const entry of zip.file(/word\/.*\.xml$/)) {
    const error = parseWordXmlOrError(entry.asText());
    if (error) {
      throw new Error(`${entry.name}: ${error}`);
    }
  }
}

function preparedOutputIsComplete(outXml, requiredKeys) {
  if (missingMergeTags(outXml, requiredKeys).length > 0) return false;
  if (parseWordXmlOrError(outXml)) return false;
  if (mergeTagRunsLackYellow(outXml)) return false;
  return true;
}

export function prepareDocxTemplate({ sourcePath, outPath, requiredKeys, inject, skip = false }) {
  if (skip && fs.existsSync(outPath)) {
    const outZip = new PizZip(fs.readFileSync(outPath));
    const outXml = outZip.file('word/document.xml')?.asText() ?? '';
    if (preparedOutputIsComplete(outXml, requiredKeys)) {
      console.log(`Skipping: ${outPath} already has yellow-highlighted merge tags.`);
      return;
    }
    if (missingMergeTags(outXml, requiredKeys).length === 0 && mergeTagRunsLackYellow(outXml)) {
      console.warn(`Re-preparing ${outPath}: merge tags present but not yellow-highlighted.`);
    }
  }

  if (!fs.existsSync(sourcePath)) {
    console.error(`Missing source: ${sourcePath}`);
    process.exit(1);
  }

  const zip = new PizZip(fs.readFileSync(sourcePath));
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) {
    throw new Error('Source docx is missing word/document.xml');
  }

  let xml = documentFile.asText();
  const yellowCount = collectYellowGroups(xml).length;
  const existing = findMergeTags(xml);
  logYellowGroups(xml, path.basename(sourcePath));

  if (yellowCount > 0) {
    xml = inject(xml);
  } else if (existing.length > 0) {
    console.log('Merge tags already present; ensuring yellow highlight on placeholders.');
    xml = ensureYellowHighlightOnMergeTagRuns(xml);
  } else {
    throw new Error(
      `No yellow-highlighted sample text in ${sourcePath}. ` +
        'Highlight merge values in yellow in Word (see script header), then re-run.',
    );
  }

  const missing = missingMergeTags(xml, requiredKeys);
  if (missing.length > 0) {
    throw new Error(`Missing merge tags after prepare: ${missing.join(', ')}`);
  }

  xml = ensureYellowHighlightOnMergeTagRuns(xml);
  xml = dedupeXmlAttributes(xml);
  const xmlError = parseWordXmlOrError(xml);
  if (xmlError) {
    throw new Error(`Prepared document.xml is invalid: ${xmlError}`);
  }

  zip.file('word/document.xml', xml);
  const outBuffer = zip.generate({ type: 'nodebuffer' });
  validateDocxWordXmlParts(outBuffer);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, outBuffer);
  console.log(`Wrote ${outPath}`);
  const tagSummary = requiredKeys
    .map((key) => {
      const re = new RegExp(`\\{${key}\\}`, 'g');
      return `${key}=${(xml.match(re) ?? []).length}`;
    })
    .join(', ');
  console.log('merge tag counts:', tagSummary);
}
