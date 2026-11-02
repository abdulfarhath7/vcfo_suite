/* Sample data for the developer console (prototype): SBC's own VCFO Suite setup on 16 Oct 2026.
   Names, numbers and addresses are demo values; secrets are always masked. */
(function () {
  // Services behind the app: [key, name, what it is, status ok|warn|down, uptime % (30 days), p95 ms, note]
  var SERVICES = [
    ['web', 'Web app', 'AWS App Runner · ap-south-1', 'ok', 99.98, 210, 'Version 2026.10.21 · 2 instances'],
    ['db', 'Database', 'Amazon RDS Postgres 16', 'ok', 99.99, 12, '4.2 GB of 20 GB'],
    ['store', 'File storage', 'Amazon S3', 'ok', 100, 48, '38 GB · 21,406 files'],
    ['jobs', 'Background jobs', 'Inngest', 'warn', 99.7, 0, '1 job failed in 24 hours'],
    ['email', 'Email', 'Amazon SES', 'ok', 99.95, 340, '98.6% delivered this week'],
    ['wa', 'WhatsApp', 'AWS End User Messaging', 'warn', 99.4, 900, '3 templates waiting for Meta approval'],
    ['m365', 'Microsoft 365', 'Outlook and Teams', 'warn', 99.9, 420, 'Teams webhook token expires in 9 days'],
    ['ai', 'Ask VCFO', 'Claude API', 'ok', 99.9, 2100, '1,842 answers this month'],
    ['ext', 'Portal extension', 'VCFO Assist (MCA and GST)', 'ok', 99.5, 0, '6 browsers active']
  ];
  // Connections: [key, group, name, provider, status connected|attention|off, account, last check, detail lines]
  var CONN = [
    ['ses', 'Messaging', 'Email', 'Amazon SES (Resend as fallback)', 'connected', 'sbcllp.in · 4 sending addresses', 'Today 12:20', ['Region ap-south-1, production access', 'Domain sbcllp.in verified with DKIM', 'Fallback: Resend, key ending 4f2a', 'Bounce rate 0.6% · complaint rate 0.02%']],
    ['wa', 'Messaging', 'WhatsApp Business', 'AWS End User Messaging', 'attention', '+91 80 4718 2290 · SBC LLP', 'Today 12:05', ['Business account verified by Meta', 'Quality rating: High', '11 templates approved, 3 waiting for approval', 'Opt-outs this month: 4']],
    ['sms', 'Messaging', 'SMS', 'MSG91 · DLT registered', 'connected', 'Sender ID SBCLLP', 'Today 11:50', ['DLT entity ID ending 7781', '6 templates registered on the DLT portal', 'Used only for sign-in codes and overdue alerts']],
    ['outlook', 'Microsoft 365', 'Outlook mailbox and calendar', 'Microsoft Graph', 'connected', 'updates@sbcllp.in · 18 staff calendars', 'Today 12:15', ['App registration VCFO Suite (tenant sbcllp.in)', 'Mail.Send and Calendars.ReadWrite granted', 'Client secret expires 14 Feb 2027']],
    ['teams', 'Microsoft 365', 'Teams channels and bot', 'Microsoft Teams', 'attention', '3 channels · VCFO bot', 'Today 12:15', ['Channels: Compliance alerts, Incorporations, Partners', 'Incoming webhook token expires 25 Oct', 'Bot installed for 18 staff']],
    ['google', 'Workspace', 'Google Workspace', 'Gmail, Calendar, Drive', 'off', 'Not connected', '-', ['Optional: for clients and staff on Google', 'Calendar sync and Drive import of documents']],
    ['ext', 'Government portals', 'VCFO Assist extension', 'Chrome extension for MCA V3 and GST', 'connected', '6 browsers · version 1.4.2', 'Today 12:24', ['Reads MCA filing status and challans into the client page', 'Last sync 12:24 · 31 forms tracked', 'No passwords stored; staff sign in on the portal']],
    ['gsp', 'Government portals', 'GST API', 'GST Suvidha Provider (GSP)', 'off', 'Not connected', '-', ['Would file GSTR-1 and 3B and pull 2B without the portal', 'Needs a GSP contract and each client\'s consent']],
    ['eri', 'Government portals', 'Income-tax ERI API', 'e-Return Intermediary', 'off', 'Application in progress', '-', ['SBC holds the ERI documentation', 'Would prefill and file ITRs for consenting clients']],
    ['digi', 'Government portals', 'DigiLocker', 'Issued documents', 'off', 'Not connected', '-', ['Pull PAN, Aadhaar and driving licence with consent', 'Cuts KYC uploads at onboarding']],
    ['esign', 'Signing', 'e-Sign', 'Aadhaar eSign and DSC', 'connected', 'Leegality · 40 signatures left', 'Yesterday', ['Board resolutions and engagement letters', 'DSC signing through the extension for MCA forms']],
    ['pay', 'Money', 'Payments', 'Razorpay', 'connected', 'Fee links and UPI · live mode', 'Today 10:02', ['Fee links on invoices and reminders', 'Settlements to SBC LLP current account', 'Webhook last received 10:02']],
    ['acct', 'Money', 'Accounting sync', 'Tally Prime and Zoho Books', 'attention', 'Tally connector on office PC', '3 days ago', ['Pushes invoices and receipts nightly', 'Office PC was offline on 13 Oct; 6 invoices waiting']],
    ['ai', 'AI', 'Ask VCFO', 'Anthropic Claude API', 'connected', 'Model claude-sonnet-5-5 · key ending 9c1d', 'Today 12:30', ['Answers from each client\'s own data only', 'Monthly budget ₹40,000 · used ₹18,950', 'Logs keep questions for 30 days']],
    ['s3', 'Platform', 'Storage', 'Amazon S3', 'connected', 'sbc-vcfo-prod · versioning on', 'Today 12:30', ['Encrypted at rest (SSE-S3)', 'Lifecycle: old versions to Glacier after 90 days']],
    ['mon', 'Platform', 'Error tracking', 'Sentry', 'connected', 'vcfo-suite-web', 'Today 12:31', ['14 errors in 24 hours, 2 new', 'Alerts to the Teams Compliance alerts channel']],
    ['hooks', 'Platform', 'Webhooks and API keys', 'For other systems', 'connected', '2 keys · 3 webhooks', 'Today 09:00', ['Keys: Partner dashboard (read), Tally connector', 'Webhooks: filing.filed, step.completed, invoice.paid']]
  ];
  // Message routes: [type, when it goes, channel, from, template, template status, to, sent 7 days, delivered %]
  var ROUTES = [
    ['Document request', 'When a step needs a client file', 'Email', 'updates@sbcllp.in', 'doc_request_v3', 'approved', 'Client contact', 142, 99.3],
    ['Document request nudge', '2 days after the request, if still missing', 'WhatsApp', '+91 80 4718 2290', 'doc_nudge_hi_en', 'approved', 'Client contact', 61, 97.8],
    ['Step reminder', 'Day before a step is due', 'Email', 'updates@sbcllp.in', 'step_due_v2', 'approved', 'Client and project lead', 88, 99.0],
    ['Deadline reminder', '7, 3 and 1 days before a filing', 'Email', 'reminders@sbcllp.in', 'deadline_v4', 'approved', 'Client contact', 214, 98.4],
    ['Deadline reminder (WhatsApp)', '1 day before a filing', 'WhatsApp', '+91 80 4718 2290', 'deadline_1d', 'pending', 'Client contact', 0, 0],
    ['Overdue alert', 'The morning after a missed date', 'SMS', 'SBCLLP', 'overdue_alert', 'approved', 'Client and manager', 9, 100],
    ['Filing confirmation', 'When a return is filed', 'Email', 'updates@sbcllp.in', 'filed_ack_v2', 'approved', 'Client contact', 57, 99.6],
    ['Monthly client report', '1st of the month, 08:00', 'Email', 'reports@sbcllp.in', 'monthly_report', 'approved', 'Client directors', 0, 0],
    ['Sign-in code', 'When someone signs in', 'SMS', 'SBCLLP', 'otp_login', 'approved', 'The person signing in', 412, 99.8],
    ['Staff daily digest', 'Every working day, 09:00', 'Teams', '#compliance-alerts', 'digest_card', 'approved', 'Project leads and managers', 5, 100],
    ['Escalation to admin', 'A step stuck for 3 days', 'Teams', '#incorporations', 'escalation_card', 'approved', 'Admin and manager', 7, 100],
    ['Partner report', '1st of the month, 07:00', 'Email', 'reports@sbcllp.in', 'partner_report', 'approved', 'Mithilesh and partners', 0, 0],
    ['Payment link', 'With each invoice', 'WhatsApp', '+91 80 4718 2290', 'invoice_link', 'pending', 'Client accounts contact', 0, 0]
  ];
  var DOMAIN = [['SPF', 'pass', 'v=spf1 include:amazonses.com ~all'], ['DKIM', 'pass', '3 CNAME records verified'], ['DMARC', 'warn', 'p=none · move to quarantine'], ['Return path', 'pass', 'bounce.sbcllp.in']];
  // Jobs: [name, schedule, last run, duration, result ok|fail|skip, next run, failures 7 days]
  var JOBS = [
    ['Deadline reminders', 'Daily 08:00 IST', 'Today 08:00', '41 s', 'ok', 'Tomorrow 08:00', 0],
    ['Overdue sweep', 'Daily 09:30 IST', 'Today 09:30', '12 s', 'ok', 'Tomorrow 09:30', 0],
    ['WhatsApp nudges', 'Every 2 hours', 'Today 12:00', '8 s', 'fail', 'Today 14:00', 3],
    ['Outlook calendar sync', 'Every 15 minutes', 'Today 12:30', '5 s', 'ok', 'Today 12:45', 0],
    ['Portal status sync', 'Every 30 minutes', 'Today 12:24', '19 s', 'ok', 'Today 12:54', 1],
    ['Tally push', 'Nightly 23:00', 'Yesterday 23:00', '-', 'skip', 'Today 23:00', 3],
    ['Monthly client reports', '1st of the month 08:00', '1 Oct 08:00', '6 min 12 s', 'ok', '1 Nov 08:00', 0],
    ['Partner report', '1st of the month 07:00', '1 Oct 07:00', '48 s', 'ok', '1 Nov 07:00', 0],
    ['Database backup', 'Daily 02:00 IST', 'Today 02:00', '3 min 40 s', 'ok', 'Tomorrow 02:00', 0]
  ];
  // Logs: [time, level error|warn|info, source, message, detail]
  var LOGS = [
    ['12:00:08', 'error', 'WhatsApp', 'Template deadline_1d rejected: not approved yet', 'Send blocked for 14 recipients. The template is waiting for Meta approval (submitted 14 Oct).'],
    ['11:42:31', 'error', 'Web app', 'Portal credentials failed to decrypt', 'CREDENTIALS_ENCRYPTION_KEY is not set on App Runner. Every portal credential read throws in production.'],
    ['11:30:02', 'warn', 'Email', 'Soft bounce: accounts@halcyonfin.example', 'Mailbox full. SES will retry for 12 hours.'],
    ['10:02:44', 'info', 'Payments', 'Webhook invoice.paid received', 'Aurora Paints paid INV-2026-0418 (₹52,500) by UPI.'],
    ['09:30:12', 'info', 'Jobs', 'Overdue sweep finished: 4 alerts sent', 'SMS to Coral Studios, Ember Textiles, Kestrel Health and Brightwave Robotics.'],
    ['08:00:41', 'info', 'Jobs', 'Deadline reminders: 61 sent, 0 failed', '7-day: 22, 3-day: 18, 1-day: 21.'],
    ['Yesterday 23:00', 'warn', 'Accounting', 'Tally push skipped: connector offline', 'The office PC running the Tally connector did not answer. 6 invoices are waiting.'],
    ['Yesterday 18:12', 'warn', 'Microsoft 365', 'Teams webhook token expires on 25 Oct', 'Renew it in the Teams channel settings and paste the new URL here.'],
    ['Yesterday 16:40', 'info', 'Deploys', 'Version 2026.10.21 is live', 'Deployed by Farhath from main (commit 6c26d7e). No migrations.']
  ];
  var ENVS = [
    ['Production', 'app.sbctrack.in', '2026.10.21', '6c26d7e', 'Yesterday 16:40', 'Farhath', 'ok'],
    ['Local', 'localhost:3000', 'design/design-system', 'uncommitted', '-', 'Farhath', 'ok']
  ];
  var DEPLOYS = [['2026.10.21', '6c26d7e', 'Yesterday 16:40', 'Farhath', 'Large-file splits; settings account page'], ['2026.10.18', 'c0c15f0', 'Sun 18 Oct', 'Farhath', 'Client portal home split'], ['2026.10.14', '98c2004', 'Wed 14 Oct', 'Farhath', 'Firm people, admin forms'], ['2026.10.09', '7919a5b', 'Fri 9 Oct', 'Farhath', 'WhatsApp nudges (outbound only)']];
  var MIGRATIONS = [['0042_client_practice_areas', 'Pending', 'Adds registration status per client'], ['0043_message_routes', 'Pending', 'Stores message routing in the database instead of code']];
  // Feature flags: [key, name, on, who sees it]
  var FLAGS = [['ask_vcfo', 'Ask VCFO in the client portal', true, 'Everyone'], ['wa_nudges', 'WhatsApp nudges', true, 'Clients who opted in'], ['wa_deadline', 'WhatsApp deadline reminders', false, 'Waiting for template approval'],
    ['pay_links', 'Payment links on invoices', true, 'Everyone'], ['super_admin', 'Super admin portal', true, 'Mithilesh'], ['gsp_filing', 'GST filing through a GSP', false, 'Not connected yet']];
  // Secrets: [name, where, created, expires (days left, null = none), status ok|warn|missing]
  var SECRETS = [
    ['CREDENTIALS_ENCRYPTION_KEY', 'App Runner', '-', null, 'missing'], ['AUTH_SECRET', 'Secrets Manager', '2 Sep 2026', null, 'ok'],
    ['Teams webhook URL', 'Secrets Manager', '25 Jul 2026', 9, 'warn'], ['Microsoft Graph client secret', 'Secrets Manager', '14 Aug 2026', 121, 'ok'],
    ['ANTHROPIC_API_KEY', 'Secrets Manager', '1 Oct 2026', null, 'ok'], ['RESEND_API_KEY (fallback)', 'Secrets Manager', '12 Jun 2026', null, 'ok'],
    ['Razorpay key secret', 'Secrets Manager', '20 Aug 2026', null, 'ok'], ['MSG91 auth key', 'Secrets Manager', '2 Jul 2026', 260, 'ok'],
    ['RDS master password', 'Secrets Manager', '1 Sep 2026', 46, 'ok'], ['Demo user passwords', 'Database', 'Seed data', 0, 'warn']
  ];
  var SIGNIN = [['Email and password', 22, 'Clients and staff'], ['Microsoft sign-in', 14, 'Staff on sbcllp.in'], ['Two-step check (SMS code)', 31, 'Required for staff, optional for clients']];
  var SESSIONS = [['Mithilesh', 'Super admin', 'Chrome on Mac · Bengaluru', 'Now'], ['Krishna', 'Admin', 'Edge on Windows · Bengaluru', '4 min ago'], ['Pranay', 'Manager', 'Chrome on Windows · Bengaluru', '12 min ago'], ['Bharath', 'Project lead', 'Chrome on Android', '31 min ago'], ['Rohan Kumar', 'Client', 'Safari on iPhone · Pune', '1 h ago'], ['Farhath', 'Developer', 'Firefox on Linux', 'Now']];
  // Costs this month in rupees: [service, cost, budget]
  var COSTS = [['App Runner', 9800, 12000], ['RDS Postgres', 7400, 8000], ['S3 storage', 1900, 3000], ['Email (SES)', 450, 1000], ['WhatsApp messages', 3200, 4000], ['SMS', 2100, 2500], ['Claude API (Ask VCFO)', 18950, 40000], ['Error tracking', 2200, 2500]];
  var DATA = [['Database size', '4.2 GB', '20 GB allocated'], ['File storage', '38 GB', '21,406 files'], ['Last backup', 'Today 02:00', 'Kept 35 days'], ['Last restore test', '1 Oct 2026', 'Restored to a scratch database in 11 minutes'], ['Point-in-time recovery', 'On', 'Any second in the last 7 days'], ['Retention', '8 years', 'Statutory records and filings']];
  var VOLUME = [['Emails sent', 1408, 'this month'], ['WhatsApp messages', 612, 'this month'], ['SMS', 1290, 'mostly sign-in codes'], ['Ask VCFO answers', 1842, '3.1 M tokens']];
  var AUDIT0 = [
    ['Yesterday 16:40', 'Farhath', 'Deployed version 2026.10.21', '2026.10.18', '2026.10.21'],
    ['Tue 13 Oct', 'Farhath', 'Turned on the Super admin portal flag', 'Off', 'On'],
    ['Mon 12 Oct', 'Farhath', 'Changed the monthly report sender', 'updates@sbcllp.in', 'reports@sbcllp.in'],
    ['Fri 9 Oct', 'Farhath', 'Submitted WhatsApp template deadline_1d for approval', '-', 'Pending']
  ];
  function audit() { try { return JSON.parse(sessionStorage.getItem('vcfo.devaudit') || '[]').concat(AUDIT0); } catch (e) { return AUDIT0; } }
  function log(what, before, after) {
    var l = []; try { l = JSON.parse(sessionStorage.getItem('vcfo.devaudit') || '[]'); } catch (e) {}
    var d = new Date(), t = 'Today ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    l.unshift([t, 'Farhath', what, before || '-', after || '-']);
    try { sessionStorage.setItem('vcfo.devaudit', JSON.stringify(l)); } catch (e) {}
    window.dispatchEvent(new CustomEvent('vcfo:devaudit'));
  }
  function flags() { var o = {}; try { o = JSON.parse(sessionStorage.getItem('vcfo.devflags') || '{}'); } catch (e) {} return FLAGS.map(function (f) { return [f[0], f[1], f[0] in o ? o[f[0]] : f[2], f[3]]; }); }
  window.DEV = { SERVICES: SERVICES, CONN: CONN, ROUTES: ROUTES, DOMAIN: DOMAIN, JOBS: JOBS, LOGS: LOGS, ENVS: ENVS, DEPLOYS: DEPLOYS, MIGRATIONS: MIGRATIONS,
    SECRETS: SECRETS, SIGNIN: SIGNIN, SESSIONS: SESSIONS, COSTS: COSTS, DATA: DATA, VOLUME: VOLUME, audit: audit, log: log, flags: flags };
})();
