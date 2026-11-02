import Link from 'next/link';
import { ContactForm } from '@/components/marketing/ContactForm';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata(
  'Book a demo',
  'Book a demo of VCFO Suite, the compliance cockpit for incorporation and statutory filings.',
);

/**
 * /contact keeps the Book a demo form as a page for direct links and the marketing nav. The landing
 * and the sign-in card open the same request as a dialog. The card copies the dialog's look (VCFO
 * Spectrum Modal): a 52 px head with the title, the R-47 fields, and "Send" at the bottom right.
 */
export default function ContactPage() {
  return (
    <MarketingShell>
      <section className="mx-auto grid min-h-[100svh] w-full max-w-[560px] content-center gap-4 px-4 pb-24 pt-28 sm:pt-32">
        <div className="overflow-hidden rounded-md border border-line bg-surface-raised shadow-dialog">
          <header className="flex min-h-head items-center border-b border-line-soft px-4 py-3 md:px-5">
            <h1 className="text-[15px] font-medium leading-snug text-ink">Book a demo</h1>
          </header>
          <div className="px-4 py-4 md:px-5">
            <ContactForm />
          </div>
        </div>
        <p className="text-center text-[13px] text-ink-muted">
          Already have an account?{' '}
          <Link
            href="/login"
            className="rounded-sm font-semibold text-brand-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            Sign in
          </Link>
        </p>
      </section>
    </MarketingShell>
  );
}
