'use client';

import { useId, useRef, useState, useSyncExternalStore } from 'react';
import { AccentButton, Eyebrow, Surface } from '@/components/noir';
import { NoirDatePicker } from '@/components/noir/NoirDatePicker';
import { Plus, AlertCircle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { itemsByBucket } from '@/data/checklist';
import { StatusBadgeWithTimeline } from '@/components/incorporation/ChecklistExpectedTimeline';
import { CountdownChip } from '@/components/common/CountdownChip';
import { ItemDetailSlideOver } from '../ItemDetailSlideOver';
import { SlideOver } from '@/components/common/SlideOver';
import { formatDate } from '@/lib/deadlines';
import { parseISO } from 'date-fns';

interface Remittance {
  id: string;
  date: string;
  firc: string;
  amount: number;
  bank: string;
  status: 'Received' | 'Pending';
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function useTodayIsoDate(): string {
  return useSyncExternalStore(() => () => {}, todayIsoDate, () => '');
}

const EMPTY_DRAFT: Omit<Remittance, 'id'> = {
  date: '',
  firc: '',
  amount: 0,
  bank: '',
  status: 'Pending',
};

export function FemaSection() {
  const remittanceStatusId = useId();
  const nextRemittanceId = useRef(0);
  const todayIso = useTodayIsoDate();
  const { selectedClient, getState } = useApp();
  const [open, setOpen] = useState(false);
  const [remittances, setRemittances] = useState<Remittance[]>([
    { id: 'r1', date: '2026-02-01', firc: 'FIRC-2026-0142', amount: 500000, bank: 'HDFC Bank', status: 'Received' },
  ]);
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  if (!selectedClient) return null;
  const item = itemsByBucket('fema')[0];
  const itState = getState(selectedClient.id)[item.id] || { status: 'not-started' as const };

  const resetDraft = () => setDraft({ ...EMPTY_DRAFT, date: todayIso || '' });

  return (
    <Surface className="p-6">
      <div className="mb-4">
        <Eyebrow>FEMA compliance</Eyebrow>
        <h2 className="serif mt-1 text-lg font-semibold text-foreground">FEMA — FCGPR</h2>
      </div>

      {selectedClient.incorporationDate && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-light p-3 text-xs text-warning-text">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          File FCGPR with RBI <strong>within 30 days</strong> of the date of incorporation.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-raised/30 p-3">
        <span className="text-sm font-medium text-foreground">FCGPR filing</span>
        <StatusBadgeWithTimeline status={itState.status} item={item} />
        <CountdownChip rule={item.deadline} incorporationDate={selectedClient.incorporationDate} />
        <div className="ml-auto">
          <ItemDetailSlideOver item={item} />
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <Eyebrow className="text-[10px]">Inward remittance log</Eyebrow>
          <AccentButton size="sm" className="min-h-11" onClick={() => setOpen(true)}>
            <Plus className="h-3 w-3" /> Log remittance
          </AccentButton>
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-table-header text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">FIRC #</th>
                <th className="px-3 py-2.5">Amount</th>
                <th className="px-3 py-2.5">Bank</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {remittances.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    No inward remittances logged yet.
                  </td>
                </tr>
              ) : (
                remittances.map((r) => (
                  <tr key={r.id} className="hover:bg-raised/40">
                    <td className="px-3 py-2.5 text-foreground">{formatDate(parseISO(r.date))}</td>
                    <td className="px-3 py-2.5 font-mono text-foreground">{r.firc}</td>
                    <td className="px-3 py-2.5 font-medium text-foreground">
                      ₹ {r.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2.5 text-foreground">{r.bank}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          r.status === 'Received'
                            ? 'bg-success-light text-success-text'
                            : 'bg-warning-light text-warning-text'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SlideOver
        open={open}
        onOpenChange={setOpen}
        title="Log inward remittance"
        description="Capture foreign funds received, with FIRC reference and receiving bank."
        footer={
          <div className="flex justify-end gap-2">
            <button type="button"
              onClick={() => setOpen(false)}
              className="min-h-11 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-raised"
            >
              Cancel
            </button>
            <AccentButton
              type="button"
              className="min-h-11"
              onClick={() => {
                setRemittances((r) => [...r, { id: `r${++nextRemittanceId.current}`, ...draft, date: draft.date || todayIso }]);
                resetDraft();
                setOpen(false);
              }}
              disabled={!draft.firc || !draft.bank || draft.amount <= 0}
            >
              Save remittance
            </AccentButton>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Date" type="date" value={draft.date || todayIso} onChange={(v) => setDraft({ ...draft, date: v })} suppressHydrationWarning />
          <Field label="FIRC #" value={draft.firc} onChange={(v) => setDraft({ ...draft, firc: v })} />
          <Field
            label="Amount (INR)"
            type="number"
            value={String(draft.amount)}
            onChange={(v) => setDraft({ ...draft, amount: Number(v) })}
          />
          <Field label="Bank" value={draft.bank} onChange={(v) => setDraft({ ...draft, bank: v })} />
          <div>
            <label htmlFor={remittanceStatusId} className="text-xs font-medium text-foreground">Status</label>
            <select
              id={remittanceStatusId}
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as Remittance['status'] })}
              className="mt-1 w-full min-h-11 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option>Pending</option>
              <option>Received</option>
            </select>
          </div>
        </div>
      </SlideOver>
    </Surface>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  suppressHydrationWarning,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  suppressHydrationWarning?: boolean;
}) {
  const fieldId = useId();
  return (
    <div suppressHydrationWarning={suppressHydrationWarning}>
      <label htmlFor={fieldId} className="text-xs font-medium text-foreground">{label}</label>
      {type === 'date' ? (
        <div className="mt-1">
          <NoirDatePicker id={fieldId} value={value} onChange={onChange} />
        </div>
      ) : (
        <input
          id={fieldId}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full min-h-11 rounded-md border border-border px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
      )}
    </div>
  );
}
