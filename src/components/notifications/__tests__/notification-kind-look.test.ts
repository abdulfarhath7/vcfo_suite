import { describe, expect, it } from 'vitest';
import type { NotificationKind } from '@/lib/checklist/checklist-notifications';
import { NOTIFICATION_KIND_LABEL } from '@/lib/notifications/notification-popup';
import { NOTIFICATION_GROUPS, NOTIFICATION_KIND_LOOK } from '@/components/notifications/notification-kind-look';

describe('NOTIFICATION_KIND_LOOK', () => {
  it('gives every notification kind an icon, a tone and a known group', () => {
    for (const kind of Object.keys(NOTIFICATION_KIND_LABEL) as NotificationKind[]) {
      const look = NOTIFICATION_KIND_LOOK[kind];
      expect(look, kind).toBeDefined();
      expect(look.Icon, kind).toBeTruthy();
      expect(NOTIFICATION_GROUPS).toContain(look.group);
    }
  });

  it('colours failed and skipped emails as bad and due', () => {
    expect(NOTIFICATION_KIND_LOOK['email.failed'].tone).toBe('bad');
    expect(NOTIFICATION_KIND_LOOK['email.skipped'].tone).toBe('warn');
    expect(NOTIFICATION_KIND_LOOK['email.sent'].tone).toBe('ok');
  });
});
