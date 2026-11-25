'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { toastSaved } from '@/components/ui/toast-saved';
import { useInputsAction } from '@/components/compliances/use-compliance-records';
import { GST_REGISTRATION_QUERY_KEY } from '@/hooks/use-gst-registration';
import { GST_STEP_ID } from '@/lib/registrations/gst-tracker';
import { errorMessage, toastError } from '@/lib/toast-errors';

/**
 * The GST step values the client entered that the lead has not confirmed: listed as "Needs your
 * confirmation", with the same Confirm the GST step's "From the client" card has (POST
 * /api/compliance-inputs `confirm`). They do not block the application.
 */
export function ConfirmClientValues({ engagementId, items }: { engagementId: string; items: ReadonlyArray<{ key: string; label: string }> }) {
  const act = useInputsAction();
  const qc = useQueryClient();
  const [done, setDone] = useState(false);
  if (items.length === 0) return null;
  if (done) return <p className="text-[12.5px] text-ink-muted">Confirmed the client’s GST details.</p>;
  return (
    <div className="grid gap-1" aria-label="Needs your confirmation">
      <p className="text-[12px] font-medium text-ink">Needs your confirmation (entered by the client)</p>
      <ul className="grid gap-0.5">
        {items.map((item) => (
          <li key={item.key} className="text-ink-2">
            {item.label}
          </li>
        ))}
      </ul>
      <div>
        <Button
          type="button"
          size="sm"
          variant="soft"
          disabled={act.isPending}
          onClick={() =>
            act.mutate(
              { action: 'confirm', engagementId, kind: 'registration', key: GST_STEP_ID },
              {
                onSuccess: () => {
                  setDone(true);
                  toastSaved('Details confirmed');
                  void qc.invalidateQueries({ queryKey: [GST_REGISTRATION_QUERY_KEY] });
                },
                onError: (e) => toastError('Could not confirm', errorMessage(e)),
              },
            )
          }
        >
          <Check aria-hidden />
          Confirm
        </Button>
      </div>
    </div>
  );
}
