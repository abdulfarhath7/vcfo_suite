import { act, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { typeInto } from '@/components/ask/fill/type-into';
import { createLiveFillHandlers, getLiveFillBridge, useLiveFillBridge } from './live-fill-bridge';

/** The bridge reuses the form's own handlers, so typed values land in the form's draft. */

const fields = [
  { id: 'name', label: 'Company name', type: 'text' },
  { id: 'directors', label: 'Directors', type: 'repeat', entryFields: [{ id: 'firstName', label: 'First name', type: 'text' }] },
];
const save = vi.fn(async () => undefined);
const submit = vi.fn(async () => undefined);
const paused = vi.fn();

function Form() {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const userEditedRef = useRef(false);
  useLiveFillBridge({
    engagementIds: ['eng-1', null, 'bonterra'],
    stepId: 'pre-1',
    read: () =>
      createLiveFillHandlers({
        fields,
        draft,
        setDraft,
        userEditedRef,
        internSectionNav: false,
        internSectionGroups: [],
        setSelectedSectionIndex: () => undefined,
        isClient: false,
        setField: (key: string, value: string) => setDraft((prev) => ({ ...prev, [key]: value })),
        handleSaveNow: save,
        handleInternSubmit: submit,
        handleSubmit: vi.fn(),
        setAutoSavePaused: paused,
      } as never),
  });
  return <pre data-testid="draft">{JSON.stringify(draft)}</pre>;
}

const draft = () => JSON.parse(screen.getByTestId('draft').textContent ?? '{}') as Record<string, string>;

describe('live fill bridge', () => {
  it('registers by engagement id or slug, and typing reaches the draft', async () => {
    const { unmount } = render(<Form />);
    expect(getLiveFillBridge('bonterra', 'pre-1')).not.toBeNull();
    expect(getLiveFillBridge('eng-1', 'pre-4')).toBeNull();
    const bridge = getLiveFillBridge('eng-1', 'pre-1')!;
    const seen: string[] = [];
    await act(() => typeInto((v) => (seen.push(v), bridge.setField('name', v)), 'Bonterra', { delayMs: 0 }));
    expect(draft().name).toBe('Bonterra');
    expect(seen[0]!.length).toBeLessThan('Bonterra'.length);
    expect(bridge.getValue('name')).toBe('Bonterra');
    bridge.pauseAutosave(true);
    expect(paused).toHaveBeenCalledWith(true);
    await bridge.save();
    await bridge.submit();
    expect(save).toHaveBeenCalled();
    expect(submit).toHaveBeenCalled();
    unmount();
    expect(getLiveFillBridge('eng-1', 'pre-1')).toBeNull();
  });

  it('adds a planned repeat entry once and maps its field key', () => {
    render(<Form />);
    const bridge = getLiveFillBridge('eng-1', 'pre-1')!;
    let used: string | null = null;
    act(() => {
      used = bridge.addRepeatEntry('directors', 'e1');
    });
    expect(used).toBe('e1');
    expect(draft().directors).toBe('e1');
    expect(bridge.hasRepeatEntry('directors', 'e1')).toBe(true);
    act(() => {
      used = bridge.addRepeatEntry('directors', 'e1');
    });
    expect(draft().directors).toBe('e1');
    act(() => bridge.setField('directors.e1.firstName', 'Asha'));
    expect(draft()['directors.e1.firstName']).toBe('Asha');
    expect(bridge.addRepeatEntry('name')).toBeNull();
  });
});
