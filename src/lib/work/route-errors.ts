/**
 * HTTP status for an error thrown by a work repository. Repositories throw short
 * codes: `forbidden`, `invalid_*`, `request_pending`, `request_closed`; anything else
 * is a server error.
 */
export function workErrorStatus(message: string): number {
  if (message === 'forbidden' || message.includes('not permitted') || message.startsWith('Only a project manager')) {
    return 403;
  }
  if (message.startsWith('invalid_')) return 400;
  if (message === 'request_pending' || message === 'request_closed') return 409;
  return 500;
}

export function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
