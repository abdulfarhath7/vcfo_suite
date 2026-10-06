/**
 * Every topic file, imported statically so the bundle carries reviewed content
 * without a filesystem read at request time. Add new topics here.
 */
import docCertificateOfIncorporation from './doc-certificate-of-incorporation.json';
import docPanCard from './doc-pan-card.json';
import docTanCard from './doc-tan-card.json';
import docMoa from './doc-moa.json';
import docAoa from './doc-aoa.json';
import docGstCertificate from './doc-gst-certificate.json';
import docIecCertificate from './doc-iec-certificate.json';
import afterIncorporation from './after-incorporation.json';
import capitalStructure from './capital-structure.json';
import directorKyc from './director-kyc.json';
import fcGpr from './fc-gpr.json';
import fillipLlpIncorporation from './fillip-llp-incorporation.json';
import gstBasics from './gst-basics.json';
import obligationGstGstr3b from './obligation-gst-gstr-3b.json';
import obligationGstGstr1 from './obligation-gst-gstr-1.json';
import obligationItTdsPayment from './obligation-it-tds-payment.json';
import obligationMcaAoc4 from './obligation-mca-aoc-4.json';
import obligationMcaMgt7 from './obligation-mca-mgt-7.json';
import obligationMcaDir3Kyc from './obligation-mca-dir3-kyc.json';
import obligationFemaFla from './obligation-fema-fla.json';
import obligationItAdvanceTaxQ1 from './obligation-it-advance-tax-q1.json';
import obligationItAdvanceTaxQ2 from './obligation-it-advance-tax-q2.json';
import obligationItAdvanceTaxQ3 from './obligation-it-advance-tax-q3.json';
import obligationItAdvanceTaxQ4 from './obligation-it-advance-tax-q4.json';
import obligationItTdsReturnQ1 from './obligation-it-tds-return-q1.json';
import obligationItTdsReturnQ2 from './obligation-it-tds-return-q2.json';
import obligationItTdsReturnQ3 from './obligation-it-tds-return-q3.json';
import obligationItTdsReturnQ4 from './obligation-it-tds-return-q4.json';
import obligationItItr from './obligation-it-itr.json';
import obligationItForm16 from './obligation-it-form-16.json';
import obligationGstGstr9 from './obligation-gst-gstr-9.json';
import obligationMcaDpt3 from './obligation-mca-dpt-3.json';
import obligationMcaMsme1Apr from './obligation-mca-msme-1-apr.json';
import obligationMcaMsme1Oct from './obligation-mca-msme-1-oct.json';
import registeredOffice from './registered-office.json';
import signedBoardResolution from './signed-board-resolution.json';
import spicePlusConfirmation from './spice-plus-confirmation.json';
import spicePlusPartA from './spice-plus-part-a.json';
import subscribers from './subscribers.json';

/** Raw, unvalidated topic files — `src/lib/ask/topics.ts` parses them. */
export const RAW_TOPICS: readonly unknown[] = [
  spicePlusPartA,
  fillipLlpIncorporation,
  gstBasics,
  afterIncorporation,
  fcGpr,
  directorKyc,
  signedBoardResolution,
  capitalStructure,
  registeredOffice,
  subscribers,
  spicePlusConfirmation,
  // C2: one topic per delivered document type.
  docCertificateOfIncorporation,
  docPanCard,
  docTanCard,
  docMoa,
  docAoa,
  docGstCertificate,
  docIecCertificate,
  // C5: one topic per compliance obligation (`obligation-<compliance_obligations.id>`).
  obligationGstGstr3b,
  obligationGstGstr1,
  obligationItTdsPayment,
  obligationMcaAoc4,
  obligationMcaMgt7,
  obligationMcaDir3Kyc,
  obligationFemaFla,
  obligationItAdvanceTaxQ1,
  obligationItAdvanceTaxQ2,
  obligationItAdvanceTaxQ3,
  obligationItAdvanceTaxQ4,
  obligationItTdsReturnQ1,
  obligationItTdsReturnQ2,
  obligationItTdsReturnQ3,
  obligationItTdsReturnQ4,
  obligationItItr,
  obligationItForm16,
  obligationGstGstr9,
  obligationMcaDpt3,
  obligationMcaMsme1Apr,
  obligationMcaMsme1Oct,
];
