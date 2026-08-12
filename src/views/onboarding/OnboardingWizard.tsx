"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';
import { Step1Company } from './steps/Step1Company';
import { Step2Directors, Director } from './steps/Step2Directors';
import { Step3Office } from './steps/Step3Office';
import { Step4Foreign, ForeignData } from './steps/Step4Foreign';
import { Step5Review } from './steps/Step5Review';
import { SEO } from '@/components/SEO';

const steps = ['Company', 'Directors', 'Office', 'Foreign Entity', 'Review'];

export interface WizardData {
  name: string;
  nameAlt: string;
  nature: string;
  shareCapital: number;
  directors: Director[];
  office: { address: string; noc: boolean; utilityBill: boolean };
  foreign: ForeignData;
}

const initialData: WizardData = {
  name: '',
  nameAlt: '',
  nature: 'IT Services',
  shareCapital: 1000000,
  directors: [
    { key: 'director-seed-1', name: '', resident: true, idNumber: '', addressProof: 'Aadhaar', email: '', mobile: '' },
    { key: 'director-seed-2', name: '', resident: false, idNumber: '', addressProof: 'Passport', email: '', mobile: '' },
  ],
  office: { address: '', noc: false, utilityBill: false },
  foreign: {
    enabled: false,
    parentName: '',
    country: '',
    coiUploaded: false,
    coiApostilled: false,
    moaUploaded: false,
    moaApostilled: false,
    brUploaded: false,
    brApostilled: false,
    repName: '',
    repPassport: '',
    shareholders: [{ key: 'shareholder-seed-1', name: '', percent: 100 }],
  },
};

export default function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(initialData);
  const { addClient } = useApp();
  const router = useRouter();

  const update = (patch: Partial<WizardData>) => setData((d) => ({ ...d, ...patch }));

  const canNext = () => {
    if (step === 0) return data.name.trim().length > 1 && data.shareCapital > 0;
    if (step === 1) {
      const valid = data.directors.every((d) => d.name && d.idNumber && d.email && d.mobile);
      const resident = data.directors.some((d) => d.resident);
      return valid && resident && data.directors.length >= 2;
    }
    if (step === 2) return data.office.address.length > 5 && data.office.noc && data.office.utilityBill;
    if (step === 3) {
      if (!data.foreign.enabled) return true;
      const sum = data.foreign.shareholders.reduce((a, b) => a + (b.percent || 0), 0);
      return (
        data.foreign.parentName &&
        data.foreign.country &&
        data.foreign.coiUploaded &&
        data.foreign.moaUploaded &&
        data.foreign.brUploaded &&
        sum === 100
      );
    }
    return true;
  };

  const submit = () => {
    addClient({
      name: data.name,
      stage: 'Pre-Incorporation',
      incorporationDate: null,
      nature: data.nature,
      shareCapital: data.shareCapital,
    });
    router.push('/incorporation');
  };

  return (
    <div className="-m-6 min-h-[calc(100vh-3.5rem)] bg-background p-6">
      <SEO title="Client onboarding — VCFO Suite" description="Five-step wizard to capture company details and generate a tailored compliance checklist." path="/onboarding" />
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">Client onboarding</h1>
          <button type="button"
            onClick={() => router.push('/')}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>

        {/* Stepper */}
        <div className="mt-6 flex items-center">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                  i < step && 'bg-primary text-primary-foreground',
                  i === step && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                  i > step && 'bg-muted text-muted-foreground'
                )}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  'ml-2 text-xs font-medium',
                  i <= step ? 'text-foreground' : 'text-text-tertiary'
                )}
              >
                {s}
              </span>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    'mx-3 h-px w-8',
                    i < step ? 'bg-primary' : 'bg-border'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step body */}
        <div className="mt-6 surface p-6">
          {step === 0 && <Step1Company data={data} update={update} />}
          {step === 1 && <Step2Directors data={data} update={update} />}
          {step === 2 && <Step3Office data={data} update={update} />}
          {step === 3 && <Step4Foreign data={data} update={update} />}
          {step === 4 && <Step5Review data={data} />}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-between">
          <button type="button"
            onClick={() => (step === 0 ? router.push('/') : setStep((s) => s - 1))}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-raised"
          >
            <ArrowLeft className="h-4 w-4" /> {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < steps.length - 1 ? (
            <button type="button"
              onClick={() => canNext() && setStep((s) => s + 1)}
              disabled={!canNext()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button"
              onClick={submit}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary-dark"
            >
              <Check className="h-4 w-4" /> Create client & checklist
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
