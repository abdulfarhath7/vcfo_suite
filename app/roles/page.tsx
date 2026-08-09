import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { LandingRoles } from '@/components/marketing/sections/LandingRoles';
import { LandingCta } from '@/components/marketing/sections/LandingCta';
import Aurora from '@/components/auth/react-bits/Aurora';
import { Eyebrow, GrainOverlay } from '@/components/noir';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata(
  'Roles',
  'Manager, Project Lead, and Client portals — one compliance cockpit for Indian professional services firms.',
);

export default function RolesPage() {
  return (
    <MarketingShell>
      <section className="relative isolate overflow-hidden border-b border-border/40">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 55% at 80% 0%, oklch(var(--orange-100) / 0.5), transparent 55%),
              linear-gradient(180deg, oklch(var(--background)), oklch(var(--raised) / 0.5))
            `,
          }}
        />
        <Aurora className="opacity-35" variant="light" />
        <GrainOverlay className="opacity-[0.05]" />

        <div className="relative z-10 mx-auto max-w-6xl px-5 pb-12 pt-32 sm:px-8 sm:pt-36 lg:px-10">
          <Eyebrow>Product</Eyebrow>
          <div className="mt-5 h-px w-12 bg-gradient-to-r from-orange-500 to-transparent" />
          <h1 className="mt-7 max-w-xl font-serif text-[clamp(2.1rem,4vw,3.1rem)] font-medium leading-[1.08] tracking-[-0.02em] text-foreground">
            Built for every seat at the firm.
          </h1>
          <p className="mt-5 max-w-lg text-[15px] leading-[1.7] text-muted-foreground sm:text-base">
            Three portals, one system — overview for managers, focus for leads, clarity for clients.
          </p>
          <p className="mt-8 text-sm text-muted-foreground">
            <Link href="/" className="font-medium text-orange-700 underline-offset-4 hover:underline">
              ← Back to home
            </Link>
          </p>
        </div>
      </section>

      <LandingRoles />
      <LandingCta />
    </MarketingShell>
  );
}
