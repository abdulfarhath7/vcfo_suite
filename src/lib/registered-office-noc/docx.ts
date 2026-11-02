import 'server-only';

import PizZip from 'pizzip';

import { nocModel, runsText, type NocInput } from '@/lib/registered-office-noc/model';

/**
 * The registered-office NOC as a real Word file, built on the server
 * (owner's request; HANDOFF §5: "the Word file should be generated
 * server-side"). WordprocessingML written straight into a zip with PizZip —
 * the same library the incorporation documents use — so no template file is
 * needed: A4, Times New Roman 12, one page, ready to print and sign. The text
 * comes from `nocModel`, exactly what the wizard's preview shows.
 */

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function run(text: string, o?: { b?: boolean; u?: boolean; sz?: number }): string {
  const props = `${o?.b ? '<w:b/>' : ''}${o?.u ? '<w:u w:val="single"/>' : ''}${o?.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ''}`;
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
}

function para(runs: string, o?: { jc?: 'center' | 'both'; after?: number }): string {
  return `<w:p><w:pPr>${o?.jc ? `<w:jc w:val="${o.jc}"/>` : ''}<w:spacing w:after="${o?.after ?? 200}" w:line="300" w:lineRule="auto"/></w:pPr>${runs}</w:p>`;
}

export function buildNocDocx(input: NocInput): Buffer {
  const m = nocModel(input);
  const body = [
    para(run(`Date: ${m.date.t}`) + '<w:r><w:tab/></w:r>' + run(`Place: ${m.place.t}`), { after: 360 }),
    para(run('NO OBJECTION CERTIFICATE', { b: true, u: true, sz: 28 }), { jc: 'center', after: 80 }),
    para(run('(For use of premises as the registered office)', { sz: 20 }), { jc: 'center', after: 360 }),
    para(run('To,'), { after: 0 }),
    para(run(`The ${m.roc}`), { after: 0 }),
    para(run('Ministry of Corporate Affairs'), { after: 280 }),
    para(run(runsText(m.subject), { b: true }), { after: 280 }),
    para(run('Dear Sir or Madam,')),
    ...m.paras.map((p) => para(run(runsText(p)), { jc: 'both' })),
    para('', { after: 360 }),
    para(run('______________________________'), { after: 40 }),
    para(run(m.signName.t, { b: true }), { after: 0 }),
    para(run('Owner of the Premises'), { after: 360 }),
    para(run('Enclosures:', { b: true }), { after: 80 }),
    ...m.encl.map((e, i) => para(run(`${i + 1}. ${e}`), { after: 40 })),
  ].join('');

  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-IN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:tabs><w:tab w:val="right" w:pos="9026"/></w:tabs></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>';
  const rels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>';
  const docRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(`NOC · ${m.company || 'company'}`)}</dc:title><dc:creator>SBC · VCFO Suite</dc:creator></cp:coreProperties>`;

  const zip = new PizZip();
  zip.file('[Content_Types].xml', contentTypes);
  zip.file('_rels/.rels', rels);
  zip.file('word/document.xml', document);
  zip.file('word/_rels/document.xml.rels', docRels);
  zip.file('word/styles.xml', styles);
  zip.file('docProps/core.xml', core);
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
}

export const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
