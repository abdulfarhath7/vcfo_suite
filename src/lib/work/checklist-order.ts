/**
 * Personal checklist order (task drawer, G-16). The drawer sends the whole ordered id
 * list; these helpers build it and check it before the repository writes positions.
 */

/** Move one id up (-1) or down (+1) in the list; out-of-range moves return the list as is. */
export function moveInOrder(ids: readonly string[], id: string, direction: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

/** True when `next` holds exactly the ids in `current`, each once, in any order. */
export function isSameIdSet(current: readonly string[], next: readonly string[]): boolean {
  if (current.length !== next.length) return false;
  const want = new Set(current);
  const seen = new Set<string>();
  for (const id of next) {
    if (!want.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}
