import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';
import type { WhatsAppConfig } from '@/lib/notify/channels';

/**
 * C-868: WhatsApp verification codes are the caller's own. Every lookup is keyed by the
 * caller's user id, a wrong code counts an attempt, five lock it, and nothing is sent when the
 * feature is not set up.
 */

type Call = { op: string; where?: SQL; values?: Record<string, unknown>; set?: Record<string, unknown> };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    orderBy: () => c,
    limit: () => c,
    where: (w: SQL) => {
      call.where = w;
      return c;
    },
    values: (v: Record<string, unknown>) => {
      call.values = v;
      return c;
    },
    set: (s: Record<string, unknown>) => {
      call.set = s;
      return c;
    },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(results.shift() ?? []).then(res, rej),
  };
  return c;
}
function op(name: string) {
  return () => {
    const call: Call = { op: name };
    calls.push(call);
    return chain(call);
  };
}
vi.mock('server-only', () => ({}));
vi.mock('@/db/client', () => ({ db: { select: op('select'), insert: op('insert'), update: op('update') } }));

const repo = await import('@/db/repositories/client-whatsapp-verify');
const dialect = new PgDialect();

const me: AuthContext = { userId: '11111111-1111-1111-1111-111111111111', email: 'asha@client.test', name: 'Asha', role: 'client', clientId: 'c1' };
const PHONE = '+919876543210';
const config: WhatsAppConfig = {
  enabled: true,
  eum: { region: 'ap-south-1', phoneNumberId: 'phone-number-id-1', templateLanguage: 'en', metaApiVersion: 'v21.0', templateNames: {} as WhatsAppConfig['eum']['templateNames'] },
};
const env = { WHATSAPP_TEMPLATE_NAME_VERIFY_CODE: 'vcfo_code' } as unknown as NodeJS.ProcessEnv;

beforeEach(() => {
  calls.length = 0;
  results = [];
});

describe('sendWhatsAppVerifyCode', () => {
  it('is not set up without the template name, and sends nothing', async () => {
    const send = vi.fn();
    const out = await repo.sendWhatsAppVerifyCode(me, PHONE, { deps: { config, createEumClient: async () => send }, env: {} as NodeJS.ProcessEnv });
    expect(out.status).toBe('not_set_up');
    expect(send).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it('stores a hash for the caller and sends the code', async () => {
    const send = vi.fn(async () => ({ messageId: 'wamid.1' }));
    results = [[], []];
    const out = await repo.sendWhatsAppVerifyCode(me, PHONE, { deps: { config, createEumClient: async () => send }, env });
    expect(out.status).toBe('sent');
    const insert = calls.find((c) => c.op === 'insert')!;
    expect(insert.values!.userId).toBe(me.userId);
    expect(insert.values!.phoneE164).toBe(PHONE);
    const payload = JSON.parse(new TextDecoder().decode((send.mock.calls[0] as unknown as [{ message: Uint8Array }])[0].message));
    const code = payload.template.components[0].parameters[0].text as string;
    expect(code).toMatch(/^\d{6}$/);
    expect(JSON.stringify(insert.values)).not.toContain(code);
  });

  it('refuses after five codes in an hour', async () => {
    results = [[1, 2, 3, 4, 5].map((i) => ({ id: `r${i}` }))];
    const out = await repo.sendWhatsAppVerifyCode(me, PHONE, { deps: { config, createEumClient: async () => vi.fn() }, env });
    expect(out.status).toBe('too_many');
  });
});

describe('checkWhatsAppVerifyCode', () => {
  const future = new Date(Date.now() + 60_000);

  it('looks only at the caller’s own codes', async () => {
    results = [[]];
    const out = await repo.checkWhatsAppVerifyCode(me, PHONE, '123456');
    expect(out.status).toBe('expired');
    const q = dialect.sqlToQuery(calls[0]!.where!);
    expect(q.sql).toContain('"whatsapp_verify_codes"."user_id" = $');
    expect(q.params).toContain(me.userId);
  });

  it('a wrong code counts an attempt; the fifth locks', async () => {
    results = [[{ id: 'r1', userId: me.userId, phoneE164: PHONE, codeHash: 'x', attempts: 0, expiresAt: future, usedAt: null }], []];
    expect((await repo.checkWhatsAppVerifyCode(me, PHONE, '000000')).status).toBe('wrong');
    expect(calls.find((c) => c.op === 'update')!.set).toEqual({ attempts: 1 });
    calls.length = 0;
    results = [[{ id: 'r1', userId: me.userId, phoneE164: PHONE, codeHash: 'x', attempts: 4, expiresAt: future, usedAt: null }], []];
    expect((await repo.checkWhatsAppVerifyCode(me, PHONE, '000000')).status).toBe('locked');
  });

  it('the right code works once', async () => {
    const send = vi.fn(async () => ({ messageId: 'wamid.1' }));
    results = [[], []];
    await repo.sendWhatsAppVerifyCode(me, PHONE, { deps: { config, createEumClient: async () => send }, env });
    const inserted = calls.find((c) => c.op === 'insert')!.values!;
    const code = JSON.parse(new TextDecoder().decode((send.mock.calls[0] as unknown as [{ message: Uint8Array }])[0].message)).template.components[0].parameters[0].text;
    calls.length = 0;
    results = [[{ ...inserted, attempts: 0, usedAt: null }], []];
    expect((await repo.checkWhatsAppVerifyCode(me, PHONE, code)).status).toBe('ok');
    expect(calls.find((c) => c.op === 'update')!.set).toHaveProperty('usedAt');
  });
});
