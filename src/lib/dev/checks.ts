import 'server-only';
import { SESv2Client, GetAccountCommand } from '@aws-sdk/client-sesv2';
import { SocialMessagingClient, GetLinkedWhatsAppBusinessAccountPhoneNumberCommand } from '@aws-sdk/client-socialmessaging';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { AppRunnerClient, DescribeServiceCommand } from '@aws-sdk/client-apprunner';
import { CloudWatchLogsClient, DescribeLogGroupsCommand } from '@aws-sdk/client-cloudwatch-logs';
import type { ServiceConfig } from './types';
import { reachError } from './reach';

/**
 * Live checks for the Connections page ("Test"). Each probe makes one cheap, read-only call
 * to the service with the app's own settings and returns a short line saying what answered,
 * or throws. Nothing is sent to a person and no secret is returned. Cost Explorer has no
 * probe, because AWS bills each of its calls.
 *
 * IAM for the probes: ses:GetAccount, social-messaging:GetLinkedWhatsAppBusinessAccountPhoneNumber,
 * s3:ListBucket (HeadBucket), apprunner:DescribeService, logs:DescribeLogGroups.
 */

type Env = Record<string, string | undefined>;
export type Probe = (signal: AbortSignal) => Promise<string>;

const HANDLER = { requestTimeout: 4000, connectionTimeout: 2000 };
const v = (env: Env, n: string) => env[n]?.trim() || '';

async function getJson(url: string, init: RequestInit, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { ...init, signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`Answered ${res.status}`);
  return res.json().catch(() => ({}));
}

/** The probe for one service, or null when the service has none or is not set up. */
export function probeFor(id: ServiceConfig['id'], env: Env = process.env): Probe | null {
  switch (id) {
    case 'email':
      if (v(env, 'EMAIL_PROVIDER').toLowerCase() === 'ses') {
        return async (abortSignal) => {
          const client = new SESv2Client({ region: v(env, 'SES_REGION') || v(env, 'AWS_REGION') || 'ap-south-1', maxAttempts: 1, requestHandler: HANDLER });
          const res = await client.send(new GetAccountCommand({}), { abortSignal });
          if (res.SendingEnabled === false) throw new Error('Sending is paused on the account');
          return res.ProductionAccessEnabled ? 'SES answered · production access' : 'SES answered · sandbox';
        };
      }
      if (!v(env, 'RESEND_API_KEY')) return null;
      return async (signal) => {
        const body = (await getJson('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${v(env, 'RESEND_API_KEY')}` } }, signal)) as { data?: unknown[] };
        return `Resend answered · ${Array.isArray(body.data) ? body.data.length : 0} domains`;
      };
    case 'whatsapp':
      if (!v(env, 'EUM_PHONE_NUMBER_ID')) return null;
      return async (abortSignal) => {
        const region = v(env, 'SOCIAL_MESSAGING_REGION') || v(env, 'AWS_REGION');
        const client = new SocialMessagingClient({ ...(region ? { region } : {}), maxAttempts: 1, requestHandler: HANDLER });
        const res = await client.send(new GetLinkedWhatsAppBusinessAccountPhoneNumberCommand({ id: v(env, 'EUM_PHONE_NUMBER_ID') }), { abortSignal });
        const q = res.phoneNumber?.qualityRating;
        return `Number linked${q ? ` · quality ${q.toLowerCase()}` : ''}`;
      };
    case 'storage':
      if (!v(env, 'S3_BUCKET')) return null;
      return async (abortSignal) => {
        const client = new S3Client({
          region: v(env, 'S3_REGION') || 'us-east-1',
          endpoint: v(env, 'S3_ENDPOINT') || undefined,
          forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
          maxAttempts: 1,
          requestHandler: HANDLER,
          credentials:
            v(env, 'S3_ACCESS_KEY_ID') && v(env, 'S3_SECRET_ACCESS_KEY')
              ? { accessKeyId: v(env, 'S3_ACCESS_KEY_ID'), secretAccessKey: v(env, 'S3_SECRET_ACCESS_KEY') }
              : undefined,
        });
        await client.send(new HeadBucketCommand({ Bucket: v(env, 'S3_BUCKET') }), { abortSignal });
        return 'Bucket answered';
      };
    case 'jobs':
      if (!v(env, 'INNGEST_SIGNING_KEY')) return null;
      return async (signal) => {
        const base = (v(env, 'INNGEST_API_BASE_URL') || 'https://api.inngest.com').replace(/\/+$/, '');
        await getJson(`${base}/v1/events?limit=1`, { headers: { Authorization: `Bearer ${v(env, 'INNGEST_SIGNING_KEY')}` } }, signal);
        return 'Inngest answered';
      };
    case 'ask':
      if (v(env, 'ASK_VCFO_LLM_PROVIDER').toLowerCase() === 'bedrock' || !v(env, 'ANTHROPIC_API_KEY')) return null;
      return async (signal) => {
        await getJson('https://api.anthropic.com/v1/models?limit=1', { headers: { 'x-api-key': v(env, 'ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' } }, signal);
        return 'Anthropic API answered';
      };
    case 'outlook':
      if (!v(env, 'AZURE_AD_CLIENT_ID') || !v(env, 'AZURE_AD_CLIENT_SECRET') || !v(env, 'AZURE_AD_TENANT_ID')) return null;
      return async (signal) => {
        // An app-only token proves the client id and secret still work; it is thrown away.
        const body = new URLSearchParams({
          client_id: v(env, 'AZURE_AD_CLIENT_ID'),
          client_secret: v(env, 'AZURE_AD_CLIENT_SECRET'),
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        });
        const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(v(env, 'AZURE_AD_TENANT_ID'))}/oauth2/v2.0/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`Microsoft answered ${res.status}`);
        return 'Microsoft sign-in answered';
      };
    case 'credentials':
      if (!v(env, 'CREDENTIALS_ENCRYPTION_KEY')) return null;
      return async () => {
        const raw = v(env, 'CREDENTIALS_ENCRYPTION_KEY');
        const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
        if (buf.length !== 32) throw new Error('The key is not 32 bytes');
        return 'Key is 32 bytes';
      };
    case 'logs':
      if (!v(env, 'APP_LOG_GROUP')) return null;
      return async (abortSignal) => {
        const client = new CloudWatchLogsClient({ region: v(env, 'AWS_REGION') || v(env, 'S3_REGION') || 'ap-south-1', maxAttempts: 1, requestHandler: HANDLER });
        const res = await client.send(new DescribeLogGroupsCommand({ logGroupNamePrefix: v(env, 'APP_LOG_GROUP'), limit: 5 }), { abortSignal });
        if (!(res.logGroups ?? []).some((g) => g.logGroupName === v(env, 'APP_LOG_GROUP'))) throw new Error('Log group not found');
        return 'Log group found';
      };
    case 'deploys':
      if (!v(env, 'APP_RUNNER_SERVICE_ARN')) return null;
      return async (abortSignal) => {
        const arn = v(env, 'APP_RUNNER_SERVICE_ARN');
        const client = new AppRunnerClient({ region: arn.split(':')[3] || 'ap-south-1', maxAttempts: 1, requestHandler: HANDLER });
        const res = await client.send(new DescribeServiceCommand({ ServiceArn: arn }), { abortSignal });
        const status = res.Service?.Status ?? 'UNKNOWN';
        if (status !== 'RUNNING' && status !== 'OPERATION_IN_PROGRESS') throw new Error(`Service is ${status.toLowerCase()}`);
        return `Service ${status.toLowerCase().replace(/_/g, ' ')}`;
      };
    default:
      return null;
  }
}

export interface CheckOutcome {
  ok: boolean;
  latencyMs: number;
  detail: string;
}

/** Run a probe with a timeout and time it. A failure becomes `ok: false` with a safe line. */
export async function runProbe(probe: Probe, timeoutMs = 5000, now: () => number = Date.now): Promise<CheckOutcome> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = now();
  try {
    const detail = await Promise.race([
      probe(ctrl.signal),
      new Promise<never>((_, rej) => ctrl.signal.addEventListener('abort', () => rej(new Error(`No answer in ${Math.round(timeoutMs / 1000)} s`)))),
    ]);
    return { ok: true, latencyMs: Math.max(0, now() - start), detail: detail.slice(0, 200) };
  } catch (err) {
    return { ok: false, latencyMs: Math.max(0, now() - start), detail: reachError(err) };
  } finally {
    clearTimeout(timer);
  }
}
