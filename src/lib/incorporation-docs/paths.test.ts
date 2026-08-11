import { describe, expect, it } from 'vitest';

import {
  incorpDocDownloadFilename,
  incorpDraftDocLabel,
  incorpDraftDocLinksFromPaths,
  incorpDraftDocLinksFromResponses,
  responsePatchFromPaths,
} from '@/lib/incorporation-docs/paths';

describe('responsePatchFromPaths', () => {
  it('maps doc paths to pre-7 draft URL fields', () => {
    const patch = responsePatchFromPaths({
      'dir-2': {
        'non-resident': 'eng/pre-7/nrDirectorDir2DraftUrl/dir-2.docx',
        resident: 'eng/pre-7/residentDirectorDir2DraftUrl/dir-2.docx',
      },
      'pan-undertaking': {
        'non-resident': 'eng/pre-7/nrDirectorPanUndertakingDraftUrl/pan.docx',
      },
    });

    expect(patch).toEqual({
      nrDirectorDir2DraftUrl: 'eng/pre-7/nrDirectorDir2DraftUrl/dir-2.docx',
      residentDirectorDir2DraftUrl: 'eng/pre-7/residentDirectorDir2DraftUrl/dir-2.docx',
      nrDirectorPanUndertakingDraftUrl: 'eng/pre-7/nrDirectorPanUndertakingDraftUrl/pan.docx',
    });
  });
});

const pre6Justin = {
  nrDirectorFirstName: 'Justin',
  nrDirectorMiddleName: 'Cheng',
  nrDirectorLastName: 'Hsu',
};

describe('incorpDraftDocLabel', () => {
  it('appends Pre-6 director display name when provided', () => {
    expect(
      incorpDraftDocLabel('dir-2', 'non-resident', { pre6: pre6Justin }),
    ).toBe('DIR-2 draft — Non-resident Director - Justin Cheng Hsu');
  });

  it('omits suffix when Pre-6 name is empty', () => {
    expect(incorpDraftDocLabel('dir-2', 'non-resident', { pre6: {} })).toBe(
      'DIR-2 draft — Non-resident Director',
    );
  });

  it('labels company-level drafts without director suffix', () => {
    expect(incorpDraftDocLabel('moa', 'company')).toBe('MOA draft');
  });
});

describe('incorpDocDownloadFilename', () => {
  it('appends slugified director name to base filename', () => {
    expect(
      incorpDocDownloadFilename('dir-2', 'non-resident', { pre6: pre6Justin }),
    ).toBe('dir-2-non-resident-director-justin-cheng-hsu.docx');
  });
});

describe('incorpDraftDocLinksFromResponses', () => {
  it('builds labeled download links from flat responses', () => {
    const links = incorpDraftDocLinksFromResponses({
      nrDirectorDir8DraftUrl: 'path/dir-8-nr.docx',
    });

    expect(links).toEqual([
      {
        path: 'path/dir-8-nr.docx',
        label: 'DIR-8 draft — Non-resident Director',
        doc: 'dir-8',
        audience: 'non-resident',
      },
    ]);
  });

  it('includes director display name when pre6 is passed', () => {
    const links = incorpDraftDocLinksFromResponses(
      { nrDirectorDir2DraftUrl: 'path/dir-2.docx' },
      { pre6: pre6Justin },
    );

    expect(links[0]?.label).toBe(
      'DIR-2 draft — Non-resident Director - Justin Cheng Hsu',
    );
  });
});

describe('incorpDraftDocLinksFromPaths', () => {
  it('builds links from nested API paths', () => {
    const links = incorpDraftDocLinksFromPaths({
      'inc-9': {
        resident: 'path/inc-9-resident.docx',
      },
    });

    expect(links).toEqual([
      {
        path: 'path/inc-9-resident.docx',
        label: 'INC-9 draft — Resident Director',
        doc: 'inc-9',
        audience: 'resident',
      },
    ]);
  });
});
