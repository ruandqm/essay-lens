import { COMPETENCY_IDS, type CompetencyId, type GradingMode } from "@/domain/competencies";
import type { CompScores, EssayPredictions } from "@/domain/metrics";
import { gradeEssay, type GradeDeps } from "../grade-essay";
import { memoizeLlm } from "../llm-memo";
import { isRateLimitError, type ExperimentRepository } from "../ports";
import type { DatasetEssay, ExperimentRun, RunResultEntry } from "./types";

export interface RunExperimentDeps extends GradeDeps {
  repo: ExperimentRepository;
  isCancelled?: () => boolean;
  onProgress?: (run: ExperimentRun) => void;
  /**
   * Quantas vezes uma correção espera o limite do Gemini liberar antes de a execução
   * ser pausada (esperas de 30 s, 1, 2, 4 e depois 5 min). Padrão: 8 (~27 min).
   */
  rateLimitPauses?: number;
  /** Espera injetável (testes). */
  sleep?: (ms: number) => Promise<void>;
}

const emptyRetrieved = () =>
  Object.fromEntries(COMPETENCY_IDS.map((c) => [c, [] as string[]])) as Record<CompetencyId, string[]>;

type Job = { essay: DatasetEssay; mode: GradingMode; repetition: number };

const jobKey = (j: { essayId: string; mode: GradingMode; repetition: number }) => `${j.essayId}|${j.mode}|${j.repetition}`;
const jobLabel = (j: Job) => `${j.essay.label} · ${j.mode === "rag" ? "com RAG" : "sem RAG"} · rep. ${j.repetition}`;

/** Espera de cada pausa por limite: 30 s, 1 min, 2 min, 4 min e depois 5 min. */
export const rateLimitPauseMs = (pause: number) => Math.min(300_000, 30_000 * 2 ** (pause - 1));

/** Todas as correções previstas pelo protocolo da execução. */
function plannedJobs(run: ExperimentRun, essays: DatasetEssay[]): Job[] {
  const byId = new Map(essays.map((e) => [e.id, e]));
  const jobs: Job[] = [];
  for (let r = 1; r <= run.config.repetitions; r++)
    for (const id of run.config.essayIds) {
      const essay = byId.get(id);
      if (essay) for (const mode of run.config.modes) jobs.push({ essay, mode, repetition: r });
    }
  return jobs;
}

/** Executa o protocolo de avaliação: cada redação corrigida sem RAG e com RAG (N repetições). */
export async function runExperiment(
  run: ExperimentRun,
  essays: DatasetEssay[],
  deps: RunExperimentDeps,
): Promise<ExperimentRun> {
  const jobs = plannedJobs(run, essays);
  run.progress = { done: 0, total: jobs.length, current: null, waitingUntil: null };
  return processJobs(run, jobs, deps);
}

/**
 * Correções pendentes de uma execução: as que falharam e as que nem chegaram a rodar
 * (execução interrompida, pausada pelo limite do Gemini ou servidor reiniciado).
 * Só entram redações que continuam no dataset.
 */
export function pendingJobs(run: ExperimentRun, essays: DatasetEssay[]): Job[] {
  const ok = new Set(run.results.filter((r) => !r.error).map(jobKey));
  return plannedJobs(run, essays).filter((j) => !ok.has(jobKey({ essayId: j.essay.id, mode: j.mode, repetition: j.repetition })));
}

/** Retoma a execução: refaz só as correções pendentes; as que deram certo são mantidas. */
export async function resumeExperiment(
  run: ExperimentRun,
  essays: DatasetEssay[],
  deps: RunExperimentDeps,
): Promise<ExperimentRun> {
  const jobs = pendingJobs(run, essays);
  const retrying = new Set(jobs.map((j) => jobKey({ essayId: j.essay.id, mode: j.mode, repetition: j.repetition })));
  run.results = run.results.filter((r) => !retrying.has(jobKey(r)));
  run.status = "running";
  run.error = null;
  run.finishedAt = null;
  run.progress = { done: run.results.length, total: run.results.length + jobs.length, current: null, waitingUntil: null };
  return processJobs(run, jobs, deps);
}

class Cancelled extends Error {}
class RateLimitPersisted extends Error {}

async function processJobs(run: ExperimentRun, jobs: Job[], deps: RunExperimentDeps): Promise<ExperimentRun> {
  await deps.repo.saveRun(run);
  const save = async () => {
    await deps.repo.saveRun(run);
    deps.onProgress?.(run);
  };

  try {
    for (const job of jobs) {
      if (deps.isCancelled?.()) throw new Cancelled();
      run.progress.current = jobLabel(job);
      deps.onProgress?.(run);
      run.results.push(await gradeWithRateLimitPauses(run, job, deps, save));
      run.progress.done++;
      await save();
    }
  } catch (err) {
    if (err instanceof Cancelled) {
      run.status = "cancelled";
    } else if (err instanceof RateLimitPersisted) {
      run.status = "paused";
      run.error = `${err.message} O que já foi corrigido está salvo; use “Retomar” para continuar de onde parou.`;
    } else throw err;
  }

  if (run.status === "running") {
    const failed = run.results.filter((r) => r.error).length;
    run.status = failed === run.results.length && failed > 0 ? "error" : "done";
    if (failed) run.error = `${failed} correção(ões) falharam. Use “Retomar” para tentar de novo só essas.`;
  }
  run.progress.current = null;
  run.progress.waitingUntil = null;
  run.finishedAt = new Date().toISOString();
  await deps.repo.saveRun(run);
  return run;
}

/**
 * Corrige uma redação; se o Gemini atingir o limite de requisições, salva o estado,
 * espera e tenta de novo, reaproveitando as competências que já tinham voltado.
 */
async function gradeWithRateLimitPauses(
  run: ExperimentRun,
  job: Job,
  deps: RunExperimentDeps,
  save: () => Promise<void>,
): Promise<RunResultEntry> {
  const maxPauses = deps.rateLimitPauses ?? 8;
  const wait = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const llm = memoizeLlm(deps.llm);
  for (let pause = 1; ; pause++) {
    try {
      return await gradeJob(job, { ...deps, llm });
    } catch (err) {
      if (!isRateLimitError(err)) return failedEntry(job, err);
      if (err.daily) throw new RateLimitPersisted("Cota diária do Gemini esgotada.");
      if (pause > maxPauses) throw new RateLimitPersisted("O limite de requisições do Gemini não liberou.");
      const ms = Math.max(rateLimitPauseMs(pause), err.retryAfterMs ?? 0);
      run.progress.waitingUntil = new Date(Date.now() + ms).toISOString();
      run.progress.current = `${jobLabel(job)} · limite do Gemini atingido, nova tentativa em ${formatWait(ms)} (pausa ${pause}/${maxPauses})`;
      await save();
      // Espera em fatias para atender ao "Parar" rapidamente.
      for (let left = ms; left > 0; left -= 1000) {
        if (deps.isCancelled?.()) throw new Cancelled();
        await wait(Math.min(1000, left));
      }
      run.progress.waitingUntil = null;
      run.progress.current = jobLabel(job);
      await save();
    }
  }
}

const formatWait = (ms: number) => (ms < 60_000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60_000)} min`);

async function gradeJob(job: Job, deps: GradeDeps): Promise<RunResultEntry> {
  const { result } = await gradeEssay(
    { tema: job.essay.tema, texto: job.essay.texto, textosMotivadores: job.essay.textosMotivadores, mode: job.mode },
    deps,
  );
  const retrievedIds = emptyRetrieved();
  const ragApplied = emptyRetrieved();
  for (const c of result.competencies) {
    retrievedIds[c.competency] = c.retrieved.map((x) => x.id);
    ragApplied[c.competency] = (c.applications ?? []).filter((a) => a.seAplica).map((a) => a.id);
  }
  return {
    essayId: job.essay.id,
    mode: job.mode,
    repetition: job.repetition,
    scores: Object.fromEntries(result.competencies.map((c) => [c.competency, c.score])) as Record<CompetencyId, number>,
    total: result.total,
    annulled: Boolean(result.annulled),
    retrievedIds,
    latencyMs: result.stats.latencyMs,
    inputTokens: result.stats.inputTokens,
    outputTokens: result.stats.outputTokens,
    error: null,
    gradingId: result.id,
    ...(job.mode === "rag" ? { ragApplied } : {}),
  };
}

function failedEntry(job: Job, err: unknown): RunResultEntry {
  return {
    essayId: job.essay.id,
    mode: job.mode,
    repetition: job.repetition,
    scores: null,
    total: null,
    annulled: false,
    retrievedIds: emptyRetrieved(),
    latencyMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    error: err instanceof Error ? err.message : String(err),
    gradingId: null,
  };
}

/** Converte uma execução no formato usado pelas métricas. */
export function runToPredictions(run: ExperimentRun): EssayPredictions[] {
  return run.config.essayIds
    .filter((id) => run.human[id])
    .map((id) => {
      const predictions: EssayPredictions["predictions"] = {};
      for (const mode of run.config.modes) {
        const reps = run.results
          .filter((r) => r.essayId === id && r.mode === mode && r.scores)
          .map((r) => r.scores as CompScores);
        if (reps.length) predictions[mode] = reps;
      }
      return { essayId: id, label: run.human[id]!.label, human: run.human[id]!.scores, predictions };
    });
}
