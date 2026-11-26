/**
 * THE BROKER: the sessions on this node, the pool limit and the warm browsers.
 *
 * A warm browser is a Chromium with an empty temporary profile and a blank page, launched ahead so
 * a session starts in about a second. Nothing has been visited in it, so handing it to a session
 * shares nothing between clients (DECISIONS.md B3). A warm browser nobody takes is closed after
 * `warmIdleMs` (two minutes by default) and its profile deleted.
 */
import { rm } from 'node:fs/promises';
import type { SessionStartBody } from '../../../src/lib/live-browser/contract';
import type { BrokerConfig } from './config';
import { LiveSession, launchBrowser, type LaunchedBrowser, type SessionDeps } from './session';

export class PoolFull extends Error {}

interface Warm {
  browser: LaunchedBrowser;
  timer: ReturnType<typeof setTimeout>;
}

export class Broker {
  readonly sessions = new Map<string, LiveSession>();
  private warm: Warm[] = [];
  private warming = 0;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    readonly cfg: BrokerConfig,
    private readonly script: string,
    private readonly launch: () => Promise<LaunchedBrowser> = () => launchBrowser(cfg),
    private readonly extra: Partial<SessionDeps> = {},
  ) {}

  startSweeper(): void {
    // Idle and hard-stop limits from the settings Suite sent; Suite's reaper job checks again.
    this.sweepTimer = setInterval(() => void this.sweep(), 15_000);
  }

  async sweep(now = Date.now()): Promise<void> {
    for (const s of this.sessions.values()) {
      const { idleMinutes, maxMinutes } = s.start.limits;
      if (now - s.createdAt > maxMinutes * 60_000) await s.end('max_time');
      else if (now - s.lastActivity > idleMinutes * 60_000) await s.end('idle');
    }
  }

  /** Keeps `cfg.warm` browsers ready, within the pool limit. */
  async ensureWarm(): Promise<void> {
    while (this.warm.length + this.warming < this.cfg.warm && this.sessions.size + this.warm.length + this.warming < this.cfg.poolMax) {
      this.warming += 1;
      try {
        const browser = await this.launch();
        const timer = setTimeout(() => void this.dropWarm(browser), this.cfg.warmIdleMs);
        this.warm.push({ browser, timer });
      } finally {
        this.warming -= 1;
      }
    }
  }

  private async dropWarm(browser: LaunchedBrowser): Promise<void> {
    const i = this.warm.findIndex((w) => w.browser === browser);
    if (i < 0) return;
    this.warm.splice(i, 1);
    await browser.context.close().catch(() => undefined);
    await rm(browser.dir, { recursive: true, force: true }).catch(() => undefined);
  }

  private async takeBrowser(): Promise<LaunchedBrowser> {
    const w = this.warm.shift();
    if (w) {
      clearTimeout(w.timer);
      return w.browser;
    }
    return this.launch();
  }

  async startSession(body: SessionStartBody): Promise<LiveSession> {
    const existing = this.sessions.get(body.sessionId);
    if (existing) return existing;
    if (this.sessions.size >= this.cfg.poolMax) throw new PoolFull('pool_full');
    const session = new LiveSession(body, {
      cfg: this.cfg,
      script: this.script,
      onClosed: (id) => {
        this.sessions.delete(id);
        void this.ensureWarm().catch(() => undefined);
      },
      ...this.extra,
    });
    this.sessions.set(session.id, session);
    try {
      await session.open(await this.takeBrowser());
    } catch (err) {
      this.sessions.delete(session.id);
      throw err;
    }
    // Refill the warm slot for the next person.
    void this.ensureWarm().catch(() => undefined);
    return session;
  }

  async close(): Promise<void> {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    for (const s of [...this.sessions.values()]) await s.end('cancelled');
    for (const w of [...this.warm]) {
      clearTimeout(w.timer);
      await this.dropWarm(w.browser);
    }
  }
}
