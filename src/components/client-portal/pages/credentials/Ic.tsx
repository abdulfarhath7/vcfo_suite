import { CR_IC, type CrIcon } from './icons';

/** The board's `ic(n, s, cls)` helper: Lucide 24px, stroke 1.6 (R-16). */
export function Ic({ n, s = 16, cls }: { n: CrIcon; s?: number; cls?: string }) {
  return (
    <svg
      className={cls}
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: CR_IC[n] }}
    />
  );
}
