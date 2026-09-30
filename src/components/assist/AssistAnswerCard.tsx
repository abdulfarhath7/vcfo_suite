'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ExternalLink } from 'lucide-react';
import type { AnswerEnvelope } from '@/data/assist/schema';
import { saveToLibrary } from '@/hooks/assist/assist-api';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import { getTopic } from '@/lib/assist/topics';
import { clientStepHref } from '@/lib/client-overview';
import { adminProjectPath } from '@/lib/project-step-path';
import { reminderComposeHref } from '@/lib/assist/reminder';
import { cn } from '@/lib/utils';
import { useAssistOptional } from './assist-context';
import { TrustBadge } from './TrustBadge';
import { VisualRenderer } from './visuals/VisualRenderer';

const secondary =
  'inline-flex min-h-[36px] items-center gap-1 rounded-[var(--radius-md)] border border-border px-2.5 text-[12px] font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50';


/**
 * Answer card (§7.5): badge · line · visual · why · sources · actions ·
 * related. Staff cards drop the client-only rows.
 */
export function AssistAnswerCard({
  answer,
  messageId,
  lastQuestion,
}: {
  answer: AnswerEnvelope;
  messageId: string | null;
  lastQuestion?: string;
}) {
  const assist = useAssistOptional();
  const router = useRouter();
  const staffBase = useStaffBasePath();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  if (!assist) return null;
  const client = assist.shell === 'client';
  const has = (a: AnswerEnvelope['actions'][number]) => answer.actions.includes(a);
  const canSave = client && has('save') && !assist.preview && (answer.topicSlug || messageId) && assist.engagementId;
  const rowTarget = answer.target?.engagementId;

  const changeDepth = (depth: 'simple' | 'detail') => {
    if (answer.topicSlug) void assist.showTopic(answer.topicSlug, depth, depth === 'simple' ? 'Simpler, please' : 'More detail, please');
    else void assist.ask({ message: depth === 'simple' ? 'Explain that more simply.' : 'Tell me more detail.', depth });
  };

  return (
    <article className="space-y-2.5 rounded-[var(--radius)] border border-border bg-panel p-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <TrustBadge answer={answer} firmName={assist.firmName} />
        {answer.depth !== 'normal' && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {answer.depth === 'simple' ? 'Simpler' : 'More detail'}
          </span>
        )}
      </div>

      <p className="max-w-[60ch] text-[15px] leading-relaxed text-foreground">{answer.line}</p>

      {answer.visual && <VisualRenderer visual={answer.visual} />}

      {answer.why && client && (
        <div>
          <p className="text-[12px] font-semibold text-foreground">Why it matters to you</p>
          <p className="text-[13px] text-muted-foreground">{answer.why}</p>
        </div>
      )}

      {answer.citations.length > 0 && (
        <p className="text-[11.5px] text-muted-foreground">
          Source:{' '}
          {answer.citations.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ' · '}
              {c.url ? (
                <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline">
                  {c.label}
                  <ExternalLink className="h-3 w-3" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : (
                c.label
              )}
            </span>
          ))}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {canSave && (
          <button
            type="button"
            className={cn(secondary, saved && 'border-success/40 text-success-text')}
            disabled={saving || saved}
            onClick={async () => {
              setSaving(true);
              setSaveError(null);
              try {
                await saveToLibrary({
                  engagementId: assist.engagementId!,
                  ...(answer.topicSlug ? { topicSlug: answer.topicSlug, answer } : { messageId: messageId! }),
                });
                setSaved(true);
              } catch (err) {
                setSaveError((err as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saved ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden /> Saved to library
              </>
            ) : (
              'Save to library'
            )}
          </button>
        )}
        {has('simpler') && (
          <button type="button" className={secondary} onClick={() => changeDepth('simple')} disabled={assist.busy}>
            Simpler
          </button>
        )}
        {has('detail') && (
          <button type="button" className={secondary} onClick={() => changeDepth('detail')} disabled={assist.busy}>
            More detail
          </button>
        )}
        {has('expand') && answer.topicSlug && client && !assist.preview && (
          <button type="button" className={secondary} onClick={() => router.push(`/app/client/learn/${answer.topicSlug}`)}>
            Expand
          </button>
        )}
        {has('openStep') && answer.target?.stepId && client && !assist.preview && (
          <Link href={clientStepHref(answer.target.stepId)} className={secondary}>
            Open step
          </Link>
        )}
        {has('askLead') && client && !assist.preview && (
          <button type="button" className={secondary} onClick={() => assist.setHandoffDraft(lastQuestion ?? '')}>
            Ask my lead
          </button>
        )}
        {has('openProject') && !client && rowTarget && (
          <Link href={adminProjectPath({ slug: rowTarget, id: rowTarget }, staffBase)} className={secondary}>
            Open in Projects
          </Link>
        )}
        {has('draftReminder') && !client && (
          <Link href={reminderComposeHref(staffBase, answer)} className={secondary}>
            Draft reminder
          </Link>
        )}
      </div>
      {saveError && (
        <p role="alert" className="text-[12px] text-danger-text">
          {saveError}
        </p>
      )}

      {answer.related && answer.related.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border pt-2">
          {answer.related.slice(0, 2).map((slug) => {
            const topic = getTopic(slug);
            if (!topic) return null;
            return (
              <button
                key={slug}
                type="button"
                onClick={() => void assist.showTopic(slug, undefined, topic.question)}
                className="rounded-full bg-muted px-2.5 py-1 text-[12px] text-foreground hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {topic.question}
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}
