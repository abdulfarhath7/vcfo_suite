import { gzipSync } from 'node:zlib';
import { isIsoDate } from './months';
import type { JobType, Voucher } from './tally';

/** The VCFO side of the fixed connector contract (see README.md). */
export class UnauthorizedError extends Error {
  constructor() {
    super('Disconnected from VCFO. Pair again.');
  }
}
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface Job {
  id: string;
  type: JobType;
  from: string;
  to: string;
}

export type JobResult =
  | { ok: false; error: string }
  | { ok: true; company: string | null; vouchers: Voucher[] };

export const MAX_RESULT_BYTES = 20 * 1024 * 1024;

export class VcfoClient {
  constructor(private baseUrl: string, private token?: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private async call(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(this.baseUrl + path, {
      ...init,
      headers,
      signal: AbortSignal.timeout(init.timeoutMs ?? 30_000),
    });
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new HttpError(res.status, `VCFO answered HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
    }
    return res;
  }

  private json(path: string, body: unknown) {
    return this.call(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async pair(body: { code: string; name: string; version: string; tallyCompany: string | null }) {
    const res = await this.json('/api/tally/connector/pair', body);
    const data = (await res.json()) as { token?: string; sheetName?: string };
    if (!data.token) throw new Error('VCFO did not return a token. Check the code and try again.');
    return { token: data.token, sheetName: data.sheetName ?? '' };
  }

  async hello(body: { version: string; tallyCompany: string | null; tallyReachable: boolean }) {
    await this.json('/api/tally/connector/hello', body);
  }

  /** Long poll: the server holds the request up to 45 s. Returns null when there is no job. */
  async nextJob(): Promise<Job | null> {
    const res = await this.call('/api/tally/connector/jobs', { method: 'GET', timeoutMs: 75_000 });
    if (res.status === 204) return null;
    const data = (await res.json()) as { job?: Partial<Job> };
    const j = data.job;
    if (!j) return null;
    if (
      typeof j.id !== 'string' ||
      (j.type !== 'sales' && j.type !== 'receipts') ||
      !isIsoDate(j.from) ||
      !isIsoDate(j.to)
    ) {
      throw new Error('VCFO sent a job the connector does not understand.');
    }
    return { id: j.id, type: j.type, from: j.from, to: j.to };
  }

  async postResult(id: string, result: JobResult) {
    let body = gzipSync(JSON.stringify(result));
    if (body.length > MAX_RESULT_BYTES) {
      body = gzipSync(
        JSON.stringify({ ok: false, error: 'The result is larger than 20 MB. Ask VCFO for a shorter period.' }),
      );
    }
    await this.call(`/api/tally/connector/jobs/${encodeURIComponent(id)}/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
      body,
      timeoutMs: 120_000,
    });
  }
}
