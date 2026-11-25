export interface HsnItem {
  code: string;
  description: string;
}

export interface NormalizedGstData {
  gstin: string;
  legalName: string;
  tradeName: string;
  registrationDate: string;
  constitution: string;
  status: string;
  taxpayerType: string;
  centerJurisdiction: string;
  stateJurisdiction: string;
  principalAddress: string;
  aadhaarAuthenticated: string;
  aadhaarDate: string;
  ekycVerified: string;
  coreActivity: string[];
  businessActivities: string[];
  hsnGoods: HsnItem[];
  hsnServices: HsnItem[];
  lastUpdated: string;
  cancellationDate: string;
  additionalTradeNames: string[];
  einvoiceStatus: string;
}
