import 'server-only';
import { promises as dns } from 'node:dns';
import { SESv2Client, GetEmailIdentityCommand } from '@aws-sdk/client-sesv2';
import type { DomainCheck, DomainRecord, Reach } from './types';
import { notSetUp, reach } from './reach';
import { mailDomain } from './service-meta';

/**
 * The mail domain check for Connections and Messages ("Email domain"): SPF and DMARC from
 * public DNS, and DKIM and the return path from SES when EMAIL_PROVIDER=ses, or from the
 * DNS names Resend asks for (`resend._domainkey`, `send.`) otherwise. Read only.
 */

type Env = Record<string, string | undefined>;

export interface Resolver {
  txt: (name: string) => Promise<string[]>;
  mx: (name: string) => Promise<string[]>;
}

const systemResolver: Resolver = {
  txt: async (name) => (await dns.resolveTxt(name)).map((parts) => parts.join('')),
  mx: async (name) => (await dns.resolveMx(name)).map((m) => m.exchange),
};

/** TXT values, or [] when the name has none. */
async function txtOrNone(r: Resolver, name: string): Promise<string[]> {
  return r.txt(name).catch(() => []);
}

const short = (s: string) => (s.length > 90 ? `${s.slice(0, 90)}…` : s);

/** SPF and DMARC from DNS. Pure apart from the resolver, so it is tested with a stub. */
export async function dnsRecords(domain: string, r: Resolver): Promise<DomainRecord[]> {
  const [root, dmarc] = await Promise.all([txtOrNone(r, domain), txtOrNone(r, `_dmarc.${domain}`)]);
  const spf = root.find((t) => t.toLowerCase().startsWith('v=spf1'));
  const dm = dmarc.find((t) => t.toLowerCase().startsWith('v=dmarc1'));
  return [
    { record: 'SPF', status: spf ? 'verified' : 'missing', value: spf ? short(spf) : `No SPF record on ${domain}` },
    { record: 'DMARC', status: dm ? 'verified' : 'missing', value: dm ? short(dm) : `No record on _dmarc.${domain}` },
  ];
}

/** DKIM and return path for Resend, from the DNS names it asks for. */
export async function resendRecords(domain: string, r: Resolver): Promise<DomainRecord[]> {
  const [dkim, mx] = await Promise.all([txtOrNone(r, `resend._domainkey.${domain}`), r.mx(`send.${domain}`).catch(() => [])]);
  return [
    { record: 'DKIM', status: dkim.length ? 'verified' : 'missing', value: dkim.length ? `resend._domainkey.${domain}` : `No record on resend._domainkey.${domain}` },
    { record: 'Return path', status: mx.length ? 'verified' : 'missing', value: mx.length ? `send.${domain} → ${mx[0]}` : `No MX on send.${domain}` },
  ];
}

const SES_STATUS: Record<string, DomainRecord['status']> = {
  SUCCESS: 'verified',
  PENDING: 'pending',
  FAILED: 'failed',
  TEMPORARY_FAILURE: 'failed',
  NOT_STARTED: 'pending',
};

async function sesRecords(domain: string, env: Env, signal: AbortSignal): Promise<DomainRecord[]> {
  const client = new SESv2Client({ region: env.SES_REGION?.trim() || env.AWS_REGION?.trim() || 'ap-south-1', maxAttempts: 1 });
  const res = await client.send(new GetEmailIdentityCommand({ EmailIdentity: domain }), { abortSignal: signal });
  const dkim = res.DkimAttributes?.Status ?? 'NOT_STARTED';
  const mf = res.MailFromAttributes;
  return [
    { record: 'DKIM', status: SES_STATUS[dkim] ?? 'pending', value: `${(res.DkimAttributes?.Tokens ?? []).length} CNAME records · ${dkim.toLowerCase().replace(/_/g, ' ')}` },
    {
      record: 'Return path',
      status: mf?.MailFromDomain ? (SES_STATUS[mf.MailFromDomainStatus ?? ''] ?? 'pending') : 'missing',
      value: mf?.MailFromDomain ?? 'Amazon SES default (amazonses.com)',
    },
  ];
}

export async function checkMailDomain(env: Env = process.env, r: Resolver = systemResolver): Promise<Reach<DomainCheck>> {
  const domain = mailDomain(env);
  if (!domain) return notSetUp(['EMAIL_FROM']);
  const ses = (env.EMAIL_PROVIDER ?? '').trim().toLowerCase() === 'ses';
  return reach(async (signal) => {
    const [base, extra] = await Promise.all([dnsRecords(domain, r), ses ? sesRecords(domain, env, signal) : resendRecords(domain, r)]);
    const order: DomainRecord['record'][] = ['SPF', 'DKIM', 'DMARC', 'Return path'];
    const records = [...base, ...extra].sort((a, b) => order.indexOf(a.record) - order.indexOf(b.record));
    return { domain, records, checkedAt: new Date().toISOString() };
  }, 6000);
}
