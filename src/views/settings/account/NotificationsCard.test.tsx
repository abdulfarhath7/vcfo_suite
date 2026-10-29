import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationsCard } from './NotificationsCard';
import { DEFAULT_NOTIFICATION_PREFS } from '@/lib/client-portal/notification-prefs';

function mockPrefs(extra: Record<string, unknown> = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ prefs: { ...DEFAULT_NOTIFICATION_PREFS, ...extra } }), { status: 200 })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('NotificationsCard (P-626, P-627)', () => {
  it('gives a manager the reminder days, the daily digest and "Approvals waiting"', async () => {
    mockPrefs({ remindDays: 3, digestTime: '08:30' });
    render(<NotificationsCard id="n" title="Notifications" whatsappOn={false} userRole="manager" />);
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Daily digest' })).toBeTruthy());
    expect(screen.getByRole('switch', { name: 'Approvals waiting' })).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'Escalations' })).toBeNull();
    expect((screen.getByLabelText('Daily digest time') as HTMLInputElement).value).toBe('08:30');
    expect(screen.getByText('Remind me before a due date')).toBeTruthy();
  });

  it('gives an admin "Escalations"', async () => {
    mockPrefs();
    render(<NotificationsCard id="n" title="Notifications" whatsappOn={false} userRole="admin" />);
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Escalations' })).toBeTruthy());
  });

  it('shows the developer the channels and quiet hours only', async () => {
    mockPrefs();
    render(<NotificationsCard id="n" title="Notifications" whatsappOn={false} userRole="developer" />);
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Quiet hours' })).toBeTruthy());
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Daily digest' })).toBeNull();
  });
});
