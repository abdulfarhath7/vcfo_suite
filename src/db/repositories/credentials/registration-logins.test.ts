import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

type Row = { key: string; cells: Record<string, { v: string | null }> };
let rows: Row[] = [];
const payload = () => ({ sheets: { login: { rows } } });

vi.mock('./workbook', () => ({ getCredentials: vi.fn(async () => payload()) }));
vi.mock('./writes', () => ({
  addCredentialRow: vi.fn(async () => {
    rows.push({ key: 'custom:new', cells: {} });
    return { rowKey: 'custom:new', payload: payload() };
  }),
  updateCredentialCell: vi.fn(async (_ctx: unknown, input: { key: string; value: string }) => {
    const [, rowKey, col] = input.key.split('|');
    const row = rows.find((r) => r.key === rowKey)!;
    row.cells[col!] = { v: input.value };
    return payload();
  }),
}));

import { addCredentialRow, updateCredentialCell } from './writes';
import { getRegistrationLogin, saveRegistrationLogin } from './registration-logins';

const staff = { role: 'manager', userId: 'u1' } as never;
const client = { role: 'client', userId: 'c1' } as never;

describe('registration logins', () => {
  beforeEach(() => {
    rows = [{ key: 'pf', cells: { label: { v: 'Provident Fund (PF)' }, id: { v: '' }, password: { v: '' } } }];
    vi.clearAllMocks();
  });

  it('saves PF into its template Login row, encrypted columns id and password', async () => {
    const login = await saveRegistrationLogin(staff, { engagementId: 'e1', stepId: 'reg-1', username: 'pfuser', password: 's3cret' });
    expect(login).toEqual({ username: 'pfuser', password: 's3cret' });
    expect(updateCredentialCell).toHaveBeenCalledWith(staff, { engagementId: 'e1', key: 'login|pf|id', value: 'pfuser' });
    expect(updateCredentialCell).toHaveBeenCalledWith(staff, { engagementId: 'e1', key: 'login|pf|password', value: 's3cret' });
    expect(addCredentialRow).not.toHaveBeenCalled();
    expect(await getRegistrationLogin(staff, { engagementId: 'e1', stepId: 'reg-1' })).toEqual(login);
  });

  it('adds one labelled row for a registration without a template row, and finds it again', async () => {
    await saveRegistrationLogin(staff, { engagementId: 'e1', stepId: 'reg-6', username: 'lei', password: 'pw' });
    expect(addCredentialRow).toHaveBeenCalledTimes(1);
    expect(updateCredentialCell).toHaveBeenCalledWith(staff, { engagementId: 'e1', key: 'login|custom:new|label', value: 'LEI Registration' });
    await saveRegistrationLogin(staff, { engagementId: 'e1', stepId: 'reg-6', username: 'lei2', password: 'pw' });
    expect(addCredentialRow).toHaveBeenCalledTimes(1);
    expect(await getRegistrationLogin(staff, { engagementId: 'e1', stepId: 'reg-6' })).toEqual({ username: 'lei2', password: 'pw' });
  });

  it('refuses a client and a step that is not a registration', async () => {
    await expect(getRegistrationLogin(client, { engagementId: 'e1', stepId: 'reg-1' })).rejects.toMatchObject({ status: 403 });
    await expect(getRegistrationLogin(staff, { engagementId: 'e1', stepId: 'pre-7' })).rejects.toMatchObject({ status: 400 });
    await expect(saveRegistrationLogin(staff, { engagementId: 'e1', stepId: 'reg-1', username: ' ', password: '' })).rejects.toMatchObject({ status: 400 });
  });
});
