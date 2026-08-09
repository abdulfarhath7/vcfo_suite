'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminProjectStepError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log to console so it appears in Vercel function logs
    console.error('[admin/projects/[slug]/step/[stepId]] render error:', error.message, error.digest, error.stack);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center px-4">
      <AlertTriangle className="h-10 w-10 text-warning" aria-hidden />
      <div className="space-y-2 max-w-sm">
        <p className="text-base font-semibold text-foreground">
          Couldn&apos;t load this step
        </p>
        <p className="text-sm text-muted-foreground">
          A temporary error occurred. Try reloading — if it keeps happening,
          check your connection or try again later.
        </p>
        {error.digest && (
          <p className="font-mono text-[11px] text-muted-foreground">
            Error ID: {error.digest}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={reset}
          className="gap-2"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Try again
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
        >
          Go back
        </Button>
      </div>
    </div>
  );
}
