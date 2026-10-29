import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Round X readers and writers that talk to AWS and DNS. Every SDK client is mocked: no test
 * here reaches AWS or the network.
 */

const sent: Array<{ name: string; input: Record<string, unknown> }> = [];
let answers: Record<string, unknown> = {};

function fakeSdk(names: string[]) {
  const mod: Record<string, unknown> = {};
  for (const n of names) {
    mod[n] = class {
      input: Record<string, unknown>;
      constructor(input: Record<string, unknown>) {
        this.input = input;
      }
      get name() {
        return n;
      }
    };
  }
  return mod;
}

const send = vi.fn(async (cmd: { name: string; input: Record<string, unknown> }) => {
  sent.push({ name: cmd.name, input: cmd.input });
  const a = answers[cmd.name];
  if (a instanceof Error) throw a;
  return a ?? {};
});

class FakeClient {
  send = send;
}

vi.mock('@aws-sdk/client-apprunner', () => ({
  AppRunnerClient: FakeClient,
  ...fakeSdk(['DescribeServiceCommand', 'ListOperationsCommand', 'StartDeploymentCommand', 'UpdateServiceCommand']),
}));
vi.mock('@aws-sdk/client-cloudwatch-logs', () => ({
  CloudWatchLogsClient: FakeClient,
  ...fakeSdk(['DescribeLogGroupsCommand', 'FilterLogEventsCommand', 'PutRetentionPolicyCommand']),
}));
vi.mock('@aws-sdk/client-cost-explorer', () => ({ CostExplorerClient: FakeClient, ...fakeSdk(['GetCostAndUsageCommand']) }));
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: FakeClient,
  ...fakeSdk(['GetBucketLifecycleConfigurationCommand', 'GetBucketLocationCommand', 'GetBucketVersioningCommand', 'ListObjectsV2Command', 'HeadBucketCommand']),
}));
vi.mock('@aws-sdk/client-socialmessaging', () => ({
  SocialMessagingClient: FakeClient,
  ...fakeSdk(['GetLinkedWhatsAppBusinessAccountPhoneNumberCommand', 'ListWhatsAppMessageTemplatesCommand']),
}));
vi.mock('@aws-sdk/client-sesv2', () => ({ SESv2Client: FakeClient, ...fakeSdk(['GetAccountCommand', 'GetEmailIdentityCommand']) }));

const aws = await import('./aws');
const { probeFor, runProbe } = await import('./checks');
const { dnsRecords, resendRecords, checkMailDomain } = await import('./domain');

const ENV_KEYS = ['APP_RUNNER_SERVICE_ARN', 'APP_LOG_GROUP', 'AWS_COST_EXPLORER', 'S3_BUCKET', 'EUM_PHONE_NUMBER_ID'];
const ARN = 'arn:aws:apprunner:ap-south-1:1:service/vcfo-suite/abc';

beforeEach(() => {
  sent.length = 0;
  answers = {};
  send.mockClear();
  for (const k of ENV_KEYS) delete process.env[k];
});

describe('not set up', () => {
  it('answers "not set up" without a call when the env var is missing', async () => {
    expect(await aws.readLogRetention()).toEqual({ state: 'not_set_up', missing: ['APP_LOG_GROUP'] });
    expect(await aws.readBucketStats()).toEqual({ state: 'not_set_up', missing: ['S3_BUCKET'] });
    expect(await aws.readCostsByMonth()).toEqual({ state: 'not_set_up', missing: ['AWS_COST_EXPLORER'] });
    expect(await aws.readWhatsAppTemplates()).toEqual({ state: 'not_set_up', missing: ['EUM_PHONE_NUMBER_ID'] });
    await expect(aws.rollBackTo('repo:old')).rejects.toThrow('not_set_up');
    expect(probeFor('deploys', {})).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('roll back', () => {
  it('keeps the source settings and changes only the image', async () => {
    process.env.APP_RUNNER_SERVICE_ARN = ARN;
    answers.DescribeServiceCommand = {
      Service: {
        SourceConfiguration: {
          AutoDeploymentsEnabled: true,
          AuthenticationConfiguration: { AccessRoleArn: 'arn:role/access' },
          ImageRepository: { ImageIdentifier: 'repo:new', ImageRepositoryType: 'ECR', ImageConfiguration: { Port: '3000' } },
        },
      },
    };
    answers.UpdateServiceCommand = { OperationId: 'op-1' };
    const out = await aws.rollBackTo('repo:old');
    expect(out).toEqual({ operationId: 'op-1', before: 'repo:new' });
    const update = sent.find((s) => s.name === 'UpdateServiceCommand')!;
    expect(update.input).toEqual({
      ServiceArn: ARN,
      SourceConfiguration: {
        AutoDeploymentsEnabled: true,
        AuthenticationConfiguration: { AccessRoleArn: 'arn:role/access' },
        ImageRepository: { ImageIdentifier: 'repo:old', ImageRepositoryType: 'ECR', ImageConfiguration: { Port: '3000' } },
      },
    });
  });

  it('reads secret and env names but never their values', async () => {
    process.env.APP_RUNNER_SERVICE_ARN = ARN;
    answers.DescribeServiceCommand = {
      Service: {
        Status: 'RUNNING',
        InstanceConfiguration: { InstanceRoleArn: 'arn:aws:iam::1:role/app' },
        SourceConfiguration: {
          ImageRepository: {
            ImageIdentifier: 'repo:abc1234',
            ImageConfiguration: { RuntimeEnvironmentSecrets: { AUTH_SECRET: 'arn:secret:auth' }, RuntimeEnvironmentVariables: { NODE_ENV: 'production' } },
          },
        },
      },
    };
    answers.ListOperationsCommand = { OperationSummaryList: [] };
    const { service } = await aws.readAppRunner();
    expect(service.state).toBe('ok');
    if (service.state !== 'ok') return;
    expect(service.data.secretNames).toEqual(['AUTH_SECRET']);
    expect(service.data.envNames).toEqual(['NODE_ENV']);
    expect(service.data.imageIdentifier).toBe('repo:abc1234');
    expect(JSON.stringify(service.data)).not.toContain('arn:secret:auth');
  });
});

describe('log retention', () => {
  it('reads the group and sets one of the offered day counts', async () => {
    process.env.APP_LOG_GROUP = '/app/vcfo';
    answers.DescribeLogGroupsCommand = { logGroups: [{ logGroupName: '/app/vcfo', retentionInDays: 30, storedBytes: 2048 }] };
    expect(await aws.readLogRetention()).toEqual({ state: 'ok', data: { group: '/app/vcfo', days: 30, storedBytes: 2048 } });
    await aws.setLogRetention(90);
    expect(sent.at(-1)).toEqual({ name: 'PutRetentionPolicyCommand', input: { logGroupName: '/app/vcfo', retentionInDays: 90 } });
  });
});

describe('bucket, costs and templates', () => {
  it('counts objects and size across pages', async () => {
    process.env.S3_BUCKET = 'docs';
    let page = 0;
    send.mockImplementation(async (cmd: { name: string; input: Record<string, unknown> }) => {
      sent.push(cmd);
      if (cmd.name === 'ListObjectsV2Command') {
        page += 1;
        return page === 1
          ? { Contents: [{ Size: 10 }, { Size: 20 }], IsTruncated: true, NextContinuationToken: 't' }
          : { Contents: [{ Size: 5 }], IsTruncated: false };
      }
      if (cmd.name === 'GetBucketVersioningCommand') return { Status: 'Enabled' };
      if (cmd.name === 'GetBucketLocationCommand') return { LocationConstraint: 'ap-south-1' };
      throw new Error('NoSuchLifecycleConfiguration');
    });
    const out = await aws.readBucketStats();
    expect(out).toEqual({
      state: 'ok',
      data: { bucket: 'docs', region: 'ap-south-1', versioning: 'Enabled', lifecycleRules: 0, objects: 3, bytes: 35, capped: false },
    });
    send.mockImplementation(async (cmd: { name: string; input: Record<string, unknown> }) => {
      sent.push(cmd);
      const a = answers[cmd.name];
      if (a instanceof Error) throw a;
      return a ?? {};
    });
  });

  it('reads six months of spend', async () => {
    process.env.AWS_COST_EXPLORER = 'on';
    answers.GetCostAndUsageCommand = {
      ResultsByTime: [
        { TimePeriod: { Start: '2026-09-01' }, Total: { UnblendedCost: { Amount: '12.5', Unit: 'USD' } } },
        { TimePeriod: { Start: '2026-10-01' }, Total: { UnblendedCost: { Amount: '3', Unit: 'USD' } } },
      ],
    };
    const out = await aws.readCostsByMonth(6, new Date('2026-10-30T00:00:00Z'));
    expect(out).toEqual({ state: 'ok', data: { currency: 'USD', months: [{ month: '2026-09', amount: 12.5 }, { month: '2026-10', amount: 3 }] } });
    expect(sent[0].input).toMatchObject({ TimePeriod: { Start: '2026-05-01', End: '2026-10-31' }, Granularity: 'MONTHLY' });
  });

  it('lists templates of the business account linked to the number', async () => {
    process.env.EUM_PHONE_NUMBER_ID = 'phone-1';
    answers.GetLinkedWhatsAppBusinessAccountPhoneNumberCommand = { linkedWhatsAppBusinessAccountId: 'waba-1' };
    answers.ListWhatsAppMessageTemplatesCommand = { templates: [{ templateName: 'welcome', templateLanguage: 'en', templateCategory: 'UTILITY', templateStatus: 'APPROVED' }] };
    const out = await aws.readWhatsAppTemplates();
    expect(out).toEqual({ state: 'ok', data: [{ name: 'welcome', language: 'en', category: 'UTILITY', status: 'APPROVED' }] });
    expect(sent[1].input).toMatchObject({ id: 'waba-1' });
  });
});

describe('live checks', () => {
  it('times a probe and turns a failure into a safe line', async () => {
    let t = 1000;
    const now = () => (t += 40);
    expect(await runProbe(async () => 'fine', 1000, now)).toEqual({ ok: true, latencyMs: 40, detail: 'fine' });
    const bad = await runProbe(async () => {
      throw new Error('denied for priya@northwind.in');
    }, 1000, now);
    expect(bad.ok).toBe(false);
    expect(bad.detail).not.toContain('priya@northwind.in');
  });

  it('checks the credentials key length without a call', async () => {
    const good = probeFor('credentials', { CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(64) })!;
    expect(await runProbe(good)).toMatchObject({ ok: true, detail: 'Key is 32 bytes' });
    const short = probeFor('credentials', { CREDENTIALS_ENCRYPTION_KEY: 'abc' })!;
    expect(await runProbe(short)).toMatchObject({ ok: false });
  });

  it('fails the App Runner probe for a stopped service', async () => {
    answers.DescribeServiceCommand = { Service: { Status: 'PAUSED' } };
    const probe = probeFor('deploys', { APP_RUNNER_SERVICE_ARN: ARN })!;
    expect(await runProbe(probe)).toMatchObject({ ok: false, detail: 'Service is paused' });
  });

  it('has no probe for a service without its settings, or for costs', () => {
    expect(probeFor('email', { EMAIL_PROVIDER: 'resend' })).toBeNull();
    expect(probeFor('costs', { AWS_COST_EXPLORER: 'on' })).toBeNull();
    expect(probeFor('storage', { S3_BUCKET: 'b' })).not.toBeNull();
  });
});

describe('mail domain', () => {
  const resolver = (txt: Record<string, string[]>, mx: Record<string, string[]> = {}) => ({
    txt: async (n: string) => {
      if (txt[n]) return txt[n];
      throw new Error('ENODATA');
    },
    mx: async (n: string) => {
      if (mx[n]) return mx[n];
      throw new Error('ENODATA');
    },
  });

  it('reads SPF and DMARC from DNS', async () => {
    const out = await dnsRecords('sbcllp.in', resolver({ 'sbcllp.in': ['v=spf1 include:amazonses.com ~all'], '_dmarc.sbcllp.in': [] }));
    expect(out).toEqual([
      { record: 'SPF', status: 'verified', value: 'v=spf1 include:amazonses.com ~all' },
      { record: 'DMARC', status: 'missing', value: 'No record on _dmarc.sbcllp.in' },
    ]);
  });

  it('reads the Resend DKIM and return path names', async () => {
    const out = await resendRecords('sbcllp.in', resolver({ 'resend._domainkey.sbcllp.in': ['p=abc'] }, { 'send.sbcllp.in': ['feedback-smtp.amazonses.com'] }));
    expect(out.map((r) => r.status)).toEqual(['verified', 'verified']);
  });

  it('is not set up without a from address', async () => {
    expect(await checkMailDomain({})).toEqual({ state: 'not_set_up', missing: ['EMAIL_FROM'] });
  });
});
