/**
 * ONE LIVE SESSION: one Chromium process with a fresh temporary profile, one portal page, the
 * VCFO Assist engine driving it, and the viewers watching it over WebSockets.
 *
 *  - The screen streams with CDP `Page.startScreencast` (JPEG frames). Frames go to the viewers and
 *    nowhere else: none is written, kept or sent to Suite (proposed G22).
 *  - An `act` viewer's mouse, wheel, keyboard and text go to the page with CDP `Input.dispatch*` and
 *    `Input.insertText`. A `watch` viewer's input is dropped. Input is never logged or stored.
 *  - The engine starts when the first viewer opens the stream, and the fill pauses while nobody
 *    watches (proposed G20). Pause and Resume hold the fill between fields.
 *  - G13: a page whose plan matches what the user approved with "Fill now" is filled without a
 *    further click; anything else waits at the confirm table for the person (`approval.ts`).
 *  - Downloads are cancelled, except a PDF while the engine is at its DOWNLOAD or WAIT_DSC step,
 *    which is held in memory for the act viewer to fetch once.
 *  - At the end (done, cancel, idle, hard stop, kill switch) the browser is closed and its profile
 *    folder deleted (proposed G19).
 */
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium, type BrowserContext, type CDPSession, type Page } from 'playwright';
import type { WebSocket } from 'ws';
import { RunEngine, type UserEvent } from '../../../extensions/vcfo-assist/src/engine/runner';
import { TERMINAL } from '../../../extensions/vcfo-assist/src/engine/machine';
import { normalizeRecipe } from '../../../extensions/vcfo-assist/src/recipes/normalize';
import type { Recipe, RecipeGate, Run } from '../../../extensions/vcfo-assist/src/shared/types';
import extensionPackage from '../../../extensions/vcfo-assist/package.json';
import type {
  LiveSessionEndReason,
  LiveSessionStatus,
  LiveViewState,
  SessionEvent,
  SessionStartBody,
  StreamServerMessage,
  ViewerClaims,
  ViewerSeen,
} from '../../../src/lib/live-browser/contract';
import { buildApproval, unapproved, withoutTypeOnPortal, type Approval } from './approval';
import { cdpCommandFor, isInput, parseClientMessage } from './input';
import { PlaywrightPortal } from './playwright-portal';
import { MemoryStore, postCallback, serverSuite, type CallbackTarget } from './server-suite';
import { fieldViews, summarise } from './status';
import type { BrokerConfig } from './config';

export const VIEWPORT = { w: 1280, h: 800 } as const;

export interface LaunchedBrowser {
  context: BrowserContext;
  dir: string;
}

/** A fresh Chromium with an empty temporary profile. */
export async function launchBrowser(cfg: Pick<BrokerConfig, 'headful' | 'chromiumSandbox' | 'chromiumPath'>): Promise<LaunchedBrowser> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'vcfo-live-'));
  const context = await chromium.launchPersistentContext(dir, {
    headless: !cfg.headful,
    chromiumSandbox: cfg.chromiumSandbox,
    ...(cfg.chromiumPath ? { executablePath: cfg.chromiumPath } : {}),
    viewport: { width: VIEWPORT.w, height: VIEWPORT.h },
    deviceScaleFactor: 1,
    acceptDownloads: true,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    args: ['--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage', '--disable-features=Translate,MediaRouter', '--password-store=basic'],
  });
  return { context, dir };
}

interface Viewer {
  ws: WebSocket;
  claims: ViewerClaims;
  ip: string | null;
  userAgent: string | null;
}

export interface SessionDeps {
  cfg: BrokerConfig;
  script: string;
  /** Called once when the session has ended and its browser is gone. */
  onClosed: (id: string) => void;
  /** Overridable for tests. */
  callback?: (op: Parameters<typeof postCallback>[1]) => Promise<unknown>;
  now?: () => number;
}

export class LiveSession {
  readonly id: string;
  readonly createdAt: number;
  lastActivity: number;
  private browser: LaunchedBrowser | null = null;
  private page: Page | null = null;
  private cdp: CDPSession | null = null;
  private readonly viewers = new Set<Viewer>();
  private engine: RunEngine | null = null;
  private recipe: Recipe;
  private readonly approval: Approval;
  private readonly profile: Record<string, unknown>;
  private paused = false;
  private ended: LiveSessionEndReason | null = null;
  private typing: string | null = null;
  private lastSeen: ViewerSeen | null = null;
  private lastReported = '';
  private reportTimer: ReturnType<typeof setTimeout> | null = null;
  private broadcastTimer: ReturnType<typeof setTimeout> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private gateWaiters: Array<() => void> = [];
  private confirmedPlan = '';
  private pdf: { name: string; bytes: Buffer } | null = null;
  private readonly target: CallbackTarget;
  private readonly now: () => number;

  constructor(
    readonly start: SessionStartBody,
    private readonly deps: SessionDeps,
  ) {
    this.id = start.sessionId;
    this.now = deps.now ?? (() => Date.now());
    this.createdAt = this.now();
    this.lastActivity = this.createdAt;
    this.target = { suiteUrl: deps.cfg.suiteUrl, secret: deps.cfg.secret };
    const signed = start.signedRecipe as { recipe?: unknown };
    this.recipe = normalizeRecipe(signed?.recipe);
    const body = (start.profile ?? {}) as { profile?: Record<string, unknown> };
    const raw = body.profile ?? {};
    this.profile = withoutTypeOnPortal(raw, this.recipe, start.typeOnPortal);
    this.approval = buildApproval(signed?.recipe, this.profile, start.approvedKeys);
  }

  get status(): LiveSessionStatus {
    if (this.ended) return this.ended === 'done' ? 'done' : this.ended === 'cancelled' ? 'cancelled' : this.ended === 'error' ? 'failed' : 'expired';
    return this.summary().status;
  }

  get isOpen(): boolean {
    return !this.ended;
  }

  get viewerCount(): number {
    return this.viewers.size;
  }

  // ---------- lifecycle ----------

  /** Takes a launched (or warm) browser and opens the portal start page. */
  async open(browser: LaunchedBrowser): Promise<void> {
    this.browser = browser;
    const { context } = browser;
    await context.addInitScript({ content: this.deps.script });
    context.on('page', (p) => void this.usePage(p));
    context.on('close', () => void this.end('error', 'the browser closed'));
    const page = context.pages()[0] ?? (await context.newPage());
    await this.usePage(page);
    this.report({ status: 'ready', node: this.deps.cfg.node, egressIp: this.deps.cfg.egressIp, progressText: 'Portal opening' }, true);
    void page
      .goto(this.start.startUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      .then(() => this.broadcastState())
      .catch((err: Error) => this.report({ error: `The portal did not open: ${err.message}`.slice(0, 300) }, true));
    this.tickTimer = setInterval(() => void this.tick(), 1500);
  }

  private async usePage(page: Page): Promise<void> {
    if (this.ended) return;
    this.page = page;
    page.on('download', (d) => void this.onDownload(d));
    page.on('close', () => {
      if (this.page !== page || !this.browser) return;
      const rest = this.browser.context.pages().filter((p) => !p.isClosed());
      if (rest.length) void this.usePage(rest[rest.length - 1]!);
    });
    await this.startScreencast();
  }

  private async startScreencast(): Promise<void> {
    if (!this.page || !this.browser) return;
    const old = this.cdp;
    this.cdp = null;
    if (old) await old.detach().catch(() => undefined);
    const cdp = await this.browser.context.newCDPSession(this.page);
    this.cdp = cdp;
    cdp.on('Page.screencastFrame', (frame: { data: string; sessionId: number; metadata: { deviceWidth?: number; deviceHeight?: number } }) => {
      void cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => undefined);
      // The frame goes to the open sockets and is then dropped (proposed G22).
      this.sendAll({ t: 'frame', data: frame.data, w: frame.metadata.deviceWidth ?? VIEWPORT.w, h: frame.metadata.deviceHeight ?? VIEWPORT.h });
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: VIEWPORT.w, maxHeight: VIEWPORT.h, everyNthFrame: 1 }).catch(() => undefined);
  }

  /** Restarting the screencast makes Chromium send a fresh frame, so a new viewer sees the page at once. */
  private async refreshFrame(): Promise<void> {
    const cdp = this.cdp;
    if (!cdp) return;
    await cdp.send('Page.stopScreencast').catch(() => undefined);
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: VIEWPORT.w, maxHeight: VIEWPORT.h, everyNthFrame: 1 }).catch(() => undefined);
  }

  private startEngine(): void {
    if (this.engine || this.ended) return;
    const portal = new PlaywrightPortal(() => this.page!, this.deps.script, {
      gate: () => this.gate(),
      attended: () => this.viewers.size > 0,
      onTyping: (label) => {
        this.typing = label;
        this.broadcastState();
      },
      typing: { msPerChar: this.deps.cfg.typeMsPerChar, fieldMaxMs: this.deps.cfg.fieldMaxMs },
    });
    const profileBody = { ...(this.start.profile as Record<string, unknown>), profile: this.profile };
    const suite = serverSuite(this.start, profileBody, this.target, () => this.lastSeen);
    const engine = new RunEngine({
      suite,
      store: new MemoryStore(),
      portalFor: () => portal,
      extensionVersion: extensionPackage.version,
      device: async () => ({
        installId: `lb-${this.id}`.slice(0, 64),
        userAgent: `VCFO Live Browser ${this.deps.cfg.node} (Chromium ${this.browser?.context.browser()?.version() ?? ''})`.slice(0, 400),
      }),
      onChange: (run) => this.onRunChange(run),
    });
    this.engine = engine;
    void engine
      .start({
        engagementId: this.start.engagementId,
        engagementName: this.start.engagementName,
        agentId: this.start.agentId,
        subAgentId: this.start.taskId,
        recipeId: this.start.recipeId,
        portalTabId: 1,
        mcaLoginLabel: this.start.portalLoginLabel,
      })
      .catch((err: Error) => {
        // StartRefused: the portal page is not open yet. Try again on the next tick.
        this.engine = null;
        this.report({ progressText: err.message.slice(0, 200) });
      });
  }

  private async tick(): Promise<void> {
    if (this.ended) return;
    if (!this.engine && this.viewers.size > 0 && this.page && this.page.url() !== 'about:blank') this.startEngine();
    if (this.engine && !this.paused && this.viewers.size > 0) await this.engine.tick().catch(() => undefined);
  }

  private onRunChange(run: Run | null): void {
    this.lastActivity = this.now();
    if (run && run.state === 'FILL' && run.wait?.kind === 'confirm' && !this.paused) this.maybeConfirm(run);
    this.broadcastState();
    this.reportSoon();
    if (run && TERMINAL.has(run.state) && !this.ended) {
      const reason: LiveSessionEndReason = run.state === 'DONE' ? 'done' : run.state === 'CANCELLED' ? 'cancelled' : 'error';
      // Leave the final page on screen for a moment, then close the browser.
      setTimeout(() => void this.end(reason, run.error ?? null), 8_000);
    }
  }

  /** G13: fills the page without a further click only when the plan is what the user approved. */
  private maybeConfirm(run: Run): void {
    const planned = run.fields.filter((f) => f.status === 'planned');
    const plan = `${run.page}|${planned.map((f) => f.key).join(',')}`;
    if (plan === this.confirmedPlan) return;
    const outside = unapproved(planned, this.approval);
    if (outside) return;
    this.confirmedPlan = plan;
    setTimeout(() => void this.engine?.send({ type: 'CONFIRM_FILL' }), 0);
  }

  private gate(): Promise<void> {
    if (!this.paused && this.viewers.size > 0) return Promise.resolve();
    return new Promise((resolve) => this.gateWaiters.push(resolve));
  }

  private openGate(): void {
    if (this.paused || this.viewers.size === 0) return;
    const waiting = this.gateWaiters;
    this.gateWaiters = [];
    for (const w of waiting) w();
  }

  // ---------- viewers ----------

  addViewer(ws: WebSocket, claims: ViewerClaims, ip: string | null, userAgent: string | null): void {
    if (this.ended) {
      ws.close(4410, 'session ended');
      return;
    }
    const viewer: Viewer = { ws, claims, ip, userAgent };
    this.viewers.add(viewer);
    this.lastActivity = this.now();
    const seen: ViewerSeen = { userId: claims.uid, role: claims.role, ip, userAgent };
    if (claims.role === 'act') this.lastSeen = seen;
    this.send(viewer, { t: 'hello', role: claims.role, viewport: { w: VIEWPORT.w, h: VIEWPORT.h } });
    this.send(viewer, { t: 'state', state: this.viewState() });
    void this.refreshFrame();
    this.report({ viewer: seen }, true);
    ws.on('message', (data: Buffer | string) => this.onMessage(viewer, typeof data === 'string' ? data : data.toString('utf8')));
    ws.on('close', () => {
      this.viewers.delete(viewer);
      this.broadcastState();
      this.reportSoon();
    });
    this.openGate();
    void this.tick();
  }

  private onMessage(viewer: Viewer, raw: string): void {
    const msg = parseClientMessage(raw, VIEWPORT);
    if (!msg || this.ended) return;
    this.lastActivity = this.now();
    if (isInput(msg)) {
      // Watch viewers cannot type or click; their input is dropped without a trace.
      if (viewer.claims.role !== 'act') return;
      const cmd = cdpCommandFor(msg);
      if (cmd && this.cdp) void this.cdp.send(cmd.method as 'Input.dispatchMouseEvent', cmd.params as never).catch(() => undefined);
      return;
    }
    if (msg.t === 'pause') {
      this.paused = true;
      this.broadcastState();
      this.reportSoon();
      return;
    }
    if (msg.t === 'resume') {
      this.paused = false;
      this.openGate();
      const run = this.engine?.run;
      if (run && run.state === 'FILL' && run.wait?.kind === 'confirm') this.maybeConfirm(run);
      this.broadcastState();
      this.reportSoon();
      return;
    }
    if (msg.t === 'event' && this.engine) void this.engine.send({ type: msg.event } as UserEvent);
  }

  private send(viewer: Viewer, msg: StreamServerMessage): void {
    if (viewer.ws.readyState !== 1) return;
    // A viewer that cannot keep up skips frames rather than queueing them.
    if (msg.t === 'frame' && viewer.ws.bufferedAmount > 2_000_000) return;
    viewer.ws.send(JSON.stringify(msg));
  }

  private sendAll(msg: StreamServerMessage): void {
    for (const v of this.viewers) this.send(v, msg);
  }

  private broadcastState(): void {
    if (this.broadcastTimer) return;
    this.broadcastTimer = setTimeout(() => {
      this.broadcastTimer = null;
      this.sendAll({ t: 'state', state: this.viewState() });
    }, 60);
  }

  private summary() {
    return summarise(this.engine?.run ?? null, {
      gates: this.recipe.gates as RecipeGate[],
      paused: this.paused,
      unattended: Boolean(this.engine) && this.viewers.size === 0,
      pageCount: this.recipe.pages.length,
    });
  }

  viewState(): LiveViewState {
    const run = this.engine?.run ?? null;
    const s = this.summary();
    const page = run ? this.recipe.pages[run.page] : undefined;
    return {
      status: this.ended ? this.status : s.status,
      gate: s.gate,
      line: s.line,
      runState: run?.state ?? null,
      page: run?.page ?? 0,
      pageCount: this.recipe.pages.length,
      pageTitle: page?.title ?? null,
      fields: fieldViews(run),
      fieldsTotal: s.fieldsTotal,
      fieldsDone: s.fieldsDone,
      typing: this.typing,
      paused: this.paused,
      unattended: Boolean(this.engine) && this.viewers.size === 0,
      srn: run?.srn ?? null,
      log: (run?.log ?? []).slice(-30).map((l) => ({ t: l.t, kind: l.kind, text: l.text })),
      viewers: this.viewers.size,
      ...(this.pdf ? { pdfReady: true } : {}),
      ...(run?.state === 'WAIT_DSC' && run.signerChoices?.length ? { signers: run.signerChoices.map((c) => ({ ref: c.ref, label: c.label })) } : {}),
    };
  }

  // ---------- Suite ----------

  private reportSoon(): void {
    if (this.reportTimer) return;
    this.reportTimer = setTimeout(() => {
      this.reportTimer = null;
      this.report({});
    }, 400);
  }

  /** Sends what changed to Suite. `force` sends even when nothing in the summary moved. */
  private report(extra: SessionEvent, force = false): void {
    const run = this.engine?.run ?? null;
    const s = this.summary();
    const event: SessionEvent = {
      status: this.ended ? this.status : this.engine ? s.status : 'ready',
      gate: s.gate,
      progressText: s.progressText,
      fieldsTotal: s.fieldsTotal,
      fieldsDone: s.fieldsDone,
      ...(run ? { runState: run.state } : {}),
      ...extra,
    };
    const key = JSON.stringify({ ...event, viewer: undefined });
    if (!force && key === this.lastReported) return;
    this.lastReported = key;
    const op = { op: 'event' as const, sessionId: this.id, demo: this.start.demo, event };
    void (this.deps.callback ?? ((o) => postCallback(this.target, o)))(op).catch(() => undefined);
  }

  // ---------- downloads (only the engine's own PDF) ----------

  private async onDownload(download: import('playwright').Download): Promise<void> {
    const state = this.engine?.run?.state;
    const name = download.suggestedFilename();
    if ((state !== 'DOWNLOAD' && state !== 'WAIT_DSC') || !/\.pdf$/i.test(name)) {
      await download.cancel().catch(() => undefined);
      return;
    }
    try {
      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const c of stream) {
        size += (c as Buffer).length;
        if (size > 20 * 1024 * 1024) throw new Error('too large');
        chunks.push(c as Buffer);
      }
      const bytes = Buffer.concat(chunks);
      if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('not a PDF');
      this.pdf = { name: name.slice(0, 120), bytes };
      await download.delete().catch(() => undefined);
      this.broadcastState();
    } catch {
      await download.delete().catch(() => undefined);
    }
  }

  /** The held PDF, once: it is dropped as soon as the act viewer takes it. */
  takePdf(): { name: string; bytes: Buffer } | null {
    const pdf = this.pdf;
    this.pdf = null;
    this.broadcastState();
    return pdf;
  }

  /** The signed PDF the person dropped in the rail (G6: its bytes are attached unchanged). */
  async dropSignedPdf(input: { name: string; base64: string; signers: string[] }): Promise<boolean> {
    const run = this.engine?.run;
    if (!this.engine || run?.state !== 'WAIT_DSC') return false;
    const bytes = Buffer.from(input.base64, 'base64');
    const { createHash } = await import('node:crypto');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    await this.engine.send({ type: 'PDF_DROPPED', name: input.name.slice(0, 120), base64: input.base64, sha256, size: bytes.length, signers: input.signers.slice(0, 20) });
    return true;
  }

  // ---------- test hooks (LIVE_BROWSER_TEST_HOOKS=1 only) ----------

  async testEval(what: 'mock' | 'rect', css?: string): Promise<unknown> {
    if (!this.page) return null;
    if (what === 'mock') {
      return this.page.evaluate(() => {
        const w = window as unknown as { __mock?: { clicks: Record<string, number>; modelWrites: string[]; submitted: boolean; paid: boolean } };
        const val = (sel: string) => (document.querySelector(sel) as HTMLInputElement | null)?.value ?? null;
        return {
          url: location.href,
          clicks: w.__mock?.clicks ?? {},
          modelWrites: w.__mock?.modelWrites ?? [],
          values: Object.fromEntries(
            Array.from(document.querySelectorAll('[data-som] input[type=text], [data-som] select')).map((el) => [(el as HTMLInputElement).name, (el as HTMLInputElement).value]),
          ),
          login: ['#login-user', '#login-password', '#login-captcha', '#login-otp'].map(val),
          loggedIn: !(document.getElementById('login-strip') as HTMLElement | null)?.offsetParent,
          marks: document.querySelector('vcfo-assist-overlay')?.getAttribute('data-marks') ?? '',
        };
      });
    }
    return this.page.evaluate((sel) => {
      const el = sel ? document.querySelector(sel) : null;
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, css ?? '');
  }

  // ---------- the end ----------

  /** Ends the session: stops the engine, closes the viewers, closes the browser and deletes its profile. */
  async end(reason: LiveSessionEndReason, error: string | null = null): Promise<void> {
    if (this.ended) return;
    const run = this.engine?.run;
    if (this.engine && run && !TERMINAL.has(run.state)) {
      await this.engine.send({ type: 'CANCEL' }).catch(() => undefined);
      await this.engine.settle().catch(() => undefined);
    }
    this.ended = reason;
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.reportTimer) clearTimeout(this.reportTimer);
    this.paused = true;
    const waiting = this.gateWaiters;
    this.gateWaiters = [];
    for (const w of waiting) w();
    this.sendAll({ t: 'state', state: this.viewState() });
    this.sendAll({ t: 'end', reason });
    for (const v of this.viewers) v.ws.close(4410, 'session ended');
    this.viewers.clear();
    this.pdf = null;
    this.report({ ended: reason, error: error?.slice(0, 500) ?? null }, true);
    const browser = this.browser;
    this.browser = null;
    this.page = null;
    if (browser) {
      await browser.context.close().catch(() => undefined);
      await rm(browser.dir, { recursive: true, force: true }).catch(() => undefined);
    }
    this.deps.onClosed(this.id);
  }
}
