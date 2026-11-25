import { asStringArray, parseIndianDate, str } from '@/lib/lookup/fields';
import type { NormalizedGstData, HsnItem } from './types';

// The field coercions live in src/lib/lookup/fields.ts, shared with the DIN lookup.
export { asStringArray, str };

export function extractHsn(v: unknown): HsnItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => {
    if (typeof item === 'string') return { code: '', description: item };
    const obj = item as Record<string, unknown>;
    return {
      code: str(obj.code ?? obj.hsn ?? obj.sacCode ?? ''),
      description: str(obj.description ?? obj.desc ?? obj.sacDesc ?? ''),
    };
  });
}

function assembleAddress(pradr: Record<string, unknown> | undefined): string {
  if (!pradr) return '';

  // GSTZen format: flat object with addr, addr1, addr2, city, district, pinc, state_in_address
  if (typeof pradr.addr === 'string' && pradr.addr) {
    return pradr.addr as string;
  }

  // GSTZen structured fields
  if (pradr.addr1 || pradr.city || pradr.pinc) {
    const parts = [
      pradr.addr1,
      pradr.addr2,
      pradr.city,
      pradr.district,
      pradr.state_in_address,
      pradr.pinc,
    ].filter(Boolean).map(String);
    return parts.join(', ');
  }

  // GSTN-native format: nested pradr.addr with flno/bno/bnm/st/loc/dst/stcd/pncd
  const addrFields = pradr.addr as Record<string, string> | undefined;
  if (addrFields && typeof addrFields === 'object') {
    const parts = [
      addrFields.flno,
      addrFields.bno,
      addrFields.bnm,
      addrFields.st,
      addrFields.loc,
      addrFields.dst,
      addrFields.stcd,
      addrFields.pncd,
    ].filter(Boolean);
    return parts.join(', ');
  }

  return '';
}

function extractAdditionalTradeNames(adadr: unknown): string[] {
  if (!Array.isArray(adadr)) return asStringArray(adadr);
  // GSTZen: adadr is an array of address objects, not trade names
  if (adadr.length > 0 && typeof adadr[0] === 'object' && adadr[0] !== null && 'addr' in adadr[0]) {
    return [];
  }
  return adadr.map(String);
}

function extractAdditionalAddresses(adadr: unknown): string[] {
  if (!Array.isArray(adadr)) return [];
  return adadr
    .filter((item) => typeof item === 'object' && item !== null && 'addr' in item)
    .map((item) => str((item as Record<string, unknown>).addr));
}

export function normalizeGstResponse(raw: Record<string, unknown>): NormalizedGstData {
  // GSTZen wraps in company_details; other providers use data/result or flat
  const data = (raw.company_details ?? raw.data ?? raw.result ?? raw) as Record<string, unknown>;
  const topGstin = str(raw.gstin ?? '');

  const pradr = data.pradr as Record<string, unknown> | undefined;
  let principalAddress = '';
  if (typeof data.principalAddress === 'string') {
    principalAddress = data.principalAddress;
  } else if (typeof data.principal_address === 'string') {
    principalAddress = data.principal_address;
  } else {
    principalAddress = assembleAddress(pradr);
  }

  const nba = asStringArray(data.nba ?? data.nature_of_business ?? data.coreActivity ?? []);
  const bzAct = asStringArray(data.bzAct ?? data.business_activities ?? data.businessActivities ?? []);

  const hsnInfo = data.hsnInfo as Record<string, unknown[]> | undefined;
  const hsnGoods = extractHsn(hsnInfo?.goods ?? data.hsnGoods ?? data.hsn_goods ?? []);
  const hsnServices = extractHsn(hsnInfo?.services ?? data.hsnServices ?? data.hsn_services ?? []);

  const rawRegDate = str(data.rgdt ?? data.registration_date ?? data.registrationDate ?? '');
  const rawLastUpdated = str(data.lstupddt ?? data.lstupdt ?? data.last_updated ?? data.lastUpdated ?? '');

  return {
    gstin: str(data.gstin ?? topGstin ?? data.gstNumber ?? ''),
    legalName: str(data.lgnm ?? data.legal_name ?? data.legalName ?? ''),
    tradeName: str(data.tradeNam ?? data.trade_name ?? data.tradeName ?? ''),
    registrationDate: parseIndianDate(rawRegDate),
    constitution: str(data.ctb ?? data.constitution ?? data.constitutionOfBusiness ?? ''),
    status: str(data.company_status ?? data.sts ?? data.status ?? ''),
    taxpayerType: str(data.gst_type ?? data.dty ?? data.taxpayer_type ?? data.taxpayerType ?? ''),
    centerJurisdiction: str(data.ctj ?? data.center_jurisdiction ?? data.centerJurisdiction ?? ''),
    stateJurisdiction: str(data.stj ?? data.state_jurisdiction ?? data.stateJurisdiction ?? ''),
    principalAddress,
    aadhaarAuthenticated: str(data.aadhaarAuthenticated ?? data.aadhaar_authenticated ?? data.isAadhaarVerified ?? ''),
    aadhaarDate: str(data.aadhaarDate ?? data.aadhaar_date ?? ''),
    ekycVerified: str(data.ekycVerified ?? data.ekyc_verified ?? data.isEkycVerified ?? ''),
    coreActivity: nba,
    businessActivities: bzAct.length > 0 ? bzAct : nba,
    hsnGoods,
    hsnServices,
    lastUpdated: parseIndianDate(rawLastUpdated),
    cancellationDate: str(data.cxdt ?? data.cancellation_date ?? data.cancellationDate ?? ''),
    additionalTradeNames: extractAdditionalTradeNames(data.adadr ?? data.additionalTradeNames ?? data.additional_trade_names ?? []),
    einvoiceStatus: str(data.einvoiceStatus ?? data.einvoice_status ?? ''),
  };
}
