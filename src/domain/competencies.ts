export const COMPETENCY_IDS = [1, 2, 3, 4, 5] as const;
export type CompetencyId = (typeof COMPETENCY_IDS)[number];

export const LEVELS = [0, 1, 2, 3, 4, 5] as const;
export type Level = (typeof LEVELS)[number];

/** Cada nível da Matriz de Referência vale 40 pontos (0–200 por competência). */
export const levelToScore = (level: Level): number => level * 40;

export const clampLevel = (n: number): Level => Math.max(0, Math.min(5, Math.floor(n))) as Level;

export const minLevel = (...levels: Level[]): Level => Math.min(...levels) as Level;

export interface CompetencyInfo {
  id: CompetencyId;
  roman: string;
  title: string;
  short: string;
}

export const COMPETENCIES: Record<CompetencyId, CompetencyInfo> = {
  1: {
    id: 1,
    roman: "I",
    title: "Demonstrar domínio da modalidade escrita formal da Língua Portuguesa",
    short: "Norma culta",
  },
  2: {
    id: 2,
    roman: "II",
    title:
      "Compreender a proposta de redação e aplicar conceitos das várias áreas de conhecimento para desenvolver o tema, dentro dos limites estruturais do texto dissertativo-argumentativo em prosa",
    short: "Tema, tipo e repertório",
  },
  3: {
    id: 3,
    roman: "III",
    title:
      "Selecionar, relacionar, organizar e interpretar informações, fatos, opiniões e argumentos em defesa de um ponto de vista",
    short: "Projeto de texto",
  },
  4: {
    id: 4,
    roman: "IV",
    title: "Demonstrar conhecimento dos mecanismos linguísticos necessários para a construção da argumentação",
    short: "Coesão",
  },
  5: {
    id: 5,
    roman: "V",
    title: "Elaborar proposta de intervenção para o problema abordado, respeitando os direitos humanos",
    short: "Proposta de intervenção",
  },
};

export type GradingMode = "baseline" | "rag";

export const MODE_LABEL: Record<GradingMode, string> = {
  baseline: "IA sem RAG",
  rag: "IA com RAG",
};
