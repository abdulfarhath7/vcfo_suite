import 'server-only';

import { AnthropicBedrock, AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';
import { outputConfigFor, toLlmResult, type LlmProvider, type LlmRequest, type LlmResult } from './index';
import { assertIndiaModelId, assertIndiaRegion, AskResidencyError } from './residency';

/** The request body both Bedrock endpoints accept (the Messages API shape). */
function body(req: LlmRequest, model: string, opts: { effort: boolean }) {
  return {
    model,
    max_tokens: req.maxTokens,
    system: req.system,
    messages: req.messages,
    ...(req.tools && req.tools.length > 0 ? { tools: req.tools, tool_choice: { type: 'auto' as const } } : {}),
    ...outputConfigFor(opts.effort ? req : { ...req, effort: undefined }),
    ...(req.thinking === 'off' ? { thinking: { type: 'disabled' as const } } : {}),
  };
}

/**
 * Amazon Bedrock adapter on the Mantle Messages endpoint, used only when
 * ASK_VCFO_DATA_RESIDENCY=none. Anthropic's region table lists Mumbai and Hyderabad as "Global"
 * only on Mantle, so this path can process prompts outside India. AWS credentials come from the
 * standard provider chain (the App Runner instance role in AWS). Ids without `anthropic.` get one.
 */
export function createBedrockProvider(region: string): LlmProvider {
  const client = new AnthropicBedrockMantle({ awsRegion: region, maxRetries: 2, timeout: 60_000 });
  const modelId = (model: string) => (model.startsWith('anthropic.') ? model : `anthropic.${model}`);
  return {
    name: 'bedrock',
    async complete(req: LlmRequest): Promise<LlmResult> {
      const response = await client.beta.messages.create(body(req, modelId(req.model), { effort: true }), req.timeoutMs ? { timeout: req.timeoutMs } : undefined);
      return toLlmResult(response);
    },
  };
}

/** A Bedrock call that failed in India mode. It is reported, never retried on another provider. */
export class AskBedrockError extends Error {
  constructor(model: string, region: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`Amazon Bedrock (${region}, ${model}) failed: ${detail}`, { cause });
    this.name = 'AskBedrockError';
  }
}

/** Haiku 4.5 rejects the effort parameter; the India profile's other models accept it. */
const acceptsEffort = (model: string) => !model.includes('haiku-4-5');

/**
 * Amazon Bedrock adapter for India data residency. It uses the bedrock-runtime endpoint
 * (InvokeModel and InvokeModelWithResponseStream through `AnthropicBedrock`), which is where AWS
 * documents the India geographic inference profile, and not Mantle, whose Mumbai entry is Global
 * only. The region must be ap-south-1 or ap-south-2 and every model id must start with `in.`; both
 * are checked here and again on every call. The base URL is pinned so ANTHROPIC_BEDROCK_BASE_URL
 * cannot redirect calls elsewhere. Bedrock has no server-side refusal fallback, so none is sent.
 * The result reports the profile id that was invoked, so metering records where the call went.
 */
export function createBedrockIndiaProvider(region: string, opts: { client?: Pick<AnthropicBedrock, 'beta'> } = {}): LlmProvider {
  assertIndiaRegion(region);
  const client =
    opts.client ??
    new AnthropicBedrock({ awsRegion: region, baseURL: `https://bedrock-runtime.${region}.amazonaws.com`, maxRetries: 2, timeout: 60_000 });
  return {
    name: 'bedrock-india',
    async complete(req: LlmRequest): Promise<LlmResult> {
      assertIndiaModelId(req.model);
      let response;
      try {
        response = await client.beta.messages.create(body(req, req.model, { effort: acceptsEffort(req.model) }), req.timeoutMs ? { timeout: req.timeoutMs } : undefined);
      } catch (err) {
        if (err instanceof AskResidencyError) throw err;
        throw new AskBedrockError(req.model, region, err);
      }
      return { ...toLlmResult(response), model: req.model };
    },
  };
}
