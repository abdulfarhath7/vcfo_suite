import { z } from 'zod';

/**
 * The GST registration card an Ask VCFO answer carries (`answer.gst`): the readiness the profile
 * builder computed, cut to what the chat shows. Values never travel here, only labels and where
 * each missing item comes from. Pure, so the server, the browser and the answer schema share it.
 */
export const gstCardSchema = z.object({
  engagementId: z.string().min(1),
  /** The project key for links (slug, else id). */
  projectKey: z.string().min(1),
  companyName: z.string(),
  ready: z.boolean(),
  gaps: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        source: z.enum(['tool', 'sharepoint', 'zoho', 'client', 'portal']),
        where: z.string(),
        kind: z.enum(['value', 'document']),
      }),
    )
    .max(8),
  gapCount: z.number().int().min(0),
  /** Values the client entered on the GST step that the lead has not confirmed (labels only). */
  confirm: z.array(z.object({ key: z.string(), label: z.string() })).max(8).optional(),
  actions: z.array(z.enum(['fetch_sharepoint', 'ask_client', 'start_portal', 'open_step', 'confirm_client'])),
  /** Set once a request list was drafted. */
  requestHref: z.string().optional(),
});
export type GstCardData = z.infer<typeof gstCardSchema>;
