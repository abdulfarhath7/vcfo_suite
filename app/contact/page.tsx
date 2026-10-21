import Link from 'next/link';
import { ContactForm } from '@/components/marketing/ContactForm';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import Aurora from '@/components/auth/react-bits/Aurora';
import { Eyebrow } from '@/components/noir';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata(
  'Contact',
  'Talk to the VCFO Suite team about bringing a compliance cockpit to your firm.',
);

export default function ContactPage() {
  return (
    <MarketingShell>
      <section className="relative isolate min-h-[100svh] overflow-hidden bg-surface">
        {/* The one brand-soft wash on this page. */}
        <Aurora className="opacity-40" variant="light" />

        <div className="relative z-10 mx-auto grid max-w-6xl gap-14 px-5 pb-24 pt-32 sm:px-8 sm:pb-28 sm:pt-36 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:px-10 lg:items-start">
          <div className="max-w-md lg:sticky lg:top-32">
            <Eyebrow>Contact</Eyebrow>
            <div className="mt-5 h-px w-12 bg-brand" />
            <h1 className="mt-7 font-serif text-[clamp(2.1rem,4vw,3.1rem)] font-medium leading-[1.08] tracking-[-0.02em] text-ink">
              Tell us about your firm.
            </h1>
            <p className="mt-5 text-[15px] leading-[1.7] text-ink-muted sm:text-base">
              Evaluating VCFO Suite for GCC setup, or need access for an existing engagement — we
              respond promptly.
            </p>
            <p className="mt-10 text-sm text-ink-muted">
              Already have an account?{' '}
                <Link
                  href="/login"
                  className="font-medium text-brand underline-offset-4 transition-colors hover:underline"
                >
                  Sign in
                </Link>
            </p>
          </div>

          <div className="border-t border-line bg-transparent pt-10 lg:border-t-0 lg:border-l lg:pl-12 lg:pt-0">
            <ContactForm />
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
