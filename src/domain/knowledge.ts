import type { CompetencyId } from "./competencies";

export type ChunkType = "regra" | "caso-limite";

/** Trecho normativo autocontido, extraído dos manuais de correção do INEP. */
export interface KnowledgeChunkSource {
  competency: CompetencyId;
  source: string;
  type: ChunkType;
  title: string;
  text: string;
  /** IDs de situações detectáveis (ver `application/rag/situations.ts`) que roteiam para este chunk. */
  situations: string[];
}

export interface KnowledgeChunk extends KnowledgeChunkSource {
  /** comp{N}-{hash}: citado pelo modelo em `trechoRecuperadoId`. */
  id: string;
}

export interface IndexedChunk extends KnowledgeChunk {
  embedding: number[];
}

export const KNOWLEDGE_INDEX_VERSION = 1;

export interface KnowledgeIndex {
  version: typeof KNOWLEDGE_INDEX_VERSION;
  provider: string;
  model: string;
  dimension: number;
  createdAt: string;
  chunks: IndexedChunk[];
}

/** Hash FNV-1a de 40 bits (10 hex) — determinístico em Node e no navegador. */
export function shortHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")).slice(0, 10);
}

export function withId(chunk: KnowledgeChunkSource): KnowledgeChunk {
  return { id: `comp${chunk.competency}-${shortHash(`${chunk.title}\n${chunk.text}`)}`, ...chunk };
}

/** Texto usado para embedding e BM25 (título reforça o tópico). */
export const chunkSearchText = (c: KnowledgeChunkSource) => `[${c.title}]\n${c.text}`;
