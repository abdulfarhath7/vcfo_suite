import { XMLParser } from 'fast-xml-parser';
import { assertReadOnlyRequest } from './guard';
import { fromTallyDate, splitByMonth, toTallyDate } from './months';

export type JobType = 'sales' | 'receipts';

export type Direction = 'debit' | 'credit';
export type BillType = 'New Ref' | 'Agst Ref' | 'Advance' | 'On Account';

export interface Bill {
  name: string;
  /** Positive INR (the fixed contract). The side is in `direction`. */
  amount: number;
  /** Optional contract field: the side of this allocation (debit raises the party's balance). */
  direction?: Direction;
  billType?: BillType;
  /** Tally's credit period as written, for example "30 Days". */
  creditPeriod?: string;
}

export interface Voucher {
  guid: string;
  voucherType: string;
  voucherNo: string;
  date: string;
  partyName: string;
  gstin: string | null;
  /** Positive INR (the fixed contract). The side is in `direction`. */
  amount: number;
  /**
   * Optional contract field: the side of the party ledger entry. A normal Sales voucher debits
   * the party (receivable up), a normal Receipt credits it (receivable down).
   */
  direction?: Direction;
  bills?: Bill[];
}

export class TallyError extends Error {}

export const tallyUnreachableMessage = (port: number) =>
  `TallyPrime is not open, or its server is off (F1 > Settings > Connectivity, port ${port})`;

/* ------------------------------------------------------------------ requests */

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** TDL formula that keeps vouchers whose voucher type has Sales or Receipt as its parent type. */
const TYPE_FILTER: Record<JobType, string> = {
  sales: '$$IsSales:$VoucherTypeName',
  receipts: '$$IsReceipt:$VoucherTypeName',
};

export function buildVoucherRequest(type: JobType, from: string, to: string, company?: string): string {
  const companyVar = company ? `<SVCURRENTCOMPANY>${escapeXml(company)}</SVCURRENTCOMPANY>` : '';
  return `<ENVELOPE>
 <HEADER>
  <VERSION>1</VERSION>
  <TALLYREQUEST>Export</TALLYREQUEST>
  <TYPE>Collection</TYPE>
  <ID>VCFOVouchers</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
    <SVFROMDATE TYPE="Date">${toTallyDate(from)}</SVFROMDATE>
    <SVTODATE TYPE="Date">${toTallyDate(to)}</SVTODATE>
    ${companyVar}
   </STATICVARIABLES>
   <TDL>
    <TDLMESSAGE>
     <COLLECTION NAME="VCFOVouchers" ISMODIFY="No">
      <TYPE>Voucher</TYPE>
      <FETCH>GUID, VOUCHERTYPENAME, VOUCHERNUMBER, DATE, PARTYLEDGERNAME, PARTYGSTIN, AMOUNT, ISCANCELLED, ISOPTIONAL</FETCH>
      <FETCH>ALLLEDGERENTRIES.LIST.LEDGERNAME, ALLLEDGERENTRIES.LIST.AMOUNT, ALLLEDGERENTRIES.LIST.ISDEEMEDPOSITIVE</FETCH>
      <FETCH>ALLLEDGERENTRIES.LIST.BILLALLOCATIONS.LIST.NAME, ALLLEDGERENTRIES.LIST.BILLALLOCATIONS.LIST.AMOUNT, ALLLEDGERENTRIES.LIST.BILLALLOCATIONS.LIST.BILLTYPE, ALLLEDGERENTRIES.LIST.BILLALLOCATIONS.LIST.BILLCREDITPERIOD</FETCH>
      <FILTER>VCFOTypeFilter</FILTER>
     </COLLECTION>
     <SYSTEM TYPE="Formulae" NAME="VCFOTypeFilter">${TYPE_FILTER[type]}</SYSTEM>
    </TDLMESSAGE>
   </TDL>
  </DESC>
 </BODY>
</ENVELOPE>`;
}

/** Reads the company that is open in TallyPrime (falls back to the first loaded company). */
export function buildCompanyRequest(): string {
  return `<ENVELOPE>
 <HEADER>
  <VERSION>1</VERSION>
  <TALLYREQUEST>Export</TALLYREQUEST>
  <TYPE>Collection</TYPE>
  <ID>VCFOCompanies</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
   </STATICVARIABLES>
   <TDL>
    <TDLMESSAGE>
     <COLLECTION NAME="VCFOCompanies" ISMODIFY="No">
      <TYPE>Company</TYPE>
      <FETCH>NAME</FETCH>
      <COMPUTE>VCFOIsCurrent: $Name = ##SVCurrentCompany</COMPUTE>
     </COLLECTION>
    </TDLMESSAGE>
   </TDL>
  </DESC>
 </BODY>
</ENVELOPE>`;
}

/* ------------------------------------------------------------------ transport */

function isConnRefused(e: unknown): boolean {
  let cur: any = e;
  for (let i = 0; cur && i < 5; i++) {
    if (cur.code === 'ECONNREFUSED' || cur.code === 'ECONNRESET' || cur.code === 'EHOSTUNREACH') return true;
    if (Array.isArray(cur.errors) && cur.errors.some(isConnRefused)) return true;
    cur = cur.cause;
  }
  return false;
}

function decode(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le');
  // Tally sometimes answers in UTF-16LE without a BOM: every second byte of "<E" is 0.
  if (buf.length > 3 && buf[1] === 0 && buf[3] === 0) return buf.toString('utf16le');
  return buf.toString('utf8').replace(/^﻿/, '');
}

/** Sends one read-only XML request to Tally and returns the response text. */
export async function postToTally(port: number, xml: string, timeoutMs = 120_000): Promise<string> {
  assertReadOnlyRequest(xml);
  let res: Response;
  try {
    // 127.0.0.1, not localhost: on Windows "localhost" can resolve to ::1 and Tally listens on IPv4 only.
    res = await fetch(`http://127.0.0.1:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      body: xml,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (isConnRefused(e)) throw new TallyError(tallyUnreachableMessage(port));
    if ((e as Error)?.name === 'TimeoutError') throw new TallyError('TallyPrime did not answer in time. It may be busy; try again.');
    throw new TallyError(`Could not reach TallyPrime: ${(e as Error)?.message ?? e}`);
  }
  if (!res.ok) throw new TallyError(`TallyPrime answered with HTTP ${res.status}.`);
  return decode(Buffer.from(await res.arrayBuffer()));
}

/* ------------------------------------------------------------------ parsing */

function isValidXmlCodePoint(n: number): boolean {
  return (
    n === 0x9 || n === 0xa || n === 0xd ||
    (n >= 0x20 && n <= 0xd7ff) || (n >= 0xe000 && n <= 0xfffd) || (n >= 0x10000 && n <= 0x10ffff)
  );
}

/** Removes characters XML 1.0 forbids, both raw and as references such as &#4; that Tally emits. */
export function sanitizeTallyXml(xml: string): string {
  return xml
    .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (m, code: string) => {
      const n = code[0] === 'x' || code[0] === 'X' ? parseInt(code.slice(1), 16) : parseInt(code, 10);
      return isValidXmlCodePoint(n) ? m : '';
    })
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
}

const ARRAY_TAGS = new Set(['VOUCHER', 'COMPANY', 'ALLLEDGERENTRIES.LIST', 'LEDGERENTRIES.LIST', 'BILLALLOCATIONS.LIST']);

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => ARRAY_TAGS.has(name),
});

function parse(xml: string): any {
  const clean = sanitizeTallyXml(xml);
  const lineError = /<LINEERROR>([\s\S]*?)<\/LINEERROR>/i.exec(clean);
  if (lineError) throw new TallyError(`TallyPrime refused the request: ${lineError[1].trim()}`);
  try {
    return parser.parse(clean);
  } catch (e) {
    throw new TallyError(`Could not read TallyPrime's answer: ${(e as Error).message}`);
  }
}

/** Collects every node stored under `key`, wherever it sits in the tree. */
function findAll(node: any, key: string, out: any[] = []): any[] {
  if (!node || typeof node !== 'object') return out;
  for (const [k, v] of Object.entries(node)) {
    if (k === key) out.push(...(Array.isArray(v) ? v : [v]));
    else if (typeof v === 'object') findAll(v, key, out);
  }
  return out;
}

const text = (v: unknown): string => {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v).trim();
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === 'object' && '#text' in (v as any)) return text((v as any)['#text']);
  return '';
};

/*
 * Sign rule, after https://github.com/dhananjay1405/tally-database-loader (MIT License; the
 * copyright notice is in that project's LICENSE file). Its src/tally.mts sets an amount field as
 * `if $$IsDebit:$Amount then -$$NumValue:$Amount else $$NumValue:$Amount` with "(-)" replaced
 * by "-", and its tally-export-config.yaml reads BillType and BillCreditPeriod from the bill
 * allocations. In Tally's XML a debit is written as a negative number and a credit as a positive
 * one, and formatted strings mark a negative as "(-)".
 * So: negative = debit, positive = credit.
 */

/**
 * Reads a Tally amount such as "-1180.00", "1,18,000.00", "(-)500.00" or "-100.00 USD @ ...".
 * Returns the signed rupee value (debit negative, credit positive), or null when there is none.
 */
export function parseAmount(v: unknown): number | null {
  const s = text(v).replace(/,/g, '').replace(/\(-\)\s*/g, '-');
  const m = /-?\s*\d+(?:\.\d+)?/.exec(s);
  if (!m) return null;
  const n = parseFloat(m[0].replace(/\s+/g, ''));
  return n === 0 ? 0 : Math.round(n * 100) / 100;
}

/** The side of a signed amount; null for zero. `deemedPositive` (ISDEEMEDPOSITIVE "Yes" = debit) breaks the tie. */
export function directionOf(signed: number | null, deemedPositive?: unknown): Direction | undefined {
  if (signed != null && signed < 0) return 'debit';
  if (signed != null && signed > 0) return 'credit';
  const d = text(deemedPositive).toLowerCase();
  if (d === 'yes') return 'debit';
  if (d === 'no') return 'credit';
  return undefined;
}

const BILL_TYPES: Record<string, BillType> = {
  'new ref': 'New Ref',
  'agst ref': 'Agst Ref',
  'against ref': 'Agst Ref',
  advance: 'Advance',
  'on account': 'On Account',
};

function billTypeOf(v: unknown): BillType | undefined {
  return BILL_TYPES[text(v).toLowerCase().replace(/\s+/g, ' ')];
}

const yes = (v: unknown) => text(v).toLowerCase() === 'yes';

function ledgerEntries(v: any): any[] {
  return [...(v['ALLLEDGERENTRIES.LIST'] ?? []), ...(v['LEDGERENTRIES.LIST'] ?? [])];
}

function toBills(entry: any): Bill[] {
  const bills: Bill[] = [];
  for (const b of entry?.['BILLALLOCATIONS.LIST'] ?? []) {
    const name = text(b.NAME);
    const signed = parseAmount(b.AMOUNT);
    const billType = billTypeOf(b.BILLTYPE);
    // An on-account or advance allocation often has no name; keep it so VCFO can say why it is skipped.
    if (signed === null || (!name && billType !== 'On Account' && billType !== 'Advance')) continue;
    const bill: Bill = { name, amount: Math.abs(signed) };
    const direction = directionOf(signed);
    if (direction) bill.direction = direction;
    if (billType) bill.billType = billType;
    const creditPeriod = text(b.BILLCREDITPERIOD);
    if (creditPeriod) bill.creditPeriod = creditPeriod.slice(0, 40);
    bills.push(bill);
  }
  return bills;
}

/** Maps a Tally voucher collection export to Voucher objects. Cancelled and optional vouchers are skipped. */
export function mapVouchers(xml: string, range?: { from: string; to: string }): Voucher[] {
  const out: Voucher[] = [];
  for (const v of findAll(parse(xml), 'VOUCHER')) {
    if (yes(v.ISCANCELLED) || yes(v.ISOPTIONAL)) continue;
    const guid = text(v.GUID);
    const date = fromTallyDate(text(v.DATE));
    if (!guid || !date) continue;
    if (range && (date < range.from || date > range.to)) continue;

    const partyName = text(v.PARTYLEDGERNAME);
    const entries = ledgerEntries(v);
    const partyEntry = entries.find((e) => partyName && text(e.LEDGERNAME) === partyName);
    const partySigned = partyEntry ? parseAmount(partyEntry.AMOUNT) : null;
    const amount = Math.abs(partySigned ?? parseAmount(v.AMOUNT) ?? 0);
    // The side is read only from the party's own entry; the voucher-level AMOUNT has no fixed side.
    const direction = partyEntry ? directionOf(partySigned, partyEntry.ISDEEMEDPOSITIVE) : undefined;
    const bills = partyEntry ? toBills(partyEntry) : entries.flatMap(toBills);

    const voucher: Voucher = {
      guid,
      voucherType: text(v.VOUCHERTYPENAME),
      voucherNo: text(v.VOUCHERNUMBER),
      date,
      partyName,
      gstin: text(v.PARTYGSTIN) || null,
      amount,
    };
    if (direction) voucher.direction = direction;
    if (bills.length) voucher.bills = bills;
    out.push(voucher);
  }
  return out;
}

/** Picks the open company from the company collection export. */
export function mapCompanyName(xml: string): string | null {
  const companies = findAll(parse(xml), 'COMPANY');
  const current = companies.find((c) => yes(c.VCFOISCURRENT)) ?? companies[0];
  return current ? text(current.NAME) || null : null;
}

/* ------------------------------------------------------------------ high level */

export async function readCompanyName(port: number): Promise<string | null> {
  return mapCompanyName(await postToTally(port, buildCompanyRequest(), 30_000));
}

/** Fetches vouchers month by month and removes duplicates by GUID. */
export async function fetchVouchers(
  port: number,
  type: JobType,
  from: string,
  to: string,
  company?: string,
  onMonth?: (range: { from: string; to: string }, count: number) => void,
): Promise<Voucher[]> {
  const seen = new Map<string, Voucher>();
  for (const range of splitByMonth(from, to)) {
    const xml = await postToTally(port, buildVoucherRequest(type, range.from, range.to, company));
    const vouchers = mapVouchers(xml, range);
    for (const v of vouchers) seen.set(v.guid, v);
    onMonth?.(range, vouchers.length);
  }
  return [...seen.values()];
}
