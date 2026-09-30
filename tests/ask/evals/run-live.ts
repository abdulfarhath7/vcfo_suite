/**
 * `npm run eval:live [-- --out <path>]` — the golden set against the REAL
 * guard and answer models (costs tokens; run on demand, never in CI). Needs
 * ANTHROPIC_API_KEY in .env.local (or ASK_VCFO_LLM_PROVIDER=bedrock +
 * ASK_VCFO_BEDROCK_REGION). No database: the client tools read fixture data,
 * and topics are the retrieval sources.
 *
 * Checks, per case with a `live` block: the guard's intent is one of the
 * expected intents; for answerable cases, the generated answer passes code
 * validation (dates, citations, visuals, links), honours `lineExcludes`, and
 * offers "Ask my lead" when required (the pipeline itself adds it to every
 * decision request, so that counts).
 *
 * `--out` writes a markdown report: date, provider, models, each case's
 * result, the intent seen vs expected, validation problems and token totals.
 */
import '../../../scripts/load-env';

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getIncorporationPhases } from '@/data/checklist';
import { SNAPSHOTS, GOLDEN, type EvalSnapshot } from './golden';
import { askConfig } from '@/lib/ask/config';
import { generateAnswer } from '@/lib/ask/generate';
import { runGuard } from '@/lib/ask/guard';
import { getAskProvider } from '@/lib/ask/provider';
import { CLIENT_TOOLS, type ClientToolContext } from '@/lib/ask/tools/client';
import { STAFF_TOOLS, type StaffData } from '@/lib/ask/tools/staff';
import { appliesTo, applicabilityFromSnapshot, listTopics } from '@/lib/ask/topics';
import { validateAnswer } from '@/lib/ask/validate';

interface CaseResult {
  id: string;
  category: string;
  pass: boolean;
  intentSeen: string;
  intentExpected: string;
  problems: string[];
  line: string;
  tools: string[];
}

/** Checklist state matching each fixture snapshot, so tools and snapshot agree. */
function stateFor(name: EvalSnapshot): ClientToolContext['state'] {
  const current = SNAPSHOTS[name].currentStep?.id;
  const state: Record<string, { status: string; completedOn: string }> = {};
  for (const item of getIncorporationPhases().flatMap((p) => p.items)) {
    if (item.id === current) break;
    state[item.id] = { status: 'completed', completedOn: '2026-09-01' };
  }
  return state as ClientToolContext['state'];
}

function outPath(argv: string[]): string | null {
  const at = argv.indexOf('--out');
  return at >= 0 && argv[at + 1] ? path.resolve(argv[at + 1]!) : null;
}

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

async function main() {
  const provider = await getAskProvider();
  if (!provider) {
    console.error('No provider configured. Set ANTHROPIC_API_KEY (or Bedrock env) and try again.');
    process.exit(2);
  }
  const config = askConfig();
  const out = outPath(process.argv.slice(2));
  const cases = GOLDEN.filter((c) => c.live && c.message);
  const results: CaseResult[] = [];
  const tokens = { guardIn: 0, guardOut: 0, answerIn: 0, answerOut: 0, cacheRead: 0 };
  const models = { guard: config.models.guard, answer: config.models.answer };

  for (const c of cases) {
    const live = c.live!;
    const snapshotName = c.snapshot ?? 'foreignCompany';
    const snapshot = c.shell === 'client' ? SNAPSHOTS[snapshotName] : null;
    const audience = c.shell === 'client' ? 'client' : 'staff';
    const problems: string[] = [];
    let intentSeen = '—';
    let line = '';
    let toolsCalled: string[] = [];
    try {
      const topics = listTopics().filter((t) => t.audience === 'both' || t.audience === audience);
      const guard = await runGuard(provider, {
        model: config.models.guard,
        shell: c.shell,
        message: c.message!,
        history: [],
        topics: topics.map((t) => ({ slug: t.slug, question: t.question })),
      });
      models.guard = guard.model;
      tokens.guardIn += guard.usage.inputTokens;
      tokens.guardOut += guard.usage.outputTokens;
      intentSeen = guard.result.intent;
      if (!live.intents.includes(guard.result.intent)) {
        problems.push(`intent ${guard.result.intent}, expected ${live.intents.join('|')}`);
      }
      const answerable = !['off_topic', 'unsafe', 'greeting'].includes(guard.result.intent);
      if (answerable) {
        const now = new Date();
        const clientCtx: ClientToolContext | null = snapshot
          ? {
              snapshot,
              state: stateFor(snapshotName),
              filings: [{ particular: 'GSTR-3B', dueDate: '2026-10-20', filedOn: null }],
              now,
            }
          : null;
        const staff: StaffData = { engagements: [], filings: [], now };
        const tools = clientCtx
          ? Object.values(CLIENT_TOOLS).map((t) => ({ definition: t.definition, run: (i: Record<string, unknown>) => t.run(clientCtx, i) }))
          : Object.values(STAFF_TOOLS).map((t) => ({ definition: t.definition, run: (i: Record<string, unknown>) => t.run(staff, i) }));
        const applicability = applicabilityFromSnapshot(snapshot);
        const sources = topics
          .filter((t) => appliesTo(t.appliesTo, applicability))
          .map((t) => ({ id: t.slug, kind: 'topic' as const, label: t.title, text: `${t.question}\n${t.body.detail}` }));
        // Draft topics as data only; plus any source text the case injects.
        for (const r of c.mock?.retrieved ?? []) sources.push({ id: r.id, kind: 'topic', label: r.label, text: r.text });
        const allowed = new Set<string>([
          ...sources.map((s) => s.id),
          ...topics.flatMap((t) => t.citations.map((x) => x.id)),
          ...tools.map((t) => t.definition.name),
        ]);
        const decision = guard.result.intent === 'decision_request';
        const generated = await generateAnswer({
          provider,
          model: config.models.answer,
          effort: config.answerEffort,
          shell: c.shell,
          firmName: 'SBC',
          snapshot,
          sources,
          history: [],
          message: c.message!,
          language: guard.result.language,
          depth: 'normal',
          decision,
          tools,
          validate: (raw, texts) =>
            validateAnswer(
              raw && typeof raw === 'object' ? { ...(raw as object), origin: 'generated', depth: 'normal' } : raw,
              { shell: c.shell, allowedCitationIds: allowed, toolResultTexts: texts },
            ),
        });
        models.answer = generated.model;
        tokens.answerIn += generated.usage.inputTokens;
        tokens.answerOut += generated.usage.outputTokens;
        tokens.cacheRead += generated.usage.cacheReadTokens;
        toolsCalled = generated.toolCalls.map((t) => t.name);
        const result = generated.result;
        if (result.ok !== true) {
          problems.push(`answer rejected: ${'errors' in result ? result.errors.join('; ') : 'unknown'}`);
          if ('textOnly' in result) line = result.textOnly;
        } else {
          line = result.answer.line;
          if (live.lineExcludes && live.lineExcludes.test(result.answer.line)) problems.push(`line matched ${live.lineExcludes}`);
          // The pipeline adds "Ask my lead" to every decision request itself.
          if (live.mustAskLead && !decision && !result.answer.actions.includes('askLead')) problems.push('no askLead action');
        }
      }
    } catch (error) {
      problems.push(`error: ${(error as Error).message}`);
    }
    results.push({
      id: c.id,
      category: c.category,
      pass: problems.length === 0,
      intentSeen,
      intentExpected: live.intents.join(' | '),
      problems,
      line,
      tools: toolsCalled,
    });
    console.log(`${problems.length === 0 ? 'PASS' : 'FAIL'}  ${c.id}${problems.length ? `  — ${problems.join(' / ')}` : ''}`);
  }

  const passed = results.filter((r) => r.pass).length;
  const totalIn = tokens.guardIn + tokens.answerIn;
  const totalOut = tokens.guardOut + tokens.answerOut;
  console.log(`\n${passed}/${results.length} live cases passed. Tokens: ${totalIn} in, ${totalOut} out.`);

  if (out) {
    const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const md = [
      `# Ask VCFO — live evaluation, ${date}`,
      '',
      'Generated by `npm run eval:live -- --out <path>`. The guard and answer models were called for real; project data is fixture data.',
      '',
      `- **Result:** ${passed} of ${results.length} cases passed`,
      `- **Provider:** ${provider.name}`,
      `- **Guard model:** ${models.guard}`,
      `- **Answer model:** ${models.answer} (effort ${config.answerEffort})`,
      `- **Tokens:** ${totalIn} input (${tokens.guardIn} guard, ${tokens.answerIn} answer; ${tokens.cacheRead} read from cache), ${totalOut} output (${tokens.guardOut} guard, ${tokens.answerOut} answer)`,
      '',
      '| Case | Category | Result | Intent seen | Intent expected | Problems |',
      '|---|---|---|---|---|---|',
      ...results.map(
        (r) =>
          `| ${r.id} | ${r.category} | ${r.pass ? 'pass' : '**FAIL**'} | ${r.intentSeen} | ${r.intentExpected} | ${cell(r.problems.join(' / ')) || '—'} |`,
      ),
      '',
      '## Answers (for human review)',
      '',
      ...results
        .filter((r) => r.line)
        .flatMap((r) => [`**${r.id}**${r.tools.length ? ` (tools: ${r.tools.join(', ')})` : ''}`, '', `> ${cell(r.line)}`, '']),
    ].join('\n');
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, `${md}\n`);
    console.log(`Report: ${path.relative(process.cwd(), out)}`);
  }
  process.exit(passed === results.length ? 0 : 1);
}

void main();
