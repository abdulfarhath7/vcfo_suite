/**
 * Every topic file, imported statically so the bundle carries reviewed content
 * without a filesystem read at request time. Add new topics here.
 */
import afterIncorporation from './after-incorporation.json';
import capitalStructure from './capital-structure.json';
import directorKyc from './director-kyc.json';
import fcGpr from './fc-gpr.json';
import fillipLlpIncorporation from './fillip-llp-incorporation.json';
import gstBasics from './gst-basics.json';
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
];
