import { recordAuditEvent } from '@/db/repositories/audit-events';
import {
  buildDocPackZip,
  docPackErrorResponse,
  fileResponse,
  loadDocPack,
  ZIP_CONTENT_TYPE,
} from '@/lib/api/doc-pack';

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/engagements/[id]/doc-pack/zip — every ready document, one archive. */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const loaded = await loadDocPack(id);
  if (loaded.ok === false) return loaded.response;
  const { ctx, inputs, summary } = loaded.load;

  try {
    const zip = await buildDocPackZip(inputs, summary);
    await recordAuditEvent(ctx, {
      engagementId: inputs.engagement.id,
      action: 'doc_pack.download_zip',
      summary: `Downloaded the pre-incorporation document pack (${zip.itemKeys.length} files)`,
      metadata: { itemKeys: zip.itemKeys, filename: zip.filename },
    });
    return fileResponse(zip.buffer, zip.filename, ZIP_CONTENT_TYPE);
  } catch (err) {
    return docPackErrorResponse(err);
  }
}
