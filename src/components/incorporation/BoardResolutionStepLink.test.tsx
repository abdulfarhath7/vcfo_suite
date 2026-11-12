import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Engagement } from '@/data/engagements';

/**
 * The Pre-2 step row links to the board resolution page of the viewer's own area. The row is
 * shared by the lead's client page and the admin and manager project pages; it used to link to
 * the lead's page for everyone, which the shell guard refuses for a manager and an admin.
 */

let role = 'manager';
let pathname: string | null = '/app/manager/projects/acme';
vi.mock('@/context/AppContext', () => ({ useApp: () => ({ user: { id: 'u-1', role } }) }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('@/lib/projects/engagements-db', () => ({ fetchBoardResolutionInDb: async () => null }));

const { BoardResolutionStepLink } = await import('./BoardResolutionStepLink');

const engagement = { id: 'eng-1', slug: 'acme', companyName: 'Acme Pvt Ltd' } as Engagement;

async function hrefFor(asRole: string, onPath: string | null, variant?: 'card' | 'button'): Promise<string | null> {
  role = asRole;
  pathname = onPath;
  const { unmount } = render(<BoardResolutionStepLink engagement={engagement} variant={variant} />);
  const href = (await screen.findByRole('link')).getAttribute('href');
  unmount();
  return href;
}

beforeEach(() => {
  role = 'manager';
  pathname = '/app/manager/projects/acme';
});

describe('BoardResolutionStepLink', () => {
  it('keeps a manager in the manager area', async () => {
    expect(await hrefFor('manager', '/app/manager/projects/acme')).toBe('/app/manager/projects/acme/board-resolution');
    expect(await hrefFor('manager', '/app/manager/projects/acme', 'button')).toBe('/app/manager/projects/acme/board-resolution');
  });

  it('keeps an admin in the admin area', async () => {
    expect(await hrefFor('admin', '/app/admin/projects/acme')).toBe('/app/admin/projects/acme/board-resolution');
  });

  it('keeps the super admin in the shell the project is open in', async () => {
    expect(await hrefFor('super_admin', '/app/admin/projects/acme')).toBe('/app/admin/projects/acme/board-resolution');
    expect(await hrefFor('super_admin', '/app/manager/projects/acme')).toBe('/app/manager/projects/acme/board-resolution');
    expect(await hrefFor('super_admin', '/app/lead/engagements/acme')).toBe('/app/lead/engagements/acme/board-resolution');
  });

  it('sends the lead to the lead page', async () => {
    expect(await hrefFor('intern', '/app/lead/engagements/acme')).toBe('/app/lead/engagements/acme/board-resolution');
  });
});
