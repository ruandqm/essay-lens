import type { CompetencyId, Level } from "../competencies";

/** Um eixo da Grade Específica (ex.: "Desvios", "Estrutura sintática"). */
export interface ScoringAxis {
  key: string;
  label: string;
  /** Valor observado, ex.: "2", "3 de 4 argumentos". */
  value: string;
  /** Categoria da grade, ex.: "no máximo dois desvios". */
  category: string;
  /** Maior nível que este eixo permite. A nota da competência é o menor teto entre os eixos. */
  maxLevel: Level;
}

export interface CompetencyScore {
  competency: CompetencyId;
  level: Level;
  score: number;
  axes: ScoringAxis[];
  /** Rótulos dos eixos que impediram nível maior. */
  restricting: string[];
  summary: string;
}

export function buildScore(competency: CompetencyId, axes: ScoringAxis[], override?: Level): CompetencyScore {
  const level = (override ?? (Math.min(...axes.map((a) => a.maxLevel)) as Level)) as Level;
  const restricting = level < 5 ? axes.filter((a) => a.maxLevel === level).map((a) => a.label) : [];
  const score = level * 40;
  const summary =
    `Nível ${level} — nota ${score}. ` +
    (restricting.length
      ? `${restricting.length > 1 ? "Eixos que limitaram" : "Eixo que limitou"} a nota: ${restricting.join(", ")}.`
      : "Nenhum eixo desta competência apresentou restrição.");
  return { competency, level, score, axes, restricting, summary };
}
