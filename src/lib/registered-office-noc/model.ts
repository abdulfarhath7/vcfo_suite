/**
 * REGISTERED OFFICE NOC — the property owner's no-objection certificate for the
 * registered office of a company being incorporated (owner's request, prototype
 * sbc-vcfo-local a59x_newproj.js; HANDOFF §5 "New project → NOC").
 *
 * Pure and isomorphic: the New project wizard's live preview, the print view and
 * the server-side Word file (`docx.ts`) all read `nocModel`, so the three can
 * never disagree. `checkNoc` holds the field rules: an error blocks the step, a
 * warning (old bill, agreement after the NOC, PIN outside the state) only warns.
 *
 * Not the parent's NOC (`src/lib/noc/*`), which is the parent company's Pre-2
 * board resolution.
 */

export const NOC_HOLDINGS = [
  { value: 'rented', label: 'Rented', verb: 'let out on rent' },
  { value: 'leased', label: 'Leased', verb: 'given on lease' },
  { value: 'director', label: 'Owned by a director', verb: 'owned by a proposed director' },
  { value: 'relative', label: 'Owned by a relative or another person', verb: 'provided free of rent' },
] as const;
export type NocHolding = (typeof NOC_HOLDINGS)[number]['value'];

export const NOC_BILLS = ['Electricity bill', 'Water bill', 'Gas bill', 'Telephone or broadband bill', 'Property tax receipt'] as const;
export const NOC_TITLES = ['Mr.', 'Ms.', 'Mrs.', 'Dr.'] as const;
export const NOC_RELATIONS = [
  { value: 'S/o', label: 'Son of' },
  { value: 'D/o', label: 'Daughter of' },
  { value: 'W/o', label: 'Wife of' },
] as const;

/** States and union territories (the prototype's STATES_IN). */
export const NOC_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry',
] as const;

/** Registrar of Companies city per state (prototype NP_ROC). Unknown → "Registrar of Companies, <state>". */
export const ROC_CITY: Record<string, string> = {
  Telangana: 'Hyderabad', 'Andhra Pradesh': 'Vijayawada', Karnataka: 'Bengaluru', 'Tamil Nadu': 'Chennai', Maharashtra: 'Mumbai',
  Delhi: 'Delhi', Haryana: 'Delhi', Gujarat: 'Ahmedabad', 'West Bengal': 'Kolkata', Kerala: 'Ernakulam', Rajasthan: 'Jaipur',
  Punjab: 'Chandigarh', Chandigarh: 'Chandigarh', 'Uttar Pradesh': 'Kanpur', 'Madhya Pradesh': 'Gwalior', Bihar: 'Patna',
  Odisha: 'Cuttack', Assam: 'Shillong', Goa: 'Goa', Jharkhand: 'Ranchi', Chhattisgarh: 'Bilaspur', Uttarakhand: 'Dehradun',
  'Himachal Pradesh': 'Chandigarh', 'Jammu and Kashmir': 'Jammu', Puducherry: 'Puducherry',
};

/**
 * First three digits of the PIN codes each state uses (India Post postal
 * circles). Ranges overlap where a circle spans two states, so a PIN is only
 * flagged when no range of the chosen state holds it. Only ever a warning.
 */
const PIN_PREFIXES: Record<string, Array<[number, number]>> = {
  Delhi: [[110, 110]],
  Haryana: [[121, 136]],
  Punjab: [[140, 160]],
  Chandigarh: [[160, 160]],
  'Himachal Pradesh': [[171, 177]],
  'Jammu and Kashmir': [[180, 194]],
  Ladakh: [[194, 194]],
  'Uttar Pradesh': [[201, 285]],
  Uttarakhand: [[244, 249], [262, 263]],
  Rajasthan: [[301, 345]],
  Gujarat: [[360, 396]],
  'Dadra and Nagar Haveli and Daman and Diu': [[362, 362], [396, 396]],
  Maharashtra: [[400, 445]],
  Goa: [[403, 403]],
  'Madhya Pradesh': [[450, 488]],
  Chhattisgarh: [[490, 497]],
  Telangana: [[500, 509]],
  'Andhra Pradesh': [[515, 535]],
  Karnataka: [[560, 591]],
  'Tamil Nadu': [[600, 643]],
  Puducherry: [[533, 533], [605, 605], [607, 607], [609, 609], [673, 673]],
  Kerala: [[670, 695]],
  Lakshadweep: [[682, 682]],
  'West Bengal': [[700, 743]],
  Sikkim: [[737, 737]],
  'Andaman and Nicobar Islands': [[744, 744]],
  Odisha: [[751, 770]],
  Assam: [[781, 788]],
  'Arunachal Pradesh': [[790, 792]],
  Meghalaya: [[793, 794]],
  Manipur: [[795, 795]],
  Mizoram: [[796, 796]],
  Nagaland: [[797, 798]],
  Tripura: [[799, 799]],
  Bihar: [[800, 855]],
  Jharkhand: [[813, 816], [822, 822], [825, 835]],
};

/** False only when the state is known and none of its PIN ranges holds this PIN. */
export function pinFitsState(state: string, pin: string): boolean {
  const ranges = PIN_PREFIXES[state];
  if (!ranges || !/^[1-9]\d{5}$/.test(pin)) return true;
  const p = Number(pin.slice(0, 3));
  return ranges.some(([a, b]) => p >= a && p <= b);
}

/* ---------------------------------------------------------------- input */

export interface NocInput {
  /** Proposed name of the company as the NOC prints it, e.g. "Lotus Dental Private Limited". */
  companyName: string;
  /** Flat, door or building. */
  line1: string;
  /** Street or area. */
  line2: string;
  locality: string;
  city: string;
  district: string;
  state: string;
  pin: string;
  holding: NocHolding;
  /** ISO date of the rent agreement / lease deed (rented or leased). */
  agreementDate: string;
  billType: string;
  billDate: string;
  ownerTitle: string;
  ownerName: string;
  relation: string;
  relationName: string;
  /** The owner lives at the premises (their address is the office's). */
  ownerAtPremises: boolean;
  ownerAddress: string;
  ownerPan: string;
  ownerEmail: string;
  ownerPhone: string;
  /** ISO date the owner signs the NOC. */
  nocDate: string;
  place: string;
}

export function blankNocInput(companyName = '', today = ''): NocInput {
  return {
    companyName,
    line1: '',
    line2: '',
    locality: '',
    city: '',
    district: '',
    state: 'Telangana',
    pin: '',
    holding: 'rented',
    agreementDate: '',
    billType: NOC_BILLS[0],
    billDate: '',
    ownerTitle: 'Mr.',
    ownerName: '',
    relation: 'S/o',
    relationName: '',
    ownerAtPremises: false,
    ownerAddress: '',
    ownerPan: '',
    ownerEmail: '',
    ownerPhone: '',
    nocDate: today,
    place: '',
  };
}

const str = (v: unknown, max = 400): string => (typeof v === 'string' ? v.slice(0, max) : '');

/** Narrow anything (a stored jsonb, a request body) to a NocInput; unknown keys are dropped. */
export function coerceNocInput(raw: unknown): NocInput {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const holding = NOC_HOLDINGS.some((h) => h.value === o.holding) ? (o.holding as NocHolding) : 'rented';
  return {
    companyName: str(o.companyName, 240),
    line1: str(o.line1, 200),
    line2: str(o.line2, 200),
    locality: str(o.locality, 120),
    city: str(o.city, 120),
    district: str(o.district, 120),
    state: str(o.state, 80),
    pin: str(o.pin, 6),
    holding,
    agreementDate: str(o.agreementDate, 10),
    billType: (NOC_BILLS as readonly string[]).includes(str(o.billType)) ? str(o.billType) : NOC_BILLS[0],
    billDate: str(o.billDate, 10),
    ownerTitle: (NOC_TITLES as readonly string[]).includes(str(o.ownerTitle)) ? str(o.ownerTitle) : 'Mr.',
    ownerName: str(o.ownerName, 160),
    relation: NOC_RELATIONS.some((r) => r.value === o.relation) ? str(o.relation) : 'S/o',
    relationName: str(o.relationName, 160),
    ownerAtPremises: o.ownerAtPremises === true,
    ownerAddress: str(o.ownerAddress, 600),
    ownerPan: str(o.ownerPan, 10).toUpperCase(),
    ownerEmail: str(o.ownerEmail, 160),
    ownerPhone: str(o.ownerPhone, 24),
    nocDate: str(o.nocDate, 10),
    place: str(o.place, 120),
  };
}

/* ---------------------------------------------------------------- dates */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDay(v: string): boolean {
  return ISO.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

function ordinal(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'}`;
}

/** "29th October 2026" — how the NOC writes a date. */
export function nocLongDate(iso: string): string {
  if (!isIsoDay(iso)) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  return `${ordinal(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Whole days from `a` to `b` (ISO days). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/* ---------------------------------------------------------------- derived text */

const t = (v: string) => v.trim();

/** The premises: "Plot 42, 3rd Floor, Cyber Towers, HITEC City Main Road, Madhapur, Hyderabad, Telangana 500081". */
export function nocAddress(f: Pick<NocInput, 'line1' | 'line2' | 'locality' | 'city' | 'district' | 'state' | 'pin'>): string {
  const district = t(f.district) && t(f.district).toLowerCase() !== t(f.city).toLowerCase() ? t(f.district) : '';
  const tail = t(f.state) && t(f.pin) ? `${t(f.state)} ${t(f.pin)}` : t(f.state) || t(f.pin);
  return [t(f.line1), t(f.line2), t(f.locality), t(f.city), district, tail].filter(Boolean).join(', ');
}

export function nocOwnerAddress(f: NocInput): string {
  return f.ownerAtPremises ? nocAddress(f) : t(f.ownerAddress);
}

export function nocRoc(state: string): string {
  const city = ROC_CITY[state];
  return city ? `Registrar of Companies, ${city}` : `Registrar of Companies, ${t(state) || '[state]'}`;
}

export function nocOwnerFullName(f: Pick<NocInput, 'ownerTitle' | 'ownerName'>): string {
  return t(f.ownerName) ? `${f.ownerTitle} ${t(f.ownerName)}` : '';
}

/** "NOC-Lotus-Dental-Private-Limited.docx" */
export function nocFileName(companyName: string): string {
  const slug = companyName.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `NOC-${slug || 'company'}.docx`;
}

/* ---------------------------------------------------------------- the certificate */

/** One run of text; `miss` = a placeholder for a field that is still empty. */
export interface NocRun {
  t: string;
  miss?: boolean;
}

export interface NocModel {
  company: string;
  roc: string;
  date: NocRun;
  place: NocRun;
  signName: NocRun;
  subject: NocRun[];
  paras: NocRun[][];
  encl: string[];
}

function v(value: string, placeholder: string): NocRun {
  return t(value) ? { t: t(value) } : { t: `[${placeholder}]`, miss: true };
}

export function nocModel(f: NocInput): NocModel {
  const holding = NOC_HOLDINGS.find((h) => h.value === f.holding) ?? NOC_HOLDINGS[0];
  const company = t(f.companyName);
  const roc = nocRoc(f.state);
  const owner = nocOwnerFullName(f);
  const ownWord = f.holding === 'rented' ? 'owner and landlord' : f.holding === 'leased' ? 'owner and lessor' : 'sole and absolute owner';
  const paras: NocRun[][] = [
    [
      { t: 'I, ' },
      v(owner, "owner's name"),
      { t: `, ${f.relation} ` },
      v(f.relationName, "father's or husband's name"),
      { t: ', residing at ' },
      v(nocOwnerAddress(f), "owner's address"),
      { t: `, am the ${ownWord} of the premises situated at ` },
      v(nocAddress(f), 'address of the premises'),
      { t: ' (the "Premises").' },
    ],
    [
      { t: 'I hereby give my consent and have no objection to ' },
      v(company, 'proposed company name'),
      {
        t: ` (proposed company) using the Premises as its registered office, and to the address of the Premises being used for the incorporation of the company with the ${roc} and for its registrations with other government authorities.`,
      },
    ],
  ];
  if (f.holding === 'rented' || f.holding === 'leased') {
    paras.push([
      { t: `The Premises have been ${holding.verb} to the promoters of the proposed company under a ${f.holding === 'leased' ? 'lease deed' : 'rent agreement'} dated ` },
      v(nocLongDate(f.agreementDate), 'agreement date'),
      { t: '.' },
    ]);
  } else if (f.holding === 'director') {
    paras.push([{ t: 'I am also a proposed director of the company and the Premises are provided to the company without any consideration.' }]);
  } else {
    paras.push([{ t: 'The Premises are provided to the company free of rent, and I shall not claim any rent or consideration for their use as the registered office.' }]);
  }
  paras.push([
    { t: `A copy of the ${f.billType.toLowerCase()} of the Premises dated ` },
    v(nocLongDate(f.billDate), 'bill date'),
    { t: ', not older than two months, is enclosed as proof of address.' },
  ]);
  paras.push([{ t: 'This certificate is issued at the request of the promoters for the purpose of incorporation of the company and may be relied upon by the Registrar of Companies.' }]);
  return {
    company,
    roc,
    date: v(nocLongDate(f.nocDate), 'date'),
    place: v(f.place, 'place'),
    signName: v(owner, "owner's name"),
    subject: [{ t: 'Subject: No Objection Certificate for the use of the Premises as the registered office of ' }, v(company, 'proposed company name')],
    paras,
    encl: [
      `Copy of the ${f.billType.toLowerCase()}`,
      f.holding === 'rented' || f.holding === 'leased' ? `Copy of the ${f.holding === 'leased' ? 'lease deed' : 'rent agreement'}` : 'Copy of the property ownership document',
      t(f.ownerPan) ? "Self-attested copy of the owner's PAN" : "Self-attested copy of the owner's ID proof",
    ],
  };
}

export const runsText = (runs: NocRun[]): string => runs.map((r) => r.t).join('');

/* ---------------------------------------------------------------- rules */

export type NocField = keyof NocInput;
export interface NocWarning {
  title: string;
  detail: string;
}
export interface NocCheck {
  errors: Partial<Record<NocField, string>>;
  warnings: NocWarning[];
}

/** The NOC's fields per wizard step (a step blocks on these). */
export const NOC_STEP_FIELDS = {
  office: ['line1', 'line2', 'city', 'state', 'pin', 'agreementDate', 'billDate'],
  owner: ['ownerName', 'relationName', 'ownerAddress', 'ownerPan', 'ownerEmail', 'ownerPhone'],
  signing: ['companyName', 'nocDate', 'place'],
} as const satisfies Record<string, readonly NocField[]>;

/** Fields the certificate prints; the count of the empty ones is "n to fill". */
export const NOC_PRINTED_FIELDS: NocField[] = ['companyName', 'line1', 'line2', 'city', 'pin', 'agreementDate', 'billDate', 'ownerName', 'relationName', 'ownerAddress', 'nocDate', 'place'];

export function checkNoc(f: NocInput): NocCheck {
  const errors: NocCheck['errors'] = {};
  const warnings: NocWarning[] = [];
  const rentedOrLeased = f.holding === 'rented' || f.holding === 'leased';
  if (!t(f.companyName)) errors.companyName = 'Type the proposed name of the company';
  else if (t(f.companyName).length < 3) errors.companyName = 'The name is too short';
  if (!t(f.line1)) errors.line1 = 'Flat, door or building';
  if (!t(f.line2)) errors.line2 = 'Street or area';
  if (!t(f.city)) errors.city = 'City or town';
  if (!(NOC_STATES as readonly string[]).includes(f.state)) errors.state = 'Pick the state';
  if (!/^[1-9]\d{5}$/.test(t(f.pin))) errors.pin = 'A 6-digit PIN code';
  if (rentedOrLeased && !isIsoDay(f.agreementDate)) errors.agreementDate = `Date of the ${f.holding === 'leased' ? 'lease deed' : 'rent agreement'}`;
  if (!isIsoDay(f.billDate)) errors.billDate = 'Date on the bill';
  if (!t(f.ownerName)) errors.ownerName = 'Name as on the property papers';
  if (!t(f.relationName)) errors.relationName = "Father's or husband's name";
  if (!f.ownerAtPremises && !t(f.ownerAddress)) errors.ownerAddress = 'Where the owner lives';
  if (t(f.ownerPan) && !/^[A-Z]{5}\d{4}[A-Z]$/.test(t(f.ownerPan).toUpperCase())) errors.ownerPan = 'A PAN looks like ABCDE1234F';
  if (t(f.ownerEmail) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t(f.ownerEmail))) errors.ownerEmail = 'Type a valid email';
  if (t(f.ownerPhone) && !/^\+?[\d\s-]{10,15}$/.test(t(f.ownerPhone))) errors.ownerPhone = 'Type a 10-digit mobile number';
  if (!isIsoDay(f.nocDate)) errors.nocDate = 'Date of the NOC';
  if (!t(f.place)) errors.place = 'Where the owner signs';

  if (isIsoDay(f.billDate) && isIsoDay(f.nocDate)) {
    const age = daysBetween(f.billDate, f.nocDate);
    if (age > 60) warnings.push({ title: `The utility bill is ${age} days old`, detail: 'MCA accepts a bill not older than two months on the NOC date. Ask for a newer one.' });
    if (age < 0) warnings.push({ title: 'The bill is dated after the NOC', detail: 'Check both dates.' });
  }
  if (rentedOrLeased && isIsoDay(f.agreementDate) && isIsoDay(f.nocDate) && daysBetween(f.agreementDate, f.nocDate) < 0) {
    warnings.push({ title: `The ${f.holding === 'leased' ? 'lease deed' : 'agreement'} is dated after the NOC`, detail: 'The NOC refers to it, so it should come first.' });
  }
  if (/^[1-9]\d{5}$/.test(t(f.pin)) && f.state && !pinFitsState(f.state, t(f.pin))) {
    warnings.push({ title: `PIN ${t(f.pin)} is not in ${f.state}`, detail: 'The address prints exactly as typed on SPICe+ and INC-22.' });
  }
  return { errors, warnings };
}

/** How many printed fields are still empty or wrong ("3 to fill"). */
export function nocMissingCount(f: NocInput): number {
  const { errors } = checkNoc(f);
  return NOC_PRINTED_FIELDS.filter((k) => errors[k]).length;
}

/* ---------------------------------------------------------------- print view */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A4 print page (Times New Roman 12) — the browser's "Save as PDF" makes the PDF. */
export function nocPrintHtml(m: NocModel): string {
  const txt = (runs: NocRun[]) => esc(runsText(runs));
  return `<!doctype html><html><head><meta charset="utf-8"><title>NOC · ${esc(m.company || 'company')}</title><style>@page{size:A4;margin:22mm}body{font:12pt/1.6 "Times New Roman",Times,serif;color:#000;margin:0}.top{display:flex;justify-content:space-between;margin-bottom:28px}h1{text-align:center;font-size:15pt;text-decoration:underline;margin:0 0 4px}.st{text-align:center;font-size:10.5pt;margin-bottom:26px}p{margin:0 0 14px;text-align:justify}.sub{font-weight:bold}.sign{margin-top:60px}.line{width:220px;border-top:1px solid #000;margin-bottom:6px}.encl{margin-top:30px}ol{margin:4px 0 0 18px;padding:0}</style></head><body>
<div class="top"><span>Date: ${esc(m.date.t)}</span><span>Place: ${esc(m.place.t)}</span></div><h1>NO OBJECTION CERTIFICATE</h1><div class="st">(For use of premises as the registered office)</div>
<p>To,<br>The ${esc(m.roc)}<br>Ministry of Corporate Affairs</p><p class="sub">${txt(m.subject)}</p><p>Dear Sir or Madam,</p>${m.paras.map((p) => `<p>${txt(p)}</p>`).join('')}
<div class="sign"><div class="line"></div><b>${esc(m.signName.t)}</b><br>Owner of the Premises</div><div class="encl"><b>Enclosures:</b><ol>${m.encl.map((e) => `<li>${esc(e)}</li>`).join('')}</ol></div></body></html>`;
}
