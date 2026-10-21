import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { LandingRoles } from '@/components/marketing/sections/LandingRoles';
import { LandingCta } from '@/components/marketing/sections/LandingCta';
import Aurora from '@/components/auth/react-bits/Aurora';
import { Eyebrow } from '@/components/noir';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata(
  'Roles',
  'Manager, Project Lead, and Client portals — one compliance cockpit for Indian professional services firms.',
);

export default function RolesPage() {
  return (
    <MarketingShell>
      <section className="relative isolate overflow-hidden border-b border-line bg-surface">
        {/* The one brand-soft wash on this page. */}
        <Aurora className="opacity-35" variant="light" />

        <div className="relative z-10 mx-auto max-w-6xl px-5 pb-12 pt-32 sm:px-8 sm:pt-36 lg:px-10">
          <Eyebrow>Product</Eyebrow>
          <div className="mt-5 h-px w-12 bg-brand" />
          <h1 className="mt-7 max-w-xl font-serif text-[clamp(2.1rem,4vw,3.1rem)] font-medium leading-[1.08] tracking-[-0.02em] text-ink">
            Built for every seat at the firm.
          </h1>
          <p className="mt-5 max-w-lg text-[15px] leading-[1.7] text-ink-muted sm:text-base">
            Three portals, one system — overview for managers, focus for leads, clarity for clients.
          </p>
          <p className="mt-8 text-sm text-ink-muted">
            <Link href="/" className="font-medium text-brand underline-offset-4 hover:underline">
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
