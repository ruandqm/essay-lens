import "server-only";
import { indexStatus } from "@/application/build-index";
import type { GradeDeps } from "@/application/grade-essay";
import type { EmbeddingProvider, ExperimentRepository, KnowledgeIndexRepository, LlmClient } from "@/application/ports";
import { HybridRetriever } from "@/application/rag/retriever";
import { KNOWLEDGE_CHUNKS } from "@/knowledge";
import { getConfig } from "./config";
import { createEmbeddingProvider } from "./embeddings/providers";
import { GeminiLlmClient } from "./llm/gemini-client";
import { FileExperimentRepository, FileKnowledgeIndexRepository } from "./repositories";

/**
 * Raiz de composição: liga as portas da aplicação às implementações concretas.
 * As instâncias ficam em globalThis para sobreviver ao hot reload do Next.js.
 */
interface Container {
  version: number;
  config: ReturnType<typeof getConfig>;
  indexRepo: KnowledgeIndexRepository;
  experimentRepo: ExperimentRepository;
  embeddings: EmbeddingProvider;
  llm: LlmClient | null;
  retriever: Promise<HybridRetriever> | null;
}

const g = globalThis as unknown as { __redaia?: Container };

/**
 * Suba este número quando mudar o cliente do LLM, o recuperador ou o formato do índice:
 * o servidor em execução recria as instâncias no próximo hot reload, sem precisar reiniciar.
 */
const CONTAINER_VERSION = 7;

export function container(): Container {
  if (!g.__redaia || g.__redaia.version !== CONTAINER_VERSION) {
    const config = getConfig();
    const previous = g.__redaia;
    g.__redaia = {
      version: CONTAINER_VERSION,
      config,
      indexRepo: new FileKnowledgeIndexRepository(config.paths.index),
      experimentRepo: new FileExperimentRepository(config.paths.dataset, config.paths.runs),
      // O modelo de embeddings é caro de carregar e não mudou: reaproveita se o provedor for o mesmo.
      embeddings: previous?.embeddings.id === config.embeddingProvider ? previous.embeddings : createEmbeddingProvider(config),
      llm: null,
      retriever: null,
    };
  }
  return g.__redaia;
}

export function getLlm(): LlmClient {
  const c = container();
  if (!c.llm) {
    c.llm = new GeminiLlmClient(
      c.config.geminiApiKey,
      c.config.geminiModel,
      c.config.temperature,
      c.config.maxConcurrency,
      c.config.rateLimitMaxWaitMs,
    );
  }
  return c.llm;
}

export function getRetriever(): Promise<HybridRetriever> {
  const c = container();
  if (!c.retriever) {
    c.retriever = (async () => {
      const index = await c.indexRepo.load();
      const status = indexStatus(index, KNOWLEDGE_CHUNKS, c.embeddings);
      if (!status.ok) throw new Error(status.reason);
      return new HybridRetriever(index!, c.embeddings, c.config.rag);
    })();
    c.retriever.catch(() => (c.retriever = null));
  }
  return c.retriever;
}

export function gradeDeps(): GradeDeps {
  const c = container();
  return { llm: getLlm(), getRetriever, embeddingModel: c.embeddings.model };
}
