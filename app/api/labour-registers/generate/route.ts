import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { generateRegisters } from '@/lib/actions/labour/generate';

/**
 * Build this batch's registers — or, far more often, find that they are already built.
 *
 * **A request is a cache lookup first and a build second.** Every form's content address is
 * computed from the data that form actually prints, and a document already stored under that
 * address is returned untouched: no render, no upload, no new row. That is the whole point of
 * the design, and this route is its first caller — until now `findByCacheKey` had none.
 *
 * The hash is taken **per form, over the rows that form prints**, not over the whole batch.
 * The difference matters: a night shift allowance appearing in the paysheet re-keys the wage
 * registers that print one and leaves the twenty-odd others answered from storage. Hashing the
 * dataset would rebuild everything for any change anywhere.
 *
 * Generation runs inline rather than as a job, which is this codebase's norm for a document a
 * person is waiting for. Twenty-nine sheets of a few hundred employees is seconds, and the
 * expensive part — reading and parsing four uploads — happens once for all of them.
 *
 * A form that cannot be produced honestly is reported, not fatal. Twenty-eight registers that
 * can be built should be built, and the one that cannot should say what it was short of.
 *
 * Nothing is generated before the period is closed: `recordDocument` refuses on an unlocked
 * batch, and this route refuses earlier with a clearer message.
 *
 * `formats` decides what comes out. The default is the workbook alone, because that is what a
 * preparer works from. Asking for the PDF as well produces the printout that gets signed: it
 * is content-addressed under the same key with a different extension, so the two formats are
 * two files of one document rather than two documents.
 *
 * POST /api/labour-registers/generate  { batchId, formIds?, companyName?, formats? }
 *   → { documents: [...], blocked: [...], deferred: [...], suppressed: [...] }
 */
export const maxDuration = 300;

const bodySchema = z.object({
  batchId: z.string().min(1).max(64),
  /** Build only these forms. Left out, everything the period calls for. */
  formIds: z.array(z.string().min(1).max(64)).max(64).optional(),
  /** The establishment name to print, where the caller knows it. */
  companyName: z.string().max(200).optional(),
  /** Which files to produce. The workbook alone, by default. */
  formats: z.array(z.enum(['xlsx', 'pdf'])).min(1).max(2).optional(),
});

export async function POST(request: Request) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });

  const outcome = await generateRegisters(guard.ctx, body.data);
  if (outcome.kind === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (outcome.kind === 'not_ready') {
    return NextResponse.json(
      { error: 'Mark the inputs ready before generating. Nothing is built from a half-gathered month.' },
      { status: 409 },
    );
  }

  const { documents, blocked, deferred, suppressed } = outcome;
  return NextResponse.json({
    documents,
    blocked,
    deferred,
    suppressed,
    builtCount: documents.filter((d) => d.built).length,
    fromStorage: documents.filter((d) => !d.built).length,
  });
}
