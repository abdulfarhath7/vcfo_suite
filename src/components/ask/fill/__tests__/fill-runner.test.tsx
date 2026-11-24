import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FillRunView } from '@/lib/ask/fill/types';
import { registerLiveFillBridge, type LiveFillBridge } from '@/views/incorporation/milestone-form/live-fill-bridge';

/** The live player in Manual mode: it types the step's rows into the form, waits for Accept, then saves and submits. */

const getFill = vi.fn();
const stepFill = vi.fn();
vi.mock('@/hooks/ask/ask-api', () => ({ getFill: (...a: unknown[]) => getFill(...a), stepFill: (...a: unknown[]) => stepFill(...a) }));

const { FillRunner } = await import('../fill-runner');
const { fillActions, getFillState, clearFillState } = await import('../fill-store');
const { FillModeChip } = await import('../FillModeChip');

const view = (patch: Partial<FillRunView> = {}): FillRunView => ({
  id: 'run-1',
  status: 'waiting_user',
  mode: 'manual',
  engagementId: 'eng-1',
  companyName: 'Bonterra',
  current: 'pre-1',
  steps: [
    {
      stepId: 'pre-1',
      title: 'Client Details',
      status: 'active',
      filled: 0,
      total: 2,
      rows: [
        { rowId: 'r1', fieldKey: 'name', fieldId: 'name', label: 'Name', value: 'Bonterra' },
        { rowId: 'r2', fieldKey: 'city', fieldId: 'city', label: 'City', value: 'Pune' },
      ],
    },
  ],
  ...patch,
});

function fakeBridge(): LiveFillBridge & { values: Record<string, string>; calls: string[] } {
  const values: Record<string, string> = {};
  const calls: string[] = [];
  return {
    engagementIds: ['eng-1'],
    stepId: 'pre-1',
    values,
    calls,
    setField: vi.fn((k: string, v: string) => {
      values[k] = v;
      calls.push(`${k}=${v}`);
    }),
    addRepeatEntry: vi.fn(() => null),
    hasRepeatEntry: vi.fn(() => false),
    switchSectionFor: vi.fn(() => false),
    pauseAutosave: vi.fn(),
    save: vi.fn(async () => undefined),
    submit: vi.fn(async () => undefined),
    getValue: (k: string) => values[k] ?? '',
  };
}

let unregister: (() => void) | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  clearFillState();
  Element.prototype.scrollIntoView = vi.fn();
  document.body.innerHTML = '<div data-ask-field="pre-1:name"><input /></div><div data-ask-field="pre-1:city"><input /></div>';
  getFill.mockResolvedValue(view());
  stepFill.mockResolvedValue(view({ status: 'done', current: null, steps: [{ ...view().steps[0]!, status: 'done', filled: 2, rows: [] }] }));
});

afterEach(() => {
  unregister?.();
  unregister = null;
  document.documentElement.removeAttribute('data-reduce-motion');
});

async function runToWaiting(bridge: LiveFillBridge) {
  unregister = registerLiveFillBridge(bridge);
  const navigate = vi.fn();
  const runner = new FillRunner('run-1', 'manual', { navigate });
  const done = runner.start();
  await vi.waitFor(() => expect(getFillState()?.phase).toBe('waiting'), { timeout: 8000, interval: 20 });
  return { done, navigate };
}

describe('FillRunner, Manual', () => {
  it('types each row on the open page, then Accept saves, submits and tells the server', async () => {
    const bridge = fakeBridge();
    const { done, navigate } = await runToWaiting(bridge);
    expect(navigate).not.toHaveBeenCalled();
    expect(bridge.pauseAutosave).toHaveBeenCalledWith(true);
    expect(bridge.values).toEqual({ name: 'Bonterra', city: 'Pune' });
    // Typed as a growing prefix, so the characters arrive one by one.
    expect(bridge.calls.filter((c) => c.startsWith('name=')).length).toBeGreaterThan(1);
    expect(getFillState()?.typed['pre-1']).toBe(2);
    expect(bridge.save).not.toHaveBeenCalled();

    fillActions().accept?.();
    await done;
    expect(bridge.save).toHaveBeenCalledTimes(1);
    expect(bridge.submit).toHaveBeenCalledTimes(1);
    expect(stepFill).toHaveBeenCalledWith('run-1', { stepId: 'pre-1', action: 'accepted' });
    expect(getFillState()?.phase).toBe('done');
    expect(bridge.pauseAutosave).toHaveBeenLastCalledWith(false);
  }, 15000);

  it('with reduced motion sets each value at once', async () => {
    document.documentElement.setAttribute('data-reduce-motion', 'true');
    const bridge = fakeBridge();
    const { done } = await runToWaiting(bridge);
    expect(bridge.calls).toEqual(['name=Bonterra', 'city=Pune']);
    expect(getFillState()?.cursor.visible).toBe(false);
    stepFill.mockResolvedValue(view({ status: 'stopped', current: null, stopReason: 'Stopped by you.' }));
    fillActions().stop?.();
    await done;
    expect(stepFill).toHaveBeenCalledWith('run-1', { stepId: 'pre-1', action: 'stop' });
    expect(bridge.save).not.toHaveBeenCalled();
    expect(getFillState()?.phase).toBe('stopped');
  });
});

describe('FillRunner, Stop', () => {
  it('puts back what it typed, keeps what the person changed, then lets autosave run', async () => {
    document.documentElement.setAttribute('data-reduce-motion', 'true');
    const bridge = fakeBridge();
    bridge.values.city = 'Mumbai';
    const { done } = await runToWaiting(bridge);
    // The person retypes the name before pressing Stop.
    bridge.values.name = 'Bonterra Labs';
    stepFill.mockResolvedValue(view({ status: 'stopped', current: null, stopReason: 'Stopped by you.' }));
    fillActions().stop?.();
    await done;
    expect(bridge.values).toEqual({ name: 'Bonterra Labs', city: 'Mumbai' });
    expect(bridge.pauseAutosave).toHaveBeenLastCalledWith(false);
  });
});

describe('FillModeChip', () => {
  it('remembers the chosen mode in this browser', () => {
    window.localStorage.clear();
    const { unmount } = render(<FillModeChip />);
    expect(screen.getByRole('radio', { name: 'Manual' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: 'Auto' }));
    expect(window.localStorage.getItem('vcfo.ask.fillMode')).toBe('auto');
    unmount();
    render(<FillModeChip />);
    expect(screen.getByRole('radio', { name: 'Auto' })).toHaveAttribute('aria-checked', 'true');
  });
});
