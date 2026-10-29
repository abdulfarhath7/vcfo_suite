import 'server-only';
import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { AppRunnerClient, DescribeServiceCommand, ListOperationsCommand } from '@aws-sdk/client-apprunner';
import { CostExplorerClient, GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer';
import type { DataPayload, DeployOperation, DeployService, LogLevel, LogLine, Reach } from './types';
import { missingEnv, notSetUp, reach } from './reach';
import { logFilterPattern, logLevelOf, sumCostsByService } from './parse';
import { scrubText } from './mask';

/**
 * AWS readers for the developer console: CloudWatch Logs, App Runner and Cost Explorer. Each
 * uses the default credential chain (the App Runner instance role in AWS), one attempt, short
 * timeouts, and returns the "not set up" state when its env var is missing.
 *
 * Env: APP_LOG_GROUP, APP_RUNNER_SERVICE_ARN, AWS_COST_EXPLORER=on, AWS_REGION.
 * IAM: logs:FilterLogEvents on the group; apprunner:DescribeService and
 * apprunner:ListOperations on the service; ce:GetCostAndUsage.
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
      };
    });
    const level = opts.level ?? 'all';
    return lines.filter((l) => level === 'all' || l.level === level).sort((a, b) => b.at.localeCompare(a.at));
  });
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
