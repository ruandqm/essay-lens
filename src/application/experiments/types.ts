import { z } from "zod";
import type { CompetencyId, GradingMode } from "@/domain/competencies";

export const CompScoresSchema = z.object({
  1: z.number().min(0).max(200),
  2: z.number().min(0).max(200),
  3: z.number().min(0).max(200),
  4: z.number().min(0).max(200),
  5: z.number().min(0).max(200),
});

export const DatasetEssaySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  tema: z.string().min(1),
  texto: z.string().min(1),
  textosMotivadores: z.string().default(""),
  human: CompScoresSchema,
  notes: z.string().default(""),
});
export type DatasetEssay = z.infer<typeof DatasetEssaySchema>;

export interface RunResultEntry {
  essayId: string;
  mode: GradingMode;
  repetition: number;
  scores: Record<CompetencyId, number> | null;
  total: number | null;
  annulled: boolean;
  retrievedIds: Record<CompetencyId, string[]>;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  error: string | null;
  gradingId: string | null;
  /** Modo RAG: IDs dos trechos que o modelo declarou aplicáveis à redação, por competência. */
  ragApplied?: Record<CompetencyId, string[]>;
}

export interface ExperimentRun {
  id: string;
  name: string;
  createdAt: string;
  finishedAt: string | null;
  /** "paused": parada por limite do Gemini que não liberou; pode ser retomada. */
  status: "running" | "done" | "error" | "cancelled" | "paused";
  config: {
    model: string;
    embeddingModel: string;
    modes: GradingMode[];
    repetitions: number;
    essayIds: string[];
    rag: { topK: number; minDenseZ: number; bm25MaxRank: number; rrfK: number };
  };
  progress: {
    done: number;
    total: number;
    current: string | null;
    /** Preenchido enquanto a execução espera o limite do Gemini liberar. */
    waitingUntil?: string | null;
  };
  results: RunResultEntry[];
  /** Cópia das notas humanas no momento da execução (o dataset pode mudar depois). */
  human: Record<string, { label: string; scores: Record<CompetencyId, number> }>;
  error: string | null;
}
