import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { listRecentOfficialUpdates } from '@/db/repositories/ask-documents';
import { FEED_WATCHERS } from '@/lib/ask/feeds/registry';
import { numberArg, type AskTool } from './types';

/**
 * Read-only tool for both shells: the newest official updates (GST
 * notifications and circulars, RBI FEMA notices) the asker may read, each with
 * its publication date and a two-sentence "what changed". Clients only see
 * updates an admin published (or all, with ASK_VCFO_FEEDS_AUTO_PUBLISH=true).
 */
export interface UpdatesToolContext {
  authCtx: AuthContext;
  persona: 'client' | 'staff';
}

const ACTS = [...new Set(FEED_WATCHERS.map((w) => w.act))];

export const getRecentOfficialUpdates: AskTool<UpdatesToolContext> = {
  definition: {
    name: 'getRecentOfficialUpdates',
    description:
      'Newest official government updates the firm tracks (GST notifications and circulars from CBIC, RBI FEMA notices), newest first, each with its publication date and a short summary of what changed. Use it when the user asks what is new, what changed, or whether a rule was amended recently.',
    input_schema: {
      type: 'object',
      properties: {
        act: { type: 'string', enum: ACTS, description: 'Only updates under this law; omit for all.' },
        sinceDays: { type: 'number', description: 'How far back to look, in days (default 180, max 730).' },
      },
      required: [],
      additionalProperties: false,
    },
  },
  run: async (ctx, input) => {
    const act = typeof input.act === 'string' ? input.act : null;
    const feedIds = act ? FEED_WATCHERS.filter((w) => w.act === act).map((w) => w.id) : undefined;
    const updates = await listRecentOfficialUpdates(ctx.authCtx, {
      persona: ctx.persona,
      feedIds,
      sinceDays: numberArg(input, 'sinceDays', 180, 730),
      limit: 10,
    });
    return {
      updates: updates.map((u) => ({
        title: u.title,
        law: FEED_WATCHERS.find((w) => w.id === u.feedId)?.act ?? null,
        publishedOn: u.publishedAt,
        whatChanged: u.summary,
        link: u.sourceUrl,
      })),
      note: updates.length ? null : 'No official updates in this period that you can see.',
    };
  },
};
