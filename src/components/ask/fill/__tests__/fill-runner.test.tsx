import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FillRunView } from '@/lib/ask/fill/types';
import { registerLiveFillBridge, type LiveFillBridge } from '@/views/incorporation/milestone-form/live-fill-bridge';

/**
 * The live player: Manual types the step's rows into the form, waits for Accept, then saves the
 * page as a draft (never submits, PLAN K); the speed ("Watch it fill" or "Fill instantly") decides how each field is set.
 */

const getFill = vi.fn();
const stepFill = vi.fn();
const submitReadyFill = vi.fn();
vi.mock('@/hooks/ask/ask-api', () => ({
  getFill: (...a: unknown[]) => getFill(...a),
  stepFill: (...a: unknown[]) => stepFill(...a),
  submitReadyFill: (...a: unknown[]) => submitReadyFill(...a),
}));

const { FillRunner } = await import('../fill-runner');
const { fillActions, getFillState, clearFillState, patchFillState, startFillState } = await import('../fill-store');
const { FillModeChip } = await import('../FillModeChip');
const { FillRail } = await import('../FillRail');
const { serverFillMode, writeFillSpeed, writeFillMode, readFillSpeed } = await import('../fill-mode');

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
  window.localStorage.clear();
  writeFillSpeed('watch');
  writeFillMode('manual');
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
  it('types each row on the open page, then Accept saves (never submits) and tells the server', async () => {
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
    expect(bridge.submit).not.toHaveBeenCalled();
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

describe('Fill speed', () => {
  it('"Fill instantly" sets every value at once with no cursor, and still waits for Accept', async () => {
    writeFillSpeed('instant');
    const bridge = fakeBridge();
    const { done } = await runToWaiting(bridge);
    expect(bridge.calls).toEqual(['name=Bonterra', 'city=Pune']);
    expect(getFillState()?.cursor.visible).toBe(false);
    expect(bridge.save).not.toHaveBeenCalled();
    fillActions().accept?.();
    await done;
    expect(bridge.save).toHaveBeenCalledTimes(1);
    expect(getFillState()?.phase).toBe('done');
  });

  it('"Watch it fill" types character by character, at most ~700 ms a field', async () => {
    const bridge = fakeBridge();
    const { done } = await runToWaiting(bridge);
    const nameCalls = bridge.calls.filter((c) => c.startsWith('name='));
    expect(nameCalls).toEqual(['B', 'Bo', 'Bon', 'Bont', 'Bonte', 'Bonter', 'Bonterr', 'Bonterra'].map((v) => `name=${v}`));
    stepFill.mockResolvedValue(view({ status: 'stopped', current: null }));
    fillActions().stop?.();
    await done;
  }, 15000);

  it('a long value is typed in chunks so no field takes longer than ~700 ms', async () => {
    const { typeInto, MAX_FIELD_MS, TYPE_DELAY_MS } = await import('../type-into');
    const seen: string[] = [];
    const value = 'x'.repeat(200);
    await typeInto((v) => seen.push(v), value, { delayMs: 0 });
    expect(seen.at(-1)).toBe(value);
    expect((seen.length - 1) * TYPE_DELAY_MS).toBeLessThanOrEqual(MAX_FIELD_MS);
  });

  it('a switch mid-run applies from the next field', async () => {
    const bridge = fakeBridge();
    unregister = registerLiveFillBridge(bridge);
    const runner = new FillRunner('run-1', 'manual', { navigate: vi.fn() });
    const done = runner.start();
    await vi.waitFor(() => expect(getFillState()?.typed['pre-1']).toBe(1), { timeout: 8000, interval: 10 });
    writeFillSpeed('instant');
    await vi.waitFor(() => expect(getFillState()?.phase).toBe('waiting'), { timeout: 8000, interval: 20 });
    expect(bridge.calls.filter((c) => c.startsWith('name=')).length).toBeGreaterThan(1);
    expect(bridge.calls.filter((c) => c.startsWith('city='))).toEqual(['city=Pune']);
    stepFill.mockResolvedValue(view({ status: 'stopped', current: null }));
    fillActions().stop?.();
    await done;
  }, 15000);

  it('reduced motion is always instant, even with "Watch it fill" chosen', async () => {
    document.documentElement.setAttribute('data-reduce-motion', 'true');
    expect(readFillSpeed()).toBe('watch');
    const bridge = fakeBridge();
    const { done } = await runToWaiting(bridge);
    expect(bridge.calls).toEqual(['name=Bonterra', 'city=Pune']);
    stepFill.mockResolvedValue(view({ status: 'stopped', current: null }));
    fillActions().stop?.();
    await done;
  });

  it('Auto with "Watch it fill" types each page, then saves it as a draft without Accept', async () => {
    const bridge = fakeBridge();
    unregister = registerLiveFillBridge(bridge);
    const runner = new FillRunner('run-1', 'manual', { navigate: vi.fn(), autoAccept: true });
    const done = runner.start();
    await vi.waitFor(() => expect(getFillState()?.mode).toBe('auto'));
    await done;
    expect(bridge.calls.filter((c) => c.startsWith('name=')).length).toBeGreaterThan(1);
    expect(bridge.save).toHaveBeenCalledTimes(1);
    expect(bridge.submit).not.toHaveBeenCalled();
    expect(stepFill).toHaveBeenCalledWith('run-1', { stepId: 'pre-1', action: 'accepted' });
    expect(getFillState()?.phase).toBe('done');
  }, 15000);

  it('only Auto with "Fill instantly" (or Auto under reduced motion) asks the server for its background job', () => {
    expect(serverFillMode('manual', 'watch')).toBe('manual');
    expect(serverFillMode('manual', 'instant')).toBe('manual');
    expect(serverFillMode('auto', 'watch')).toBe('manual');
    expect(serverFillMode('auto', 'instant')).toBe('auto');
    writeFillMode('auto');
    document.documentElement.setAttribute('data-reduce-motion', 'true');
    expect(serverFillMode()).toBe('auto');
  });
});

describe('Fill speed chip', () => {
  it('defaults to "Watch it fill" and remembers "Fill instantly"', () => {
    expect(window.localStorage.getItem('vcfo.ask.fillSpeed')).toBe('watch');
    window.localStorage.clear();
    const { unmount } = render(<FillModeChip />);
    expect(screen.getByRole('radio', { name: 'Watch it fill' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: 'Fill instantly' }));
    expect(window.localStorage.getItem('vcfo.ask.fillSpeed')).toBe('instant');
    unmount();
    render(<FillModeChip />);
    expect(screen.getByRole('radio', { name: 'Fill instantly' })).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the speed on the rail while the browser drives the run, and switching it is remembered', async () => {
    const bridge = fakeBridge();
    const { done } = await runToWaiting(bridge);
    render(<FillRail />);
    fireEvent.click(screen.getByRole('radio', { name: 'Fill instantly' }));
    expect(readFillSpeed()).toBe('instant');
    stepFill.mockResolvedValue(view({ status: 'stopped', current: null }));
    fillActions().stop?.();
    await done;
  }, 15000);
});

describe('Fill rail completeness (PLAN K)', () => {
  const settled = view({
    status: 'done',
    current: null,
    steps: [
      { stepId: 'pre-1', title: 'Client Details', status: 'done', filled: 2, total: 2, rows: [], completeness: { complete: true, missing: 0, labels: [] } },
      { stepId: 'pre-4', title: 'Name Application', status: 'done', filled: 1, total: 1, rows: [], early: true, completeness: { complete: false, missing: 2, labels: ['SRN', 'Acknowledgement'] } },
      { stepId: 'pre-5', title: 'Name Approval', status: 'done', filled: 1, total: 1, rows: [], early: true, checks: [{ label: 'Company name', message: '"Client Details" now holds a different value. Please check.' }] },
    ],
  });

  it('marks complete steps with a tick and the rest with "N to fill", notes early fills and copies to check', () => {
    startFillState('run-1', 'auto');
    patchFillState({ view: settled, phase: 'done' });
    render(<FillRail />);
    expect(screen.getByTestId('step-complete-mark')).toHaveAttribute('title', 'All required answers filled');
    expect(screen.getByTestId('step-missing-mark')).toHaveTextContent('2 to fill');
    expect(screen.getByTestId('step-missing-mark')).toHaveAttribute('title', '2 to fill: SRN, Acknowledgement');
    expect(screen.getByText(/Filled before it opened/)).toBeInTheDocument();
    expect(screen.getByText(/Check Company name/)).toBeInTheDocument();
  });

  it('Submit ready steps calls the server and shows what it did', async () => {
    startFillState('run-1', 'auto');
    patchFillState({ view: settled, phase: 'done' });
    submitReadyFill.mockResolvedValue({ submitted: ['Client Details'], stopReason: 'x', line: 'Submitted 1 step: Client Details. "Name Application" still needs SRN, so I stopped there.', view: settled });
    render(<FillRail />);
    fireEvent.click(screen.getByRole('button', { name: 'Submit ready steps' }));
    await vi.waitFor(() => expect(screen.getByText(/Submitted 1 step: Client Details/)).toBeInTheDocument());
    expect(submitReadyFill).toHaveBeenCalledWith('run-1');
  });
});
