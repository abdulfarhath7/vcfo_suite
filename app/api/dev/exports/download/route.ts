import { z } from 'zod';
import { devAction } from '@/lib/dev/route-helpers';
import { signedDownloadUrl } from '@/storage/s3';
import { exportKeyForDownloadForDev } from '@/db/repositories/export-files';

const Body = z.object({ id: z.string().uuid() });

/**
 * POST /api/dev/exports/download { id }: a 5-minute download link for a kept export. Only the
 * person who made it or the super admin (404 otherwise, and once the 30 days are over). The
 * repository writes `dev.export.download`.
 */
export async function POST(request: Request) {
  return devAction(request, Body, async (ctx, body) => {
    const hit = await exportKeyForDownloadForDev(ctx, body.id);
    if (!hit) return { status: 404, body: { error: 'not_found' } };
    return { status: 200, body: { ok: true, url: await signedDownloadUrl(hit.key, 300) } };
  });
}
