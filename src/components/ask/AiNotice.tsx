import { Sparkles } from 'lucide-react';
import { AI_NOTICE_LABEL, aiNoticeText } from '@/lib/ask/ai-review';

/** The small "AI-generated" label and its one sentence, under every model-written answer. */
export function AiNotice({ firmName }: { firmName?: string }) {
  return (
    <p className="flex items-start gap-1.5 text-[12px] leading-snug text-ink-muted" data-ai-notice>
      <span className="inline-flex flex-none items-center gap-1 rounded-[3px] bg-surface-sunken px-1.5 py-px font-medium text-ink-2">
        <Sparkles className="h-3 w-3" strokeWidth={1.6} aria-hidden />
        {AI_NOTICE_LABEL}
      </span>
      <span>{aiNoticeText(firmName)}</span>
    </p>
  );
}
