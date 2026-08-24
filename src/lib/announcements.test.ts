import { describe, expect, it } from 'vitest';
import {
  OFFICIAL_FEED_HOSTS,
  announcementAttribution,
  announcementAuthorName,
  announcementMatchesFilter,
  announcementYmdIst,
  announcementsForDailyPopup,
  announcementPopupStorageKey,
  ANNOUNCEMENT_FIRST_VISIT_POPUP_CAP,
  ANNOUNCEMENT_LIVE_POPUP_CAP,
  assertSafeFeedUrl,
  assertSafeHttpsUrl,
  canWriteAnnouncements,
  cleanOfficialUrl,
  dailyAnnouncementStorageKey,
  inferAnnouncementKind,
  isLikelyRssOrAtomUrl,
  isOfficialFeedHost,
  parseAnnouncementKind,
  parseRssOrAtom,
  requestAnnouncementPopup,
  measureGenieDock,
  ANNOUNCEMENT_SHOW_EVENT,
  selectAnnouncementPopups,
  stripHtml,
  type Announcement,
} from '@/lib/announcements';
import {
  VCFO_PORTAL_HEADS,
  VCFO_PORTAL_TASKS,
  catalogCircularFeedCandidates,
  groupedVcfoPortalTasks,
} from '@/lib/announcement-portals';

describe('announcement access', () => {
  it('lets managers, admins, and super admins post; not leads or clients', () => {
    expect(canWriteAnnouncements('super_admin')).toBe(true);
    expect(canWriteAnnouncements('admin')).toBe(true);
    expect(canWriteAnnouncements('manager')).toBe(true);
    expect(canWriteAnnouncements('intern')).toBe(false);
    expect(canWriteAnnouncements('client')).toBe(false);
  });
});

describe('official feed URLs', () => {
  it('accepts https RSS on an allowlisted host', () => {
    const url = assertSafeFeedUrl('https://incometaxindia.gov.in/rss/press.xml');
    expect(url.hostname).toBe('incometaxindia.gov.in');
  });

  it('rejects http, private hosts, and unofficial domains', () => {
    expect(() => assertSafeFeedUrl('http://incometaxindia.gov.in/rss.xml')).toThrow('feed_must_be_https');
    expect(() => assertSafeFeedUrl('https://127.0.0.1/rss.xml')).toThrow('feed_host_not_allowed');
    expect(() => assertSafeFeedUrl('https://example.com/rss.xml')).toThrow('feed_host_not_allowed');
    expect(() => assertSafeFeedUrl('https://incometaxindia.gov.in.evil.com/rss.xml')).toThrow(
      'feed_host_not_allowed',
    );
  });

  it('lists known Indian tax / MCA hosts', () => {
    expect(OFFICIAL_FEED_HOSTS).toContain('incometaxindia.gov.in');
    expect(OFFICIAL_FEED_HOSTS).toContain('cbic.gov.in');
    expect(OFFICIAL_FEED_HOSTS).toContain('mca.gov.in');
  });

  it('allowlists vCFO portal hosts and their official subdomains', () => {
    expect(OFFICIAL_FEED_HOSTS).toContain('gst.gov.in');
    expect(OFFICIAL_FEED_HOSTS).toContain('cbic-gst.gov.in');
    expect(OFFICIAL_FEED_HOSTS).toContain('incometax.gov.in');
    expect(OFFICIAL_FEED_HOSTS).toContain('rbi.org.in');
    expect(OFFICIAL_FEED_HOSTS).toContain('firms.rbi.org.in');
    expect(OFFICIAL_FEED_HOSTS).toContain('flair.rbi.org.in');
    expect(OFFICIAL_FEED_HOSTS).toContain('epfindia.gov.in');
    expect(OFFICIAL_FEED_HOSTS).toContain('esic.gov.in');
    expect(OFFICIAL_FEED_HOSTS).toContain('icegate.gov.in');
    expect(OFFICIAL_FEED_HOSTS).toContain('dgft.gov.in');
    expect(OFFICIAL_FEED_HOSTS).toContain('stpi.in');
    expect(OFFICIAL_FEED_HOSTS).toContain('labour.telangana.gov.in');
    expect(OFFICIAL_FEED_HOSTS).toContain('tgct.gov.in');
    expect(OFFICIAL_FEED_HOSTS).toContain('ipindiaonline.gov.in');
    expect(OFFICIAL_FEED_HOSTS).toContain('icdr.ceir.gov.in');
    expect(OFFICIAL_FEED_HOSTS).toContain('team.msme.gov.in');
    expect(OFFICIAL_FEED_HOSTS).toContain('cdma.cgg.gov.in');
    expect(OFFICIAL_FEED_HOSTS).toContain('ccilindia-lei.co.in');
    expect(OFFICIAL_FEED_HOSTS).not.toContain('legalentityidentifier.in');
    expect(isOfficialFeedHost('services.gst.gov.in')).toBe(true);
    expect(isOfficialFeedHost('unifiedportal-emp.epfindia.gov.in')).toBe(true);
    expect(isOfficialFeedHost('portal.esic.gov.in')).toBe(true);
    expect(isOfficialFeedHost('stpionline.stpi.in')).toBe(true);
    expect(assertSafeFeedUrl('https://firms.rbi.org.in/rss.xml').hostname).toBe('firms.rbi.org.in');
  });
});

describe('cleanOfficialUrl', () => {
  it('strips chatgpt utm and Google ads query junk', () => {
    const cleaned = cleanOfficialUrl(
      'https://www.ccilindia-lei.co.in/?utm_source=chatgpt.com&gad_source=1&gclid=abc&gbraid=xyz&opt=keep',
    );
    expect(cleaned).not.toMatch(/utm_source|gad_source|gclid|gbraid|chatgpt/);
    expect(cleaned).toContain('opt=keep');
    expect(assertSafeHttpsUrl('https://mca.gov.in/x?utm_source=chatgpt.com', 'link').searchParams.has('utm_source')).toBe(
      false,
    );
  });
});

describe('isLikelyRssOrAtomUrl', () => {
  it('accepts RSS paths and rejects HTML listings and login pages', () => {
    expect(isLikelyRssOrAtomUrl('https://incometaxindia.gov.in/rss/press.xml')).toBe(true);
    expect(isLikelyRssOrAtomUrl('https://pib.gov.in/RssMain.aspx?ModId=6')).toBe(true);
    expect(
      isLikelyRssOrAtomUrl('https://www.mca.gov.in/content/mca/global/en/acts-rules/notifications.html'),
    ).toBe(false);
    expect(isLikelyRssOrAtomUrl('https://services.gst.gov.in/services/login')).toBe(false);
    expect(isLikelyRssOrAtomUrl('https://www.mca.gov.in/content/mca/global/en/foportal/fologin.html')).toBe(false);
  });
});

function fakeAnnouncement(id: string, publishedAt: string, readExtra?: Partial<Announcement>): Announcement {
  return {
    id,
    title: id,
    body: id,
    kind: 'general',
    origin: 'manual',
    sourceId: null,
    sourceName: null,
    sourceUrl: null,
    authorId: null,
    authorName: 'Ops',
    authorRole: 'admin',
    publishedAt,
    createdAt: publishedAt,
    ...readExtra,
  };
}

describe('daily announcement popup', () => {
  it('keys localStorage by user and IST date', () => {
    expect(dailyAnnouncementStorageKey('user-1', '2026-08-22')).toBe('vcfo.announcements.daily.user-1.2026-08-22');
    expect(announcementYmdIst(new Date('2026-08-21T20:00:00Z'))).toBe('2026-08-22');
  });

  it('includes today and unread items, not old already-read ones', () => {
    const now = new Date('2026-08-22T09:00:00+05:30');
    const items = [
      fakeAnnouncement('today', '2026-08-22T01:00:00+05:30'),
      fakeAnnouncement('unread-old', '2026-08-20T10:00:00+05:30'),
      fakeAnnouncement('read-old', '2026-08-19T10:00:00+05:30'),
    ];
    const shown = announcementsForDailyPopup(items, new Set(['read-old']), now);
    expect(shown.map((row) => row.id)).toEqual(['today', 'unread-old']);
  });
});

describe('live announcement popup queue', () => {
  it('keys popup storage per user', () => {
    expect(announcementPopupStorageKey('user-1')).toBe('vcfo.announcements.popup.user-1');
  });

  it('on first visit shows today’s unseen only, and seeds the full history', () => {
    const now = new Date('2026-08-24T09:00:00+05:30');
    const items = [
      fakeAnnouncement('new-today', '2026-08-24T08:00:00+05:30'),
      fakeAnnouncement('also-today', '2026-08-24T07:00:00+05:30'),
      fakeAnnouncement('old', '2026-08-20T10:00:00+05:30'),
    ];
    const { queue, seedIds } = selectAnnouncementPopups({
      items,
      viewerId: 'intern-1',
      poppedIds: null,
      readIds: new Set(),
      dailySeenIds: new Set(),
      now,
    });
    expect(queue.map((row) => row.id)).toEqual(['new-today', 'also-today']);
    expect(seedIds).toEqual(['new-today', 'also-today', 'old']);
    expect(queue.length).toBeLessThanOrEqual(ANNOUNCEMENT_FIRST_VISIT_POPUP_CAP);
  });

  it('skips already-read, daily-seen, and the author’s own posts on first visit', () => {
    const now = new Date('2026-08-24T09:00:00+05:30');
    const items = [
      fakeAnnouncement('mine', '2026-08-24T08:00:00+05:30', { authorId: 'mgr-1' }),
      fakeAnnouncement('read', '2026-08-24T07:00:00+05:30'),
      fakeAnnouncement('daily', '2026-08-24T06:00:00+05:30'),
      fakeAnnouncement('fresh', '2026-08-24T05:00:00+05:30'),
    ];
    const { queue } = selectAnnouncementPopups({
      items,
      viewerId: 'mgr-1',
      poppedIds: null,
      readIds: new Set(['read']),
      dailySeenIds: new Set(['daily']),
      now,
    });
    expect(queue.map((row) => row.id)).toEqual(['fresh']);
  });

  it('after init, queues only ids that have not been genie-popped', () => {
    const items = [
      fakeAnnouncement('brand-new', '2026-08-24T10:00:00+05:30'),
      fakeAnnouncement('already', '2026-08-24T08:00:00+05:30'),
    ];
    const { queue, seedIds } = selectAnnouncementPopups({
      items,
      viewerId: 'intern-1',
      poppedIds: new Set(['already']),
      readIds: new Set(),
      dailySeenIds: new Set(),
    });
    expect(queue.map((row) => row.id)).toEqual(['brand-new']);
    expect(seedIds).toEqual(['brand-new']);
    expect(queue.length).toBeLessThanOrEqual(ANNOUNCEMENT_LIVE_POPUP_CAP);
  });

  it('requestAnnouncementPopup always fires a show event, even for already-popped ids', () => {
    const item = fakeAnnouncement('clicked', '2026-08-24T10:00:00+05:30');
    let seen: string | null = null;
    const onShow = (event: Event) => {
      seen = (event as CustomEvent<{ announcement: Announcement }>).detail.announcement.id;
    };
    window.addEventListener(ANNOUNCEMENT_SHOW_EVENT, onShow);
    requestAnnouncementPopup(item);
    window.removeEventListener(ANNOUNCEMENT_SHOW_EVENT, onShow);
    expect(seen).toBe('clicked');
  });
});

describe('vCFO portal catalog', () => {
  it('groups by service-line task head and keeps Quarterly spelling', () => {
    const heads = groupedVcfoPortalTasks().map((group) => group.head);
    expect(heads).toEqual([...VCFO_PORTAL_HEADS]);
    expect(heads).toContain('Quarterly Compliances');
    expect(heads.join(' ')).not.toMatch(/Quaterly/i);
  });

  it('stores real https portal/circular URLs only, with the official LEI LOU', () => {
    const lei = VCFO_PORTAL_TASKS.find((row) => row.task === 'LEI Renewal');
    expect(lei?.portalUrl).toContain('ccilindia-lei.co.in');
    expect(lei?.portalUrl).not.toMatch(/gclid|gad_|legalentityidentifier\.in/);
    const pf = VCFO_PORTAL_TASKS.find((row) => row.task === 'PF Registration');
    expect(pf?.portalUrl).toContain('epfindia.gov.in');
    expect(pf?.circularUrl).toBeNull();
    const patent = VCFO_PORTAL_TASKS.find((row) => row.task === 'Patent Registration');
    expect(patent?.portalUrl).toBeNull();
    expect(patent?.circularUrl).toBeNull();
    for (const task of VCFO_PORTAL_TASKS) {
      if (task.portalUrl) expect(task.portalUrl.startsWith('https://')).toBe(true);
      if (task.circularUrl) expect(task.circularUrl.startsWith('https://')).toBe(true);
    }
  });

  it('does not treat HTML circular pages as RSS candidates', () => {
    expect(catalogCircularFeedCandidates()).toEqual([]);
  });
});

describe('parseRssOrAtom', () => {
  it('reads RSS items and strips HTML', () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item>
          <title>Finance Act 2026 notified</title>
          <link>https://incometaxindia.gov.in/news/act-2026</link>
          <description>&lt;p&gt;Rates and TDS changes.&lt;/p&gt;</description>
          <guid>https://incometaxindia.gov.in/news/act-2026</guid>
          <pubDate>Fri, 21 Aug 2026 10:00:00 GMT</pubDate>
        </item>
        <item>
          <title>Skip me</title>
          <link>https://evil.example/phish</link>
        </item>
      </channel></rss>`;
    const items = parseRssOrAtom(xml);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('Finance Act 2026 notified');
    expect(items[0]?.body).toBe('Rates and TDS changes.');
    expect(items[0]?.link).toBe('https://incometaxindia.gov.in/news/act-2026');
  });

  it('reads Atom entries via link href', () => {
    const xml = `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>GST circular 12/2026</title>
          <link rel="alternate" href="https://cbic.gov.in/circulars/12"/>
          <id>urn:cbic:12</id>
          <updated>2026-08-21T06:00:00Z</updated>
          <summary>Input tax credit clarification.</summary>
        </entry>
      </feed>`;
    const items = parseRssOrAtom(xml);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('GST circular 12/2026');
    expect(items[0]?.externalId).toBe('urn:cbic:12');
    expect(items[0]?.link).toContain('cbic.gov.in');
  });
});

describe('stripHtml', () => {
  it('removes tags and scripts', () => {
    expect(stripHtml('<p>Hello <b>Act</b></p><script>alert(1)</script>')).toBe('Hello Act');
  });
});

describe('announcement kind and attribution', () => {
  it('infers GST, MCA, tax, and deadline from titles', () => {
    expect(inferAnnouncementKind('New GST circular 12')).toBe('gst');
    expect(inferAnnouncementKind('ROC filing reminder', 'MCA')).toBe('mca');
    expect(inferAnnouncementKind('Finance Act 2026 notified')).toBe('tax');
    expect(inferAnnouncementKind('Last date for DIR-3 KYC')).toBe('deadline');
    expect(inferAnnouncementKind('Office picnic')).toBe('general');
  });

  it('falls back unknown kinds to general', () => {
    expect(parseAnnouncementKind('not-a-kind')).toBe('general');
    expect(parseAnnouncementKind('incorp')).toBe('incorp');
  });

  it('attributes feeds as VCFOSuite and people by name, not role', () => {
    expect(announcementAttribution({ origin: 'feed', authorName: 'Income Tax' })).toBe('From VCFOSuite');
    expect(
      announcementAttribution({ origin: 'manual', authorName: 'Priya Shah', authorRole: 'manager' }),
    ).toBe('From Priya Shah');
    expect(announcementAttribution({ origin: 'manual', authorName: 'Ops', authorRole: 'admin' })).toBe(
      'From Ops',
    );
    expect(
      announcementAttribution({ origin: 'manual', authorName: 'Asha Rao', authorRole: 'super_admin' }),
    ).toBe('From Asha Rao');
    expect(announcementAttribution({ origin: 'manual', authorName: 'priya@vcfo.local' })).toBe('From priya');
    expect(announcementAttribution({ origin: 'manual', authorName: '  ' })).toBe('From Staff');
  });

  it('maps All / Important / General filters onto existing kinds', () => {
    expect(announcementMatchesFilter('general', 'all')).toBe(true);
    expect(announcementMatchesFilter('deadline', 'all')).toBe(true);
    expect(announcementMatchesFilter('gst', 'all')).toBe(true);
    expect(announcementMatchesFilter('deadline', 'important')).toBe(true);
    expect(announcementMatchesFilter('compliance', 'important')).toBe(true);
    expect(announcementMatchesFilter('general', 'important')).toBe(false);
    expect(announcementMatchesFilter('tax', 'important')).toBe(false);
    expect(announcementMatchesFilter('general', 'general')).toBe(true);
    expect(announcementMatchesFilter('deadline', 'general')).toBe(false);
  });

  it('shows author name without a From prefix in row chrome', () => {
    expect(announcementAuthorName({ origin: 'feed', authorName: 'Income Tax' })).toBe('VCFOSuite');
    expect(announcementAuthorName({ origin: 'manual', authorName: 'Krishna Tungam' })).toBe('Krishna Tungam');
    expect(announcementAuthorName({ origin: 'manual', authorName: 'priya@vcfo.local' })).toBe('priya');
  });
});

describe('genie dock', () => {
  it('lands the flight inside the megaphone, not beside it', () => {
    const dock = measureGenieDock(
      { left: 400, top: 200, width: 420, height: 280 },
      { left: 900, top: 8, width: 36, height: 36 },
    );
    expect(dock.to.width).toBeLessThan(36);
    expect(dock.to.height).toBe(dock.to.width);
    expect(dock.to.left).toBeGreaterThan(900);
    expect(dock.to.left + dock.to.width).toBeLessThan(900 + 36);
    expect(dock.to.top).toBeGreaterThan(8);
    expect(dock.to.top + dock.to.height).toBeLessThan(8 + 36);
  });
});

describe('manual links', () => {
  it('stores https links only', () => {
    expect(assertSafeHttpsUrl('https://incometaxindia.gov.in/a', 'link').protocol).toBe('https:');
    expect(() => assertSafeHttpsUrl('javascript:alert(1)', 'link')).toThrow();
  });
});
