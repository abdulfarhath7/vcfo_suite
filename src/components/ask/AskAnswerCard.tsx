'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ExternalLink } from 'lucide-react';
import type { AnswerEnvelope } from '@/data/ask/schema';
import { saveToLibrary } from '@/hooks/ask/ask-api';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import { getTopic } from '@/lib/ask/topics';
import { clientStepHref } from '@/lib/client-overview';
import { adminProjectPath } from '@/lib/project-step-path';
import { reminderComposeHref } from '@/lib/ask/reminder';
import { cn } from '@/lib/utils';
import { useAskOptional } from './ask-context';
import { AskLinkButton } from './AskLinkButton';
import { TrustBadge } from './TrustBadge';
import { VisualRenderer } from './visuals/VisualRenderer';

const secondary =
  'inline-flex min-h-[36px] items-center gap-1 rounded-[var(--radius-md)] border border-border px-2.5 text-[12px] font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50';


/**
 * Answer card (§7.5): badge · line · visual · why · sources · actions ·
 * related. Staff cards drop the client-only rows.
 */
export function AskAnswerCard({
  answer,
  messageId,
  lastQuestion,
}: {
  answer: AnswerEnvelope;
  messageId: string | null;
  lastQuestion?: string;
}) {
  const ask = useAskOptional();
  const router = useRouter();
  const staffBase = useStaffBasePath();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  if (!ask) return null;
  const client = ask.shell === 'client';
  const has = (a: AnswerEnvelope['actions'][number]) => answer.actions.includes(a);
  const canSave = client && has('save') && !ask.preview && (answer.topicSlug || messageId) && ask.engagementId;
  const rowTarget = answer.target?.engagementId;
  // Go-there links replace the older open-step / open-project buttons.
  const hasLinks = Boolean(answer.links && answer.links.length > 0);

  const changeDepth = (depth: 'simple' | 'detail') => {
    if (answer.topicSlug) void ask.showTopic(answer.topicSlug, depth, depth === 'simple' ? 'Simpler, please' : 'More detail, please');
    else void ask.ask({ message: depth === 'simple' ? 'Explain that more simply.' : 'Tell me more detail.', depth });
  };

  return (
    <article className="space-y-2.5 rounded-[var(--radius)] border border-border bg-panel p-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <TrustBadge answer={answer} firmName={ask.firmName} />
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

      {answer.links && answer.links.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {answer.links.map((link, i) => (
            <AskLinkButton key={`${link.dest.to}-${i}`} link={link} />
          ))}
        </div>
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
                  engagementId: ask.engagementId!,
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
          <button type="button" className={secondary} onClick={() => changeDepth('simple')} disabled={ask.busy}>
            Simpler
          </button>
        )}
        {has('detail') && (
          <button type="button" className={secondary} onClick={() => changeDepth('detail')} disabled={ask.busy}>
            More detail
          </button>
        )}
        {has('expand') && answer.topicSlug && client && !ask.preview && (
          <button type="button" className={secondary} onClick={() => router.push(`/app/client/learn/${answer.topicSlug}`)}>
            Expand
          </button>
        )}
        {has('openStep') && !hasLinks && answer.target?.stepId && client && !ask.preview && (
          <Link href={clientStepHref(answer.target.stepId)} className={secondary}>
            Open step
          </Link>
        )}
        {has('askLead') && client && !ask.preview && (
          <button type="button" className={secondary} onClick={() => ask.setHandoffDraft(lastQuestion ?? '')}>
            Ask my lead
          </button>
        )}
        {has('openProject') && !hasLinks && !client && rowTarget && (
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
                onClick={() => void ask.showTopic(slug, undefined, topic.question)}
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
