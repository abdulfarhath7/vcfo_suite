/**
 * `npm run eval:live` — the golden set against the REAL guard and answer
 * models (costs tokens; run on demand, never in CI). Needs ANTHROPIC_API_KEY
 * (or ASK_VCFO_LLM_PROVIDER=bedrock + ASK_VCFO_BEDROCK_REGION). No database: the
 * client tools read fixture data, and topics are the retrieval sources.
 *
 * Checks, per case with a `live` block: the guard's intent is one of the
 * expected intents; for answerable cases, the generated answer passes code
 * validation (dates, citations, visuals), honours `lineExcludes`, and offers
 * "Ask my lead" when required.
 */
import { SNAPSHOTS, GOLDEN } from './golden';
import { askConfig } from '@/lib/ask/config';
import { generateAnswer } from '@/lib/ask/generate';
import { runGuard } from '@/lib/ask/guard';
import { getAskProvider } from '@/lib/ask/provider';
import { CLIENT_TOOLS, type ClientToolContext } from '@/lib/ask/tools/client';
import { STAFF_TOOLS, type StaffData } from '@/lib/ask/tools/staff';
import { appliesTo, applicabilityFromSnapshot, listTopics } from '@/lib/ask/topics';
import { validateAnswer } from '@/lib/ask/validate';

async function main() {
  const provider = await getAskProvider();
  if (!provider) {
    console.error('No provider configured. Set ANTHROPIC_API_KEY (or Bedrock env) and try again.');
    process.exit(2);
  }
  const config = askConfig();
  const cases = GOLDEN.filter((c) => c.live && c.message);
  let failed = 0;

  for (const c of cases) {
    const live = c.live!;
    const snapshot = c.shell === 'client' ? SNAPSHOTS[c.snapshot ?? 'foreignCompany'] : null;
    const audience = c.shell === 'client' ? 'client' : 'staff';
    const problems: string[] = [];
    try {
      const topics = listTopics().filter((t) => t.audience === 'both' || t.audience === audience);
      const guard = await runGuard(provider, {
        model: config.models.guard,
        shell: c.shell,
        message: c.message!,
        history: [],
        topics: topics.map((t) => ({ slug: t.slug, question: t.question })),
      });
      if (!live.intents.includes(guard.result.intent)) {
        problems.push(`intent ${guard.result.intent}, expected ${live.intents.join('|')}`);
      }
      const answerable = !['off_topic', 'unsafe', 'greeting'].includes(guard.result.intent);
      if (answerable) {
        const now = new Date();
        const clientCtx: ClientToolContext | null = snapshot
          ? { snapshot, state: {}, filings: [{ particular: 'GSTR-3B', dueDate: '2026-10-20', filedOn: null }], now }
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
        const out = await generateAnswer({
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
          decision: guard.result.intent === 'decision_request',
          tools,
          validate: (raw, texts) =>
            validateAnswer(
              raw && typeof raw === 'object' ? { ...(raw as object), origin: 'generated', depth: 'normal' } : raw,
              { shell: c.shell, allowedCitationIds: allowed, toolResultTexts: texts },
            ),
        });
        const result = out.result;
        if (result.ok !== true) {
          problems.push(`answer rejected: ${'errors' in result ? result.errors.join('; ') : 'unknown'}`);
        } else {
          if (live.lineExcludes && live.lineExcludes.test(result.answer.line)) problems.push(`line matched ${live.lineExcludes}`);
          if (live.mustAskLead && !result.answer.actions.includes('askLead')) problems.push('no askLead action');
        }
      }
    } catch (error) {
      problems.push(`error: ${(error as Error).message}`);
    }
    if (problems.length > 0) failed += 1;
    console.log(`${problems.length === 0 ? 'PASS' : 'FAIL'}  ${c.id}${problems.length ? `  — ${problems.join(' / ')}` : ''}`);
  }
  console.log(`\n${cases.length - failed}/${cases.length} live cases passed.`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
