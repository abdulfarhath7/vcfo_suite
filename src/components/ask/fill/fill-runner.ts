'use client';

import { getFill, stepFill } from '@/hooks/ask/ask-api';
import type { FillRunView } from '@/lib/ask/fill/types';
import { repeatFieldId } from '@/lib/checklist/checklist-repeat';
import {
  getLiveFillBridge,
  waitForLiveFillBridge,
  type LiveFillBridge,
} from '@/views/incorporation/milestone-form/live-fill-bridge';
import type { FillMode } from './fill-mode';
import { getFillState, moveFillCursor, patchFillState, setFillActions, startFillState } from './fill-store';
import { fieldTarget, isInstantField, nextFrame, prefersReducedMotion, sleep, typeInto, waitForField } from './type-into';

type FillStep = FillRunView['steps'][number];
type FillRow = FillStep['rows'][number];
type Decision = 'accepted' | 'stop' | 'retry';

export type FillRunnerDeps = {
  /** Opens the step page for this engagement (router.push on a role-correct URL). */
  navigate: (engagementId: string, stepId: string) => void;
  /** How long to wait for the step form to mount. */
  bridgeTimeoutMs?: number;
  /** Auto mode poll interval. */
  pollMs?: number;
};

const FINISHED = new Set<FillRunView['status']>(['done', 'stopped', 'failed']);
const FLASH_MS = 2000;

const activeStep = (view: FillRunView): FillStep | undefined =>
  view.steps.find((s) => s.status === 'active') ??
  (view.current ? view.steps.find((s) => s.stepId === view.current && s.status !== 'done') : undefined);

const fieldSelector = (stepId: string, key: string) =>
  `[data-ask-field="${CSS.escape(`${stepId}:${key}`)}"]`;

function errorText(error: unknown, fallback: string): string {
  return (error as Error)?.message || fallback;
}

/**
 * One fill run in the browser. Manual: open each step page, type its rows into the form through
 * the bridge, wait for Accept or Stop in the chat rail, then Save and Submit with the form's own
 * handlers and tell the server, which checks the step and opens the next one. Auto: the server
 * does the work; this only polls the run so the rail shows progress.
 */
export class FillRunner {
  private cancelledFlag = false;
  private stopRequested = false;
  private decide: ((d: Decision) => void) | null = null;
  private bridge: LiveFillBridge | null = null;
  private flashed: HTMLElement[] = [];
  /** What each field held before this runner typed into it, and what it typed: Stop puts it back. */
  private typedOver = new Map<string, { before: string; typed: string }>();

  constructor(
    readonly runId: string,
    readonly mode: FillMode,
    private readonly deps: FillRunnerDeps,
  ) {}

  /** Ends this runner without telling the server (a newer run replaced it, or the shell unmounted). */
  cancel(): void {
    this.cancelledFlag = true;
    this.bridge?.pauseAutosave(false);
    this.decide?.('stop');
  }

  private get cancelled() {
    return this.cancelledFlag;
  }

  private setView(view: FillRunView) {
    patchFillState({ view });
  }

  private waitDecision(): Promise<Decision> {
    return new Promise((resolve) => {
      this.decide = (d) => {
        this.decide = null;
        resolve(d);
      };
    });
  }

  async start(): Promise<void> {
    startFillState(this.runId, this.mode);
    setFillActions({
      accept: () => this.decide?.('accepted'),
      retry: () => this.decide?.('retry'),
      stop: () => {
        this.stopRequested = true;
        this.decide?.('stop');
      },
    });
    try {
      const view = await getFill(this.runId);
      if (this.cancelled) return;
      this.setView(view);
      if (this.mode === 'auto') await this.pollAuto(view);
      else await this.runManual(view);
    } catch (error) {
      if (!this.cancelled) patchFillState({ phase: 'error', message: errorText(error, 'The fill could not be loaded.') });
    } finally {
      moveFillCursor({ visible: false });
      this.bridge?.pauseAutosave(false);
    }
  }

  private async pollAuto(first: FillRunView): Promise<void> {
    let view = first;
    patchFillState({ phase: 'auto', message: null });
    while (!this.cancelled && !FINISHED.has(view.status)) {
      if (this.stopRequested) {
        const step = activeStep(view);
        if (step) view = await stepFill(this.runId, { stepId: step.stepId, action: 'stop' });
        this.setView(view);
        patchFillState({ phase: 'stopped', message: view.stopReason ?? null });
        return;
      }
      await sleep(this.deps.pollMs ?? 2000);
      if (this.cancelled) return;
      view = await getFill(this.runId);
      this.setView(view);
    }
    if (!this.cancelled) this.finish(view);
  }

  private finish(view: FillRunView) {
    patchFillState({
      phase: view.status === 'done' ? 'done' : view.status === 'failed' ? 'error' : 'stopped',
      message: view.stopReason ?? null,
    });
  }

  private async runManual(first: FillRunView): Promise<void> {
    let view = first;
    while (!this.cancelled) {
      if (FINISHED.has(view.status)) return this.finish(view);
      const step = activeStep(view);
      if (!step) return this.finish({ ...view, status: view.status === 'running' ? 'done' : view.status });

      patchFillState({ phase: 'opening', message: `Opening ${step.title}` });
      let bridge = getLiveFillBridge(view.engagementId, step.stepId);
      if (!bridge) {
        this.deps.navigate(view.engagementId, step.stepId);
        bridge = await waitForLiveFillBridge(view.engagementId, step.stepId, {
          timeoutMs: this.deps.bridgeTimeoutMs ?? 20_000,
          cancelled: () => this.cancelled || this.stopRequested,
        });
      }
      if (this.cancelled) return;
      if (!bridge) {
        if (this.stopRequested) return this.stopStep(step);
        patchFillState({ phase: 'error', message: `${step.title} did not open for editing. Open it, then press Try again.` });
        if ((await this.waitDecision()) === 'stop') return this.stopStep(step);
        continue;
      }
      this.bridge = bridge;
      bridge.pauseAutosave(true);

      patchFillState({ phase: 'typing', message: null });
      const keys = await this.typeStep(bridge, step);
      moveFillCursor({ visible: false });
      if (this.cancelled) return;
      if (this.stopRequested) return this.stopStep(step);

      patchFillState({ phase: 'waiting', message: null });
      const decision = await this.waitDecision();
      if (this.cancelled) return;
      if (decision === 'stop') return this.stopStep(step);
      if (decision === 'retry') continue;

      patchFillState({ phase: 'saving', message: null });
      const live = getLiveFillBridge(view.engagementId, step.stepId);
      if (!live) {
        patchFillState({ phase: 'error', message: `${step.title} was closed before it was accepted, so nothing was saved. Press Try again to fill it again.` });
        if ((await this.waitDecision()) === 'stop') return this.stopStep(step);
        continue;
      }
      try {
        this.flash(step.stepId, keys);
        // The form is the source of truth: whatever the person changed before Accept is saved.
        await live.save();
        await live.submit();
        this.typedOver.clear();
        live.pauseAutosave(false);
        view = await stepFill(this.runId, { stepId: step.stepId, action: 'accepted' });
        if (this.cancelled) return;
        this.setView(view);
      } catch (error) {
        patchFillState({ phase: 'error', message: errorText(error, `${step.title} could not be saved.`) });
        if ((await this.waitDecision()) === 'stop') return this.stopStep(step);
      }
    }
  }

  /**
   * Stop leaves the page as it was: every value the player typed and the person did not change goes
   * back to what the field held, before autosave runs again, so leaving the page saves nothing the
   * person did not accept. A field the person changed keeps their value.
   */
  private restoreTyped() {
    const bridge = this.bridge;
    if (bridge) {
      for (const [key, { before, typed }] of this.typedOver) {
        // A value cut short by Stop mid-typing is still the player's, not the person's.
        const now = bridge.getValue(key);
        if (now !== before && (now === typed || typed.startsWith(now))) bridge.setField(key, before);
      }
    }
    this.typedOver.clear();
  }

  private async stopStep(step: FillStep): Promise<void> {
    this.restoreTyped();
    this.bridge?.pauseAutosave(false);
    moveFillCursor({ visible: false });
    try {
      const view = await stepFill(this.runId, { stepId: step.stepId, action: 'stop' });
      this.setView(view);
      patchFillState({ phase: 'stopped', message: view.stopReason ?? null });
    } catch (error) {
      patchFillState({ phase: 'stopped', message: errorText(error, 'Stopped. The server could not be told; done steps stay saved.') });
    }
  }

  /** The key the form uses for this row, adding a planned repeat entry first when it is new. */
  private async keyFor(bridge: LiveFillBridge, row: FillRow, entries: Map<string, string>): Promise<string> {
    if (!row.group || !row.entryId) return row.fieldKey;
    let entryId = entries.get(row.entryId);
    if (!entryId) {
      entryId = row.entryId;
      if (row.newEntry && !bridge.hasRepeatEntry(row.group, row.entryId)) {
        entryId = bridge.addRepeatEntry(row.group, row.entryId) ?? row.entryId;
        await nextFrame();
        await nextFrame();
      }
      entries.set(row.entryId, entryId);
    }
    return repeatFieldId(row.group, entryId, row.fieldId);
  }

  /** Types every open row of the step; returns the keys it filled. */
  private async typeStep(bridge: LiveFillBridge, step: FillStep): Promise<string[]> {
    const reduce = prefersReducedMotion();
    const entries = new Map<string, string>();
    const keys: string[] = [];
    let typed = 0;
    // What the page held before any row is typed: a typed value can cascade into a later field (an
    // approval date fills its expiry), and Stop must put back the page's own value, not the cascade.
    for (const row of step.rows) {
      if (!row.held && !row.group && !this.typedOver.has(row.fieldKey)) this.typedOver.set(row.fieldKey, { before: bridge.getValue(row.fieldKey), typed: row.value });
    }
    const tick = () => {
      typed += 1;
      patchFillState((s) => ({ typed: { ...s.typed, [step.stepId]: typed } }));
    };
    for (const row of step.rows) {
      if (this.cancelled || this.stopRequested) break;
      if (row.held) continue;
      const key = await this.keyFor(bridge, row, entries);
      keys.push(key);
      if (bridge.getValue(key) === row.value) {
        tick();
        continue;
      }
      if (!this.typedOver.has(key)) this.typedOver.set(key, { before: bridge.getValue(key), typed: row.value });
      if (bridge.switchSectionFor(key)) await nextFrame();
      const shell = await waitForField(fieldSelector(step.stepId, key), reduce ? 300 : 1500);
      if (shell) {
        shell.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
        shell.setAttribute('data-ask-fill', 'active');
        if (!reduce) {
          await sleep(280);
          const rect = fieldTarget(shell).getBoundingClientRect();
          moveFillCursor({ visible: true, x: rect.left + Math.min(24, rect.width / 2), y: rect.top + rect.height / 2 });
          await sleep(220);
        }
      }
      if (reduce || isInstantField(shell, row.value)) {
        bridge.setField(key, row.value);
        if (!reduce) {
          shell?.setAttribute('data-ask-fill', 'pop');
          moveFillCursor({ pulse: (getFillState()?.cursor.pulse ?? 0) + 1 });
          await sleep(180);
        }
      } else {
        await typeInto((v) => bridge.setField(key, v), row.value, {
          cancelled: () => this.cancelled || this.stopRequested,
        });
      }
      shell?.setAttribute('data-ask-fill', 'done');
      tick();
      if (!reduce) await sleep(120);
    }
    return keys;
  }

  /** On Accept the typed fields flash once (a static ring under reduced motion). */
  private flash(stepId: string, keys: string[]) {
    for (const el of this.flashed) el.removeAttribute('data-ask-fill');
    this.flashed = [];
    for (const key of keys) {
      const el = document.querySelector<HTMLElement>(fieldSelector(stepId, key));
      if (!el) continue;
      el.setAttribute('data-ask-fill', 'flash');
      this.flashed.push(el);
    }
    const flashed = this.flashed;
    window.setTimeout(() => {
      for (const el of flashed) if (el.getAttribute('data-ask-fill') === 'flash') el.removeAttribute('data-ask-fill');
    }, FLASH_MS);
  }
}
