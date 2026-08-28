import { useId } from 'react';
import { Info } from 'lucide-react';
import type { WizardData } from '../OnboardingWizard';

interface Props {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
}

const natures = ['IT Services', 'Manufacturing', 'Trading', 'Consulting', 'Other'];

export function Step1Company({ data, update }: Props) {
  const natureId = useId();
  const shareCapitalId = useId();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Company details</h2>
      </div>

      <Field
        label="Proposed company name"
        required
        value={data.name}
        onChange={(v) => update({ name: v })}
        placeholder="e.g. ABC India Private Limited"
      />
      <Field
        label="Alternate name (optional)"
        value={data.nameAlt}
        onChange={(v) => update({ nameAlt: v })}
        placeholder="Second choice if the primary name is unavailable"
      />

      <div>
        <label htmlFor={natureId} className="text-xs font-medium text-text-secondary">Nature of business</label>
        <select
          id={natureId}
          value={data.nature}
          onChange={(e) => update({ nature: e.target.value })}
          className="mt-1 w-full rounded-md border border-border bg-panel px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {natures.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={shareCapitalId} className="text-xs font-medium text-text-secondary">Proposed share capital (INR)</label>
        <input
          id={shareCapitalId}
          type="number"
          value={data.shareCapital}
          onChange={(e) => update({ shareCapital: Number(e.target.value) })}
          className="mt-1 w-full rounded-md border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="flex items-start gap-2 rounded-md bg-primary-light p-3 text-xs text-primary-dark">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        ROC name approval via RUN typically takes <strong>5–7 working days</strong>.
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const inputId = useId();
  return (
    <div>
      <label htmlFor={inputId} className="text-xs font-medium text-text-secondary">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <input
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}
