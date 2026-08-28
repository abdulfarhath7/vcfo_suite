import { describe, expect, it } from 'vitest';
import {
  APPROVAL_REQUIRED_ACTIONS,
  canAttemptProjectEdit,
  isManagerEditableField,
  projectEditAccess,
  projectEditActionLabel,
  requiresApproval,
  splitProjectPatch,
} from './project-edit-policy';

describe('projectEditAccess — admin', () => {
  it('acts directly on everything, owned or not', () => {
    for (const role of ['admin', 'super_admin']) {
      expect(projectEditAccess('delete_project', role, false)).toBe('direct');
      expect(projectEditAccess('change_client', role, false)).toBe('direct');
      expect(projectEditAccess('change_manager', role, false)).toBe('direct');
      expect(projectEditAccess('edit_details', role, false)).toBe('direct');
      expect(projectEditAccess('restore_project', role, false)).toBe('direct');
    }
  });
});

describe('projectEditAccess — manager', () => {
  it('edits low-risk fields on its own project directly', () => {
    expect(projectEditAccess('edit_details', 'manager', true)).toBe('direct');
    expect(projectEditAccess('change_leads', 'manager', true)).toBe('direct');
  });

  it('must ask an admin for the three high-risk actions', () => {
    expect(projectEditAccess('delete_project', 'manager', true)).toBe('request');
    expect(projectEditAccess('change_client', 'manager', true)).toBe('request');
    expect(projectEditAccess('change_manager', 'manager', true)).toBe('request');
  });

  it('cannot touch a project it does not own', () => {
    expect(projectEditAccess('edit_details', 'manager', false)).toBe('denied');
    expect(projectEditAccess('delete_project', 'manager', false)).toBe('denied');
  });

  it('never restores — the recycle bin is admin-only', () => {
    expect(projectEditAccess('restore_project', 'manager', true)).toBe('denied');
  });
});

describe('projectEditAccess — everyone else', () => {
  it('denies interns, clients, and unknown roles', () => {
    for (const role of ['intern', 'client', undefined, 'nonsense']) {
      expect(projectEditAccess('edit_details', role, true)).toBe('denied');
      expect(projectEditAccess('delete_project', role, true)).toBe('denied');
    }
  });
});

describe('helpers agree with projectEditAccess', () => {
  it('canAttemptProjectEdit is true for direct and request, false for denied', () => {
    expect(canAttemptProjectEdit('delete_project', 'manager', true)).toBe(true);
    expect(canAttemptProjectEdit('delete_project', 'admin')).toBe(true);
    expect(canAttemptProjectEdit('delete_project', 'intern', true)).toBe(false);
  });

  it('requiresApproval is true only for a manager on a high-risk action', () => {
    expect(requiresApproval('change_client', 'manager', true)).toBe(true);
    expect(requiresApproval('change_client', 'admin')).toBe(false);
    expect(requiresApproval('edit_details', 'manager', true)).toBe(false);
  });

  it('covers every approval-required action', () => {
    for (const action of APPROVAL_REQUIRED_ACTIONS) {
      expect(projectEditAccess(action, 'manager', true)).toBe('request');
      expect(projectEditAccess(action, 'admin')).toBe('direct');
    }
  });
});

describe('splitProjectPatch', () => {
  it('gives an admin every field directly', () => {
    const { direct, needsApproval } = splitProjectPatch(
      { companyName: 'Acme', managerId: 'm-1' },
      'admin',
    );
    expect(direct).toEqual({ companyName: 'Acme', managerId: 'm-1' });
    expect(needsApproval).toEqual({});
  });

  it('routes a manager’s managerId change to approval and keeps the rest', () => {
    const { direct, needsApproval } = splitProjectPatch(
      { companyName: 'Acme', stage: 'Post-Incorporation', managerId: 'm-2' },
      'manager',
    );
    expect(direct).toEqual({ companyName: 'Acme', stage: 'Post-Incorporation' });
    expect(needsApproval).toEqual({ managerId: 'm-2' });
  });

  it('leaves both sides empty for an empty patch', () => {
    expect(splitProjectPatch({}, 'manager')).toEqual({ direct: {}, needsApproval: {} });
  });
});

describe('isManagerEditableField', () => {
  it('accepts the creation fields and rejects the gated ones', () => {
    expect(isManagerEditableField('parentEntityAddress')).toBe(true);
    expect(isManagerEditableField('subsidiaryLegalName')).toBe(true);
    expect(isManagerEditableField('clientName')).toBe(true);
    expect(isManagerEditableField('managerId')).toBe(false);
    expect(isManagerEditableField('clientUserId')).toBe(false);
  });
});

describe('projectEditActionLabel', () => {
  it('prefixes a request but leaves a direct action alone', () => {
    expect(projectEditActionLabel('delete_project', 'direct')).toBe('Delete project');
    expect(projectEditActionLabel('delete_project', 'request')).toBe('Request: delete project');
  });
});
