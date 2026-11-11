import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { getDocPackInputs } from '@/db/repositories/doc-pack';
import { exportInBackground } from '@/lib/exports/background-export';
import { standardDownloadName } from '@/lib/files/download-name';
import { buildProjectZip } from '@/lib/projects/project-zip';

type RouteContext = { params: Promise<{ id: string }> };

/** The archive is kept for its link up to this size (the answers, documents and uploads of one project). */
const PROJECT_ZIP_MAX_BYTES = 300 * 1024 * 1024;

/**
 * POST /api/engagements/[id]/project-zip (PR-02): start the whole-project ZIP. Staff only (the
 * Lead, the Manager and the Admin). Answers 202 at once; the archive is made in the background
 * and the bell gives the person a Download link when it is ready.
 */
export async function POST(_request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  const access = await getDocPackInputs(guard.ctx, id);
  if (access.ok === false) return NextResponse.json({ error: access.error }, { status: access.status });
  const { engagement } = access.inputs;
  const fileName = standardDownloadName('Project', engagement.companyName, 'zip');
  await recordAuditEvent(guard.ctx, {
    engagementId: access.inputs.dbId,
    action: 'project.zip_requested',
    summary: `${guard.ctx.name || 'Someone'} asked for the project ZIP`,
    metadata: { fileName },
  });
  exportInBackground(guard.ctx, {
    kind: 'project_zip',
    format: 'zip',
    fileName,
    label: 'the project ZIP',
    engagementId: engagement.id,
    companyName: engagement.companyName,
    maxCopyBytes: PROJECT_ZIP_MAX_BYTES,
    build: async () => (await buildProjectZip(guard.ctx, id)).bytes,
  });
  return NextResponse.json({ queued: true, fileName }, { status: 202 });
}
