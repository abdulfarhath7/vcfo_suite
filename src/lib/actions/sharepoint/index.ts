import 'server-only';

import { z } from 'zod';
import { startSharepointDrop } from '@/lib/sharepoint/start-drop';
import { loadEngagement, STAFF_ROLES } from '../shared';
import { defineAction, type AnyAction } from '../types';

/**
 * `sharepoint.fetch` reads the client's own folder under `/Clients` in the firm's SharePoint and
 * prepares review cards from its files, as a dropped folder does. It is T1: it only reads and
 * prepares. Every value it finds goes onto a card, and nothing is saved until the person accepts.
 * The chat calls `startSharepointDrop` itself so it can show the drop's progress (`pick-action.ts`).
 */
const fetchInput = z.object({
  engagementId: z.string().min(1),
});

const fetchFolder = defineAction({
  name: 'sharepoint.fetch',
  description: "Take a client's data from their folder in SharePoint (Clients/<client>) and prepare it for review. Use when the user asks to take, fetch, pull, get or read a client's data, details or files from SharePoint.",
  capability: "Read a client's SharePoint folder and prepare its data for review (nothing is saved until you accept)",
  input: fetchInput,
  tier: 'T1',
  roles: STAFF_ROLES,
  async preview() {
    return null;
  },
  async execute(actx, input) {
    const loaded = await loadEngagement(actx.auth, input.engagementId);
    if (!loaded) return { ok: false, error: 'This project is not available.' };
    const started = await startSharepointDrop(actx.auth, { engagementId: loaded.row.id, conversationId: actx.conversationId, message: '' });
    if (started.ok === false) return { ok: false, error: started.message };
    return { ok: true, summary: `Reading the SharePoint folder ${started.folderName} for ${started.companyName}` };
  },
});

export const actions: AnyAction[] = [fetchFolder];
