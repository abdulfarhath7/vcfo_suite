import { describe, expect, it } from 'vitest';
import {
  getActiveCatalogItems,
  getItem,
  getPostIncPhases,
  getPhaseItems,
} from '@/data/checklist';
import {
  checklistGateViewerFrom,
  gateActiveCatalog,
  gateChecklistSteps,
  gateDisplayStatus,
  isChecklistStepSequentiallyComplete,
  sequentialLockMessage,
} from '@/lib/checklist-step-gate';
import type { ChecklistItem } from '@/data/checklist';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';

function item(id: string, title: string, role: 'client' | 'intern'): ChecklistItem {
  return {
    id,
    slug: id,
    bucket: 'pre-inc',
    order: 1,
    title,
    forms: [],
    infoRequired: [],
    deadline: { kind: 'no-statutory-limit' },
    responsibleRole: role,
  };
}

const A = item('a', 'Client details', 'client');
const B = item('b', 'Draft resolution', 'intern');
const C = item('c', 'Share with client', 'intern');
const D = item('d', 'File SPICe', 'intern');

describe('isChecklistStepSequentiallyComplete', () => {
  it('treats not-applicable as complete', () => {
    expect(isChecklistStepSequentiallyComplete('not-applicable')).toBe(true);
  });

  it('does not treat a draft in-progress as complete', () => {
    expect(
      isChecklistStepSequentiallyComplete('in-progress', {
        status: 'in-progress',
        responses: { proposedName1: 'Acme India Private Limited' },
      }),
    ).toBe(false);
  });

  it('treats client submit as terminal complete', () => {
    expect(
      isChecklistStepSequentiallyComplete('in-progress', {
        status: 'in-progress',
        clientSubmittedAt: '2026-08-01T00:00:00.000Z',
        locked: true,
        reviewStatus: 'reviewing',
      }),
    ).toBe(true);
  });

  it('re-opens a rejected submission', () => {
    expect(
      isChecklistStepSequentiallyComplete('completed', {
        status: 'completed',
        clientSubmittedAt: '2026-08-01T00:00:00.000Z',
        locked: true,
        reviewStatus: 'rejected',
        unlockedFields: ['proposedName1'],
      }),
    ).toBe(false);
  });

  it('re-opens a completed step unlocked for correction', () => {
    expect(
      isChecklistStepSequentiallyComplete('completed', {
        status: 'completed',
        reviewStatus: 'accepted',
        unlockedFields: ['proposedName1'],
      }),
    ).toBe(false);
  });
});

describe('gateChecklistSteps', () => {
  const seq = [A, B, C, D];

  it('makes the first incomplete step active for the owner and waiting for the other party', () => {
    const clientGates = gateChecklistSteps({ items: seq, viewer: 'client' });
    const staffGates = gateChecklistSteps({ items: seq, viewer: 'staff' });
    expect(clientGates.a.kind).toBe('active');
    expect(clientGates.a.canEdit).toBe(true);
    expect(staffGates.a.kind).toBe('waiting');
    expect(staffGates.a.canEdit).toBe(false);
    expect(staffGates.a.message).toBe('Waiting on the client…');
    expect(clientGates.b.kind).toBe('locked');
    expect(clientGates.b.canOpen).toBe(false);
    expect(clientGates.b.message).toBe('This opens after Client details is complete.');
  });

  it('unlocks the next step only after terminal complete, not a draft', () => {
    const draft: Record<string, ChecklistItemStateSlice> = {
      a: { status: 'in-progress', responses: { proposedName1: 'Draft' } },
    };
    const gates = gateChecklistSteps({ items: seq, state: draft, viewer: 'staff' });
    expect(gates.a.kind).toBe('waiting');
    expect(gates.b.kind).toBe('locked');
  });

  it('unlocks intern work after the client submits', () => {
    const state: Record<string, ChecklistItemStateSlice> = {
      a: {
        status: 'in-progress',
        clientSubmittedAt: '2026-08-01T00:00:00.000Z',
        locked: true,
        reviewStatus: 'reviewing',
      },
    };
    const staff = gateChecklistSteps({ items: seq, state, viewer: 'staff' });
    const client = gateChecklistSteps({ items: seq, state, viewer: 'client' });
    expect(staff.a.kind).toBe('done');
    expect(staff.b.kind).toBe('active');
    expect(staff.b.canEdit).toBe(true);
    expect(client.b.kind).toBe('waiting');
    expect(client.b.message).toBe('Waiting on your project lead…');
    expect(staff.c.kind).toBe('locked');
  });

  it('skips N/A steps in the sequence', () => {
    const state: Record<string, ChecklistItemStateSlice> = {
      a: { status: 'completed' },
      b: { status: 'not-applicable' },
    };
    const gates = gateChecklistSteps({ items: seq, state, viewer: 'staff' });
    expect(gates.b.kind).toBe('done');
    expect(gates.c.kind).toBe('active');
  });

  it('re-locks later steps when an earlier step is returned for correction', () => {
    const state: Record<string, ChecklistItemStateSlice> = {
      a: {
        status: 'completed',
        reviewStatus: 'rejected',
        unlockedFields: ['proposedName1'],
      },
      b: { status: 'completed' },
      c: { status: 'in-progress' },
    };
    const gates = gateChecklistSteps({ items: seq, state, viewer: 'client' });
    expect(gates.a.kind).toBe('active');
    expect(gates.b.kind).toBe('locked');
    expect(gates.c.kind).toBe('locked');
    expect(gates.c.message).toBe('This opens after Client details is complete.');
  });

  it('lets staff open done steps for review but not locked future steps', () => {
    const state: Record<string, ChecklistItemStateSlice> = {
      a: { status: 'completed' },
      b: { status: 'completed', deliveredToClientAt: '2026-08-02T00:00:00.000Z' },
    };
    const gates = gateChecklistSteps({ items: seq, state, viewer: 'staff' });
    expect(gates.a.canEdit).toBe(true);
    expect(gates.b.kind).toBe('done');
    expect(gates.b.canOpen).toBe(true);
    expect(gates.b.canEdit).toBe(true);
    expect(gates.c.kind).toBe('active');
    expect(gates.d.canOpen).toBe(false);
  });
});

describe('gateDisplayStatus', () => {
  it('never shows overdue on locked future steps', () => {
    const locked = gateChecklistSteps({ items: [A, B], viewer: 'staff' }).b;
    expect(gateDisplayStatus('overdue', locked)).toBe('not-started');
    const waiting = gateChecklistSteps({ items: [A, B], viewer: 'staff' }).a;
    expect(gateDisplayStatus('overdue', waiting)).toBe('overdue');
  });
});

describe('active catalog sequence', () => {
  it('uses phase item order, not the raw post-inc dump', () => {
    const catalog = getActiveCatalogItems();
    const postIds = getPhaseItems(getPostIncPhases()).map((i) => i.id);
    const catalogPost = catalog.filter((i) => i.bucket === 'post-inc').map((i) => i.id);
    expect(catalogPost).toEqual(postIds);
    expect(catalogPost.indexOf('post-9')).toBeLessThan(catalogPost.indexOf('post-3'));
    expect(catalog.some((i) => i.id === 'reg-2')).toBe(false);
  });

  it('locks post-inc until pre-inc is complete', () => {
    const gates = gateActiveCatalog({}, 'staff');
    const post1 = getItem('post-1')!;
    expect(gates[post1.id].kind).toBe('locked');
    expect(gates['pre-1'].kind).toBe('waiting');
    expect(sequentialLockMessage('post-1', {})).toMatch(/This opens after .+ is complete/);
  });
});

describe('checklistGateViewerFrom', () => {
  it('maps client variant and role to the client party', () => {
    expect(checklistGateViewerFrom('client', 'intern')).toBe('client');
    expect(checklistGateViewerFrom('admin', 'client')).toBe('client');
    expect(checklistGateViewerFrom('admin', 'manager')).toBe('staff');
    expect(checklistGateViewerFrom('admin', 'super_admin')).toBe('staff');
  });
});
