'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import type { ClientDto } from '@/lib/receivables/v2-wire';
import type { PartnerDto } from '@/lib/receivables/wire';
import type { ClientWrite } from '@/hooks/use-receivables-v2';

/** The People tab's dialogs: edit a client partner, pick a partner's clients, and add or edit a client. */

export function EditPartnerDialog({ partner, busy, onClose, onSave }: { partner: PartnerDto; busy: boolean; onClose: () => void; onSave: (patch: { name: string; email: string }) => void }) {
  const [name, setName] = useState(partner.name);
  const [email, setEmail] = useState(partner.email);
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Edit ${partner.name}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !name.trim() || !email.trim()} onClick={() => onSave({ name: name.trim(), email: email.trim() })}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Name" htmlFor="rcv-partner-name">
          <Input id="rcv-partner-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="rcv-partner-email">
          <Input id="rcv-partner-email" type="email" value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export function ManageClientsDialog({
  partner,
  partners,
  clients,
  busy,
  onClose,
  onSave,
}: {
  partner: PartnerDto;
  partners: PartnerDto[];
  clients: ClientDto[];
  busy: boolean;
  onClose: () => void;
  onSave: (clientIds: string[]) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(clients.filter((c) => c.partnerId === partner.id).map((c) => c.id)));
  const [q, setQ] = useState('');
  const shown = clients.filter((c) => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const otherName = (id: string | null) => (id && id !== partner.id ? partners.find((p) => p.id === id)?.name : null);
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Clients of ${partner.name}`}
      sub={`${picked.size} picked. A client picked here moves from any other partner, with its invoices.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => onSave([...picked])}>
            Save clients
          </Button>
        </>
      }
    >
      <div className="grid gap-2">
        <Input type="search" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search clients" />
        <ul className="max-h-[360px] overflow-y-auto rounded-md border border-line">
          {shown.map((c) => (
            <li key={c.id} className="flex items-center gap-2 border-t border-line-soft px-2.5 py-1.5 text-[13px] first:border-t-0">
              <Checkbox
                id={`rcv-mc-${c.id}`}
                checked={picked.has(c.id)}
                onCheckedChange={(v) =>
                  setPicked((prev) => {
                    const next = new Set(prev);
                    if (v === true) next.add(c.id);
                    else next.delete(c.id);
                    return next;
                  })
                }
              />
              <label htmlFor={`rcv-mc-${c.id}`} className="flex-1 cursor-pointer">
                {c.name}
              </label>
              {otherName(c.partnerId) ? <span className="text-[12px] text-ink-muted">{`now ${otherName(c.partnerId)}`}</span> : null}
            </li>
          ))}
          {!shown.length ? <li className="px-2.5 py-3 text-center text-[13px] text-ink-muted">No clients match.</li> : null}
        </ul>
      </div>
    </Modal>
  );
}

export function ClientDialog({ client, partners, busy, onClose, onSave }: { client: ClientDto | null; partners: PartnerDto[]; busy: boolean; onClose: () => void; onSave: (input: ClientWrite) => void }) {
  const [name, setName] = useState(client?.name ?? '');
  const [partnerId, setPartnerId] = useState(client?.partnerId ?? '');
  const [co, setCo] = useState<Set<string>>(new Set(client?.coPartnerIds ?? []));
  const [creditDays, setCreditDays] = useState(String(client?.creditDays ?? 7));
  const [billingEmail, setBillingEmail] = useState(client?.billingEmail ?? '');
  const [cc, setCc] = useState((client?.billingCc ?? []).join(', '));
  const [gstin, setGstin] = useState(client?.gstin ?? '');
  const days = Math.round(Number(creditDays));
  const valid = name.trim() && Number.isFinite(days) && days >= 0 && days <= 365;
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={client ? `Edit ${client.name}` : 'Add client'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || !valid}
            onClick={() =>
              onSave({
                name: name.trim(),
                partnerId: partnerId || null,
                coPartnerIds: [...co].filter((id) => id !== partnerId),
                creditDays: days,
                billingEmail: billingEmail.trim() || null,
                billingCc: cc
                  .split(/[,;\s]+/)
                  .map((x) => x.trim())
                  .filter(Boolean),
                gstin: gstin.trim() || null,
              })
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Client name" htmlFor="rcv-client-name" hint="As Tally names the buyer. Punctuation and case do not matter for matching.">
          <Input id="rcv-client-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Lead partner" htmlFor="rcv-client-partner">
          <select id="rcv-client-partner" className="h-control w-full rounded-md border-1.5 border-line-strong bg-surface-raised px-2 text-[14px]" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">No partner</option>
            {partners
              .filter((p) => p.active || p.id === partnerId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </Field>
        {partnerId ? (
          <fieldset className="grid gap-1">
            <legend className="text-[13px] font-medium text-ink-2">Second partners</legend>
            <p className="text-[12px] text-ink-muted">They share the whole client: its invoice emails, roll-ups and their own summary email. The lead stays on the sheet.</p>
            <ul className="max-h-40 overflow-auto rounded-md border border-line">
              {partners
                .filter((p) => p.id !== partnerId && (p.active || co.has(p.id)))
                .map((p) => (
                  <li key={p.id} className="flex items-center gap-2 border-t border-line-soft px-2.5 py-1.5 text-[13px] first:border-t-0">
                    <Checkbox
                      id={`rcv-co-${p.id}`}
                      checked={co.has(p.id)}
                      onCheckedChange={(v) =>
                        setCo((prev) => {
                          const next = new Set(prev);
                          if (v === true) next.add(p.id);
                          else next.delete(p.id);
                          return next;
                        })
                      }
                    />
                    <label htmlFor={`rcv-co-${p.id}`} className="flex-1 cursor-pointer">
                      {p.name}
                    </label>
                  </li>
                ))}
            </ul>
          </fieldset>
        ) : null}
        <Field label="Credit days" htmlFor="rcv-client-days" hint="Due date = invoice date + credit days.">
          <Input id="rcv-client-days" type="number" min={0} max={365} value={creditDays} onChange={(e) => setCreditDays(e.target.value)} />
        </Field>
        <Field label="Billing email" htmlFor="rcv-client-email" hint="Where Send statement goes.">
          <Input id="rcv-client-email" type="email" value={billingEmail} maxLength={200} onChange={(e) => setBillingEmail(e.target.value)} />
        </Field>
        <Field label="CC" htmlFor="rcv-client-cc" hint="Separate addresses with commas.">
          <Input id="rcv-client-cc" value={cc} onChange={(e) => setCc(e.target.value)} />
        </Field>
        <Field label="GSTIN" htmlFor="rcv-client-gstin">
          <Input id="rcv-client-gstin" className="font-mono" value={gstin} maxLength={20} onChange={(e) => setGstin(e.target.value.toUpperCase())} />
        </Field>
      </div>
    </Modal>
  );
}
