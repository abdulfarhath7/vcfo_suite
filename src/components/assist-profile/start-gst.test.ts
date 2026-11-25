import { describe, expect, it, vi } from 'vitest';
import { assistInstalled, ASSIST_START_MESSAGE, startGstOnPortal } from './start-gst';

describe('startGstOnPortal', () => {
  it('marks the Suite tab with the form and the engagement and tells the extension, without opening a tab', () => {
    window.history.replaceState(null, '', '/app/lead/registrations/eng-1~reg-4?tab=x');
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const post = vi.spyOn(window, 'postMessage');
    delete document.documentElement.dataset.vcfoAssist;
    const out = startGstOnPortal('eng-1');
    const url = new URL(window.location.href);
    expect(url.searchParams.get('assist')).toBe('gst-reg-01');
    expect(url.searchParams.get('engagement')).toBe('eng-1');
    expect(url.searchParams.get('tab')).toBe('x');
    expect(document.documentElement.dataset.vcfoAssistForm).toBe('gst-reg-01');
    expect(document.documentElement.dataset.vcfoAssistEngagement).toBe('eng-1');
    expect(post).toHaveBeenCalledWith({ source: 'vcfo-suite', type: ASSIST_START_MESSAGE, form: 'gst-reg-01', engagementId: 'eng-1' }, window.location.origin);
    // Without the extension there is nothing to fill the portal: no live tab, the install steps show.
    expect(open).not.toHaveBeenCalled();
    expect(out).toEqual({ installed: false });
    open.mockRestore();
  });

  it('leaves the portal tab to the extension once it marks the page', () => {
    document.documentElement.dataset.vcfoAssist = '0.2.0';
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    expect(assistInstalled()).toBe(true);
    expect(startGstOnPortal('eng-1')).toEqual({ installed: true });
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
    delete document.documentElement.dataset.vcfoAssist;
  });
});
