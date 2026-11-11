import { describe, expect, it } from 'vitest';
import {
  availableClientEditActions,
  changedParagraphs,
  clientEditHolder,
  diffWords,
  nextClientEditStage,
  shouldNotifyEdit,
  type ClientEditAction,
  type ClientEditStage,
} from './client-edit';

function run(steps: Array<[ClientEditAction, string, string?]>): ClientEditStage | null {
  let stage: ClientEditStage | null = null;
  for (const [action, role, note] of steps) {
    const next = nextClientEditStage(stage, action, role, note);
    if ('error' in next) throw new Error(`${action} by ${role} at ${stage}: ${next.error}`);
    stage = next.stage;
  }
  return stage;
}

describe('BR-05 the seven steps, in order', () => {
  it('edit, confirm, email, receipt, manager, admin, send to client', () => {
    expect(run([
      ['save', 'client'], ['confirm', 'client'], ['send', 'client'], ['receive', 'intern'],
      ['manager-approve', 'manager'], ['admin-approve', 'admin'], ['send-final', 'intern'],
    ])).toBe('final');
  });

  it('refuses a step out of order', () => {
    expect(nextClientEditStage('editing', 'send', 'client')).toEqual({ ok: false, error: 'wrong_stage' });
    expect(nextClientEditStage('sent', 'manager-approve', 'manager')).toEqual({ ok: false, error: 'wrong_stage' });
  });

  it('the admin cannot approve before the manager', () => {
    expect(nextClientEditStage('manager', 'admin-approve', 'admin').ok).toBe(false);
    expect(nextClientEditStage('manager', 'manager-approve', 'admin').ok).toBe(false);
    expect(nextClientEditStage('manager', 'return', 'admin').ok).toBe(false);
  });

  it('a return needs a reason and goes to the lead, who sends it to the manager again', () => {
    expect(nextClientEditStage('manager', 'return', 'manager', '  ')).toEqual({ ok: false, error: 'return_needs_reason' });
    expect(nextClientEditStage('admin', 'return', 'admin', 'Fix clause 2')).toEqual({ ok: true, stage: 'returned' });
    expect(clientEditHolder('returned')).toBe('lead');
    expect(nextClientEditStage('returned', 'resubmit', 'intern')).toEqual({ ok: true, stage: 'manager' });
  });

  it('only the client edits, and only before confirming', () => {
    expect(nextClientEditStage(null, 'save', 'intern').ok).toBe(false);
    expect(nextClientEditStage('confirmed', 'save', 'client').ok).toBe(false);
    expect(availableClientEditActions('editing', 'client')).toEqual(['save', 'confirm']);
    expect(availableClientEditActions('manager', 'manager')).toEqual(['manager-approve', 'return']);
  });

  it('names the holder at every stage', () => {
    expect(clientEditHolder('editing')).toBe('client');
    expect(clientEditHolder('sent')).toBe('lead');
    expect(clientEditHolder('manager')).toBe('manager');
    expect(clientEditHolder('admin')).toBe('admin');
    expect(clientEditHolder('final')).toBe('client');
  });
});

describe('BR-04 tracked changes and the audit text', () => {
  it('lists the changed paragraphs with old and new text', () => {
    expect(changedParagraphs(['A', 'B', 'C'], ['A', 'B2', 'C'])).toEqual([{ index: 1, before: 'B', after: 'B2' }]);
  });

  it('marks added and removed words', () => {
    expect(diffWords('the board approves the name', 'the board hereby approves the new name')).toEqual([
      { kind: 'same', text: 'the board ' },
      { kind: 'added', text: 'hereby ' },
      { kind: 'same', text: 'approves the ' },
      { kind: 'added', text: 'new ' },
      { kind: 'same', text: 'name' },
    ]);
    expect(diffWords('one two', 'one')).toEqual([{ kind: 'same', text: 'one' }, { kind: 'removed', text: ' two' }]);
  });

  it('folds ten minutes of saves into one notice', () => {
    const at = new Date('2026-11-11T10:00:00Z');
    expect(shouldNotifyEdit(undefined, at)).toBe(true);
    const state = { stage: 'editing' as const, content: '', updatedAt: '', editNotifiedAt: '2026-11-11T09:55:00Z' };
    expect(shouldNotifyEdit(state, at)).toBe(false);
    expect(shouldNotifyEdit(state, new Date('2026-11-11T10:06:00Z'))).toBe(true);
  });
});
