'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { m, useReducedMotion } from 'framer-motion';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pageEnterReduced, pageEnter } from '@/lib/motion';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const preset = reduceMotion ? pageEnterReduced : pageEnter;
  const Comp = reduceMotion ? 'div' : m.div;

  useEffect(() => {
    console.error('[app] unhandled render error:', error.message, error.digest, error.stack);
  }, [error]);

  return (
    <Comp
      className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center px-4"
      initial={preset.initial}
      animate={preset.animate}
      transition={preset.transition}
    >
      <AlertTriangle className="h-10 w-10 text-orange-600" aria-hidden />
      <div className="space-y-2 max-w-sm">
        <p className="text-base font-semibold text-foreground">Something went wrong</p>
        <p className="text-sm text-muted-foreground">
          A temporary error occurred. Try reloading — if it keeps happening,
          check your connection or contact support.
        </p>
        {error.digest && (
          <p className="font-mono text-[11px] text-muted-foreground">
            Error ID: {error.digest}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        <Button type="button" size="sm" onClick={reset} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Try again
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => router.push('/app')}>
          Go home
        </Button>
      </div>
    </Comp>
  );
}
