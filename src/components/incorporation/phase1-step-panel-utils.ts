import type { ChecklistItemResponses } from '@/lib/checklist-responses';

export type OtherDraftDocLink = { path: string; label: string };

export function buildPre7NonIncorpDraftDocLinks(responses: ChecklistItemResponses): OtherDraftDocLink[] {
  return [
    { path: responses.boardResolutionDraftForIncorpUrl?.trim() ?? '', label: 'Board Resolution draft' },
  ].filter((d) => d.path);
}
