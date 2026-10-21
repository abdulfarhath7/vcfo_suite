import type { QueryClient } from '@tanstack/react-query';
import type { AppContextValue } from '@/context/AppContext';
import type { Engagement } from '@/data/engagements';
import type { AuthUser } from '@/lib/auth';
import {
  patchChecklistItemInDb,
  fetchEngagementByClientUser,
  fetchChecklistState,
  ChecklistSaveError,
  type EngagementChecklistState,
  submitChecklistItemInDb,
  submitDirectStepInDb,
  setChecklistUnlockedFieldsInDb,
  reviewChecklistItemInDb,
  setClientFillRequestInDb,
} from '@/lib/projects/engagements-db';
import {
  findEngagementForClientUser,
  engagementScopeIds,
} from '@/lib/checklist/checklist-state-key';
import { checklistItemLabel } from '@/lib/audit/audit-log';
import type { AppProviderStore } from './state';
import type { NotificationActions } from './use-notifications';
import type { ActivityFeed } from './use-activity-feed';

type ChecklistMutationDeps = {
  user: AuthUser | null;
  queryClient: QueryClient;
  resolveEngagementForScope: (scopeId: string) => Engagement | undefined;
} & Pick<AppProviderStore, 'engagements' | 'setEngagements' | 'dbChecklistState' | 'setDbChecklistState'> &
  Pick<NotificationActions, 'suppressChecklistNotification'> &
  Pick<ActivityFeed, 'pushActivity'>;

export type ChecklistMutations = Pick<
  AppContextValue,
  | 'updateItem'
  | 'submitChecklistItem'
  | 'submitDirectStep'
  | 'setUnlockedFields'
  | 'reviewChecklistItem'
  | 'setClientFillRequest'
>;

/**
 * Checklist writes: save answers (optimistic, rolled back on failure), client
 * submit, direct-flow submit, field unlocks, review, and client fill requests.
 * Built inside the provider's `useMemo`, so these are re-created exactly when
 * the context value is.
 */
export function createChecklistMutations({
  user,
  engagements,
  setEngagements,
  dbChecklistState,
  setDbChecklistState,
  resolveEngagementForScope,
  queryClient,
  suppressChecklistNotification,
  pushActivity,
}: ChecklistMutationDeps): ChecklistMutations {
  return {
    updateItem: async (scopeId, itemId, patch, options) => {
      let engagement: Engagement | undefined;

      if (user?.role === 'client') {
        engagement = findEngagementForClientUser(engagements, user);
        if (!engagement) {
          const fromDb = await fetchEngagementByClientUser(user.id, user.clientId);
          if (fromDb) {
            engagement = fromDb;
            setEngagements((prev) =>
              prev.some((e) => e.id === fromDb.id) ? prev : [fromDb, ...prev],
            );
            const cs = await fetchChecklistState(fromDb.id);
            setDbChecklistState((prev) => ({ ...prev, [fromDb.id]: cs }));
          }
        }
        if (!engagement) {
          throw new Error('Could not find your project. Refresh the page and try again.');
        }
        const allowed = engagementScopeIds(engagement, user.clientId);
        if (!allowed.includes(scopeId)) {
          throw new Error('Could not save — project scope mismatch. Refresh and try again.');
        }
        if (!options?.clientResponsesOnly || patch.responses === undefined) return;
        patch = { responses: patch.responses };
      } else {
        engagement = resolveEngagementForScope(scopeId);
      }

      if (!engagement) {
        throw new Error('Could not save checklist changes. Try again.');
      }

      const engagementId = engagement.id;
      const { resendManagerEmail: _resendManagerEmail, ...statePatch } = patch;
      const previous = dbChecklistState[engagementId] ?? {};
      const optimistic: EngagementChecklistState = {
        ...previous,
        [itemId]: {
          status: 'not-started',
          ...previous[itemId],
          ...statePatch,
          ...(statePatch.responses
            ? {
                responses: {
                  ...(previous[itemId]?.responses ?? {}),
                  ...statePatch.responses,
                },
              }
            : {}),
        },
      };
      setDbChecklistState((prev) => ({ ...prev, [engagementId]: optimistic }));

      try {
        const saved = await patchChecklistItemInDb(engagementId, itemId, patch, {
          keepalive: options?.keepalive,
        });
        setDbChecklistState((prev) => ({ ...prev, [engagementId]: saved }));
        // The document pack reads the same answers; let its card refresh.
        void queryClient.invalidateQueries({ queryKey: ['doc-pack', engagementId] });
        if (patch.reviewSource === 'lead_manager_request') {
          suppressChecklistNotification(engagementId, itemId, 'checklist.submit');
        }
      } catch (err) {
        setDbChecklistState((prev) => ({ ...prev, [engagementId]: previous }));
        const message =
          err instanceof ChecklistSaveError
            ? err.code
              ? `${err.message} (${err.code})`
              : err.message
            : err instanceof Error
              ? err.message
              : 'Could not sync answers to the server. Try again.';
        if (process.env.NODE_ENV === 'development') {
          console.error('[checklist] save failed', { engagementId, itemId, error: err });
        }
        throw new Error(message, { cause: err });
      }
    },
    submitChecklistItem: async (scopeId, itemId, responses) => {
      if (user?.role !== 'client') {
        throw new Error('Only clients can submit milestone responses.');
      }

      let engagement = findEngagementForClientUser(engagements, user);
      if (!engagement) {
        const fromDb = await fetchEngagementByClientUser(user.id, user.clientId);
        if (fromDb) {
          engagement = fromDb;
          setEngagements((prev) =>
            prev.some((e) => e.id === fromDb.id) ? prev : [fromDb, ...prev],
          );
        }
      }
      if (!engagement) {
        throw new Error('Could not find your project. Refresh the page and try again.');
      }
      const allowed = engagementScopeIds(engagement, user.clientId);
      if (!allowed.includes(scopeId)) {
        throw new Error('Could not submit — project scope mismatch.');
      }

      const engagementId = engagement.id;
      const previous = dbChecklistState[engagementId] ?? {};
      try {
        const saved = await submitChecklistItemInDb(engagementId,
          itemId,
          responses,
        );
        setDbChecklistState((prev) => ({ ...prev, [engagementId]: saved }));
        suppressChecklistNotification(engagementId, itemId, 'checklist.submit');
        pushActivity({
          actor: user?.name || 'Client',
          verb: 'submitted for review',
          target: checklistItemLabel(itemId),
          engagementId,
        });
      } catch (err) {
        setDbChecklistState((prev) => ({ ...prev, [engagementId]: previous }));
        const message =
          err instanceof ChecklistSaveError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Could not submit answers. Try again.';
        throw new Error(message, { cause: err });
      }
    },
    submitDirectStep: async (scopeId, itemId, responses) => {
      const engagement =
        user?.role === 'client' ? findEngagementForClientUser(engagements, user) : resolveEngagementForScope(scopeId);
      if (!engagement) {
        throw new Error('Could not find this project. Refresh the page and try again.');
      }
      if (user?.role === 'client' && !engagementScopeIds(engagement, user.clientId).includes(scopeId)) {
        throw new Error('Could not submit — project scope mismatch.');
      }
      const engagementId = engagement.id;
      try {
        const result = await submitDirectStepInDb(engagementId, itemId, responses);
        if (result.checklistState) {
          const saved = result.checklistState;
          setDbChecklistState((prev) => ({ ...prev, [engagementId]: saved }));
        }
        void queryClient.invalidateQueries({ queryKey: ['doc-pack', engagementId] });
        if (result.outcome === 'invalid') {
          return { outcome: 'invalid', fieldErrors: result.fieldErrors };
        }
        suppressChecklistNotification(engagementId, itemId, 'checklist.submit');
        pushActivity({
          actor: user?.name || 'VCFO Team',
          verb: result.outcome === 'waiting_on_lead' ? 'submitted their part of' : 'submitted',
          target: checklistItemLabel(itemId),
          engagementId,
        });
        return { outcome: result.outcome };
      } catch (err) {
        const message =
          err instanceof ChecklistSaveError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Could not submit this step. Try again.';
        throw new Error(message, { cause: err });
      }
    },
    setUnlockedFields: async (scopeId, itemId, fieldIds) => {
      if (user?.role === 'client') {
        throw new Error('Clients cannot unlock fields.');
      }
      const engagement = resolveEngagementForScope(scopeId);
      if (!engagement) {
        throw new Error('Could not update field access. Try again.');
      }

      const engagementId = engagement.id;
      const previous = dbChecklistState[engagementId] ?? {};
      try {
        const saved = await setChecklistUnlockedFieldsInDb(engagementId,
          itemId,
          fieldIds,
        );
        setDbChecklistState((prev) => ({ ...prev, [engagementId]: saved }));
      } catch (err) {
        setDbChecklistState((prev) => ({ ...prev, [engagementId]: previous }));
        const message =
          err instanceof ChecklistSaveError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Could not update field access. Try again.';
        throw new Error(message, { cause: err });
      }
    },
    reviewChecklistItem: async (scopeId, itemId, action, note) => {
      if (user?.role === 'client') {
        throw new Error('Clients cannot review submissions.');
      }
      const engagement = resolveEngagementForScope(scopeId);
      if (!engagement) {
        throw new Error('Could not update review. Try again.');
      }

      const engagementId = engagement.id;
      const previous = dbChecklistState[engagementId] ?? {};
      try {
        const saved = await reviewChecklistItemInDb(engagementId,
          itemId,
          action,
          note,
        );
        setDbChecklistState((prev) => ({ ...prev, [engagementId]: saved }));
        suppressChecklistNotification(engagementId, itemId, 'checklist.review');
        pushActivity({
          actor: user?.name || 'VCFO Team',
          verb: action === 'accept' ? 'accepted' : 'rejected',
          target: checklistItemLabel(itemId),
          engagementId,
        });
      } catch (err) {
        setDbChecklistState((prev) => ({ ...prev, [engagementId]: previous }));
        const message =
          err instanceof ChecklistSaveError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Could not update review. Try again.';
        throw new Error(message, { cause: err });
      }
    },
    setClientFillRequest: async (scopeId, itemId, action, note) => {
      if (user?.role === 'client') {
        throw new Error('Clients cannot manage fill requests.');
      }
      const engagement = resolveEngagementForScope(scopeId);
      if (!engagement) {
        throw new Error('Could not send the request. Try again.');
      }

      const engagementId = engagement.id;
      const previous = dbChecklistState[engagementId] ?? {};
      try {
        const saved = await setClientFillRequestInDb(engagementId, itemId, action, note);
        setDbChecklistState((prev) => ({ ...prev, [engagementId]: saved }));
        pushActivity({
          actor: user?.name || 'VCFO Team',
          verb:
            action === 'request'
              ? 'requested client input on'
              : action === 'approve'
                ? 'sent the client a request for'
                : 'declined a client request for',
          target: checklistItemLabel(itemId),
          engagementId,
        });
      } catch (err) {
        setDbChecklistState((prev) => ({ ...prev, [engagementId]: previous }));
        const message =
          err instanceof ChecklistSaveError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Could not send the request. Try again.';
        throw new Error(message, { cause: err });
      }
    },
  };
}
