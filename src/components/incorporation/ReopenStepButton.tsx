'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/AppContext';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';

/**
 * "Reopen step" on a submitted pre-incorporation direct-flow step (project
 * lead, manager, admin). Every field opens again for the client and the lead,
 * and the steps after it lock until it is submitted again. Runs through the
 * existing unlock route, which reopens the whole step for direct-flow ids.
 */
export function ReopenStepButton({
  scopeId,
  itemId,
  stepTitle,
  className,
}: {
  scopeId: string;
  itemId: string;
  stepTitle: string;
  className?: string;
}) {
  const { setUnlockedFields } = useApp();
  const [busy, setBusy] = useState(false);

  const reopen = async () => {
    setBusy(true);
    try {
      await setUnlockedFields(scopeId, itemId, []);
      toastSuccess('Step reopened', `${stepTitle} is open for edits again.`);
    } catch (err) {
      toastError('Could not reopen the step', errorMessage(err, 'Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => void reopen()}
      disabled={busy}
      className={className}
    >
      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
      {busy ? 'Reopening…' : 'Reopen step'}
    </Button>
  );
}
