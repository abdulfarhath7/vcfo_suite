/* Sample data for the admin portal (prototype). One firm: three managers, their project leads and 14 clients.
   Pranay's eight clients are the ones the lead and manager portals show; Priya Raman and Arjun Mehta each run
   three more. Client colours come from the design system's eight-hue client set. Today is Fri 16 Oct 2026. */
(function () {
  var C = {
    NT: ['Northwind Technologies', '#7c3aed', '#ebe5ff', '#5b21b6'],
    OL: ['Orchid Lane Foods', '#4f46e5', '#e3e9ff', '#3730a3'],
    LA: ['Larkspur Analytics', '#16a34a', '#daf5e3', '#166534'],
    JB: ['Juniper Bio', '#64748b', '#eef1f5', '#334155'],
    BR: ['Brightwave Robotics', '#db2777', '#fde2ec', '#9d174d'],
    TL: ['Tidewater Logistics', '#0d9488', '#ccf3ec', '#0f5f55'],
    KH: ['Kestrel Health', '#0284c7', '#dbeefe', '#0b5c8f'],
    HF: ['Halcyon Fintech', '#a16207', '#fdf0d2', '#8a5a06'],
    SR: ['Saffron Retail', '#0d9488', '#ccf3ec', '#0f5f55'],
    ML: ['Monsoon Labs', '#4f46e5', '#e3e9ff', '#3730a3'],
    IF: ['Indigo Freight', '#0284c7', '#dbeefe', '#0b5c8f'],
    BW: ['Banyan Wellness', '#16a34a', '#daf5e3', '#166534'],
    CS: ['Coral Studios', '#db2777', '#fde2ec', '#9d174d'],
    QM: ['Quartz Mobility', '#a16207', '#fdf0d2', '#8a5a06'],
    PH: ['Pinecrest Hotels', '#7c3aed', '#ebe5ff', '#5b21b6'],
    SV: ['Saltmarsh Ventures', '#64748b', '#eef1f5', '#334155'],
    ET: ['Ember Textiles', '#db2777', '#fde2ec', '#9d174d']
  };
  var MGR = {
    pranay: { name: 'Pranay', ini: 'PN', leads: ['Bharath', 'Sneha Kulkarni', 'Meera Nair'], onTime: 91 },
    priya: { name: 'Priya Raman', ini: 'PR', leads: ['Aditi Rao', 'Kabir Sethi'], onTime: 86 },
    arjun: { name: 'Arjun Mehta', ini: 'AM', leads: ['Nikhil Jain', 'Tara Menon'], onTime: 79 }
  };
  // The whole firm (super admin): a second admin, Ritu Agarwal, oversees a fourth manager, Vikram Shah.
  var ALLMGR = {}; Object.keys(MGR).forEach(function (k) { ALLMGR[k] = MGR[k]; });
  ALLMGR.vikram = { name: 'Vikram Shah', ini: 'VS', leads: ['Rahul Menon', 'Isha Kapoor'], onTime: 88 };
  var ADMINS = {
    krishna: { name: 'Krishna', ini: 'KR', mgrs: ['pranay', 'priya', 'arjun'], assigned: 3, reassigned: 1, approvals: 12, resolved: 4, open: 2, response: '3.2 h' },
    ritu: { name: 'Ritu Agarwal', ini: 'RA', mgrs: ['vikram'], assigned: 1, reassigned: 0, approvals: 5, resolved: 2, open: 1, response: '5.5 h' }
  };
  // [key, manager, project lead, stage, step code, step now, [done per phase of 5/9/11/23], pending with (client, SBC or MCA), days with them, next date, health, pipeline stage]
  var CLIENTS = [
    ['NT', 'pranay', 'Bharath', 'inc', 'Pre-7', 'Registered office address', [5, 1, 0, 0], 'Client', 5, '20 Oct', 'wait', 'spice'],
    ['OL', 'pranay', 'Sneha Kulkarni', 'inc', 'Pre-10', 'KYC review and DSC', [5, 4, 0, 0], 'SBC', 2, '19 Oct', 'run', 'spice'],
    ['LA', 'pranay', 'Meera Nair', 'inc', 'Pre-2', 'Draft board resolution', [2, 0, 0, 0], 'SBC', 1, '21 Oct', 'run', 'name'],
    ['JB', 'pranay', 'Bharath', 'inc', 'Pre-1', 'Client details', [0, 0, 0, 0], 'Client', 2, '22 Oct', 'none', 'name'],
    ['BR', 'pranay', 'Sneha Kulkarni', 'cmp', 'Post-3', 'Bank account opening', [5, 9, 2, 0], 'SBC', 4, '15 Oct', 'over', 'post'],
    ['TL', 'pranay', 'Meera Nair', 'cmp', 'Post-8', 'FC-GPR filing', [5, 9, 7, 0], 'SBC', 3, '16 Oct', 'due', 'post'],
    ['KH', 'pranay', 'Bharath', 'cmp', 'Reg-1', 'GST registration', [5, 9, 11, 3], 'MCA', 2, '20 Oct', 'run', 'reg'],
    ['HF', 'pranay', 'Sneha Kulkarni', 'cmp', 'Reg-15', 'Trademark registration', [5, 9, 11, 19], 'Client', 3, '25 Oct', 'wait', 'reg'],
    ['SR', 'priya', 'Aditi Rao', 'cmp', 'Post-5', 'Share certificates', [5, 9, 5, 0], 'SBC', 2, '18 Oct', 'run', 'post'],
    ['ML', 'priya', 'Kabir Sethi', 'inc', 'Pre-13', 'MCA remarks on SPICe+', [5, 8, 0, 0], 'MCA', 6, '19 Oct', 'stuck', 'mca'],
    ['IF', 'priya', 'Aditi Rao', 'cmp', 'Reg-6', 'PF registration', [5, 9, 11, 6], 'SBC', 1, '17 Oct', 'due', 'reg'],
    ['BW', 'arjun', 'Nikhil Jain', 'inc', 'Pre-4', 'Name resubmission after RUN rejection', [3, 0, 0, 0], 'MCA', 8, '21 Oct', 'stuck', 'name'],
    ['CS', 'arjun', 'Tara Menon', 'cmp', 'Post-9', 'Auditor appointment (ADT-1)', [5, 9, 8, 0], 'Client', 4, '23 Oct', 'wait', 'post'],
    ['QM', 'arjun', 'Nikhil Jain', 'inc', 'Pre-9', 'Subscriber details', [5, 3, 0, 0], 'Client', 1, '22 Oct', 'run', 'spice'],
    ['PH', 'vikram', 'Rahul Menon', 'cmp', 'Reg-4', 'ESI registration', [5, 9, 11, 4], 'SBC', 2, '21 Oct', 'run', 'reg'],
    ['SV', 'vikram', 'Isha Kapoor', 'inc', 'Pre-11', 'SPICe+ confirmation', [5, 6, 0, 0], 'Client', 3, '20 Oct', 'wait', 'spice'],
    ['ET', 'vikram', 'Rahul Menon', 'cmp', 'Post-6', 'Commencement of business (INC-20A)', [5, 9, 6, 0], 'SBC', 1, '18 Oct', 'due', 'post']
  ];
  // Project leads' tasks: [task, client, project lead, status, due (Oct day; 32+ is November), area]
  var TASKS = [
    ['Registered office NOC and utility bill', 'NT', 'Bharath', 'wait', 20, 'MCA'], ['INC-20A commencement prep', 'NT', 'Bharath', 'none', 30, 'MCA'],
    ['Client details form', 'JB', 'Bharath', 'wait', 22, 'MCA'], ['GST registration (Reg-1)', 'KH', 'Bharath', 'run', 20, 'GST'],
    ['TDS challan · October', 'KH', 'Bharath', 'due', 17, 'Income tax'], ['AOC-4 financial statements', 'KH', 'Bharath', 'run', 29, 'MCA'],
    ['Professional tax · October', 'KH', 'Bharath', 'done', 10, 'Payroll'],
    ['KYC review and DSC', 'OL', 'Sneha Kulkarni', 'run', 19, 'MCA'], ['Bank account opening', 'BR', 'Sneha Kulkarni', 'bad', 15, 'MCA'],
    ['PF and ESI · September', 'BR', 'Sneha Kulkarni', 'bad', 15, 'Payroll'], ['GSTR-3B · September', 'BR', 'Sneha Kulkarni', 'due', 20, 'GST'],
    ['Trademark registration', 'HF', 'Sneha Kulkarni', 'wait', 25, 'MCA'], ['ADT-1 auditor appointment', 'HF', 'Sneha Kulkarni', 'done', 12, 'MCA'],
    ['Draft board resolution', 'LA', 'Meera Nair', 'run', 21, 'MCA'], ['MOA and AOA drafting', 'LA', 'Meera Nair', 'none', 24, 'MCA'],
    ['FC-GPR filing', 'TL', 'Meera Nair', 'due', 16, 'FEMA'], ['TDS 24Q · Q2 return', 'TL', 'Meera Nair', 'run', 31, 'Income tax'],
    ['GSTR-1 · September', 'TL', 'Meera Nair', 'done', 11, 'GST'],
    ['Share certificates (SH-1)', 'SR', 'Aditi Rao', 'run', 18, 'MCA'], ['GSTR-1 · September', 'SR', 'Aditi Rao', 'done', 11, 'GST'],
    ['PF registration', 'IF', 'Aditi Rao', 'due', 17, 'Payroll'], ['ESI registration', 'IF', 'Aditi Rao', 'none', 28, 'Payroll'],
    ['Reply to MCA remarks on SPICe+', 'ML', 'Kabir Sethi', 'bad', 13, 'MCA'], ['DSC for two directors', 'ML', 'Kabir Sethi', 'done', 9, 'MCA'],
    ['Name resubmission after RUN rejection', 'BW', 'Nikhil Jain', 'bad', 14, 'MCA'], ['Subscriber details', 'QM', 'Nikhil Jain', 'wait', 22, 'MCA'],
    ['ADT-1 auditor appointment', 'CS', 'Tara Menon', 'wait', 23, 'MCA'], ['TDS challan · October', 'CS', 'Tara Menon', 'due', 17, 'Income tax'],
    ['GSTR-3B · September', 'CS', 'Tara Menon', 'done', 14, 'GST'],
    ['ESI registration', 'PH', 'Rahul Menon', 'run', 21, 'Payroll'], ['GSTR-1 · September', 'PH', 'Rahul Menon', 'done', 11, 'GST'],
    ['SPICe+ confirmation', 'SV', 'Isha Kapoor', 'wait', 20, 'MCA'], ['INC-20A commencement filing', 'ET', 'Rahul Menon', 'due', 18, 'MCA'],
    ['TDS challan · October', 'ET', 'Rahul Menon', 'bad', 7, 'Income tax']
  ];
  // Manager-level items: [item, client, manager, status, due, kind]
  var MTASKS = [
    ['Approve board resolution', 'LA', 'pranay', 'due', 19, 'Approval'], ['Review FC-GPR before filing', 'TL', 'pranay', 'due', 16, 'Review'],
    ['Escalate bank account delay', 'BR', 'pranay', 'bad', 15, 'Escalation'], ['Client call on office NOC', 'NT', 'pranay', 'wait', 20, 'Client'],
    ['Assign a project lead to Juniper Bio', 'JB', 'pranay', 'done', 9, 'Assignment'], ['Approve GST registration', 'KH', 'pranay', 'run', 20, 'Approval'],
    ['Answer MCA remarks with Kabir', 'ML', 'priya', 'bad', 13, 'Escalation'], ['Approve share certificates', 'SR', 'priya', 'run', 18, 'Approval'],
    ['Review PF registration', 'IF', 'priya', 'due', 17, 'Review'],
    ['New name options after RUN rejection', 'BW', 'arjun', 'bad', 14, 'Escalation'], ['Client call on auditor', 'CS', 'arjun', 'wait', 23, 'Client'],
    ['Approve subscriber sheet', 'QM', 'arjun', 'run', 22, 'Approval'], ['Assign a project lead to Quartz Mobility', 'QM', 'arjun', 'done', 8, 'Assignment']
  ];
  var ST = {
    bad: ['Overdue', '#b5302a'], due: ['Due this week', '#be4400'], run: ['In progress', '#1b4f94'],
    wait: ['Waiting on client', '#4b5b70'], none: ['Not started', '#656f7e'], done: ['Done', '#0f6e51']
  };
  var HEALTH = { run: ['In progress', '#1b4f94'], wait: ['Waiting on client', '#be4400'], due: ['Due this week', '#be4400'], over: ['Overdue', '#b5302a'], stuck: ['Stuck', '#b5302a'], none: ['Not started', '#656f7e'] };
  var PIPE = [['name', 'Name approval'], ['spice', 'SPICe+ forms'], ['mca', 'MCA review'], ['coi', 'Certificate (COI)'], ['post', 'Post-incorporation'], ['reg', 'Registrations']];
  var TOT = [5, 9, 11, 23];

  function overrides() { try { return JSON.parse(sessionStorage.getItem('vcfo.assign') || '{}'); } catch (e) { return {}; } }
  function mgrOf(k) { var o = overrides(); if (o[k]) return o[k]; for (var i = 0; i < CLIENTS.length; i++) if (CLIENTS[i][0] === k) return CLIENTS[i][1]; return ''; }
  function due(d) { return d > 31 ? (d - 31) + ' Nov' : d + ' Oct'; }
  function ini(n) { var p = n.split(' '); return (p.length > 1 ? p[0][0] + p[1][0] : n.slice(0, 2)).toUpperCase(); }
  function allClients() {
    return CLIENTS.map(function (r) {
      var done = r[6].reduce(function (a, b) { return a + b; }, 0);
      return { k: r[0], name: C[r[0]][0], dot: C[r[0]][1], soft: C[r[0]][2], ink: C[r[0]][3], mgr: mgrOf(r[0]), lead: r[2], stage: r[3], code: r[4], step: r[5],
        phases: r[6], done: done, pct: Math.round(done / 48 * 100), ball: r[7], days: r[8], next: r[9], health: r[10], pipe: r[11], admin: adminOf(mgrOf(r[0])) };
    });
  }
  function adminOf(m) { for (var a in ADMINS) if (ADMINS[a].mgrs.indexOf(m) > -1) return a; return ''; }
  // Krishna's portal sees his managers' clients only; the super admin sees allClients().
  function clients() { return allClients().filter(function (c) { return !!MGR[c.mgr]; }); }
  function mgrStats(id) {
    var cl = allClients().filter(function (c) { return c.mgr === id; });
    var ks = cl.map(function (c) { return c.k; });
    var t = ALLTASKS.filter(function (x) { return ks.indexOf(x[1]) > -1; });
    return { clients: cl, open: t.filter(function (x) { return x[3] !== 'done'; }).length, overdue: t.filter(function (x) { return x[3] === 'bad'; }).length,
      stuck: cl.filter(function (c) { return c.health === 'stuck' || c.health === 'over'; }).length, tasks: t };
  }
  // A compact filter dropdown's values (markup comes from <!--dd:prefix:Name--> in the screens, expanded by patch.mjs).
  // opts: [[value, label, dot colour?]]; the empty value is the default ("All ...").
  function dd(p, open, key, field, cur, opts, def, set) {
    var o = {}, isOpen = open === key, hit = opts.filter(function (x) { return x[0] === cur; })[0];
    o[p + 'Label'] = cur && hit ? hit[1] : def; o[p + 'On'] = cur ? 'true' : 'false'; o[p + 'Open'] = isOpen; o[p + 'X'] = isOpen ? 'true' : 'false';
    o[p + 'Tog'] = function () { set({ dd: isOpen ? '' : key }); };
    o[p + 'Opts'] = [['', def]].concat(opts).map(function (x) {
      return { label: x[1], dot: x[2] ? 'background:' + x[2] : 'display:none', on: x[0] === cur ? 'true' : 'false',
        pick: function () { var s = { dd: '' }; s[field] = x[0]; set(s); } };
    });
    return o;
  }
  // A donut background from [[count, colour], ...].
  function donut(parts, size) {
    var tot = parts.reduce(function (a, p) { return a + p[0]; }, 0), acc = 0;
    var stops = parts.map(function (p) { var a = acc; acc += tot ? p[0] / tot * 100 : 0; return p[1] + ' ' + a + '% ' + acc + '%'; });
    return 'width:' + (size || 112) + 'px;height:' + (size || 112) + 'px;border-radius:50%;display:grid;place-items:center;flex:none;background:' + (tot ? 'conic-gradient(' + stops.join(',') + ')' : '#eef2f7');
  }
  // The phase bar: four segments sized by step count, filled by steps done.
  function phaseBar(done) {
    return TOT.map(function (t, i) { var p = Math.round(done[i] / t * 100);
      return { st: 'flex:' + t + ';background:linear-gradient(90deg,#0f6e51 0 ' + p + '%,#e1e7ef ' + p + '% 100%)', tip: ['Name', 'Incorporation', 'Post-incorporation', 'Registrations'][i] + ' · ' + done[i] + ' of ' + t }; });
  }
  var OWN = { Client: 'background:#ffeedc;color:#9b3b08', SBC: 'background:#e5f4ff;color:#0a4f94', MCA: 'background:#d9f3ef;color:#0f5f55' };
  // ---- whole-firm data for the super admin ----
  var ALLTASKS = TASKS;
  var baseMgr = {}; CLIENTS.forEach(function (r) { baseMgr[r[0]] = r[1]; });
  TASKS = ALLTASKS.filter(function (t) { return !!MGR[baseMgr[t[1]]]; });
  // Registrations: d done, p in progress, w pending (waiting on documents), n not yet (before the certificate), x not needed.
  var REGS = ['GST', 'LUT', 'PF', 'ESI', 'PT', 'Shops', 'MSME', 'IEC', 'Trademark'];
  var REG = {
    NT: 'nnnnnnnnn', OL: 'nnnnnnnnn', LA: 'nnnnnnnnn', JB: 'nnnnnnnnn', ML: 'nnnnnnnnn', BW: 'nnnnnnnnn', QM: 'nnnnnnnnn', SV: 'nnnnnnnnn',
    BR: 'dxpwdpdxx', TL: 'dddddddxw', KH: 'pxwwwwwxx', HF: 'ddddddddp', SR: 'dxddwdxxx', IF: 'ddppddxdx', CS: 'dxdddddxw', PH: 'dxdpddwxx', ET: 'ddwwdpxdx'
  };
  // October filings: [day, client, form, statute, status, late fee so far (rupees), late fee per day]
  // status: f filed on time, l filed late, o overdue (not filed), d due this week, u upcoming
  var FIL = [];
  var CMP = ['BR', 'TL', 'KH', 'HF', 'SR', 'IF', 'CS', 'PH', 'ET'];
  var PLAN = [[7, 'TDS challan · September', 'TDS'], [10, 'Professional tax', 'PT'], [11, 'GSTR-1 · September', 'GST'], [15, 'PF ECR · September', 'PF and ESI'],
    [15, 'ESI · September', 'PF and ESI'], [20, 'GSTR-3B · September', 'GST'], [29, 'AOC-4 financial statements', 'ROC'], [31, 'TDS return · Q2', 'TDS']];
  var EXC = { 'BR|15|PF ECR · September': ['o', 1500, 150], 'CS|7|TDS challan · September': ['o', 1800, 200], 'ET|7|TDS challan · September': ['o', 1800, 200],
    'HF|11|GSTR-1 · September': ['l', 250, 0], 'IF|15|ESI · September': ['l', 400, 0], 'KH|10|Professional tax': ['o', 1200, 200], 'SR|11|GSTR-1 · September': ['l', 100, 0] };
  CMP.forEach(function (k) {
    PLAN.forEach(function (p) {
      if (p[3] === 'ROC' && ['KH', 'PH'].indexOf(k) > -1) return;
      var e = EXC[k + '|' + p[0] + '|' + p[1]], st = e ? e[0] : (p[0] < 16 ? 'f' : (p[0] <= 22 ? 'd' : 'u'));
      FIL.push([p[0], k, p[1], p[2], st, e ? e[1] : 0, e ? e[2] : 0]);
    });
  });
  FIL.push([22, 'TL', 'FC-GPR', 'FEMA', 'd', 0, 0], [18, 'ET', 'INC-20A commencement', 'ROC', 'd', 0, 0], [30, 'SR', 'MSME-1 return', 'ROC', 'u', 0, 0]);
  var FST = { f: ['Filed on time', '#0f6e51'], l: ['Filed late', '#be4400'], o: ['Overdue', '#b5302a'], d: ['Due this week', '#1b4f94'], u: ['Upcoming', '#c4ccd8'] };
  // Fees for October by service line: [line, billed, collected]
  var FEES = [['Incorporation', 480000, 310000], ['Registrations', 220000, 190000], ['Monthly compliance', 640000, 520000], ['Advisory', 150000, 60000]];
  // Outstanding fees by client: [client, amount, days outstanding]
  var DUES = [['BW', 85000, 72], ['ML', 60000, 41], ['NT', 45000, 18], ['CS', 38000, 64], ['QM', 30000, 12], ['SV', 42000, 33], ['HF', 26000, 8], ['ET', 24000, 51], ['OL', 20000, 22]];
  // Risks: [kind, title, client, age in days, rupee impact, severity 1-3]
  var RISKS = [
    ['filing', 'TDS challan not paid', 'CS', 9, 1800, 3], ['filing', 'TDS challan not paid', 'ET', 9, 1800, 3], ['filing', 'Professional tax not paid', 'KH', 6, 1200, 2],
    ['filing', 'PF ECR not filed', 'BR', 1, 1500, 2],
    ['notice', 'MCA remarks on SPICe+ unanswered', 'ML', 6, 0, 3], ['notice', 'RUN name rejected; resubmission pending', 'BW', 8, 0, 2],
    ['kyc', 'Director DSC expires 28 Oct', 'OL', 12, 0, 2], ['kyc', 'DIN KYC for one director not filed', 'HF', 16, 5000, 2],
    ['owner', 'New client Lotus Dental has no manager', '', 2, 0, 2],
    ['unassigned', 'INC-20A due 18 Oct has no project lead assigned', 'ET', 0, 0, 1]
  ];
  var RK = { filing: 'Overdue filing', notice: 'MCA notice', kyc: 'DSC or KYC', owner: 'No manager', unassigned: 'No one assigned' };
  // Sales pipeline: [stage, name, service, expected fee, owner admin, days in stage]
  var SALES = [
    ['enquiry', 'Northstar Clinics', 'Incorporation', 65000, 'krishna', 2], ['enquiry', 'Blue Lotus Exports', 'IEC and GST', 30000, 'ritu', 5], ['enquiry', 'Arcadia Learning', 'Monthly compliance', 180000, 'krishna', 1], ['enquiry', 'Redwood Labs', 'Incorporation', 65000, 'ritu', 8],
    ['proposal', 'Meridian Health', 'Incorporation and registrations', 110000, 'krishna', 6], ['proposal', 'Kite Logistics', 'Monthly compliance', 240000, 'ritu', 3], ['proposal', 'Sunbeam Foods', 'FEMA advisory', 90000, 'krishna', 11],
    ['won', 'Lotus Dental', 'Incorporation', 65000, 'krishna', 2], ['won', 'Aurora Paints', 'Monthly compliance', 210000, 'ritu', 9]
  ];
  // Admin activity this week: [admin, when, what]
  var FEED = [
    ['krishna', 'Today 11:20', 'Approved the board resolution for Larkspur Analytics'], ['krishna', 'Today 10:05', 'Escalated the bank account delay at Brightwave Robotics to Pranay'],
    ['ritu', 'Today 09:40', 'Assigned Ember Textiles INC-20A review to Vikram Shah'], ['krishna', 'Yesterday', 'Reassigned Juniper Bio onboarding within Pranay\'s team'],
    ['ritu', 'Yesterday', 'Approved ESI registration filing for Pinecrest Hotels'], ['krishna', 'Wed 14 Oct', 'Assigned Quartz Mobility to Arjun Mehta'],
    ['krishna', 'Tue 13 Oct', 'Resolved the MCA query escalation at Orchid Lane Foods'], ['ritu', 'Mon 12 Oct', 'Won Aurora Paints: monthly compliance from November']
  ];
  var CAP = 10; // clients a manager can run well
  var DAYS = { pranay: 31, priya: 36, arjun: 41, vikram: 29 }; // average days to COI this year
  function rupees(n) { var s = String(Math.round(n)), last = s.slice(-3), rest = s.slice(0, -3); return '₹' + (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' : '') + last; }
  function allStats(id) {
    var cl = allClients().filter(function (c) { return c.mgr === id; }), ks = cl.map(function (c) { return c.k; });
    var t = ALLTASKS.filter(function (x) { return ks.indexOf(x[1]) > -1; });
    return { clients: cl, open: t.filter(function (x) { return x[3] !== 'done'; }).length, overdue: t.filter(function (x) { return x[3] === 'bad'; }).length, tasks: t };
  }
  window.ADM = { C: C, MGR: MGR, CLIENTS: CLIENTS, TASKS: TASKS, MTASKS: MTASKS, ST: ST, HEALTH: HEALTH, PIPE: PIPE, TOT: TOT, OWN: OWN,
    overrides: overrides, mgrOf: mgrOf, due: due, ini: ini, clients: clients, mgrStats: mgrStats, dd: dd, donut: donut, phaseBar: phaseBar,
    ALLMGR: ALLMGR, ADMINS: ADMINS, ALLTASKS: ALLTASKS, allClients: allClients, allStats: allStats, adminOf: adminOf, REGS: REGS, REG: REG, FIL: FIL, FST: FST,
    FEES: FEES, DUES: DUES, RISKS: RISKS, RK: RK, SALES: SALES, FEED: FEED, CAP: CAP, DAYS: DAYS, rupees: rupees,
    assign: function (k, id) { var o = overrides(); o[k] = id; try { sessionStorage.setItem('vcfo.assign', JSON.stringify(o)); } catch (e) {} window.dispatchEvent(new CustomEvent('vcfo:assign', { detail: { k: k, mgr: id } })); } };
})();
