/* Registrations and obligations for the prototype (owner, 26 Oct). Taken from the SBC Registration and
   Compliance Manual (15 SOPs, due-date tables) and the Phase 4 step data. Sample data only.
   window.RC = { CATS, REG, OB, CLIENT, applies(), regState(), obState(), PEOPLE }. */
(function () {
  // Registration categories, in page order.
  var CATS = [['tax', 'Tax'], ['labour', 'Labour'], ['business', 'Business'], ['ip', 'IP'], ['fema', 'FEMA']];

  // Registrations: id, name, category, authority, form, owner team, one plain line, documents from the client,
  // details from the client, fields SBC fills, steps [side, label] (a = authority, s = SBC), renewal, obligations it starts, rule.
  var REG = [
    { id: 'gst', name: 'GST registration', cat: 'tax', auth: 'GSTN', form: 'GST REG-01', team: 'Indirect Tax Team',
      about: 'A tax identity for the business: once registered, it can charge GST, claim input tax credit and file GST returns.',
      docs: ['Company PAN', 'Certificate of incorporation', 'MOA and AOA', 'Board resolution naming the signatory', 'Signatory PAN, Aadhaar and photo', 'Office electricity bill (last 2 months)', 'Rent agreement', "Owner's NOC", 'Cancelled cheque'],
      details: [['Principal place of business', 'No. 42, 4th floor, 100 Ft Road, Indiranagar, Bengaluru 560038'], ['Business activities', 'Software development and IT services'], ['Top HSN or SAC codes', '998314, 998313'], ['Signatory mobile for OTP', '+91 98450 12345'], ['Signatory email', 'rohan@northwind.example']],
      sbc: [['TRN', '272600000123TRN'], ['ARN', 'AA291025012345X'], ['Jurisdiction', 'State · Bengaluru Ward 12'], ['GSTIN', '29AAKCN4821M1Z5']],
      steps: [['s', 'Documents received'], ['s', 'Part A filed · TRN'], ['s', 'Part B filed · ARN'], ['a', 'Clarification asked (REG-03)'], ['s', 'Reply filed (REG-04)'], ['a', 'Approved · certificate (REG-06)']],
      renew: 'None', starts: ['gstr1', 'gstr3b', 'gstr9'], rule: 'Turnover above ₹40 lakh (goods) or ₹20 lakh (services), or exports' },
    { id: 'lut', name: 'Letter of undertaking (LUT)', cat: 'tax', auth: 'GSTN', form: 'GST RFD-11', team: 'Indirect Tax Team',
      about: 'Lets an exporter export without paying IGST first, so working capital is not blocked.',
      docs: ['GST registration certificate', 'Signatory authorisation'], details: [['Financial year', '2026-27'], ['Witness 1', 'Mei Tanaka, Bengaluru'], ['Witness 2', 'Arvind Rao, Bengaluru']],
      sbc: [['ARN', 'AD291125004471L'], ['Acknowledged', '3 Nov 2026']],
      steps: [['s', 'Details received'], ['s', 'Filed on the GST portal'], ['a', 'Acknowledged']], renew: 'Every year by 31 Mar', starts: ['lutren'], rule: 'Exports of goods or services' },
    { id: 'pt', name: 'Professional tax', cat: 'tax', auth: 'Karnataka CTD', form: 'PTRC and PTEC', team: 'Payroll and Compliance Team',
      about: 'A state tax on salaries: the employer registers, deducts it every month and pays it to the state.',
      docs: ['Company PAN', 'Certificate of incorporation', 'Office address proof', 'Director ID'], details: [['Employees by salary band', '12 above ₹25,000'], ['First salary month', 'November 2026']],
      sbc: [['PTRC number', 'Applied 4 Nov'], ['PTEC number', 'Applied 4 Nov']],
      steps: [['s', 'Documents received'], ['s', 'Applied on the state portal'], ['a', 'Numbers allotted'], ['a', 'Certificates issued']], renew: 'PTEC payment every year by 30 Apr', starts: ['ptm', 'pty'], rule: 'Any employee in Karnataka' },
    { id: 'icegate', name: 'ICEGATE', cat: 'tax', auth: 'CBIC', form: 'ICEGATE sign-up', team: 'Finance and Compliance Team',
      about: 'The customs portal account an importer or exporter of goods needs to file shipping documents.',
      docs: ['IEC certificate', 'DSC of the signatory'], details: [['Port of business', 'Bengaluru ICD']], sbc: [['ICEGATE ID', '-']],
      steps: [['s', 'Documents received'], ['s', 'Applied'], ['a', 'ID issued']], renew: 'None', starts: [], rule: 'Imports or exports of goods' },
    { id: 'epf', name: 'EPF registration', cat: 'labour', auth: 'EPFO', form: 'Shram Suvidha', team: 'Payroll and Compliance Team',
      about: 'Retirement savings for employees: employer and employee each pay 12% of basic salary every month.',
      docs: ['Company PAN', 'Certificate of incorporation', 'Cancelled cheque', 'Office address proof', 'Director KYC', 'Employer DSC (class III)'],
      details: [['Date the first employee joined', '3 Nov 2026'], ['Employees', '12'], ['Wage structure', 'Basic 50% of CTC']],
      sbc: [['Establishment code', 'KNBNG2954118000'], ['Coverage date', '2 Nov 2026']],
      steps: [['s', 'Documents received'], ['s', 'Applied on Shram Suvidha'], ['s', 'DSC registered'], ['a', 'Code allotted'], ['a', 'Certificate issued']], renew: 'None', starts: ['ecr'], rule: '20 or more employees (voluntary below 20)' },
    { id: 'esi', name: 'ESI registration', cat: 'labour', auth: 'ESIC', form: 'ESIC employer form', team: 'Payroll and Compliance Team',
      about: 'Medical, sickness and maternity cover for employees earning up to ₹21,000 a month.',
      docs: ['Company PAN', 'Certificate of incorporation', 'Cancelled cheque', 'Office address proof', 'Signatory PAN and Aadhaar'],
      details: [['Employees', '12'], ['Employees up to ₹21,000 a month', '3']], sbc: [['Employer code', '53001234560001001']],
      steps: [['s', 'Documents received'], ['s', 'Applied on the ESIC portal'], ['a', 'Code allotted'], ['a', 'Certificate (C-11)']], renew: 'None', starts: ['esim'], rule: '10 or more employees' },
    { id: 'se', name: 'Shops and Establishment', cat: 'labour', auth: 'Karnataka Labour Dept', form: 'Form A', team: 'HR and Compliance Team',
      about: 'The first labour registration for an office: legal recognition of the establishment in the state.',
      docs: ['Office address proof', 'Rent agreement', 'Photo of the premises', 'Employer ID'], details: [['Manager', 'Rohan Kumar'], ['Category', 'Commercial establishment · IT'], ['Employees', '9 men, 3 women'], ['Working hours', '9:30 am to 6:30 pm, Mon to Fri']],
      sbc: [['Registration number', 'Applied 5 Nov']], steps: [['s', 'Documents received'], ['s', 'Applied on the labour portal'], ['a', 'Inspection (if any)'], ['a', 'Certificate issued']], renew: 'Before 1 Dec each year (state rule)', starts: ['seren'], rule: 'Every office or shop with employees' },
    { id: 'clra', name: 'CLRA registration', cat: 'labour', auth: 'Labour Dept', form: 'Form I', team: 'HR, Legal and Compliance Team',
      about: 'For principal employers using contract labour: the employer stays responsible for the contractors’ workers.',
      docs: ['Company PAN', 'GST certificate', 'Shops registration', 'Contractor agreement'], details: [['Contract workers', '0']], sbc: [['Registration number', '-']],
      steps: [['s', 'Applicability checked'], ['s', 'Applied'], ['a', 'Certificate issued']], renew: 'As applicable', starts: [], rule: '50 or more contract workers' },
    { id: 'posh', name: 'POSH compliance', cat: 'labour', auth: 'District officer', form: 'Annual report', team: 'HR and Legal Team',
      about: 'A safe workplace for women: a policy, an Internal Committee with an external member, and a yearly report.',
      docs: ['POSH policy (signed)', 'Internal Committee order', 'External member consent'], details: [['Presiding officer', 'Mei Tanaka'], ['Employee members', '2']], sbc: [['Committee constituted', '-']],
      steps: [['s', 'Policy drafted'], ['s', 'Committee constituted'], ['s', 'Awareness session held'], ['a', 'Annual report filed']], renew: 'Annual report before 31 Jan', starts: ['posh'], rule: '10 or more employees' },
    { id: 'lwf', name: 'Labour Welfare Fund', cat: 'labour', auth: 'Karnataka LWF Board', form: 'Form D', team: 'HR and Payroll Team',
      about: 'A small state welfare contribution from employer and employee; in Karnataka it is paid once a year.',
      docs: ['Company PAN', 'Shops registration', 'Employee list'], details: [['Employees', '12']], sbc: [['Registration number', '-']],
      steps: [['s', 'Applicability checked'], ['s', 'Registered'], ['a', 'Confirmed']], renew: 'Yearly by 15 Jan (Karnataka)', starts: ['lwf'], rule: 'Employees in a state with LWF' },
    { id: 'msme', name: 'MSME (Udyam)', cat: 'business', auth: 'Ministry of MSME', form: 'Udyam', team: 'Finance and Compliance Team',
      about: 'A free registration that gives the company MSME benefits, such as protection against late payments by buyers.',
      docs: ['Director Aadhaar', 'Company PAN'], details: [['NIC codes', '62011, 62013'], ['Employees', '12']], sbc: [['Udyam number', 'UDYAM-KR-03-0123456']],
      steps: [['s', 'Details received'], ['s', 'Filed'], ['a', 'Certificate issued']], renew: 'Update every year', starts: [], rule: 'Not yet Udyam registered' },
    { id: 'iec', name: 'Import Export Code (IEC)', cat: 'business', auth: 'DGFT', form: 'ANF-2A', team: 'Finance and Compliance Team',
      about: 'A one-time 10-digit code from DGFT, needed to import or export goods and services.',
      docs: ['Company PAN', 'Office address proof', 'Bank certificate or cancelled cheque'], details: [['Preferred sector', 'IT services']], sbc: [['IEC number', 'Applied 6 Nov']],
      steps: [['s', 'Documents received'], ['s', 'Applied on DGFT'], ['a', 'Verification'], ['a', 'IEC allotted']], renew: 'Update every year (April to June)', starts: ['iecup'], rule: 'Imports or exports' },
    { id: 'lei', name: 'Legal Entity Identifier (LEI)', cat: 'business', auth: 'LEIL', form: 'LEI application', team: 'Finance and Treasury Team',
      about: 'A 20-character global ID that banks ask for on large or cross-border transactions.',
      docs: ['Company PAN', 'Certificate of incorporation', 'Board resolution'], details: [['Bank asking', 'HDFC Bank, for the parent remittance']], sbc: [['LEI', '-']],
      steps: [['s', 'Documents received'], ['s', 'Applied'], ['a', 'Validated'], ['a', 'LEI issued']], renew: 'Every year by 30 Jun', starts: ['leiren'], rule: 'Large-value bank transactions' },
    { id: 'tl', name: 'Trade licence', cat: 'business', auth: 'BBMP', form: 'Trade licence', team: 'Legal and Compliance Team',
      about: 'Municipal permission to run the business from this address.',
      docs: ['Company PAN', 'GST certificate', 'Shops registration', 'Rent agreement', 'Electricity bill'], details: [['Trade', 'Software office']], sbc: [['Licence number', '-']],
      steps: [['s', 'Documents received'], ['s', 'Applied on the BBMP portal'], ['a', 'Inspection (if any)'], ['a', 'Licence issued']], renew: 'Before 31 Dec each year', starts: ['tlren'], rule: 'Every business premises (local rule)' },
    { id: 'nonstpi', name: 'Non-STPI registration', cat: 'business', auth: 'STPI', form: 'Non-STPI form', team: 'Finance and Compliance Team',
      about: 'For IT and ITES exporters outside an STPI park: lets the bank and RBI track software export receipts.',
      docs: ['Certificate of incorporation', 'IEC', 'GST certificate', 'Board resolution'], details: [['Export services', 'Software development for the parent']], sbc: [['Registration number', '-']],
      steps: [['s', 'Documents received'], ['s', 'Application filed'], ['a', 'Verification'], ['a', 'Approved']], renew: 'None', starts: ['softex'], rule: 'IT or ITES exports outside STPI' },
    { id: 'tm', name: 'Trademark registration', cat: 'ip', auth: 'IP India', form: 'TM-A', team: 'Legal and Secretarial Team',
      about: 'Protects the brand name or logo so no one else can use it for the same goods or services.',
      docs: ['Logo file', 'User affidavit (if used before)', 'Power of attorney (TM-48)'], details: [['Mark', 'NORTHWIND'], ['Classes', '9 and 42'], ['First use', 'Proposed to be used']],
      sbc: [['Application number', '-']], steps: [['s', 'Search and class check'], ['s', 'Application filed'], ['a', 'Examination report'], ['s', 'Reply to objection (if any)'], ['a', 'Published in journal'], ['a', 'Registered']], renew: 'Every 10 years', starts: ['tmren'], rule: 'A brand name to protect' },
    { id: 'patent', name: 'Patent', cat: 'ip', auth: 'IP India', form: 'Form 1', team: 'Legal and Secretarial Team', about: 'Protects an invention for 20 years.', docs: ['Invention disclosure'], details: [['Invention', '-']], sbc: [['Application number', '-']], steps: [['s', 'Disclosure received'], ['s', 'Filed'], ['a', 'Examination'], ['a', 'Granted']], renew: 'Yearly fee', starts: [], rule: 'An invention to protect' },
    { id: 'fcgpr', name: 'FC-GPR', cat: 'fema', auth: 'RBI · FIRMS', form: 'FC-GPR', team: 'Legal and Secretarial Team',
      about: 'Reports shares issued to a foreign investor to RBI, within 30 days of allotment.',
      docs: ['FIRC and bank KYC for each investor', 'Allotment board resolution', 'Valuation certificate', 'CS certificate'], details: [['Investor', 'Northwind KK, Japan'], ['Shares allotted', '60,000'], ['Allotment date', '2 Nov 2026']],
      sbc: [['Entity master number', 'EM-2026-118822'], ['SRN', '-']], steps: [['s', 'Documents received'], ['s', 'Filed on FIRMS'], ['a', 'RBI review'], ['a', 'Acknowledged']], renew: 'Each allotment', starts: ['fla'], rule: 'Foreign investment received' },
    { id: 'fla', name: 'FLA return', cat: 'fema', auth: 'RBI · FLAIR', form: 'FLA', team: 'Finance and Compliance Team', about: 'A yearly report to RBI of foreign liabilities and assets.', docs: ['Audited balance sheet (or provisional)'], details: [['As on', '31 Mar 2027']], sbc: [['Acknowledgement', '-']], steps: [['s', 'Data received'], ['s', 'Filed'], ['a', 'Acknowledged']], renew: 'Every year by 15 Jul', starts: ['fla'], rule: 'Foreign assets or liabilities' },
    { id: 'fctrs', name: 'FC-TRS', cat: 'fema', auth: 'RBI · FIRMS', form: 'FC-TRS', team: 'Legal and Secretarial Team', about: 'Reports a share transfer between a resident and a non-resident.', docs: ['Share transfer deed', 'Valuation certificate'], details: [['Transfer', '-']], sbc: [['SRN', '-']], steps: [['s', 'Documents received'], ['s', 'Filed'], ['a', 'Acknowledged']], renew: 'Each transfer', starts: [], rule: 'Share transfer with a non-resident' },
    { id: 'odi', name: 'ODI', cat: 'fema', auth: 'RBI · AD bank', form: 'Form ODI', team: 'Legal and Secretarial Team', about: 'Approval to invest outside India.', docs: ['Board resolution', 'Valuation report'], details: [['Overseas entity', '-']], sbc: [['UIN', '-']], steps: [['s', 'Documents received'], ['s', 'Filed through the bank'], ['a', 'UIN allotted']], renew: 'Annual performance report', starts: [], rule: 'Investment outside India' }
  ];

  // Northwind, after the certificate (client "After"): state, date, number, why it applies.
  // st: done | run | wait | none | na (not needed). step: how many steps are complete.
  var CLIENT = {
    gst: ['done', '1 Nov 2026', '29AAKCN4821M1Z5', 6, 'Exports services to the parent'],
    lut: ['done', '3 Nov 2026', 'AD291125004471L', 3, 'Exports services'],
    pt: ['run', 'Expected 12 Nov', '', 2, '12 employees in Karnataka'],
    epf: ['done', '2 Nov 2026', 'KNBNG2954118000', 5, 'Voluntary at 12 employees'],
    esi: ['done', '3 Nov 2026', '53001234560001001', 4, '12 employees (from 10)'],
    se: ['wait', 'Waiting since 5 Nov', '', 1, 'Office with employees'],
    msme: ['done', '30 Oct 2026', 'UDYAM-KR-03-0123456', 3, 'Not yet Udyam registered'],
    iec: ['run', 'Expected 14 Nov', '', 2, 'Exports services'],
    posh: ['run', 'Committee by 20 Nov', '', 1, '12 employees (from 10)'],
    lwf: ['none', 'Starts Dec 2026', '', 0, 'Employees in Karnataka'],
    tl: ['none', 'Starts Dec 2026', '', 0, 'Office in Bengaluru'],
    lei: ['none', 'Starts Dec 2026', '', 0, 'Parent remittances through HDFC'],
    tm: ['none', 'Starts Jan 2027', '', 0, 'Brand NORTHWIND'],
    fcgpr: ['wait', 'Due 2 Dec 2026', '', 1, 'Shares allotted to Northwind KK'],
    fla: ['none', 'By 15 Jul 2027', '', 0, 'Foreign investment'],
    nonstpi: ['none', 'Starts Dec 2026', '', 0, 'IT exports outside STPI'],
    icegate: ['na', '', '', 0, 'No goods imported or exported'],
    clra: ['na', '', '', 0, 'No contract labour'],
    patent: ['na', '', '', 0, 'No invention to protect'],
    fctrs: ['na', '', '', 0, 'No share transfer'],
    odi: ['na', '', '', 0, 'No overseas investment']
  };
  // Renewals in date order, and recently granted, for the right rail.
  var RENEW = [['lut', 'LUT for FY 2027-28', '31 Mar 2027'], ['se', 'Shops and Establishment', '1 Dec 2026'], ['tl', 'Trade licence', '31 Dec 2026'], ['lei', 'LEI', '30 Jun 2027'], ['iec', 'IEC profile update', '30 Jun 2027']];

  // Obligations: id, name, law, frequency (m q h a), due rule, next due (client view), last filed, state, started by, penalty, from client, filed by SBC, steps.
  var OB = [
    { id: 'gstr1', name: 'GSTR-1', law: 'GST', fr: 'm', due: '11th of next month', next: '11 Nov 2026', last: 'Not filed yet', st: 'run', by: 'gst', pen: '₹50 a day, up to ₹10,000', from: ['Sales register for October', 'Credit and debit notes', 'Export invoices'], sbc: [['Period', 'Oct 2026'], ['ARN', '-'], ['B2B invoices', '14']], steps: [['s', 'Sales data received'], ['s', 'Reconciled'], ['s', 'Filed · ARN'], ['a', 'Acknowledged']] },
    { id: 'gstr3b', name: 'GSTR-3B', law: 'GST', fr: 'm', due: '20th of next month', next: '20 Nov 2026', last: 'Not filed yet', st: 'none', by: 'gst', pen: '18% interest on the tax due, plus ₹50 a day', from: ['Purchase register for October', 'Approval to pay the tax'], sbc: [['Period', 'Oct 2026'], ['Challan (PMT-06)', '-']], steps: [['s', 'Purchase data received'], ['s', 'Matched with GSTR-2B'], ['s', 'Tax paid'], ['s', 'Filed'], ['a', 'Acknowledged']] },
    { id: 'gstr9', name: 'GSTR-9 annual return', law: 'GST', fr: 'a', due: '31 Dec after the year', next: '31 Dec 2027', last: '-', st: 'none', by: 'gst', pen: '₹200 a day, up to 0.5% of turnover', from: ['Year-end books'], sbc: [['Year', 'FY 2026-27']], steps: [['s', 'Books received'], ['s', 'Prepared'], ['s', 'Filed'], ['a', 'Acknowledged']] },
    { id: 'tdsp', name: 'TDS deposit', law: 'Income tax', fr: 'm', due: '7th of next month', next: '7 Nov 2026', last: '7 Oct 2026', st: 'bad', by: '', pen: '1.5% interest a month', from: ['Vendor and salary payments with TDS for October'], sbc: [['Challan 281 (CIN)', '-']], steps: [['s', 'Payments received'], ['s', 'TDS computed'], ['s', 'Paid'], ['a', 'Challan confirmed']] },
    { id: 'tdsr', name: 'TDS return 24Q and 26Q', law: 'Income tax', fr: 'q', due: '31 Jul, 31 Oct, 31 Jan, 31 May', next: '31 Jan 2027', last: '30 Oct 2026', st: 'done', by: '', pen: '₹200 a day', from: ['Deductee details for the quarter'], sbc: [['Token number', 'Q2 · 482910773'], ['Form 16A', 'Issued 4 Nov']], steps: [['s', 'Data received'], ['s', 'Prepared'], ['s', 'Filed'], ['a', 'Accepted'], ['s', 'Certificates issued']] },
    { id: 'adv', name: 'Advance tax', law: 'Income tax', fr: 'q', due: '15 Jun, 15 Sep, 15 Dec, 15 Mar', next: '15 Dec 2026', last: '-', st: 'none', by: '', pen: '1% interest a month (234B and 234C)', from: ['Estimated income for the year'], sbc: [['Challan', '-']], steps: [['s', 'Estimate received'], ['s', 'Computed'], ['s', 'Paid']] },
    { id: 'ecr', name: 'EPF ECR', law: 'EPF Act', fr: 'm', due: '15th of next month', next: '15 Nov 2026', last: 'Not filed yet', st: 'wait', by: 'epf', pen: '5% to 15% a year by delay', from: ['Salary register for October'], sbc: [['TRRN', '-']], steps: [['s', 'Payroll received'], ['s', 'ECR filed'], ['s', 'Paid'], ['a', 'Confirmed']] },
    { id: 'esim', name: 'ESI contribution', law: 'ESI Act', fr: 'm', due: '15th of next month', next: '15 Nov 2026', last: 'Not filed yet', st: 'wait', by: 'esi', pen: '12% interest a year', from: ['Salary register for October'], sbc: [['Challan', '-']], steps: [['s', 'Payroll received'], ['s', 'Contribution filed'], ['s', 'Paid']] },
    { id: 'ptm', name: 'Professional tax · monthly', law: 'Karnataka PT', fr: 'm', due: '10th of next month', next: '10 Dec 2026', last: '-', st: 'none', by: 'pt', pen: '1.5% a month', from: ['Salary register by band'], sbc: [['Challan', '-']], steps: [['s', 'Payroll received'], ['s', 'Paid'], ['s', 'Return filed']] },
    { id: 'pty', name: 'Professional tax · yearly', law: 'Karnataka PT', fr: 'a', due: '30 Apr', next: '30 Apr 2027', last: '-', st: 'none', by: 'pt', pen: '1.5% a month', from: ['Company PT enrolment details'], sbc: [['Receipt', '-']], steps: [['s', 'Paid'], ['a', 'Receipt']] },
    { id: 'lwf', name: 'Labour Welfare Fund', law: 'Karnataka LWF', fr: 'a', due: '15 Jan', next: '15 Jan 2027', last: '-', st: 'none', by: 'lwf', pen: 'State penalty', from: ['Employee count on 31 Dec'], sbc: [['Receipt', '-']], steps: [['s', 'Count received'], ['s', 'Paid'], ['a', 'Receipt']] },
    { id: 'aoc4', name: 'AOC-4 financial statements', law: 'Companies Act', fr: 'a', due: '30 days after the AGM', next: '29 Oct 2027', last: '-', st: 'none', by: '', pen: '₹100 a day', from: ['Audited financial statements', 'Board report'], sbc: [['SRN', '-']], steps: [['s', 'Statements received'], ['s', 'Prepared'], ['s', 'Filed · SRN'], ['a', 'Approved by ROC']] },
    { id: 'mgt7', name: 'MGT-7 annual return', law: 'Companies Act', fr: 'a', due: '60 days after the AGM', next: '28 Nov 2027', last: '-', st: 'none', by: '', pen: '₹100 a day', from: ['Shareholder list', 'Meeting dates'], sbc: [['SRN', '-']], steps: [['s', 'Data received'], ['s', 'Prepared'], ['s', 'Filed'], ['a', 'Approved by ROC']] },
    { id: 'adt1', name: 'ADT-1 auditor appointment', law: 'Companies Act', fr: 'a', due: '15 days after the AGM', next: '10 Nov 2026', last: '-', st: 'wait', by: '', pen: '₹100 a day', from: ['Auditor consent and certificate'], sbc: [['SRN', '-']], steps: [['s', 'Consent received'], ['s', 'Filed'], ['a', 'Approved by ROC']] },
    { id: 'dir3', name: 'DIR-3 KYC', law: 'Companies Act', fr: 'a', due: '30 Sep, every 3 years', next: '30 Sep 2029', last: '-', st: 'none', by: '', pen: '₹5,000 to reactivate the DIN', from: ["Each director's mobile and email for OTP"], sbc: [['SRN', '-']], steps: [['s', 'OTP received'], ['s', 'Filed'], ['a', 'Approved']] },
    { id: 'dpt3', name: 'DPT-3 return of deposits', law: 'Companies Act', fr: 'a', due: '30 Jun', next: '30 Jun 2027', last: '-', st: 'none', by: '', pen: '2 to 12 times the normal fee', from: ['Loans and deposits on 31 Mar'], sbc: [['SRN', '-']], steps: [['s', 'Data received'], ['s', 'Filed'], ['a', 'Approved']] },
    { id: 'msme1', name: 'MSME-1', law: 'Companies Act', fr: 'h', due: '30 Apr and 31 Oct', next: '30 Apr 2027', last: '-', st: 'none', by: '', pen: 'Fine up to ₹20,000, then ₹1,000 a day', from: ['MSME vendor dues over 45 days'], sbc: [['SRN', '-']], steps: [['s', 'Vendor dues received'], ['s', 'Filed']] },
    { id: 'fla', name: 'FLA return', law: 'FEMA', fr: 'a', due: '15 Jul', next: '15 Jul 2027', last: '-', st: 'none', by: 'fcgpr', pen: 'Up to 300% of the amount, or ₹2 lakh', from: ['Foreign liabilities and assets on 31 Mar'], sbc: [['Acknowledgement', '-']], steps: [['s', 'Data received'], ['s', 'Filed'], ['a', 'Acknowledged']] },
    { id: 'softex', name: 'Softex form', law: 'FEMA', fr: 'm', due: '30 days after the last invoice of the month', next: '30 Nov 2026', last: '-', st: 'none', by: 'nonstpi', pen: 'The bank may freeze the account', from: ['Export invoices for the month'], sbc: [['Softex number', '-']], steps: [['s', 'Invoices received'], ['s', 'Filed'], ['a', 'Certified by STPI']] },
    { id: 'posh', name: 'POSH annual report', law: 'POSH Act', fr: 'a', due: 'Before 31 Jan', next: '31 Jan 2027', last: '-', st: 'none', by: 'posh', pen: '₹50,000', from: ['Complaints received in the year (or none)'], sbc: [['Report', '-']], steps: [['s', 'Data received'], ['s', 'Report filed'], ['a', 'Acknowledged']] },
    { id: 'tlren', name: 'Trade licence renewal', law: 'Municipal', fr: 'a', due: 'Before 31 Dec', next: '31 Dec 2026', last: '-', st: 'none', by: 'tl', pen: '25% of the fee within 3 months, 50% after', from: ['Last licence'], sbc: [['Licence number', '-']], steps: [['s', 'Renewal filed'], ['a', 'Renewed']] },
    { id: 'seren', name: 'Shops and Establishment renewal', law: 'Shops Act', fr: 'a', due: 'Before 1 Dec', next: '1 Dec 2026', last: '-', st: 'none', by: 'se', pen: '25% in December, 50% after', from: ['Employee count'], sbc: [['Certificate', '-']], steps: [['s', 'Renewal filed'], ['a', 'Renewed']] },
    { id: 'lutren', name: 'LUT renewal', law: 'GST', fr: 'a', due: '31 Mar', next: '31 Mar 2027', last: '3 Nov 2026', st: 'none', by: 'lut', pen: 'Tax on exports, refund later', from: ['Witness details'], sbc: [['ARN', '-']], steps: [['s', 'Filed'], ['a', 'Acknowledged']] },
    { id: 'iecup', name: 'IEC profile update', law: 'Foreign trade', fr: 'a', due: '30 Jun', next: '30 Jun 2027', last: '-', st: 'none', by: 'iec', pen: '₹200', from: ['Changes to company details'], sbc: [['Updated on', '-']], steps: [['s', 'Updated on DGFT']] },
    { id: 'tax3cd', name: 'Tax audit (3CD)', law: 'Income tax', fr: 'a', due: '31 Oct', next: '31 Oct 2027', last: '-', st: 'none', by: '', pen: '0.5% of turnover, up to ₹1,50,000', from: ['Audited books'], sbc: [['Acknowledgement', '-']], steps: [['s', 'Books received'], ['s', 'Audit done'], ['s', 'Filed']] }
  ];
  var FR = { m: 'Monthly', q: 'Quarterly', h: 'Half-yearly', a: 'Annual' };
  var LAWCAT = { 'GST': 'GST', 'Income tax': 'Income tax', 'EPF Act': 'Payroll', 'ESI Act': 'Payroll', 'Karnataka PT': 'Payroll', 'Karnataka LWF': 'Payroll', 'Companies Act': 'MCA / ROC', 'FEMA': 'FEMA', 'Foreign trade': 'FEMA', 'POSH Act': 'Labour', 'Municipal': 'Labour', 'Shops Act': 'Labour' };
  var LAWS = ['GST', 'Income tax', 'Payroll', 'MCA / ROC', 'FEMA', 'Labour'];

  // Staff view: the lead's clients and a state per registration (from the admin data where it exists).
  var STAFF = [['NT', 'Northwind Technologies'], ['OL', 'Orchid Lane Foods'], ['LA', 'Larkspur Analytics'], ['JB', 'Juniper Bio'], ['BR', 'Brightwave Robotics'], ['TL', 'Tidewater Logistics'], ['KH', 'Kestrel Health'], ['HF', 'Halcyon Fintech']];
  var GRID = ['gst', 'lut', 'epf', 'esi', 'pt', 'se', 'msme', 'iec', 'tm', 'fcgpr'];
  var SST = {
    NT: 'nnnnnnnnnw', OL: 'nnnnnnnnnn', LA: 'nnnnnnnnna', JB: 'nnnnnnnnaa',
    BR: 'ddddrrdaaw', TL: 'dddddddrar', KH: 'rawdwddaad', HF: 'ddddwdrdra'
  };
  var SC = { d: 'done', r: 'run', w: 'wait', n: 'none', a: 'na' };
  function staffState(k, id) { var i = GRID.indexOf(id); var c = (SST[k] || '')[i]; if (c) return SC[c]; return k === 'NT' ? 'none' : 'na'; }
  var PEOPLE = { client: ['Rohan Kumar', 'RK', 'Client · Northwind'], lead: ['Bharath', 'BH', 'Project lead'], mgr: ['Pranay', 'PN', 'Manager'] };
  var ST = { done: ['Granted', '#0f6e51'], run: ['In progress', '#1b4f94'], wait: ['Waiting on client', '#be4400'], none: ['Not started', '#656f7e'], na: ['Not needed', '#8593a6'], bad: ['Overdue', '#b5302a'] };
  var OST = { done: ['Filed', '#0f6e51'], run: ['In progress', '#1b4f94'], wait: ['Waiting on client', '#be4400'], none: ['Upcoming', '#656f7e'], bad: ['Overdue', '#b5302a'] };
  window.RC = { CATS: CATS, REG: REG, OB: OB, FR: FR, LAWCAT: LAWCAT, LAWS: LAWS, CLIENT: CLIENT, RENEW: RENEW, STAFF: STAFF, GRID: GRID, staffState: staffState, PEOPLE: PEOPLE, ST: ST, OST: OST,
    reg: function (id) { for (var i = 0; i < REG.length; i++) if (REG[i].id === id) return REG[i]; return REG[0]; },
    ob: function (id) { for (var i = 0; i < OB.length; i++) if (OB[i].id === id) return OB[i]; return OB[0]; },
    pick: function () { try { var v = sessionStorage.getItem('vcfo.item'); if (v) { var a = v.split('|'); return { kind: a[0], id: a[1], k: a[2] || 'NT' }; } } catch (e) {} return null; },
    after: function () { try { var v = localStorage.getItem('vcfo.after'); return v === 'true' || v === '"true"'; } catch (e) { return false; } } };
})();
