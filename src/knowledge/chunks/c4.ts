import type { KnowledgeChunkSource } from "@/domain/knowledge";

const base = { competency: 4, source: "Competencia_4.pdf" } as const;

export const C4_CHUNKS: KnowledgeChunkSource[] = [
  {
    ...base,
    type: "regra",
    title: "Objeto da Competência IV: superfície coesiva",
    text: "A Competência IV avalia se os recursos coesivos são adequados e diversificados, especialmente os operadores argumentativos, e se articulam a argumentação. Não basta a mera presença de conectivos: conectivos mobilizados de maneira inadequada ou inerte (lançados aleatoriamente, sem estabelecer relação de sentido) não levam à nota máxima. Não se trata de tornar o texto rebuscado. Por outro lado, a recorrência de palavras ligadas ao tema e de alguns operadores não significa automaticamente nível baixo: o que conta é se cada elemento coesivo estabelece a relação de sentido esperada.",
    situations: [],
  },
  {
    ...base,
    type: "regra",
    title: "Coesão referencial e sequencial",
    text: "Coesão referencial retoma ou antecipa elementos: pronomes, advérbios ('lá'), artigos, elipse, numerais, sinônimos, hiperônimos, nomes genéricos ('fato', 'fenômeno') e nominalizações ('manifestação'). Coesão sequencial faz o texto progredir: encadeamento por subordinação e, sobretudo, operadores argumentativos. Repetição de termos e de recursos fonológicos é própria da poesia e não é valorizada na dissertação.",
    situations: [],
  },
  {
    ...base,
    type: "regra",
    title: "Operadores argumentativos",
    text: "Operadores argumentativos encadeiam enunciados e determinam a orientação argumentativa: soma (também, além disso, não só... mas também), contraposição (mas, porém, contudo, no entanto, embora), conclusão (logo, portanto, por isso, em suma), explicação/justificativa (porque, visto que, já que, a fim de), comparação (mais... que, tão... quanto), alternância (ou... ou, seja... seja) e escala (inclusive, até mesmo, ao menos). As notas mais altas exigem operadores argumentativos.",
    situations: [],
  },
  {
    ...base,
    type: "regra",
    title: "Grade específica da Competência IV",
    text: "0 = palavras e períodos justapostos e desconexos em todo o texto; 1 = presença rara de coesivos e/ou excessivas repetições e/ou excessivas inadequações; 2 = presença pontual e/ou muitas repetições e/ou muitas inadequações (monobloco não ultrapassa este nível); 3 = presença regular e/ou algumas repetições e/ou algumas inadequações; 4 = presença constante inter e intraparágrafos e/ou poucas repetições e/ou poucas inadequações; 5 = presença expressiva inter e intraparágrafos E raras ou ausentes repetições E sem inadequação. Características de níveis diferentes: prevalece o mais baixo.",
    situations: [],
  },
  {
    ...base,
    type: "regra",
    title: "Exigências objetivas dos níveis 4 e 5",
    text: "Nível 4 exige operador argumentativo entre parágrafos em pelo menos 1 momento do texto, além de presença constante de coesivos intraparágrafos. Nível 5 exige operador argumentativo entre parágrafos em pelo menos 2 momentos e pelo menos 1 elemento coesivo de qualquer tipo dentro de todos os parágrafos, além de raras repetições e nenhuma inadequação.",
    situations: ["c4-conectivo-interparagrafo", "c4-sem-conectivo-interparagrafo"],
  },
  {
    ...base,
    type: "caso-limite",
    title: "Operador no início do parágrafo que funciona como intraparágrafo",
    text: "Nem todo operador no início de parágrafo é interparágrafo. Se ele articula conteúdos internos do próprio parágrafo (ex.: 'De acordo com...' introduzindo uma citação) ou tem função referencial (ex.: 'Pelo lado positivo', retomando 'benefícios'), é coesão intraparágrafo. Só conta como interparágrafo o operador que relaciona explicitamente o argumento do parágrafo ao do parágrafo anterior.",
    situations: ["c4-inicio-citacao"],
  },
  {
    ...base,
    type: "caso-limite",
    title: "Único interparágrafo inadequado não conta",
    text: "Qualquer inadequação coesiva impede o nível 5. Se a inadequação ocorrer no único momento em que o participante tentou a coesão interparágrafos, esse elemento não conta como válido e o texto não pode ficar no nível 4, que exige ao menos um operador argumentativo interparágrafos adequado.",
    situations: [],
  },
  {
    ...base,
    type: "regra",
    title: "Repetição: quando penalizar",
    text: "A repetição é avaliada qualitativamente, nunca por contagem absoluta, e recai prioritariamente sobre a coesão sequencial (operadores argumentativos). É penalizada quando faz rarear a diversidade do repertório coesivo: o MESMO operador argumentativo várias vezes (exemplo do manual: 'porém' quatro vezes em poucas linhas, repetindo sempre a mesma relação semântica); a mesma palavra muitas vezes em poucas linhas ('pode' cinco vezes em seis linhas); termos do tema repetidos sem nenhuma retomada (sinônimo, pronome, hiperônimo) num texto que também tem pouca coesão. Usar operadores diferentes (ex.: 'Ademais', 'Outrossim', 'Destarte', uma vez cada) é diversidade, não repetição.",
    situations: ["c4-repeticao-conectivo"],
  },
  {
    ...base,
    type: "caso-limite",
    title: "Repetições toleradas",
    text: "Repetição é recurso natural e legítimo de coesão e é esperada na dissertação. São toleradas: palavras do campo semântico do tema, quando intercaladas com algumas retomadas (sinônimos, pronomes, cadeias referenciais) e com outras formas de coesão (exemplo do manual: 'pessoas' seis vezes, mas também 'usuário' e 'alienada', em texto articulado); pronomes como 'seu', 'sua', 'isso'; preposições e conjunções como 'com', 'e', 'que'. Uma expressão repetida duas vezes num texto bem articulado não empobrece o repertório coesivo. Em texto curto a repetição fica mais saliente, o que não significa que seja problemática.",
    situations: ["c4-repeticao-conectivo"],
  },
  {
    ...base,
    type: "regra",
    title: "Inadequação coesiva",
    text: "Inadequação é o uso de elemento coesivo que não constrói a relação semântica esperada: 'mas' ligando ideias que são causa e consequência; 'portanto' com valor adversativo; 'dessa forma' entre orações opostas; 'onde' sem valor de lugar (ex.: 'se os pais dessem importância aos filhos, onde estes pudessem opinar'). O uso de 'onde' sem função locativa é inadequação na Competência IV, não desvio na Competência I.",
    situations: ["c4-onde", "c4-portanto-meio"],
  },
  {
    ...base,
    type: "caso-limite",
    title: "Usos não canônicos aceitos",
    text: "Não são penalizados como inadequação: 'através de' fora de contextos literais; 'o mesmo' em retomadas referenciais; 'onde' relacionado a 'sociedade' ou a lugar virtual (site, blog, rede); troca entre esse/este e isso/isto. 'Dessa forma', 'dessa maneira' e 'assim' devem, em geral, ser avaliados em benefício do participante, salvo uso flagrantemente inadequado.",
    situations: ["c4-usos-aceitos", "c4-dessa-forma", "c4-onde"],
  },
  {
    ...base,
    type: "regra",
    title: "Monobloco",
    text: "Redação sem qualquer indício de paragrafação (um único bloco, mesmo com recuo apenas na primeira linha) é monobloco e recebe no máximo nível 2 na Competência IV. O monobloco é penalizado apenas na Competência IV, não na II; um monobloco pode conter as três partes do texto. Espaço deixado ao fim de período na margem direita indica parágrafo e afasta o monobloco.",
    situations: ["c4-monobloco"],
  },
  {
    ...base,
    type: "regra",
    title: "Fronteira com as Competências I e III",
    text: "Pontuação e grafia de conectivos ('por tanto', 'mais' no lugar de 'mas', 'oque') são avaliados na Competência I; a Competência IV examina apenas a função semântica dos coesivos. Paralelismo sintático é avaliado na Competência I. A organização profunda das ideias é da Competência III.",
    situations: ["c4-mas-mais"],
  },
  {
    ...base,
    type: "regra",
    title: "Diferença entre presença pontual, regular, constante e expressiva",
    text: "Presença pontual: articulação elementar, com poucos coesivos, predominantemente referenciais (pronomes, 'isso', 'assim'), sem operadores entre parágrafos. Presença regular: uso de conectivos variados em alguns momentos, ainda sem constância nos parágrafos. Presença constante: uso contínuo de coesivos inter e intraparágrafos. Presença expressiva: emprego notável e estratégico de conectivos em todo o conjunto, valorizando relações diversas (adversidade, conclusão, causa, finalidade) dentro e entre os parágrafos.",
    situations: [],
  },
];
