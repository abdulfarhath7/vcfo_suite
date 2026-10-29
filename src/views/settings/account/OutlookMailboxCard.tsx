import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/spectrum-chip';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';
import { ProfileCard, SettingsRow } from './settings-layout';

/**
 * Profile › Email: the staff member's Outlook mailbox, and whether the app adds their signature
 * to each message (K-40, G-23). The signature itself is edited in the Email screen's settings.
 */
export function OutlookMailboxCard({
  onConnectedChange,
  title = 'Email',
}: {
  onConnectedChange?: (connected: boolean) => void;
  /** "Email" in its own section; "Outlook" inside Profile › Settings. */
  title?: string;
}) {
  const [configured, setConfigured] = useState(true);
  const [connected, setConnected] = useState(false);
  const [msEmail, setMsEmail] = useState<string | undefined>();
  const [signatureOn, setSignatureOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/outlook');
        const json = (await res.json()) as {
          configured?: boolean;
          connected?: boolean;
          msEmail?: string;
          signatureEnabled?: boolean;
          signatureText?: string | null;
        };
        if (cancelled) return;
        setConfigured(json.configured !== false);
        setConnected(Boolean(json.connected));
        onConnectedChange?.(Boolean(json.connected));
        setMsEmail(json.msEmail);
        setSignatureOn(Boolean(json.signatureEnabled && json.signatureText?.trim()));
      } catch {
        if (!cancelled) {
          setConnected(false);
          onConnectedChange?.(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onConnectedChange]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outlook = params.get('outlook');
    if (!outlook) return;
    if (outlook === 'connected') {
      toastSuccess('Outlook connected', 'Client emails will send from this mailbox.');
    } else {
      const reason = params.get('reason')?.trim();
      toastError('Outlook did not connect', reason || 'Try Connect Outlook again.');
    }
    params.delete('outlook');
    params.delete('reason');
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
    window.history.replaceState({}, '', next);
  }, []);

  async function disconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/outlook/disconnect', { method: 'DELETE' });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'disconnect_failed');
      setConnected(false);
      setMsEmail(undefined);
      onConnectedChange?.(false);
      toastSuccess('Outlook disconnected');
    } catch (err) {
      toastError('Could not disconnect Outlook', errorMessage(err));
    } finally {
      setDisconnecting(false);
    }
  }

  const chip = loading ? null : !configured ? (
    <Chip tone="idle">Not set up</Chip>
  ) : connected ? (
    <Chip tone="ok">Connected</Chip>
  ) : (
    <Chip tone="idle">Not connected</Chip>
  );

  return (
    <ProfileCard id="email" title={title} action={chip}>
      {loading ? (
        <SettingsRow label="Outlook">
          <span className="block h-4 w-44 animate-pulse rounded-mark bg-surface-sunken" aria-hidden />
          <span className="sr-only">Checking</span>
        </SettingsRow>
      ) : !configured ? (
        <SettingsRow label="Outlook">
          <span className="text-ink-muted">Not set up for this firm. Ask an admin.</span>
        </SettingsRow>
      ) : (
        <>
          <SettingsRow label="Outlook" hint="Mail you send from VCFO goes from your mailbox">
            <div className="flex flex-wrap items-center gap-2">
              <span className={connected && msEmail ? 'min-w-0 truncate text-ink' : 'text-ink-muted'}>
                {connected && msEmail ? msEmail : 'Not connected'}
              </span>
              {connected ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="ml-auto"
                  disabled={disconnecting || asking}
                  onClick={() => setAsking(true)}
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="ml-auto"
                  onClick={() => {
                    window.location.href = '/api/outlook/connect';
                  }}
                >
                  Connect Outlook
                </Button>
              )}
            </div>
          </SettingsRow>
          {connected ? (
            <SettingsRow label="Signature" hint="Added under every message you send from VCFO">
              <Chip tone={signatureOn ? 'ok' : 'idle'}>{signatureOn ? 'On' : 'Off'}</Chip>
            </SettingsRow>
          ) : null}
          {connected && asking ? (
            // R-40: ask before a risky change.
            <div className="flex flex-wrap items-center gap-2 border-t border-line-soft bg-surface-sunken px-4 py-2.5 md:px-5">
              <span className="text-[14px] text-ink">Disconnect Outlook? Mail from VCFO stops sending from your mailbox.</span>
              <span className="ml-auto flex gap-2">
                <Button type="button" variant="quiet" size="sm" disabled={disconnecting} onClick={() => setAsking(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={disconnecting}
                  onClick={() => void disconnect().then(() => setAsking(false))}
                >
                  {disconnecting ? <Loader2 className="animate-spin" aria-hidden /> : null}
                  {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                </Button>
              </span>
            </div>
          ) : null}
        </>
      )}
    </ProfileCard>
  );
}
