'use client';

import { useEffect, useState } from 'react';
import { Copy, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Chip } from '@/components/ui/spectrum-chip';
import { groupSecret } from '@/lib/totp/format';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { SettingsRow } from './settings-layout';
import { shortDate } from './device-label';

type Status = { enabled: boolean; enabledAt: string | null };
type Setup = { secret: string; uri: string };
type Mode = 'idle' | 'setup' | 'disable';

const CODE_ERRORS: Record<string, string> = {
  invalid_code: 'That code did not match. Check the app and try again.',
  locked: 'Too many codes tried. Wait ten minutes and try again.',
  not_started: 'Start again with Turn on.',
  already_on: 'Two-step sign-in is already on.',
  not_on: 'Two-step sign-in is already off.',
};

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error || 'request_failed');
  return json;
}

/**
 * Profile › Sign-in and security: two-step sign-in (G-25). Setup shows the
 * base32 key and the `otpauth://` link (no QR code), then a first code from
 * the app turns it on. Turning it off needs a current code.
 */
export function TwoStepRows() {
  const [status, setStatus] = useState<Status | null>(null);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<Mode>('idle');
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/account/two-step')
      .then(async (res) => {
        if (!res.ok) throw new Error('load_failed');
        const json = (await res.json()) as Status;
        if (!cancelled) setStatus(json);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const reset = () => {
    setMode('idle');
    setSetup(null);
    setCode('');
    setError(null);
  };

  async function start() {
    setBusy(true);
    setError(null);
    try {
      setSetup(await postJson<Setup>('/api/account/two-step/setup'));
      setMode('setup');
    } catch (err) {
      toastError('Two-step sign-in did not start', CODE_ERRORS[(err as Error).message] ?? 'Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'setup') {
        setStatus(await postJson<Status>('/api/account/two-step/confirm', { code }));
        toastSuccess('Two-step sign-in on');
      } else {
        setStatus(await postJson<Status>('/api/account/two-step/disable', { code }));
        toastSuccess('Two-step sign-in off');
      }
      reset();
    } catch (err) {
      setError(CODE_ERRORS[(err as Error).message] ?? 'That did not work. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    if (!setup) return;
    try {
      await navigator.clipboard.writeText(setup.secret);
      toastSuccess('Key copied');
    } catch {
      toastError('Copy failed', 'Select the key and copy it by hand.');
    }
  }

  const hint = status?.enabled && status.enabledAt ? `On since ${shortDate(status.enabledAt)}` : 'A code from an authenticator app at each sign-in';

  return (
    <>
      <SettingsRow label="Two-step sign-in" hint={status ? hint : undefined}>
        {!status ? (
          failed ? (
            <span className="text-ink-muted">Could not load</span>
          ) : (
            <span className="block h-4 w-40 animate-pulse rounded-mark bg-surface-sunken" aria-hidden />
          )
        ) : (
          <span className="flex flex-wrap items-center gap-2">
            <Chip raw tone={status.enabled ? 'ok' : 'idle'}>
              {status.enabled ? 'On' : 'Off'}
            </Chip>
            {mode === 'idle' ? (
              status.enabled ? (
                <Button type="button" variant="secondary" size="sm" className="ml-auto" onClick={() => setMode('disable')}>
                  Turn off
                </Button>
              ) : (
                <Button type="button" variant="secondary" size="sm" className="ml-auto" disabled={busy} onClick={() => void start()}>
                  {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
                  Turn on
                </Button>
              )
            ) : null}
          </span>
        )}
      </SettingsRow>

      {mode !== 'idle' ? (
        <form onSubmit={(e) => void submitCode(e)} className="border-t border-line-soft">
          {mode === 'setup' && setup ? (
            <>
              <SettingsRow label="Key" hint="Add it to Google Authenticator, Microsoft Authenticator or 1Password">
                <span className="flex flex-wrap items-center gap-2">
                  <code className="select-all break-all rounded-mark bg-surface-sunken px-2 py-1 font-mono text-[13px] text-ink">
                    {groupSecret(setup.secret)}
                  </code>
                  <Button type="button" variant="quiet" size="sm" onClick={() => void copyKey()}>
                    <Copy aria-hidden />
                    Copy
                  </Button>
                </span>
              </SettingsRow>
              <SettingsRow label="On this phone" hint="Opens the authenticator app">
                <a
                  href={setup.uri}
                  className="inline-flex items-center gap-1 font-medium text-brand-text underline-offset-2 hover:underline"
                >
                  Add to authenticator app
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              </SettingsRow>
            </>
          ) : null}
          <SettingsRow label="Code" hint={mode === 'setup' ? 'The 6 digits the app shows now' : 'A current code from your app'}>
            <Label htmlFor="two-step-code" className="sr-only">
              Code from the authenticator app
            </Label>
            <Input
              id="two-step-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,7}"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="max-w-[160px] font-mono tracking-[0.2em]"
              required
              // eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate: focuses the code field when this form opens
              autoFocus
            />
            {error ? (
              <p role="alert" className="mt-1 text-[12.5px] text-danger">
                {error}
              </p>
            ) : null}
          </SettingsRow>
          <div className="flex justify-end gap-2 border-t border-line-soft px-4 py-3 md:px-5">
            <Button type="button" variant="quiet" size="sm" onClick={reset} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              variant={mode === 'disable' ? 'destructive' : 'default'}
              disabled={busy || code.replace(/\s/g, '').length !== 6}
            >
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {mode === 'setup' ? 'Turn on' : 'Turn off'}
            </Button>
          </div>
        </form>
      ) : null}
    </>
  );
}
