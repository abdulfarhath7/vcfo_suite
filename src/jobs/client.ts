import { Inngest, InngestMiddleware, NonRetriableError } from 'inngest';
import { isDemoScope } from '@/db/demo-scope';

/**
 * PLAN H2: an event sent from inside a demo scope (a demo login's request, or a job already
 * running for one) carries `demo: true` in its data, and `app/api/inngest/route.ts` runs the
 * function for such an event inside `runInDemo`, so the job reads and writes the demo database
 * (src/db/demo-scope.ts). As a backstop, a run whose event says demo but which is not in the
 * demo scope stops before the function body runs, instead of touching the main database.
 * Cron functions have no such event and run for the main database only.
 */
export const demoScopeMiddleware = new InngestMiddleware({
  name: 'vcfo-demo-scope',
  init() {
    return {
      onSendEvent() {
        return {
          async transformInput({ payloads }) {
            if (!(await isDemoScope())) return;
            return {
              payloads: payloads.map((p) => ({ ...p, data: { ...((p.data as Record<string, unknown> | undefined) ?? {}), demo: true } })),
            };
          },
        };
      },
      onFunctionRun({ ctx }) {
        return {
          async transformInput() {
            const events = [ctx.event, ...(((ctx as { events?: unknown[] }).events ?? []) as Array<{ data?: { demo?: unknown } }>)];
            const demoEvent = events.some((e) => (e as { data?: { demo?: unknown } } | undefined)?.data?.demo === true);
            if (demoEvent && !(await isDemoScope())) {
              throw new NonRetriableError('A demo event reached a job outside the demo scope; refused.');
            }
          },
        };
      },
    };
  },
});

/**
 * Inngest — durable, retryable background + scheduled jobs.
 * Replaces the localStorage compliance-store and gives the compliance
 * calendar a real scheduler. Runs locally via `npm run inngest:dev`.
 */
export const inngest = new Inngest({ id: 'vcfo-suite', middleware: [demoScopeMiddleware] });
