import { useId } from 'react';
import { Upload } from 'lucide-react';
import type { WizardData } from '../OnboardingWizard';

interface Props {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
}

export function Step3Office({ data, update }: Props) {
  const addressId = useId();
  const set = (patch: Partial<WizardData['office']>) =>
    update({ office: { ...data.office, ...patch } });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Registered office</h2>
      </div>

      <div>
        <label htmlFor={addressId} className="text-xs font-medium text-text-secondary">Registered address</label>
        <textarea
          id={addressId}
          rows={3}
          value={data.office.address}
          onChange={(e) => set({ address: e.target.value })}
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="Door no, street, area, city, state, PIN"
        />
      </div>

      <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
        <input
          type="checkbox"
          checked={data.office.noc}
          onChange={(e) => set({ noc: e.target.checked })}
          className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
        />
        <span className="text-text-secondary">
          I confirm a <strong>No Objection Certificate (NOC)</strong> from the property owner is on
          file for use of this address as the registered office.
        </span>
      </label>

      <div className="rounded-md border border-dashed border-border p-4">
        <div className="mb-2 text-xs font-medium text-text-secondary">
          Proof of address
          <span className="ml-1 text-text-tertiary">(issued within the last two months)</span>
        </div>
        <button type="button"
          onClick={() => set({ utilityBill: !data.office.utilityBill })}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
            data.office.utilityBill
              ? 'border-success/30 bg-success-light text-success-text'
              : 'border-border bg-panel text-text-secondary hover:bg-raised'
          }`}
        >
          <Upload className="h-3.5 w-3.5" />
          {data.office.utilityBill ? 'Proof of address attached' : 'Attach proof of address'}
        </button>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Electricity, gas, landline, or bank statement in the company or director’s name.
        </p>
      </div>
    </div>
  );
}
