import { describe, expect, it } from 'vitest';
import {
  formatKnowledgeBankCommandHit,
  knowledgeBankFileMatchesQuery,
  knowledgeBankLocationLabel,
} from '@/lib/knowledge-bank-search';

const gstReturn = {
  title: 'GSTR-1 template',
  fileName: 'GSTR-1.pdf',
  description: 'Monthly return',
  folderPath: 'Policies / GST',
};

describe('knowledge bank filename search', () => {
  it('matches file name, title, and folder path', () => {
    expect(knowledgeBankFileMatchesQuery(gstReturn, 'gstr-1')).toBe(true);
    expect(knowledgeBankFileMatchesQuery(gstReturn, 'template')).toBe(true);
    expect(knowledgeBankFileMatchesQuery(gstReturn, 'policies')).toBe(true);
    expect(knowledgeBankFileMatchesQuery(gstReturn, 'epfo')).toBe(false);
  });

  it('shows folder path as location when present', () => {
    expect(knowledgeBankLocationLabel(gstReturn)).toBe('Policies / GST');
    expect(knowledgeBankLocationLabel({ folderPath: '' })).toBe('Knowledge Bank');
    expect(formatKnowledgeBankCommandHit(gstReturn)).toBe(
      'GSTR-1.pdf — Knowledge Bank · Policies / GST',
    );
  });
});
