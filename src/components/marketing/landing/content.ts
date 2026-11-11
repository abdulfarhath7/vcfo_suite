// Copy for the public landing page, ported from the prototype (design/spectrum, src/screens/public/content.ts).
// The landing markup is word for word the old v6 landing (reference/vcfo-suite-v6.html), except "nudge" (K-17).
// Everything here is marketing copy, not client data.

/** The real routes behind the landing's links: the Auth.js sign-in page and the contact page (book a demo). */
export const SIGN_IN_HREF = "/login";

export const SWAP_WORDS = ["compliance", "incorporation", "registration"];

export type Series = "gst" | "it" | "mca" | "lab" | "rbi";
/** Every statutory date on the year ring. m = month index from April (0) to March (11). */
export function ringItems() {
  const items: { m: number; d: number; s: Series; t: string }[] = [];
  for (let m = 0; m < 12; m++) {
    items.push({ m, d: 11, s: "gst", t: "GSTR-1" }, { m, d: 20, s: "gst", t: "GSTR-3B" });
    items.push({ m, d: 7, s: "it", t: "TDS payment" });
    items.push({ m, d: 10, s: "lab", t: "Professional tax" }, { m, d: 15, s: "lab", t: "PF and ESI" });
  }
  (
    [
      [2, 15, "Advance tax Q1"],
      [5, 15, "Advance tax Q2"],
      [8, 15, "Advance tax Q3"],
      [11, 15, "Advance tax Q4"],
      [3, 31, "TDS return Q4"],
      [6, 31, "TDS return Q1"],
      [9, 31, "TDS return Q2"],
      [1, 31, "TDS return Q3"],
      [2, 15, "Form 16"],
      [6, 31, "Income tax return"],
    ] as const
  ).forEach(([m, d, t]) => items.push({ m, d, s: "it", t }));
  (
    [
      [0, 1, "MBP-1 and DIR-8"],
      [0, 30, "MSME-1"],
      [2, 30, "DPT-3"],
      [5, 30, "DIR-3 KYC"],
      [6, 30, "AOC-4"],
      [6, 31, "MSME-1"],
      [7, 29, "MGT-7"],
    ] as const
  ).forEach(([m, d, t]) => items.push({ m, d, s: "mca", t }));
  items.push({ m: 8, d: 31, s: "gst", t: "GSTR-9" });
  items.push({ m: 3, d: 15, s: "rbi", t: "FLA return" });
  return items;
}

/** Board C2: the comparison under "Every step has an owner, a date and a proof". */
export type Mark = "yes" | "no" | "part";
export const COMPARE_COLS = ["VCFO Suite", "Generic task tool", "Spreadsheets and email"] as const;
export const COMPARE: { label: string; vcfo: Mark; tool: Mark; sheet: Mark }[] = [
  { label: "Every incorporation step tracked, from name to certificate", vcfo: "yes", tool: "part", sheet: "no" },
  { label: "The client sees what waits on them, live", vcfo: "yes", tool: "no", sheet: "no" },
  { label: "MCA, GST, Income tax, Payroll, FEMA and Labour on one calendar", vcfo: "yes", tool: "no", sheet: "no" },
  { label: "Late filings flagged before the fees build up", vcfo: "yes", tool: "part", sheet: "no" },
  { label: "Each step has an owner, a date and a proof", vcfo: "yes", tool: "part", sheet: "no" },
  { label: "Firm and client read one record, with the same words", vcfo: "yes", tool: "no", sheet: "no" },
];

/** Quick answers for the fixed Ask VCFO panel. `sec` is the section the "Show me" button scrolls to. */
/**
 * LP-02: the answers describe the benefit, not the screens: no form names, step lists or portal
 * addresses, and no "Open the screen" link (`href` is kept in the type for the demo build only).
 */
export const GUIDE: { q: string; a: string; sec: string; href?: string; sales?: boolean }[] = [
  { q: "What does VCFO Suite cover?", a: "A company's whole first year and every year after: getting incorporated, getting registered, and staying compliant. Each piece of work has an owner, a due date and the document that proves it.", sec: "journey" },
  { q: "How does incorporation work?", a: "The client answers once, the firm prepares and files, and the regulator approves. Documents are generated from the answers, not retyped.", sec: "journey" },
  { q: "What does my client see?", a: "What is waiting on them, what the firm is doing, and when the next milestone is expected, in one place instead of an email thread.", sec: "record" },
  { q: "How do we stay on top of dates?", a: "Every statutory date sits on one calendar with a reminder before it is due. Email is the record; WhatsApp is the reminder.", sec: "record" },
  { q: "Where is the data hosted?", a: "On AWS in the Mumbai region, with encrypted storage. Access is scoped by role, so a client sees only their own companies.", sec: "trust" },
  { q: "Is it only for SBC?", a: "No. SBC built it and runs its own engagements on it. Your firm gets its own workspace with its own people, clients and calendar.", sec: "faq", sales: true },
];

export const GUIDE_HELLO = "Hello. Ask me what VCFO Suite does, or pick a question below. Every answer can show you where it sits on this page.";
