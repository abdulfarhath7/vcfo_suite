'use client';

import { useEffect, useRef, useState, type ElementType, type ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  stagger?: boolean;
};

/**
 * Marks section in-view for optional CSS @starting-style polish.
 * Content is always visible (never opacity-trapped).
 */
function useRevealOpen() {
  const ref = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      setOpen(true);
      return;
    }

    const show = () => setOpen(true);

    // Already on screen → open immediately (triggers @starting-style once)
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      show();
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      show();
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          show();
          io.disconnect();
        }
      },
      { rootMargin: '120px 0px', threshold: 0 },
    );
    io.observe(el);

    const failsafe = window.setTimeout(show, 800);
    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);

  return { ref, open };
}

export function Reveal({ children, className, stagger = false }: RevealProps) {
  const { ref, open } = useRevealOpen();

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      data-state={open ? 'open' : 'closed'}
      className={cn(stagger && 'discrete-stagger', className)}
    >
      {children}
    </div>
  );
}

export function RevealItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  // No opacity trap — parent open state only drives optional @starting-style
  return <div className={cn('discrete-fade-up', className)}>{children}</div>;
}

type RevealChildProps<T extends ElementType = 'div'> = {
  as?: T;
  children: React.ReactNode;
  className?: string;
  delayClass?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className'>;

export function RevealChild<T extends ElementType = 'div'>({
  as,
  children,
  className,
  delayClass,
  ...rest
}: RevealChildProps<T>) {
  const Comp = (as ?? 'div') as ElementType;
  const { ref, open } = useRevealOpen();

  return (
    <Comp
      ref={ref}
      data-state={open ? 'open' : 'closed'}
      className={cn('discrete-fade-up', delayClass, className)}
      {...rest}
    >
      {children}
    </Comp>
  );
}
