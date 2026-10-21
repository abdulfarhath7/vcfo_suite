import { useCallback, useRef } from 'react';
import type { ChecklistItemResponses } from '@/lib/checklist/checklist-responses';
import type { ChecklistItemState } from '@/context/AppContext';
import type { Engagement } from '@/data/engagements';
import { fetchChecklistState } from '@/lib/projects/engagements-db';
import { toastError, errorMessage } from '@/lib/toast-errors';
import { EMPTY_CHECKLIST_STATE, type AppProviderStore } from './state';
import type { ActivityFeed } from './use-activity-feed';

type ChecklistStateParams = Pick<AppProviderStore, 'engagements' | 'dbChecklistState' | 'setDbChecklistState'> &
  Pick<ActivityFeed, 'handleChecklistStateDiff'>;

/** Read access to the per-engagement checklist state, plus refresh and local merge. */
export function useChecklistState({
  engagements,
  dbChecklistState,
  setDbChecklistState,
  handleChecklistStateDiff,
}: ChecklistStateParams) {
  const dbChecklistRef = useRef(dbChecklistState);
  dbChecklistRef.current = dbChecklistState;

  const resolveEngagementForScope = useCallback(
    (scopeId: string): Engagement | undefined => {
      return (
        engagements.find((e) => e.id === scopeId) ??
        engagements.find((e) => e.clientId === scopeId) ??
        undefined
      );
    },
    [engagements],
  );

  const refreshEngagementChecklist = useCallback(
    async (engagementId: string) => {
      try {
        const cs = await fetchChecklistState(engagementId);
        const eng = engagements.find((e) => e.id === engagementId);
        if (eng) {
          handleChecklistStateDiff(eng, dbChecklistRef.current[engagementId], cs);
        }
        setDbChecklistState((prev) => ({ ...prev, [engagementId]: cs }));
      } catch (err) {
        toastError(
          "Couldn't load checklist answers",
          errorMessage(err, 'Refresh the page or try again in a moment.'),
        );
      }
    },
    [engagements, handleChecklistStateDiff, setDbChecklistState],
  );

  const mergeEngagementChecklistResponses = useCallback(
    (engagementId: string, itemId: string, responses: ChecklistItemResponses) => {
      if (Object.keys(responses).length === 0) return;
      setDbChecklistState((prev) => {
        const previous = prev[engagementId] ?? {};
        return {
          ...prev,
          [engagementId]: {
            ...previous,
            [itemId]: {
              status: 'not-started',
              ...previous[itemId],
              responses: {
                ...(previous[itemId]?.responses ?? {}),
                ...responses,
              },
            },
          },
        };
      });
    },
    [setDbChecklistState],
  );

  const engagementChecklist = useCallback(
    (engagement: Engagement): Record<string, ChecklistItemState> => {
      return dbChecklistState[engagement.id] ?? EMPTY_CHECKLIST_STATE;
    },
    [dbChecklistState],
  );

  const getState = useCallback(
    (scopeId: string) => {
      const eng = resolveEngagementForScope(scopeId);
      if (eng) return engagementChecklist(eng);
      return {};
    },
    [resolveEngagementForScope, engagementChecklist],
  );

  return {
    resolveEngagementForScope,
    refreshEngagementChecklist,
    mergeEngagementChecklistResponses,
    engagementChecklist,
    getState,
  };
}
