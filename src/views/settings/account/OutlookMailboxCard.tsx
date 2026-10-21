import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AccentButton } from '@/components/noir/AccentButton';
import { Button } from '@/components/ui/button';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';
import { SectionHead, SettingsRow } from './settings-layout';

export function OutlookMailboxCard({
  onConnectedChange,
}: {
  onConnectedChange?: (connected: boolean) => void;
}) {
  const [configured, setConfigured] = useState(true);
  const [connected, setConnected] = useState(false);
  const [msEmail, setMsEmail] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/outlook');
        const json = (await res.json()) as {
          configured?: boolean;
          connected?: boolean;
          msEmail?: string;
        };
        if (cancelled) return;
        setConfigured(json.configured !== false);
        setConnected(Boolean(json.connected));
        onConnectedChange?.(Boolean(json.connected));
        setMsEmail(json.msEmail);
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

  return (
    <section className="px-5 py-5">
      <SectionHead title="Outlook" />

      {loading ? (
        <div className="mt-1">
          <SettingsRow label="Mailbox" last>
            <span className="text-ink-muted">Checking…</span>
          </SettingsRow>
        </div>
      ) : !configured ? (
        <div className="mt-1">
          <SettingsRow label="Mailbox" last>
            <span className="text-ink-muted">Not configured yet. Ask an admin.</span>
          </SettingsRow>
        </div>
      ) : (
        <div className="mt-1">
          <SettingsRow label="Mailbox" last>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              {connected && msEmail ? (
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-positive" aria-hidden />
                  <span className="truncate font-mono text-[12px]">{msEmail}</span>
                </span>
              ) : (
                <span className="flex items-center gap-2 text-ink-muted">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-border" aria-hidden />
                  Not connected
                </span>
              )}
              {connected ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0"
                  disabled={disconnecting}
                  onClick={() => void disconnect()}
                >
                  {disconnecting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      Disconnecting…
                    </>
                  ) : (
                    'Disconnect'
                  )}
                </Button>
              ) : (
                <AccentButton
                  type="button"
                  size="sm"
                  className="h-8 min-h-8 shrink-0"
                  onClick={() => {
                    window.location.href = '/api/outlook/connect';
                  }}
                >
                  Connect Outlook
                </AccentButton>
              )}
            </div>
          </SettingsRow>
        </div>
      )}
    </section>
  );
}
