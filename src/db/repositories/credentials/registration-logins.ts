import 'server-only';
import type { AuthContext } from '@/auth/guards';
import { getItem } from '@/data/checklist';
import type { CredentialsPayload } from '@/lib/client-portal/credentials';
import { CredentialsError } from './access';
import { getCredentials } from './workbook';
import { addCredentialRow, updateCredentialCell } from './writes';

/**
 * REGISTRATION LOGINS — the portal username and password a registration box asks for
 * (Registrations page, owner 12 November 2026), kept in the credentials workbook's Login sheet,
 * whose ID and Password columns are encrypted at rest (`credentials-crypto`, AES-GCM with the
 * engagement, sheet and row as associated data).
 *
 * A registration with a template Login row (PF, ESI, PAN, PT, IEC …) uses that row, so the client's
 * workbook and this form show the same login. Any other registration gets one custom Login row
 * labelled with the registration's title, found again by that label.
 *
 * >>> ACCESS CONTROL <<< Staff only: a client never reads or writes through here (its own
 * workbook needs a manager-approved grant). Engagement scoping, the audit events and the
 * encryption all come from `getCredentials` / `updateCredentialCell` / `addCredentialRow`
 * (`resolveAccess` → `assertEngagementAccess`).
 */

const STAFF = new Set(['super_admin', 'admin', 'manager', 'intern']);

/** Registration step → its template row on the Login sheet, where the workbook has one. */
const LOGIN_ROW_FOR_STEP: Record<string, string> = {
  'reg-1': 'pf',
  'reg-2': 'pan',
  'reg-3': 'esi',
  'reg-4': 'gst',
  'reg-5': 'lut',
  'reg-7': 'pt',
  'reg-8': 'iec',
  'reg-9': 'se',
  'reg-11': 'non-stpi',
  'reg-14': 'posh',
  'reg-23': 'fla',
};

export interface RegistrationLogin {
  username: string;
  password: string;
}

function requireStaff(ctx: AuthContext) {
  if (!STAFF.has(ctx.role)) throw new CredentialsError('forbidden', 403);
}

function registrationTitle(stepId: string): string {
  const item = getItem(stepId);
  if (!item || !stepId.startsWith('reg-')) throw new CredentialsError('invalid_registration', 400);
  return item.title;
}

/** The Login row that holds this registration's login, or null when none exists yet. */
function loginRowKey(payload: CredentialsPayload, stepId: string, title: string): string | null {
  const template = LOGIN_ROW_FOR_STEP[stepId];
  if (template) return template;
  const wanted = title.trim().toLowerCase();
  const row = payload.sheets.login.rows.find(
    (r) => r.key.startsWith('custom:') && String(r.cells.label?.v ?? '').trim().toLowerCase() === wanted,
  );
  return row?.key ?? null;
}

function loginOf(payload: CredentialsPayload, rowKey: string | null): RegistrationLogin {
  const row = rowKey ? payload.sheets.login.rows.find((r) => r.key === rowKey) : undefined;
  const value = (col: string) => {
    const v = row?.cells[col]?.v;
    // The workbook writes "Pending COI" into company IDs it cannot know yet; that is not a username.
    return typeof v === 'string' && v !== 'Pending COI' ? v : '';
  };
  return { username: value('id'), password: value('password') };
}

export async function getRegistrationLogin(
  ctx: AuthContext,
  input: { engagementId: string; stepId: string },
): Promise<RegistrationLogin> {
  requireStaff(ctx);
  const title = registrationTitle(input.stepId);
  const payload = await getCredentials(ctx, input.engagementId);
  return loginOf(payload, loginRowKey(payload, input.stepId, title));
}

export async function saveRegistrationLogin(
  ctx: AuthContext,
  input: { engagementId: string; stepId: string; username: string; password: string },
): Promise<RegistrationLogin> {
  requireStaff(ctx);
  const title = registrationTitle(input.stepId);
  const username = input.username.trim();
  const password = input.password;
  if (!username && !password) throw new CredentialsError('empty_value', 400);

  let payload = await getCredentials(ctx, input.engagementId);
  let rowKey = loginRowKey(payload, input.stepId, title);
  if (!rowKey) {
    const added = await addCredentialRow(ctx, { engagementId: input.engagementId, sheet: 'login' });
    rowKey = added.rowKey;
    payload = await updateCredentialCell(ctx, { engagementId: input.engagementId, key: `login|${rowKey}|label`, value: title });
  }
  const current = loginOf(payload, rowKey);
  if (username && username !== current.username) {
    payload = await updateCredentialCell(ctx, { engagementId: input.engagementId, key: `login|${rowKey}|id`, value: username });
  }
  if (password && password !== current.password) {
    payload = await updateCredentialCell(ctx, { engagementId: input.engagementId, key: `login|${rowKey}|password`, value: password });
  }
  return loginOf(payload, rowKey);
}
