import { useId } from 'react';
import { Trash2, Plus, AlertTriangle } from 'lucide-react';
import type { WizardData } from '../OnboardingWizard';
import { newBrowserId } from '@/lib/browser-id';

export interface Director {
  key: string;
  name: string;
  resident: boolean;
  idNumber: string;
  addressProof: string;
  email: string;
  mobile: string;
}

interface Props {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
}

export function Step2Directors({ data, update }: Props) {
  const setDir = (i: number, patch: Partial<Director>) => {
    const next = data.directors.map((d, idx) => (idx === i ? { ...d, ...patch } : d));
    update({ directors: next });
  };

  const addDir = () =>
    update({
      directors: [
        ...data.directors,
        { name: '', resident: false, idNumber: '', addressProof: 'Passport', email: '', mobile: '', key: newBrowserId() },
      ],
    });

  const removeDir = (i: number) =>
    update({ directors: data.directors.filter((_, idx) => idx !== i) });

  const hasResident = data.directors.some((d) => d.resident);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Directors</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            At least two directors required; one must be resident in India.
          </p>
        </div>
        <button type="button"
          onClick={addDir}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-raised"
        >
          <Plus className="h-3.5 w-3.5" /> Add another director
        </button>
      </div>

      {!hasResident && (
        <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-light p-3 text-xs text-danger-text">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          At least one director must be an Indian resident.
        </div>
      )}

      <div className="space-y-3">
        {data.directors.map((d, i) => (
          <div key={d.key} className="rounded-md border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-text-secondary">Director #{i + 1}</span>
              {data.directors.length > 2 && (
                <button type="button"
                  onClick={() => removeDir(i)}
                  className="text-text-tertiary hover:text-danger"
                  aria-label="Remove director"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Full name" value={d.name} onChange={(v) => setDir(i, { name: v })} />
              <div>
                <span id={`director-${i}-residency-label`} className="text-xs font-medium text-text-secondary">Residency</span>
                <fieldset
                  aria-labelledby={`director-${i}-residency-label`}
                  className="mt-1 flex gap-1 rounded-md border border-border p-0.5"
                >
                  {[
                    { label: 'Indian resident', val: true },
                    { label: 'Non-resident', val: false },
                  ].map((o) => (
                    <button type="button"
                      key={o.label}
                      onClick={() =>
                        setDir(i, {
                          resident: o.val,
                          addressProof: o.val ? 'Aadhaar' : 'Passport',
                        })
                      }
                      className={`flex-1 rounded-[5px] px-2 py-1 text-xs font-medium ${
                        d.resident === o.val
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-raised'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </fieldset>
              </div>
              <Field
                label={d.resident ? 'PAN number' : 'Passport number'}
                value={d.idNumber}
                onChange={(v) => setDir(i, { idNumber: v })}
              />
              <div>
                <label htmlFor={`director-${i}-address-proof`} className="text-xs font-medium text-text-secondary">Address proof type</label>
                <select
                  id={`director-${i}-address-proof`}
                  value={d.addressProof}
                  onChange={(e) => setDir(i, { addressProof: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-panel px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {(d.resident
                    ? ['Aadhaar', 'Voter ID', 'Driving Licence']
                    : ['Passport', 'Driving Licence']
                  ).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
              <Field label="Email" value={d.email} onChange={(v) => setDir(i, { email: v })} />
              <Field label="Mobile" value={d.mobile} onChange={(v) => setDir(i, { mobile: v })} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const inputId = useId();
  return (
    <div>
      <label htmlFor={inputId} className="text-xs font-medium text-text-secondary">{label}</label>
      <input
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}
