import { describe, expect, it } from 'vitest';
import {
  buildClientTimeline,
  shiftPhases,
  timelineStepsFromState,
  timelineWorld,
} from '@/lib/client-timeline';
import type { TimelineInputStep } from '@/lib/client-timeline';

const NOW = new Date('2026-10-06T12:00:00Z');

function step(
  id: string,
  title: string,
  kind: TimelineInputStep['kind'],
  completedOn?: string,
): TimelineInputStep {
  return { id, title, kind, completedOn };
}

describe('buildClientTimeline', () => {
  it('places a completed phase on its real completion days and leaves the rest unset', () => {
    const model = buildClientTimeline({
      now: NOW,
      startDate: '2026-09-01T00:00:00.000Z',
      steps: [
        step('pre-1', 'Client Details', 'done', '2026-09-12'),
        step('pre-2', 'Draft Board Resolution', 'done', '2026-09-18'),
        step('pre-3', 'Signed Board Resolution', 'locked'),
        step('pre-4', 'Name Application', 'locked'),
        step('pre-5', 'Name Approval', 'locked'),
        step('pre-11', 'MCA Remarks', 'locked'),
        step('pre-12', 'Certificate of Incorporation', 'locked'),
      ],
    });

    const name = model.bars.find((bar) => bar.id === 'name');
    const mca = model.bars.find((bar) => bar.id === 'mca');
    expect(name?.tone).toBe('current');
    expect(name?.steps[0]?.dateLabel).toMatch(/^12 Sept?$/);
    expect(mca?.rangeLabel).toBe('Not set');
    expect(model.todayLabel).toBe('Today 6 Oct');
    expect(model.todayLeft).not.toBeNull();
  });

  it('splits one incorporation window across name and incorporation without leaving that window', () => {
    const model = buildClientTimeline({
      now: NOW,
      startDate: '2026-09-01',
      schedule: {
        incorporation: { from: '2026-09-12', to: '2026-10-24', setBy: 'mgr', setAt: '2026-09-01' },
      },
      steps: [
        step('pre-1', 'Client Details', 'done', '2026-09-14'),
        step('pre-5', 'Name Approval', 'waiting'),
        step('pre-16', 'Subscriber Details', 'locked'),
        step('pre-11', 'MCA Remarks', 'locked'),
        step('pre-12', 'Certificate of Incorporation', 'locked'),
      ],
    });

    const name = model.bars.find((bar) => bar.id === 'name')!;
    const inc = model.bars.find((bar) => bar.id === 'incorporation')!;
    expect(name.sharedWindow).toBe(true);
    expect(inc.sharedWindow).toBe(true);
    expect(name.from! >= '2026-09-12').toBe(true);
    expect(inc.to! <= '2026-10-24').toBe(true);
    expect(model.sharedNote).toMatch(/share one date window/);
  });
});

describe('shiftPhases', () => {
  it('pushes later unlocked bars and leaves a locked bar where it is', () => {
    const moved = shiftPhases(
      [
        { start: 0, end: 10, locked: true, milestone: false },
        { start: 10, end: 20, locked: false, milestone: false },
        { start: 20, end: 28, locked: false, milestone: false },
        { start: 28, end: 28, locked: false, milestone: true },
      ],
      1,
      14,
      24,
      'move',
      60,
    );

    expect(moved[0]).toMatchObject({ start: 0, end: 10 });
    expect(moved[1]).toMatchObject({ start: 14, end: 24 });
    expect(moved[2]!.start).toBeGreaterThanOrEqual(24);
    expect(moved[3]!.start).toBeGreaterThanOrEqual(moved[2]!.end);
  });
});

describe('timelineStepsFromState', () => {
  it('keeps a recorded completion day on the matching step', () => {
    const steps = timelineStepsFromState(
      { 'pre-1': { status: 'completed', completedOn: '2026-09-15' } },
      'client',
    );
    expect(steps.find((row) => row.id === 'pre-1')).toMatchObject({
      completedOn: '2026-09-15',
      kind: 'done',
    });
    expect(steps.some((row) => row.id === 'pre-12')).toBe(true);
  });
});

describe('timelineWorld', () => {
  it('pads the chart with whole months before and after so the client can scroll through time', () => {
    const model = buildClientTimeline({
      now: NOW,
      startDate: '2026-09-05',
      steps: [step('pre-1', 'Client Details', 'done', '2026-09-12'), step('pre-12', 'Certificate of Incorporation', 'locked')],
    });
    const world = timelineWorld(model);

    expect(world.start).toBe('2026-07-01');
    expect(world.months[0]).toEqual({ label: expect.stringMatching(/^Jul/), day: 0 });
    expect(world.offset).toBe(Math.round((Date.parse(`${model.axisStart}T00:00:00Z`) - Date.parse('2026-07-01T00:00:00Z')) / 86_400_000));
    expect(world.today).toBe(97);
    expect(world.offset + model.spanDays).toBeLessThan(world.days);
    expect(world.weeks.every((day) => new Date(Date.UTC(2026, 6, 1 + day)).getUTCDay() === 1)).toBe(true);
  });
});
