// The prototype status model for the 48 incorporation steps, used by build.js (and mirrored by hand in the Home step cards).
// Before COI: Phase 1 done; Phase 2 in progress. 6 of 14 SPICe+ steps done = 43% (owner decision, DECISIONS.md 80ca693).
//   step 7 waits on you; 8 and 9 (yours) are in progress; 10 (KYC review & DSC) is with SBC, as the step-10 board shows.
// After COI: Phases 1 and 2 done; Phases 3 and 4 active (mirrors the after board counts).
module.exports = function model(STEPS) {
  const BEFORE = STEPS.map((x) => {
    if (x.n <= 6) return 'done';
    if (x.n === 7) return 'you';
    if (x.n === 8 || x.n === 9 || x.n === 10) return 'prog';
    return 'up';
  });
  const AFTER_PROG = [19, 20, 22, 23, 29, 33, 36];
  const AFTER_DONE = [];
  for (let n = 1; n <= 18; n++) AFTER_DONE.push(n);
  AFTER_DONE.push(21, 24, 25, 26, 27, 28, 31, 34);
  const AFTER = STEPS.map((x) => (AFTER_DONE.includes(x.n) ? 'done' : AFTER_PROG.includes(x.n) ? 'prog' : 'up'));
  return { BEFORE, AFTER };
};
