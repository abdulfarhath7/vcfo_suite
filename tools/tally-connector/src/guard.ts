/**
 * The write guard. The connector must never change anything inside TallyPrime, so every
 * XML request passes through assertReadOnlyRequest before it is sent. Only Export requests
 * are allowed, and any sign of an import or of a create, alter or delete action is refused.
 */
export class WriteGuardError extends Error {}

const ACTION_ATTR = /\bACTION\s*=\s*["']?\s*(create|alter|delete|cancel|update|modify)/i;
const WRITE_TAGS = /<\s*(IMPORTDATA|REQUESTDATA|TALLYMESSAGE)\b/i;

export function assertReadOnlyRequest(xml: string): void {
  const requests = [...xml.matchAll(/<\s*TALLYREQUEST\s*>([\s\S]*?)<\s*\/\s*TALLYREQUEST\s*>/gi)];
  if (requests.length !== 1) {
    throw new WriteGuardError('Refused: a Tally request must carry exactly one TALLYREQUEST.');
  }
  const kind = requests[0][1].trim();
  if (kind.toLowerCase() !== 'export') {
    throw new WriteGuardError(`Refused: only Export requests may be sent to Tally (got "${kind}").`);
  }
  if (ACTION_ATTR.test(xml)) {
    throw new WriteGuardError('Refused: the request contains a create, alter or delete action.');
  }
  if (WRITE_TAGS.test(xml)) {
    throw new WriteGuardError('Refused: the request contains import data.');
  }
}
