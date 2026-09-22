import { describe, expect, it } from 'vitest';

import { docPackItemUrl, docPackPagePath, docPackStepPath, docPackZipUrl, parseDocPart } from '@/lib/doc-pack/paths';

const project = { id: 'eng-1', slug: 'pexpo-inc' };

describe('doc-pack paths', () => {
  it('opens the pack under the lead, manager and admin shells', () => {
    expect(docPackPagePath(project, 'intern')).toBe('/app/intern/engagements/pexpo-inc/documents');
    expect(docPackPagePath(project, '/app/manager', 'part-b')).toBe(
      '/app/manager/projects/pexpo-inc/documents?part=part-b',
    );
    expect(docPackPagePath(project, 'admin')).toBe('/app/admin/projects/pexpo-inc/documents');
    expect(docPackPagePath(project, '/app/super')).toBe('/app/admin/projects/pexpo-inc/documents');
  });

  it('links a missing input to its step and section tab', () => {
    expect(docPackStepPath(project, 'intern', 'pre-14', 'registered-office')).toBe(
      '/app/intern/engagements/pexpo-inc/step/registered-office-address?tab=registered-office',
    );
    expect(docPackStepPath(project, '/app/manager', 'pre-2')).toBe(
      '/app/manager/projects/pexpo-inc/step/board-resolution-draft',
    );
  });

  it('encodes item keys in API urls', () => {
    expect(docPackItemUrl('eng-1', 'dir-2:non-resident')).toBe('/api/engagements/eng-1/doc-pack/dir-2%3Anon-resident');
    expect(docPackItemUrl('eng-1', 'moa:company', true)).toBe('/api/engagements/eng-1/doc-pack/moa%3Acompany?preview=1');
    expect(docPackZipUrl('eng-1')).toBe('/api/engagements/eng-1/doc-pack/zip');
  });

  it('accepts only the two parts', () => {
    expect(parseDocPart('part-a')).toBe('part-a');
    expect(parseDocPart('part-c')).toBeNull();
    expect(parseDocPart(null)).toBeNull();
  });
});
