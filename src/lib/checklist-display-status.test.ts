import { describe, expect, it } from 'vitest';
import { getItem } from '@/data/checklist';
import {
  clientProgressToneToStatusCode,
  deriveChecklistDisplayStatus,
} from '@/lib/checklist-display-status';

describe('deriveChecklistDisplayStatus', () => {
  const pre2 = getItem('pre-2')!;

  it('maps finalized board resolution to completed', () => {
    expect(
      deriveChecklistDisplayStatus('pre-2', pre2, { status: 'not-started' }, {
        status: 'finalized',
        hasDraftDoc: true,
      }),
    ).toBe('completed');
  });

  it('coerces invalid stored status for post-inc items', () => {
    const post1 = getItem('post-1')!;
    expect(
      deriveChecklistDisplayStatus('post-1', post1, {
        status: 'reviewing' as 'not-started',
      }),
    ).toBe('not-started');
  });

  it('maps filled intern milestone fields to in-progress', () => {
    expect(
      deriveChecklistDisplayStatus(
        'pre-2',
        pre2,
        {
          status: 'not-started',
          responses: {
            boardResolutionDraftGeneratedAt: '2026-05-01',
            boardResolutionSharedAt: '2026-05-02',
            boardResolutionWorkflowNotes: 'Released to client',
          },
        },
        { status: 'none', hasDraftDoc: false },
      ),
    ).toBe('in-progress');
  });
});

describe('clientProgressToneToStatusCode', () => {
  it('maps tones to checklist status codes', () => {
    expect(clientProgressToneToStatusCode('completed')).toBe('completed');
    expect(clientProgressToneToStatusCode('in-progress')).toBe('in-progress');
    expect(clientProgressToneToStatusCode('not-started')).toBe('not-started');
  });
});
