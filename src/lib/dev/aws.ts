import 'server-only';
import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { AppRunnerClient, DescribeServiceCommand, ListOperationsCommand, StartDeploymentCommand } from '@aws-sdk/client-apprunner';
import { CostExplorerClient, GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer';
import type { DataPayload, DeployOperation, DeployService, LogLevel, LogLine, OverviewPayload, Reach } from './types';
import { missingEnv, notSetUp, reach } from './reach';
import { groupCosts, logFilterPattern, logLevelOf, logSourceOf, requestIdOf, sumCostsByService } from './parse';
import { scrubText } from './mask';

/**
 * AWS readers for the developer console: CloudWatch Logs, App Runner and Cost Explorer. Each
 * uses the default credential chain (the App Runner instance role in AWS), one attempt, short
 * timeouts, and returns the "not set up" state when its env var is missing.
 *
 * Env: APP_LOG_GROUP, APP_RUNNER_SERVICE_ARN, AWS_COST_EXPLORER=on, AWS_REGION.
 * IAM: logs:FilterLogEvents on the group; apprunner:DescribeService,
 * apprunner:ListOperations and (for "Redeploy") apprunner:StartDeployment on the service;
 * ce:GetCostAndUsage.
 */

const HANDLER = { requestTimeout: 4000, connectionTimeout: 2000 };

function region(): string {
  return process.env.AWS_REGION?.trim() || process.env.S3_REGION?.trim() || 'ap-south-1';
}

/** The region from an App Runner service ARN, so the client matches the service. */
function arnRegion(arn: string): string {
  return arn.split(':')[3] || region();
}

const iso = (d: Date | undefined | null) => (d ? new Date(d).toISOString() : null);

// ---------- CloudWatch Logs ----------

export async function readLogLines(opts: { level?: LogLevel | 'all'; text?: string; hours?: number; limit?: number }): Promise<Reach<LogLine[]>> {
  const missing = missingEnv(['APP_LOG_GROUP']);
  if (missing.length) return notSetUp(missing);
  const group = process.env.APP_LOG_GROUP!.trim();
  const hours = Math.min(Math.max(opts.hours ?? 6, 1), 72);
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500);

  return reach(async (abortSignal) => {
    const client = new CloudWatchLogsClient({ region: region(), maxAttempts: 1, requestHandler: HANDLER });
    const res = await client.send(
      new FilterLogEventsCommand({
        logGroupName: group,
        startTime: Date.now() - hours * 3600000,
        filterPattern: logFilterPattern(opts.text ?? ''),
        limit,
      }),
      { abortSignal },
    );
    const lines: LogLine[] = (res.events ?? []).map((e, i) => {
      const message = scrubText((e.message ?? '').trim()).slice(0, 2000);
      return {
        id: e.eventId ?? `${e.timestamp ?? 0}-${i}`,
        at: new Date(e.timestamp ?? 0).toISOString(),
        level: logLevelOf(message),
        stream: (e.logStreamName ?? '').split('/').slice(-1)[0] ?? '',
        message,
        source: logSourceOf(message),
        requestId: requestIdOf(message),
      };
    });
    const level = opts.level ?? 'all';
    return lines.filter((l) => level === 'all' || l.level === level).sort((a, b) => b.at.localeCompare(a.at));
  });
}

/**
 * Error lines among the app log lines of the last 24 hours, for the overview tile. It reads
 * at most 500 lines; `capped` says the window held more, so the count is a lower bound.
 */
export async function countLogErrors24h(): Promise<OverviewPayload['errors24h']> {
  const LIMIT = 500;
  const lines = await readLogLines({ hours: 24, limit: LIMIT });
  if (lines.state !== 'ok') return lines;
  return {
    state: 'ok',
    data: { errors: lines.data.filter((l) => l.level === 'error').length, lines: lines.data.length, capped: lines.data.length >= LIMIT },
  };
}

// ---------- App Runner ----------

export async function readAppRunner(): Promise<{ service: Reach<DeployService>; operations: Reach<DeployOperation[]> }> {
  const missing = missingEnv(['APP_RUNNER_SERVICE_ARN']);
  if (missing.length) return { service: notSetUp(missing), operations: notSetUp(missing) };
  const arn = process.env.APP_RUNNER_SERVICE_ARN!.trim();
  const client = new AppRunnerClient({ region: arnRegion(arn), maxAttempts: 1, requestHandler: HANDLER });

  const [service, operations] = await Promise.all([
    reach<DeployService>(async (abortSignal) => {
      const res = await client.send(new DescribeServiceCommand({ ServiceArn: arn }), { abortSignal });
      const s = res.Service;
      const image = s?.SourceConfiguration?.ImageRepository?.ImageIdentifier ?? null;
      return {
        name: s?.ServiceName ?? '',
        url: s?.ServiceUrl ?? null,
        status: s?.Status ?? 'UNKNOWN',
        // Keep only the tag or digest; the registry path is not useful on the page.
        image: image ? (image.split('/').pop() ?? image) : null,
        cpu: s?.InstanceConfiguration?.Cpu ?? null,
        memory: s?.InstanceConfiguration?.Memory ?? null,
        updatedAt: iso(s?.UpdatedAt),
      };
    }),
    reach<DeployOperation[]>(async (abortSignal) => {
      const res = await client.send(new ListOperationsCommand({ ServiceArn: arn, MaxResults: 20 }), { abortSignal });
      return (res.OperationSummaryList ?? []).map((o, i) => ({
        id: o.Id ?? `op-${i}`,
        type: o.Type ?? 'UNKNOWN',
        status: o.Status ?? 'UNKNOWN',
        startedAt: iso(o.StartedAt),
        endedAt: iso(o.EndedAt),
      }));
    }),
  ]);
  return { service, operations };
}

/**
 * "Redeploy": App Runner StartDeployment on APP_RUNNER_SERVICE_ARN. It pulls the image the
 * service already names and rolls it out; it never changes the image, the settings or the
 * env. App Runner refuses it while another operation runs. Returns the operation id.
 */
export async function startRedeploy(): Promise<{ operationId: string | null }> {
  const missing = missingEnv(['APP_RUNNER_SERVICE_ARN']);
  if (missing.length) throw new Error('not_set_up');
  const arn = process.env.APP_RUNNER_SERVICE_ARN!.trim();
  const client = new AppRunnerClient({ region: arnRegion(arn), maxAttempts: 1, requestHandler: HANDLER });
  const res = await client.send(new StartDeploymentCommand({ ServiceArn: arn }));
  return { operationId: res.OperationId ?? null };
}

// ---------- Cost Explorer ----------

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function readCosts(days = 30): Promise<DataPayload['costs']> {
  if ((process.env.AWS_COST_EXPLORER ?? '').trim().toLowerCase() !== 'on') return notSetUp(['AWS_COST_EXPLORER']);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);

  return reach(async (abortSignal) => {
    // Cost Explorer has one endpoint, in us-east-1.
    const client = new CostExplorerClient({ region: 'us-east-1', maxAttempts: 1, requestHandler: HANDLER });
    const res = await client.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: ymd(start), End: ymd(end) },
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
      }),
      { abortSignal },
    );
    const sum = sumCostsByService(res.ResultsByTime ?? []);
    return { ...sum, start: ymd(start), end: ymd(end) };
  });
}

/** Cost Explorer bills each call, and the overview refreshes every minute, so keep an answer for an hour. */
const COST_TTL_MS = 3600000;
let monthCache: { at: number; key: string; value: OverviewPayload['costsMonth'] } | null = null;

/**
 * Spend from the first of this month (UTC) to today, in the five overview groups. On the
 * first day of a month the window is empty, so the reader returns a zero total. A good
 * answer is kept for an hour; a failure is not kept.
 */
export async function readCostsThisMonth(now = new Date()): Promise<OverviewPayload['costsMonth']> {
  if ((process.env.AWS_COST_EXPLORER ?? '').trim().toLowerCase() !== 'on') return notSetUp(['AWS_COST_EXPLORER']);
  const key = ymd(now);
  if (monthCache && monthCache.key === key && now.getTime() - monthCache.at < COST_TTL_MS) return monthCache.value;
  const value = await readCostsMonthUncached(now);
  if (value.state === 'ok') monthCache = { at: now.getTime(), key, value };
  return value;
}

async function readCostsMonthUncached(now: Date): Promise<OverviewPayload['costsMonth']> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (end.getTime() <= start.getTime()) {
    return { state: 'ok', data: { currency: 'USD', start: ymd(start), end: ymd(end), total: 0, groups: groupCosts([]) } };
  }
  return reach(async (abortSignal) => {
    const client = new CostExplorerClient({ region: 'us-east-1', maxAttempts: 1, requestHandler: HANDLER });
    const res = await client.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: ymd(start), End: ymd(end) },
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
      }),
      { abortSignal },
    );
    const sum = sumCostsByService(res.ResultsByTime ?? []);
    return { currency: sum.currency, start: ymd(start), end: ymd(end), total: sum.total, groups: groupCosts(sum.services) };
  });
}
