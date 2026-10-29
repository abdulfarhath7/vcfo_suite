import { z } from 'zod';
import { devRoute } from '@/lib/dev/route-helpers';
import { readAppRunner } from '@/lib/dev/aws';
import { featureFlags } from '@/lib/dev/flags';
import { lastDeployActorForDev, listDeployImagesForDev, listMigrationsForDev, recordDeployImageForDev } from '@/db/repositories/dev-deploys';
import { reach } from '@/lib/dev/reach';
import journal from '@/db/migrations/meta/_journal.json';
import type { DeploysExtra, DeploysPayload } from '@/lib/dev/types';

/**
 * GET /api/dev/deploys: the App Runner service (DescribeService) and its last 20 operations,
 * the images the service has run (each read records the current one, for "Roll back"),
 * migrations in the code against this database, the env feature flags, and who last started
 * a deploy from the console. Developer or super admin.
 */
export async function GET(request: Request) {
  return devRoute(request, z.object({}), async (ctx): Promise<DeploysPayload & DeploysExtra> => {
    const runner = await readAppRunner();
    const current = runner.service.state === 'ok' ? (runner.service.data.imageIdentifier ?? null) : null;
    if (current) await recordDeployImageForDev(ctx, current);
    const [images, migrations, lastBy] = await Promise.all([
      listDeployImagesForDev(ctx, current),
      reach(() => listMigrationsForDev(ctx, journal.entries)),
      lastDeployActorForDev(ctx),
    ]);
    return { ...runner, images, migrations, flags: featureFlags(), lastBy };
  });
}
