import { backoffDelay, sleep } from './backoff';
import type { Config } from './config';
import type { Logger } from './log';
import { fetchVouchers, readCompanyName, TallyError } from './tally';
import { UnauthorizedError, VcfoClient, type Job, type JobResult } from './vcfo';
import { VERSION } from './version';

const HELLO_EVERY_MS = 10 * 60 * 1000;
/** Safety floor: if the server ever answers a poll instantly, wait this long so the loop cannot spin. */
const MIN_POLL_GAP_MS = 1_000;

async function tallyState(port: number) {
  try {
    return { tallyCompany: await readCompanyName(port), tallyReachable: true };
  } catch {
    return { tallyCompany: null, tallyReachable: false };
  }
}

async function runJob(job: Job, cfg: Config, log: Logger): Promise<JobResult> {
  try {
    const company = await readCompanyName(cfg.tallyPort);
    const vouchers = await fetchVouchers(cfg.tallyPort, job.type, job.from, job.to, company ?? undefined, (r, n) =>
      log.info(`job ${job.id}: ${r.from}..${r.to} -> ${n} vouchers`),
    );
    log.info(`job ${job.id}: ${vouchers.length} ${job.type} vouchers in total`);
    return { ok: true, company, vouchers };
  } catch (e) {
    const error = e instanceof TallyError ? e.message : `Unexpected error: ${(e as Error)?.message ?? e}`;
    log.error(`job ${job.id}: ${error}`);
    return { ok: false, error };
  }
}

/**
 * The main loop. One long-poll request is open at a time; there is no timer and no busy loop.
 * Returns only on 401 (the token was revoked), after printing the disconnect message.
 */
export async function runLoop(cfg: Config, log: Logger): Promise<void> {
  const client = new VcfoClient(cfg.baseUrl, cfg.token);
  let lastHello = 0;
  let failures = 0;

  log.info(`VCFO Tally Connector ${VERSION} started; sheet "${cfg.sheetName ?? ''}", Tally port ${cfg.tallyPort}`);

  for (;;) {
    try {
      if (Date.now() - lastHello >= HELLO_EVERY_MS) {
        const state = await tallyState(cfg.tallyPort);
        await client.hello({ version: VERSION, ...state });
        lastHello = Date.now();
        log.info(`hello sent; Tally ${state.tallyReachable ? 'reachable' : 'NOT reachable'}`);
      }

      const started = Date.now();
      const job = await client.nextJob();
      failures = 0;
      if (!job) {
        const elapsed = Date.now() - started;
        if (elapsed < MIN_POLL_GAP_MS) await sleep(MIN_POLL_GAP_MS - elapsed);
        continue;
      }

      log.info(`job ${job.id}: ${job.type} ${job.from}..${job.to}`);
      const result = await runJob(job, cfg, log);
      await client.postResult(job.id, result);
      log.info(`job ${job.id}: result uploaded (${result.ok ? `${result.vouchers.length} vouchers` : 'error'})`);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        log.error(e.message);
        return;
      }
      failures++;
      const wait = backoffDelay(failures);
      log.warn(`network problem talking to VCFO (${(e as Error)?.message ?? e}); retrying in ${wait / 1000} s`);
      await sleep(wait);
    }
  }
}
