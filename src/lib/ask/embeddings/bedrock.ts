import 'server-only';

import { EMBEDDING_DIMENSIONS, type EmbeddingProvider } from './types';

/** Titan takes one text per call, so a batch runs a few calls at a time, in input order. */
const CONCURRENCY = 5;

type BedrockSdk = Pick<typeof import('@aws-sdk/client-bedrock-runtime'), 'BedrockRuntimeClient' | 'InvokeModelCommand'>;

/**
 * Titan Text Embeddings V2 on demand. The SDK loads on the first call, so a `none` machine never pays
 * for it. It loads once, and the client and its command come from that one module: a client and a
 * command from two loads can differ, and the client then cannot run the command.
 */
export function bedrockEmbeddingProvider(region: string, model: string, load: () => Promise<BedrockSdk> = () => import('@aws-sdk/client-bedrock-runtime')): EmbeddingProvider {
  let sdk: Promise<{ client: InstanceType<BedrockSdk['BedrockRuntimeClient']>; Command: BedrockSdk['InvokeModelCommand'] }> | null = null;
  const connect = () =>
    (sdk ??= load().then(({ BedrockRuntimeClient, InvokeModelCommand }) => ({
      client: new BedrockRuntimeClient({ region, maxAttempts: 2, requestHandler: { connectionTimeout: 2_000, requestTimeout: 10_000 } }),
      Command: InvokeModelCommand,
    })));

  const embedOne = async (text: string): Promise<number[]> => {
    const { client, Command } = await connect();
    const response = await client.send(
      new Command({
        modelId: model,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({ inputText: text, dimensions: EMBEDDING_DIMENSIONS, normalize: true }),
      }),
    );
    const { embedding } = JSON.parse(new TextDecoder().decode(response.body)) as { embedding?: number[] };
    if (embedding?.length !== EMBEDDING_DIMENSIONS) throw new Error(`Titan returned ${embedding?.length ?? 0} dimensions`);
    return embedding;
  };

  return {
    name: 'bedrock',
    model,
    async embed(texts) {
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += CONCURRENCY) {
        out.push(...(await Promise.all(texts.slice(i, i + CONCURRENCY).map(embedOne))));
      }
      return out;
    },
  };
}
