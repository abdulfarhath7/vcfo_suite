'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  src?: string | null;
  initials: string;
  className?: string;
  alt?: string;
};

/** Initials fallback when `src` is missing or the image fails to load. */
export function UserFace({ src, initials, className, alt = '' }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const show = Boolean(src) && !failed;

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        className,
      )}
      aria-hidden={!alt}
    >
      {show ? (
        // Authenticated `/api/account/avatar` — not a remote CDN, so <img> is correct.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="select-none">{initials}</span>
      )}
    </span>
  );
}
