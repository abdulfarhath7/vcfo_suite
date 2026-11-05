import { useCallback, useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { AppContextValue } from '@/context/AppContext';
import {
  type AuthUser,
  initialsFromName,
  type Role,
  isValidDbRole,
  mapDbRoleToAppRole,
  type DbRole,
} from '@/lib/auth';
import { ownAvatarSrc } from '@/lib/account-avatar';
import { getSession, signIn as authJsSignIn, signOut as authJsSignOut, useSession } from 'next-auth/react';
import type { AppProviderStore } from './state';
import type { NotificationActions } from './use-notifications';

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

/** Waits before each extra session read when an /app page finds no session (see the effect below). */
const SESSION_RETRY_WAITS_MS = [0, 600, 1500] as const;

/**
 * One read of `/api/auth/session`. `definite` is true only when the server answered; a network
 * error or a 5xx is not a "signed out" answer, so the caller must not sign the person out on it.
 */
async function readSessionUser(): Promise<{ user: AuthUser | null; definite: boolean }> {
  try {
    const res = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'same-origin' });
    if (!res.ok) return { user: null, definite: false };
    const body = (await res.json()) as { user?: SessionUser } | null;
    return { user: authUserFromSessionUser(body?.user), definite: true };
  } catch {
    return { user: null, definite: false };
  }
}

function isOnAppPage(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  return path === '/app' || path.startsWith('/app/');
}

type SessionAuthParams = {
  queryClient: QueryClient;
} & Pick<
  AppProviderStore,
  | 'setUser'
  | 'setAuthLoading'
  | 'setNotifications'
  | 'setEngagements'
  | 'setClients'
  | 'setTasks'
  | 'setRequests'
  | 'setInvites'
  | 'setActivity'
  | 'setDbChecklistState'
> &
  Pick<NotificationActions, 'dismissedIdsRef' | 'deleteInflightRef'>;

/** The signed-in user from the Auth.js session, plus sign in, demo client sign in and sign out. */
export function useSessionAuth({
  queryClient,
  setUser,
  setAuthLoading,
  setNotifications,
  setEngagements,
  setClients,
  setTasks,
  setRequests,
  setInvites,
  setActivity,
  setDbChecklistState,
  dismissedIdsRef,
  deleteInflightRef,
}: SessionAuthParams) {
  const { data: session, status: sessionStatus } = useSession();

  const hydrateFromSession = useCallback(async () => {
    try {
      const next = await getSession();
      setUser(authUserFromSessionUser(next?.user as SessionUser | undefined));
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, [setUser, setAuthLoading]);

  useEffect(() => {
    if (sessionStatus === 'loading') {
      setAuthLoading(true);
      return;
    }
    const fromSession = authUserFromSessionUser(session?.user as SessionUser | undefined);
    if (fromSession || !isOnAppPage()) {
      setUser(fromSession);
      setAuthLoading(false);
      return;
    }
    // On /app the proxy has already seen a valid sign-in cookie, so "no session" here is a stale
    // or failed read. On the live site it left the shell on "Opening VCFO Suite…" right after
    // sign-in until a manual refresh. Ask again before giving up; only when the server itself says
    // there is no session (signed out on another device, profile removed) clear the cookie and go
    // to the login page. Reads that failed leave the session alone; the boot screen's reload
    // safety net (AuthBootScreen) handles those.
    let cancelled = false;
    setAuthLoading(true);
    void (async () => {
      let definitelySignedOut = false;
      for (const waitMs of SESSION_RETRY_WAITS_MS) {
        if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
        if (cancelled) return;
        const read = await readSessionUser();
        if (read.user) {
          if (!cancelled) {
            setUser(read.user);
            setAuthLoading(false);
          }
          return;
        }
        definitelySignedOut = read.definite;
      }
      if (cancelled || !definitelySignedOut) return;
      setUser(null);
      const back = `${window.location.pathname}${window.location.search}`;
      await authJsSignOut({ callbackUrl: `/login?${new URLSearchParams({ next: back }).toString()}` });
    })();
    return () => {
      cancelled = true;
    };
  }, [session, sessionStatus, setUser, setAuthLoading]);

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
    setClients([]);
    setTasks([]);
    setRequests([]);
    setInvites([]);
    setActivity([]);
    setDbChecklistState({});
    // Leave the signed-in page. Without this the sidebar's Sign out left the page on a
    // loading state with no user; a full load also drops every cached page of the old session.
    window.location.replace('/login');
  }, [
    queryClient,
    dismissedIdsRef,
    deleteInflightRef,
    setUser,
    setNotifications,
    setEngagements,
    setClients,
    setTasks,
    setRequests,
    setInvites,
    setActivity,
    setDbChecklistState,
  ]);

  return {
    hydrateFromSession,
    signIn,
    signInAsClient,
    signOut,
  };
}
