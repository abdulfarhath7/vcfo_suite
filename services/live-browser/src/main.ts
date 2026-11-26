/**
 * Entry point: `node dist/server.mjs` (built by `build.mjs`). Reads the env (`config.ts`), serves
 * the mock portal inside the node when asked (so the image can be tested against the mock without
 * reaching any government host), keeps a browser warm and listens for Suite and the viewers.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { agentScript } from './agent-script';
import { Broker } from './broker';
import { configProblems, readConfig } from './config';
import { createBrokerServer } from './server';

const cfg = readConfig();
const problems = configProblems(cfg);
if (problems.length) {
  console.error(`[live-browser] not started: ${problems.join('; ')}`);
  process.exit(1);
}

if (cfg.mockPort) {
  // The extension's own mock server; it binds 127.0.0.1, so only this node's Chromium reaches it.
  const mod = (await import(pathToFileURL(path.join(cfg.mockDir, 'serve.mjs')).href)) as { startMockPortal(port: number): Promise<unknown> };
  await mod.startMockPortal(cfg.mockPort);
  console.log(`[live-browser] mock portal on http://127.0.0.1:${cfg.mockPort}`);
}

const broker = new Broker(cfg, await agentScript());
broker.startSweeper();
void broker.ensureWarm().catch((err: Error) => console.error(`[live-browser] warm browser failed: ${err.message}`));

const server = createBrokerServer(cfg, broker);
server.listen(cfg.port, () => console.log(`[live-browser] ${cfg.node} listening on :${cfg.port} (pool ${cfg.poolMax}, warm ${cfg.warm})`));

const shutdown = async () => {
  server.close();
  await broker.close();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
