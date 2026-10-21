'use client';

import { useRouter } from 'next/navigation';
import { internLeadManagerRequestPatch } from '@/lib/checklist/checklist-item-review';
import { internWorkCta, type InternWorkItem } from '@/lib/intern/intern-work';
import { useApp } from '@/context/AppContext';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

export function InternWorkCtaButton({
  item,
  className,
}: {
  item: InternWorkItem;
  className?: string;
}) {
  const router = useRouter();
  const { updateItem, getStateForEngagement, engagements } = useApp();
  const cta = internWorkCta(item);

  const run = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (cta.action === 'open') {
      router.push(item.href);
      return;
    }
    if (cta.action === 'remind-client') {
      router.push('/app/intern/mail');
      return;
    }
    if (!item.catalogId) return;
    const engagement = engagements.find((row) => row.id === item.engagementId);
    if (!engagement) return;
    try {
      const slice = getStateForEngagement(engagement)[item.catalogId];
      await updateItem(item.engagementId, item.catalogId, {
        ...internLeadManagerRequestPatch(slice),
        resendManagerEmail: true,
      });
      toastSuccess('Emailed manager again', 'Watch for the send confirmation.', {
        id: `lead-nudge:${item.engagementId}:${item.catalogId}`,
      });
    } catch (err) {
      toastError('Could not email manager', errorMessage(err, 'Try again.'));
    }
  };

  if (item.kind === 'done') return null;

  return (
    <button
      type="button"
      onClick={(e) => void run(e)}
      className={cn(
        'inline-flex h-control-sm max-w-full shrink-0 items-center justify-center whitespace-nowrap rounded-md px-2.5 text-[12px] font-semibold transition-colors',
        cta.variant === 'solid'
          ? 'bg-brand text-on-brand hover:bg-brand-strong'
          : 'border border-line-strong bg-surface-raised text-ink hover:bg-surface-sunken',
        className,
      )}
    >
      {cta.label}
    </button>
  );
}
