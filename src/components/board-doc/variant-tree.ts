import type { NocAnswers } from '@/lib/noc/receive';
import { nocEvidence, type NocOutcome, type NocPathNode } from './noc-doc';

/*
 * The decision tree of the board resolution (NOC), rule R-52 C8 and D5: the drawn nodes and the
 * lit path. The path comes from `nocEvidence()`, which is built on `resolveNocVariant()`, so the
 * lit result is always the variant the project answers pick.
 */

/** Nodes of the drawn tree. Every node is drawn; the chosen path lights up. */
export type NocNodeId =
  | 'own'
  | 'standalone'
  | 'no-noc'
  | 'subsidiary'
  | 'foreign'
  | 'noc-foreign'
  | 'indian'
  | 'name-use'
  | 'investing'
  | 'not-chosen'
  | 'noc-name-use'
  | 'noc-investing'
  | 'no-noc-yet';

const NODE_OF: Record<NocPathNode, NocNodeId> = {
  standalone: 'standalone',
  subsidiary: 'subsidiary',
  foreign: 'foreign',
  indian: 'indian',
  'name-only': 'name-use',
  investing: 'investing',
  'not-chosen': 'not-chosen',
};
const RESULT_OF: Record<NocOutcome, NocNodeId | null> = {
  standalone: 'no-noc',
  foreign: 'noc-foreign',
  'indian-name-only': 'noc-name-use',
  'indian-investing': 'noc-investing',
  'indian-not-chosen': 'no-noc-yet',
  incomplete: null,
};

/**
 * The lit path for the project answers: the root, the decisions from the shared `nocEvidence()`
 * (built on `resolveNocVariant()`), then the result. Badges 1, 2, 3 sit on the decisions.
 */
export function treePath(answers: NocAnswers): { nodes: NocNodeId[]; badges: NocNodeId[]; result: NocNodeId | null; ev: ReturnType<typeof nocEvidence> } {
  const ev = nocEvidence(answers);
  const badges = ev.path.map((p) => NODE_OF[p]);
  const result = RESULT_OF[ev.outcome];
  return { nodes: ['own', ...badges, ...(result ? [result] : [])], badges, result, ev };
}
