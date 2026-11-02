/* Developer console, connection detail (prototype): every setting of every connection, in the lcc
   Settings shape. A card holds rows of [label, hint, value, options]; options may carry a chip
   [text, tone], mono text, a list, a switch, a segmented choice, an input, a button or a link.
   Tones: ok, warn, bad, idle, info. Secrets are always masked. Demo values only. */
(function () {
  var D = window.DEV || {};
  function routes(ch) { return (D.ROUTES || []).filter(function (r) { return r[2] === ch; }).map(function (r) { return [r[0], r[1], { t: r[4], mono: 1 }, { t: r[5] === 'approved' ? 'Approved' : 'Waiting for approval', tone: r[5] === 'approved' ? 'ok' : 'warn' }, String(r[7])]; }); }
  var USED = { cols: 'minmax(0,1.3fr) minmax(0,1.6fr) minmax(0,1fr) 150px 70px', head: ['Message', 'When it goes', 'Template', 'Status', 'Sent 7 d'] };
  function used(ch) { var r = routes(ch); return r.length ? { t: 'Used by', m: r.length + ' message routes', table: { cols: USED.cols, head: USED.head, rows: r } } : null; }
  var TEST = function (to, what) { return { t: 'Send a test', rows: [['Send to', 'Only you receive it. The test is logged.', '', { inp: { k: 'test-' + what, v: to }, btn: { t: 'Send a test', w: 'Send a test through ' + what + ' to ' + to, a: 'Test sent' } }]] }; };
  var DANGER = function (what, effect) { return { t: 'Disconnect', danger: 1, rows: [['Disconnect ' + what, effect, '', { btn: { t: 'Disconnect', w: 'Disconnect ' + what + '. ' + effect, b: 'Connected', a: 'Not connected', danger: 1 } }]] }; };

  var X = {
    wa: [
      { t: 'Connection', rows: [
        ['Status', 'Checked every 5 minutes.', '3 templates are waiting for Meta approval', { chip: ['Needs attention', 'warn'] }],
        ['Provider', 'Outbound only. A WhatsApp failure never slows or blocks email.', 'AWS End User Messaging Social · ap-south-1'],
        ['Business account', 'WhatsApp Business Account (WABA) linked through Meta.', 'SBC LLP · WABA 1048 •••• 2290', { mono: 1, chip: ['Verified by Meta', 'ok'] }],
        ['Phone number', 'The number clients see. Display name approved by Meta.', '+91 80 4718 2290 · SBC LLP', { mono: 1 }],
        ['Phone number ID', 'Used by the app to send.', 'phone-number-id-6c1e •••• a91f', { mono: 1, btn: { t: 'Copy', w: 'Copy the phone number ID', a: 'Copied' } }],
        ['Quality rating', 'Meta lowers the limit if clients block or report messages.', '', { chip: ['High', 'ok'] }],
        ['Messaging limit', 'Business-started conversations in 24 hours. Tier 1.', '1,000 a day · 612 used this month'],
        ['Throughput', 'Messages a second at most.', '80 a second'] ] },
      { t: 'Credentials and events', rows: [
        ['Access', 'App Runner signs requests with its IAM role. No key is stored.', 'IAM role vcfo-apprunner-wa', { mono: 1, chip: ['Working', 'ok'] }],
        ['Event destination', 'Delivery, read and failure events come back here.', 'SNS topic vcfo-wa-events → /api/webhooks/whatsapp', { mono: 1 }],
        ['Event signature', 'Every event is checked before it is stored.', 'Checked on every event', { chip: ['On', 'ok'] }],
        ['Last event', '', 'Today 12:05 · message delivered to Northwind'] ] },
      { t: 'Templates', m: '11 approved · 3 waiting', table: { cols: 'minmax(0,1.4fr) 100px 90px 170px 110px 70px', head: ['Template', 'Category', 'Language', 'Status', 'Last sent', 'Sent 7 d'], rows: [
        [{ t: 'doc_nudge_hi_en', mono: 1 }, 'Utility', 'en, hi', { t: 'Approved', tone: 'ok' }, 'Today 12:00', '61'],
        [{ t: 'step_due_wa', mono: 1 }, 'Utility', 'en', { t: 'Approved', tone: 'ok' }, 'Today 09:00', '38'],
        [{ t: 'filed_ack_wa', mono: 1 }, 'Utility', 'en', { t: 'Approved', tone: 'ok' }, 'Yesterday', '22'],
        [{ t: 'welcome_client', mono: 1 }, 'Utility', 'en', { t: 'Approved', tone: 'ok' }, '12 Oct', '3'],
        [{ t: 'deadline_1d', mono: 1 }, 'Utility', 'en', { t: 'Waiting since 14 Oct', tone: 'warn' }, '-', '0'],
        [{ t: 'invoice_link', mono: 1 }, 'Utility', 'en', { t: 'Waiting since 14 Oct', tone: 'warn' }, '-', '0'],
        [{ t: 'registration_granted', mono: 1 }, 'Utility', 'en', { t: 'Waiting since 15 Oct', tone: 'warn' }, '-', '0'] ] } },
      { t: 'Delivery, last 7 days', rows: [
        ['Sent', '', '612'],
        ['Delivered', 'Reached the phone.', '97.8%', { chip: ['Normal', 'ok'] }],
        ['Read', 'Blue ticks, where the client allows them.', '71%'],
        ['Failed', 'Each failure falls back to SMS when the rule below is on.', '14', { list: ['131047 · the 24-hour window had closed (8)', '131026 · the number is not on WhatsApp (4)', '132001 · the template is not approved yet (2)'] }] ] },
      { t: 'Rules', rows: [
        ['Opt-in', 'Clients opt in on the portal or at onboarding.', '214 contacts opted in'],
        ['Opt-out word', 'A client who replies with it gets no more WhatsApp messages.', 'STOP · 4 opted out this month', { mono: 1 }],
        ['Quiet hours', 'Nothing is sent in this window; it waits for the morning.', '', { seg: { k: 'wa-quiet', opts: ['Off', '21:00 to 09:00', '20:00 to 10:00'], sel: 1 } }],
        ['If WhatsApp fails', 'Send the same message by SMS from SBCLLP.', '', { sw: 'wa-fallback', on: 1 }],
        ['Email first', 'Email is the record; WhatsApp is a reminder sent after it.', '', { chip: ['Always on', 'info'] }] ] },
      'used:WhatsApp', TEST('+91 98450 •••• 12', 'WhatsApp'), 'events:WhatsApp', DANGER('WhatsApp', 'Reminders on WhatsApp stop; email and SMS carry on.')
    ],
    ses: [
      { t: 'Connection', rows: [
        ['Status', 'Checked every 5 minutes.', 'Sending normally', { chip: ['Connected', 'ok'] }],
        ['Provider', 'The system of record for client mail.', 'Amazon SES · ap-south-1 · production access'],
        ['Sending quota', 'Per day and per second.', '50,000 a day · 14 a second · 1,408 used this month'],
        ['Configuration set', 'Opens, bounces and complaints go to SNS.', 'vcfo-prod', { mono: 1 }],
        ['Fallback', 'Used only when SES fails to accept a message.', 'Resend · key ending 4f2a', { mono: 1, sw: 'ses-fallback', on: 1 }] ] },
      { t: 'Domain sbcllp.in', m: 'DNS records', table: { cols: '120px 150px minmax(0,1fr)', head: ['Record', 'Status', 'Value'], rows: (D.DOMAIN || []).map(function (d) { return [d[0], { t: d[1] === 'pass' ? 'Passing' : 'Needs a change', tone: d[1] === 'pass' ? 'ok' : 'warn' }, { t: d[2], mono: 1 }]; }) } },
      { t: 'Sending addresses', table: { cols: 'minmax(0,1fr) minmax(0,1.4fr) 120px', head: ['Address', 'Used for', 'Status'], rows: [
        [{ t: 'updates@sbcllp.in', mono: 1 }, 'Document requests, step reminders, filing confirmations', { t: 'Verified', tone: 'ok' }],
        [{ t: 'reminders@sbcllp.in', mono: 1 }, 'Deadline reminders 7, 3 and 1 days before', { t: 'Verified', tone: 'ok' }],
        [{ t: 'reports@sbcllp.in', mono: 1 }, 'Monthly client report, partner report', { t: 'Verified', tone: 'ok' }],
        [{ t: 'noreply@sbcllp.in', mono: 1 }, 'Sign-in links', { t: 'Verified', tone: 'ok' }] ] } },
      { t: 'Reputation', rows: [
        ['Bounce rate', 'AWS reviews the account above 5%.', '0.6%', { chip: ['Healthy', 'ok'] }],
        ['Complaint rate', 'AWS reviews the account above 0.1%.', '0.02%', { chip: ['Healthy', 'ok'] }],
        ['Suppression list', 'Addresses SES will not send to again.', '12 addresses', { btn: { t: 'Review list', w: 'Open the SES suppression list', a: 'Opened' } }],
        ['DMARC policy', 'Move from none to quarantine once reports are clean.', 'p=none', { mono: 1, chip: ['Change suggested', 'warn'] }] ] },
      { t: 'Signatures and letterhead', rows: [
        ['Staff mail', 'Sent as the person through Outlook.', 'The server-side signature tool adds each person\'s Outlook signature', { chip: ['On', 'ok'] }],
        ['System mail', 'Reminders, confirmations and reports.', 'SBC letterhead from email-layout.ts'] ] },
      'used:Email', TEST('farhath@sbcllp.in', 'Email'), 'events:Email', DANGER('Email', 'Every client email stops. Do not do this in production.')
    ],
    sms: [
      { t: 'Connection', rows: [
        ['Status', '', 'Sending normally', { chip: ['Connected', 'ok'] }],
        ['Provider', 'DLT registered with TRAI, transactional route.', 'MSG91'],
        ['Sender ID', 'The six letters shown on the phone.', 'SBCLLP', { mono: 1 }],
        ['DLT entity ID', '', '1101 •••• 7781', { mono: 1 }],
        ['Auth key', 'Stored in Secrets Manager. Rotated every 12 months.', '•••• •••• 91ae', { mono: 1, btn: { t: 'Rotate', w: 'Rotate the MSG91 auth key', b: 'Key ending 91ae', a: 'New key' } }],
        ['Balance', 'A warning goes to Teams below 2,000.', '18,400 messages'] ] },
      { t: 'DLT templates', m: '6 registered', table: { cols: 'minmax(0,1fr) minmax(0,1.6fr) 120px 80px', head: ['Template', 'Used for', 'Status', 'Sent 7 d'], rows: [
        [{ t: 'otp_login', mono: 1 }, 'Sign-in codes', { t: 'Registered', tone: 'ok' }, '412'],
        [{ t: 'overdue_alert', mono: 1 }, 'The morning after a missed date', { t: 'Registered', tone: 'ok' }, '9'],
        [{ t: 'wa_fallback_doc', mono: 1 }, 'WhatsApp document reminder, when WhatsApp fails', { t: 'Registered', tone: 'ok' }, '8'],
        [{ t: 'wa_fallback_due', mono: 1 }, 'WhatsApp step reminder, when WhatsApp fails', { t: 'Registered', tone: 'ok' }, '6'],
        [{ t: 'filed_sms', mono: 1 }, 'Filing confirmation', { t: 'Registered', tone: 'ok' }, '0'],
        [{ t: 'payment_sms', mono: 1 }, 'Payment received', { t: 'Registered', tone: 'ok' }, '0'] ] } },
      'used:SMS', TEST('+91 98450 •••• 12', 'SMS'), DANGER('SMS', 'Sign-in codes stop, so two-step sign-in fails for everyone.')
    ],
    outlook: [
      { t: 'Connection', rows: [
        ['Status', '', 'Mail and calendars syncing', { chip: ['Connected', 'ok'] }],
        ['Tenant', 'SBC\'s Microsoft 365.', 'sbcllp.in · tenant 7c2e •••• 41b0', { mono: 1 }],
        ['App registration', 'Registered in Entra ID by Farhath.', 'VCFO Suite · client ID 3f2a •••• c81d', { mono: 1 }],
        ['Permissions', 'Admin consent granted 14 Aug 2026.', '', { list: ['Mail.Send', 'Mail.ReadWrite (shared mailbox only)', 'Calendars.ReadWrite', 'User.Read.All', 'offline_access'], mono: 1 }],
        ['Client secret', 'Expires 14 Feb 2027, in 121 days.', '•••• •••• •••• 8Q~d', { mono: 1, chip: ['121 days left', 'ok'], btn: { t: 'Rotate', w: 'Rotate the Microsoft Graph client secret', b: 'Expires 14 Feb 2027', a: 'New secret, 24 months' } }] ] },
      { t: 'Mailboxes and calendars', rows: [
        ['Shared mailbox', 'Client replies land here and on the client page.', 'updates@sbcllp.in', { mono: 1 }],
        ['Staff calendars', 'Filing dates and meetings sync both ways.', '18 calendars'],
        ['Calendar sync', 'Every 15 minutes.', 'Last sync today 12:30', { sw: 'm365-cal', on: 1 }],
        ['Signatures', 'Microsoft Graph has no signature API; the server-side tool adds them.', 'Server-side signature tool', { chip: ['On', 'ok'] }] ] },
      'events:Microsoft 365', DANGER('Outlook', 'Mail sent as staff and calendar sync stop.')
    ],
    teams: [
      { t: 'Connection', rows: [
        ['Status', '', 'The webhook token expires on 25 Oct', { chip: ['Needs attention', 'warn'] }],
        ['Bot', 'Sends digests and escalation cards.', 'VCFO bot · installed for 18 staff'] ] },
      { t: 'Channels', table: { cols: 'minmax(0,1fr) minmax(0,1.4fr) 170px 110px', head: ['Channel', 'What goes there', 'Token', ''], rows: [
        ['Compliance alerts', 'Staff daily digest at 09:00, errors from Sentry', { t: 'Expires 25 Oct', tone: 'warn' }, { btn: { t: 'Renew', w: 'Paste a new incoming webhook URL for Compliance alerts', b: 'Expires 25 Oct', a: 'New URL' } }],
        ['Incorporations', 'Steps stuck for 3 days, escalations', { t: 'Bot', tone: 'ok' }, ''],
        ['Partners', 'Monthly partner report', { t: 'Bot', tone: 'ok' }, ''] ] } },
      'used:Teams', 'events:Microsoft 365', DANGER('Teams', 'Digests and escalations stop; email still goes.')
    ],
    ext: [
      { t: 'Connection', rows: [
        ['Status', '', '6 browsers active', { chip: ['Connected', 'ok'] }],
        ['Version', 'Published to the Chrome Web Store, unlisted.', '1.4.2 · auto-update on', { mono: 1, sw: 'ext-auto', on: 1 }],
        ['Portals', 'Read only. Staff sign in on the portal themselves.', '', { list: ['MCA V3 · filing status, SRNs, challans', 'GST portal · return status, ARNs'] }],
        ['Passwords', '', 'None stored', { chip: ['None stored', 'ok'] }],
        ['Forms tracked', '', '31 forms · last sync 12:24'] ] },
      { t: 'Browsers', table: { cols: 'minmax(0,1fr) minmax(0,1fr) 90px 130px', head: ['Person', 'Browser', 'Version', 'Last seen'], rows: [
        ['Bharath', 'Chrome on Windows', { t: '1.4.2', mono: 1 }, 'Today 12:24'], ['Sneha Kulkarni', 'Chrome on Windows', { t: '1.4.2', mono: 1 }, 'Today 11:58'],
        ['Meera Nair', 'Edge on Windows', { t: '1.4.2', mono: 1 }, 'Today 11:10'], ['Pranay', 'Chrome on Mac', { t: '1.4.1', mono: 1 }, { t: 'Update due', tone: 'warn' }],
        ['Priya Raman', 'Chrome on Windows', { t: '1.4.2', mono: 1 }, 'Yesterday'], ['Farhath', 'Chrome on Linux', { t: '1.4.2', mono: 1 }, 'Today 12:30'] ] } },
      'events:Portal extension'
    ],
    pay: [
      { t: 'Connection', rows: [
        ['Status', '', 'Live mode', { chip: ['Connected', 'ok'] }],
        ['Provider', 'Fee links and UPI on invoices.', 'Razorpay'],
        ['Key ID', '', 'rzp_live_•••• 3KfQ', { mono: 1 }],
        ['Key secret', 'Stored in Secrets Manager.', '•••• •••• •••• x9Lp', { mono: 1, btn: { t: 'Rotate', w: 'Rotate the Razorpay key secret', a: 'New secret' } }],
        ['Webhook', 'Events: payment.captured, invoice.paid, refund.processed.', '/api/webhooks/razorpay · last received 10:02', { mono: 1 }],
        ['Settlements', '', 'SBC LLP current account •••• 4410', { mono: 1 }] ] },
      'events:Payments', DANGER('Payments', 'Payment links on invoices stop working.')
    ],
    ai: [
      { t: 'Connection', rows: [
        ['Status', '', 'Answering normally', { chip: ['Connected', 'ok'] }],
        ['Model', 'Used by Ask VCFO in every portal.', 'claude-sonnet-5-5', { mono: 1, seg: { k: 'ai-model', opts: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'], sel: 1 } }],
        ['API key', 'Stored in Secrets Manager.', 'sk-ant-•••• 9c1d', { mono: 1, btn: { t: 'Rotate', w: 'Rotate the Anthropic API key', a: 'New key' } }],
        ['Data rule', 'Each answer uses only the asking client\'s own data.', 'Per-client scope', { chip: ['Enforced', 'ok'] }],
        ['Question log', 'Kept for review, then deleted.', '30 days', { seg: { k: 'ai-keep', opts: ['7 days', '30 days', '90 days'], sel: 1 } }],
        ['Usage this month', '', '1,842 answers · 3.1 M tokens'] ] },
      'events:Ask VCFO', DANGER('Ask VCFO', 'The Ask VCFO panel shows "not available" in every portal.')
    ],
    s3: [
      { t: 'Connection', rows: [
        ['Status', '', 'Working', { chip: ['Connected', 'ok'] }],
        ['Bucket', '', 'sbc-vcfo-prod · ap-south-1', { mono: 1 }],
        ['Encryption', '', 'SSE-S3 at rest · TLS in transit', { chip: ['On', 'ok'] }],
        ['Versioning', 'A replaced file keeps its old version.', 'On', { sw: 's3-ver', on: 1 }],
        ['Lifecycle', '', 'Old versions move to Glacier after 90 days'],
        ['Size', '', '38 GB · 21,406 files'] ] }
    ],
    mon: [
      { t: 'Connection', rows: [
        ['Status', '', '14 errors in 24 hours, 2 new', { chip: ['Connected', 'ok'] }],
        ['Project', '', 'vcfo-suite-web', { mono: 1 }],
        ['Alerts', 'New errors post to Teams.', 'Compliance alerts channel', { sw: 'mon-alert', on: 1 }],
        ['Sample rate', 'Share of page loads traced.', '', { seg: { k: 'mon-rate', opts: ['5%', '10%', '25%'], sel: 1 } }] ] },
      'events:Web app'
    ],
    hooks: [
      { t: 'API keys', table: { cols: 'minmax(0,1fr) 110px 150px 130px 100px', head: ['Key', 'Access', 'Created', 'Last used', ''], rows: [
        ['Partner dashboard', 'Read', '2 Sep 2026', 'Today 09:00', { btn: { t: 'Revoke', w: 'Revoke the Partner dashboard key', a: 'Revoked', danger: 1 } }],
        ['Tally connector', 'Write invoices', '20 Aug 2026', '3 days ago', { btn: { t: 'Revoke', w: 'Revoke the Tally connector key', a: 'Revoked', danger: 1 } }] ] } },
      { t: 'Webhooks', table: { cols: 'minmax(0,1fr) minmax(0,1.4fr) 120px', head: ['Event', 'Sent to', 'Last delivery'], rows: [
        [{ t: 'filing.filed', mono: 1 }, { t: 'https://partners.sbcllp.in/hooks', mono: 1 }, { t: 'Delivered', tone: 'ok' }],
        [{ t: 'step.completed', mono: 1 }, { t: 'https://partners.sbcllp.in/hooks', mono: 1 }, { t: 'Delivered', tone: 'ok' }],
        [{ t: 'invoice.paid', mono: 1 }, { t: 'http://tally-pc.local:9000', mono: 1 }, { t: 'Failed 3 times', tone: 'bad' }] ] } }
    ]
  };
  window.DEVX = { X: X, used: used };
})();
