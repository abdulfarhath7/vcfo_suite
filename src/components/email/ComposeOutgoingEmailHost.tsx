'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Paperclip, X } from 'lucide-react';
import { readFileBase64 } from '@/lib/files/read-base64';
import { announceEmailSent } from '@/components/email/StepEmailsSent';
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
import { AccentButton } from '@/components/noir';
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
  // GL-07: files the person adds before sending; removed with the X on each.
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

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
    setFiles([]);
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
    if (files.reduce((n, f) => n + f.size, 0) > 10 * 1024 * 1024) {
      toastError('Attachments too large', 'Keep the files under 10 MB in all.');
      return;
    }
    setSending(true);
    try {
      const attachments = await Promise.all(
        files.map(async (f) => ({ name: f.name, contentType: f.type || undefined, contentBase64: await readFileBase64(f) })),
      );
      const edited = body !== initialBody;
      // GL-07: from the person's own Outlook when it is connected; otherwise the firm's address
      // sends it in their name, so a missing mailbox never blocks the email.
      const res = await fetch(connected ? '/api/outlook/send' : '/api/email/send-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: addresses,
          cc: ccAddresses,
          subject: subject.trim(),
          text: body,
          html: edited ? undefined : draft?.html,
          engagementId: draft?.engagementId,
          itemId: draft?.itemId,
          // GL-07: the route queues the client WhatsApp nudge only after this email is sent.
          ...(draft?.whatsappEvent ? { whatsappEvent: draft.whatsappEvent } : {}),
          ...(attachments.length ? { attachments } : {}),
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
      announceEmailSent();
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
          <DialogTitle>Send email</DialogTitle>
          <p className="text-[13px] text-ink-muted">Nothing is sent until you click Send. Check and change anything first.</p>
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
                    : `${user?.name ?? 'You'} via the firm's address (Outlook not connected)`
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
          <div className="space-y-1.5">
            <Label>Attachments</Label>
            {files.length ? (
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md border border-line px-2 py-1 text-[13px]">
                    <Paperclip className="h-3.5 w-3.5 flex-none text-ink-muted" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <button
                      type="button"
                      className="rounded p-0.5 text-ink-muted hover:text-ink"
                      aria-label={`Remove ${f.name}`}
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <AccentButton type="button" variant="outline" size="sm" disabled={files.length >= 5} onClick={() => fileRef.current?.click()}>
              <Paperclip className="mr-1 h-3.5 w-3.5" aria-hidden />
              Add a file
            </AccentButton>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              aria-label="Add attachments"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                e.target.value = '';
                setFiles((prev) => [...prev, ...picked].slice(0, 5));
              }}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          {!connected && configured ? (
            <AccentButton
              type="button"
              variant="outline"
              onClick={() => {
                window.location.href = '/api/outlook/connect';
              }}
            >
              Connect Outlook
            </AccentButton>
          ) : null}
          <AccentButton type="button" variant="ghost" onClick={close} disabled={sending}>
            Cancel
          </AccentButton>
          <AccentButton type="button" onClick={() => void send()} disabled={sending || loadingStatus}>
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending
              </>
            ) : (
              'Send'
            )}
          </AccentButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
