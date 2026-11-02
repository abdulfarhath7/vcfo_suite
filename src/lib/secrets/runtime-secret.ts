import 'server-only';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

/**
 * RUNTIME SECRETS (M7). A secret that rotates by hand (the Anthropic API key, the Azure
 * client secret) is read from Secrets Manager while the app runs, so a rotation needs no
 * redeploy.
 *
 * - `<NAME>_SECRET_ID` set (AWS): the value comes from Secrets Manager (GetSecretValue) and
 *   is kept in memory for about ten minutes. A caller that sees the provider refuse the value
 *   (HTTP 401, `invalid_client`) calls `invalidate()`, or uses `withSecretRetry`, so the next
 *   read gets the rotated value at once.
 * - Only `<NAME>` set (local dev): the env var value is used as it is.
 *
 * A secret can hold the plain value or JSON. For JSON, the first of `jsonKeys` that holds a
 * string wins, or the only string field when there is just one.
 *
 * The value never leaves the server. Nothing here logs it.
 */

export const RUNTIME_SECRET_TTL_MS = 10 * 60 * 1000;
/** After a failed read, wait this long before asking Secrets Manager again. */
export const RUNTIME_SECRET_RETRY_MS = 30 * 1000;

type Env = Record<string, string | undefined>;

/** The part of the SDK client this module uses; tests pass a mock. */
export interface SecretsClientLike {
  send(command: GetSecretValueCommand): Promise<{ SecretString?: string }>;
}

type ClientFactory = (region: string | undefined) => SecretsClientLike;

const defaultFactory: ClientFactory = (region) =>
  new SecretsManagerClient({
    region,
    maxAttempts: 2,
    requestHandler: { requestTimeout: 3000, connectionTimeout: 2000 },
  });

let factory: ClientFactory = defaultFactory;
const clients = new Map<string, SecretsClientLike>();

/** Tests inject a mock client factory; `undefined` restores the AWS SDK client. */
export function setSecretsClientFactoryForTests(f: ClientFactory | undefined): void {
  factory = f ?? defaultFactory;
  clients.clear();
}

/** The region from a secret ARN, else AWS_REGION, else the SDK default chain. */
export function secretRegion(secretId: string, env: Env = process.env): string | undefined {
  if (secretId.startsWith('arn:')) return secretId.split(':')[3] || undefined;
  return env.AWS_REGION?.trim() || env.S3_REGION?.trim() || undefined;
}

function clientFor(region: string | undefined): SecretsClientLike {
  const key = region ?? '';
  let c = clients.get(key);
  if (!c) {
    c = factory(region);
    clients.set(key, c);
  }
  return c;
}

/** The value inside a SecretString: the plain text, or one field of a JSON object. */
export function pickSecretValue(raw: string | undefined, jsonKeys: string[] = []): string | undefined {
  const text = raw?.trim();
  if (!text) return undefined;
  if (text.startsWith('{')) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      for (const k of jsonKeys) {
        const v = obj[k];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
      const strings = Object.values(obj).filter((v): v is string => typeof v === 'string' && v.trim() !== '');
      return strings.length === 1 ? strings[0]!.trim() : undefined;
    } catch {
      // Not JSON after all: use the text as it is.
    }
  }
  return text;
}

export type SecretSource = 'secrets_manager' | 'env' | 'none';

export interface RuntimeSecret {
  readonly envVar: string;
  readonly secretIdVar: string;
  /** The value, or undefined when neither env var is set. Throws when Secrets Manager fails. */
  get(): Promise<string | undefined>;
  /** Drop the cached value, so the next `get()` reads Secrets Manager again. */
  invalidate(): void;
  /** Where the value comes from, from env var presence only (no network). */
  source(): SecretSource;
  /** True when a value can be had (either env var is set). */
  configured(): boolean;
}

export interface RuntimeSecretOptions {
  /** The plain env var for local dev, for example ANTHROPIC_API_KEY. */
  envVar: string;
  /** The env var that names the Secrets Manager secret (name or ARN). */
  secretIdVar: string;
  jsonKeys?: string[];
  ttlMs?: number;
  /** Tests pass an env object and a clock. */
  env?: () => Env;
  now?: () => number;
}

export function runtimeSecret(opts: RuntimeSecretOptions): RuntimeSecret {
  const ttl = opts.ttlMs ?? RUNTIME_SECRET_TTL_MS;
  const env = opts.env ?? (() => process.env);
  const now = opts.now ?? (() => Date.now());
  let cached: { id: string; value: string; at: number } | null = null;
  let failed: { id: string; at: number; error: unknown } | null = null;
  let inflight: { id: string; promise: Promise<string | undefined> } | null = null;

  const secretId = () => env()[opts.secretIdVar]?.trim() || '';

  async function load(id: string): Promise<string | undefined> {
    const out = await clientFor(secretRegion(id, env())).send(new GetSecretValueCommand({ SecretId: id }));
    const value = pickSecretValue(out.SecretString, opts.jsonKeys);
    if (!value) throw new Error(`Secret ${opts.secretIdVar} has no value`);
    cached = { id, value, at: now() };
    failed = null;
    return value;
  }

  return {
    envVar: opts.envVar,
    secretIdVar: opts.secretIdVar,
    source() {
      if (secretId()) return 'secrets_manager';
      return env()[opts.envVar]?.trim() ? 'env' : 'none';
    },
    configured() {
      return this.source() !== 'none';
    },
    invalidate() {
      cached = null;
      failed = null;
    },
    async get() {
      const id = secretId();
      if (!id) return env()[opts.envVar]?.trim() || undefined;
      if (cached && cached.id === id && now() - cached.at < ttl) return cached.value;
      if (failed && failed.id === id && now() - failed.at < RUNTIME_SECRET_RETRY_MS) throw failed.error;
      if (inflight && inflight.id === id) return inflight.promise;
      const promise = load(id)
        .catch((err: unknown) => {
          failed = { id, at: now(), error: err };
          throw err;
        })
        .finally(() => {
          inflight = null;
        });
      inflight = { id, promise };
      return promise;
    },
  };
}

/**
 * Run `fn` with the secret's value. When `fn` fails with an error that `isRejected` calls a
 * refused credential and the value came from Secrets Manager, drop the cache, read the
 * secret again and, if the value changed, run `fn` once more. Any other error goes up as is.
 */
export async function withSecretRetry<T>(
  secret: RuntimeSecret,
  fn: (value: string) => Promise<T>,
  isRejected: (err: unknown) => boolean,
): Promise<T> {
  const value = await secret.get();
  if (!value) throw new Error(`${secret.envVar} is not set`);
  try {
    return await fn(value);
  } catch (err) {
    if (secret.source() !== 'secrets_manager' || !isRejected(err)) throw err;
    secret.invalidate();
    const fresh = await secret.get();
    if (!fresh || fresh === value) throw err;
    return fn(fresh);
  }
}
