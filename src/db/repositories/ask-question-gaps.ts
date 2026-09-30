import 'server-only';

import { and, eq, gte, isNotNull, like, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { askConversations, askMessages, engagements, tasks } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isFirmWideAdmin } from '@/lib/auth';
import { AskForbiddenError, assertAskRole } from '@/lib/ask/access';
import type { GapQuestion } from '@/lib/ask/question-gaps';

/**
 * ASK VCFO QUESTION GAPS (A1).
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * Firm admin and super admin only. This is the one place staff read what
 * clients asked, so it returns the least it can: the question text and when
 * it was asked — never the client's profile, never the answer, never the
 * conversation id. The company name is filled in ONLY for a super admin; a
 * firm admin gets `null` there, decided here and not in the UI.
 *
 * Only real client conversations count (role and shell `client`), so a super
 * admin's preview questions never show up as client demand.
 */

const HANDOFF_TITLE_PREFIX = 'Client question:';
const CONTEXT_MARKERS = ['\n— Ask VCFO context —', '\n— Assist context —', '\nAsk VCFO conversation:', '\nAsk conversation:'];
const MAX_ROWS = 500;

function handoffQuestion(description: string | null): string {
  let text = description ?? '';
  for (const marker of CONTEXT_MARKERS) {
    const at = text.indexOf(marker);
    if (at >= 0) text = text.slice(0, at);
  }
  return text.trim().slice(0, 500);
}

export async function listClientQuestionsForGaps(ctx: AuthContext, since: Date): Promise<GapQuestion[]> {
  assertAskRole(ctx);
  if (!isFirmWideAdmin(ctx.role)) throw new AskForbiddenError('Only firm admins see question gaps');
  const showCompany = ctx.role === 'super_admin';

  const rewritten = sql<string | null>`${askMessages.guard}->>'rewrittenQuery'`;
  const generated = await db
    .select({ question: rewritten, askedAt: askMessages.createdAt, companyName: engagements.companyName })
    .from(askMessages)
    .innerJoin(askConversations, eq(askConversations.id, askMessages.conversationId))
    .leftJoin(engagements, eq(engagements.id, askConversations.engagementId))
    .where(
      and(
        eq(askMessages.sender, 'assistant'),
        eq(askMessages.origin, 'generated'),
        isNotNull(askMessages.guard),
        eq(askConversations.role, 'client'),
        eq(askConversations.shell, 'client'),
        gte(askMessages.createdAt, since),
      ),
    )
    .limit(MAX_ROWS);

  const handoffs = await db
    .select({ description: tasks.description, askedAt: tasks.createdAt, companyName: engagements.companyName })
    .from(tasks)
    .leftJoin(engagements, eq(engagements.id, tasks.engagementId))
    .where(and(like(tasks.title, `${HANDOFF_TITLE_PREFIX}%`), gte(tasks.createdAt, since)))
    .limit(MAX_ROWS);

  const rows: GapQuestion[] = [];
  for (const row of generated) {
    const question = (row.question ?? '').trim().slice(0, 500);
    if (!question) continue;
    rows.push({
      question,
      askedAt: row.askedAt.toISOString(),
      source: 'generated',
      companyName: showCompany ? (row.companyName ?? null) : null,
    });
  }
  for (const row of handoffs) {
    const question = handoffQuestion(row.description);
    if (!question) continue;
    rows.push({
      question,
      askedAt: row.askedAt.toISOString(),
      source: 'handoff',
      companyName: showCompany ? (row.companyName ?? null) : null,
    });
  }
  return rows;
}
