/**
 * REWRITE MARKER — was the localStorage persistence helper.
 *
 * In VCFO Suite, persisted state lives in Postgres via repositories, not the
 * browser. These functions remain ONLY to keep legacy imports compiling during
 * the port; replace each caller with a repository + TanStack Query hook, then
 * delete this file. See CLAUDE.md Phase 2.
 */
export function persist<T>(_key: string, _value: T): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[storage.persist] deprecated — move this state to a repository');
  }
}
export function debouncedPersist<T>(_key: string, _value: T, _delayMs = 300): void {}
export function read<T>(_key: string, fallback: T): T {
  return fallback;
}
