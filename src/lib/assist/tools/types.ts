import type { LlmTool } from '@/lib/assist/provider';

/** One read-only tool: its schema for the model and a scoped executor. */
export interface AssistTool<Ctx> {
  definition: LlmTool;
  run(ctx: Ctx, input: Record<string, unknown>): Promise<unknown>;
}

export function numberArg(input: Record<string, unknown>, key: string, fallback: number, max: number): number {
  const raw = Number(input[key]);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(Math.floor(raw), max);
}
