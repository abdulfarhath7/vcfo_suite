import { describe, expect, it } from 'vitest';

import {
  collectMergeTagRuns,
  ensureYellowHighlightOnMergeTagRuns,
  injectYellowTagsByGroup,
  isYellowRun,
  makeTaggedRun,
  mergeTagRunsLackYellow,
} from '../../../scripts/incorp-docx-prepare-utils.mjs';

const yellowRun =
  '<w:r w:rsidR="1"><w:rPr><w:highlight w:val="yellow"/></w:rPr><w:t>Sample</w:t></w:r>';
const plainRun = '<w:r w:rsidR="1"><w:rPr/><w:t>Plain</w:t></w:r>';

describe('incorp-docx-prepare-utils', () => {
  it('makeTaggedRun preserves yellow highlight from sample run', () => {
    const tagged = makeTaggedRun(yellowRun, 'PROPOSED_COMPANY_NAME');
    expect(tagged).toContain('{PROPOSED_COMPANY_NAME}');
    expect(isYellowRun(tagged)).toBe(true);
  });

  it('injectYellowTagsByGroup replaces yellow groups with tagged placeholders', () => {
    const xml = `<w:document><w:body>${yellowRun}${plainRun}</w:body></w:document>`;
    const out = injectYellowTagsByGroup(xml, ['PROPOSED_COMPANY_NAME']);
    expect(out).toContain('{PROPOSED_COMPANY_NAME}');
    expect(out).not.toContain('>Sample<');
    const tagRun = out.match(/<w:r[\s\S]*?\{PROPOSED_COMPANY_NAME\}[\s\S]*?<\/w:r>/)?.[0] ?? '';
    expect(isYellowRun(tagRun)).toBe(true);
  });

  it('ensureYellowHighlightOnMergeTagRuns adds yellow when missing', () => {
    const xml = '<w:r><w:rPr/><w:t>{DOCUMENT_DATE}</w:t></w:r>';
    const out = ensureYellowHighlightOnMergeTagRuns(xml);
    expect(mergeTagRunsLackYellow(out)).toBe(false);
    expect(collectMergeTagRuns(out).every((run) => isYellowRun(run.xml))).toBe(true);
  });
});
