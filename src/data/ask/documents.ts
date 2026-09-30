/**
 * C2 "Explain this document": delivered-document field → topic slug.
 * Keys are the checklist field ids of `CLIENT_DELIVERABLE_FIELDS`
 * (src/lib/client-overview.ts). Only the document TYPE is looked up here —
 * a document's contents are never read or sent anywhere.
 */
export const DOCUMENT_TOPICS: Readonly<Record<string, string>> = {
  certificateOfIncorporationFinalUrl: 'doc-certificate-of-incorporation',
  panCardFinalUrl: 'doc-pan-card',
  tanCardFinalUrl: 'doc-tan-card',
  moaSubscriptionSheetSignedUrl: 'doc-moa',
  aoaSubscriptionSheetSignedUrl: 'doc-aoa',
  gstCertificateUrl: 'doc-gst-certificate',
  iecCertificateUrl: 'doc-iec-certificate',
};

/** Deliverable ids are `${stepId}:${fieldId}`; either form is accepted. */
export function documentTopicSlug(ref: string): string | null {
  const fieldId = ref.includes(':') ? ref.slice(ref.indexOf(':') + 1) : ref;
  return DOCUMENT_TOPICS[fieldId] ?? null;
}
