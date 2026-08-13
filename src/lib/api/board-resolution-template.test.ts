import { describe, expect, it } from 'vitest';
import {
  boardResolutionNeedsTemplateRefresh,
  boardResolutionRootSourceNewerThanTemplate,
  parseBoardResolutionUpdatedAtMs,
} from '@/lib/api/board-resolution-template';

const currentFingerprint = 'abc123';
const draftDoc = {
  status: 'draft' as const,
  storagePath: 'engagements/e1/board-resolution.docx',
  templateFingerprint: currentFingerprint,
  updatedAt: '2026-05-20T10:00:00.000Z',
};

describe('parseBoardResolutionUpdatedAtMs', () => {
  it('parses Postgres timestamps with sub-millisecond fractions', () => {
    expect(parseBoardResolutionUpdatedAtMs('2026-05-26T11:04:30.44529+00:00')).toBe(
      Date.parse('2026-05-26T11:04:30.445Z'),
    );
  });

  it('returns null for empty values', () => {
    expect(parseBoardResolutionUpdatedAtMs(null)).toBeNull();
    expect(parseBoardResolutionUpdatedAtMs('')).toBeNull();
  });
});

describe('boardResolutionRootSourceNewerThanTemplate', () => {
  it('returns true when root source mtime is newer', () => {
    expect(
      boardResolutionRootSourceNewerThanTemplate({
        modifiedAtMs: 100,
        rootSourceModifiedAtMs: 200,
      }),
    ).toBe(true);
  });

  it('returns false when root source is missing or older', () => {
    expect(
      boardResolutionRootSourceNewerThanTemplate({
        modifiedAtMs: 200,
        rootSourceModifiedAtMs: null,
      }),
    ).toBe(false);
    expect(
      boardResolutionRootSourceNewerThanTemplate({
        modifiedAtMs: 200,
        rootSourceModifiedAtMs: 100,
      }),
    ).toBe(false);
  });
});

describe('boardResolutionNeedsTemplateRefresh', () => {
  it('returns false for finalized docs', () => {
    expect(
      boardResolutionNeedsTemplateRefresh(
        { ...draftDoc, status: 'finalized' },
        currentFingerprint,
      ),
    ).toBe(false);
  });

  it('returns false when there is no stored docx path', () => {
    expect(
      boardResolutionNeedsTemplateRefresh(
        { ...draftDoc, storagePath: null },
        currentFingerprint,
      ),
    ).toBe(false);
  });

  it('returns true when the stored fingerprint is missing', () => {
    expect(
      boardResolutionNeedsTemplateRefresh(
        { ...draftDoc, templateFingerprint: null },
        currentFingerprint,
      ),
    ).toBe(true);
  });

  it('returns true when the stored fingerprint does not match', () => {
    expect(
      boardResolutionNeedsTemplateRefresh(
        { ...draftDoc, templateFingerprint: 'old-hash' },
        currentFingerprint,
      ),
    ).toBe(true);
  });

  it('returns true when the template file is newer than the stored doc', () => {
    expect(
      boardResolutionNeedsTemplateRefresh(
        draftDoc,
        currentFingerprint,
        Date.parse('2026-05-25T15:40:09.102Z'),
      ),
    ).toBe(true);
  });

  it('returns true when root source is newer than the deployed public template', () => {
    expect(
      boardResolutionNeedsTemplateRefresh(draftDoc, currentFingerprint, undefined, {
        rootSourceNewerThanTemplate: true,
      }),
    ).toBe(true);
  });

  it('returns false when fingerprint matches and template is not newer', () => {
    expect(
      boardResolutionNeedsTemplateRefresh(
        draftDoc,
        currentFingerprint,
        Date.parse('2026-05-19T10:00:00.000Z'),
      ),
    ).toBe(false);
  });

  it('parses Postgres updatedAt when comparing template mtime', () => {
    expect(
      boardResolutionNeedsTemplateRefresh(
        { ...draftDoc, updatedAt: '2026-05-26T11:04:30.44529+00:00' },
        currentFingerprint,
        Date.parse('2026-05-26T11:04:30.446Z'),
      ),
    ).toBe(true);
  });
});
