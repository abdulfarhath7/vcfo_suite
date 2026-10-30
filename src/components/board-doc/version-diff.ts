export interface ValueChange {
  key: string;
  label: string;
  before: string;
  after: string;
}

/** The values that changed between two versions, in the order of `labels`, then the rest by key. */
export function diffValues(from: Record<string, string>, to: Record<string, string>, labels: Record<string, string> = {}): ValueChange[] {
  const keys = [...new Set([...Object.keys(labels), ...Object.keys(from), ...Object.keys(to)])];
  const known = Object.keys(labels);
  keys.sort((a, b) => {
    const ia = known.indexOf(a);
    const ib = known.indexOf(b);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib);
    return a.localeCompare(b);
  });
  const out: ValueChange[] = [];
  for (const key of keys) {
    const before = (from[key] ?? '').trim();
    const after = (to[key] ?? '').trim();
    if (before !== after) out.push({ key, label: labels[key] ?? key, before, after });
  }
  return out;
}
