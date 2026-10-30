import type { ZodType } from "zod";
import type { KnowledgeIndex } from "@/domain/knowledge";
import type { ExperimentRun, DatasetEssay } from "./experiments/types";

/**
 * Limite de requisições do provedor de LLM (HTTP 429) que persistiu após as
 * retentativas do cliente. Quem orquestra (ex.: experimentos) decide se espera e tenta de novo.
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    /** Espera sugerida pelo provedor, se informada. */
    readonly retryAfterMs: number | null = null,
    /** Cota diária esgotada: esperar alguns minutos não resolve. */
    readonly daily = false,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

export const isRateLimitError = (err: unknown): err is RateLimitError =>
  err instanceof RateLimitError || (err instanceof Error && err.name === "RateLimitError");

/** Porta de embeddings (FastEmbed local ou Gemini). */
export interface EmbeddingProvider {
  readonly id: string;
  readonly model: string;
  readonly dimension: number;
  embedQueries(texts: string[]): Promise<number[][]>;
  embedPassages(texts: string[]): Promise<number[][]>;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmJsonRequest<T> {
  system: string;
  prompt: string;
  schema: ZodType<T>;
  /** Nome curto para logs/erros. */
  label: string;
}

export interface LlmJsonResponse<T> {
  data: T;
  usage: LlmUsage;
  latencyMs: number;
}

/** Porta do modelo de linguagem com saída JSON estruturada. */
export interface LlmClient {
  readonly model: string;
  generateJson<T>(req: LlmJsonRequest<T>): Promise<LlmJsonResponse<T>>;
}

export interface KnowledgeIndexRepository {
  load(): Promise<KnowledgeIndex | null>;
  save(index: KnowledgeIndex): Promise<void>;
}

export interface ExperimentRepository {
  listDataset(): Promise<DatasetEssay[]>;
  saveDataset(items: DatasetEssay[]): Promise<void>;
  listRuns(): Promise<ExperimentRun[]>;
  getRun(id: string): Promise<ExperimentRun | null>;
  saveRun(run: ExperimentRun): Promise<void>;
  deleteRun(id: string): Promise<void>;
}
