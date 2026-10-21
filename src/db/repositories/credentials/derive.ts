import 'server-only';
import type { AuthContext } from '@/auth/guards';
import {
  checklistStateForViewer,
  checklistStateFromRow,
  type EngagementDbRow,
} from '@/db/repositories/engagements';
import { getActiveCatalogItems } from '@/data/checklist';
import { CLIENT_RESPONSE_FIELDS, extractItemResponses } from '@/lib/checklist/checklist-responses';
import { isRepeatField, repeatEntries } from '@/lib/checklist/checklist-repeat';
import { identifiersFromState } from '@/lib/client/client-overview';
import { LOGIN_ROWS, type CredSheet, type CredSource } from '@/lib/client-portal/credentials';

/* ------------------------------------------------------------------ */
/* auto-fill from checklist responses                                  */
/* ------------------------------------------------------------------ */

type AutoCell = { v: string; src: CredSource; doc?: string };
type AutoMap = Map<string, AutoCell>; // `${sheet}|${row}|${col}`

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(v: string | undefined): string | undefined {
  const s = v?.trim();
  if (!s) return undefined;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  return `${m[3]} ${MON[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}
function fileName(path: string): string {
  const seg = path.split('/').pop() ?? path;
  const dash = seg.indexOf('-');
  return dash > 0 && /^\d+$/.test(seg.slice(0, dash)) ? seg.slice(dash + 1) : seg;
}

export interface Derived {
  auto: AutoMap;
  ids: { cin?: string; pan?: string; tan?: string; gstin?: string };
  registeredAddress: string | null;
  directors: Array<{ key: string; name: string }>;
}

export function derive(ctx: AuthContext, row: EngagementDbRow): Derived {
  const state = checklistStateForViewer(ctx, checklistStateFromRow(row)) as Record<string, unknown>;
  const items = getActiveCatalogItems();
  const resp = (id: string): Record<string, string> => {
    const item = items.find((i) => i.id === id);
    if (!item) return {};
    return extractItemResponses(item, (state[id] ?? null) as never);
  };
  const pick = (r: Record<string, string>, k: string) => r[k]?.trim() || undefined;
  const auto: AutoMap = new Map();
  const set = (sheet: CredSheet, rowKey: string, col: string, v: string | undefined, src: CredSource, doc?: string) => {
    if (v) auto.set(`${sheet}|${rowKey}|${col}`, { v, src, ...(doc ? { doc } : {}) });
  };

  const idf = identifiersFromState(state as never);
  const pre1 = resp('pre-1');
  const pre14 = resp('pre-14');
  const r1 = resp('reg-1');
  const r2 = resp('reg-2');
  const r3 = resp('reg-3');
  const r4 = resp('reg-4');
  const r5 = resp('reg-5');
  const r6 = resp('reg-6');
  const r7 = resp('reg-7');
  const r8 = resp('reg-8');
  const r13 = resp('reg-13');
  const r14 = resp('reg-14');
  const r15 = resp('reg-15');

  const cin = idf.cin;
  const pan = idf.pan ?? pick(r2, 'panNumber');
  const tan = idf.tan ?? pick(r2, 'tanNumber');
  const gstin = pick(r4, 'gstinNumber');
  const mail = pick(pre1, 'companyMailId');
  const mobNum = pick(pre1, 'companyMobileNumber');
  const mobile = mobNum ? [pick(pre1, 'companyMobileCountryCode'), mobNum].filter(Boolean).join(' ') : undefined;
  const regAddr = pick(pre14, 'registeredOfficeCompleteAddress') ?? (row.subsidiaryRegisteredAddress?.trim() || undefined);

  /* Login Credentials */
  const companySrc = (k: string, v: string | undefined) => set('login', k, 'id', v, idf[k === 'cin' ? 'cin' : k === 'pan' ? 'pan' : 'tan'] ? 'company record' : 'registration steps');
  companySrc('cin', cin);
  companySrc('pan', pan);
  companySrc('tan-traces', tan);
  companySrc('tan-it', tan);
  companySrc('traces', tan);
  set('login', 'esi', 'id', pick(r3, 'esiRegistrationNumber') ?? idf.esiCode, 'registration steps');
  set('login', 'pf', 'id', pick(r1, 'pfRegistrationNumber') ?? idf.pfCode, 'registration steps');
  set('login', 'gst', 'id', gstin, 'registration steps');
  set('login', 'gst-einvoice', 'id', gstin, 'registration steps');
  set('login', 'lut', 'id', pick(r4, 'lutArn') ?? pick(r5, 'lutArn'), 'registration steps');
  set('login', 'pt', 'id', pick(r7, 'ptRegistrationNumberCompany'), 'registration steps');
  set('login', 'iec', 'id', pick(r8, 'iecCode'), 'registration steps');
  set('login', 'mail', 'id', mail, 'client profile');
  set('login', 'address', 'id', regAddr, 'registered office');
  for (const r of LOGIN_ROWS) {
    if (!r) continue;
    set('login', r[0], 'mail', mail, 'client profile');
    set('login', r[0], 'mobile', mobile, 'client profile');
  }

  /* Registrations */
  const reg = (k: string, num?: string, date?: string, cert?: string) => {
    set('reg', k, 'number', num, 'registration steps');
    set('reg', k, 'date', fmtDate(date), 'registration steps');
    if (cert && !/^https?:/i.test(cert)) set('reg', k, 'cert', fileName(cert), 'registration steps', cert);
  };
  reg('gst', gstin, pick(r4, 'gstRegistrationDate'), pick(r4, 'gstCertificateUrl'));
  reg('pf', pick(r1, 'pfRegistrationNumber'), pick(r1, 'pfRegistrationDate'));
  reg('esi', pick(r3, 'esiRegistrationNumber'), pick(r3, 'esiRegistrationDate'));
  reg('pt', pick(r7, 'ptRegistrationNumberCompany'), pick(r7, 'ptRegistrationDate'));
  reg('lei', pick(r6, 'leiNumber'), pick(r6, 'leiRegistrationDate'));
  reg('msme', pick(r15, 'msmeUdyamNumber'), pick(r15, 'msmeRegistrationDate'));
  reg('iec', pick(r8, 'iecCode'), pick(r8, 'iecRegistrationDate'), pick(r8, 'iecCertificateUrl'));
  reg('lut', pick(r4, 'lutArn') ?? pick(r5, 'lutArn'), pick(r4, 'lutFilingDate') ?? pick(r5, 'lutFilingDate'));
  reg('clra', pick(r13, 'clraRegistrationNumber'));
  reg('posh', pick(r14, 'poshSheBoxId'));

  /* Address: the registered office is one free-text line in step 7, so only
     State, PIN and Country can be filled without guessing (QUESTIONS.md). */
  const pinMatch = regAddr?.match(/\b\d{6}\b/)?.[0] ?? (regAddr?.match(/\b\d{3}\s\d{3}\b/)?.[0]?.replace(/\s/, ''));
  for (const k of ['registered', 'communication']) {
    set('address', k, 'state', pick(pre14, 'registeredOfficeState'), 'registered office');
    set('address', k, 'pin', pinMatch, 'registered office');
    set('address', k, 'country', regAddr ? 'India' : undefined, 'registered office');
    set('address', k, 'phone', mobile, 'client profile');
  }
  const noc = pick(pre14, 'registeredOfficeNocUrl');
  if (noc && !/^https?:/i.test(noc)) set('address', 'registered', 'noc', fileName(noc), 'registered office', noc);
  const ub = pick(pre14, 'registeredOfficeUtilityBillCopyUrl');
  if (ub && !/^https?:/i.test(ub)) set('address', 'registered', 'utility', fileName(ub), 'registered office', ub);

  /* Directors KYC (step pre-15 · Proposed directors) */
  const directors: Derived['directors'] = [];
  const pre15 = resp('pre-15');
  const group = (CLIENT_RESPONSE_FIELDS['pre-15'] ?? []).find((f) => f.id === 'directors');
  if (group && isRepeatField(group)) {
    for (const e of repeatEntries(pre15, group)) {
      const v = (k: string) => e.values[k]?.trim() || undefined;
      const key = `director:pre15:${e.id}`;
      const full = [v('firstName'), v('middleName'), v('lastName')].filter(Boolean).join(' ');
      directors.push({ key, name: full || `Director ${e.index}` });
      const s = (p: string, val: string | undefined) => set('kyc', p, key, val, 'incorporation steps');
      s('din', v('din'));
      s('full', full || undefined);
      s('first', v('firstName'));
      s('middle', v('middleName'));
      s('last', v('lastName'));
      s('dob', fmtDate(v('dob')));
      s('father', v('fatherName'));
      s('address', v('utilityBillAddress'));
      s('mobile', v('mobileNumber'));
      s('mail', v('personalMailId') ?? v('officialMailId'));
      s('passport', v('passportNumber'));
      s('aadhaar', v('aadhaarNumber'));
      s('dl', v('drivingLicenceNumber'));
      s('pan', v('panNumber'));
      s('edu', v('highestEducationalQualification'));
      const res = v('indiaResident');
      s('category', res === 'yes' ? 'Resident Indian' : res === 'no' ? 'Foreign national' : undefined);
    }
  }

  return { auto, ids: { cin, pan, tan, gstin }, registeredAddress: regAddr ?? null, directors };
}
