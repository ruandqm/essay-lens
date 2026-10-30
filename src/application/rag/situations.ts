import type { CompetencyId } from "@/domain/competencies";
import { analyzeText, splitSentences, type TextStats } from "@/domain/text-analysis";

/**
 * Roteamento baseado em situações (terceiro canal da recuperação).
 * Padrões detectáveis na redação direcionam a busca para chunks cujas regras
 * tratam explicitamente do fenômeno — ex.: proposta com "caso"/"se"/"desde que"
 * leva ao caso-limite das orações condicionais da Competência V.
 */

export interface SituationContext {
  text: string;
  paragraphs: string[];
  sentences: string[];
  stats: TextStats;
  motivadores: string;
  /**
   * Recorte da proposta de intervenção: períodos com marca de proposta e todo o último
   * parágrafo. Os detectores da Competência V olham só para ele, para não disparar com
   * frases da introdução ou do desenvolvimento.
   */
  proposal?: SituationContext;
}

export interface SituationDetector {
  id: string;
  competency: CompetencyId;
  label: string;
  detect: (ctx: SituationContext) => string[];
}

export interface DetectedSituation {
  id: string;
  competency: CompetencyId;
  label: string;
  evidence: string[];
  /** Situação de alta precisão: seus chunks têm prioridade nas vagas do top-k. */
  priority: boolean;
}

/**
 * Situações de alta precisão, que apontam um caso-limite a decidir (ex.: "em parceria com"
 * na proposta, texto curto, monobloco). As demais (ex.: "há crase no texto") são comuns
 * a quase toda redação e apenas somam no RRF, sem reservar vaga.
 */
export const PRIORITY_SITUATIONS = new Set([
  "c1-periodo-unico",
  "c1-crase-provavel",
  "c1-regencia-provavel",
  "c1-concordancia-provavel",
  "c1-grafia-provavel",
  "c1-virgula-intercalada",
  "c1-oralidade",
  "c1-aonde",
  "c1-mas-mais",
  "c2-primeira-pessoa",
  "c2-referencia-vaga",
  "c2-topicos",
  "c2-paragrafo-curto",
  "c2-conclusao-incompleta",
  "c2-copia-motivadores",
  "c3-desenvolvimento-curto",
  "c3-poucos-paragrafos",
  "c3-negacao-tese",
  "c3-texto-completo",
  "c3-argumento-citacao",
  "c4-onde",
  "c4-monobloco",
  "c4-mas-mais",
  "c4-portanto-meio",
  "c4-inicio-citacao",
  "c5-condicional",
  "c5-agente-nulo",
  "c5-acao-nula",
  "c5-agente-nos",
  "c5-direitos-humanos",
  "c5-constatacao-falta",
  "c5-citacao-dever",
  "c5-gerundio",
  "c5-parceria",
  "c5-desdobramento-efeito",
  "c5-agente-ausente",
  "c5-modo-meio",
  "c5-efeito",
  "c5-detalhamento",
  "c5-estrutura-interventiva",
  "c5-sem-proposta",
]);

const MAX_EVIDENCE = 3;

const W = "[\\p{L}\\p{N}_]";
/** `\\b` do JavaScript ignora letras acentuadas; converte para fronteira Unicode. */
export function ub(re: RegExp): RegExp {
  const boundary = `(?:(?<=${W})(?!${W})|(?<!${W})(?=${W}))`;
  const flags = re.flags.includes("u") ? re.flags : re.flags + "u";
  return new RegExp(re.source.replace(/\\b/g, boundary), flags);
}

function matches(text: string, re: RegExp): string[] {
  const out: string[] = [];
  const u = ub(re);
  const g = new RegExp(u.source, u.flags.includes("g") ? u.flags : u.flags + "g");
  let m: RegExpExecArray | null;
  while ((m = g.exec(text)) && out.length < MAX_EVIDENCE) {
    const start = Math.max(0, m.index - 30);
    const end = Math.min(text.length, m.index + m[0].length + 30);
    out.push(`…${text.slice(start, end).replace(/\s+/g, " ").trim()}…`);
    if (m[0].length === 0) g.lastIndex++;
  }
  return out;
}

const sentencesMatching = (ctx: SituationContext, re: RegExp) => {
  const u = ub(re);
  return ctx.sentences.filter((s) => u.test(s)).slice(0, MAX_EVIDENCE);
};

const PROPOSAL = ub(
  /\b(dev(e|em|eria|eriam)|é (necessári[oa]|precis[oa]|importante|fundamental|imprescindível|mister|essencial|urgente|de suma importância|dever d[eoa]s?)|cabe (ao|à|aos|às)|cumpre (ao|à|aos|às)|compete (ao|à|aos|às)|urge|precis(a|am)|faz-se necessári[oa]|torna-se necessári[oa]|há de|hão de)\b/i,
);
/** Marcas fortes (verbo modalizador ou atribuição explícita de agente). */
const STRONG_PROPOSAL = ub(/\b(dev(e|em|eria|eriam)|cabe (ao|à|aos|às)|cumpre (ao|à|aos|às)|compete (ao|à|aos|às)|urge|há de|hão de|é dever d[eoa]s?)\b/i);

const CONNECTIVES = [
  "além disso",
  "portanto",
  "porém",
  "contudo",
  "entretanto",
  "no entanto",
  "todavia",
  "assim",
  "dessa forma",
  "desse modo",
  "logo",
  "pois",
  "também",
  "ademais",
  "outrossim",
  "por isso",
  "por conseguinte",
  "consequentemente",
  "em suma",
  "nesse sentido",
  "diante disso",
  "sendo assim",
  "mas",
  "destarte",
  "dessarte",
  "dessa maneira",
  "desse modo",
  "sob essa ótica",
  "sob esse viés",
  "sob esse prisma",
  "sob essa perspectiva",
  "nesse contexto",
  "nessa perspectiva",
  "nesse viés",
  "nesse cenário",
  "com efeito",
  "primeiramente",
  "em primeiro lugar",
  "em segundo lugar",
  "segundamente",
  "mormente",
  "além do mais",
  "por fim",
  "em síntese",
  "à vista disso",
  "posto isso",
  "isto posto",
  "como dito anteriormente",
];

const startsWithConnective = (p: string) => {
  const head = p.toLowerCase().slice(0, 40);
  return CONNECTIVES.some((c) => head.startsWith(c) || head.startsWith(`${c},`));
};

export const SITUATIONS: SituationDetector[] = [
  // ─── Competência I ───
  {
    id: "c1-pois-inicio",
    competency: 1,
    label: "Período iniciado por “Pois”",
    detect: (ctx) => matches(ctx.text, /(^|[.!?]\s+)Pois\b/m),
  },
  {
    id: "c1-gerundio-isolado",
    competency: 1,
    label: "Período iniciado por gerúndio (possível truncamento)",
    detect: (ctx) => ctx.sentences.filter((s) => /^[A-ZÀ-Ú][a-zà-ú]+ndo\b/.test(s) && s.split(/\s+/).length < 18).slice(0, MAX_EVIDENCE),
  },
  {
    id: "c1-periodo-unico",
    competency: 1,
    label: "Predomínio de parágrafos com período único",
    detect: (ctx) =>
      ctx.stats.singleSentenceDominant
        ? [`${ctx.stats.singleSentenceParagraphs} de ${ctx.stats.paragraphCount} parágrafos com um único período`]
        : [],
  },
  { id: "c1-crase", competency: 1, label: "Uso do acento grave (crase)", detect: (ctx) => matches(ctx.text, /\bàs?\b/i) },
  {
    id: "c1-crase-provavel",
    competency: 1,
    label: "Provável desvio de crase (confirme)",
    detect: (ctx) =>
      matches(
        ctx.text,
        /\b(no que tange|no tocante|em relação|devido|referente|graças|frente|rumo|quanto|adequando-se|adequar-se|se adequando|aliado|aliada|voltad[oa]s?|direito) a (?!partir|ponto|fim|pé|cavalo|distância|seguir|respeito|qual|quais|maioria|minoria|ser|ter|fazer|um|uma|uns|umas|ele|ela|eles|elas|isso|isto|esse|essa|este|esta|cada|todo|toda|qualquer|nenhum|nenhuma)\p{Ll}*(ção|dade|ência|ância|ia|ura|agem|ise|eza)\b|\b(se adequando|adequar-se|se adequar|aliados?|destinad[oa]s?) as\b|\bàs? (partir|fim de|ponto de|medida que)\b|\bà (ele|ela|eles|elas|um|uma|esse|essa|este|esta|isso|isto|todos|todas|cada|qualquer)\b/iu,
      ),
  },
  {
    id: "c1-regencia-provavel",
    competency: 1,
    label: "Provável desvio de regência (confirme)",
    detect: (ctx) =>
      matches(
        ctx.text,
        /\bassist(ir|e|em|iam|ia|indo) (?!a\b|à|às|ao|aos|o\b|os\b|-)\p{L}+|\b(ir|irem|vão|vai|chegar|chegam|chegou) em (?!busca|direção)\p{L}+|\b(prefere|preferem|preferir)[^.]{0,40}\bdo que\b|\bimplica em\b|\bobedecer (?!a\b|à|ao|às|aos)\p{L}+/iu,
      ),
  },
  {
    id: "c1-concordancia-provavel",
    competency: 1,
    label: "Provável desvio de concordância verbal (confirme)",
    detect: (ctx) =>
      matches(
        ctx.text,
        /\b(todos|muitos|muitas|eles|elas|pessoas|indivíduos|cidadãos|alunos|jovens) (que )?(tem|vem|mantem|contem|detem|obtem)\b|\b(todos|muitos|muitas|eles|elas) que (tem|vem)\b|\bhaviam (muitos|muitas|vários|várias|pessoas|casos|problemas)\b|\bfazem \d+ anos\b/iu,
      ),
  },
  {
    id: "c1-grafia-provavel",
    competency: 1,
    label: "Provável desvio de grafia/acentuação (confirme)",
    detect: (ctx) =>
      matches(
        ctx.text,
        /(?<![\p{L}])á(?![\p{L}])|\bafim de\b|\bderrepente\b|\bconcerteza\b|\bagente (precisa|deve|tem|vai|pode)\b|\bincerir|\bexitar\b|\bmas (?:nem|também|sim) (?:menos|que)\b|\bpor tanto\b|\bem baixo\b|\bde mais\b(?= (?:importante|necessári))|\bmenas\b|\bmal (estar|feitor)\b/iu,
      ),
  },
  {
    id: "c1-virgula-intercalada",
    competency: 1,
    label: "Possível adjunto/oração intercalada com só uma das vírgulas (confirme)",
    detect: (ctx) =>
      matches(
        ctx.text,
        /(?<=\p{L})\s(por meio d[eoa]s?|através d[eoa]s?|mediante|com o intuito de|a fim de|com o fito de|com o objetivo de|de acordo com|segundo|em virtude d[eoa]s?|devido a[os]?)\s[^,.;:]{12,80},\s(?!e\s|que\s|como\s|pois\s|mas\s|porém\s)\p{Ll}/iu,
      ),
  },
  {
    id: "c1-ha-a",
    competency: 1,
    label: "Expressões de tempo com “há”/“a”",
    detect: (ctx) => matches(ctx.text, /\b(há|a) (muito tempo|anos|séculos|décadas|meses|dias)\b|\bdaqui há\b/i),
  },
  { id: "c1-aonde", competency: 1, label: "Uso de “aonde”", detect: (ctx) => matches(ctx.text, /\baonde\b/i) },
  {
    id: "c1-oralidade",
    competency: 1,
    label: "Marcas de oralidade/informalidade",
    detect: (ctx) => matches(ctx.text, /\b(pra|pro|pros|pras|tá|tão|né|vc|vcs|a gente|um monte|tipo assim|aí|daí|beleza)\b/i),
  },
  {
    id: "c1-pronome-inicio",
    competency: 1,
    label: "Pronome oblíquo átono no início de período",
    detect: (ctx) => matches(ctx.text, /(^|[.!?]\s+)(Me|Te|Se|Nos|Vos|Lhe|Lhes) [a-zà-ú]+/m),
  },
  {
    id: "c1-mas-mais",
    competency: 1,
    label: "Possível troca entre “mas” e “mais”",
    detect: (ctx) => matches(ctx.text, /(^|[.!?;,]\s*)Mais,? (o|a|os|as|isso|é|não|também|tudo|há)\b/m),
  },
  { id: "c1-porque", competency: 1, label: "Uso de porque/por que", detect: (ctx) => matches(ctx.text, /\b(por que|porque|porquê|por quê)\b/i) },
  {
    id: "c1-hifen",
    competency: 1,
    label: "Palavras com hífen ou prefixos",
    detect: (ctx) => matches(ctx.text, /\b[\p{L}]+-[\p{L}]+(-[\p{L}]+)?\b/u),
  },
  {
    id: "c1-minuscula",
    competency: 1,
    label: "Possível desvio de maiúscula/minúscula",
    detect: (ctx) => matches(ctx.text, /([.!?]\s+[a-zà-ú])|\b(brasil|brasileira? de|constituição federal)\b/),
  },
  {
    id: "c1-interrogativa",
    competency: 1,
    label: "Frase interrogativa",
    detect: (ctx) => sentencesMatching(ctx, /^(Como|Por que|Qual|Quais|Quem|Onde|Quando|Até quando|Será)\b/),
  },
  {
    id: "c1-aspas",
    competency: 1,
    label: "Uso de aspas ou citação",
    detect: (ctx) => matches(ctx.text, /["“”«»]/),
  },
  // ─── Competência II ───
  {
    id: "c2-repertorio",
    competency: 2,
    label: "Possível repertório sociocultural",
    detect: (ctx) =>
      sentencesMatching(
        ctx,
        /\b(segundo|conforme|de acordo com|consoante|filósof|sociólog|pensador|autor|escritor|livro|obra|filme|série|música|Constituição|lei|pesquisa|estudo|dados|IBGE|ONU|OMS|Unesco|século|guerra|revolução|teoria|conceito)\b|\d+(,\d+)?\s?%/i,
      ),
  },
  {
    id: "c2-primeira-pessoa",
    competency: 2,
    label: "Primeira pessoa do singular / relato",
    detect: (ctx) => matches(ctx.text, /\b(eu|meu|minha|meus|minhas|comigo|lembro|aconteceu comigo)\b/i),
  },
  {
    id: "c2-topicos",
    competency: 2,
    label: "Estrutura em tópicos/enumeração",
    detect: (ctx) => ctx.paragraphs.filter((p) => /^(\d+[.)-]|[-•*]|[a-e]\))\s/.test(p)).slice(0, MAX_EVIDENCE),
  },
  {
    id: "c2-paragrafo-curto",
    competency: 2,
    label: "Introdução ou conclusão muito curta (possível parte embrionária)",
    detect: (ctx) => {
      const p = ctx.paragraphs;
      if (p.length < 2) return [];
      const out: string[] = [];
      const words = (s: string) => s.split(/\s+/).length;
      if (words(p[0]!) < 30) out.push(`Introdução com ${words(p[0]!)} palavras`);
      if (words(p[p.length - 1]!) < 30) out.push(`Conclusão com ${words(p[p.length - 1]!)} palavras`);
      return out;
    },
  },
  {
    id: "c2-conclusao-incompleta",
    competency: 2,
    label: "Texto termina sem pontuação final",
    detect: (ctx) => (/[.!?…"”)]\s*$/.test(ctx.text.trim()) ? [] : [`…${ctx.text.trim().slice(-60)}`]),
  },
  {
    id: "c2-copia-motivadores",
    competency: 2,
    label: "Trechos coincidentes com os textos motivadores",
    detect: (ctx) => copiedFragments(ctx.text, ctx.motivadores),
  },
  {
    id: "c2-referencia-vaga",
    competency: 2,
    label: "Referência vaga, sem fonte identificável (verifique se o repertório é legitimado)",
    detect: (ctx) =>
      matches(
        ctx.text,
        /\b(segundo|conforme|de acordo com) (especialistas|estudos|pesquisas|dados|pesquisadores|cientistas|psicólogos|a ciência)\b|\b(estudos|pesquisas|dados|especialistas) (mostram|apontam|comprovam|revelam|afirmam|indicam)\b|\bartigo \d+º? d[oa]s? (direitos|leis?)\b/iu,
      ),
  },
  {
    id: "c2-constituicao",
    competency: 2,
    label: "Menção à Constituição/legislação",
    detect: (ctx) => matches(ctx.text, /\b(Constituição|Carta Magna|artigo \d+|ECA|Estatuto|Declaração Universal)\b/i),
  },
  // ─── Competência III ───
  {
    id: "c3-contraponto",
    competency: 3,
    label: "Contraposição de ideias",
    detect: (ctx) => matches(ctx.text, /\b(no entanto|entretanto|por outro lado|contudo|todavia|em contrapartida)\b/i),
  },
  {
    id: "c3-exemplificacao",
    competency: 3,
    label: "Exemplificação/fundamentação",
    detect: (ctx) => matches(ctx.text, /\b(por exemplo|a exemplo de|como exemplo|haja vista|tal como|como ocorre)\b/i),
  },
  {
    id: "c3-desenvolvimento-curto",
    competency: 3,
    label: "Parágrafo de desenvolvimento curto (possível falta de desenvolvimento)",
    detect: (ctx) =>
      ctx.paragraphs
        .slice(1, -1)
        .filter((p) => p.split(/\s+/).length < 45)
        .map((p) => `${p.slice(0, 80)}…`)
        .slice(0, MAX_EVIDENCE),
  },
  {
    id: "c3-poucos-paragrafos",
    competency: 3,
    label: "Poucos parágrafos",
    detect: (ctx) => (ctx.stats.paragraphCount <= 3 ? [`${ctx.stats.paragraphCount} parágrafo(s)`] : []),
  },
  {
    id: "c3-negacao-tese",
    competency: 3,
    label: "Afirmações categóricas de negação (verificar contradição)",
    detect: (ctx) => sentencesMatching(ctx, /\bnão (é|há|existe|sofre|são)\b.*\b(manipula|influencia|afeta|problema)/i),
  },
  {
    id: "c3-argumento-citacao",
    competency: 3,
    label: "Parágrafo de desenvolvimento apoiado em citação/autoridade (verifique se a citação é explicada ou substitui a explicação)",
    detect: (ctx) =>
      ctx.paragraphs
        .slice(1, -1)
        .filter((p) =>
          ub(/(“|")[^"”]{15,}("|”)|\b(segundo|conforme|consoante|de acordo com|na perspectiva d[oa]|para) (o|a) (filósof|sociólog|pensador|escritor|autor|professor|psicólog|historiador|antropólog)\p{L}*|\b(máxima|pensamento|ideia|teoria|conceito) d[oa] (filósof|sociólog|pensador|célebre)/iu).test(p),
        )
        .map((p) => `${p.slice(0, 90)}…`),
  },
  {
    id: "c3-texto-completo",
    competency: 3,
    label: "Texto completo e extenso (decidir entre nível 4 e 5: falha × deslize, autoria)",
    detect: (ctx) =>
      ctx.stats.paragraphCount >= 4 && ctx.stats.estimatedLines >= 25
        ? [`${ctx.stats.paragraphCount} parágrafos, ~${ctx.stats.estimatedLines} linhas`]
        : [],
  },
  // ─── Competência IV ───
  { id: "c4-onde", competency: 4, label: "Uso de “onde”", detect: (ctx) => matches(ctx.text, /\bonde\b/i) },
  {
    id: "c4-monobloco",
    competency: 4,
    label: "Texto em monobloco",
    detect: (ctx) => (ctx.stats.monobloco ? ["Texto com um único parágrafo"] : []),
  },
  {
    id: "c4-mas-mais",
    competency: 4,
    label: "Conectivo adversativo grafado como “mais”",
    detect: (ctx) => matches(ctx.text, /(^|[.!?;,]\s*)Mais,? (o|a|os|as|isso|é|não|também|tudo|há)\b/m),
  },
  {
    id: "c4-repeticao-conectivo",
    competency: 4,
    label: "Mesmo conectivo repetido",
    detect: (ctx) => {
      const lower = ctx.text.toLowerCase();
      return CONNECTIVES.filter((c) => c.length > 3 && !["assim", "também", "pois", "logo"].includes(c))
        .map((c) => ({ c, n: (lower.match(new RegExp(`\\b${c}\\b`, "g")) ?? []).length }))
        .filter((x) => x.n >= 3)
        .map((x) => `“${x.c}” × ${x.n}`);
    },
  },
  {
    id: "c4-conectivo-interparagrafo",
    competency: 4,
    label: "Parágrafos iniciados por conectivo",
    detect: (ctx) =>
      ctx.paragraphs
        .slice(1)
        .filter(startsWithConnective)
        .map((p) => `${p.slice(0, 40)}…`),
  },
  {
    id: "c4-inicio-citacao",
    competency: 4,
    label: "Parágrafo iniciado por introdutor de citação/referência (pode ser coesão intraparágrafo)",
    detect: (ctx) =>
      ctx.paragraphs
        .slice(1)
        .filter((p) => ub(/^(de acordo com|segundo|conforme|consoante|na visão d[eoa]|sob a ótica d[eoa]|para (o|a) (filósofo|sociólogo|pensador|autor|escritor)|pelo lado)\b/i).test(p.trim()))
        .map((p) => `${p.slice(0, 50)}…`),
  },
  {
    id: "c4-sem-conectivo-interparagrafo",
    competency: 4,
    label: "Parágrafos sem conexão explícita com o anterior",
    detect: (ctx) =>
      ctx.paragraphs.length > 1 && ctx.paragraphs.slice(1).filter(startsWithConnective).length < 2
        ? [`${ctx.paragraphs.slice(1).filter(startsWithConnective).length} parágrafo(s) iniciado(s) por conectivo`]
        : [],
  },
  {
    id: "c4-dessa-forma",
    competency: 4,
    label: "Uso de “dessa forma”/“desse modo”/“assim”",
    detect: (ctx) => matches(ctx.text, /\b(dessa forma|desse modo|dessa maneira|assim)\b/i),
  },
  {
    id: "c4-usos-aceitos",
    competency: 4,
    label: "“Através de”, “o mesmo” ou troca esse/este",
    detect: (ctx) => matches(ctx.text, /\b(através d[eoa]s?|o mesmo|a mesma|os mesmos|as mesmas)\b/i),
  },
  {
    id: "c4-portanto-meio",
    competency: 4,
    label: "“Portanto” no meio do período (verificar relação)",
    detect: (ctx) => matches(ctx.text, /,\s*portanto\b/i),
  },
  // ─── Competência V (detectores aplicados apenas ao recorte da proposta) ───
  {
    id: "c5-condicional",
    competency: 5,
    label: "Proposta construída com oração condicional",
    detect: (ctx) =>
      sentencesMatching(
        ctx,
        // "se" conjunção no início de oração (não o pronome em "deve-se", "se tornou"), "caso" conjunção, "desde que"...
        /(?:^|[,;:]\s*|\b(?:e|mas|porém|pois|que)\s+)(?:se|caso)\s+(?:\p{L}+\s+){0,5}?(?:\p{L}+(?:r|rem|rmos)|houver|for|forem|tiver|tiverem|fizer|fizerem|puder|puderem)\b|\b(desde que|contanto que|a menos que)\b/iu,
      ),
  },
  {
    id: "c5-agente-nulo",
    competency: 5,
    label: "Possível agente nulo (alguém, você, uns...)",
    detect: (ctx) => matches(ctx.text, /\b(alguém|ninguém|você|vocês|uns e outros|alguns)\b/i),
  },
  {
    id: "c5-acao-nula",
    competency: 5,
    label: "Possível ação nula ou vaga (medidas devem ser tomadas, dar atenção...)",
    detect: (ctx) =>
      matches(
        ctx.text,
        /\b(medidas( \p{L}+)? ((devem|precisam|necessitam) ser tomadas|sejam tomadas|são necessárias)|primeiro passo|fazer alguma coisa|algo (deve|precisa) ser feito|(devem|precisam) ser superad[oa]s|tomar (uma )?(providência|medida|atitude)s?|(dar|ter|haver|tenha|dê) (mais )?atenção|a atenção d[oa]s?|um (novo )?olhar|(mais|um pouco de) cuidado|fazer (a )?(sua )?parte)\b/iu,
      ),
  },
  {
    id: "c5-agente-ausente",
    competency: 5,
    label: "Proposta sem agente textual (voz passiva ou “é necessário + infinitivo”)",
    detect: (ctx) =>
      sentencesMatching(
        ctx,
        /\b(devem|deve|precisam|precisa|necessitam) ser \p{L}+(ad|id)[oa]s?\b|\bé (necessári[oa]|precis[oa]|importante|fundamental|imprescindível|mister|essencial) (criar|promover|ampliar|investir|garantir|implementar|realizar|desenvolver|fiscalizar|incentivar|aumentar|haver)\b/iu,
      ),
  },
  {
    id: "c5-agente-nos",
    competency: 5,
    label: "Agente “nós”/1ª pessoa do plural",
    detect: (ctx) => matches(ctx.text, /\b(nós|devemos|precisamos|temos que)\b/i),
  },
  {
    id: "c5-direitos-humanos",
    competency: 5,
    label: "Proposta com possível risco aos direitos humanos",
    detect: (ctx) =>
      matches(
        ctx.text,
        /\b(pena de morte|tortur|castra|prisão perpétua|linch|exclu[íi]d[oa]s? da sociedade|banir|proibir o acesso|censura|eliminar (essas|esses|os|as) pessoas|sem direitos|trabalho forçado)\w*/i,
      ),
  },
  {
    id: "c5-constatacao-falta",
    competency: 5,
    label: "Constatação de falta (não é proposta)",
    detect: (ctx) =>
      sentencesMatching(ctx, /\b(falta|faltam|carece|carecem)\b/i).filter((x) => !STRONG_PROPOSAL.test(x)),
  },
  {
    id: "c5-citacao-dever",
    competency: 5,
    label: "Citação de lei/autor com “dever” (constatação)",
    detect: (ctx) => matches(ctx.text, /\b(segundo|conforme|de acordo com)\b[^.]{0,90}\bdeve\b/i),
  },
  {
    id: "c5-gerundio",
    competency: 5,
    label: "Oração reduzida de gerúndio na proposta (efeito, modo/meio ou detalhamento?)",
    detect: (ctx) => matches(ctx.text, /,\s*(assim\s+)?\p{L}+ndo\b/iu),
  },
  {
    id: "c5-futuro-preterito",
    competency: 5,
    label: "Proposta no futuro do pretérito (deveria/poderia)",
    detect: (ctx) => matches(ctx.text, /\b(deveria|deveriam|poderia|poderiam)\b/i),
  },
  {
    id: "c5-parceria",
    competency: 5,
    label: "Parceria/associação: parte do agente ou modo/meio?",
    detect: (ctx) =>
      matches(
        ctx.text,
        /\b((em|mediante|por meio de|através de|com) parcerias?( com)?|aliad[oa]s? (a|à|ao|às|aos)|junto (a|à|ao|às|aos|com)|juntamente com|em conjunto com|(por meio|através) da associação)\b/i,
      ),
  },
  {
    id: "c5-modo-meio",
    competency: 5,
    label: "Marca de modo/meio na proposta",
    detect: (ctx) =>
      matches(ctx.text, /\b(por meio d[eoa]s?|através d[eoa]s?|mediante|por intermédio d[eoa]s?|por via d[eoa]s?|com o auxílio d[eoa]s?|com o apoio d[eoa]s?)\b/i),
  },
  {
    id: "c5-efeito",
    competency: 5,
    label: "Marca de efeito (finalidade/consequência) na proposta",
    detect: (ctx) =>
      matches(
        ctx.text,
        /\b(para que|a fim de|afim de|com o fito de|com o intuito de|com o objetivo de|com a finalidade de|com o escopo de|com o propósito de|visando|objetivando|de modo a|de forma a|espera-se)\b/i,
      ),
  },
  {
    id: "c5-detalhamento",
    competency: 5,
    label: "Possível detalhamento (especificação, exemplificação, justificativa)",
    detect: (ctx) =>
      matches(
        ctx.text,
        /\b(como (gestor|responsável|órgão|instituição|garantidor|principal)|na condição de|enquanto (órgão|instituição|responsável)|responsável por|a exemplo d[eoa]s?|por exemplo|tais como|como, por exemplo|uma vez que|já que|visto que|haja vista|pois)\b|,\s*como\s+\p{L}+/iu,
      ),
  },
  {
    id: "c5-desdobramento-efeito",
    competency: 5,
    label: "Possível desdobramento do efeito",
    detect: (ctx) =>
      sentencesMatching(ctx, /\b(para que|a fim de|com o intuito de|com o fito de|visando)\b.*\b(para que|assim|consequentemente|no futuro|dessa forma)\b/i),
  },
  {
    id: "c5-varias-propostas",
    competency: 5,
    label: "Várias propostas de intervenção",
    detect: (ctx) => {
      const all = ctx.sentences.filter((x) => PROPOSAL.test(x)).length;
      return all >= 2 ? [`${all} períodos com marcas de proposta`] : [];
    },
  },
  {
    id: "c5-estrutura-interventiva",
    competency: 5,
    label: "Proposta só com “ser + adjetivo” (é necessário/importante…), sem “deve”/“cabe a”",
    detect: (ctx) =>
      ctx.sentences.some((x) => STRONG_PROPOSAL.test(x))
        ? []
        : sentencesMatching(ctx, /\b(é|faz-se|torna-se|seria) (necessári[oa]|precis[oa]|important[e]|fundamental|imprescindível|essencial|urgente|mister|de suma importância)\b/i),
  },
  {
    id: "c5-sem-proposta",
    competency: 5,
    label: "Nenhuma marca linguística de proposta",
    detect: (ctx) => (ctx.sentences.some((x) => PROPOSAL.test(x)) ? [] : ["Nenhum “deve”, “é necessário”, “cabe ao”…"]),
  },
];

/** Fragmentos de 8+ palavras que aparecem literalmente nos textos motivadores. */
function copiedFragments(text: string, motivadores: string): string[] {
  if (!motivadores.trim()) return [];
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean);
  const src = norm(motivadores);
  const grams = new Set<string>();
  const N = 8;
  for (let i = 0; i + N <= src.length; i++) grams.add(src.slice(i, i + N).join(" "));
  const words = norm(text);
  const hits: string[] = [];
  for (let i = 0; i + N <= words.length && hits.length < MAX_EVIDENCE; i++) {
    const g = words.slice(i, i + N).join(" ");
    if (grams.has(g)) {
      hits.push(`“${g}…”`);
      i += N;
    }
  }
  return hits;
}

export function buildSituationContext(text: string, motivadores = ""): SituationContext {
  const stats = analyzeText(text);
  const sentences = stats.paragraphs.flatMap(splitSentences);
  const last = new Set(splitSentences(stats.paragraphs.at(-1) ?? ""));
  const proposalSentences = sentences.filter((x) => last.has(x) || PROPOSAL.test(x));
  return {
    text: stats.paragraphs.join("\n"),
    paragraphs: stats.paragraphs,
    sentences,
    stats,
    motivadores,
    proposal: {
      text: proposalSentences.join("\n"),
      paragraphs: proposalSentences,
      sentences: proposalSentences,
      stats,
      motivadores,
    },
  };
}

export function detectSituations(ctx: SituationContext): DetectedSituation[] {
  const out: DetectedSituation[] = [];
  for (const d of SITUATIONS) {
    const evidence = d.detect(d.competency === 5 && ctx.proposal ? ctx.proposal : ctx);
    if (evidence.length) out.push({ id: d.id, competency: d.competency, label: d.label, evidence, priority: PRIORITY_SITUATIONS.has(d.id) });
  }
  return out;
}

export const SITUATION_IDS = new Set(SITUATIONS.map((s) => s.id));
