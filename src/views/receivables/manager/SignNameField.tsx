'use client';

import { Input } from '@/components/ui/input';
import { toastError } from '@/lib/toast-errors';
import { useSignName } from '@/hooks/use-receivables-v2';

/**
 * "Your name" at the top of every receivables email pop-up (owner, 18 Nov 2026). Typing changes
 * "Regards, <name>" in the body at once (`onChange`); leaving the box saves it to the person's
 * profile, so the next email (the automatic ones too) is signed the same way until they change it.
 */
export function SignNameField({ id, value, onChange }: { id: string; value: string; onChange: (name: string) => void }) {
  const { query, save } = useSignName();
  const keep = () => {
    const name = value.trim();
    if (!name || name === query.data?.name) return;
    save.mutate(name, { onError: (e) => toastError('Name not saved', e instanceof Error ? e.message : undefined) });
  };
  return (
    <label htmlFor={id} className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted">
      Your name
      <Input
        id={id}
        className="h-7 w-[200px] px-2 py-0.5 text-[13px] text-ink"
        value={value}
        maxLength={80}
        placeholder="Signs the email"
        onChange={(e) => onChange(e.target.value)}
        onBlur={keep}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), keep())}
      />
      {save.isPending ? <span className="text-[11.5px]">Saving…</span> : save.isSuccess && query.data?.name === value.trim() ? <span className="text-[11.5px] text-positive">Saved</span> : null}
    </label>
  );
}
