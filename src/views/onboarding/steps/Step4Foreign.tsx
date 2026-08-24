'use client';

import { useId, useRef } from 'react';
import { Plus, Trash2, Upload, AlertTriangle } from 'lucide-react';
import type { WizardData } from '../OnboardingWizard';

export interface ForeignData {
  enabled: boolean;
  parentName: string;
  country: string;
  coiUploaded: boolean;
  coiApostilled: boolean;
  moaUploaded: boolean;
  moaApostilled: boolean;
  brUploaded: boolean;
  brApostilled: boolean;
  repName: string;
  repPassport: string;
  shareholders: { key: string; name: string; percent: number }[];
}

interface Props {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
}

export function Step4Foreign({ data, update }: Props) {
  const set = (patch: Partial<ForeignData>) =>
    update({ foreign: { ...data.foreign, ...patch } });

  const shareholderKeyRef = useRef(0);
  const makeShareholderKey = () => `shareholder-${++shareholderKeyRef.current}`;

  const totalShare = data.foreign.shareholders.reduce((a, b) => a + (b.percent || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Foreign parent entity</h2>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-text-secondary">
          <input
            type="checkbox"
            checked={data.foreign.enabled}
            onChange={(e) => set({ enabled: e.target.checked })}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          Overseas parent entity
        </label>
      </div>

      {!data.foreign.enabled ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
          No overseas parent.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Parent company name" value={data.foreign.parentName} onChange={(v) => set({ parentName: v })} />
            <Field label="Country of incorporation" value={data.foreign.country} onChange={(v) => set({ country: v })} />
          </div>

          <div className="space-y-2">
            <UploadRow
              label="Certificate of Incorporation"
              uploaded={data.foreign.coiUploaded}
              apostilled={data.foreign.coiApostilled}
              onToggleUpload={() => set({ coiUploaded: !data.foreign.coiUploaded })}
              onToggleApostille={() => set({ coiApostilled: !data.foreign.coiApostilled })}
            />
            <UploadRow
              label="MOA / Articles of Organization"
              uploaded={data.foreign.moaUploaded}
              apostilled={data.foreign.moaApostilled}
              onToggleUpload={() => set({ moaUploaded: !data.foreign.moaUploaded })}
              onToggleApostille={() => set({ moaApostilled: !data.foreign.moaApostilled })}
            />
            <UploadRow
              label="Board resolution (authorised representative)"
              uploaded={data.foreign.brUploaded}
              apostilled={data.foreign.brApostilled}
              onToggleUpload={() => set({ brUploaded: !data.foreign.brUploaded })}
              onToggleApostille={() => set({ brApostilled: !data.foreign.brApostilled })}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Authorised representative" value={data.foreign.repName} onChange={(v) => set({ repName: v })} />
            <Field label="Representative passport number" value={data.foreign.repPassport} onChange={(v) => set({ repPassport: v })} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold text-text-secondary">Shareholding pattern</div>
              <button type="button"
                onClick={() =>
                  set({
                    shareholders: [...data.foreign.shareholders, { key: makeShareholderKey(), name: '', percent: 0 }],
                  })
                }
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-text-secondary hover:bg-raised"
              >
                <Plus className="h-3 w-3" /> Add shareholder
              </button>
            </div>
            <div className="space-y-2">
              {data.foreign.shareholders.map((s, i) => (
                <div key={s.key} className="flex items-center gap-2">
                  <input
                    value={s.name}
                    onChange={(e) => {
                      const next = [...data.foreign.shareholders];
                      next[i] = { ...next[i], name: e.target.value };
                      set({ shareholders: next });
                    }}
                    aria-label="Shareholder legal name"
                    placeholder="Legal name of shareholder"
                    className="flex-1 rounded-md border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <input
                    type="number"
                    value={s.percent}
                    onChange={(e) => {
                      const next = [...data.foreign.shareholders];
                      next[i] = { ...next[i], percent: Number(e.target.value) };
                      set({ shareholders: next });
                    }}
                    aria-label="Shareholding percentage"
                    placeholder="%"
                    className="w-20 rounded-md border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {data.foreign.shareholders.length > 1 && (
                    <button type="button"
                      onClick={() =>
                        set({
                          shareholders: data.foreign.shareholders.filter((_, idx) => idx !== i),
                        })
                      }
                      className="text-text-tertiary hover:text-danger"
                      aria-label="Remove shareholder"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div
              className={`mt-2 flex items-center justify-between rounded-md px-3 py-2 text-xs font-medium ${
                totalShare === 100
                  ? 'bg-success-light text-success-text'
                  : 'bg-danger-light text-danger-text'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {totalShare !== 100 && <AlertTriangle className="h-3.5 w-3.5" />}
                Total shareholding
              </span>
              <span>{totalShare}%</span>
            </div>
          </div>
        </>
      )}
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

function UploadRow({
  label,
  uploaded,
  apostilled,
  onToggleUpload,
  onToggleApostille,
}: {
  label: string;
  uploaded: boolean;
  apostilled: boolean;
  onToggleUpload: () => void;
  onToggleApostille: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border p-2.5">
      <button type="button"
        onClick={onToggleUpload}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
          uploaded
            ? 'border-success/30 bg-success-light text-success-text'
            : 'border-border bg-panel text-text-secondary hover:bg-raised'
        }`}
      >
        <Upload className="h-3 w-3" />
        {uploaded ? 'Document attached' : 'Attach document'}
      </button>
      <span className="flex-1 text-sm text-text-secondary">{label}</span>
      <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={apostilled}
          onChange={onToggleApostille}
          className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
        />
        Apostilled
      </label>
    </div>
  );
}
