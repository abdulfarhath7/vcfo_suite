// @vitest-environment node
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import PizZip from 'pizzip';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { catalogEntry, writableUses } from '@/lib/ask/field-catalog';
import { docxToText } from '@/lib/ask/ingest/extract';
import type { LlmProvider, LlmRequest } from '@/lib/ask/provider';
import { placeValues } from './place';
import { cellText, guessDocType, missingTargets, readFile } from './read';

/**
 * PLAN M: Ask reads every document and fills the app. Classification of the new document types,
 * the targeted read that puts prose (business description, main objects) on its field with the
 * quote check, mixed scanned PDFs, workbook formula cells, Word headers and tables, and emails with
 * attachments. Every model call is a mock that answers by the shape of the request.
 */

type Reply = { main?: (req: LlmRequest) => unknown; targeted?: (req: LlmRequest) => unknown };

/** A model that tells a first read (`parts`) from a targeted read (`values` by key). */
function model(reply: Reply): { provider: LlmProvider; seen: LlmRequest[] } {
  const seen: LlmRequest[] = [];
  return {
    seen,
    provider: {
      name: 'mock',
      complete: vi.fn(async (req: LlmRequest) => {
        seen.push(req);
        const targeted = Boolean((req.outputSchema as { properties?: Record<string, unknown> } | undefined)?.properties?.values);
        const out = targeted ? (reply.targeted?.(req) ?? { values: [] }) : (reply.main?.(req) ?? { parts: [{ docType: 'other', company: null, values: [] }] });
        return { model: req.model, content: [{ type: 'text', text: JSON.stringify(out) }], stopReason: 'end_turn', usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 } } as never;
      }),
    },
  };
}

const deps = (provider: LlmProvider) => ({ provider: async () => provider, model: 'claude-haiku-5-5', idDocReading: true });
const isTargeted = (req: LlmRequest) => Boolean((req.outputSchema as { properties?: Record<string, unknown> }).properties?.values);
const textOf = (req: LlmRequest) => JSON.stringify(req.messages);

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const para = (text: string) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

function docx(body: string, extra: Record<string, string> = {}): Buffer {
  const zip = new PizZip();
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document ${W}><w:body>${body}</w:body></w:document>`);
  for (const [name, xml] of Object.entries(extra)) zip.file(name, xml);
  return zip.generate({ type: 'nodebuffer' }) as Buffer;
}

const RESOLUTION = [
  'CERTIFIED TRUE COPY OF THE RESOLUTION PASSED BY THE BOARD OF DIRECTORS OF BONTERRA HOLDINGS PTE LTD',
  'RESOLVED THAT the company incorporate a wholly owned subsidiary in India, Bonterra India Private Limited.',
  'RESOLVED FURTHER THAT the subsidiary shall carry on the business of developing, licensing and supporting enterprise software for logistics companies, and providing related consulting and maintenance services to customers in India.',
  'RESOLVED FURTHER THAT the main objects shall be as per NIC code 62011.',
];

async function pdf(pages: Array<string | Buffer>): Promise<Buffer> {
  const doc = new PDFDocument({ autoFirstPage: false });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  for (const page of pages) {
    doc.addPage();
    if (typeof page === 'string') doc.fontSize(11).text(page);
    else doc.image(page, 50, 50, { width: 400 });
  }
  doc.end();
  return done;
}

const scanImage = () => sharp({ create: { width: 300, height: 200, channels: 3, background: { r: 240, g: 240, b: 240 } } }).png().toBuffer();

describe('the new document types (M1)', () => {
  it('knows a board resolution, an MOA, an AOA and a NOC from the words or the file name', () => {
    expect(guessDocType(RESOLUTION.join('\n'), 'scan.docx')).toBe('board_resolution');
    expect(guessDocType('MEMORANDUM OF ASSOCIATION OF ACME PRIVATE LIMITED', 'x.pdf')).toBe('moa');
    expect(guessDocType('ARTICLES OF ASSOCIATION', 'x.pdf')).toBe('aoa');
    expect(guessDocType('', 'NOC from owner.pdf')).toBe('noc');
    expect(guessDocType('', 'Bonterra_BR_signed.pdf')).toBe('board_resolution');
    expect(guessDocType('', 'DIR-2 consent.pdf')).toBe('consent_letter');
    expect(guessDocType('Invoice for services', 'invoice.pdf')).toBeNull();
  });

  it('asks only for the facts a type holds that the first read did not find', () => {
    const keys = missingTargets('board_resolution', [{ label: 'NIC code', value: '62011', page: 1, person: null, confidence: 1 }]).map((e) => e.key);
    expect(keys).toContain('company.business_description');
    expect(keys).not.toContain('company.nic_code');
    expect(missingTargets('moa', []).map((e) => e.key)).toContain('company.main_objects');
    expect(missingTargets('other', [])).toEqual([]);
  });
});

describe('the targeted read (M2)', () => {
  it('puts the business description from a board resolution on its field, with the quote it came from', async () => {
    const { provider, seen } = model({
      main: () => ({ parts: [{ docType: 'other', company: 'Bonterra India Private Limited', values: [] }] }),
      targeted: () => ({
        values: [
          {
            key: 'company.business_description',
            value: 'The company will develop, license and support enterprise software for logistics companies, and provide related consulting and maintenance services to customers in India.',
            quote: 'carry on the business of developing, licensing and supporting enterprise software for logistics companies',
            page: 1,
            person: null,
            confidence: 0.9,
          },
          { key: 'company.nic_code', value: '62011', quote: 'as per NIC code 62011', page: 1, person: null, confidence: 1 },
          // Made up: the quote is not in the document, so it never reaches the card.
          { key: 'company.proposed_name_2', value: 'Bonterra Tech India Private Limited', quote: 'second proposed name Bonterra Tech India', page: 1, person: null, confidence: 1 },
        ],
      }),
    });
    const result = await readFile({ fileName: 'board-resolution.docx', data: docx(RESOLUTION.map(para).join('')) }, deps(provider));
    expect(result.docType).toBe('board_resolution');
    const targeted = seen.find(isTargeted)!;
    expect(targeted.maxTokens).toBeGreaterThanOrEqual(4000);
    expect(textOf(targeted)).toContain('company.business_description');
    expect(result.values.map((v) => v.targetKey)).toEqual(['company.business_description', 'company.nic_code']);
    const description = result.values[0]!;
    expect(description.quote).toMatch(/enterprise software for logistics/);
    expect(description.page).toBe(1);

    const { placed } = await placeValues([{ result, attachment: { id: 'att-1', kind: 'file', fileName: 'board-resolution.docx' } }], {
      instruction: 'fill bonterra into the app',
      provider: async () => {
        throw new Error('no model for placing');
      },
      model: 'm',
    });
    const entry = placed.find((p) => p.value.targetKey === 'company.business_description')!.entry;
    expect(writableUses(entry)).toEqual([expect.objectContaining({ ref: 'pre-1', field: 'businessDescription' })]);
    expect(placed.find((p) => p.entry.key === 'company.business_description')!.source).toMatchObject({ kind: 'attachment', page: 1, quote: expect.stringMatching(/logistics/) });
  });

  it('drops a summary that the document does not support, even with a true quote', async () => {
    const { provider } = model({
      main: () => ({ parts: [{ docType: 'board_resolution', company: null, values: [] }] }),
      targeted: () => ({
        values: [
          {
            key: 'company.business_description',
            value: 'Manufacturing pharmaceutical tablets, vaccines and medical devices for hospitals across Europe and Africa.',
            quote: 'carry on the business of developing, licensing and supporting enterprise software',
            page: 1,
            person: null,
            confidence: 0.9,
          },
        ],
      }),
    });
    const result = await readFile({ fileName: 'resolution.docx', data: docx(RESOLUTION.map(para).join('')) }, deps(provider));
    expect(result.values.filter((v) => v.targetKey)).toEqual([]);
  });

  it('sends the main objects of an MOA to the business description, cut to 1,000 characters', async () => {
    const moa = ['MEMORANDUM OF ASSOCIATION OF BONTERRA INDIA PRIVATE LIMITED', `III. The main objects to be pursued by the company on its incorporation are: ${'to develop and license enterprise software for logistics companies and to provide consulting and maintenance services; '.repeat(12)}`];
    const { provider } = model({
      main: () => ({ parts: [{ docType: 'moa', company: 'Bonterra India Private Limited', values: [] }] }),
      targeted: () => ({ values: [{ key: 'company.main_objects', value: `To develop and license enterprise software for logistics companies. ${'And to provide consulting and maintenance services. '.repeat(40)}`, quote: 'The main objects to be pursued by the company on its incorporation are', page: 1, person: null, confidence: 0.9 }] }),
    });
    const result = await readFile({ fileName: 'moa.docx', data: docx(moa.map(para).join('')) }, deps(provider));
    const objects = result.values.find((v) => v.targetKey === 'company.main_objects')!;
    expect(objects.value.length).toBeLessThanOrEqual(1001);
    const { placed } = await placeValues([{ result, attachment: { id: 'att-2', kind: 'file', fileName: 'moa.docx' } }], { instruction: '', provider: async () => provider, model: 'm' });
    expect(placed.map((p) => p.entry.key)).toEqual(['company.business_description']);
    expect(catalogEntry('company.main_objects')?.fills).toBe('company.business_description');
  });
});

describe('mixed PDFs (M6)', () => {
  it('reads text pages as text and sends only the scanned page to the model as a picture', async () => {
    const data = await pdf(['MEMORANDUM OF ASSOCIATION OF ACME PRIVATE LIMITED. The authorised share capital is Rs 10,00,000.', await scanImage()]);
    const { provider, seen } = model({
      main: (req) =>
        /Page 2/.test(textOf(req)) && /image|document/.test(textOf(req))
          ? { parts: [{ docType: 'moa', company: null, values: [{ label: 'Subscriber name', value: 'Asha Rao', page: 2, person: 'Asha Rao', confidence: 0.9 }] }] }
          : { parts: [{ docType: 'moa', company: 'Acme Private Limited', values: [{ label: 'Authorised share capital', value: 'Rs 10,00,000', page: 1, person: null, confidence: 1 }] }] },
    });
    const result = await readFile({ fileName: 'moa.pdf', data }, deps(provider));
    const firstRead = seen.find((req) => !isTargeted(req) && !/"type":"(image|document)"/.test(textOf(req)))!;
    expect(textOf(firstRead)).toContain('[Page 1]');
    expect(textOf(firstRead)).not.toContain('[Page 2]');
    const visual = seen.find((req) => /"type":"(image|document)"/.test(textOf(req)))!;
    expect(textOf(visual)).toMatch(/Page 2|pages 2/);
    expect(result.values.map((v) => [v.value, v.page])).toEqual(expect.arrayContaining([['Rs 10,00,000', 1], ['Asha Rao', 2]]));
  });
});

describe('workbooks (M7)', () => {
  it('gives a formula its result, rich text its characters and a link its text', async () => {
    expect(cellText({ formula: 'A1*2', result: 200000 })).toBe('200000');
    expect(cellText({ sharedFormula: 'B1', result: new Date('2026-04-01T00:00:00Z') })).toBe('2026-04-01');
    expect(cellText({ richText: [{ text: 'Bonterra ' }, { text: 'India' }] })).toBe('Bonterra India');
    expect(cellText({ text: 'bonterra.in', hyperlink: 'https://bonterra.in' })).toBe('bonterra.in');
    expect(cellText({ error: '#REF!' })).toBe('');

    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('Details');
    sheet.addRow(['Authorised share capital', { formula: '100000*10', result: 1000000 }]);
    sheet.addRow(['Company name', { richText: [{ text: 'Bonterra ' }, { text: 'India Private Limited' }] }]);
    const data = Buffer.from(await book.xlsx.writeBuffer());
    const { provider } = model({});
    const result = await readFile({ fileName: 'details.xlsx', data }, deps(provider));
    expect(JSON.stringify(result)).not.toContain('[object Object]');
    expect(result.values.map((v) => v.value)).toContain('1000000');
    expect(result.company).toBe('Bonterra India Private Limited');
  });
});

describe('Word (M8)', () => {
  it('reads tables as rows and the header and footer too', () => {
    const table = `<w:tbl><w:tr><w:tc>${para('PAN')}</w:tc><w:tc>${para('ABCDE1234F')}</w:tc></w:tr><w:tr><w:tc>${para('CIN')}</w:tc><w:tc>${para('U62011KA2026PTC123456')}</w:tc></w:tr></w:tbl>`;
    const text = docxToText(
      docx(`${para('Details')}${table}${para('End')}`, {
        'word/header1.xml': `<w:hdr ${W}>${para('Bonterra India Private Limited, Bengaluru')}</w:hdr>`,
        'word/footer1.xml': `<w:ftr ${W}>${para('Registered office: 12 MG Road')}</w:ftr>`,
      }),
    );
    expect(text).toContain('PAN | ABCDE1234F');
    expect(text).toContain('CIN | U62011KA2026PTC123456');
    expect(text.indexOf('Details')).toBeLessThan(text.indexOf('PAN |'));
    expect(text).toContain('Bonterra India Private Limited, Bengaluru');
    expect(text).toContain('Registered office: 12 MG Road');
  });

  it('refuses an old .doc with a clear message', async () => {
    const { provider } = model({});
    await expect(readFile({ fileName: 'old.doc', data: Buffer.from('x') }, deps(provider))).rejects.toThrow(/save it as \.docx/);
  });
});

describe('emails (M9)', () => {
  it('reads an .eml and its PDF attachment, naming the attachment each value came from', async () => {
    const attachment = await pdf(['MEMORANDUM OF ASSOCIATION OF BONTERRA INDIA PRIVATE LIMITED. The authorised share capital is Rs 10,00,000.']);
    const eml = [
      'From: Asha Rao <asha@bonterra.example>',
      'To: lead@sbc.example',
      'Subject: Bonterra MOA',
      'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary="b1"',
      '',
      '--b1',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Please find the MOA attached. Our proposed office is in Bengaluru.',
      '--b1',
      'Content-Type: application/pdf; name="moa.pdf"',
      'Content-Disposition: attachment; filename="moa.pdf"',
      'Content-Transfer-Encoding: base64',
      '',
      attachment.toString('base64').replace(/.{76}/g, '$&\r\n'),
      '--b1--',
      '',
    ].join('\r\n');
    const { provider, seen } = model({
      main: (req) =>
        /MEMORANDUM/.test(textOf(req))
          ? { parts: [{ docType: 'moa', company: 'Bonterra India Private Limited', values: [{ label: 'Authorised share capital', value: 'Rs 10,00,000', page: 1, person: null, confidence: 1 }] }] }
          : { parts: [{ docType: 'company_letter', company: null, values: [] }] },
    });
    const result = await readFile({ fileName: 'Bonterra MOA.eml', data: Buffer.from(eml) }, deps(provider));
    expect(result.docType).toBe('moa');
    expect(result.values.find((v) => v.value === 'Rs 10,00,000')).toMatchObject({ from: 'moa.pdf' });
    // The body was read too, as prose.
    expect(seen.some((req) => /proposed office is in Bengaluru/.test(textOf(req)))).toBe(true);
  });
});
