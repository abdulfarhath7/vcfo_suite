import type { AskMasker } from '@/lib/ask/mask';
import type { LlmMessage, LlmProvider, LlmRequest, LlmResult } from '@/lib/ask/provider';

/**
 * The one door between Ask VCFO and a model: every request is masked on the way out and every reply
 * unmasked on the way back (docs/specs/ask-vcfo/PRIVACY.md). Wrapping the provider, rather than each
 * prompt, means a new prompt, a tool result or a history line cannot forget to mask.
 *
 * Text, tool results and tool inputs are masked. Thinking blocks pass through untouched in both
 * directions: the model wrote them from masked text, and their signature must not change. Images and
 * PDFs cannot be masked; only the identity-document reader sends them, behind `ASK_ID_DOC_READING`.
 */

type Block = Record<string, unknown> & { type?: string };

function maskBlock(block: Block, masker: AskMasker): Block {
  switch (block.type) {
    case 'text':
      return { ...block, text: masker.mask(String(block.text ?? '')) };
    case 'tool_use':
      return { ...block, input: masker.maskDeep(block.input) };
    case 'tool_result':
      return {
        ...block,
        content:
          typeof block.content === 'string'
            ? masker.mask(block.content)
            : Array.isArray(block.content)
              ? (block.content as Block[]).map((inner) => maskBlock(inner, masker))
              : block.content,
      };
    default:
      return block;
  }
}

function maskMessage(message: LlmMessage, masker: AskMasker): LlmMessage {
  if (typeof message.content === 'string') return { ...message, content: masker.mask(message.content) };
  return { ...message, content: (message.content as unknown as Block[]).map((block) => maskBlock(block, masker)) } as LlmMessage;
}

export function maskRequest(req: LlmRequest, masker: AskMasker): LlmRequest {
  return {
    ...req,
    system: req.system.map((block) => ({ ...block, text: masker.mask(block.text) })),
    messages: req.messages.map((message) => maskMessage(message, masker)),
  };
}

function unmaskText(text: string, masker: AskMasker): string {
  // A JSON reply is restored value by value, so a restored value can never break its quoting.
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.stringify(masker.unmaskDeep(JSON.parse(trimmed)));
    } catch {
      // Not JSON after all: restore it as plain text.
    }
  }
  return masker.unmask(text);
}

export function unmaskResult(result: LlmResult, masker: AskMasker): LlmResult {
  return {
    ...result,
    content: result.content.map((block) => {
      if (block.type === 'text') return { ...block, text: unmaskText(block.text, masker) };
      if (block.type === 'tool_use') return { ...block, input: masker.unmaskDeep(block.input) };
      return block;
    }),
  };
}

export function maskingProvider(inner: LlmProvider, masker: AskMasker): LlmProvider {
  return {
    name: inner.name,
    async complete(req) {
      return unmaskResult(await inner.complete(maskRequest(req, masker)), masker);
    },
  };
}
