import { BadgeCheck, Sparkles, FileClock } from 'lucide-react';
import type { AnswerEnvelope } from '@/data/ask/schema';

/**
 * U1: "Reviewed by {firm}" only for reviewed content and deterministic
 * answers; a draft topic or a model answer never carries it.
 */
export function TrustBadge({ answer, firmName }: { answer: AnswerEnvelope; firmName: string }) {
  if (answer.origin === 'refusal') return null;
  if (answer.draft) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        <FileClock className="h-3 w-3" aria-hidden /> Not yet reviewed · check with your lead
      </span>
    );
  }
  if (answer.origin === 'reviewed' || answer.origin === 'deterministic') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2 py-0.5 text-[11px] font-medium text-success-text">
        <BadgeCheck className="h-3 w-3" aria-hidden /> Reviewed by {firmName}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <Sparkles className="h-3 w-3" aria-hidden /> AI answer · check with your lead
    </span>
  );
}
