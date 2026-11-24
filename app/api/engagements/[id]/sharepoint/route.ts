import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { assertEngagementProgressCcAccess } from '@/lib/api/engagement-progress-cc-access';
import { parseJsonBody } from '@/lib/api/parse-body';
import { sharepointConfig } from '@/lib/sharepoint/config';
import { linkProjectFolder, listClientFolders, openClientsRoot, projectFolderLink, SharepointRefused } from '@/lib/sharepoint/client-folder';

type RouteContext = { params: Promise<{ id: string }> };

const STAFF = ['super_admin', 'admin', 'manager', 'intern'] as const;

async function access(ctx: Parameters<typeof assertEngagementProgressCcAccess>[0], param: string) {
  const found = await assertEngagementProgressCcAccess(ctx, param);
  if (found.notFound) return { error: NextResponse.json({ error: 'not_found' }, { status: 404 }) };
  if (found.forbidden) return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  return { dbId: found.dbId };
}

/**
 * GET /api/engagements/:id/sharepoint: the project's linked SharePoint folder. With `?folders=1`
 * it also lists the folders under Clients, read with the caller's own Microsoft 365 token, so the
 * person can pick one. `configured: false` when the app has no SharePoint site set.
 */
export async function GET(request: Request, context: RouteContext) {
  const guard = await requireAnyRole(...STAFF);
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const found = await access(guard.ctx, (await context.params).id);
  if ('error' in found) return found.error;
  if (!sharepointConfig()) return NextResponse.json({ configured: false, link: null });
  try {
    const link = await projectFolderLink(guard.ctx, found.dbId);
    const view = { configured: true, link: link ? { folderId: link.folderId, folderName: link.folderName } : null };
    if (new URL(request.url).searchParams.get('folders') !== '1') return NextResponse.json(view);
    const folders = await listClientFolders(await openClientsRoot(guard.ctx));
    return NextResponse.json({ ...view, folders });
  } catch (error) {
    if (error instanceof SharepointRefused) return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    console.error('[sharepoint] folder view failed', error);
    return NextResponse.json({ error: 'Could not read SharePoint.' }, { status: 500 });
  }
}

const putSchema = z.object({ folderId: z.string().min(1).max(200).nullable() });

/** PUT /api/engagements/:id/sharepoint: links the project to a folder under Clients, or unlinks it. */
export async function PUT(request: Request, context: RouteContext) {
  const guard = await requireAnyRole(...STAFF);
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const [body, params] = await Promise.all([parseJsonBody(request, putSchema), context.params]);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  const found = await access(guard.ctx, params.id);
  if ('error' in found) return found.error;
  try {
    const link = await linkProjectFolder(guard.ctx, found.dbId, body.data.folderId);
    await recordAuditEvent(guard.ctx, {
      engagementId: found.dbId,
      action: 'sharepoint.link',
      summary: link ? `Linked the SharePoint folder ${link.folderName}` : 'Unlinked the SharePoint folder',
      metadata: { folderName: link?.folderName ?? null },
    });
    return NextResponse.json({ link: link ? { folderId: link.folderId, folderName: link.folderName } : null });
  } catch (error) {
    if (error instanceof SharepointRefused) return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    console.error('[sharepoint] folder link failed', error);
    return NextResponse.json({ error: 'Could not link the folder.' }, { status: 500 });
  }
}
