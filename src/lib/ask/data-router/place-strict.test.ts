// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { catalogEntry } from '@/lib/ask/field-catalog';
import type { LlmProvider, LlmRequest } from '@/lib/ask/provider';
import { planRows } from './plan';
import { placeValues, placementRefusal } from './place';
import { summarySupport } from './targeted';
import type { ReadResult, ReadValue } from './types';

/**
 * Strict facts and differing descriptions, from the 25 Nov browser check (Quarry Digital): the NOC's
 * date was offered as the date of incorporation, the office address as the GST "nature of
 * possession", and the board resolution's business description vanished behind the MOA's.
 */

const value = (label: string, v: string, extra: Partial<ReadValue> = {}): ReadValue => ({ label, value: v, page: 1, person: null, confidence: 1, ...extra });
const read = (docType: string, values: ReadValue[]): ReadResult => ({ docType, company: null, values, parts: [], sensitive: false, usedModel: true });
const file = (id: string, fileName: string) => ({ id, kind: 'file', fileName });

/** A field chooser that picks, for each value, the candidate whose key the test names by label. */
function chooser(byLabel: Record<string, string>): { provider: () => Promise<LlmProvider>; seen: LlmRequest[] } {
  const seen: LlmRequest[] = [];
  const provider: LlmProvider = {
    name: 'mock',
    complete: vi.fn(async (req: LlmRequest) => {
      seen.push(req);
      const text = req.messages[0]!.content as Array<{ text: string }>;
      const lines = JSON.parse(text[0]!.text) as Array<{ index: number; label: string; candidates: Array<{ key: string }> }>;
      const picks = lines.map((line) => ({ index: line.index, key: line.candidates.some((c) => c.key === byLabel[line.label]) ? byLabel[line.label]! : (line.candidates[0]?.key ?? 'none') }));
      return { model: req.model, content: [{ type: 'text', text: JSON.stringify({ picks }) }], stopReason: 'end_turn', usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 } } as never;
    }),
  };
  return { provider: async () => provider, seen };
}

const ADDRESS = 'No. 42, 3rd Floor, Lavelle Road, Bengaluru, Karnataka 560001';

describe('strict facts come only from the documents that state them', () => {
  it('never takes an NOC date as the date of incorporation, and says why', async () => {
    const { provider } = chooser({ Date: 'company.incorporation_date' });
    const { placed, unplaced } = await placeValues(
      [{ result: read('noc', [value('Date of incorporation', '10 November 2026')]), attachment: file('a1', 'Office NOC.pdf') }],
      { instruction: '', provider, model: 'm' },
    );
    expect(placed.map((p) => p.entry.key)).not.toContain('company.incorporation_date');
    expect(unplaced).toEqual([expect.stringMatching(/^Date of incorporation: 10 November 2026 \("Date of incorporation" is taken only from a certificate of incorporation, a PAN card or the client's details sheet, not from a no-objection certificate\)$/)]);
  });

  it('keeps the date of incorporation from a certificate, a details workbook or a paste', async () => {
    const { provider } = chooser({});
    const reads = [
      { result: read('incorporation_certificate', [value('Date of incorporation', '10 November 2026')]), attachment: file('a1', 'COI.pdf') },
      { result: read('other', [value('Date of incorporation', '10 November 2026')]), attachment: file('a2', 'Client details.xlsx') },
      { result: read('other', [value('Date of incorporation', '10 November 2026')]), attachment: null },
    ];
    for (const one of reads) {
      const { placed } = await placeValues([one], { instruction: '', provider, model: 'm' });
      expect(placed.map((p) => p.entry.key)).toEqual(['company.incorporation_date']);
    }
  });

  it('does not move an NOC date to another date field once it could be the date of incorporation', async () => {
    const { provider, seen } = chooser({ Date: 'pre-7.incorpDocsSigningDate' });
    const { placed, unplaced } = await placeValues([{ result: read('noc', [value('Date', '10 November 2026')]), attachment: file('a1', 'Office NOC.pdf') }], { instruction: '', provider, model: 'm' });
    expect(placed).toEqual([]);
    expect(seen).toHaveLength(0);
    expect(unplaced[0]).toMatch(/^Date: 10 November 2026 \("Date of incorporation" is taken only from/);
  });

  it('does not offer the chooser a field the file may not fill', async () => {
    const { provider, seen } = chooser({ Date: 'company.incorporation_date' });
    await placeValues([{ result: read('noc', [value('Date', '10 November 2026')]), attachment: file('a1', 'Office NOC.pdf') }], { instruction: '', provider, model: 'm' });
    expect(JSON.stringify(seen.map((r) => r.messages))).not.toContain('company.incorporation_date');
  });

  it('never takes an address as the nature of possession, but takes "rented" from the NOC', async () => {
    const { provider } = chooser({ 'Premises address': 'gst.possession', Premises: 'gst.possession' });
    const { placed, unplaced } = await placeValues(
      [{ result: read('noc', [value('Premises address', ADDRESS), value('Nature of possession of the premises', 'Rented')]), attachment: file('a1', 'Quarry office NOC.eml') }],
      { instruction: '', provider, model: 'm' },
    );
    const possession = placed.filter((p) => p.entry.key === 'gst.possession');
    expect(possession.map((p) => p.value.value)).toEqual(['Rented']);
    expect(unplaced.join('\n')).not.toMatch(/Nature of possession of the premises: Rented/);
    expect(placementRefusal(catalogEntry('gst.possession')!, ADDRESS, null)).toMatch(/does not say how the premises are held/);
    expect(placementRefusal(catalogEntry('gst.possession')!, 'Owned', { docType: 'pan_card', fileName: 'pan.jpg' })).toMatch(/not from a PAN card/);
  });
});

describe('two documents give the business description', () => {
  const RESOLUTION_TEXT = 'The subsidiary will build and operate a cloud platform for quarry and mining companies.';
  const MAIN_OBJECTS = 'To develop, license, host and maintain software platforms for quarries and mines.';

  it('keeps the resolution description and offers the MOA main objects beside it, whatever order the files came in', async () => {
    const { provider } = chooser({});
    const { placed } = await placeValues(
      [
        { result: read('moa', [value('Main objects', MAIN_OBJECTS, { targetKey: 'company.main_objects', quote: 'objects to be pursued' })]), attachment: file('m', 'Quarry MOA.pdf') },
        { result: read('board_resolution', [value('Business description', RESOLUTION_TEXT, { targetKey: 'company.business_description', quote: 'carry on the business' })]), attachment: file('b', 'Quarry Board Resolution.docx') },
      ],
      { instruction: '', provider, model: 'm' },
    );
    expect(placed.map((p) => p.value.value)).toEqual([RESOLUTION_TEXT, MAIN_OBJECTS]);
    const { draft } = planRows({
      role: 'intern',
      engagementId: 'e',
      companyName: 'Quarry',
      engagement: { ownershipType: 'foreign' },
      state: { 'pre-1': { status: 'in-progress', responses: {} } } as never,
      placed,
      instruction: '',
    });
    const row = draft.rows.find((r) => r.label === 'Business description')!;
    expect(row.newValue).toBe(RESOLUTION_TEXT);
    expect(row.checks).toContainEqual({ rule: 'documents_differ', ok: false, message: `Quarry MOA.pdf says ${MAIN_OBJECTS}`, choice: MAIN_OBJECTS });
  });

  it('offers no choice for a sensitive fact, only the masked difference', async () => {
    const pan = (v: string, id: string) => ({ result: read('pan_card', [value('PAN', v, { person: 'Asha Rao' })]), attachment: file(id, `${id}.jpg`) });
    const { placed } = await placeValues([pan('ABCDE1234F', 'p1'), pan('ABCDE1234G', 'p2')], { instruction: '', provider: chooser({}).provider, model: 'm' });
    const { draft } = planRows({ role: 'intern', engagementId: 'e', companyName: 'Q', engagement: { ownershipType: 'indian' }, state: {} as never, placed, instruction: '' });
    const differ = draft.rows.flatMap((r) => r.checks).find((c) => c.rule === 'documents_differ')!;
    expect(differ.choice).toBeUndefined();
    expect(differ.message).not.toContain('ABCDE1234G');
  });
});

describe('summarySupport', () => {
  const RESOLUTION = 'RESOLVED FURTHER THAT the proposed subsidiary shall carry on the business of developing, licensing and supporting enterprise software for logistics companies, and providing consulting and maintenance services in India.';
  it('counts a summary in plain sentences as the resolution\'s own words', () => {
    expect(summarySupport('The company will develop, license and support enterprise software for logistics companies and provide consulting and maintenance services in India.', RESOLUTION)).toBeGreaterThanOrEqual(0.9);
  });
  it('still rejects a summary the document does not support', () => {
    expect(summarySupport('The company will manufacture pharmaceutical tablets and vaccines for hospitals across Europe.', RESOLUTION)).toBeLessThan(0.3);
  });
});

