'use client';

import { useRouter } from 'next/navigation';
import { m } from 'framer-motion';
import { SEO } from '@/components/SEO';
import { Eyebrow, Mono, TrustBadge } from '@/components/noir';
import { Button } from '@/components/ui/button';
import { SbcLogo } from '@/components/brand/SbcLogo';
import { ease } from '@/lib/shell/motion';
import { ThemeToggle } from '@/components/common/ThemeToggle';

/**
 * Email-link password recovery was Supabase-only. Auth.js Credentials on this
 * pilot do not issue recovery tokens. Users sign in with the temporary password
 * from their welcome email, then change it via POST /api/account/password
 * (or ask a manager to re-issue credentials).
 */
export default function ResetPassword() {
  const router = useRouter();

  return (
    <div className="public-lockup-theme min-h-screen grid lg:grid-cols-[1fr_1.05fr] bg-surface" data-role="admin">
      <SEO
        title="Password help — VCFO Suite"
        description="How to update your VCFO Suite password."
        path="/auth/reset-password"
      />

      {/* Navy side panel: `side` is the one fixed-dark surface, so the copy stays light in both themes. */}
      <div className="relative hidden lg:flex flex-col justify-between bg-side text-side-ink p-12 overflow-hidden">
        <div className="relative z-10">
          <SbcLogo variant="lockup" size={36} surface="dark" decorative />
        </div>

        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0.1 }}
          className="relative z-10 max-w-md"
        >
          <Eyebrow className="mb-4 text-side-muted">Password help</Eyebrow>
          <h1 className="display-lg text-side-ink">
            Use your <em className="italic text-side-muted">issued password</em>
          </h1>
          <div className="my-6 h-px w-[60px] bg-side-muted" aria-hidden />
          <p className="text-sm text-side-muted leading-relaxed prose-narrow">
            Sign in with the temporary password from your welcome email, then ask your firm
            manager if you need a new one issued.
          </p>
          <TrustBadge className="mt-5">Pilot · manager-issued credentials</TrustBadge>
        </m.div>

        <div className="relative z-10 text-[11px] text-side-muted">
          <Mono>Auth.js session</Mono>
        </div>
      </div>

      <div className="relative flex items-center justify-center p-6 lg:p-12">
        <div className="absolute right-4 top-4 z-20">
          <ThemeToggle />
        </div>
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease }}
          className="relative z-10 w-full max-w-md rounded-lg border border-line bg-surface-raised p-8 shadow-card"
        >
          <Eyebrow>Reset</Eyebrow>
          <h2 className="mt-1 text-[clamp(22px,4.5vw,32px)] font-serif leading-tight text-ink">
            Email reset is not enabled
          </h2>
          <div className="my-6 h-px w-[60px] bg-brand" aria-hidden />
          <p className="text-[13px] text-ink-muted leading-relaxed">
            This pilot uses Auth.js email/password accounts. There is no recovery link yet.
            Sign in with the password you were given, or contact your firm manager to have a
            temporary password re-issued.
          </p>
          <Button size="lg" className="mt-8 w-full" onClick={() => router.push('/login')}>
            Back to sign in
          </Button>
        </m.div>
      </div>
    </div>
  );
}
