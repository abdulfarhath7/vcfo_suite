import { describe, expect, it } from 'vitest';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import {
  internPatchAsksManagerEmail,
  leadManagerRequestNotifyPlan,
} from './lead-manager-request-notify';

const reviewing: ChecklistItemStateSlice = {
  status: 'in-progress',
  reviewStatus: 'reviewing',
  reviewSource: 'lead_manager_request',
  responses: { proposedName1: 'pexpo' },
};

const idle: ChecklistItemStateSlice = {
  status: 'in-progress',
  responses: { proposedName1: 'pexpo' },
};

describe('internPatchAsksManagerEmail', () => {
  it('is false for response-only autosave patches', () => {
    expect(internPatchAsksManagerEmail({})).toBe(false);
    expect(internPatchAsksManagerEmail({ reviewStatus: 'reviewing' })).toBe(false);
  });

  it('is true for Request / Submit / Email-again patches', () => {
    expect(internPatchAsksManagerEmail({ reviewSource: 'lead_manager_request' })).toBe(true);
    expect(internPatchAsksManagerEmail({ resendManagerEmail: true })).toBe(true);
  });
});

describe('leadManagerRequestNotifyPlan', () => {
  it('does not email on intern autosave while already awaiting review', () => {
    const next: ChecklistItemStateSlice = {
      ...reviewing,
      responses: { proposedName1: 'pexpo Inc' },
    };
    expect(
      leadManagerRequestNotifyPlan({
        role: 'intern',
        prevSlice: reviewing,
        nextSlice: next,
        patch: {},
      }),
    ).toEqual({ notify: false, skipInAppNotifications: false });
  });

  it('does not email when autosave current is already reviewing but DB was not', () => {
    const next: ChecklistItemStateSlice = {
      ...reviewing,
      responses: { proposedName1: 'pexpo Inc' },
    };
    expect(
      leadManagerRequestNotifyPlan({
        role: 'intern',
        prevSlice: idle,
        nextSlice: next,
        patch: {},
      }).notify,
    ).toBe(false);
  });

  it('emails once when intern requests manager approval', () => {
    expect(
      leadManagerRequestNotifyPlan({
        role: 'intern',
        prevSlice: idle,
        nextSlice: reviewing,
        patch: { reviewSource: 'lead_manager_request', reviewStatus: 'reviewing' },
      }),
    ).toEqual({ notify: true, skipInAppNotifications: false });
  });

  it('emails on intern Submit while already awaiting (explicit review patch)', () => {
    const next: ChecklistItemStateSlice = {
      ...reviewing,
      responses: { proposedName1: 'pexpo Inc' },
    };
    expect(
      leadManagerRequestNotifyPlan({
        role: 'intern',
        prevSlice: reviewing,
        nextSlice: next,
        patch: {
          reviewSource: 'lead_manager_request',
          reviewStatus: 'reviewing',
        },
      }).notify,
    ).toBe(true);
  });

  it('emails on Email manager again and skips extra in-app rows when answers are unchanged', () => {
    expect(
      leadManagerRequestNotifyPlan({
        role: 'intern',
        prevSlice: reviewing,
        nextSlice: reviewing,
        patch: {
          reviewSource: 'lead_manager_request',
          resendManagerEmail: true,
        },
      }),
    ).toEqual({ notify: true, skipInAppNotifications: true });
  });

  it('still inserts in-app rows when Email manager again includes new answers', () => {
    expect(
      leadManagerRequestNotifyPlan({
        role: 'intern',
        prevSlice: reviewing,
        nextSlice: { ...reviewing, responses: { proposedName1: 'pexpo Inc' } },
        patch: {
          reviewSource: 'lead_manager_request',
          resendManagerEmail: true,
        },
      }),
    ).toEqual({ notify: true, skipInAppNotifications: false });
  });

  it('does not email when the actor is not intern', () => {
    const next: ChecklistItemStateSlice = {
      ...reviewing,
      responses: { proposedName1: 'pexpo Inc' },
    };
    expect(
      leadManagerRequestNotifyPlan({
        role: 'manager',
        prevSlice: reviewing,
        nextSlice: next,
        patch: { reviewSource: 'lead_manager_request' },
      }).notify,
    ).toBe(false);
    expect(
      leadManagerRequestNotifyPlan({
        role: 'client',
        prevSlice: idle,
        nextSlice: reviewing,
        patch: { reviewSource: 'lead_manager_request' },
      }).notify,
    ).toBe(false);
  });
});
