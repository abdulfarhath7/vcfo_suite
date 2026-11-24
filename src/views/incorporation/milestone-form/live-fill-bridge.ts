import { useEffect, useRef } from 'react';
import { addRepeatEntry, isRepeatField } from '@/lib/checklist/checklist-repeat';
import { errorKeyInFields } from './helpers';
import type { FieldEditActions } from './field-edits';
import type { MilestoneFormCtx } from './types';

/**
 * The live-fill bridge (Ask VCFO "Fill into app", Manual mode). The mounted step form registers
 * itself here, and the Ask player (`src/components/ask/fill/LiveFillPlayer.tsx`), which lives in
 * the shell above the routed page, finds it by engagement and step. Every method reuses the
 * form's own handlers, so a value typed by the player goes through the same draft, cascade,
 * validation, save and submit paths as a value typed by the person. The form stays the source of
 * truth: edits the person makes before Accept are what is saved.
 */
export type LiveFillHandlers = {
  /** The same per-field edit the inputs call. */
  setField: (fieldKey: string, value: string) => void;
  /** Adds an entry to a repeat group (with the planned id when given) and returns the entry id used. */
  addRepeatEntry: (group: string, entryId?: string) => string | null;
  hasRepeatEntry: (group: string, entryId: string) => boolean;
  /** Opens the section tab that holds the field. False when the form has no tabs or no match. */
  switchSectionFor: (fieldKey: string) => boolean;
  /** While paused, typing schedules no autosave and leaving the page flushes nothing. */
  pauseAutosave: (paused: boolean) => void;
  /** The form's Save now. */
  save: () => Promise<void>;
  /** The form's own submit for this viewer (direct-flow, approval or client review). */
  submit: () => Promise<void>;
  /** The value the form holds now (draft), empty when unanswered. */
  getValue: (fieldKey: string) => string;
};

export type LiveFillBridge = LiveFillHandlers & {
  /** Every id this form answers to: engagement id, the id prop and the slug. */
  engagementIds: string[];
  stepId: string;
};

const bridges = new Set<LiveFillBridge>();

export function registerLiveFillBridge(bridge: LiveFillBridge): () => void {
  bridges.add(bridge);
  return () => {
    bridges.delete(bridge);
  };
}

/** The mounted form for this engagement and step, or null. */
export function getLiveFillBridge(engagementId: string, stepId: string): LiveFillBridge | null {
  for (const bridge of bridges) {
    if (bridge.stepId === stepId && bridge.engagementIds.includes(engagementId)) return bridge;
  }
  return null;
}

/** Looks for the form every `intervalMs` until it mounts, the time runs out or `cancelled()` says stop. */
export function waitForLiveFillBridge(
  engagementId: string,
  stepId: string,
  opts: { timeoutMs?: number; intervalMs?: number; cancelled?: () => boolean } = {},
): Promise<LiveFillBridge | null> {
  const { timeoutMs = 20_000, intervalMs = 150, cancelled } = opts;
  const started = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const found = getLiveFillBridge(engagementId, stepId);
      if (found) return resolve(found);
      if (cancelled?.() || Date.now() - started >= timeoutMs) return resolve(null);
      window.setTimeout(tick, intervalMs);
    };
    tick();
  });
}

type HandlerCtx = MilestoneFormCtx &
  Pick<FieldEditActions, 'setField'> & {
    handleSaveNow: () => Promise<void>;
    handleInternSubmit: () => Promise<void>;
    handleSubmit: () => Promise<void>;
    setAutoSavePaused: (paused: boolean) => void;
  };

/** Builds the bridge methods from one render of the form; the registration always calls the latest. */
export function createLiveFillHandlers(ctx: HandlerCtx): LiveFillHandlers {
  const { fields, draft, setDraft, userEditedRef, internSectionNav, internSectionGroups, setSelectedSectionIndex } = ctx;
  const repeatEntries = (group: string) =>
    (draft[group] ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  return {
    setField: ctx.setField,
    addRepeatEntry: (group, entryId) => {
      const field = fields.find((f) => f.id === group);
      if (!field || !isRepeatField(field)) return null;
      if (entryId && repeatEntries(group).includes(entryId)) return entryId;
      userEditedRef.current = true;
      // The id is chosen here, outside the updater, so the caller learns it at once.
      const { entryId: used } = addRepeatEntry(draft, field, entryId);
      setDraft((prev) => ({ ...prev, ...addRepeatEntry(prev, field, used).patch }));
      return used;
    },
    hasRepeatEntry: (group, entryId) => repeatEntries(group).includes(entryId),
    switchSectionFor: (fieldKey) => {
      if (!internSectionNav) return false;
      const index = internSectionGroups.findIndex((group) => errorKeyInFields(fieldKey, group.fields));
      if (index < 0) return false;
      setSelectedSectionIndex(index);
      return true;
    },
    pauseAutosave: ctx.setAutoSavePaused,
    save: ctx.handleSaveNow,
    submit: ctx.isClient ? ctx.handleSubmit : ctx.handleInternSubmit,
    getValue: (fieldKey) => draft[fieldKey] ?? '',
  };
}

/**
 * Registers the form while it can be filled. `read` returns this render's handlers (null when
 * the form renders nothing); it is called at use time, so the player always reaches the latest
 * draft and handlers without the form writing a ref during render.
 */
export function useLiveFillBridge({
  engagementIds,
  stepId,
  read,
}: {
  engagementIds: Array<string | null | undefined>;
  stepId: string;
  read: () => LiveFillHandlers | null;
}): void {
  const readRef = useRef(read);
  const unregisterRef = useRef<(() => void) | null>(null);
  const ids = engagementIds.filter((id): id is string => Boolean(id));
  const idsKey = ids.join('|');

  useEffect(() => {
    readRef.current = read;
    const ready = read() !== null;
    if (ready && !unregisterRef.current) {
      const call = <K extends keyof LiveFillHandlers>(key: K) => readRef.current()?.[key];
      unregisterRef.current = registerLiveFillBridge({
        engagementIds: idsKey.split('|').filter(Boolean),
        stepId,
        setField: (k, v) => call('setField')?.(k, v),
        addRepeatEntry: (g, e) => call('addRepeatEntry')?.(g, e) ?? null,
        hasRepeatEntry: (g, e) => call('hasRepeatEntry')?.(g, e) ?? false,
        switchSectionFor: (k) => call('switchSectionFor')?.(k) ?? false,
        pauseAutosave: (p) => call('pauseAutosave')?.(p),
        save: async () => {
          await call('save')?.();
        },
        submit: async () => {
          await call('submit')?.();
        },
        getValue: (k) => call('getValue')?.(k) ?? '',
      });
    } else if (!ready && unregisterRef.current) {
      unregisterRef.current();
      unregisterRef.current = null;
    }
  });

  // A different engagement or step is a different registration.
  useEffect(
    () => () => {
      unregisterRef.current?.();
      unregisterRef.current = null;
    },
    [idsKey, stepId],
  );
}
