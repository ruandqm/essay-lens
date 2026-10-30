import "server-only";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { indexStatus } from "@/application/build-index";
import { pendingJobs, runToPredictions } from "@/application/experiments/run-experiment";
import { DatasetEssaySchema, type ExperimentRun } from "@/application/experiments/types";
import { gradeEssay, GradeInputSchema } from "@/application/grade-essay";
import { COMPETENCY_IDS } from "@/domain/competencies";
import { compareModes, modeMetrics } from "@/domain/metrics";
import { container, getRetriever, gradeDeps } from "@/infrastructure/container";
import { KNOWLEDGE_CHUNKS } from "@/knowledge";
import { FIXED_RUBRIC } from "@/knowledge/rubric";
import { cancelExperiment, isRunning, startExperiment } from "./experiment-jobs";
import { publicProcedure, router } from "./trpc";

const systemRouter = router({
  status: publicProcedure.query(async () => {
    const c = container();
    const index = await c.indexRepo.load();
    const status = indexStatus(index, KNOWLEDGE_CHUNKS, c.embeddings);
    return {
      geminiConfigured: Boolean(c.config.geminiApiKey),
      model: c.config.geminiModel,
      embedding: { provider: c.embeddings.id, model: c.embeddings.model },
      index: { ok: status.ok, reason: status.reason, createdAt: index?.createdAt ?? null, chunks: index?.chunks.length ?? 0 },
      rag: c.config.rag,
    };
  }),
});

const essayRouter = router({
  grade: publicProcedure.input(GradeInputSchema).mutation(async ({ input }) => {
    const { result } = await gradeEssay(input, gradeDeps());
    return result;
  }),
});

const knowledgeRouter = router({
  chunks: publicProcedure.query(() => ({
    chunks: KNOWLEDGE_CHUNKS,
    rubric: FIXED_RUBRIC,
  })),
  stats: publicProcedure.query(async () => {
    const index = await container().indexRepo.load();
    return {
      dimension: index?.dimension ?? null,
      model: index?.model ?? null,
      rows: COMPETENCY_IDS.map((c) => {
        const cs = KNOWLEDGE_CHUNKS.filter((x) => x.competency === c);
        return {
          competency: c,
          chunks: cs.length,
          embeddings: index?.chunks.filter((x) => x.competency === c).length ?? 0,
          regras: cs.filter((x) => x.type === "regra").length,
          casosLimite: cs.filter((x) => x.type === "caso-limite").length,
        };
      }),
    };
  }),
  /** Inspeciona a recuperação (Lab RAG): pontuações de cada canal para cada chunk. */
  inspect: publicProcedure
    .input(z.object({ tema: z.string().default(""), texto: z.string().min(20), textosMotivadores: z.string().default("") }))
    .mutation(async ({ input }) => {
      const retriever = await getRetriever();
      const r = await retriever.retrieve({ tema: input.tema, texto: input.texto, motivadores: input.textosMotivadores });
      return {
        latencyMs: r.latencyMs,
        situations: r.situations,
        competencies: COMPETENCY_IDS.map((c) => ({
          competency: c,
          items: r.byCompetency[c].map((s) => ({
            id: s.chunk.id,
            title: s.chunk.title,
            type: s.chunk.type,
            text: s.chunk.text,
            dense: s.dense,
            routed: s.routed,
            denseZ: s.denseZ,
            denseRank: s.denseRank,
            bm25: s.bm25,
            bm25Rank: s.bm25Rank,
            routeHits: s.routeHits,
            rrf: s.rrf,
            eligible: s.eligible,
            selected: s.selected,
          })),
        })),
      };
    }),
});

const datasetRouter = router({
  list: publicProcedure.query(() => container().experimentRepo.listDataset()),
  upsert: publicProcedure.input(DatasetEssaySchema).mutation(async ({ input }) => {
    const repo = container().experimentRepo;
    const items = await repo.listDataset();
    const i = items.findIndex((x) => x.id === input.id);
    if (i >= 0) items[i] = input;
    else items.push(input);
    await repo.saveDataset(items);
    return input;
  }),
  remove: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const repo = container().experimentRepo;
    await repo.saveDataset((await repo.listDataset()).filter((x) => x.id !== input.id));
  }),
  import: publicProcedure
    .input(z.object({ items: z.array(DatasetEssaySchema), replace: z.boolean().default(false) }))
    .mutation(async ({ input }) => {
      const repo = container().experimentRepo;
      const current = input.replace ? [] : await repo.listDataset();
      const byId = new Map(current.map((x) => [x.id, x]));
      for (const item of input.items) byId.set(item.id, item);
      await repo.saveDataset([...byId.values()]);
      return { count: input.items.length };
    }),
});

const runRouter = router({
  list: publicProcedure.query(async () =>
    (await container().experimentRepo.listRuns()).map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt,
      finishedAt: r.finishedAt,
      status: r.status,
      progress: r.progress,
      config: r.config,
      errors: r.results.filter((x) => x.error).length,
      pending: Math.max(0, r.config.essayIds.length * r.config.modes.length * r.config.repetitions - r.results.filter((x) => !x.error).length),
    })),
  ),
  get: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const run = await container().experimentRepo.getRun(input.id);
    if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Execução não encontrada." });
    // Execução interrompida por reinício do servidor.
    if (run.status === "running" && !isRunning(run.id)) {
      run.status = "cancelled";
      run.error = "Execução interrompida (o servidor foi reiniciado). Use “Retomar” para continuar de onde parou.";
      run.progress.current = null;
      run.progress.waitingUntil = null;
      await container().experimentRepo.saveRun(run);
    }
    const rows = runToPredictions(run);
    return {
      run,
      rows,
      metrics: {
        baseline: modeMetrics(rows, "baseline"),
        rag: modeMetrics(rows, "rag"),
        comparison: compareModes(rows),
      },
    };
  }),
  start: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(80),
        essayIds: z.array(z.string()).min(1, "Selecione ao menos uma redação."),
        modes: z.array(z.enum(["baseline", "rag"])).min(1),
        repetitions: z.number().int().min(1).max(10),
      }),
    )
    .mutation(async ({ input }) => {
      const c = container();
      const dataset = await c.experimentRepo.listDataset();
      const essays = dataset.filter((e) => input.essayIds.includes(e.id));
      if (!essays.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhuma redação encontrada." });
      gradeDeps(); // valida a chave do Gemini antes de iniciar
      if (input.modes.includes("rag")) await getRetriever();
      const run: ExperimentRun = {
        id: `${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 6)}`,
        name: input.name,
        createdAt: new Date().toISOString(),
        finishedAt: null,
        status: "running",
        config: {
          model: c.config.geminiModel,
          embeddingModel: c.embeddings.model,
          modes: input.modes,
          repetitions: input.repetitions,
          essayIds: essays.map((e) => e.id),
          rag: c.config.rag,
        },
        progress: { done: 0, total: 0, current: null },
        results: [],
        human: Object.fromEntries(essays.map((e) => [e.id, { label: e.label, scores: e.human }])),
        error: null,
      };
      await c.experimentRepo.saveRun(run);
      startExperiment(run, essays);
      return { id: run.id };
    }),
  resume: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const c = container();
    const run = await c.experimentRepo.getRun(input.id);
    if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Execução não encontrada." });
    if (isRunning(run.id)) throw new TRPCError({ code: "CONFLICT", message: "Esta execução ainda está em andamento." });
    const jobs = pendingJobs(run, await c.experimentRepo.listDataset());
    if (!jobs.length)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: run.results.some((r) => r.error)
          ? "As redações pendentes não estão mais no dataset."
          : "Não há correções pendentes nesta execução.",
      });
    gradeDeps(); // valida a chave do Gemini antes de iniciar
    if (jobs.some((j) => j.mode === "rag")) await getRetriever();
    startExperiment(run, await c.experimentRepo.listDataset(), "resume");
    return { id: run.id, count: jobs.length };
  }),
  cancel: publicProcedure.input(z.object({ id: z.string() })).mutation(({ input }) => cancelExperiment(input.id)),
  remove: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    cancelExperiment(input.id);
    await container().experimentRepo.deleteRun(input.id);
  }),
});

export const appRouter = router({
  system: systemRouter,
  essay: essayRouter,
  knowledge: knowledgeRouter,
  dataset: datasetRouter,
  run: runRouter,
});

export type AppRouter = typeof appRouter;
