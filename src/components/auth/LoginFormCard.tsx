'use client';

import { m, useReducedMotion } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AccentButton, GoldDivider, Eyebrow } from '@/components/noir';
import { springGentle, pressScale } from '@/lib/motion';
import { cn } from '@/lib/utils';

export interface LoginFormCardProps {
  email: string;
  password: string;
  showPassword: boolean;
  error: string | null;
  loading: boolean;
  forgotOpen: boolean;
  forgotEmail: string;
  forgotLoading: boolean;
  profileError: string | null;
  resetNotice: string | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onToggleShowPassword: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onForgotOpenChange: (open: boolean) => void;
  onForgotEmailChange: (value: string) => void;
  onForgotSubmit: (e: React.FormEvent) => void;
  onOpenForgot: () => void;
}

function AlertBanner({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: 'error' | 'success' | 'info' | 'warning';
}) {
  const styles = {
    error: 'border-l-danger bg-danger-light border-destructive/20 text-destructive',
    success: 'border-l-success bg-success-light border-success/20 text-success-text',
    info: 'border-l-border bg-raised border-border text-muted-foreground',
    warning: 'border-l-warning bg-warning-light border-warning/20 text-warning-text',
  };
  return (
    <p
      className={cn(
        'mb-4 rounded-md border border-l-[3px] px-3 py-2.5 text-[12px] leading-relaxed',
        styles[variant],
      )}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      {children}
    </p>
  );
}

export function LoginFormCard({
  email,
  password,
  showPassword,
  error,
  loading,
  forgotOpen,
  forgotEmail,
  forgotLoading,
  profileError,
  resetNotice,
  onEmailChange,
  onPasswordChange,
  onToggleShowPassword,
  onSubmit,
  onForgotOpenChange,
  onForgotEmailChange,
  onForgotSubmit,
  onOpenForgot,
}: LoginFormCardProps) {
  const reduceMotion = useReducedMotion();

  return (
    <m.div
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springGentle, delay: reduceMotion ? 0 : 0.15 }}
      className="auth-glass w-full p-6 sm:p-8 md:p-9 lg:p-10"
    >
      <Eyebrow>Sign in</Eyebrow>
      <h2 className="mt-1 font-serif text-[clamp(22px,4.5vw,36px)] font-semibold leading-tight tracking-tight text-foreground">
        Welcome back
      </h2>
      <GoldDivider className="my-6 max-w-[60px]" />

      {profileError === 'no_profile' && (
        <AlertBanner variant="error">
          No profile is linked to this account. Ask your firm admin to complete setup.
        </AlertBanner>
      )}
      {resetNotice === 'check-email' && (
        <AlertBanner variant="info">
          Check your email for a password reset link. After updating your password, sign in here.
        </AlertBanner>
      )}
      {resetNotice === 'success' && (
        <AlertBanner variant="success">Password updated. Sign in with your new password.</AlertBanner>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <Label htmlFor="email" className="text-[11.5px] text-muted-foreground">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="you@company.com"
            className="auth-input mt-1.5"
            autoFocus
            autoComplete="email"
          />
        </div>
        <div>
          <Label htmlFor="password" className="text-[11.5px] text-muted-foreground">
            Password
          </Label>
          <div className="relative mt-1.5">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              className="auth-input pr-12"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={onToggleShowPassword}
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-2 text-right">
            <button
              type="button"
              onClick={onOpenForgot}
              className="rounded-sm text-[11.5px] text-muted-foreground transition-colors hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
            >
              Forgot password?
            </button>
          </div>
        </div>

        {error && (
          <p className="text-[12px] leading-relaxed text-destructive" role="alert">
            {error}
          </p>
        )}

        <m.div {...(reduceMotion ? {} : pressScale)}>
          <AccentButton
            type="submit"
            size="lg"
            className="mt-2 w-full"
            disabled={!email || !password || loading}
          >
            {loading ? (
              <>
                <Loader2 className={cn('h-4 w-4', !reduceMotion && 'animate-spin')} aria-hidden />
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </AccentButton>
        </m.div>
      </form>

      <Dialog open={forgotOpen} onOpenChange={onForgotOpenChange}>
        <DialogContent className="border-border bg-background text-foreground sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-medium text-foreground">Need a new password?</DialogTitle>
            <DialogDescription className="text-[13px] text-muted-foreground">
              Email reset links are not enabled on this pilot. Ask your firm manager for a temporary
              password, then change it from Account settings after you sign in.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onForgotSubmit} className="mt-2 space-y-4">
            <div>
              <Label htmlFor="forgot-email" className="text-[11.5px] text-muted-foreground">
                Your account email
              </Label>
              <Input
                id="forgot-email"
                type="email"
                value={forgotEmail}
                onChange={(e) => onForgotEmailChange(e.target.value)}
                className="auth-input mt-1.5"
                autoComplete="email"
                required
              />
            </div>
            <AccentButton type="submit" size="lg" className="w-full" disabled={!forgotEmail.trim() || forgotLoading}>
              {forgotLoading ? (
                <>
                  <Loader2 className={cn('h-4 w-4', !reduceMotion && 'animate-spin')} aria-hidden />
                  Opening help…
                </>
              ) : (
                'Got it — back to sign in'
              )}
            </AccentButton>
          </form>
        </DialogContent>
      </Dialog>
    </m.div>
  );
}
