/**
 * Shared by the board-resolution / NOC prepare scripts.
 *
 * The firm marks every blank ("_____") in its Word files with a comment naming
 * what goes there. `tagCommentedDocx` swaps each commented blank for its
 * docxtemplater tag, optionally turns the director bullets into one looped
 * bullet, and drops the comments, so the firm's layout, fonts and numbering are
 * kept as-is.
 */
import fs from 'node:fs';
import PizZip from 'pizzip';

/**
 * @param {object} opts
 * @param {string} opts.source  firm's Word file (with comments)
 * @param {string} opts.out     tagged template to write
 * @param {Record<number, string>} opts.tags  comment id → replacement text ('' = drop the blank)
 * @param {[number, number][]} [opts.clearBetween]  empty the joining text between two comments
 * @param {{ loop: number, drop: number }} [opts.directors]  director bullets: first loops, second is removed
 * @param {(xml: string) => string} [opts.beforeCleanup]  wording fixes that need the blanks still in place
 * @param {(xml: string) => string} [opts.afterCleanup]   wording fixes after blanks are cleared
 */
export function tagCommentedDocx({ source, out, tags, clearBetween = [], directors, beforeCleanup, afterCleanup }) {
  const zip = new PizZip(fs.readFileSync(source));
  let xml = zip.file('word/document.xml').asText();

  /** Replace the text of every <w:t> between a comment's start and end: first gets `text`, rest emptied. */
  function tagComment(id, text) {
    const start = xml.indexOf(`<w:commentRangeStart w:id="${id}"/>`);
    const end = xml.indexOf(`<w:commentRangeEnd w:id="${id}"/>`);
    if (start < 0 || end < 0) throw new Error(`comment ${id} not found`);
    let first = true;
    const inner = xml.slice(start, end).replace(/(<w:t(?: [^>]*)?>)([^<]*)(<\/w:t>)/g, (_, open, _t, close) => {
      const value = first ? text : '';
      first = false;
      return `<w:t xml:space="preserve">${value}${close}`;
    });
    xml = xml.slice(0, start) + inner + xml.slice(end);
  }

  /** The paragraph (<w:p>…</w:p>) holding comment `id`. */
  function paragraphOf(id) {
    const at = xml.indexOf(`<w:commentRangeStart w:id="${id}"/>`);
    const start = Math.max(xml.lastIndexOf('<w:p>', at), xml.lastIndexOf('<w:p ', at));
    const end = xml.indexOf('</w:p>', at) + '</w:p>'.length;
    return { start, end };
  }

  /** Empty every <w:t> between the end of comment `a` and the start of comment `b` (the joining text). */
  function clearJoin(a, b) {
    const from = xml.indexOf(`<w:commentRangeEnd w:id="${a}"/>`);
    const to = xml.indexOf(`<w:commentRangeStart w:id="${b}"/>`);
    if (from < 0 || to < from) throw new Error(`comments ${a}..${b} not found in order`);
    const inner = xml.slice(from, to).replace(/(<w:t(?: [^>]*)?>)([^<]*)(<\/w:t>)/g, '$1$3');
    xml = xml.slice(0, from) + inner + xml.slice(to);
  }

  for (const [id, text] of Object.entries(tags)) tagComment(Number(id), text);
  if (beforeCleanup) xml = beforeCleanup(xml);

  // Some blanks run past their comment (split across runs); every blank is tagged by now.
  xml = xml
    .replace(/(<w:t(?: [^>]*)?>)_+(<\/w:t>)/g, '$1$2')
    .replace(/(<w:t(?: [^>]*)?>)([^<_]*?)_{3,}([^<]*<\/w:t>)/g, '$1$2$3');

  if (afterCleanup) xml = afterCleanup(xml);
  for (const [a, b] of clearBetween) clearJoin(a, b);

  if (directors) {
    const drop = paragraphOf(directors.drop);
    xml = xml.slice(0, drop.start) + xml.slice(drop.end);
    const loop = paragraphOf(directors.loop);
    let first = true;
    const bullet = xml
      .slice(loop.start, loop.end)
      .replace(/(<w:t(?: [^>]*)?>)([^<]*)(<\/w:t>)/g, (_, _open, _t, close) => {
        const value = first ? '{NAME}' : '';
        first = false;
        return `<w:t xml:space="preserve">${value}${close}`;
      });
    const marker = (tag) => `<w:p><w:r><w:t>${tag}</w:t></w:r></w:p>`;
    xml = xml.slice(0, loop.start) + marker('{#DIRECTORS}') + bullet + marker('{/DIRECTORS}') + xml.slice(loop.end);
  }

  // Drop the comments: anchors, reference runs, and the comment parts.
  xml = xml
    .replace(/<w:commentRange(?:Start|End) w:id="\d+"\/>/g, '')
    .replace(/<w:r(?: [^>]*)?>(?:(?!<\/w:r>)[\s\S])*?<w:commentReference w:id="\d+"\/><\/w:r>/g, '');
  // Yellow marks the blanks for whoever fills them by hand; a generated draft has none.
  xml = xml.replace(/<w:highlight w:val="[a-zA-Z]+"\/>/g, '');
  zip.file('word/document.xml', xml);

  for (const name of Object.keys(zip.files)) {
    if (/^word\/(comments[A-Za-z]*|people)\.xml$/.test(name)) zip.remove(name);
  }
  const rels = zip.file('word/_rels/document.xml.rels').asText();
  zip.file(
    'word/_rels/document.xml.rels',
    rels.replace(/<Relationship [^>]*Target="(?:comments[A-Za-z]*|people)\.xml"\/>/g, ''),
  );
  const types = zip.file('[Content_Types].xml').asText();
  zip.file(
    '[Content_Types].xml',
    types.replace(/<Override PartName="\/word\/(?:comments[A-Za-z]*|people)\.xml"[^>]*\/>/g, ''),
  );

  // The header's "{On the letter head…}" braces would read as a template tag.
  for (const name of Object.keys(zip.files)) {
    if (/^word\/header\d*\.xml$/.test(name)) {
      const header = zip.file(name).asText();
      zip.file(name, header.replace(/(<w:t(?: [^>]*)?>)([^<]*)(<\/w:t>)/g, (_, o, t, c) => o + t.replace(/[{}]/g, '') + c));
    }
  }

  const leftover = (xml.match(/<w:t(?: [^>]*)?>[^<]*_{3,}[^<]*<\/w:t>/g) ?? []).length;
  if (leftover) throw new Error(`${leftover} blank(s) left untagged`);

  fs.writeFileSync(out, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log(`wrote ${out}`);
}
