'use client';

import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/spectrum-chip';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { SettingsRow } from './settings-layout';
import { shortDate } from './device-label';

type Link = { email: string; linkedAt: string; lastUsedAt: string | null };
type State = { configured: boolean; provider: string; link: Link | null; twoStepOn: boolean };

/**
 * Profile › Sign-in and security: "Microsoft sign-in" (S-650). Staff only. Shows whether the firm
 * set Microsoft sign-in up (`AUTH_MICROSOFT_ENTRA_ID_*`), and whether this profile is linked.
 * Connect runs the Microsoft sign-in, which links by email to this profile and never makes a new
 * one; Disconnect removes the link. Microsoft sign-in is refused while two-step sign-in is on.
 */
export function MicrosoftSignInRow() {
  const [state, setState] = useState<State | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/account/sign-in-links').then(async (res) => {
        if (!res.ok) throw new Error('load_failed');
        return ((await res.json()) as { microsoft: Omit<State, 'twoStepOn'> }).microsoft;
      }),
      fetch('/api/account/two-step')
        .then(async (res) => (res.ok ? ((await res.json()) as { enabled?: boolean }).enabled === true : false))
        .catch(() => false),
    ])
      .then(([microsoft, twoStepOn]) => {
        if (!cancelled) setState({ ...microsoft, twoStepOn });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function disconnect() {
    setBusy(true);
    try {
      const res = await fetch('/api/account/sign-in-links', { method: 'DELETE' });
      if (!res.ok) throw new Error('remove_failed');
      setState((s) => (s ? { ...s, link: null } : s));
      toastSuccess('Microsoft sign-in disconnected');
    } catch {
      toastError('Could not disconnect', 'Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  function connect() {
    if (!state) return;
    setBusy(true);
    void signIn(state.provider, { callbackUrl: window.location.href });
  }

  let hint: string | undefined;
  if (state && !state.configured) hint = 'Not set up for the firm';
  else if (state?.link) hint = `${state.link.email} · since ${shortDate(state.link.linkedAt)}`;
  else if (state?.twoStepOn) hint = 'Off while two-step sign-in is on';
  else if (state) hint = 'Sign in with your SBC Microsoft 365 account';

  return (
    <SettingsRow label="Microsoft sign-in" hint={hint}>
      {!state ? (
        failed ? (
          <span className="text-ink-muted">Could not load</span>
        ) : (
          <span className="block h-4 w-40 animate-pulse rounded-mark bg-surface-sunken" aria-hidden />
        )
      ) : (
        <span className="flex flex-wrap items-center gap-2">
          <Chip raw tone={state.link ? 'ok' : 'idle'}>
            {!state.configured ? 'Not set up' : state.link ? 'Connected' : 'Not connected'}
          </Chip>
          {state.configured ? (
            state.link ? (
              <Button type="button" variant="secondary" size="sm" className="ml-auto" disabled={busy} onClick={() => void disconnect()}>
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Disconnect
              </Button>
            ) : (
              <Button type="button" variant="secondary" size="sm" className="ml-auto" disabled={busy || state.twoStepOn} onClick={connect}>
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Connect
              </Button>
            )
          ) : null}
        </span>
      )}
    </SettingsRow>
  );
}
