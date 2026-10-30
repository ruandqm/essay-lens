import { withId, type KnowledgeChunk } from "@/domain/knowledge";
import { C1_CHUNKS } from "./chunks/c1";
import { C2_CHUNKS } from "./chunks/c2";
import { C3_CHUNKS } from "./chunks/c3";
import { C4_CHUNKS } from "./chunks/c4";
import { C5_CHUNKS } from "./chunks/c5";

/** Todos os chunks recuperáveis via RAG, com IDs determinísticos comp{N}-{hash}. */
export const KNOWLEDGE_CHUNKS: KnowledgeChunk[] = [
  ...C1_CHUNKS,
  ...C2_CHUNKS,
  ...C3_CHUNKS,
  ...C4_CHUNKS,
  ...C5_CHUNKS,
].map(withId);
