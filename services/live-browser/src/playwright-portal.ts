/**
 * The engine's PortalPort over Playwright, for the one portal page of a live session. It replaces
 * the extension's `chrome-portal.ts`; everything that touches the page is the extension's own
 * content-script code (`PortalAgent`, the guards, the scanner, the filler, the overlay), injected
 * into every document as one bundled script (`src/inpage/entry.ts`). So the live browser runs the
 * same guards in front of every write and every click as the extension does (G1 to G7).
 *
 * The only additions are for the person watching: before a field is written, the overlay box is
 * drawn on it ("Filling…") and a text value is typed into it at a readable speed; `hooks.gate()`
 * holds the fill while the session is paused or nobody watches (proposed G20).
 */
import type { Page } from 'playwright';
import type { PortalPort, TeachResult } from '../../../extensions/vcfo-assist/src/engine/ports';
import type { PortalRequest } from '../../../extensions/vcfo-assist/src/portal/agent';
import type { FieldTarget } from '../../../extensions/vcfo-assist/src/shared/types';

export interface PortalHooks {
  /** Resolves when the fill may go on (not paused, somebody watching). */
  gate(): Promise<void>;
  /** True while at least one viewer has the stream open (the G12 "visible tab" of the live browser). */
  attended(): boolean;
  /** The field being typed now, for the rail; null when none. */
  onTyping(label: string | null): void;
  typing: { msPerChar: number; fieldMaxMs: number };
}

type LiveWindow = {
  __vcfoLive?: {
    handle(req: PortalRequest): Promise<unknown>;
    readBridge(): unknown;
    bridgeSet(som: string, value: string): unknown;
    typeInto(target: FieldTarget, value: string, msPerChar: number, maxMs: number): Promise<{ ok: boolean; reason?: string }>;
  };
};

const NAVIGATED = /Execution context was destroyed|navigation|Target closed|frame was detached|Cannot find context/i;

export class PlaywrightPortal implements PortalPort {
  private prepared: { target: FieldTarget; label: string } | null = null;
  private typedUid: string | null = null;

  constructor(
    private readonly page: () => Page,
    private readonly script: string,
    private readonly hooks: PortalHooks,
  ) {}

  /** The script is added to every new document by the session; this covers a page opened before that. */
  private async ensure(): Promise<void> {
    const page = this.page();
    const present = await page.evaluate(() => Boolean((window as unknown as LiveWindow).__vcfoLive)).catch(() => false);
    if (!present) await page.evaluate(this.script);
  }

  private async run<T>(fn: (page: Page) => Promise<T>): Promise<T> {
    try {
      await this.ensure();
      return await fn(this.page());
    } catch (err) {
      if (!NAVIGATED.test(String((err as Error)?.message ?? err))) throw err;
      // The page moved on mid-call (the portal navigated). Wait for the new document once and retry.
      await this.page().waitForLoadState('domcontentloaded').catch(() => undefined);
      await this.ensure();
      return fn(this.page());
    }
  }

  private ask<T>(req: PortalRequest): Promise<T> {
    return this.run((page) => page.evaluate((r) => (window as unknown as LiveWindow).__vcfoLive!.handle(r), req) as Promise<T>);
  }

  private async typeInto(target: FieldTarget, value: string, label: string): Promise<void> {
    if (this.typedUid === target.uid) return;
    this.typedUid = target.uid;
    await this.hooks.gate();
    this.hooks.onTyping(label);
    const { msPerChar, fieldMaxMs } = this.hooks.typing;
    if (msPerChar <= 0 || fieldMaxMs <= 0) return;
    await this.run((page) =>
      page.evaluate(([t, v, ms, max]) => (window as unknown as LiveWindow).__vcfoLive!.typeInto(t, v, ms, max), [target, value, msPerChar, fieldMaxMs] as const),
    ).catch(() => undefined);
  }

  async tabInfo() {
    try {
      const url = this.page().url();
      return url && url !== 'about:blank' ? { url, active: this.hooks.attended() } : null;
    } catch {
      return null;
    }
  }

  readBridge: PortalPort['readBridge'] = () =>
    this.run((page) => page.evaluate(() => (window as unknown as LiveWindow).__vcfoLive!.readBridge())) as ReturnType<PortalPort['readBridge']>;

  async bridgeSet(som: string, value: string) {
    // The engine calls this right after `prepareFill` for the same control: type it first, so the
    // person sees the value arrive, then let the form's own model take the full value.
    if (this.prepared) await this.typeInto(this.prepared.target, value, this.prepared.label);
    return this.run((page) => page.evaluate(([s, v]) => (window as unknown as LiveWindow).__vcfoLive!.bridgeSet(s, v), [som, value] as const)) as ReturnType<PortalPort['bridgeSet']>;
  }

  scan: PortalPort['scan'] = (opts) => this.ask({ type: 'scan', opts });

  prepareFill: PortalPort['prepareFill'] = async (target, label) => {
    await this.hooks.gate();
    this.prepared = { target, label };
    this.typedUid = null;
    return this.ask({ type: 'prepareFill', target, label });
  };

  fill: PortalPort['fill'] = async (target, value, label, bridgeTried, opts) => {
    try {
      if (!bridgeTried) await this.typeInto(target, value, label);
      return await this.ask({ type: 'fill', target, value, label, bridgeTried, opts });
    } finally {
      this.prepared = null;
      this.hooks.onTyping(null);
    }
  };

  pageReady: PortalPort['pageReady'] = (css) => this.ask({ type: 'pageReady', css });
  closePopups: PortalPort['closePopups'] = (css) => this.ask({ type: 'closePopups', css });
  click: PortalPort['click'] = async (target, label, resultCss) => {
    await this.hooks.gate();
    return this.ask({ type: 'click', css: target.css, text: target.text, label, resultCss });
  };
  attach: PortalPort['attach'] = (css, name, base64) => this.ask({ type: 'attach', css, name, base64 });
  highlightHuman: PortalPort['highlightHuman'] = (gates) => this.ask({ type: 'highlightHuman', gates });
  markForRecords: PortalPort['markForRecords'] = (targets) => this.ask({ type: 'markForRecords', targets });
  readSrn: PortalPort['readSrn'] = (pattern) => this.ask({ type: 'readSrn', pattern });

  async teach(label: string): Promise<TeachResult> {
    return this.ask<TeachResult>({ type: 'teach', label, timeoutMs: 180_000 }).catch(() => null);
  }

  async cancelTeach(): Promise<void> {
    await this.ask({ type: 'cancelTeach' }).catch(() => undefined);
  }

  async banner(text: string | null): Promise<void> {
    await this.ask({ type: 'banner', text }).catch(() => undefined);
  }
}
