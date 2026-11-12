// Compacts captured AEM field schemas (schemas-full/*.json from the recorder's extract step) for the
// repository: drops static text blocks (guideTextDraw), empty panel lists and whitespace, and keeps
// every field's key, semantic classes, label, type, mandatory flag, widget id, name, maxlength and
// option set, plus the page URL and its buttons. No value is ever part of a schema.
//
//   node tools/portal-data/compact-schemas.mjs <schemas-full dir> <out dir>
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [src, out] = process.argv.slice(2);
/** A DIN (eight digits), PAN, Aadhaar, email or mobile number shape inside an option. */
const PERSONAL = /\b\d{8}\b|\b[A-Z]{5}\d{4}[A-Z]\b|\b\d{4}\s?\d{4}\s?\d{4}\b|@|\b[6-9]\d{9}\b/;
if (!src || !out) {
  console.error('usage: node compact-schemas.mjs <schemas-full dir> <out dir>');
  process.exit(1);
}
mkdirSync(out, { recursive: true });
for (const file of readdirSync(src).filter((f) => f.endsWith('.json'))) {
  const raw = JSON.parse(readFileSync(path.join(src, file), 'utf8'));
  if (Array.isArray(raw)) {
    writeFileSync(path.join(out, file), `${JSON.stringify(raw, null, 1)}\n`);
    continue;
  }
  const fields = raw.fields
    .filter((f) => f.type !== 'guideTextDraw')
    .map((f) => {
      const w = f.widget ?? {};
      const o = { id: f.id, key: f.key, label: f.label, type: f.type, semantic: f.semantic };
      if (f.mandatory) o.mandatory = true;
      if (f.disabled) o.disabled = true;
      if (f.readonly) o.readonly = true;
      if (f.panels?.length) o.panels = f.panels;
      const widget = {};
      for (const k of ['tag', 'id', 'name', 'type', 'placeholder', 'maxlength', 'options']) if (w[k] !== undefined && w[k] !== '') widget[k] = w[k];
      // Lists the portal fills from the filing's own people (AGILE-PRO-S director lists show
      // "NAME-DIN") are personal data: keep only the "Select Here" prompt.
      if (Array.isArray(widget.options)) widget.options = widget.options.filter((opt) => !PERSONAL.test(`${opt.v} ${opt.t}`));
      if (Object.keys(widget).length) o.widget = widget;
      // A value read from the page must never reach the repository.
      delete o.value;
      return o;
    });
  const compact = { form: raw.form, url: raw.url, fieldCount: raw.fieldCount, fields, buttons: raw.buttons };
  writeFileSync(path.join(out, file), `${JSON.stringify(compact).replace(/\/home\/[^/"]+\/mca-capture\//g, 'mca-capture/')}\n`);
}
console.log(`compacted ${src} -> ${out}`);
