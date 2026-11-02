import { handleAssistIngest } from '@/lib/assist-runs/ingest-route';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/assist/engagements/[id]/result — the path the VCFO Assist extension already
 * posts its result to (`SUITE_API.resultPath`, `SuiteResult`). Same handler as
 * `/api/assist/engagements/[id]/runs`; a body with `srn` and no `state` closes the run as done.
 */
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return handleAssistIngest(request, id);
}
