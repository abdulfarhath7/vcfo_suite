import { recordAuditEvent } from '@/db/repositories/audit-events';
import {
  DOCX_CONTENT_TYPE,
  docPackErrorResponse,
  fileResponse,
  loadDocPack,
  renderDocPackItem,
  requireReadyItem,
} from '@/lib/api/doc-pack';

type RouteContext = { params: Promise<{ id: string; itemKey: string }> };

/**
 * GET /api/engagements/[id]/doc-pack/[itemKey] — one document as .docx.
 * `?preview=1` serves the same bytes inline for the in-browser preview and
 * is not audited as a download.
 */
export async function GET(request: Request, context: RouteContext) {
  const { id, itemKey } = await context.params;
  const loaded = await loadDocPack(id);
  if (loaded.ok === false) return loaded.response;
  const { ctx, inputs, summary } = loaded.load;
  const preview = new URL(request.url).searchParams.get('preview') === '1';

  try {
    const item = requireReadyItem(summary, decodeURIComponent(itemKey));
    const rendered = await renderDocPackItem(inputs, item);
    if (!preview) {
      await recordAuditEvent(ctx, {
        engagementId: inputs.engagement.id,
        action: 'doc_pack.download',
        summary: `Downloaded ${item.label} from the document pack`,
        metadata: { itemKey: item.key, source: item.source, filename: rendered.filename },
      });
    }
    return fileResponse(rendered.buffer, rendered.filename, DOCX_CONTENT_TYPE, preview ? 'inline' : 'attachment');
  } catch (err) {
    return docPackErrorResponse(err);
  }
}
