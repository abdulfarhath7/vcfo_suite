import {
  assertSafeFeedUrl,
  cleanOfficialUrl,
  isLikelyRssOrAtomUrl,
} from '@/lib/announcements';

export const VCFO_PORTAL_HEADS = [
  'Incorporation',
  'Registrations',
  'FEMA',
  'Customs',
  'Foreign Trade',
  'Labour',
  'Local Compliance',
  'IP/Brand',
  'Monthly Compliances',
  'Quarterly Compliances',
  'Half-yearly Compliances',
  'Yearly Compliances',
] as const;

export type VcfoPortalHead = (typeof VCFO_PORTAL_HEADS)[number];

export type VcfoPortalTask = {
  head: VcfoPortalHead;
  task: string;
  portalUrl: string | null;
  circularUrl: string | null;
};

export type VcfoPortalGroup = {
  head: VcfoPortalHead;
  tasks: VcfoPortalTask[];
};

export type CatalogCircularLink = {
  label: string;
  url: string;
};

export type CatalogFeedCandidate = {
  name: string;
  feedUrl: string;
};

const MCA_FO = 'https://www.mca.gov.in/content/mca/global/en/foportal/fologin.html';
const MCA_NOTIF = 'https://www.mca.gov.in/content/mca/global/en/acts-rules/notifications.html';
const GST_LOGIN = 'https://services.gst.gov.in/services/login';
const CBIC_GST = 'https://cbic-gst.gov.in/hindi/central-tax-notifications.html';
const EPFO = 'https://unifiedportal-emp.epfindia.gov.in/epfo/';
const ESIC = 'https://portal.esic.gov.in/EmployerPortal/ESICInsurancePortal/Portal_Loginnew.aspx';
const TGCT = 'https://www.tgct.gov.in/tgportal/';
const TGCT_NOTIF = 'https://www.tgct.gov.in/tgportal/AllActs/APPT/Gos_Notifications.aspx';
const FIRMS = 'https://firms.rbi.org.in/firms/faces/pages/login.xhtml';
const FLAIR = 'https://flair.rbi.org.in/fla/faces/pages/login.xhtml';
const RBI_FEMA = 'https://www.rbi.org.in/scripts/NotificationUser.aspx?Id=11253';
const RBI_FDI = 'https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=11200';
const RBI_ODI = 'https://www.rbi.org.in/scripts/NotificationUser.aspx?Id=8305';
const ICEGATE = 'https://www.icegate.gov.in/';
const DGFT_IEC = 'https://www.dgft.gov.in/CP/?opt=iec-profile-management';
const DGFT_NOTIF = 'https://www.dgft.gov.in/CP/?opt=notification';
const STPI = 'https://stpionline.stpi.in/unit/jindex.php';
const LABOUR_TS = 'https://labour.telangana.gov.in/home.do';
const CDMA_TRADE = 'https://cdma.cgg.gov.in/cdma_trade/NewTrade/SaveNewTrade';
const TRADEMARK = 'https://ipindiaonline.gov.in/trademarkefiling/user/frmLoginNew.aspx';
const ICDR = 'https://icdr.ceir.gov.in/ivs/home_manufacturer.jsp';
const IT_FO = 'https://www.incometax.gov.in/iec/foportal/';
const IT_NOTIF = 'https://www.incometaxindia.gov.in/communications/notification';
const MSME = 'https://team.msme.gov.in/app/login';
/** Official LEI India LOU (CCIL). legalentityidentifier.in is a commercial agent, not the issuer. */
const LEI = 'https://www.ccilindia-lei.co.in/';

function link(raw: string): string {
  return cleanOfficialUrl(raw);
}

function row(
  head: VcfoPortalHead,
  task: string,
  portal: string | null,
  circular: string | null,
): VcfoPortalTask {
  return {
    head,
    task,
    portalUrl: portal ? link(portal) : null,
    circularUrl: circular ? link(circular) : null,
  };
}

export const VCFO_PORTAL_TASKS: VcfoPortalTask[] = [
  row('Incorporation', 'Pre-Incorporation', MCA_FO, MCA_NOTIF),
  row('Incorporation', 'Post-Incorporation', MCA_FO, MCA_NOTIF),
  row('Registrations', 'GST Registration', GST_LOGIN, CBIC_GST),
  row('Registrations', 'PF Registration', EPFO, null),
  row('Registrations', 'ESI Registration', ESIC, null),
  row('Registrations', 'PT Registration', TGCT, TGCT_NOTIF),
  row('FEMA', 'FCGPR Filing', FIRMS, RBI_FEMA),
  row('FEMA', 'FDI Reporting', null, RBI_FDI),
  row('FEMA', 'ODI Reporting', null, RBI_ODI),
  row('FEMA', 'FLA Return', FLAIR, RBI_FEMA),
  row('FEMA', 'FCTRS Filing', FIRMS, RBI_FEMA),
  row('Customs', 'ICEGATE Registrations', ICEGATE, null),
  row('Customs', 'IEC Registration', DGFT_IEC, DGFT_NOTIF),
  row('Customs', 'LUT Filing', GST_LOGIN, CBIC_GST),
  row('Foreign Trade', 'Non-STPI Compliance', STPI, null),
  row('Labour', 'Shops & Establishments Registration', LABOUR_TS, null),
  row('Local Compliance', 'Trade Licence', CDMA_TRADE, null),
  row('IP/Brand', 'Trademark registration', TRADEMARK, null),
  row('IP/Brand', 'Trademark renewal', TRADEMARK, null),
  row('IP/Brand', 'Patent Registration', null, null),
  row('IP/Brand', 'ICDR registration', ICDR, null),
  row('Monthly Compliances', 'Payroll Processing', null, null),
  row('Monthly Compliances', 'Salary Disbursement', null, null),
  row('Monthly Compliances', 'TDS Payment', IT_FO, IT_NOTIF),
  row('Monthly Compliances', 'TCS Payment', IT_FO, IT_NOTIF),
  row('Monthly Compliances', 'GSTR-1', GST_LOGIN, CBIC_GST),
  row('Monthly Compliances', 'GSTR-3B', GST_LOGIN, CBIC_GST),
  row('Monthly Compliances', 'PF Compliance', EPFO, null),
  row('Monthly Compliances', 'ESI Compliance', ESIC, null),
  row('Monthly Compliances', 'Professional Tax Compliance', TGCT, TGCT_NOTIF),
  row('Monthly Compliances', 'Books of Accounts Closure', null, null),
  row('Monthly Compliances', 'Monthly MIS Reporting', null, null),
  row('Quarterly Compliances', 'TDS Quarterly Return', IT_FO, null),
  row('Quarterly Compliances', 'Advance Tax Payment', IT_FO, IT_NOTIF),
  row('Quarterly Compliances', 'Quarterly Finance Review', null, null),
  row('Quarterly Compliances', 'GST Compliance under QRMP Scheme', GST_LOGIN, CBIC_GST),
  row('Half-yearly Compliances', 'MSME Form 1', MSME, MCA_NOTIF),
  row('Yearly Compliances', 'Annual Financial Review', null, null),
  row('Yearly Compliances', 'Financial Preparation', null, null),
  row('Yearly Compliances', 'Stat Audit', null, MCA_NOTIF),
  row('Yearly Compliances', 'Income Tax Return', IT_FO, IT_NOTIF),
  row('Yearly Compliances', 'Tax Audit', IT_FO, IT_NOTIF),
  row('Yearly Compliances', 'Form 3CEB', IT_FO, IT_NOTIF),
  row('Yearly Compliances', 'Form 3CEAA', IT_FO, IT_NOTIF),
  row('Yearly Compliances', 'GSTR-9', GST_LOGIN, CBIC_GST),
  row('Yearly Compliances', 'GSTR-9C', GST_LOGIN, CBIC_GST),
  row('Yearly Compliances', 'AOC-4', MCA_FO, MCA_NOTIF),
  row('Yearly Compliances', 'MGT-7 / MGT-7A', MCA_FO, MCA_NOTIF),
  row('Yearly Compliances', 'Annual General Meeting', MCA_FO, MCA_NOTIF),
  row('Yearly Compliances', 'DIR-3 KYC', MCA_FO, MCA_NOTIF),
  row('Yearly Compliances', 'DPT-3', MCA_FO, MCA_NOTIF),
  row('Yearly Compliances', 'FLA Return', FLAIR, null),
  row('Yearly Compliances', 'IEC Annual Update', DGFT_IEC, null),
  row('Yearly Compliances', 'LEI Renewal', LEI, null),
  row('Yearly Compliances', 'Shops & Establishments Renewal', LABOUR_TS, null),
  row('Yearly Compliances', 'Trade Licence Renewal', CDMA_TRADE, null),
  row('Yearly Compliances', 'Professional Tax Annual Return', TGCT, null),
];

export function groupedVcfoPortalTasks(): VcfoPortalGroup[] {
  return VCFO_PORTAL_HEADS.map((head) => ({
    head,
    tasks: VCFO_PORTAL_TASKS.filter((task) => task.head === head),
  })).filter((group) => group.tasks.length > 0);
}

function circularLabel(task: VcfoPortalTask, url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  if (host.endsWith('mca.gov.in')) return 'MCA notifications';
  if (host.endsWith('cbic-gst.gov.in')) return 'CBIC GST notifications';
  if (host.endsWith('tgct.gov.in')) return 'Professional Tax notifications';
  if (host.endsWith('dgft.gov.in')) return 'DGFT notifications';
  if (host.endsWith('incometaxindia.gov.in') || host.endsWith('incometax.gov.in')) {
    return 'Income Tax notifications';
  }
  if (host.endsWith('rbi.org.in')) {
    const id = new URL(url).searchParams.get('Id');
    if (id === '11200') return 'RBI FDI reporting';
    if (id === '8305') return 'RBI ODI reporting';
    return 'RBI FEMA notification';
  }
  return `${task.head} — ${task.task}`;
}

export function uniqueCatalogCirculars(): CatalogCircularLink[] {
  const seen = new Set<string>();
  const out: CatalogCircularLink[] = [];
  for (const task of VCFO_PORTAL_TASKS) {
    if (!task.circularUrl || seen.has(task.circularUrl)) continue;
    seen.add(task.circularUrl);
    out.push({ label: circularLabel(task, task.circularUrl), url: task.circularUrl });
  }
  return out;
}

/**
 * Circular URLs that look like real RSS/Atom feeds on allowlisted hosts.
 * HTML listing pages and login portals are excluded — do not scrape them.
 */
export function catalogCircularFeedCandidates(): CatalogFeedCandidate[] {
  const seen = new Set<string>();
  const out: CatalogFeedCandidate[] = [];
  for (const task of VCFO_PORTAL_TASKS) {
    if (!task.circularUrl || !isLikelyRssOrAtomUrl(task.circularUrl)) continue;
    try {
      const feedUrl = assertSafeFeedUrl(task.circularUrl).href;
      if (seen.has(feedUrl)) continue;
      seen.add(feedUrl);
      out.push({ name: circularLabel(task, feedUrl), feedUrl });
    } catch {
      /* not an allowlisted feed */
    }
  }
  return out;
}
