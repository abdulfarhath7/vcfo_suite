'use client';

import { useRouter } from 'next/navigation';
import { m } from 'framer-motion';
import { SEO } from '@/components/SEO';
import { AccentButton, GoldDivider, GrainOverlay, Eyebrow, Mono, TrustBadge } from '@/components/noir';
import { SbcLogo } from '@/components/brand/SbcLogo';
import { ease } from '@/lib/motion';
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
    <div className="min-h-screen grid lg:grid-cols-[1fr_1.05fr] bg-background" data-role="admin">
      <SEO
        title="Password help — VCFO Suite"
        description="How to update your VCFO Suite password."
        path="/auth/reset-password"
      />

      <div className="relative hidden lg:flex flex-col justify-between bg-gradient-to-br from-orange-600 to-orange-700 text-white p-12 overflow-hidden">
        <GrainOverlay className="opacity-10" />
        <div className="relative z-10 flex items-center gap-3">
          <SbcLogo variant="mark" size={36} decorative />
          <div>
            <div className="text-[13px] font-medium tracking-tight text-white">VCFO Suite</div>
            <Eyebrow className="mt-0.5 text-orange-100">Account security</Eyebrow>
          </div>
        </div>

        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0.1 }}
          className="relative z-10 max-w-md"
        >
          <Eyebrow className="mb-4 text-orange-100">Password help</Eyebrow>
          <h1 className="display-lg text-white">
            Use your <em className="italic text-orange-200">issued password</em>
          </h1>
          <GoldDivider className="my-6 max-w-[60px] opacity-60" />
          <p className="text-sm text-orange-50/90 leading-relaxed prose-narrow">
            Sign in with the temporary password from your welcome email, then ask your firm
            manager if you need a new one issued.
          </p>
          <TrustBadge className="mt-5">Pilot · manager-issued credentials</TrustBadge>
        </m.div>

        <div className="relative z-10 text-[11px] text-orange-100/70">
          <Mono>Auth.js session</Mono>
        </div>
      </div>

      <div className="relative flex items-center justify-center p-6 lg:p-12">
        <div className="absolute right-4 top-4 z-20">
          <ThemeToggle />
        </div>
        <GrainOverlay className="fixed inset-0 pointer-events-none opacity-20 lg:hidden" />
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease }}
          className="auth-glass relative z-10 w-full max-w-md p-8"
        >
          <Eyebrow>Reset</Eyebrow>
          <h2 className="mt-1 text-[clamp(22px,4.5vw,32px)] font-serif leading-tight text-foreground">
            Email reset is not enabled
          </h2>
          <GoldDivider className="my-6 max-w-[60px]" />
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            This pilot uses Auth.js email/password accounts. There is no recovery link yet.
            Sign in with the password you were given, or contact your firm manager to have a
            temporary password re-issued.
          </p>
          <AccentButton className="mt-8 w-full" onClick={() => router.push('/login')}>
            Back to sign in
          </AccentButton>
        </m.div>
      </div>
    </div>
  );
}
