import PizZip from 'pizzip';
import { describe, expect, it, vi } from 'vitest';

import type { Engagement } from '@/data/engagements';
import { validateIncorpDocsGeneration } from '@/lib/api/incorporation-docs-errors';
import { evaluateDocPack } from '@/lib/doc-pack/evaluate';
import { FINALIZED_BR, director, fullState } from '@/lib/doc-pack/__tests__/fixtures';
import { renderIncorpDocxBuffer } from '@/lib/incorporation-docs/docx';
import { incorpDocDownloadFilename, incorpDraftDocSlotsFromResponses } from '@/lib/incorporation-docs/paths';
import { directorResponsesFromState } from '@/lib/proposed-directors';

/**
 * Parity: a document served by the pack is the document the Pre-7 panel
 * generates — same generator, same inputs. The Pre-7 side below is the body
 * of `generateAndStoreIncorpDocs` minus the S3 upload and checklist patch.
 */

vi.mock('server-only', () => ({}));
// The service module also exports the route guard; neither is exercised here.
vi.mock('@/auth/guards', () => ({ requireAnyRole: async () => ({ ok: false, status: 403, error: 'stub' }) }));
vi.mock('@/db/repositories/doc-pack', () => ({
  getDocPackInputs: async () => ({ ok: false, status: 403, error: 'forbidden' }),
}));

const { renderDocPackItem } = await import('@/lib/api/doc-pack');

const ENGAGEMENT: Engagement = {
  id: 'eng-1',
  slug: 'test-company',
  clientId: 'client-1',
  companyName: 'Test Company Private Limited',
  companyType: 'foreign',
  internId: 'lead-1',
  adminId: 'admin-1',
  createdAt: '2026-09-01T00:00:00.000Z',
  stage: 'Pre-Incorporation',
  health: 'on-track',
  parentEntityName: 'Test Parent Inc',
  parentEntityAddress: '100 Parent Road, Salt Lake City, Utah, USA',
};

/** Body text with the generation date removed (the only value that differs between two renders). */
function textOf(docx: Buffer): string {
  const xml = new PizZip(docx).file('word/document.xml')?.asText() ?? '';
  return xml
    .replace(/<[^>]+>/g, '')
    .replace(/\d{1,2}(st|nd|rd|th)?\s+[A-Z][a-z]+\s+\d{4}/g, '<date>')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('document pack ↔ Pre-7 panel parity', () => {
  const checklistState = fullState([director('e1', 'no', 'Alpha'), director('e2', 'yes', 'Beta')]);
  const inputs = { dbId: 'eng-1', engagement: ENGAGEMENT, checklistState, brRow: FINALIZED_BR };
  const summary = evaluateDocPack({ state: checklistState, brRow: FINALIZED_BR, engagement: ENGAGEMENT });
  const incorpItems = summary.items.filter((item) => item.generate.kind === 'incorp');

  it('covers exactly the Pre-7 draft slots', () => {
    const slots = incorpDraftDocSlotsFromResponses({}).map((s) => `${s.doc}:${s.audience}`).sort();
    expect(incorpItems.map((item) => item.key).sort()).toEqual(slots);
  });

  it('renders each document with the Pre-7 generator and inputs, under the Pre-7 filename', async () => {
    expect(incorpItems.every((item) => item.status === 'ready' && item.source === 'generated')).toBe(true);
    for (const item of incorpItems) {
      if (item.generate.kind !== 'incorp') continue;
      const { doc } = item.generate;

      // Pre-7 panel path.
      const { pre1, pre5, pre6 } = validateIncorpDocsGeneration({
        engagement: ENGAGEMENT,
        checklistState,
        docs: [doc],
        directors: [item.audience],
      });
      const fromPanel = renderIncorpDocxBuffer(doc, { engagement: ENGAGEMENT, pre1, pre5, pre6, director: item.audience });
      const panelFilename = incorpDocDownloadFilename(doc, item.audience, {
        pre6: directorResponsesFromState(checklistState).pre6,
      });

      // Pack path.
      const fromPack = await renderDocPackItem(inputs, item);

      expect(fromPack.filename, item.key).toBe(panelFilename);
      expect(textOf(fromPack.buffer), item.key).toBe(textOf(fromPanel));
      expect(textOf(fromPack.buffer).length, item.key).toBeGreaterThan(50);
    }
  });
});
