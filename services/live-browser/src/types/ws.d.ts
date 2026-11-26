// The part of the `ws` package (8.x) the broker uses. Declared here so the service needs no
// @types package; the runtime is the real `ws`.
declare module 'ws' {
  import type { IncomingMessage } from 'node:http';
  import type { Duplex } from 'node:stream';
  import { EventEmitter } from 'node:events';

  export class WebSocket extends EventEmitter {
    constructor(url: string, opts?: { headers?: Record<string, string> });
    readonly readyState: number;
    readonly bufferedAmount: number;
    send(data: string | Buffer): void;
    close(code?: number, reason?: string): void;
    terminate(): void;
    on(event: 'message', cb: (data: Buffer | string, isBinary: boolean) => void): this;
    on(event: 'close', cb: (code: number, reason: Buffer) => void): this;
    on(event: 'open', cb: () => void): this;
    on(event: 'error', cb: (err: Error) => void): this;
  }

  export class WebSocketServer extends EventEmitter {
    constructor(opts: { noServer?: boolean; maxPayload?: number });
    handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer, cb: (ws: WebSocket) => void): void;
    close(): void;
  }

  export default WebSocket;
}
