/**
 * The person's own message (owner item F1 and F2, 30 Oct 2026): a soft brand fill with ink text,
 * so it reads the same in light and dark, and the person's initials beside it.
 */
export function AskUserBubble({ text, initials }: { text: string; initials?: string | null }) {
  return (
    <div className="flex items-start justify-end gap-2">
      <p className="max-w-[85%] whitespace-pre-wrap rounded-md bg-brand-soft px-3 py-2 text-[13px] text-ink">{text}</p>
      <span
        aria-hidden
        className="grid h-7 w-7 flex-none place-items-center rounded-full border border-line bg-surface-sunken text-[11px] font-medium text-ink-2"
      >
        {(initials || '').slice(0, 2) || '·'}
      </span>
    </div>
  );
}

/** The VCFO mark beside each answer (owner item F2). The mark, not the Visor figure (C-0003, R-04). */
export function AskAvatar() {
  return (
    <span aria-hidden className="grid h-7 w-7 flex-none place-items-center overflow-hidden rounded-mark border border-line bg-surface-raised">
      {/* eslint-disable-next-line @next/next/no-img-element -- a 26 px static mark */}
      <img src="/client-portal/vcfo-mark.webp" alt="" width={20} height={20} className="h-5 w-5 object-contain" />
    </span>
  );
}
