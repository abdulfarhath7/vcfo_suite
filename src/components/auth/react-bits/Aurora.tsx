'use client';

import { cn } from '@/lib/utils';

interface AuroraProps {
  className?: string;
  /** Light hero uses softer orange stops; dark hero uses deeper brand tones. */
  variant?: 'light' | 'dark';
}

const GRADIENTS = {
  light: [
    'radial-gradient(ellipse 90% 70% at 25% 35%, oklch(var(--orange-100) / 0.5) 0%, transparent 60%)',
    'radial-gradient(ellipse 80% 55% at 75% 55%, oklch(var(--orange-200) / 0.28) 0%, transparent 55%)',
    'radial-gradient(ellipse 100% 45% at 50% 100%, oklch(var(--orange-100) / 0.22) 0%, transparent 50%)',
  ],
  dark: [
    'radial-gradient(ellipse 80% 60% at 30% 40%, oklch(var(--orange-600) / 0.33) 0%, transparent 55%)',
    'radial-gradient(ellipse 70% 50% at 70% 60%, oklch(var(--orange-700) / 0.27) 0%, transparent 50%)',
    'radial-gradient(ellipse 90% 40% at 50% 100%, oklch(var(--orange-800) / 0.2) 0%, transparent 45%)',
  ],
} as const;

/**
 * CSS aurora — lightweight alternative to WebGL Aurora (no ogl dep, mobile-safe).
 * Gradient stops use the orange brand scale from CSS custom properties.
 */
export default function Aurora({ className, variant = 'dark' }: AuroraProps) {
  const [g1, g2, g3] = GRADIENTS[variant];
  const fadeClass = variant === 'light' ? 'to-background/50' : 'to-foreground/85';

  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden
    >
      <div
        className="absolute -inset-[40%] opacity-70 motion-reduce:animate-none animate-auth-aurora-a"
        style={{ background: g1 }}
      />
      <div
        className="absolute -inset-[30%] opacity-60 motion-reduce:animate-none animate-auth-aurora-b"
        style={{ background: g2 }}
      />
      <div
        className="absolute inset-0 opacity-40 motion-reduce:animate-none animate-auth-aurora-c"
        style={{ background: g3 }}
      />
      <div className={cn('absolute inset-0 bg-gradient-to-b from-transparent via-transparent', fadeClass)} />
    </div>
  );
}
