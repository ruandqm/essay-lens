import { COMPETENCY_IDS, type CompetencyId, type GradingMode } from "./competencies";

/**
 * Métricas de concordância entre IA e avaliador humano.
 * MAE (Erro Absoluto Médio) é a métrica principal:
 *   MAE = (1/n) Σ |ŷᵢ − yᵢ|
 */

export type CompScores = Record<CompetencyId, number>;

export interface EssayPredictions {
  essayId: string;
  label: string;
  human: CompScores;
  /** Uma entrada por repetição da correção. */
  predictions: Partial<Record<GradingMode, CompScores[]>>;
}

export interface AgreementStats {
  n: number;
  mae: number;
  rmse: number;
  /** Erro médio com sinal: positivo = IA mais generosa que o humano. */
  bias: number;
  exactAgreement: number;
  /** |erro| ≤ 40 pontos (um nível). */
  adjacentAgreement: number;
  qwk: number | null;
  pearson: number | null;
}

export interface ModeMetrics {
  mode: GradingMode;
  perCompetency: Record<CompetencyId, AgreementStats>;
  /** Média dos MAE por competência (o "MAE geral"). */
  maeMean: number;
  /** Estatísticas sobre a nota total (0–1000). */
  total: AgreementStats;
  /** Desvio-padrão médio entre repetições (estabilidade do modelo). Null se só houve 1 repetição. */
  stability: number | null;
  repetitions: number;
}

export interface WilcoxonResult {
  n: number;
  wPlus: number;
  wMinus: number;
  z: number;
  pValue: number;
}

export interface ComparisonMetrics {
  baseline: ModeMetrics;
  rag: ModeMetrics;
  reduction: Record<CompetencyId | "mean" | "total", { absolute: number; percent: number }>;
  wilcoxon: WilcoxonResult | null;
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
export const stdDev = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1));
};
export const totalOf = (s: CompScores) => sum(COMPETENCY_IDS.map((c) => s[c]));

export function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length < 3) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    const a = xs[i]! - mx;
    const b = ys[i]! - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

/** Kappa ponderado quadrático sobre os níveis 0–5 (métrica padrão em correção automática). */
export function quadraticWeightedKappa(human: number[], pred: number[], levels = 6): number | null {
  if (human.length === 0) return null;
  const toLevel = (s: number) => Math.max(0, Math.min(levels - 1, Math.round(s / 40)));
  const O = Array.from({ length: levels }, () => Array<number>(levels).fill(0));
  const hHist = Array<number>(levels).fill(0);
  const pHist = Array<number>(levels).fill(0);
  for (let i = 0; i < human.length; i++) {
    const a = toLevel(human[i]!);
    const b = toLevel(pred[i]!);
    O[a]![b]! += 1;
    hHist[a]! += 1;
    pHist[b]! += 1;
  }
  const n = human.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < levels; i++) {
    for (let j = 0; j < levels; j++) {
      const w = (i - j) ** 2 / (levels - 1) ** 2;
      num += w * O[i]![j]!;
      den += w * ((hHist[i]! * pHist[j]!) / n);
    }
  }
  if (den === 0) return num === 0 ? 1 : 0;
  return 1 - num / den;
}

export function agreement(human: number[], pred: number[], withKappa: boolean): AgreementStats {
  const errors = pred.map((p, i) => p - human[i]!);
  const abs = errors.map(Math.abs);
  return {
    n: errors.length,
    mae: mean(abs),
    rmse: Math.sqrt(mean(errors.map((e) => e * e))),
    bias: mean(errors),
    exactAgreement: abs.length ? abs.filter((e) => e === 0).length / abs.length : 0,
    adjacentAgreement: abs.length ? abs.filter((e) => e <= 40).length / abs.length : 0,
    qwk: withKappa ? quadraticWeightedKappa(human, pred) : null,
    pearson: pearson(human, pred),
  };
}

/** Média das repetições por competência (usada nas tabelas por redação). */
export function averagePrediction(reps: CompScores[]): CompScores {
  return Object.fromEntries(COMPETENCY_IDS.map((c) => [c, mean(reps.map((r) => r[c]))])) as CompScores;
}

export function modeMetrics(rows: EssayPredictions[], mode: GradingMode): ModeMetrics | null {
  const valid = rows.filter((r) => (r.predictions[mode]?.length ?? 0) > 0);
  if (valid.length === 0) return null;

  const perCompetency = {} as Record<CompetencyId, AgreementStats>;
  for (const c of COMPETENCY_IDS) {
    const h: number[] = [];
    const p: number[] = [];
    for (const r of valid) {
      for (const rep of r.predictions[mode]!) {
        h.push(r.human[c]);
        p.push(rep[c]);
      }
    }
    perCompetency[c] = agreement(h, p, true);
  }

  const th: number[] = [];
  const tp: number[] = [];
  for (const r of valid) {
    for (const rep of r.predictions[mode]!) {
      th.push(totalOf(r.human));
      tp.push(totalOf(rep));
    }
  }

  const repetitions = Math.max(...valid.map((r) => r.predictions[mode]!.length));
  let stability: number | null = null;
  if (repetitions > 1) {
    const sds: number[] = [];
    for (const r of valid) {
      const reps = r.predictions[mode]!;
      if (reps.length < 2) continue;
      for (const c of COMPETENCY_IDS) sds.push(stdDev(reps.map((x) => x[c])));
    }
    stability = mean(sds);
  }

  return {
    mode,
    perCompetency,
    maeMean: mean(COMPETENCY_IDS.map((c) => perCompetency[c].mae)),
    total: agreement(th, tp, false),
    stability,
    repetitions,
  };
}

// ───────────────────────── Teste de Wilcoxon pareado ─────────────────────────

function normalCdf(z: number): number {
  // Aproximação de Abramowitz & Stegun 7.1.26 para erf.
  const t = 1 / (1 + 0.3275911 * Math.abs(z / Math.SQRT2));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-((z / Math.SQRT2) ** 2));
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Wilcoxon signed-rank (aproximação normal, correção de empates e de continuidade). */
export function wilcoxonSignedRank(a: number[], b: number[]): WilcoxonResult | null {
  const d = a.map((x, i) => x - b[i]!).filter((x) => x !== 0);
  const n = d.length;
  if (n < 5) return null;
  const sorted = d.map((v) => ({ v, abs: Math.abs(v) })).sort((x, y) => x.abs - y.abs);
  const ranks = Array<number>(n).fill(0);
  let tieCorrection = 0;
  for (let i = 0; i < n; ) {
    let j = i;
    while (j + 1 < n && sorted[j + 1]!.abs === sorted[i]!.abs) j++;
    const r = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) ranks[k] = r;
    const t = j - i + 1;
    tieCorrection += t ** 3 - t;
    i = j + 1;
  }
  let wPlus = 0;
  let wMinus = 0;
  sorted.forEach((s, i) => (s.v > 0 ? (wPlus += ranks[i]!) : (wMinus += ranks[i]!)));
  const mu = (n * (n + 1)) / 4;
  const sigma = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24 - tieCorrection / 48);
  if (sigma === 0) return null;
  const z = (wPlus - mu - Math.sign(wPlus - mu) * 0.5) / sigma;
  return { n, wPlus, wMinus, z, pValue: Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))) };
}

export function compareModes(rows: EssayPredictions[]): ComparisonMetrics | null {
  const baseline = modeMetrics(rows, "baseline");
  const rag = modeMetrics(rows, "rag");
  if (!baseline || !rag) return null;

  const red = (a: number, b: number) => ({ absolute: a - b, percent: a === 0 ? 0 : ((a - b) / a) * 100 });
  const reduction = {
    mean: red(baseline.maeMean, rag.maeMean),
    total: red(baseline.total.mae, rag.total.mae),
  } as ComparisonMetrics["reduction"];
  for (const c of COMPETENCY_IDS) reduction[c] = red(baseline.perCompetency[c].mae, rag.perCompetency[c].mae);

  // Pareamento por redação × competência, com média das repetições.
  const errBase: number[] = [];
  const errRag: number[] = [];
  for (const r of rows) {
    const b = r.predictions.baseline;
    const g = r.predictions.rag;
    if (!b?.length || !g?.length) continue;
    const mb = averagePrediction(b);
    const mg = averagePrediction(g);
    for (const c of COMPETENCY_IDS) {
      errBase.push(Math.abs(mb[c] - r.human[c]));
      errRag.push(Math.abs(mg[c] - r.human[c]));
    }
  }
  return { baseline, rag, reduction, wilcoxon: wilcoxonSignedRank(errBase, errRag) };
}
