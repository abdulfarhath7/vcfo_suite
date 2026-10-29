/** Types, constants and small helpers shared by the People page and its parts. */


export const TEMP_PASSWORD = 'SBC@2026';

export type PersonRole = 'super_admin' | 'admin' | 'manager' | 'intern' | 'client' | 'developer';

export type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: PersonRole;
  internId?: string | null;
  clientId?: string | null;
  reportsToManagerId?: string | null;
  status?: string;
};

export type RemovedClientRow = {
  id: string;
  name: string;
  email: string;
  clientId: string | null;
  phone: string | null;
  removedAt: string | null;
  removedReason: string | null;
};

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `http_${res.status}`);
  return body as T;
}

export type FormState = {
  name: string;
  email: string;
  password: string;
  role: PersonRole;
  reportsToManagerId: string;
  submitting: boolean;
};

export type FormAction = { type: 'patch'; patch: Partial<FormState> } | { type: 'reset' };

export function formReducer(state: FormState, action: FormAction): FormState {
  if (action.type === 'reset') {
    return {
      name: '',
      email: '',
      password: TEMP_PASSWORD,
      role: state.role,
      reportsToManagerId: state.reportsToManagerId,
      submitting: false,
    };
  }
  return { ...state, ...action.patch };
}

export const ROLE_LABEL: Record<PersonRole, string> = {
  super_admin: 'Super admin',
  admin: 'Firm admin',
  manager: 'Project manager',
  intern: 'Project lead',
  client: 'Client',
  developer: 'Developer',
};
