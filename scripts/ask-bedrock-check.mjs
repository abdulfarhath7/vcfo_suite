#!/usr/bin/env node
// Ask VCFO: one tiny Bedrock call through the India inference profile, to prove the
// setup before go-live (docs/specs/ask-vcfo/BEDROCK-INDIA.md, step 6).
//
// It uses the same client the app uses in india mode (AnthropicBedrock, the
// bedrock-runtime endpoint) with the same guards: the region must be ap-south-1 or
// ap-south-2 and the model id must start with "in.". AWS credentials come from the
// standard chain (AWS_PROFILE, AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY, SSO, ...).
//
//   node scripts/ask-bedrock-check.mjs                       # FAST model, region from env or ap-south-1
//   node scripts/ask-bedrock-check.mjs --model in.anthropic.claude-sonnet-5 --region ap-south-2
//   node scripts/ask-bedrock-check.mjs --all                  # FAST and SMART
//   node scripts/ask-bedrock-check.mjs --dry-run              # print what would be called, no AWS call
//
// It makes two calls per model: a plain one, then one asking for JSON through
// output_config.format, which the guard and the field resolver rely on. The prompts
// are fixed test sentences with no client data; each call costs a few hundred tokens.
import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';

const INDIA_REGIONS = ['ap-south-1', 'ap-south-2'];
const DEFAULT_FAST = 'in.anthropic.claude-haiku-4-5-20251001-v1:0';
const DEFAULT_SMART = 'in.anthropic.claude-sonnet-5';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const region = value('--region') ?? process.env.ASK_VCFO_BEDROCK_REGION?.trim() ?? 'ap-south-1';
const fast = process.env.ASK_VCFO_BEDROCK_MODEL_FAST?.trim() || DEFAULT_FAST;
const smart = process.env.ASK_VCFO_BEDROCK_MODEL_SMART?.trim() || DEFAULT_SMART;
const models = value('--model') ? [value('--model')] : flag('--all') ? [fast, smart] : [fast];

function fail(message) {
  console.error(`FAIL  ${message}`);
  process.exitCode = 1;
}

if (!INDIA_REGIONS.includes(region)) {
  fail(`region "${region}" is not ap-south-1 or ap-south-2; the app would refuse it.`);
  process.exit(1);
}
for (const model of models) {
  if (!model.startsWith('in.')) {
    fail(`model "${model}" does not start with "in."; the app would refuse it (global., apac., us. and anthropic. ids can leave India).`);
    process.exit(1);
  }
}

const endpoint = `https://bedrock-runtime.${region}.amazonaws.com`;
console.log(`region    ${region}`);
console.log(`endpoint  ${endpoint}`);

if (flag('--dry-run')) {
  for (const model of models) console.log(`would call ${model}`);
  process.exit(0);
}

const client = new AnthropicBedrock({ awsRegion: region, baseURL: endpoint, maxRetries: 0, timeout: 60_000 });

for (const model of models) {
  const started = Date.now();
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
    });
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    console.log(`OK    ${model}`);
    console.log(`      requested model id  ${model}`);
    console.log(`      response model      ${response.model}`);
    console.log(`      region called       ${region}`);
    console.log(`      reply               ${JSON.stringify(text)}`);
    console.log(`      tokens in/out       ${response.usage.input_tokens}/${response.usage.output_tokens}`);
    console.log(`      took                ${Date.now() - started} ms`);
  } catch (err) {
    fail(`${model}: ${err?.status ?? ''} ${err?.message ?? err}`);
    console.error('      Check model access in the Mumbai console, the profile id, and the IAM grant (BEDROCK-INDIA.md).');
    continue;
  }
  // The guard, the field resolver and extraction ask for JSON through output_config.format.
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 64,
      messages: [{ role: 'user', content: 'Are you ready? Answer in JSON.' }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: { type: 'object', properties: { ready: { type: 'boolean' } }, required: ['ready'], additionalProperties: false },
        },
      },
    });
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    JSON.parse(text);
    console.log(`OK    ${model} structured output ${text}`);
  } catch (err) {
    fail(`${model} structured output: ${err?.status ?? ''} ${err?.message ?? err}`);
    console.error('      Ask paths that request JSON (guard, resolver, extraction) would fail on this model.');
  }
}
console.log('Then confirm the calls in CloudTrail (InvokeModel, event source bedrock.amazonaws.com) in', region);
