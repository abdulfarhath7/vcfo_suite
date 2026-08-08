import { cn } from '@/lib/utils';

type SbcLogoProps = {
  variant?: 'mark' | 'full';
  /** Wordmark tone when variant is full */
  tone?: 'light' | 'dark';
  /** Hide mark from assistive tech when adjacent wordmark is visible */
  decorative?: boolean;
  className?: string;
  markClassName?: string;
  /** Icon size in px (mark only; full uses mark + text) */
  size?: number;
};

/** Shared VCFO Suite mark — keep in sync with app/icon.svg and public/logo-mark.svg */
function SbcLogoMark({
  size = 32,
  className,
  gradientId = 'vcfo-logo-mark-grad',
  decorative = true,
}: {
  size?: number;
  className?: string;
  gradientId?: string;
  decorative?: boolean;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : 'VCFO Suite'}
    >
      <defs>
        {/* var() is invalid in SVG presentation attributes — stop colors go through style */}
        <linearGradient id={gradientId} x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop style={{ stopColor: 'oklch(var(--gold))' }} />
          <stop offset="1" style={{ stopColor: 'oklch(var(--gold-deep))' }} />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradientId})`} />
      <path d="M10 9v14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />
      <circle cx="10" cy="9.5" r="2.6" fill="#fff" />
      <circle cx="10" cy="16" r="2.6" fill="#fff" fillOpacity="0.8" />
      <circle cx="10" cy="22.5" r="2.6" fill="#fff" fillOpacity="0.4" />
      <path d="M15 9.5h9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M15 16h6.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.8" />
      <path d="M15 22.5h4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.4" />
    </svg>
  );
}

export function SbcLogo({
  variant = 'mark',
  tone = 'dark',
  decorative = true,
  className,
  markClassName,
  size = 32,
}: SbcLogoProps) {
  const gradientId = `vcfo-logo-mark-grad-${variant}-${tone}-${size}`;

  if (variant === 'mark') {
    return (
      <SbcLogoMark
        size={size}
        className={className}
        gradientId={gradientId}
        decorative={decorative}
      />
    );
  }

  const markSize = Math.round(size * 0.625);

  return (
    <div className={cn('flex items-center gap-2.5', className)} role="img" aria-label="VCFO Suite">
      <SbcLogoMark size={markSize} className={markClassName} gradientId={`${gradientId}-m`} decorative />
      <span
        className={cn(
          'font-medium tracking-tight leading-none',
          tone === 'light' ? 'text-white' : 'text-foreground',
        )}
        style={{ fontSize: Math.max(13, Math.round(size * 0.44)) }}
      >
        VCFO Suite
      </span>
    </div>
  );
}
