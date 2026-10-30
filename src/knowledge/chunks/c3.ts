import type { KnowledgeChunkSource } from "@/domain/knowledge";

const base = { competency: 3, source: "Competencia_3.pdf" } as const;

export const C3_CHUNKS: KnowledgeChunkSource[] = [
  {
    ...base,
    type: "regra",
    title: "O que a Competência III avalia",
    text: "A Competência III avalia a construção de sentido do texto: como o participante seleciona, relaciona, organiza e interpreta informações, fatos, opiniões e argumentos em defesa de um ponto de vista. A avaliação recai sobre dois aspectos: o projeto de texto e o desenvolvimento dos argumentos. A estrutura introdução-desenvolvimento-conclusão não é avaliada aqui (é da Competência II).",
    situations: [],
  },
  {
    ...base,
    type: "regra",
    title: "Projeto de texto",
    text: "Projeto de texto é o planejamento prévio à escrita que se mostra subjacente no texto final: o esquema que se deixa perceber pela organização dos argumentos, pelos momentos de introduzi-los e pela ordem estratégica de apresentação. Avalia-se se o caminho escolhido para defender o ponto de vista é claramente identificável e se há hierarquia entre argumentos principais e complementares.",
    situations: [],
  },
  {
    ...base,
    type: "regra",
    title: "Desenvolvimento das informações",
    text: "O desenvolvimento é avaliado em cada informação, fato e opinião (na introdução, nos parágrafos de desenvolvimento e na conclusão), e não só nos argumentos principais. Desenvolver é desdobrar a informação com explicação, definição, comparação, dado, exemplo, analogia ou argumento de autoridade, de modo que o texto se explique por si só. Argumento de autoridade só desenvolve quando é relacionado e explicado: a citação que REFORÇA uma ideia já explicada conta; a citação que SUBSTITUI a explicação (o parágrafo afirma a tese, cita um autor e conclui que a realidade 'contrapõe' ou 'vai de encontro' à citação, sem mostrar por quê ou como o problema acontece) deixa a informação sem desenvolvimento. Exemplos do manual: 'falsa sensação de liberdade' afirmada sem explicação (falta pontual, nível 4); 'bolhas sociais contribuem para a intolerância' sem que o caminho fique claro (nível 4); 'fatores externos' sem dizer quais (nível 3).",
    situations: ["c3-texto-completo", "c3-desenvolvimento-curto", "c3-argumento-citacao"],
  },
  {
    ...base,
    type: "caso-limite",
    title: "Informação seguida de outra não é desenvolvimento",
    text: "Uma informação seguida de outra, mesmo ligada por conectivo, não indica necessariamente desenvolvimento. É preciso que o segundo trecho seja um desdobramento (explicação, justificativa, exemplo) da informação apresentada. Mencionar 'algoritmo' ou um dado estatístico sem explicar sua relação com a tese é informação não desenvolvida.",
    situations: [],
  },
  {
    ...base,
    type: "regra",
    title: "Com direção e sem direção",
    text: "Texto sem direção apresenta informações de forma caótica ou desconexa, um aglomerado de ideias que não se articulam, sem que se identifique o que está sendo defendido. Texto com direção apresenta ideias conectadas entre si numa direção única em defesa de um ponto de vista. Abordagem completa do tema sem direção é avaliada no nível 1.",
    situations: [],
  },
  {
    ...base,
    type: "regra",
    title: "Textos tangentes: níveis 0 e 1",
    text: "Textos tangentes ao tema não ultrapassam o nível 1 da Competência III. Tangente e sem direção = nível 0; tangente e com direção = nível 1. Nesses casos não se avalia a qualidade do projeto ou do desenvolvimento: basta verificar a presença de direção.",
    situations: [],
  },
  {
    ...base,
    type: "regra",
    title: "Grade dos níveis 2 a 5 e regra do nível inferior",
    text: "Com abordagem completa: nível 2 = projeto com muitas falhas E sem desenvolvimento ou com desenvolvimento de apenas uma informação; nível 3 = projeto com algumas falhas E desenvolvimento de algumas informações; nível 4 = projeto com poucas falhas E desenvolvimento da maior parte; nível 5 = projeto estratégico E desenvolvimento em todo o texto. Se projeto e desenvolvimento estão em níveis diferentes, prevalece o mais baixo.",
    situations: [],
  },
  {
    ...base,
    type: "regra",
    title: "Nível 2: muitas falhas e ausência de desenvolvimento",
    text: "Nível 2 (80): projeto de texto com muitas falhas E informações sem desenvolvimento ou com desenvolvimento de apenas uma informação; ou contradição grave. O participante apenas seleciona informações, sem relacioná-las, organizá-las ou interpretá-las: cada dado aparece desligado do anterior e do seguinte, sem hierarquia (exemplo do manual: menciona o algoritmo, passa aos aparelhos de acesso, depois a um dado de usuários, sem relação entre eles). Se já houver mais de uma informação desenvolvida e as ideias se organizarem em defesa do ponto de vista, ainda que com falhas, o texto já está no nível 3.",
    situations: ["c3-desenvolvimento-curto", "c3-poucos-paragrafos"],
  },
  {
    ...base,
    type: "caso-limite",
    title: "Contradição grave",
    text: "Contradição grave é aquela que invalida o ponto de vista defendido (ex.: afirmar que o ser humano não é manipulado pela internet e, nos parágrafos seguintes, mostrar como ele é influenciado, propondo inclusive solução para essa manipulação). Textos com contradição grave não ultrapassam o nível 2. Contradições pontuais no desenvolvimento de um argumento comprometem o projeto, mas não invalidam o ponto de vista.",
    situations: ["c3-negacao-tese"],
  },
  {
    ...base,
    type: "regra",
    title: "Nível 3: algumas falhas e desenvolvimento de algumas informações",
    text: "Nível 3 (120): projeto de texto perceptível, com algumas falhas (mais que poucas), E desenvolvimento de algumas informações, enquanto outras ficam sem desenvolvimento. O participante já organiza informações em defesa de um ponto de vista. O desenvolvimento pode ser simples: no exemplo do manual, afirmar que o controle de conteúdo tem um lado positivo e exemplificar com 'pedofilia' e 'violência' já é desenvolvimento; ao mesmo tempo, 'fatores externos' sem dizer quais e 'regular o poder da internet' sem dizer como ficam sem desenvolvimento. Mais do que contar argumentos, avalia-se o quanto a falta de desenvolvimento afeta a progressão. Não se exige projeto estratégico nem desenvolvimento em todo o texto.",
    situations: ["c3-desenvolvimento-curto"],
  },
  {
    ...base,
    type: "regra",
    title: "Nível 4: poucas falhas e indícios de autoria",
    text: "Nível 4 (160): projeto recuperável com poucas falhas E desenvolvimento da maior parte das informações (indícios de autoria). Falhas típicas do manual: um argumento fundamental anunciado na introdução e abandonado depois (o texto promete discutir 'raízes do problema e solução' e só trata da solução); dois argumentos postos no mesmo patamar, mas tratados de forma desigual, sem hierarquia estratégica entre principal e complementar; afirmação pontual não explicada ('falsa sensação de liberdade'); relação causal afirmada sem que o caminho fique claro ('bolhas sociais contribuem para a intolerância'). Repertório bem escolhido não impede o nível 4: importa como as informações são organizadas e desenvolvidas.",
    situations: ["c3-texto-completo"],
  },
  {
    ...base,
    type: "regra",
    title: "Nível 5: projeto estratégico e autoria",
    text: "Nível 5 (200): projeto de texto estratégico E informações, fatos e opiniões desenvolvidos em TODO o texto, configurando autoria (o texto se sustenta sozinho). As duas condições precisam ser satisfeitas; verifique parágrafo a parágrafo se cada tese parcial é explicada (por quê? como?) e não apenas afirmada e ilustrada. Admitem-se apenas deslizes pontuais, que não prejudicam a progressão. Exemplo do manual: a introdução anuncia que a manipulação prejudica 'a liberdade e o senso crítico', o texto desenvolve a liberdade e abandona o senso crítico, ideia secundária: é deslize. Estilo elaborado, vocabulário formal e repertório abundante não garantem o nível 5: um parágrafo inteiro apoiado em citação sem explicação já é falta de desenvolvimento (nível 4).",
    situations: ["c3-texto-completo"],
  },
  {
    ...base,
    type: "caso-limite",
    title: "Falha (nível 4) versus deslize (nível 5)",
    text: "Falha de projeto prejudica a progressão porque envolve aspecto IMPORTANTE para a discussão, parte do que o texto se propôs: no exemplo do manual, a introdução apresenta o conceito freudiano de que o intelecto administra as vontades e anuncia sua deturpação pela manipulação; o texto trata da manipulação e abandona a questão do intelecto. Isso é falha (nível 4), pois parte do 'prometido' não é cumprido. Deslize é pontual e SECUNDÁRIO, não essencial ao projeto (nível 5). As falhas do nível 4 são evidentes e fáceis de classificar; os deslizes são tão sutis que nem se distingue se são de projeto ou de desenvolvimento. Na dúvida entre falha e deslize em ideia anunciada na introdução, verifique se ela é central para a tese.",
    situations: ["c3-texto-completo"],
  },
  {
    ...base,
    type: "regra",
    title: "Relação com as Competências II, IV e V",
    text: "Não se arrastam notas entre competências. O repertório (inclusive 'limitado aos textos motivadores') é avaliado só na Competência II. A Competência IV avalia as marcas linguísticas de coesão; a III, a estrutura profunda do sentido. A articulação entre a proposta de intervenção e a discussão do texto é avaliada na Competência III, não na V.",
    situations: [],
  },
];
