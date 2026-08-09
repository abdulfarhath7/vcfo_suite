'use client';

import { User, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { GoldDivider } from '@/components/noir/GoldDivider';
import { CreateFormSection, FieldError } from '@/components/admin/create-project-form-shared';
import { cn } from '@/lib/utils';

export function CreateProjectFormClientSection(props: Record<string, unknown>) {
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
    onCancel,
    submit,
    submitting,
  } = props as Record<string, unknown>;

  return (
    <>
      <GoldDivider />
      <CreateFormSection
        eyebrow="Client portal access"
        hint="Enter the client email — we create their login automatically with the initial password below (prefilled SBC@2026)."
      >
        <div>
          <Label htmlFor="create-client-contact" className="text-[12px] flex items-center gap-1.5 text-text-secondary">
            <User className="w-3.5 h-3.5" aria-hidden />
            Client contact name <span className="text-text-tertiary font-normal">(optional)</span>
          </Label>
          <Input
            id="create-client-contact"
            value={clientContact as string}
            onChange={(e) => (setClientContact as (v: string) => void)(e.target.value)}
            placeholder="e.g. Priya Nair, Director"
            className="mt-1.5 h-9 text-[13px]"
            maxLength={120}
          />
        </div>
        <div>
          <Label htmlFor="create-client-email" className="text-[12px] flex items-center gap-1.5 text-text-secondary">
            <Mail className="w-3.5 h-3.5" aria-hidden />
            Client sign-in email <span className="text-danger font-normal">*</span>
          </Label>
          <Input
            id="create-client-email"
            type="email"
            value={clientEmail as string}
            onChange={(e) => (setClientEmail as (v: string) => void)(e.target.value)}
            placeholder="founder@abc.in"
            className={cn(
              'mt-1.5 h-9 text-[13px]',
              (fieldError as (k: string) => string | undefined)('clientEmail') && 'border-danger focus-visible:ring-danger/30',
            )}
            maxLength={160}
            autoComplete="email"
            required
          />
          <FieldError
            id="create-client-email-error"
            message={(fieldError as (k: string) => string | undefined)('clientEmail')}
          />
        </div>
        <div>
          <Label htmlFor="create-client-password" className="text-[12px] flex items-center gap-1.5 text-text-secondary">
            <Lock className="w-3.5 h-3.5" aria-hidden />
            Initial portal password <span className="text-danger font-normal">*</span>
          </Label>
          <div className="relative mt-1.5">
            <Input
              id="create-client-password"
              type={showPassword ? 'text' : 'password'}
              value={clientPassword as string}
              onChange={(e) => (setClientPassword as (v: string) => void)(e.target.value)}
              className="h-9 text-[13px] pr-10"
              minLength={8}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => (setShowPassword as (v: boolean) => void)(!(showPassword as boolean))}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-text-tertiary hover:text-orange-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <FieldError
            id="create-client-password-error"
            message={(fieldError as (k: string) => string | undefined)('clientPassword')}
          />
          {pwStrength ? (
            <p className="mt-1 text-[11px] text-text-tertiary">
              Strength:{' '}
              <span className="font-medium capitalize text-foreground">{pwStrength as string}</span>
            </p>
          ) : null}
          <p className="mt-1 text-[11px] text-text-tertiary">
            Creating the project also creates this client account.
          </p>
        </div>
      </CreateFormSection>
      <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-border">
        {onCancel ? (
          <Button type="button" variant="outline" size="sm" onClick={onCancel as () => void} disabled={submitting as boolean}>
            Discard
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          onClick={submit as () => void}
          disabled={submitting as boolean}
          className="gold-sheen"
        >
          {submitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" aria-hidden />
              Creating GCC project…
            </>
          ) : (
            'Create project & portal access'
          )}
        </Button>
      </div>
    </>
  );
}
