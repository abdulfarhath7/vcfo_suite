'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/spectrum-chip';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { SettingsRow } from './settings-layout';
import { describeUserAgent, lastSeenLabel, shortDate } from './device-label';

type Device = {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
};

/**
 * Profile › Sign-in and security: the devices signed in to this account (G-25),
 * each with "Sign out", and "Sign out everywhere else". Signing out this device
 * here ends the session the same way the Sign out button does.
 */
export function DevicesRows({ onSignOutHere }: { onSignOutHere: () => void }) {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/account/sessions');
      if (!res.ok) throw new Error('load_failed');
      const json = (await res.json()) as { sessions: Device[] };
      setDevices(json.sessions);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function signOutDevice(device: Device) {
    setBusyId(device.id);
    try {
      const res = await fetch(`/api/account/sessions/${device.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error('revoke_failed');
      if (device.current) {
        onSignOutHere();
        return;
      }
      setDevices((prev) => (prev ? prev.filter((d) => d.id !== device.id) : prev));
      toastSuccess('Device signed out');
    } catch {
      toastError('Sign out failed', 'Try again in a moment.');
    } finally {
      setBusyId(null);
    }
  }

  async function signOutOthers() {
    setBusyId('others');
    try {
      const res = await fetch('/api/account/sessions/revoke-others', { method: 'POST' });
      const json = (await res.json().catch(() => ({}))) as { revoked?: number };
      if (!res.ok) throw new Error('revoke_failed');
      setDevices((prev) => (prev ? prev.filter((d) => d.current) : prev));
      toastSuccess(json.revoked === 1 ? 'Signed out of 1 other device' : `Signed out of ${json.revoked ?? 0} other devices`);
    } catch {
      toastError('Sign out failed', 'Try again in a moment.');
    } finally {
      setBusyId(null);
    }
  }

  const others = devices?.filter((d) => !d.current).length ?? 0;

  return (
    <>
      <SettingsRow label="Devices signed in">
        {!devices ? (
          failed ? (
            <span className="text-ink-muted">Could not load</span>
          ) : (
            <span className="block h-4 w-48 animate-pulse rounded-mark bg-surface-sunken" aria-hidden />
          )
        ) : devices.length === 0 ? (
          <span className="text-ink-muted">This device</span>
        ) : (
          <ul className="grid gap-2">
            {devices.map((d) => {
              const label = describeUserAgent(d.userAgent);
              const phone = /iPhone|Android|iPad/.test(label);
              const Icon = phone ? Smartphone : Monitor;
              return (
                <li key={d.id} className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-md bg-surface-sunken text-ink-muted" aria-hidden>
                    <Icon className="h-4 w-4" strokeWidth={1.6} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <b className="truncate text-[14px] font-medium text-ink">{label}</b>
                      {d.current ? <Tag tone="ok">This device</Tag> : null}
                    </span>
                    <span className="block truncate text-[12.5px] text-ink-muted">
                      {[d.ip, `Signed in ${shortDate(d.createdAt)}`, lastSeenLabel(d.lastSeenAt)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="quiet"
                    size="sm"
                    disabled={busyId !== null}
                    onClick={() => void signOutDevice(d)}
                    aria-label={`Sign out ${label}${d.current ? ' (this device)' : ''}`}
                  >
                    {busyId === d.id ? <Loader2 className="animate-spin" aria-hidden /> : null}
                    Sign out
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsRow>
      <SettingsRow label="Sign out everywhere else">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!devices || others === 0 || busyId !== null}
          onClick={() => void signOutOthers()}
        >
          {busyId === 'others' ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Sign out others
        </Button>
      </SettingsRow>
    </>
  );
}
