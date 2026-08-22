import { describe, expect, it } from 'vitest';
import {
  OFFICIAL_FEED_HOSTS,
  announcementAttribution,
  announcementYmdIst,
  announcementsForDailyPopup,
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

  it('attributes feed vs manager vs admin', () => {
    expect(announcementAttribution({ origin: 'feed', authorName: 'Income Tax' })).toBe('From VCFOSuite');
    expect(
      announcementAttribution({ origin: 'manual', authorName: 'Priya Shah', authorRole: 'manager' }),
    ).toBe('From Manager — Priya Shah');
    expect(announcementAttribution({ origin: 'manual', authorName: 'Ops', authorRole: 'admin' })).toBe(
      'From Admin',
    );
  });
});

describe('manual links', () => {
  it('stores https links only', () => {
    expect(assertSafeHttpsUrl('https://incometaxindia.gov.in/a', 'link').protocol).toBe('https:');
    expect(() => assertSafeHttpsUrl('javascript:alert(1)', 'link')).toThrow();
  });
});
