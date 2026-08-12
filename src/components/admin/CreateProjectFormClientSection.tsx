'use client';

import { User, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FieldError } from '@/components/admin/create-project-form-shared';
import { cn } from '@/lib/utils';

const fieldLabelClass =
  'flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground';
const fieldControlClass = 'mt-2 h-11 px-3.5 text-[14px]';

/** Client portal fields — used inside the create-project accordion. */
export function CreateProjectClientFields(props: Record<string, unknown>) {
  const {
    clientContact,
    setClientContact,
    clientEmail,
    setClientEmail,
    clientPassword,
    setClientPassword,
    showPassword,
    setShowPassword,
    fieldError,
    pwStrength,
  } = props as {
    clientContact: string;
    setClientContact: (v: string) => void;
    clientEmail: string;
    setClientEmail: (v: string) => void;
    clientPassword: string;
    setClientPassword: (v: string) => void;
    showPassword: boolean;
    setShowPassword: (v: boolean) => void;
    fieldError: (k: string) => string | undefined;
    pwStrength: 'weak' | 'fair' | 'strong' | null;
  };

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <p className="text-[12.5px] leading-snug text-muted-foreground">
          We create their login with the initial password below (prefilled SBC@2026).
        </p>
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="create-client-contact" className={fieldLabelClass}>
          <User className="h-3.5 w-3.5" aria-hidden />
          Client contact name <span className="font-normal">(optional)</span>
        </Label>
        <Input
          id="create-client-contact"
          value={clientContact}
          onChange={(e) => setClientContact(e.target.value)}
          placeholder="e.g. Priya Nair, Director"
          className={fieldControlClass}
          maxLength={120}
        />
      </div>
      <div>
        <Label htmlFor="create-client-email" className={fieldLabelClass}>
          <Mail className="h-3.5 w-3.5" aria-hidden />
          Client sign-in email <span className="font-normal text-danger">*</span>
        </Label>
        <Input
          id="create-client-email"
          type="email"
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
          placeholder="founder@abc.in"
          className={cn(
            fieldControlClass,
            fieldError('clientEmail') && 'border-danger focus-visible:ring-danger/30',
          )}
          maxLength={160}
          autoComplete="email"
          required
        />
        <FieldError id="create-client-email-error" message={fieldError('clientEmail')} />
      </div>
      <div>
        <Label htmlFor="create-client-password" className={fieldLabelClass}>
          <Lock className="h-3.5 w-3.5" aria-hidden />
          Initial portal password <span className="font-normal text-danger">*</span>
        </Label>
        <div className="relative mt-2">
          <Input
            id="create-client-password"
            type={showPassword ? 'text' : 'password'}
            value={clientPassword}
            onChange={(e) => setClientPassword(e.target.value)}
            className="h-11 px-3.5 pr-11 text-[14px]"
            minLength={8}
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-orange-700"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <FieldError id="create-client-password-error" message={fieldError('clientPassword')} />
        {pwStrength ? (
          <p className="mt-1.5 text-[11.5px] text-muted-foreground">
            Strength: <span className="font-medium capitalize text-foreground">{pwStrength}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** @deprecated Prefer CreateProjectClientFields — kept for import compatibility. */
export function CreateProjectFormClientSection(props: Record<string, unknown>) {
  return <CreateProjectClientFields {...props} />;
}
