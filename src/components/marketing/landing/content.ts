// Copy for the public landing page, ported from the prototype (design/spectrum, src/screens/public/content.ts).
// The landing markup is word for word the old v6 landing (reference/vcfo-suite-v6.html), except "nudge" (K-17).
// Everything here is marketing copy, not client data.

/** The real routes behind the landing's links: the Auth.js sign-in page and the contact page (book a demo). */
export const SIGN_IN_HREF = "/login";
export const DEMO_HREF = "/contact";

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

/** The twelve months of the year ring, April first. */
export const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"] as const;

/**
 * V5, the busy-weeks heat map beside the ring: for each month (April first) and each week of the month
 * (days 1-7, 8-14, 15-21, 22-28, 29-31), how many statutory dates on the ring fall in it.
 * It is counted from ringItems(), so it shows the statutory schedule, not sample client data.
 */
export function busyWeeks() {
  const grid = MONTHS.map(() => [0, 0, 0, 0, 0]);
  for (const it of ringItems()) grid[it.m][Math.min(4, Math.floor((it.d - 1) / 7))] += 1;
  return grid;
}

/**
 * The 16 steps of stages 1 and 2 (src/data/checklist.ts, pre-1 to pre-12), in checklist order, and the
 * flow-chart group each one lights up: s1 questionnaire, s2 board resolution, noc the NOC decision (V1),
 * s3 name reservation, s4 documents and DSC, s5 SPICe+ and the certificate.
 */
export const INC_STEPS: { t: string; g: "s1" | "s2" | "noc" | "s3" | "s4" | "s5" }[] = [
  { t: "Client details", g: "s1" },
  { t: "Draft board resolution", g: "s2" },
  { t: "Signed board resolution", g: "noc" },
  { t: "Name application", g: "s3" },
  { t: "Name approval", g: "s3" },
  { t: "Director KYC", g: "s4" },
  { t: "Capital structure", g: "s4" },
  { t: "Registered office address", g: "s4" },
  { t: "Proposed directors", g: "s4" },
  { t: "Subscriber details", g: "s4" },
  { t: "KYC review and DSC", g: "s4" },
  { t: "Document execution", g: "s4" },
  { t: "SPICe+ confirmation", g: "s5" },
  { t: "SPICe+ filing", g: "s5" },
  { t: "MCA remarks", g: "s5" },
  { t: "Certificate of Incorporation", g: "s5" },
];

/** V3, the regulator ribbon under the hero: the six regulators on the calendar, each with its data colour. */
export const REGULATORS: { name: string; c: string }[] = [
  { name: "MCA", c: "var(--lp-d5)" },
  { name: "GST", c: "var(--lp-d3)" },
  { name: "Income tax", c: "var(--lp-d1)" },
  { name: "Payroll", c: "var(--lp-info)" },
  { name: "FEMA", c: "var(--lp-d2)" },
  { name: "Labour", c: "var(--lp-d4)" },
];

/** D8: the one answer the Ask VCFO bubble on the portal screenshot types (the demo company's name application). */
export const ASK_Q = "Where is my incorporation now?";
export const ASK_A = "Your name application is with MCA. Expected 28 Oct.";

/** Board C2: the comparison table. */
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
/** `href` is the real portal screen an answer is about ("Open the screen", shown in demo mode only). */
export const GUIDE: { q: string; a: string; sec: string; href?: string; sales?: boolean }[] = [
  { q: "What does VCFO Suite cover?", a: "Four stages, then the yearly calendar: name and papers, incorporation, the first 180 days and registrations, then every statutory filing after. Each step carries an owner, a due date and the document that proves it.", sec: "incorporate", href: "/app/client/overview" },
  { q: "How does incorporation work?", a: "The client answers one questionnaire, the firm drafts and files, and MCA approves. The board resolution, MOA, AOA, DIR-2 and INC-9 are generated from the answers, not retyped.", sec: "incorporate", href: "/app/client/incorporation" },
  { q: "What happens after the certificate?", a: "Eleven steps start the day the certificate arrives, most with a statutory clock: the first board meeting and ADT-1 within 30 days, share certificates within 60, and INC-20A within 180.", sec: "after", href: "/app/client/incorporation" },
  { q: "Which registrations does it track?", a: "Twenty-three registrations and reportings across tax, labour, trade, RBI and intellectual property. Only the ones that apply to the company are switched on.", sec: "register", href: "/app/client/registrations" },
  { q: "What does the compliance calendar look like?", a: "Every statutory date of the financial year by regulator, each with a status word and a reminder before it is due. Email is the record; WhatsApp is the reminder.", sec: "comply", href: "/app/client/compliances" },
  { q: "What does my client see?", a: "What is waiting on them, what the firm holds, and when the certificate is expected. They upload, approve and ask from one screen instead of an email thread.", sec: "portals", href: "/app/client/overview" },
  { q: "What does the project lead see?", a: "Today's action queue across every company they run, this week's statutory filings, and who each step is waiting on.", sec: "portals", href: "/app/intern/today" },
  { q: "What does the manager see?", a: "Every task the team owns, filtered by project lead, company or status, and each lead's workload by area. A to-do goes to a project lead in one click.", sec: "portals", href: "/app/manager/dashboard" },
  { q: "What does the admin see?", a: "Every client with its stage, manager, who it is pending with and the next date; each manager's load and on-time rate; and where work is stuck. The admin assigns whole clients to managers.", sec: "portals", href: "/app/admin/dashboard" },
  { q: "What does the super admin see?", a: "The whole firm on one screen: every client, what each admin and manager is doing, incorporations, registrations and filings side by side, risks, team load, growth, and a monthly partner report.", sec: "portals", href: "/app/super/dashboard" },
  { q: "Where is the data hosted?", a: "On AWS in the Mumbai region, with encrypted storage. Access is scoped by role, so a client sees only their own companies.", sec: "trust" },
  { q: "Is it only for SBC?", a: "No. SBC built it and runs its own engagements on it. Your firm gets its own workspace with its own people, clients and calendar.", sec: "faq", sales: true },
];

export const GUIDE_HELLO = "Hello. Ask me what VCFO Suite does, or pick a question below. Every answer can show you where it sits on this page.";
