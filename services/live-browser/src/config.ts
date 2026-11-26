/**
 * The broker's settings, all from env vars (dev/prod parity: the same code runs on a laptop and
 * on ECS Fargate; only these values differ).
 *
 *   PORT                        HTTP and WebSocket port (default 8091)
 *   LIVE_BROWSER_SHARED_SECRET  HMAC key shared with Suite (required; Secrets Manager on AWS)
 *   SUITE_URL                   Suite's base URL for callbacks, for example https://app.sbctrack.in (required)
 *   LIVE_BROWSER_POOL_MAX       most sessions at once on this node (default 4)
 *   LIVE_BROWSER_WARM           Chromium processes kept warm for a fast start (default 1; 0 turns it off)
 *   LIVE_BROWSER_WARM_IDLE_SECONDS  a warm browser nobody takes is closed after this (default 120)
 *   LIVE_BROWSER_EGRESS_IP      the fixed IP the portals see, reported on each session (G23)
 *   LIVE_BROWSER_NODE           this node's name in the session record (default the host name)
 *   LIVE_BROWSER_TYPE_MS        milliseconds per typed character (default 45)
 *   LIVE_BROWSER_FIELD_MAX_MS   longest a single field's typing may take (default 1800)
 *   LIVE_BROWSER_MOCK_PORT      also serve the VCFO Assist mock portal on 127.0.0.1:<port> (off by default)
 *   LIVE_BROWSER_MOCK_DIR       the mock portal folder (default extensions/vcfo-assist/mock-portal)
 *   LIVE_BROWSER_HEADFUL        "1" shows the Chromium window (local debugging only)
 *   LIVE_BROWSER_CHROMIUM_SANDBOX  "1" turns Chromium's own sandbox on (needs user namespaces; each session is still its own process and profile)
 *   LIVE_BROWSER_CHROMIUM_PATH  a Chromium binary to use instead of Playwright's own download
 *   LIVE_BROWSER_TEST_HOOKS     "1" adds signed read-only test routes (e2e only; never on AWS)
 */
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Env = Record<string, string | undefined>;

export interface BrokerConfig {
  port: number;
  secret: string;
  suiteUrl: string;
  poolMax: number;
  warm: number;
  warmIdleMs: number;
  egressIp: string | null;
  node: string;
  typeMsPerChar: number;
  fieldMaxMs: number;
  mockPort: number | null;
  mockDir: string;
  headful: boolean;
  /** Chromium's own sandbox. Off by default, as in Playwright; it needs user namespaces, which Fargate does not give. */
  chromiumSandbox: boolean;
  /** A Chromium binary other than the one Playwright downloaded (a machine with its own build). */
  chromiumPath: string | null;
  testHooks: boolean;
}

const int = (v: string | undefined, d: number, min: number, max: number): number => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

/** The repository root when the service runs from its own folder (dev) or from the image (/srv). */
function repoRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // src/config.ts and dist/server.mjs both sit two levels under services/live-browser.
  return path.resolve(here, '../../..');
}

export function readConfig(env: Env = process.env): BrokerConfig {
  const secret = env.LIVE_BROWSER_SHARED_SECRET?.trim() ?? '';
  const suiteUrl = (env.SUITE_URL?.trim() ?? '').replace(/\/+$/, '');
  return {
    port: int(env.PORT, 8091, 1, 65535),
    secret,
    suiteUrl,
    poolMax: int(env.LIVE_BROWSER_POOL_MAX, 4, 1, 32),
    warm: int(env.LIVE_BROWSER_WARM, 1, 0, 4),
    warmIdleMs: int(env.LIVE_BROWSER_WARM_IDLE_SECONDS, 120, 10, 3600) * 1000,
    egressIp: env.LIVE_BROWSER_EGRESS_IP?.trim() || null,
    node: env.LIVE_BROWSER_NODE?.trim() || os.hostname(),
    typeMsPerChar: int(env.LIVE_BROWSER_TYPE_MS, 45, 0, 500),
    fieldMaxMs: int(env.LIVE_BROWSER_FIELD_MAX_MS, 1800, 0, 20_000),
    mockPort: env.LIVE_BROWSER_MOCK_PORT ? int(env.LIVE_BROWSER_MOCK_PORT, 4318, 1, 65535) : null,
    mockDir: env.LIVE_BROWSER_MOCK_DIR?.trim() || path.join(repoRoot(), 'extensions/vcfo-assist/mock-portal'),
    headful: env.LIVE_BROWSER_HEADFUL === '1',
    chromiumSandbox: env.LIVE_BROWSER_CHROMIUM_SANDBOX === '1',
    chromiumPath: env.LIVE_BROWSER_CHROMIUM_PATH?.trim() || null,
    testHooks: env.LIVE_BROWSER_TEST_HOOKS === '1',
  };
}

/** Refuses to start without the two settings every request depends on. */
export function configProblems(c: BrokerConfig): string[] {
  const out: string[] = [];
  if (c.secret.length < 32) out.push('LIVE_BROWSER_SHARED_SECRET must be set (at least 32 characters)');
  if (!/^https?:\/\//.test(c.suiteUrl)) out.push('SUITE_URL must be set, for example https://app.sbctrack.in');
  return out;
}
