import { chunkSearchText, KNOWLEDGE_INDEX_VERSION, type KnowledgeChunk, type KnowledgeIndex } from "@/domain/knowledge";
import type { EmbeddingProvider, KnowledgeIndexRepository } from "./ports";

/** Gera os embeddings dos chunks e persiste o índice vetorial. */
export async function buildKnowledgeIndex(
  chunks: KnowledgeChunk[],
  embeddings: EmbeddingProvider,
  repo: KnowledgeIndexRepository,
): Promise<KnowledgeIndex> {
  const vectors = await embeddings.embedPassages(chunks.map(chunkSearchText));
  if (vectors.length !== chunks.length) throw new Error("Número de embeddings difere do número de chunks.");
  const index: KnowledgeIndex = {
    version: KNOWLEDGE_INDEX_VERSION,
    provider: embeddings.id,
    model: embeddings.model,
    dimension: vectors[0]?.length ?? embeddings.dimension,
    createdAt: new Date().toISOString(),
    chunks: chunks.map((c, i) => ({ ...c, embedding: vectors[i]!.map((x) => Math.round(x * 1e6) / 1e6) })),
  };
  await repo.save(index);
  return index;
}

/** Verifica se o índice salvo corresponde ao conteúdo atual e ao provedor configurado. */
export function indexStatus(index: KnowledgeIndex | null, chunks: KnowledgeChunk[], embeddings: { id: string; model: string }) {
  if (!index) return { ok: false as const, reason: "Índice vetorial não encontrado. Rode `pnpm kb:index`." };
  if (index.version !== KNOWLEDGE_INDEX_VERSION) {
    return { ok: false as const, reason: "O formato do índice vetorial mudou. Rode `pnpm kb:index`." };
  }
  if (index.provider !== embeddings.id || index.model !== embeddings.model) {
    return {
      ok: false as const,
      reason: `Índice gerado com ${index.provider} (${index.model}), mas EMBEDDING_PROVIDER atual é ${embeddings.id}. Rode \`pnpm kb:index\`.`,
    };
  }
  const saved = new Set(index.chunks.map((c) => c.id));
  if (index.chunks.length !== chunks.length || chunks.some((c) => !saved.has(c.id))) {
    return { ok: false as const, reason: "A base de conhecimento mudou desde a indexação. Rode `pnpm kb:index`." };
  }
  return { ok: true as const, reason: null };
}
