export interface ResendWelcomeEmailResponse {
  ok: boolean;
  error?: string;
  skipped?: boolean;
}

export async function requestResendWelcomeEmail(
  engagementId: string,
): Promise<ResendWelcomeEmailResponse> {
  const res = await fetch('/api/resend-welcome-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ engagementId }),
  });

  let data: ResendWelcomeEmailResponse;
  try {
    data = (await res.json()) as ResendWelcomeEmailResponse;
  } catch {
    return { ok: false, error: 'invalid_response' };
  }

  if (!res.ok && !data.error) {
    return { ok: false, error: `http_${res.status}` };
  }

  return data;
}
