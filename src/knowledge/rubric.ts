import type { CompetencyId } from "@/domain/competencies";
import { C1_CRITERIA, C3_CRITERIA, C4_CRITERIA, REFERENCE_WORDS } from "@/domain/scoring/criteria";

/**
 * Rubrica fixa: orientações sempre pertinentes, incluídas em TODA solicitação ao
 * modelo (com ou sem RAG). Contém os seis descritores da Matriz de Referência de
 * cada competência, a Grade Específica e os critérios operacionais de contagem.
 * As situações específicas ficam nos chunks recuperados via RAG.
 */

export interface FixedRubric {
  competency: CompetencyId;
  descriptors: [string, string, string, string, string, string];
  grade: string[];
  counting: string[];
}

export const FIXED_RUBRIC: Record<CompetencyId, FixedRubric> = {
  1: {
    competency: 1,
    descriptors: [
      "Demonstra desconhecimento da modalidade escrita formal da Língua Portuguesa.",
      "Demonstra domínio precário da modalidade escrita formal, de forma sistemática, com diversificados e frequentes desvios gramaticais, de escolha de registro e de convenções da escrita.",
      "Demonstra domínio insuficiente da modalidade escrita formal, com muitos desvios gramaticais, de escolha de registro e de convenções da escrita.",
      "Demonstra domínio mediano da modalidade escrita formal e de escolha de registro, com alguns desvios gramaticais e de convenções da escrita.",
      "Demonstra bom domínio da modalidade escrita formal e de escolha de registro, com poucos desvios gramaticais e de convenções da escrita.",
      "Demonstra excelente domínio da modalidade escrita formal e de escolha de registro. Desvios serão aceitos somente como excepcionalidade e quando não caracterizarem reincidência.",
    ],
    grade: [
      "0: estrutura sintática inexistente (independentemente dos desvios).",
      "1: estrutura sintática deficitária COM muitos desvios.",
      "2: estrutura sintática deficitária OU muitos desvios.",
      "3: estrutura sintática regular E alguns desvios.",
      "4: estrutura sintática boa E poucos desvios.",
      "5: estrutura sintática excelente (no máximo uma falha) E no máximo dois desvios.",
      "Características de dois níveis: prevalece o inferior.",
    ],
    counting: [
      "Liste CADA desvio (acentuação, ortografia, hífen, maiúsculas, translineação, regência, concordância, pontuação, paralelismo, pronomes, crase, registro informal, escolha vocabular) e CADA falha de estrutura sintática (truncamento, justaposição, excesso, ausência ou duplicação de termos) em entradas separadas.",
      "Desvios de convenção da escrita, registro e vocabulário repetidos na mesma palavra ou radical contam uma vez; desvios gramaticais contam a cada ocorrência.",
      `O servidor converte as contagens na grade: até ${C1_CRITERIA.maxDesviosNivel5} desvios = "no máximo dois"; até ${C1_CRITERIA.desviosPoucosAte} a cada ${REFERENCE_WORDS} palavras = poucos; até ${C1_CRITERIA.desviosAlgunsAte} = alguns; acima = muitos. Falhas: até ${C1_CRITERIA.maxFalhasNivel5} com períodos complexos = excelente; até ${C1_CRITERIA.falhasBoaAte} a cada ${REFERENCE_WORDS} palavras = boa; acima = regular. Leitura comprometida na maior parte do texto = deficitária. Predomínio de parágrafos de período único = no máximo regular (calculado pelo servidor).`,
      "Não invente desvios: marque apenas o que viola a norma-padrão com segurança.",
    ],
  },
  2: {
    competency: 2,
    descriptors: [
      "Fuga ao tema ou não atendimento à estrutura dissertativo-argumentativa (nota zero na redação).",
      "Apresenta o assunto, tangenciando o tema, ou demonstra domínio precário do texto dissertativo-argumentativo, com traços constantes de outros tipos textuais.",
      "Desenvolve o tema recorrendo à cópia de trechos dos textos motivadores ou apresenta domínio insuficiente do texto dissertativo-argumentativo, não atendendo à estrutura com proposição, argumentação e conclusão.",
      "Desenvolve o tema por meio de argumentação previsível e apresenta domínio mediano do texto dissertativo-argumentativo, com proposição, argumentação e conclusão.",
      "Desenvolve o tema por meio de argumentação consistente e apresenta bom domínio do texto dissertativo-argumentativo, com proposição, argumentação e conclusão.",
      "Desenvolve o tema por meio de argumentação consistente, a partir de um repertório sociocultural produtivo, e apresenta excelente domínio do texto dissertativo-argumentativo.",
    ],
    grade: [
      "1: tangência ao tema OU texto composto por aglomerado de palavras OU traços constantes de outros tipos textuais.",
      "2: abordagem completa E (3 partes com 2 delas embrionárias OU conclusão finalizada por frase incompleta). Muitos trechos de cópia dos motivadores não ultrapassam este nível.",
      "3: abordagem completa E 3 partes (1 pode ser embrionária) E repertório baseado nos motivadores e/ou não legitimado e/ou legitimado mas não pertinente.",
      "4: abordagem completa E 3 partes (nenhuma embrionária) E repertório legitimado e pertinente, sem uso produtivo.",
      "5: abordagem completa E 3 partes (nenhuma embrionária) E repertório legitimado e pertinente, com uso produtivo.",
    ],
    counting: [
      "Liste os elementos-chave da frase temática e diga se cada um foi abordado, com o trecho.",
      "Liste TODOS os repertórios; para cada um, informe se é baseado nos motivadores, legitimado, pertinente e com uso produtivo. O servidor considera o repertório de nível mais alto.",
      "Marque como embrionária apenas a parte muito curta por pouca produção.",
    ],
  },
  3: {
    competency: 3,
    descriptors: [
      "Apresenta informações, fatos e opiniões não relacionados ao tema e sem defesa de um ponto de vista.",
      "Apresenta informações, fatos e opiniões pouco relacionados ao tema ou incoerentes e sem defesa de um ponto de vista.",
      "Apresenta informações, fatos e opiniões relacionados ao tema, mas desorganizados ou contraditórios e limitados aos argumentos dos textos motivadores, em defesa de um ponto de vista.",
      "Apresenta informações, fatos e opiniões relacionados ao tema, limitados aos argumentos dos textos motivadores e pouco organizados, em defesa de um ponto de vista.",
      "Apresenta informações, fatos e opiniões relacionados ao tema, de forma organizada, com indícios de autoria, em defesa de um ponto de vista.",
      "Apresenta informações, fatos e opiniões relacionados ao tema proposto, de forma consistente e organizada, configurando autoria, em defesa de um ponto de vista.",
    ],
    grade: [
      "0: tangente ao tema E sem direção.",
      "1: tangente ao tema E com direção OU abordagem completa E sem direção.",
      "2: projeto de texto com muitas falhas E sem desenvolvimento ou com desenvolvimento de apenas uma informação. Contradição grave não ultrapassa este nível.",
      "3: projeto com algumas falhas E desenvolvimento de algumas informações, fatos e opiniões.",
      "4: projeto com poucas falhas E desenvolvimento da maior parte das informações, fatos e opiniões.",
      "5: projeto estratégico E desenvolvimento em todo o texto (admitem-se deslizes pontuais).",
      "Projeto e desenvolvimento em níveis diferentes: prevalece o mais baixo.",
    ],
    counting: [
      "Liste cada problema de projeto classificando-o como 'falha' (prejudica a progressão/estratégia) ou 'deslize' (pontual, não prejudica).",
      "Liste cada informação, fato ou opinião relevante usado como argumento e diga se foi desenvolvido.",
      `O servidor converte: 0 falhas = estratégico; ${C3_CRITERIA.poucasFalhasAte} = poucas; até ${C3_CRITERIA.algumasFalhasAte} = algumas; mais = muitas. Desenvolvimento: todos desenvolvidos = todo o texto; ≥ ${Math.round(C3_CRITERIA.maiorParteMin * 100)}% = maior parte; mais de um = algumas; no máximo um = sem desenvolvimento.`,
      "O repertório NÃO é avaliado aqui (é da Competência II).",
    ],
  },
  4: {
    competency: 4,
    descriptors: [
      "Não articula as informações.",
      "Articula as partes do texto de forma precária.",
      "Articula as partes do texto de forma insuficiente, com muitas inadequações, e apresenta repertório limitado de recursos coesivos.",
      "Articula as partes do texto de forma mediana, com inadequações, e apresenta repertório pouco diversificado de recursos coesivos.",
      "Articula as partes do texto, com poucas inadequações, e apresenta repertório diversificado de recursos coesivos.",
      "Articula bem as partes do texto e apresenta repertório diversificado de recursos coesivos.",
    ],
    grade: [
      "0: palavras e períodos justapostos e desconexos ao longo de todo o texto.",
      "1: presença rara de elementos coesivos e/ou excessivas repetições e/ou excessivas inadequações.",
      "2: presença pontual e/ou muitas repetições e/ou muitas inadequações. Monobloco não ultrapassa este nível.",
      "3: presença regular e/ou algumas repetições e/ou algumas inadequações.",
      "4: presença constante inter e intraparágrafos (com operador argumentativo entre parágrafos em pelo menos 1 momento) e/ou poucas repetições e/ou poucas inadequações.",
      "5: presença expressiva inter e intraparágrafos (operador argumentativo entre parágrafos em pelo menos 2 momentos e elemento coesivo dentro de todos os parágrafos) E raras ou ausentes repetições E sem inadequação.",
    ],
    counting: [
      "Liste cada elemento coesivo relevante com seu parágrafo (§), posição (interparágrafo só se relaciona o parágrafo ao anterior), tipo (sequencial/referencial), se é operador argumentativo e se está adequado.",
      "Liste repetições que empobrecem o repertório coesivo (não conte palavras do tema retomadas de outras formas).",
      `O servidor converte: presença expressiva = ≥${C4_CRITERIA.interOperadoresNivel5} operadores entre parágrafos + coesivo em todos os parágrafos + ≥${C4_CRITERIA.sequenciaisPorParagrafoExpressiva} sequenciais por parágrafo; constante = ≥${C4_CRITERIA.interOperadoresNivel4} operador entre parágrafos + ≥${C4_CRITERIA.coesivosPorParagrafoConstante} coesivos por parágrafo; regular = ≥${C4_CRITERIA.sequenciaisRegularMin} sequenciais; pontual = ≥${C4_CRITERIA.coesivosPontualMin} coesivos. Repetições (operador pesa 2) e inadequações: 0–1 raras / 0 nenhuma, até ${C4_CRITERIA.poucasAte} poucas, até ${C4_CRITERIA.algumasAte} algumas, até ${C4_CRITERIA.muitasAte} muitas, acima excessivas. Monobloco é detectado pelo servidor.`,
    ],
  },
  5: {
    competency: 5,
    descriptors: [
      "Não apresenta proposta de intervenção ou apresenta proposta não relacionada ao tema ou ao assunto.",
      "Apresenta proposta de intervenção vaga, precária ou relacionada apenas ao assunto.",
      "Elabora, de forma insuficiente, proposta de intervenção relacionada ao tema, ou não articulada com a discussão desenvolvida no texto.",
      "Elabora, de forma mediana, proposta de intervenção relacionada ao tema e articulada à discussão desenvolvida no texto.",
      "Elabora bem proposta de intervenção relacionada ao tema e articulada à discussão desenvolvida no texto.",
      "Elabora muito bem proposta de intervenção, detalhada, relacionada ao tema e articulada à discussão desenvolvida no texto.",
    ],
    grade: [
      "0: ausência de proposta ou cópia integral OU proposta que desrespeita os direitos humanos OU proposta não relacionada sequer ao assunto.",
      "1: tangenciamento do tema OU apenas elemento(s) nulo(s) OU 1 elemento válido.",
      "2: 2 elementos válidos (estruturas condicionais com 2 ou mais elementos válidos não ultrapassam este nível).",
      "3: 3 elementos válidos.",
      "4: 4 elementos válidos.",
      "5: 5 elementos válidos.",
      "Elementos: AÇÃO + AGENTE + MODO/MEIO + EFEITO + DETALHAMENTO; cada um conta uma única vez por proposta.",
    ],
    counting: [
      "Liste TODAS as propostas do texto; para cada uma marque presença e trecho de ação, agente, modo/meio, efeito e detalhamento, e se ação/agente são nulos.",
      "Marque 'condicional' apenas para orações condicionais desenvolvidas ('se', 'caso', 'desde que').",
      "O servidor escolhe a proposta mais completa e aplica a grade.",
    ],
  },
};

export function renderRubric(c: CompetencyId): string {
  const r = FIXED_RUBRIC[c];
  return [
    "Matriz de Referência (descritores por nível):",
    ...r.descriptors.map((d, i) => `  Nível ${i} (${i * 40} pontos): ${d}`),
    "Grade Específica:",
    ...r.grade.map((g) => `  - ${g}`),
    "Critérios operacionais de marcação e contagem:",
    ...r.counting.map((g) => `  - ${g}`),
  ].join("\n");
}
