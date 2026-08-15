'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { SbcLogo } from '@/components/brand/SbcLogo';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/roles', label: 'Roles' },
  { href: '/contact', label: 'Contact' },
] as const;

/** Floating marketing nav — SSR/client markup stays identical until after mount. */
export function MarketingNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mounted) return;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open, mounted]);

  // Same classes on server + first client paint (avoid hydration mismatch)
  const elevated = mounted && (scrolled || open);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <div
        className={cn(
          'pointer-events-auto relative mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 rounded-2xl border px-3 transition-[background-color,box-shadow,border-color,backdrop-filter] duration-300 sm:h-[3.75rem] sm:px-4 lg:px-5',
          elevated
            ? 'border-border/70 bg-background/90 shadow-[0_12px_40px_-16px_oklch(var(--shadow-ink)/0.28)] backdrop-blur-xl'
            : 'border-border/50 bg-background/75 shadow-[0_8px_32px_-18px_oklch(var(--shadow-ink)/0.18)] backdrop-blur-md',
        )}
      >
        <Link
          href="/"
          className="relative z-10 shrink-0 transition-opacity hover:opacity-80"
          aria-label="VCFO Suite home"
        >
          <SbcLogo variant="full" size={34} decorative={false} />
        </Link>

        <nav
          className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 md:flex"
          aria-label="Primary"
        >
          {LINKS.map((link) => {
            const active =
              (link.href === '/contact' && pathname === '/contact') ||
              (link.href === '/roles' && pathname === '/roles');
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[13px] font-medium tracking-tight transition-colors',
                  active
                    ? 'bg-blue-50 text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-1.5 md:flex">
          <Link
            href="/login"
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium tracking-tight text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/contact"
            className="gold-sheen inline-flex h-9 items-center justify-center rounded-xl px-3.5 text-[13px] font-medium tracking-tight transition-[filter] hover:brightness-105"
          >
            Request demo
          </Link>
        </div>

        <button
          type="button"
          className="relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-xl text-foreground md:hidden"
          aria-expanded={open}
          aria-controls="marketing-mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" strokeWidth={1.75} /> : <Menu className="h-5 w-5" strokeWidth={1.75} />}
        </button>

        {/* Mount after hydration so `inert` / discrete display never mismatch SSR */}
        {mounted ? (
          <div
            id="marketing-mobile-nav"
            data-state={open ? 'open' : 'closed'}
            className="discrete-nav-panel absolute inset-x-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-2xl border border-border/70 bg-background/95 shadow-[0_16px_40px_-16px_oklch(var(--shadow-ink)/0.3)] backdrop-blur-xl md:hidden"
            inert={!open}
          >
            <nav className="flex flex-col px-3 py-3" aria-label="Mobile">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-3 font-serif text-xl font-normal tracking-tight text-foreground hover:bg-blue-50/80"
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-2 space-y-2 border-t border-border/60 pt-3">
                <Link
                  href="/contact"
                  onClick={() => setOpen(false)}
                  className="gold-sheen flex h-11 items-center justify-center rounded-xl text-sm font-medium"
                >
                  Request demo
                </Link>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex h-10 items-center justify-center text-sm font-medium text-muted-foreground"
                >
                  Sign in
                </Link>
              </div>
            </nav>
          </div>
        ) : null}
      </div>
    </header>
  );
}
