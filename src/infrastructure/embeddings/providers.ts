import { GoogleGenAI } from "@google/genai";
import type { EmbeddingProvider } from "@/application/ports";
import type { AppConfig } from "../config";

/**
 * FastEmbed com multilingual-e5-large: 1024 dimensões,
 * executado localmente via ONNX Runtime. O modelo (~2 GB) é baixado na primeira execução.
 */
export class FastEmbedProvider implements EmbeddingProvider {
  readonly id = "fastembed";
  readonly model = "intfloat/multilingual-e5-large";
  readonly dimension = 1024;
  private static instance: Promise<import("fastembed").FlagEmbedding> | null = null;

  constructor(private readonly cacheDir: string) {}

  private load() {
    if (!FastEmbedProvider.instance) {
      FastEmbedProvider.instance = import("fastembed").then(({ FlagEmbedding, EmbeddingModel }) =>
        FlagEmbedding.init({ model: EmbeddingModel.MLE5Large, cacheDir: this.cacheDir, showDownloadProgress: false }),
      );
      FastEmbedProvider.instance.catch(() => (FastEmbedProvider.instance = null));
    }
    return FastEmbedProvider.instance;
  }

  async embedQueries(texts: string[]) {
    const m = await this.load();
    const out: number[][] = [];
    for (const t of texts) out.push(Array.from(await m.queryEmbed(t)));
    return out;
  }

  async embedPassages(texts: string[]) {
    const m = await this.load();
    const out: number[][] = [];
    for await (const batch of m.passageEmbed(texts, 16)) out.push(...batch.map((v) => Array.from(v)));
    return out;
  }
}

/** Alternativa sem download local: gemini-embedding-001 reduzido para 1024 dimensões. */
export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly id = "gemini";
  readonly dimension = 1024;
  private ai: GoogleGenAI;

  constructor(
    apiKey: string,
    readonly model: string,
  ) {
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada (necessária para EMBEDDING_PROVIDER=gemini).");
    this.ai = new GoogleGenAI({ apiKey });
  }

  private async embed(texts: string[], taskType: string) {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 50) {
      const res = await this.ai.models.embedContent({
        model: this.model,
        contents: texts.slice(i, i + 50),
        config: { taskType, outputDimensionality: this.dimension },
      });
      out.push(...(res.embeddings ?? []).map((e) => e.values ?? []));
    }
    return out;
  }

  embedQueries(texts: string[]) {
    return this.embed(texts, "RETRIEVAL_QUERY");
  }
  embedPassages(texts: string[]) {
    return this.embed(texts, "RETRIEVAL_DOCUMENT");
  }
}

export function createEmbeddingProvider(config: AppConfig): EmbeddingProvider {
  return config.embeddingProvider === "gemini"
    ? new GeminiEmbeddingProvider(config.geminiApiKey, config.geminiEmbeddingModel)
    : new FastEmbedProvider(config.paths.fastembedCache);
}
