/** DOM id for a statutory agenda day group — calendar clicks scroll here. */
export function statutoryAgendaId(isoDate: string): string {
  return `statutory-agenda-${isoDate}`;
}

/** Select-all is on when no category is muted. */
export function isSelectAllActive(mutedActs: ReadonlySet<unknown>): boolean {
  return mutedActs.size === 0;
}

export function toggleMutedAct<T>(muted: Iterable<T>, act: T): Set<T> {
  const next = new Set(muted);
  if (next.has(act)) next.delete(act);
  else next.add(act);
  return next;
}

/** Empty muted set = every category included. */
export function selectAllActs<T>(): Set<T> {
  return new Set();
}

/** Mute every category so the calendar shows no deadlines. */
export function muteAllActs<T>(acts: Iterable<T>): Set<T> {
  return new Set(acts);
}

export function dateHasAgendaItems(
  isoDate: string,
  byDate: ReadonlyMap<string, readonly unknown[]>,
): boolean {
  const items = byDate.get(isoDate);
  return Boolean(items && items.length > 0);
}
