import { cn } from '@/lib/utils';

/** VCFO by SBC lockup — light UI (`html` without `.dark`). */
export const SBC_LOCKUP_LIGHT_SRC = '/vcfo-logo-light.png';
const SBC_LOCKUP_LIGHT_SIZE = { width: 956, height: 463 } as const;
/** Same lockup with the SBC line in white — dark UI (`html.dark`). */
export const SBC_LOCKUP_DARK_SRC = '/vcfo-logo-dark.png';
const SBC_LOCKUP_DARK_SIZE = { width: 956, height: 463 } as const;
const SBC_MARK_SRC = '/vcfo-mark.png';
const SBC_MARK_SIZE = { width: 398, height: 365 } as const;
export const SBC_LOGO_LABEL = 'VCFO by SBC';

export function sbcLockupSrc(theme: 'light' | 'dark'): string {
  return theme === 'dark' ? SBC_LOCKUP_DARK_SRC : SBC_LOCKUP_LIGHT_SRC;
}

type SbcLogoProps = {
  variant?: 'mark' | 'full' | 'wordmark' | 'navbar' | 'lockup';
  /** Wordmark tone when variant is full (SVG product mark) */
  tone?: 'light' | 'dark';
  /**
   * Official PNG lockup (`variant="lockup"`): which surface it sits on.
   * `auto` follows `html.dark`. Use `dark` on always-dark heroes (blue panels).
   */
  surface?: 'auto' | 'light' | 'dark';
  /** Hide mark from assistive tech when adjacent wordmark is visible */
  decorative?: boolean;
  className?: string;
  markClassName?: string;
  /** Icon size in px (mark / SVG full / PNG wordmark / lockup height) */
  size?: number;
};

function SbcLogoMark({
  size = 32,
  className,
  decorative = true,
}: {
  size?: number;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <img
      src={SBC_MARK_SRC}
      alt={decorative ? '' : SBC_LOGO_LABEL}
      width={SBC_MARK_SIZE.width}
      height={SBC_MARK_SIZE.height}
      className={cn('w-auto shrink-0', className)}
      style={{ height: size }}
      decoding="async"
      draggable={false}
    />
  );
}

function SbcOfficialImg({
  compact,
  className,
  decorative,
  heightPx,
  theme = 'light',
}: {
  compact?: boolean;
  className?: string;
  decorative?: boolean;
  heightPx: number;
  theme?: 'light' | 'dark';
}) {
  const lockup =
    theme === 'dark'
      ? { src: SBC_LOCKUP_DARK_SRC, ...SBC_LOCKUP_DARK_SIZE }
      : { src: SBC_LOCKUP_LIGHT_SRC, ...SBC_LOCKUP_LIGHT_SIZE };
  const asset = compact ? { src: SBC_MARK_SRC, ...SBC_MARK_SIZE } : lockup;
  return (
    <img
      src={asset.src}
      alt={decorative ? '' : SBC_LOGO_LABEL}
      width={asset.width}
      height={asset.height}
      className={cn('w-auto select-none', className)}
      style={{ height: heightPx }}
      decoding="async"
      draggable={false}
    />
  );
}

function SbcThemeLockup({
  surface = 'auto',
  decorative,
  heightPx,
  className,
}: {
  surface?: 'auto' | 'light' | 'dark';
  decorative: boolean;
  heightPx: number;
  className?: string;
}) {
  const light = (
    <SbcOfficialImg
      theme="light"
      decorative
      heightPx={heightPx}
      className={surface === 'auto' ? 'dark:hidden' : undefined}
    />
  );
  const dark = (
    <SbcOfficialImg
      theme="dark"
      decorative
      heightPx={heightPx}
      className={surface === 'auto' ? 'hidden dark:block' : undefined}
    />
  );
  const inner = surface === 'light' ? light : surface === 'dark' ? dark : (
    <>
      {light}
      {dark}
    </>
  );

  return (
    <span
      className={cn('inline-flex shrink-0 items-center', className)}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : SBC_LOGO_LABEL}
    >
      {inner}
    </span>
  );
}

export function SbcLogo({
  variant = 'mark',
  tone = 'dark',
  surface = 'auto',
  decorative = true,
  className,
  markClassName,
  size = 32,
}: SbcLogoProps) {
  if (variant === 'lockup') {
    return (
      <SbcThemeLockup
        surface={surface}
        decorative={decorative}
        heightPx={Math.max(18, size)}
        className={className}
      />
    );
  }

  if (variant === 'navbar') {
    return (
      <SbcThemeLockup
        surface={surface}
        decorative={decorative}
        heightPx={40}
        className={className}
      />
    );
  }

  if (variant === 'wordmark') {
    const heightPx = Math.max(18, size);
    return (
      <SbcOfficialImg
        decorative={decorative}
        heightPx={heightPx}
        className={cn('shrink-0', className)}
      />
    );
  }

  if (variant === 'mark') {
    return (
      <SbcLogoMark size={size} className={className} decorative={decorative} />
    );
  }

  const markSize = Math.round(size * 0.625);

  return (
    <div className={cn('flex items-center gap-2.5', className)} role="img" aria-label="VCFO Suite">
      <SbcLogoMark size={markSize} className={markClassName} decorative />
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
