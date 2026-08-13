import { describe, expect, it } from 'vitest';

import {
  buildBoardResolutionPreviewError,
  isDocxXmlParseError,
} from '@/lib/board-resolution-preview-errors';

describe('isDocxXmlParseError', () => {
  it('detects duplicate xml:space attribute errors', () => {
    expect(
      isDocxXmlParseError(
        "Attribute xml:space redefined at line 12, column 40",
      ),
    ).toBe(true);
  });
});

describe('buildBoardResolutionPreviewError', () => {
  it('returns corrupt_xml guidance for parser failures', () => {
    const err = buildBoardResolutionPreviewError(
      'Attribute xml:space redefined at line 2',
    );
    expect(err.kind).toBe('corrupt_xml');
    expect(err.title).toBe('The stored document could not be previewed');
    expect(err.downloadMayWork).toBe(true);
    expect(err.steps.some((s) => s.includes('Apply latest template'))).toBe(true);
  });

  it('maps 404 to not_found', () => {
    const err = buildBoardResolutionPreviewError('Word document has not been generated yet.', {
      httpStatus: 404,
    });
    expect(err.kind).toBe('not_found');
  });
});
