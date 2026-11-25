# Questions for the eMudhra tech team

SBC builds VCFO Suite, a compliance platform for company incorporation and recurring compliance.
We want people to sign documents inside VCFO Suite and to order and renew Class 3 DSCs from it.
The full plan is in `PLAN.md` beside this file. These are the questions we need answered.

## APIs and access

1. Which API do we get: the eSign gateway (ESP) directly, the emSigner workflow API, or both? Please share the REST specification.
2. How do we authenticate: API key, OAuth, mutual TLS or an IP allowlist? Our app runs on AWS App Runner in Mumbai (ap-south-1).
3. Can we have UAT (sandbox) credentials and test Aadhaar numbers? Is UAT free?

## Signing flow

4. Webhooks: which events do you send, what is the payload, how is it signed, and how do retries work? If there are no webhooks, what polling rate do you allow?
5. Input format: is it PDF only, or do you accept docx? What is the maximum file size? Can one OTP session sign several documents?
6. How do we place the signature: by page coordinates, or by anchor text in the document?
7. Do you return an audit-trail PDF and the signer's certificate details (serial, issuer, validity)?
8. Can the signer sign from a link we send by email or WhatsApp, without an eMudhra account?
9. Do you offer signature verification by API, or do you supply the CCA root certificates and OCSP/CRL endpoints so we can verify ourselves?

## DSC issuance

10. Is there a partner API to create a Class 3 DSC application, push the applicant's KYC data, send the video-verification link, read the status and renew?
11. Can SBC act as a Registration Authority (RA) or partner for this?
12. Token, cloud (HSM) or both? What does each cost?

## MCA and other portals

13. Does a PDF signed in emSigner pass MCA V3 upload validation? Is the PDF byte-preserved, so a signed MCA form is not changed?
14. Is a remote or HSM DSC accepted on MCA V3 today for SPICe+, AGILE-PRO-S, AOC-4, MGT-7 and DIR-3 KYC?
15. What is the flow for foreign nationals: foreign eSign and foreign DSC?

## Commercial and data

16. Partner pricing: per-eSign slabs, per-DSC price, emSigner platform fee, and the billing model (prepaid credits or monthly invoice).
17. Data residency and retention: where are documents and eKYC data stored, for how long, and can we request deletion?
18. Support and SLAs: uptime, support hours, escalation contact for production issues.
