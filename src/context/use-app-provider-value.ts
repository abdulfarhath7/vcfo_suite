/*
 * App provider value — Auth.js session + TanStack Query over API/repositories.
 * Tasks, requests, invites, activity, and notifications are Postgres-backed
 * (Phase 2). Clients still use localStorage seeds until a clients API exists.
 */
"use client";

import {
  useEffect,
  useMemo,
  useReducer,
  useCallback,
  useRef,
  type SetStateAction,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Client, clients as seedClients } from '@/data/mockData';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import type { AppContextValue, ChecklistItemState } from '@/context/AppContext';
import { applySidebarCollapsed } from '@/components/shell/intern-sidebar';
import {
  Engagement,
  TaskInstance,
  DocRequest,
  Invite,
  ActivityEvent,
  seedEngagements,
  seedTasksFor,
} from '@/data/engagements';
import {
  AuthUser,
  initialsFromName,
  Role,
  isValidDbRole,
  mapDbRoleToAppRole,
  isAdminOrManager,
  type DbRole,
} from '@/lib/auth';
import { ownAvatarSrc } from '@/lib/account-avatar';
import { getSession, signIn as authJsSignIn, signOut as authJsSignOut } from 'next-auth/react';
import { clearAllStepProgress } from '@/components/admin/step-detail-progress';
import {
  fetchEngagements,
  fetchInternOptions,
  createProjectWithClient,
  updateEngagementInDb,
  patchChecklistItemInDb,
  fetchEngagementByClientUser,
  fetchChecklistState,
  ChecklistSaveError,
  type EngagementChecklistState,
  submitChecklistItemInDb,
  setChecklistUnlockedFieldsInDb,
  reviewChecklistItemInDb,
} from '@/lib/engagements-db';
import {
  findEngagementForClientUser,
  engagementScopeIds,
  normalizeEngagementChecklistState,
} from '@/lib/checklist-state-key';
import { toastError, toastSuccess, errorMessage, toastEmailDispatch, EMAIL_DISPATCH_NOTIFICATIONS_EVENT } from '@/lib/toast-errors';
import type { EmailDispatchResult } from '@/lib/email/email-dispatch';
import { debouncedPersist, read } from '@/lib/storage';
import { useRealtimeEngagements } from '@/lib/supabase/use-realtime-engagements';
import {
  type AppNotification,
  type NotificationKind,
  checklistNotifySuppressKey,
  diffChecklistForNotifications,
} from '@/lib/checklist-notifications';
import {
  isPersistedNotificationId,
  mergeNotificationsByCreatedAt,
} from '@/lib/notification-dismiss';
import { NOTIFICATION_LIVE_POLL_MS } from '@/lib/notification-popup';
import { checklistItemLabel } from '@/lib/audit-log';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401 && typeof window !== 'undefined') {
    // Stale JWT after reseed/delete — clear cookie and bounce to login.
    void authJsSignOut({ callbackUrl: '/login' });
    throw new Error('Not authenticated');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

type SessionUser = {
  id?: string;
  email?: string | null;
  name?: string | null;
  role?: string;
  internId?: string;
  clientId?: string;
  hasAvatar?: boolean;
  avatarVersion?: number;
};

function authUserFromSessionUser(user: SessionUser | undefined): AuthUser | null {
  if (!user?.id || !user.email || !user.role || !isValidDbRole(user.role)) return null;
  const name = user.name?.trim() || user.email.split('@')[0];
  return {
    id: user.id,
    name,
    email: user.email,
    role: mapDbRoleToAppRole(user.role as DbRole),
    initials: initialsFromName(name),
    imageUrl: user.hasAvatar ? ownAvatarSrc(user.avatarVersion) : null,
    clientId: user.clientId,
    internId: user.internId,
  };
}

type AppProviderState = {
  user: AuthUser | null;
  authLoading: boolean;
  clients: Client[];
  engagements: Engagement[];
  tasks: TaskInstance[];
  requests: DocRequest[];
  invites: Invite[];
  activity: ActivityEvent[];
  notifications: AppNotification[];
  sidebarMode: 'auto' | 'open' | 'closed';
  commandOpen: boolean;
  dbChecklistState: Record<string, EngagementChecklistState>;
  selectedClient: Client | null;
};

type AppProviderAction = {
  type: 'patch';
  key: keyof AppProviderState;
  value: SetStateAction<AppProviderState[keyof AppProviderState]>;
};

function createInitialAppProviderState(): AppProviderState {
  return {
    user: null,
    authLoading: true,
    clients: read('vcfo.clients', seedClients),
    engagements: seedEngagements,
    tasks: [],
    requests: [],
    invites: [],
    activity: [],
    notifications: [],
    sidebarMode: 'auto',
    commandOpen: false,
    dbChecklistState: {},
    selectedClient: null,
  };
}

function appProviderReducer(state: AppProviderState, action: AppProviderAction): AppProviderState {
  const prev = state[action.key];
  const next =
    typeof action.value === 'function'
      ? (action.value as (current: typeof prev) => typeof prev)(prev)
      : action.value;
  if (Object.is(prev, next)) return state;
  return { ...state, [action.key]: next };
}



export function useAppProviderValue(): AppContextValue {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(appProviderReducer, undefined, createInitialAppProviderState);
  const {
    user,
    authLoading,
    clients,
    engagements,
    tasks,
    requests,
    invites,
    activity,
    notifications,
    sidebarMode,
    commandOpen,
    dbChecklistState,
    selectedClient,
  } = state;
  const setUser = useCallback((value: SetStateAction<AppProviderState['user']>) => {
    dispatch({ type: 'patch', key: 'user', value });
  }, [dispatch]);
  const setAuthLoading = useCallback((value: SetStateAction<AppProviderState['authLoading']>) => {
    dispatch({ type: 'patch', key: 'authLoading', value });
  }, [dispatch]);
  const setClients = useCallback((value: SetStateAction<AppProviderState['clients']>) => {
    dispatch({ type: 'patch', key: 'clients', value });
  }, [dispatch]);
  const setEngagements = useCallback((value: SetStateAction<AppProviderState['engagements']>) => {
    dispatch({ type: 'patch', key: 'engagements', value });
  }, [dispatch]);
  const setTasks = useCallback((value: SetStateAction<AppProviderState['tasks']>) => {
    dispatch({ type: 'patch', key: 'tasks', value });
  }, [dispatch]);
  const setRequests = useCallback((value: SetStateAction<AppProviderState['requests']>) => {
    dispatch({ type: 'patch', key: 'requests', value });
  }, [dispatch]);
  const setInvites = useCallback((value: SetStateAction<AppProviderState['invites']>) => {
    dispatch({ type: 'patch', key: 'invites', value });
  }, [dispatch]);
  const setActivity = useCallback((value: SetStateAction<AppProviderState['activity']>) => {
    dispatch({ type: 'patch', key: 'activity', value });
  }, [dispatch]);
  const setNotifications = useCallback((value: SetStateAction<AppProviderState['notifications']>) => {
    dispatch({ type: 'patch', key: 'notifications', value });
  }, [dispatch]);
  const setSidebarMode = useCallback((value: SetStateAction<AppProviderState['sidebarMode']>) => {
    dispatch({ type: 'patch', key: 'sidebarMode', value });
  }, [dispatch]);
  const setCommandOpen = useCallback((value: SetStateAction<AppProviderState['commandOpen']>) => {
    dispatch({ type: 'patch', key: 'commandOpen', value });
  }, [dispatch]);
  const setDbChecklistState = useCallback((value: SetStateAction<AppProviderState['dbChecklistState']>) => {
    dispatch({ type: 'patch', key: 'dbChecklistState', value });
  }, [dispatch]);
  const setSelectedClient = useCallback((value: SetStateAction<AppProviderState['selectedClient']>) => {
    dispatch({ type: 'patch', key: 'selectedClient', value });
  }, [dispatch]);

  useEffect(() => debouncedPersist('vcfo.clients', clients), [clients]);

  const notifySuppressRef = useRef<Map<string, number> | null>(null);
  if (!notifySuppressRef.current) {
    notifySuppressRef.current = new Map();
  }
  const dbChecklistRef = useRef(dbChecklistState);
  dbChecklistRef.current = dbChecklistState;

  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const isNotificationSuppressed = useCallback((key: string) => {
    const map = notifySuppressRef.current;
    if (!map) return false;
    const until = map.get(key);
    if (!until) return false;
    if (Date.now() > until) {
      notifySuppressRef.current.delete(key);
      return false;
    }
    return true;
  }, []);

  const suppressChecklistNotification = useCallback(
    (engagementId: string, itemId: string, kind: NotificationKind) => {
      const map = notifySuppressRef.current;
      if (!map) return;
      map.set(
        checklistNotifySuppressKey(engagementId, itemId, kind),
        Date.now() + 4000,
      );
    },
    [],
  );

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    if (user?.id) {
      queryClient.setQueryData(
        ['notifications', user.id, 'history'],
        (old: AppNotification[] | undefined) =>
          old?.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
    }
    void fetchJson('/api/notifications', {
      method: 'POST',
      body: JSON.stringify({ action: 'mark_read', id }),
    }).catch(() => {
      /* optimistic UI; refetch will reconcile */
    });
  }, [queryClient, setNotifications, user?.id]);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    void fetchJson('/api/notifications', {
      method: 'POST',
      body: JSON.stringify({ action: 'mark_all_read' }),
    }).catch(() => {});
  }, [setNotifications]);

  const dismissedIdsRef = useRef(new Set<string>());
  const deleteInflightRef = useRef(new Map<string, Promise<void>>());

  const patchNotificationsCache = useCallback(
    (updater: (prev: AppNotification[]) => AppNotification[]) => {
      if (!user?.id) return;
      queryClient.setQueryData(['notifications', user.id], (old: AppNotification[] | undefined) =>
        updater(old ?? []),
      );
    },
    [queryClient, user?.id],
  );

  const dismissNotifications = useCallback(
    (items: AppNotification[]) => {
      if (items.length === 0) return;
      const idSet = new Set(items.map((n) => n.id));
      for (const id of idSet) dismissedIdsRef.current.add(id);
      setNotifications((prev) => prev.filter((n) => !idSet.has(n.id)));
      patchNotificationsCache((prev) => prev.filter((n) => !idSet.has(n.id)));

      const persistedIds = items.map((n) => n.id).filter(isPersistedNotificationId);
      const request =
        persistedIds.length === 0
          ? Promise.resolve()
          : fetchJson('/api/notifications', {
              method: 'POST',
              body: JSON.stringify({ action: 'dismiss', ids: persistedIds }),
            }).then(() => {
              if (user?.id) {
                void queryClient.invalidateQueries({
                  queryKey: ['notifications', user.id, 'history'],
                });
              }
            });

      const tracked = request.catch(() => {
        for (const id of idSet) dismissedIdsRef.current.delete(id);
        setNotifications((prev) => mergeNotificationsByCreatedAt(prev, items));
        patchNotificationsCache((prev) => mergeNotificationsByCreatedAt(prev, items));
      });
      for (const id of idSet) {
        deleteInflightRef.current.set(
          id,
          tracked.then(() => {
            deleteInflightRef.current.delete(id);
          }),
        );
      }
    },
    [patchNotificationsCache, queryClient, setNotifications, user?.id],
  );

  const restoreNotifications = useCallback(
    (items: AppNotification[]) => {
      if (items.length === 0) return;
      const idSet = new Set(items.map((n) => n.id));
      for (const id of idSet) dismissedIdsRef.current.delete(id);
      const restored = items.map((n) => ({ ...n, dismissedAt: null }));
      setNotifications((prev) => mergeNotificationsByCreatedAt(prev, restored));
      patchNotificationsCache((prev) => mergeNotificationsByCreatedAt(prev, restored));

      const persisted = items.filter((n) => isPersistedNotificationId(n.id));
      if (persisted.length === 0) return;

      void (async () => {
        await Promise.all(
          persisted.map((n) => deleteInflightRef.current.get(n.id) ?? Promise.resolve()),
        );
        try {
          await fetchJson('/api/notifications', {
            method: 'POST',
            body: JSON.stringify({
              action: 'restore',
              ids: persisted.map((n) => n.id),
            }),
          });
          if (user?.id) {
            void queryClient.invalidateQueries({
              queryKey: ['notifications', user.id, 'history'],
            });
          }
        } catch {
          /* optimistic UI; refetch will reconcile */
        }
      })();
    },
    [patchNotificationsCache, queryClient, setNotifications, user?.id],
  );

  const engagementsQuery = useQuery({
    queryKey: ['engagements', user?.id],
    queryFn: async () => fetchEngagements(),
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  const clientHasEngagement = useMemo(() => {
    if (!user || user.role !== 'client' || !engagementsQuery.data) return true;
    return engagementsQuery.data.engagements.some(
      (e) => e.clientUserId === user.id || e.clientId === user.clientId,
    );
  }, [user, engagementsQuery.data]);

  const clientEngagementQuery = useQuery({
    queryKey: ['engagement-by-client', user?.id],
    queryFn: async () => {
      if (!user) return null;
      return fetchEngagementByClientUser(user.id, user.clientId);
    },
    enabled: Boolean(
      user?.role === 'client' &&
        engagementsQuery.isSuccess &&
        !clientHasEngagement,
    ),
    staleTime: 30_000,
  });

  const internsQuery = useQuery({
    queryKey: ['interns'],
    queryFn: async () => fetchInternOptions(),
    enabled: Boolean(isAdminOrManager(user?.role)),
    staleTime: 5 * 60_000,
  });

  const tasksQuery = useQuery({
    queryKey: ['tasks', user?.id],
    queryFn: async () => {
      const data = await fetchJson<{ tasks: TaskInstance[] }>('/api/tasks');
      return data.tasks;
    },
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  const requestsQuery = useQuery({
    queryKey: ['requests', user?.id],
    queryFn: async () => {
      const data = await fetchJson<{ requests: DocRequest[] }>('/api/requests');
      return data.requests;
    },
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  const invitesQuery = useQuery({
    queryKey: ['invites', user?.id],
    queryFn: async () => {
      const data = await fetchJson<{ invites: Invite[] }>('/api/invites');
      return data.invites;
    },
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  const activityQuery = useQuery({
    queryKey: ['activity', user?.id],
    queryFn: async () => {
      const data = await fetchJson<{ activity: ActivityEvent[] }>('/api/activity');
      return data.activity;
    },
    enabled: Boolean(user),
    staleTime: 15_000,
  });

  const notificationsQuery = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const data = await fetchJson<{ notifications: AppNotification[] }>('/api/notifications');
      return data.notifications;
    },
    enabled: Boolean(user),
    staleTime: 15_000,
    refetchInterval: NOTIFICATION_LIVE_POLL_MS,
    refetchOnWindowFocus: true,
  });

  const internOptions = internsQuery.data ?? [];
  const teamMembers = internOptions;
  const internsLoading = internsQuery.isLoading;
  const engagementsLoading = engagementsQuery.isLoading;

  useEffect(() => {
    if (!engagementsQuery.data) return;
    setEngagements(engagementsQuery.data.engagements);
  }, [engagementsQuery.data, setEngagements]);

  useEffect(() => {
    if (tasksQuery.data) setTasks(tasksQuery.data);
  }, [tasksQuery.data, setTasks]);

  useEffect(() => {
    if (requestsQuery.data) setRequests(requestsQuery.data);
  }, [requestsQuery.data, setRequests]);

  useEffect(() => {
    if (invitesQuery.data) setInvites(invitesQuery.data);
  }, [invitesQuery.data, setInvites]);

  useEffect(() => {
    if (activityQuery.data) setActivity(activityQuery.data);
  }, [activityQuery.data, setActivity]);

  useEffect(() => {
    if (notificationsQuery.data) {
      setNotifications(
        notificationsQuery.data.filter((n) => !dismissedIdsRef.current.has(n.id)),
      );
    }
  }, [notificationsQuery.data, setNotifications]);

  useEffect(() => {
    if (!user?.id) return;
    const onRefresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
    };
    window.addEventListener(EMAIL_DISPATCH_NOTIFICATIONS_EVENT, onRefresh);
    return () => window.removeEventListener(EMAIL_DISPATCH_NOTIFICATIONS_EVENT, onRefresh);
  }, [queryClient, user?.id]);

  useEffect(() => {
    const solo = clientEngagementQuery.data;
    if (!solo) return;
    setEngagements((prev) =>
      prev.some((e) => e.id === solo.id) ? prev : [solo, ...prev],
    );
    void fetchChecklistState(solo.id)
      .then((cs) => {
        setDbChecklistState((prev) => ({ ...prev, [solo.id]: cs }));
      })
      .catch((checklistErr) => {
        toastError(
          "Couldn't load checklist answers",
          errorMessage(checklistErr, 'Refresh the page or try again in a moment.'),
        );
      });
  }, [clientEngagementQuery.data, setEngagements, setDbChecklistState]);

  useEffect(() => {
    if (!engagementsQuery.isError) return;
    toastError(
      "Couldn't load projects",
      errorMessage(engagementsQuery.error, 'Refresh the page or try again in a moment.'),
    );
  }, [engagementsQuery.isError, engagementsQuery.error]);

  const refetchEngagementsFromRealtime = useCallback(() => {
    void engagementsQuery.refetch();
    if (user?.role === 'client') {
      void clientEngagementQuery.refetch();
    }
  }, [engagementsQuery, clientEngagementQuery, user?.role]);

  const hydrateFromSession = useCallback(async () => {
    try {
      const session = await getSession();
      setUser(authUserFromSessionUser(session?.user as SessionUser | undefined));
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, [setUser, setAuthLoading]);

  useEffect(() => {
    void hydrateFromSession();
  }, [hydrateFromSession]);

  const pushActivity = useCallback((ev: Omit<ActivityEvent, 'id' | 'at'>) => {
    const optimistic: ActivityEvent = {
      id: `a${Date.now()}`,
      at: 'Just now',
      ...ev,
    };
    setActivity((prev) => [optimistic, ...prev]);
    void fetchJson<{ activity: ActivityEvent }>('/api/activity', {
      method: 'POST',
      body: JSON.stringify(ev),
    })
      .then((data) => {
        setActivity((prev) => {
          const withoutOptimistic = prev.filter((a) => a.id !== optimistic.id);
          return [data.activity, ...withoutOptimistic];
        });
        void queryClient.invalidateQueries({ queryKey: ['activity', user?.id] });
      })
      .catch(() => {
        /* keep optimistic row */
      });
  }, [setActivity, queryClient, user?.id]);

  const ingestChecklistNotificationDrafts = useCallback(
    (engagement: Engagement, drafts: ReturnType<typeof diffChecklistForNotifications>) => {
      if (!user || drafts.length === 0) return;

      /** Server fan-out owns persistence for these; client only toasts + refreshes the bell. */
      const serverOwnedKinds: ReadonlySet<NotificationKind> = new Set([
        'checklist.deliver',
        'checklist.submit',
        'checklist.review',
        'checklist.unlock',
        'docs.share',
        'request.created',
        'request.uploaded',
      ]);

      const fresh: AppNotification[] = [];
      let sawServerOwned = false;
      for (const draft of drafts) {
        const suppressKey = checklistNotifySuppressKey(
          draft.engagementId,
          draft.itemId ?? '_',
          draft.kind,
        );
        if (isNotificationSuppressed(suppressKey)) continue;

        toastSuccess(draft.title, draft.body);

        const verb =
          draft.kind === 'checklist.deliver'
            ? 'delivered'
            : draft.kind === 'checklist.submit'
              ? 'submitted'
              : draft.kind === 'checklist.review'
                ? 'reviewed'
                : draft.kind === 'checklist.unlock'
                  ? 'unlocked fields on'
                  : draft.kind === 'request.created'
                    ? 'requested a document for'
                    : draft.kind === 'request.uploaded'
                      ? 'uploaded'
                      : 'shared documents for';
        pushActivity({
          actor: engagement.companyName,
          verb,
          target: draft.itemId ? checklistItemLabel(draft.itemId) : draft.body,
          engagementId: engagement.id,
        });

        if (serverOwnedKinds.has(draft.kind)) {
          sawServerOwned = true;
          continue;
        }

        fresh.push({
          ...draft,
          id: `n${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          read: false,
          createdAt: new Date().toISOString(),
        });
      }

      if (sawServerOwned) {
        void queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
      }

      if (fresh.length === 0) return;
      setNotifications((prev) => [...fresh, ...prev].slice(0, 80));
      void fetchJson<{ notifications: AppNotification[] }>('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({
          notifications: fresh.map(({ id: _id, read: _read, createdAt: _c, ...rest }) => rest),
        }),
      })
        .then((data) => {
          setNotifications((prev) => {
            const withoutOptimistic = prev.filter((n) => !fresh.some((f) => f.id === n.id));
            return [...data.notifications, ...withoutOptimistic].slice(0, 80);
          });
          void queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
        })
        .catch(() => {});
    },
    [user, isNotificationSuppressed, pushActivity, setNotifications, queryClient],
  );

  const handleChecklistStateDiff = useCallback(
    (engagement: Engagement, prev: EngagementChecklistState | undefined, next: EngagementChecklistState) => {
      if (!user || prev === undefined) return;
      const drafts = diffChecklistForNotifications(prev, next, {
        engagement,
        viewerRole: user.role,
        viewerUserId: user.id,
      });
      ingestChecklistNotificationDrafts(engagement, drafts);
    },
    [user, ingestChecklistNotificationDrafts],
  );

  useRealtimeEngagements({
    user,
    engagements,
    checklistByEngagement: dbChecklistState,
    enabled: Boolean(user && engagementsQuery.isSuccess),
    onStateChange: ({ engagements: nextEngagements, checklistByEngagement }) => {
      for (const eng of nextEngagements) {
        const nextCs = checklistByEngagement[eng.id];
        if (nextCs) {
          handleChecklistStateDiff(eng, dbChecklistRef.current[eng.id], nextCs);
        }
      }
      setEngagements(nextEngagements);
      setDbChecklistState(checklistByEngagement);
    },
    onRefetch: refetchEngagementsFromRealtime,
    queryClient,
  });

  const signIn = useCallback<AppContextValue['signIn']>(async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return { error: 'Enter your work email and password to continue.' };
    }

    const result = await authJsSignIn('credentials', {
      email: normalizedEmail,
      password,
      redirect: false,
    });

    if (result?.error) {
      return { error: "We couldn't sign you in. Check your email and password and try again." };
    }

    const session = await getSession();
    const authUser = authUserFromSessionUser(session?.user as SessionUser | undefined);
    if (!authUser) {
      await authJsSignOut({ redirect: false });
      setUser(null);
      return { error: 'No profile is linked to this account. Ask your firm admin to complete setup.' };
    }

    setUser(authUser);
    return { user: authUser };
  }, [setUser]);

  const signInAsClient = useCallback<AppContextValue['signInAsClient']>((clientId, name) => {
    if (process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH !== 'true') {
      throw new Error('Demo client sign-in is off. Sign in with your issued client credentials.');
    }
    const u: AuthUser = {
      id: `client-${clientId}`,
      name,
      email: `${clientId}@client.demo`,
      role: 'client' as Role,
      initials: initialsFromName(name),
      clientId,
    };
    setUser(u);
    return u;
  }, [setUser]);

  const signOut = useCallback(async () => {
    await authJsSignOut({ redirect: false });
    queryClient.clear();
    dismissedIdsRef.current.clear();
    deleteInflightRef.current.clear();
    setUser(null);
    setNotifications([]);
    setEngagements([]);
    setClients(seedClients);
    setTasks([]);
    setRequests([]);
    setInvites([]);
    setActivity([]);
    clearAllStepProgress();
  }, [
    queryClient,
    setUser,
    setNotifications,
    setEngagements,
    setClients,
    setTasks,
    setRequests,
    setInvites,
    setActivity,
  ]);

  const createProjectWithClientFn = useCallback<AppContextValue['createProjectWithClient']>(async (input) => {
    if (!isAdminOrManager(user?.role)) {
      throw new Error('Only admins or project managers can create projects and provision client accounts.');
    }
    const result = await createProjectWithClient(input);
    const { engagement, clientId } = result;
    const initials = initialsFromName(input.companyName);
    const client: Client = {
      id: clientId,
      name: input.clientName || input.companyName,
      initials,
      stage: engagement.stage,
      unread: 0,
      incorporationDate: null,
      nature: 'IT Services',
      shareCapital: 0,
    };
    setClients((p) => [...p, client]);
    setEngagements((p) => [engagement, ...p]);
    const seeded = seedTasksFor(engagement.id, engagement.stage);
    setTasks((p) => [...p, ...seeded]);
    for (const t of seeded) {
      void fetchJson('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          engagementId: t.engagementId,
          checklistKey: t.checklistKey,
          status: t.status,
          assigneeId: t.assigneeId,
          dueAt: t.dueAt,
          notes: t.notes,
          title: t.checklistKey,
        }),
      }).catch(() => {});
    }
    void queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
    pushActivity({
      actor: user?.name || 'Admin',
      verb: 'created project',
      target: engagement.companyName,
      engagementId: engagement.id,
    });
    return result;
  }, [user, pushActivity, setClients, setEngagements, setTasks, queryClient]);

  const updateEngagementFn = useCallback<AppContextValue['updateEngagement']>(async (id, patch) => {
    const updated = await updateEngagementInDb(id, patch);
    if (updated) {
      setEngagements((p) => p.map((e) => (e.id === id ? updated : e)));
      return updated;
    }
    throw new Error('Project not found or could not be updated.');
  }, [setEngagements]);

  const inviteClient = useCallback<AppContextValue['inviteClient']>(
    (engagementId, email) => {
      const token = `inv_${Math.random().toString(36).slice(2, 10)}`;
      const inv: Invite = { token, engagementId, email, createdAt: new Date().toISOString() };
      setInvites((p) => [...p, inv]);
      void fetchJson<{ invite: Invite }>('/api/invites', {
        method: 'POST',
        body: JSON.stringify({ engagementId, email, token }),
      })
        .then((data) => {
          setInvites((p) => p.map((i) => (i.token === token ? data.invite : i)));
          void queryClient.invalidateQueries({ queryKey: ['invites', user?.id] });
        })
        .catch(() => {});
      pushActivity({ actor: user?.name || 'Project Lead', verb: 'invited client', target: email, engagementId });
      return inv;
    },
    [user?.name, user?.id, pushActivity, setInvites, queryClient],
  );

  const acceptInvite = useCallback<AppContextValue['acceptInvite']>(
    (token, name) => {
      const inv = invites.find((i) => i.token === token);
      if (!inv) return null;
      const eng = engagements.find((e) => e.id === inv.engagementId);
      if (!eng) return null;
      setInvites((p) => p.map((i) => (i.token === token ? { ...i, usedAt: new Date().toISOString() } : i)));
      void fetchJson('/api/invites', {
        method: 'POST',
        body: JSON.stringify({ action: 'accept', token }),
      }).catch(() => {});
      return signInAsClient(eng.clientId, name);
    },
    [invites, engagements, signInAsClient, setInvites],
  );

  const updateTask = useCallback<AppContextValue['updateTask']>(
    (taskId, patch) => {
      setTasks((p) => p.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
      void fetchJson<{ task: TaskInstance }>(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
        .then((data) => {
          setTasks((p) => p.map((t) => (t.id === taskId ? data.task : t)));
          void queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
        })
        .catch(() => {});
    },
    [setTasks, queryClient, user?.id],
  );

  const uploadDoc = useCallback<AppContextValue['uploadDoc']>(
    (requestId, fileName) => {
      const uploadedAt = new Date().toISOString().slice(0, 10);
      setRequests((p) =>
        p.map((r) =>
          r.id === requestId
            ? { ...r, status: 'uploaded', fileName, uploadedAt }
            : r,
        ),
      );
      void fetchJson<{ request: DocRequest; email?: EmailDispatchResult }>(`/api/requests/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'uploaded', fileName, uploadedAt }),
      })
        .then((data) => {
          setRequests((p) => p.map((r) => (r.id === requestId ? data.request : r)));
          void queryClient.invalidateQueries({ queryKey: ['requests', user?.id] });
          toastEmailDispatch(data.email, { engagementId: data.request.engagementId, href: '#' });
        })
        .catch(() => {});
      const req = requests.find((r) => r.id === requestId);
      if (req) pushActivity({ actor: user?.name || 'Client', verb: 'uploaded', target: req.label, engagementId: req.engagementId });
    },
    [requests, user?.name, user?.id, pushActivity, setRequests, queryClient],
  );

  const approveDoc = useCallback<AppContextValue['approveDoc']>(
    (requestId) => {
      setRequests((p) => p.map((r) => (r.id === requestId ? { ...r, status: 'approved' } : r)));
      void fetchJson<{ request: DocRequest }>(`/api/requests/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'approved' }),
      })
        .then((data) => {
          setRequests((p) => p.map((r) => (r.id === requestId ? data.request : r)));
          void queryClient.invalidateQueries({ queryKey: ['requests', user?.id] });
        })
        .catch(() => {});
    },
    [setRequests, queryClient, user?.id],
  );

  const createRequest = useCallback<AppContextValue['createRequest']>(
    ({ engagementId, taskId, label, message, dueAt }) => {
      const id = `r${Date.now()}`;
      const r: DocRequest = {
        id,
        engagementId,
        taskId,
        label,
        status: 'pending',
        message,
        dueAt,
        requestedBy: user?.id || 'tm1',
      };
      setRequests((p) => [...p, r]);
      void fetchJson<{ request: DocRequest; email?: EmailDispatchResult }>('/api/requests', {
        method: 'POST',
        body: JSON.stringify({ engagementId, taskId, label, message, dueAt }),
      })
        .then((data) => {
          setRequests((p) => p.map((row) => (row.id === id ? data.request : row)));
          void queryClient.invalidateQueries({ queryKey: ['requests', user?.id] });
          toastEmailDispatch(data.email, { engagementId, href: '#' });
        })
        .catch(() => {});
      pushActivity({ actor: user?.name || 'Project Lead', verb: 'requested', target: label, engagementId });
      return r;
    },
    [user?.id, user?.name, pushActivity, setRequests, queryClient],
  );

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
      const raw = dbChecklistState[engagement.id] ?? {};
      return normalizeEngagementChecklistState(raw as Record<string, unknown>);
    },
    [dbChecklistState],
  );

  const addClient = useCallback(
    (partial: Omit<Client, 'id' | 'initials' | 'unread'>): Client => {
      const id = `c${Date.now()}`;
      const c: Client = { id, initials: initialsFromName(partial.name), unread: 0, ...partial };
      setClients((p) => [...p, c]);
      setSelectedClient(c);
      return c;
    },
    [setClients, setSelectedClient],
  );

  const sidebarCollapsed = sidebarMode !== 'open';
  const toggleSidebar = useCallback(
    () => setSidebarMode((mode) => (mode === 'open' ? 'auto' : 'open')),
    [setSidebarMode],
  );
  const collapseSidebarTo = useCallback(
    (collapsed: boolean) =>
      setSidebarMode((mode) => applySidebarCollapsed(mode, collapsed)),
    [setSidebarMode],
  );

  const getState = useCallback(
    (scopeId: string) => {
      const eng = resolveEngagementForScope(scopeId);
      if (eng) return engagementChecklist(eng);
      return {};
    },
    [resolveEngagementForScope, engagementChecklist],
  );

  const value = useMemo<AppContextValue>(() => ({
    user, authLoading, signIn, signInAsClient, signOut, refreshAuth: hydrateFromSession,
    clients, engagements, tasks, requests, invites, activity, notifications,
    unreadNotificationCount, markNotificationRead, markAllNotificationsRead,
    dismissNotifications, restoreNotifications,
    suppressChecklistNotification, teamMembers,
    createProjectWithClient: createProjectWithClientFn, updateEngagement: updateEngagementFn,
    inviteClient, acceptInvite, updateTask, uploadDoc, approveDoc, createRequest,
    internOptions, internsLoading, engagementsLoading,
    sidebarCollapsed, sidebarMode, setSidebarMode, toggleSidebar, setSidebarCollapsed: collapseSidebarTo,
    commandOpen, setCommandOpen,
    role: (user?.role as Role) || 'admin',
    selectedClient,
    setSelectedClient,
    addClient,
    getState,
    getStateForEngagement: (engagement) => engagementChecklist(engagement),
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
        const saved = await patchChecklistItemInDb(engagementId,
          itemId,
          patch,
          previous,
        );
        setDbChecklistState((prev) => ({ ...prev, [engagementId]: saved }));
        if (patch.deliveredToClientAt?.trim()) {
          suppressChecklistNotification(engagementId, itemId, 'checklist.deliver');
          pushActivity({
            actor: user?.name || 'VCFO Team',
            verb: 'delivered',
            target: checklistItemLabel(itemId),
            engagementId,
          });
          if (user?.id) {
            void queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
          }
        }
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
    refreshEngagementChecklist,
    mergeEngagementChecklistResponses,
  }), [
    user,
    authLoading,
    clients,
    engagements,
    tasks,
    requests,
    invites,
    activity,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    dismissNotifications,
    restoreNotifications,
    suppressChecklistNotification,
    sidebarCollapsed,
    sidebarMode,
    commandOpen,
    selectedClient,
    engagementChecklist,
    refreshEngagementChecklist,
    mergeEngagementChecklistResponses,
    resolveEngagementForScope,
    dbChecklistState,
    signIn,
    signInAsClient,
    signOut,
    hydrateFromSession,
    createProjectWithClientFn,
    updateEngagementFn,
    inviteClient,
    acceptInvite,
    updateTask,
    uploadDoc,
    approveDoc,
    createRequest,
    addClient,
    toggleSidebar,
    collapseSidebarTo,
    setSidebarMode,
    getState,
    internOptions,
    internsLoading,
    engagementsLoading,
    setCommandOpen,
    setSelectedClient,
    setEngagements,
    setDbChecklistState,
    pushActivity,
  ]);
  return value;
}
