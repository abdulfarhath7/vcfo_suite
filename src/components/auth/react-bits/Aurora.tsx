'use client';

import { cn } from '@/lib/utils';

interface AuroraProps {
  className?: string;
  /** Light hero uses faint blue stops; dark hero uses deeper brand tones. */
  variant?: 'light' | 'dark';
}

const GRADIENTS = {
  light: [
    'radial-gradient(ellipse 90% 70% at 25% 35%, oklch(var(--blue-100) / 0.42) 0%, transparent 60%)',
    'radial-gradient(ellipse 80% 55% at 75% 55%, oklch(var(--blue-200) / 0.18) 0%, transparent 55%)',
    'radial-gradient(ellipse 100% 45% at 50% 100%, oklch(var(--indigo-50) / 0.22) 0%, transparent 50%)',
  ],
  dark: [
    'radial-gradient(ellipse 80% 60% at 30% 40%, oklch(var(--blue-600) / 0.28) 0%, transparent 55%)',
    'radial-gradient(ellipse 70% 50% at 70% 60%, oklch(var(--blue-700) / 0.22) 0%, transparent 50%)',
    'radial-gradient(ellipse 90% 40% at 50% 100%, oklch(var(--indigo-800) / 0.18) 0%, transparent 45%)',
  ],
} as const;

/**
 * CSS aurora — lightweight alternative to WebGL Aurora (no ogl dep, mobile-safe).
 * Gradient stops use the cool blue brand scale from CSS custom properties.
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
