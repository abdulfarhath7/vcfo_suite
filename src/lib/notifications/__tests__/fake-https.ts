import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';
import type { RequestOptions } from 'node:https';
import type { LookupAddress } from 'node:dns';
import { Readable } from 'node:stream';

/**
 * A stand-in for `node:https` in tests: `get` runs the request's own lookup hook as a socket would,
 * records the addresses it would connect to, and answers with the Response the test's handler gives.
 * Load it with `vi.mock('node:https', () => import('@/lib/notifications/__tests__/fake-https'))`.
 */
export type Handler = (url: string, headers: Record<string, string>) => Response | Promise<Response>;

let handler: Handler = () => {
  throw new Error('no_handler');
};
export const connected: string[] = [];

export function respondWith(next: Handler): void {
  handler = next;
  connected.length = 0;
}

export function get(url: URL, opts: RequestOptions, onResponse: (res: IncomingMessage) => void): EventEmitter {
  const req = new EventEmitter();
  const lookup = opts.lookup as unknown as (host: string, o: { all: true }, cb: (err: Error | null, list: LookupAddress[]) => void) => void;
  lookup(url.hostname, { all: true }, (err, list) => {
    if (err) return void req.emit('error', err);
    connected.push(...list.map((entry) => entry.address));
    Promise.resolve()
      .then(() => handler(url.href, opts.headers as Record<string, string>))
      .then(async (res) => {
        const body = Readable.from(res.body ? [Buffer.from(await res.arrayBuffer())] : []);
        onResponse(Object.assign(body, { statusCode: res.status, rawHeaders: [...res.headers].flat() }) as unknown as IncomingMessage);
      })
      .catch((e: unknown) => req.emit('error', e));
  });
  return req;
}
