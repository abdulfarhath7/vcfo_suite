import type { z } from 'zod';

export type ParseBodyFailure = { ok: false; status: 400; error: 'invalid_json' | 'invalid_body' };

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodSchema<T>,
): Promise<{ ok: true; data: T } | ParseBodyFailure> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { ok: false, status: 400, error: 'invalid_json' };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, status: 400, error: 'invalid_body' };
  }

  return { ok: true, data: parsed.data };
}
