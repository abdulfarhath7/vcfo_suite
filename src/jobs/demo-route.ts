import { runInDemo, runInMain } from '@/db/demo-scope';

/**
 * PLAN H2: Inngest calls `/api/inngest` once per step with the triggering event in the body. An
 * event that carries `demo: true` (sent from a demo login, see src/jobs/client.ts) runs inside
 * `runInDemo`, so the job uses the demo database and the demo storage prefix; every other call
 * runs explicitly in the main scope (the Inngest server sends no session cookie, but the scope is
 * set anyway so nothing depends on that). A body that cannot be read here (for example one too
 * large, which the SDK then fetches from the API) runs in the main scope, and the middleware in
 * src/jobs/client.ts refuses it if its event turns out to be a demo one.
 */
export async function bodySaysDemo(req: Request): Promise<boolean> {
  try {
    const body = (await req.clone().json()) as {
      event?: { data?: { demo?: unknown } };
      events?: Array<{ data?: { demo?: unknown } }>;
    };
    return body?.event?.data?.demo === true || Boolean(body?.events?.some((e) => e?.data?.demo === true));
  } catch {
    return false;
  }
}

export function scopedInngestHandler<H extends (req: never, ctx: never) => Promise<Response>>(handler: H): H {
  const wrapped = async (req: Request, ctx: unknown) => {
    const demo = await bodySaysDemo(req);
    const run = () => (handler as unknown as (r: Request, c: unknown) => Promise<Response>)(req, ctx);
    return demo ? runInDemo(run) : runInMain(run);
  };
  return wrapped as unknown as H;
}
