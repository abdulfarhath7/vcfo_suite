/**
 * MINUTES SAVED — AN ESTIMATE, NOT A MEASUREMENT.
 *
 * The Agent results page (MASTER-PLAN.md screen 11) shows how much staff time the card agents
 * save. Nobody timed the manual filings, so this table states, for each form, how many minutes a
 * staff member usually spends filling it by hand on the portal: opening the form, typing every
 * field from the client's records and checking it before the signatory signs. The numbers are
 * the firm's working estimates (25 Nov 2026) and should be replaced once real timings exist.
 *
 * The time with the agent is measured from each run (its start to its finish). The minutes saved
 * on one filing are the manual minutes below less the measured minutes, and never less than zero.
 * Every screen that shows a figure built from this table says that it is an estimate.
 */

export const MINUTES_SAVED_IS_ESTIMATE = true;

export const MINUTES_SAVED_NOTE =
  'Estimate: the manual minutes per form are the firm’s working figures, not timings. Time with the agent is measured from each run.';

/** Manual minutes per filing, by catalog task id (`src/lib/assist-agents/catalog.ts`). */
export const MANUAL_MINUTES: Readonly<Record<string, number>> = {
  // Incorporation (MCA V3). SPICe+ Part B carries the most fields of any form.
  'spice-a': 25,
  'spice-b': 90,
  'agile-pro-s': 30,
  emoa: 20,
  eaoa: 20,
  'inc-9': 15,
  // Post-incorporation.
  'inc-20a': 20,
  'adt-1': 20,
  // Registrations.
  'gst-reg-01': 75,
  udyam: 25,
  iec: 30,
  'shops-establishment': 40,
  pt: 30,
  lut: 20,
  'pf-registration': 45,
  'esi-registration': 40,
  // MCA annual filings.
  'dir-3-kyc': 15,
  'aoc-4': 60,
  'mgt-7': 60,
  'dpt-3': 30,
  'msme-1': 20,
  // GST returns through the GSP API.
  'gstr-1': 45,
  'gstr-3b': 55,
  'gstr-9': 120,
  'gstr-9c': 120,
  // Labour and tax.
  'pf-ecr': 30,
  'esic-return': 25,
  'challan-281': 15,
  'challan-280': 15,
};

/** Used for a task the table does not name yet. */
export const DEFAULT_MANUAL_MINUTES = 30;

export function manualMinutesFor(taskId: string): number {
  return MANUAL_MINUTES[taskId] ?? DEFAULT_MANUAL_MINUTES;
}
