import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { AgentSettingsResponse } from '@/lib/card-agents/settings-page';
import { AGENT_SETTINGS_DEFAULTS } from '@/lib/card-agents/settings';

/** Settings > Agents: every change asks first, then saves one key; read-only for a non-editor. */

const mutate = vi.fn();
vi.mock('@/hooks/use-agent-runs', () => ({
  useSaveAgentSetting: () => ({ mutate, isPending: false }),
  useAgentSettingsPage: () => ({ isPending: true }),
}));
let role = 'admin';
vi.mock('@/context/AppContext', () => ({ useApp: () => ({ user: { id: 'u1', role } }) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

const { AgentSettingsBody } = await import('./AgentSettingsPage');

function data(over: Partial<AgentSettingsResponse> = {}): AgentSettingsResponse {
  return {
    ok: true,
    settings: AGENT_SETTINGS_DEFAULTS,
    deployment: { gstzen: true, browser: false },
    packs: [{ id: 'mca-v3', title: 'MCA V3', hosts: ['www.mca.gov.in'], legalStatus: 'mock-only', needsCsOpinionFirst: true, live: false }],
    canEdit: true,
    admin: {
      staff: [{ id: 's1', name: 'Divya', role: 'intern' }],
      month: '2026-11',
      browserHoursUsed: 38,
      browserSessions: 12,
      recipes: { recipes: 5, beta: 5, ready: 0, live: 0 },
      patchesWaiting: 2,
    },
    ...over,
  };
}

beforeEach(() => {
  mutate.mockReset();
  role = 'admin';
});

describe('AgentSettingsBody', () => {
  it('asks before turning the kill switch on and saves only after Save', () => {
    render(<AgentSettingsBody data={data()} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Kill switch' }));
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Change the kill switch?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(mutate).toHaveBeenCalledWith({ key: 'killSwitch', value: true }, expect.anything());
  });

  it('Cancel drops the change', () => {
    render(<AgentSettingsBody data={data()} />);
    fireEvent.click(screen.getByRole('switch', { name: 'One run per portal login' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('shows a route this deployment cannot serve and will not switch it on', () => {
    render(<AgentSettingsBody data={data()} />);
    expect(screen.getByText('Not configured on this deployment')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Live browser live' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'GSTZen API live' })).not.toBeDisabled();
  });

  it('shows the month’s browser hours, the recipes and the review link', () => {
    render(<AgentSettingsBody data={data()} />);
    expect(screen.getByText(/38 \/ 100 h/)).toBeInTheDocument();
    expect(screen.getByText(/5 recipes · 5 beta · 0 live · 2 patch proposals waiting/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review patches' })).toHaveAttribute('href', '/app/admin/assist-runs#recipe-fixes');
  });

  it('is read only when the viewer cannot edit', () => {
    render(<AgentSettingsBody data={data({ canEdit: false })} />);
    expect(screen.getByRole('switch', { name: 'Kill switch' })).toBeDisabled();
    expect(screen.getByText('Demo logins cannot change agent settings.')).toBeInTheDocument();
  });
});
