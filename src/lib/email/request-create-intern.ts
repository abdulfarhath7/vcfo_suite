export interface CreateInternRequestBody {
  email: string;
  password: string;
  fullName?: string;
  phone?: string;
}

export interface CreateInternResponse {
  ok: boolean;
  internId?: string;
  userId?: string;
  name?: string;
  email?: string;
  emailSent?: boolean;
  emailSkipped?: boolean;
  emailError?: string;
  error?: string;
}

/** Client helper — POST /api/admin/interns (Auth.js session cookie). */
export async function requestCreateIntern(
  body: CreateInternRequestBody,
): Promise<CreateInternResponse> {
  const res = await fetch('/api/admin/interns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = (await res.json()) as CreateInternResponse;
  if (!res.ok) {
    return { ok: false, error: payload.error ?? `http_${res.status}` };
  }
  return payload;
}
