import "server-only";
import { resumeExperiment, runExperiment } from "@/application/experiments/run-experiment";
import type { DatasetEssay, ExperimentRun } from "@/application/experiments/types";
import { container, gradeDeps } from "@/infrastructure/container";

/**
 * Execuções de experimentos rodam em segundo plano dentro do processo do servidor;
 * a interface acompanha o progresso consultando o arquivo da execução.
 */
const g = globalThis as unknown as { __redaiaJobs?: Map<string, { cancelled: boolean }> };
const jobs = (g.__redaiaJobs ??= new Map());

export function startExperiment(run: ExperimentRun, essays: DatasetEssay[], mode: "full" | "resume" = "full") {
  const state = { cancelled: false };
  jobs.set(run.id, state);
  const deps = {
    ...gradeDeps(),
    repo: container().experimentRepo,
    isCancelled: () => state.cancelled,
    rateLimitPauses: container().config.experimentRateLimitPauses,
  };
  void (mode === "full" ? runExperiment : resumeExperiment)(run, essays, deps)
    .catch(async (err) => {
      run.status = "error";
      run.error = err instanceof Error ? err.message : String(err);
      run.finishedAt = new Date().toISOString();
      await container().experimentRepo.saveRun(run);
    })
    .finally(() => jobs.delete(run.id));
}

export function cancelExperiment(id: string) {
  const job = jobs.get(id);
  if (job) job.cancelled = true;
  return Boolean(job);
}

export const isRunning = (id: string) => jobs.has(id);
