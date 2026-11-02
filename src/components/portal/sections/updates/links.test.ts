import { describe, expect, it } from 'vitest';
import { hrefHash, hrefToIntent } from './links';

describe('hrefToIntent', () => {
  it('maps section pages to section intents', () => {
    expect(hrefToIntent('/app/client')).toEqual({ kind: 'section', key: 'home' });
    expect(hrefToIntent('/app/client/overview')).toEqual({ kind: 'section', key: 'home' });
    expect(hrefToIntent('/app/client/documents')).toEqual({ kind: 'section', key: 'documents' });
    expect(hrefToIntent('/app/client/compliances/filings')).toEqual({ kind: 'section', key: 'filings' });
    expect(hrefToIntent('/app/client/compliances')).toEqual({ kind: 'section', key: 'calendar' });
    expect(hrefToIntent('/app/client/settings#notifications')).toEqual({ kind: 'section', key: 'settings' });
    expect(hrefToIntent('/app/client/team/')).toEqual({ kind: 'section', key: 'team' });
  });

  it('opens steps, phases and the board resolution', () => {
    expect(hrefToIntent('/app/client/incorporation/step/pre-13')).toEqual({ kind: 'step', stepId: 'pre-13' });
    expect(hrefToIntent('/app/client/incorporation?step=reg-gst')).toEqual({ kind: 'step', stepId: 'reg-gst' });
    expect(hrefToIntent('/app/client/incorporation/phase/post-incorporation')).toEqual({ kind: 'phase', phaseNo: 3 });
    expect(hrefToIntent('/app/client/incorporation/phase/2')).toEqual({ kind: 'phase', phaseNo: 2 });
    expect(hrefToIntent('/app/client/incorporation/phase/9')).toEqual({ kind: 'phase', phaseNo: 1 });
    expect(hrefToIntent('/app/client/board-resolution')).toEqual({ kind: 'board' });
  });

  it('opens a filing from the old ?open= / ?filing= links', () => {
    const id = '0b4f5a3e-8d1c-4e8b-9a77-1f2c3d4e5f60';
    expect(hrefToIntent(`/app/client/compliances/filings?open=${id}`)).toEqual({ kind: 'filing', id });
    expect(hrefToIntent(`/app/client/compliances/calendar?filing=${id}`)).toEqual({ kind: 'filing', id });
    expect(hrefToIntent('/app/client/compliances/filings?open=not-a-uuid')).toEqual({ kind: 'section', key: 'filings' });
  });

  it('maps updates and the library reader', () => {
    expect(hrefToIntent('/app/client/notifications')).toEqual({ kind: 'notes' });
    expect(hrefToIntent('/app/client/announcements')).toEqual({ kind: 'anns' });
    expect(hrefToIntent('/app/client/library/abc')).toEqual({ kind: 'reader', mode: 'saved', id: 'abc' });
    expect(hrefToIntent('/app/client/learn/what-is-din')).toEqual({ kind: 'reader', mode: 'learn', id: 'what-is-din' });
  });

  it('ignores anything outside the client portal', () => {
    expect(hrefToIntent('')).toBeNull();
    expect(hrefToIntent('/app/manager/projects')).toBeNull();
    expect(hrefToIntent('https://example.com/app/client/team')).toBeNull();
    expect(hrefToIntent('/app/client/unknown-page')).toBeNull();
    expect(hrefToIntent('/app/clientele')).toBeNull();
  });
});

describe('hrefHash', () => {
  it('returns the fragment without #', () => {
    expect(hrefHash('/app/client/settings#notifications')).toBe('notifications');
    expect(hrefHash('/app/client/settings')).toBe('');
  });
});
