'use client';

import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import type { EmailRecipient } from '@/lib/receivables/model';
import { useOutlookStatus } from '@/hooks/use-receivables';
import { useKeepSignName, useReceivedEmail, useSignName } from '@/hooks/use-receivables-v2';
import { SignNameField } from '../SignNameField';
import { InvoicesInEmail } from '../compose/InvoicesInEmail';
import { paymentReceivedEmail } from '@/lib/receivables/email-v2';
import { alreadySentHits } from '@/lib/receivables/sent-receipts';
import { OUTLOOK_CONNECT_HREF, RecipientRow } from '../ComposeSummary';

/**
 * The pop-up after Mark received (owner, 17 Nov 2026): "Payment received — send an email?". It
 * opens only once invoices are saved as received, never for a part payment, and nothing is sent
 * unless the person clicks Send. To starts with the invoices' client partner; any address can be
 * added. The body (the SBC table with the received date and amount) is editable. It goes from the
 * person's own Outlook, lands in the People tab's log and is followed by the WhatsApp ping.
 */
export function ReceivedEmailDialog({ sheetId, invoiceIds, onClose }: { sheetId: string; invoiceIds: string[]; onClose: () => void }) {
  const { draft, send } = useReceivedEmail(sheetId, invoiceIds);
  const outlook = useOutlookStatus();
  const body = useRef<HTMLDivElement>(null);
  const [to, setTo] = useState<EmailRecipient[]>([]);
  const [cc, setCc] = useState<EmailRecipient[]>([]);
  const [subject, setSubject] = useState('');
  const filled = useRef(false);
  const signQuery = useSignName().query;
  const keepSign = useKeepSignName();
  const [sign, setSign] = useState('');
  useEffect(() => {
    if (signQuery.data?.name && !sign) setSign(signQuery.data.name);
    // Only the first load fills the box; after that it is the person's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signQuery.data?.name]);
  /** Typing the name changes "Regards, <name>" in the body at once. */
  const changeSign = (name: string) => {
    setSign(name);
    if (!name.trim()) return;
    body.current?.querySelectorAll('[data-sign-name="1"]').forEach((el) => (el.textContent = name.trim()));
  };
  useEffect(() => {
    if (filled.current || !draft.data) return;
    filled.current = true;
    setTo(draft.data.to);
    setSubject(draft.data.subject);
  }, [draft.data]);
  const d = draft.data;
  const connected = outlook.data?.connected;
  // ✕ takes an invoice out of this email only; the body is rebuilt without it (owner, 18 Nov 2026).
  const [removed, setRemoved] = useState<string[]>([]);
  const [html, setHtml] = useState<string | null>(null);
  const keptIds = d ? d.invoices.filter((i) => !removed.includes(i.id)).map((i) => i.id) : [];
  const hits = d ? alreadySentHits(d.alreadySent, keptIds, [...to, ...cc].map((r) => r.email)) : [];
  const toggle = (id: string) => {
    if (!d) return;
    const next = removed.includes(id) ? removed.filter((x) => x !== id) : [...removed, id];
    setRemoved(next);
    const kept = d.invoices.filter((i) => !next.includes(i.id));
    if (kept.length) setHtml(paymentReceivedEmail({ recipientName: d.recipientName, senderName: sign.trim() || 'Accounts Team', invoices: kept }).html);
  };
  const submit = () => {
    if (!d) return;
    keepSign(sign);
    send.mutate(
      { invoiceIds: keptIds, to, cc, subject: subject.trim(), html: body.current?.innerHTML ?? html ?? d.html },
      {
        onSuccess: () => {
          toastSuccess('Payment email sending', `To ${to.map((r) => r.name || r.email).join(', ')}, from your Outlook.`);
          onClose();
        },
        onError: (e) => toastError('Not sent', e instanceof Error ? e.message : undefined),
      },
    );
  };
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Payment received · send an email?"
      sub={invoiceIds.length === 1 ? 'Saved as received. Nothing is sent unless you click Send.' : `${invoiceIds.length} invoices saved as received. Nothing is sent unless you click Send.`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Skip
          </Button>
          <Button disabled={!d || !connected || !to.length || !subject.trim() || !keptIds.length || hits.length > 0 || send.isPending} onClick={submit}>
            <Send aria-hidden />
            {send.isPending ? 'Sending…' : 'Send from my Outlook'}
          </Button>
        </>
      }
    >
      {draft.isLoading ? (
        <p className="text-[13px] text-ink-muted">Preparing the email…</p>
      ) : draft.error ? (
        <p className="text-[13px] text-danger">{draft.error.message}</p>
      ) : d ? (
        <div className="grid gap-2 text-[13px]">
          {outlook.data && !connected ? (
            <p className="text-info">
              {'The email sends from your own Outlook. '}
              <a href={OUTLOOK_CONNECT_HREF} className="font-medium underline">
                Connect Outlook
              </a>
            </p>
          ) : null}
          <SignNameField id="rcv-paid-sign" value={sign} onChange={changeSign} />
          <RecipientRow field="to" label="To" people={to} contacts={d.contacts} onChange={setTo} />
          <RecipientRow field="cc" label="Cc" people={cc} contacts={d.contacts} onChange={setCc} />
          <label className="grid gap-1 text-[12px] font-medium text-ink-2" htmlFor="rcv-paid-subject">
            Subject
            <Input id="rcv-paid-subject" className="h-8 text-[13px]" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <InvoicesInEmail
            rows={d.invoices.map((i) => ({ id: i.id, clientName: i.clientName, invoiceNo: i.invoiceNo, amountInr: i.receivedInr, status: 'received' as const, paidOn: i.paidOn }))}
            removed={removed}
            hits={hits}
            onToggle={toggle}
          />
          {hits.length ? (
            <p role="alert" className="text-[12.5px] text-warning">
              {`${hits.length} invoice${hits.length === 1 ? ' was' : 's were'} already sent to ${[...new Set(hits.map((h) => h.email))].join(', ')}. Remove ${hits.length === 1 ? 'it' : 'them'}, or change the recipients, to send.`}
            </p>
          ) : null}
          <div
            ref={body}
            role="textbox"
            aria-multiline="true"
            aria-label="Email message"
            contentEditable
            suppressContentEditableWarning
            className="max-h-[48vh] min-h-[220px] overflow-auto rounded-md border-1.5 border-line-strong bg-white p-3 text-[13px] text-black outline-none focus:border-brand focus:ring-4 focus:ring-focus-ring/25"
            dangerouslySetInnerHTML={{ __html: html ?? d.html }}
          />
          <p className="text-[12px] text-ink-muted">A client partner may get this only when every invoice in it is theirs.</p>
        </div>
      ) : null}
    </Modal>
  );
}
