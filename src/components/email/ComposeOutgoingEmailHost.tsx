'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { GoldButton } from '@/components/noir';
import { useApp } from '@/context/AppContext';
import type { OutgoingEmailDraft } from '@/lib/email/email-dispatch';
import { COMPOSE_OUTGOING_EMAIL_EVENT, toastError, toastEmailDispatch } from '@/lib/toast-errors';

function parseAddressList(value: string): string[] {
  return [...new Set(value.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean))];
}

function isStaffRole(role: string | undefined): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'manager' || role === 'intern';
}

export function ComposeOutgoingEmailHost() {
  const { user } = useApp();
  const [draft, setDraft] = useState<OutgoingEmailDraft | null>(null);
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [initialBody, setInitialBody] = useState('');
  const [msEmail, setMsEmail] = useState<string | undefined>();
  const [configured, setConfigured] = useState(true);
  const [connected, setConnected] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [sending, setSending] = useState(false);

  const open = Boolean(draft) && isStaffRole(user?.role);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/outlook');
      const json = (await res.json()) as {
        configured?: boolean;
        connected?: boolean;
        msEmail?: string;
      };
      setConfigured(json.configured !== false);
      setConnected(Boolean(json.connected));
      setMsEmail(json.msEmail);
    } catch {
      setConnected(false);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    const onCompose = (ev: Event) => {
      const detail = (ev as CustomEvent<OutgoingEmailDraft>).detail;
      if (!detail?.to?.length) return;
      setDraft(detail);
      setTo(detail.to.join(', '));
      setCc((detail.cc ?? []).join(', '));
      setSubject(detail.subject);
      setBody(detail.text);
      setInitialBody(detail.text);
    };
    window.addEventListener(COMPOSE_OUTGOING_EMAIL_EVENT, onCompose);
    return () => window.removeEventListener(COMPOSE_OUTGOING_EMAIL_EVENT, onCompose);
  }, []);

  useEffect(() => {
    if (open) void loadStatus();
  }, [open, loadStatus]);

  const close = () => {
    setDraft(null);
    setSending(false);
  };

  const send = async () => {
    const addresses = parseAddressList(to);
    const ccAddresses = parseAddressList(cc).filter(
      (addr) => !addresses.some((toAddr) => toAddr.toLowerCase() === addr.toLowerCase()),
    );
    if (addresses.length === 0 || !subject.trim()) {
      toastError('Cannot send', 'Add at least one recipient and a subject.');
      return;
    }
    setSending(true);
    try {
      const edited = body !== initialBody;
      const res = await fetch('/api/outlook/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: addresses,
          cc: ccAddresses,
          subject: subject.trim(),
          text: body,
          html: edited ? undefined : draft?.html,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; from?: string };
      if (!res.ok || json.ok === false) {
        if (res.status === 409 || json.error === 'outlook_not_connected') {
          toastError('Connect Outlook', 'Link your mailbox, then send again.');
          await loadStatus();
          return;
        }
        throw new Error(json.error ?? 'send_failed');
      }
      toastEmailDispatch(
        {
          attempted: addresses.length,
          sent: addresses,
          skipped: [],
          failed: [],
          subjects: [subject.trim()],
        },
        {
          engagementId: draft?.engagementId,
          companyName: draft?.companyName,
          itemId: draft?.itemId,
          href: '#',
        },
      );
      close();
    } catch (err) {
      toastEmailDispatch(
        {
          attempted: addresses.length,
          sent: [],
          skipped: [],
          failed: addresses,
          subjects: [subject.trim()],
          error: err instanceof Error ? err.message : 'send_failed',
        },
        {
          engagementId: draft?.engagementId,
          companyName: draft?.companyName,
          itemId: draft?.itemId,
          href: '#',
        },
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Email client</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="outgoing-from">From</Label>
            <Input
              id="outgoing-from"
              readOnly
              value={
                loadingStatus
                  ? 'Checking Outlook…'
                  : connected && msEmail
                    ? msEmail
                    : configured
                      ? 'Outlook not connected'
                      : 'Outlook not configured (Azure app)'
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="outgoing-to">To</Label>
            <Input id="outgoing-to" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="outgoing-cc">CC</Label>
            <Input
              id="outgoing-cc"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="Admin and project lead"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="outgoing-subject">Subject</Label>
            <Input
              id="outgoing-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="outgoing-body">Message</Label>
            <Textarea
              id="outgoing-body"
              className="min-h-[180px]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          {!connected && configured ? (
            <GoldButton
              type="button"
              variant="outline"
              onClick={() => {
                window.location.href = '/api/outlook/connect';
              }}
            >
              Connect Outlook
            </GoldButton>
          ) : null}
          <GoldButton type="button" variant="ghost" onClick={close} disabled={sending}>
            Cancel
          </GoldButton>
          <GoldButton type="button" onClick={() => void send()} disabled={sending || !connected}>
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending
              </>
            ) : (
              'Send'
            )}
          </GoldButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
