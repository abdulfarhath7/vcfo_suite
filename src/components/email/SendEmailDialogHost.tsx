'use client';

import { readFileBase64 } from '@/lib/files/read-base64';
import { announceEmailSent } from '@/components/email/StepEmailsSent';
import { useEffect, useRef, useState } from 'react';
import { Loader2, Paperclip, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  SEND_EMAIL_EVENT,
  type EmailDraftView,
  type SendEmailEventDetail,
} from '@/lib/email/request-email-send';

const ADD_LIMIT_BYTES = 10 * 1024 * 1024;

function addresses(value: string): string[] {
  return [...new Set(value.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean))];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * GL-07: the one "Send email" pop-up. A card action opens it through `requestEmailSend`; it loads
 * the draft, lets the person change To, Cc, Subject, the message and the attachments, and posts
 * the edits only on Send. Cancel closes it and sends nothing.
 */
export function SendEmailDialogHost() {
  const [pending, setPending] = useState<SendEmailEventDetail | null>(null);
  const [draft, setDraft] = useState<EmailDraftView | null>(null);
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [kept, setKept] = useState<string[]>([]);
  const [added, setAdded] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onOpen = async (ev: Event) => {
      const detail = (ev as CustomEvent<SendEmailEventDetail>).detail;
      if (!detail?.request?.url) return;
      try {
        let d = detail.request.draft ?? null;
        if (!d) {
          const res = await fetch(detail.request.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...(detail.request.body ?? {}), preview: true }),
          });
          const json = (await res.json().catch(() => ({}))) as { draft?: EmailDraftView | null; error?: string };
          if (!res.ok || !json.draft) {
            toast.error(json.error ?? 'There is nothing to send for this card.');
            detail.resolve({ sent: false });
            return;
          }
          d = json.draft;
        }
        setDraft(d);
        setTo(d.to.join(', '));
        setCc(d.cc.join(', '));
        setSubject(d.subject);
        setMessage(d.message);
        setKept(d.attachments);
        setAdded([]);
        setPending(detail);
      } catch {
        toast.error('The email could not be prepared. Try again.');
        detail.resolve({ sent: false });
      }
    };
    window.addEventListener(SEND_EMAIL_EVENT, onOpen);
    return () => window.removeEventListener(SEND_EMAIL_EVENT, onOpen);
  }, []);

  const close = (sent: boolean, result?: unknown) => {
    pending?.resolve({ sent, result });
    setPending(null);
    setDraft(null);
    setSending(false);
  };

  const toList = addresses(to);
  const ccList = addresses(cc);
  const bad = [...toList, ...ccList].filter((e) => !EMAIL_RE.test(e));
  const addedBytes = added.reduce((n, f) => n + f.size, 0);
  const canSend = !sending && toList.length > 0 && bad.length === 0 && subject.trim().length > 0 && addedBytes <= ADD_LIMIT_BYTES;

  const send = async () => {
    if (!pending || !draft) return;
    setSending(true);
    try {
      const addAttachments = await Promise.all(
        added.map(async (f) => ({ filename: f.name, contentType: f.type || undefined, contentBase64: await readFileBase64(f) })),
      );
      const email = {
        to: toList,
        cc: ccList,
        subject: subject.trim(),
        message,
        dropAttachments: draft.attachments.filter((a) => !kept.includes(a)),
        addAttachments,
      };
      const res = await fetch(pending.request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(pending.request.body ?? {}), email }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? 'The email did not send. Nothing was changed.');
        setSending(false);
        return;
      }
      toast.success(`Email sent to ${toList.length} ${toList.length === 1 ? 'person' : 'people'}.`);
      announceEmailSent();
      close(true, json);
    } catch {
      toast.error('The email did not send. Try again.');
      setSending(false);
    }
  };

  return (
    <Dialog open={Boolean(pending && draft)} onOpenChange={(open) => (!open && !sending ? close(false) : undefined)}>
      <DialogContent className="max-w-2xl" data-testid="send-email-dialog">
        <DialogHeader>
          <DialogTitle>{pending?.request.title ?? 'Send email'}</DialogTitle>
          <DialogDescription>Check and change the email. Nothing is sent until you press Send.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label htmlFor="send-email-to">To</Label>
            <Input id="send-email-to" value={to} onChange={(e) => setTo(e.target.value)} aria-invalid={toList.length === 0 || undefined} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="send-email-cc">Cc</Label>
            <Input id="send-email-cc" value={cc} onChange={(e) => setCc(e.target.value)} />
          </div>
          {bad.length ? <p className="text-[12.5px] text-danger">Check these addresses: {bad.join(', ')}</p> : null}
          <div className="grid gap-1">
            <Label htmlFor="send-email-subject">Subject</Label>
            <Input id="send-email-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="send-email-message">Message</Label>
            <Textarea id="send-email-message" className="min-h-[160px]" value={message} onChange={(e) => setMessage(e.target.value)} />
            {draft?.fixed ? <p className="text-[12px] text-ink-muted">Also in the email, below your message: {draft.fixed}.</p> : null}
          </div>
          <div className="grid gap-1.5">
            <Label>Attachments</Label>
            <ul className="flex flex-wrap gap-2">
              {kept.map((name) => (
                <li key={`k-${name}`} className="inline-flex items-center gap-1 rounded-md bg-surface-sunken px-2 py-1 text-[12.5px]">
                  <Paperclip className="h-3 w-3" aria-hidden />
                  {name}
                  <button type="button" aria-label={`Remove ${name}`} onClick={() => setKept((k) => k.filter((x) => x !== name))}>
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </li>
              ))}
              {added.map((file, i) => (
                <li key={`a-${i}`} className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-1 text-[12.5px]">
                  <Paperclip className="h-3 w-3" aria-hidden />
                  {file.name}
                  <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setAdded((a) => a.filter((_, j) => j !== i))}>
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </li>
              ))}
              {!kept.length && !added.length ? <li className="text-[12.5px] text-ink-muted">None</li> : null}
            </ul>
            <div>
              <input ref={fileInput} type="file" multiple hidden onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                setAdded((a) => [...a, ...files].slice(0, 5));
                e.target.value = '';
              }} />
              <Button type="button" size="sm" variant="ghost" onClick={() => fileInput.current?.click()}>Add attachment</Button>
              {addedBytes > ADD_LIMIT_BYTES ? <span className="ml-2 text-[12px] text-danger">Added files must stay under 10 MB.</span> : null}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={sending} onClick={() => close(false)}>Cancel</Button>
          <Button type="button" disabled={!canSend} onClick={send}>
            {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : null}
            {pending?.request.sendLabel ?? 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
