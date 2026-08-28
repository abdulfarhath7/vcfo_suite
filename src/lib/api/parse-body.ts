import type { z } from 'zod';

export type ParseBodyFailure = {
  ok: false;
  status: 400;
  error: string;
  issues?: string[];
};

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
    const issues = parsed.error.issues
      .map((issue) => issue.message.trim())
      .filter(Boolean);
    return {
      ok: false,
      status: 400,
      error: issues[0] || 'invalid_body',
      issues: issues.length ? issues : undefined,
    };
  }

  return { ok: true, data: parsed.data };
}
