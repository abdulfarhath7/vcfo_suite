import Link from 'next/link';
import { SbcLogo } from '@/components/brand/SbcLogo';

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/50 bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-5 py-14 sm:px-8 sm:py-16 lg:flex-row lg:items-start lg:justify-between lg:px-10">
        <div className="max-w-xs">
          <SbcLogo variant="full" size={34} />
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            Compliance cockpit for GCC setup, filings, and client collaboration.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-14 gap-y-8">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Product
            </p>
            <ul className="mt-4 space-y-3 text-sm text-foreground/85">
              <li>
                <Link href="/#how-it-works" className="transition-colors hover:text-orange-700">
                  How it works
                </Link>
              </li>
              <li>
                <Link href="/roles" className="transition-colors hover:text-orange-700">
                  Roles
                </Link>
              </li>
              <li>
                <Link href="/login" className="transition-colors hover:text-orange-700">
                  Sign in
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Company
            </p>
            <ul className="mt-4 space-y-3 text-sm text-foreground/85">
              <li>
                <Link href="/contact" className="transition-colors hover:text-orange-700">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-border/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <span>© {year} VCFO Suite</span>
          <span>India · MCA · RBI</span>
        </div>
      </div>
    </footer>
  );
}
