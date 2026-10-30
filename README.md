# Essay Lens — correção de redações do ENEM com RAG

Sistema do TCC *“Inteligência Artificial aplicada à avaliação de redações com base em recuperação de contexto (RAG)”*.
Next.js 16 + tRPC 11 + Gemini + FastEmbed.

## Como rodar

```bash
pnpm install
cp .env.example .env.local   # já existe um .env.local; só preencha a chave
# edite .env.local e coloque GEMINI_API_KEY=...
pnpm dev                     # http://localhost:3000
```

O índice vetorial (`data/index/knowledge-index.json`) já vem gerado. Na primeira correção com RAG, o FastEmbed
baixa o modelo `multilingual-e5-large` (~2 GB) para `.cache/fastembed` (uma única vez).
Para não baixar nada, use `EMBEDDING_PROVIDER=gemini` e rode `pnpm kb:index`.

| Comando | O que faz |
|---|---|
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build && pnpm start` | Produção |
| `pnpm kb:index` | Regera os embeddings da base (após editar `src/knowledge` ou trocar o provedor) |
| `pnpm test` | Testes do domínio, recuperação e pipeline (inclui um caso de referência do cálculo do MAE) |
| `pnpm typecheck` | Checagem de tipos |

## Telas

- **Corretor (`/`)** — tema, redação, textos motivadores e chave “Modo RAG”. Mostra nota total, parecer, eixos da
  Grade Específica por competência, trechos dos manuais usados e marcações inline (erro/alerta/destaque; anel = decisão
  fundamentada em trecho recuperado).
- **Lab RAG (`/lab`)** — Tabela 1 (chunks por competência), inspeção da recuperação canal a canal (cosseno, z-score,
  BM25, situação, RRF) e navegação pela rubrica fixa e pelos chunks.
- **Experimentos (`/experimentos`)** — cadastre/importe redações com notas humanas, rode o protocolo
  (sem RAG × com RAG, N repetições) e obtenha: MAE por competência (Figura 5), tabela humano × IA (Tabela 3),
  nota total por redação, dispersão, mapa de erro, RMSE, viés, concordância exata/±40, QWK, Pearson, Wilcoxon pareado,
  variabilidade entre repetições e texto-resumo. Gráficos exportam em PNG (alta resolução, fundo branco) e SVG;
  tabelas copiam direto para o Word ou baixam em CSV.

Formato de importação do dataset: botão “Baixar modelo” na aba Dataset.

## Metodologia implementada

1. **Base de conhecimento** — manuais do INEP (`data/Competencia_*.pdf`) curados em:
   - *rubrica fixa* (`src/knowledge/rubric.ts`): 6 descritores da Matriz, Grade Específica e critérios operacionais
     de contagem — sempre no prompt;
   - *95 chunks* autocontidos (`src/knowledge/chunks/`), tipos `regra` e `caso-limite`, IDs `comp{N}-{hash}`.
2. **Embeddings** — FastEmbed, `multilingual-e5-large`, 1024 dimensões.
3. **Recuperação híbrida** (`src/application/rag/`) — por competência: (i) cosseno normalizado em z-score, (ii) BM25, (iii) roteamento por situações detectadas (ex.: “se/caso/desde que” →
   caso-limite das condicionais), fundidos por Reciprocal Rank Fusion; trechos abaixo do limiar ficam de fora.
   Situações de alta precisão garantem vaga no top-k.
4. **Geração** — o Gemini só produz **marcações estruturadas** (JSON validado por Zod); a nota é calculada no
   servidor por **regras determinísticas** da Grade Específica (`src/domain/scoring/`), com testes. No modo RAG,
   o JSON começa pela **aplicação dos trechos**: para cada trecho recuperado, a IA diz se a situação ocorre na
   redação, onde, e que decisão a regra impõe — só depois faz as marcações.
5. **Avaliação** — MAE por competência (Equação 3) e métricas complementares (`src/domain/metrics.ts`).

## Refinamentos do RAG

Ajustes feitos após analisar os experimentos de 30/10/2026, todos dentro da metodologia original (mesmos três
sinais, RRF, limiar e marcações estruturadas):

| Ajuste | Onde | Por quê |
|---|---|---|
| Detectores da C5 olham só para a proposta | `rag/situations.ts` (`proposal`) | Disparavam com frases da introdução (ex.: o “se” de “deve-se” virava condicional) e enchiam o prompt de casos-limite que não se aplicavam. |
| Situações ligadas às marcas de cada elemento da C5 | `c5-modo-meio`, `c5-efeito`, `c5-detalhamento`, `c5-agente-ausente`, `c5-parceria`, `c5-acao-nula` | A IA recebia exceções, mas não as definições de modo/meio, efeito e detalhamento de que precisa para contar. |
| Trechos da C5 reescritos com os exemplos do manual | `knowledge/chunks/c5.ts` | Ação vaga = nula; justificativa = detalhamento; o que só completa a ação faz parte dela; “mediante parceria” = modo/meio. |
| C3: níveis vizinhos e desenvolvimento por informação | `knowledge/chunks/c3.ts` | Texto longo recebe níveis 4 e 5 e “falha × deslize”; texto curto recebe níveis 2 e 3. O desenvolvimento é avaliado em cada informação (exemplos do manual), não só nos argumentos principais. Antes, um único nível servia de âncora. |
| C1: detectores do provável desvio | `c1-crase-provavel`, `c1-regencia-provavel`, `c1-concordancia-provavel`, `c1-grafia-provavel` | Os detectores antigos só diziam que o texto usa crase/hífen; os novos apontam o trecho com provável erro, e a regra correspondente entra no prompt. |
| C2: referência sem fonte | `c2-referencia-vaga` | “Segundo especialistas”, “o artigo N dos direitos” sem dizer a lei: verificar se o repertório é legitimado. |
| Exceções da C4 só no caso específico | `c4-inicio-citacao`; “Inadequação coesiva” sem `c4-dessa-forma` | Regras de exceção chegavam a toda redação boa e induziam severidade. |
| C4: repetição com o equilíbrio do manual | `knowledge/chunks/c4.ts`, `c4-repeticao-conectivo` | Os trechos só traziam o lado da penalização; agora trazem também o que o manual tolera (repetição é esperada; operadores diferentes são diversidade). O detector ignora “assim”, “também”, “pois”. |
| C4: aberturas formais de parágrafo | `CONNECTIVES` | “Destarte”, “Sob essa ótica”, “Com efeito”… não eram reconhecidos, e o prompt afirmava, falsamente, que havia parágrafos sem conexão. |
| C1: regras de vírgula do manual | “Desvios de pontuação”, `c1-virgula-intercalada` | Inclui o que é desvio (intercalada/adjunto longo sem uma das vírgulas) e o que não é (adjunto com menos de 3 palavras). |
| C3: citação que substitui a explicação | “Desenvolvimento das informações”, `c3-argumento-citacao` | A IA contava qualquer citação como desenvolvimento; o trecho distingue a citação que reforça uma ideia explicada da que substitui a explicação, e aponta os parágrafos apoiados em citação. Nível 3 deixa claro que um exemplo simples já desenvolve; “Informação seguida de outra” deixou de ser roteado nos textos curtos (empurrava para o nível 2). |
| C1: desvio × falha de estrutura | “Falha de estrutura ou desvio de pontuação?” | Vírgula e regência são desvios, não falhas; como o nível 5 admite 2 desvios e 1 falha, a classificação errada mantinha 200 com três problemas. |
| Prioridade do roteamento de alta precisão | `PRIORITY_SITUATIONS` | Situações que apontam um caso-limite garantem vaga; situações comuns só somam no RRF. |
| Aplicação dos trechos | `withChunkApplications`, `prompts.ts` | A IA diz, para cada trecho, se ele se aplica e qual decisão impõe; trechos que não correspondem ao texto são ignorados. |
| 5 trechos por competência | `RAG_TOP_K=5` | Com 4 vagas, definições necessárias ficavam de fora. |

## Limite de requisições do Gemini (429)

- **Cliente:** ao receber 429, todas as chamadas entram numa pausa compartilhada, usando a espera sugerida pela API.
  Uma correção avulsa desiste após `GEMINI_RATE_LIMIT_MAX_WAIT` (120 s) com uma mensagem clara.
- **Experimentos:** cada correção concluída é salva na hora. Se o limite persistir, a execução espera
  (30 s, 1, 2, 4 e depois 5 min, até `EXPERIMENT_RATE_LIMIT_PAUSES` vezes) e tenta de novo, reaproveitando as
  competências daquela redação que já tinham voltado. Se ainda assim não liberar, ou se a cota diária acabar, a
  execução fica **pausada**.
- **Retomar:** execuções pausadas, interrompidas (inclusive por reinício do servidor) ou com falhas mostram o botão
  “Retomar”, que corrige só o que está pendente.

## Arquitetura

```
src/
  domain/          regras puras: competências, marcações, pontuação, métricas, análise do texto
  application/     casos de uso (corrigir, executar experimento, indexar), RAG e prompts; portas (interfaces)
  infrastructure/  adaptadores: Gemini, FastEmbed/Gemini embeddings, repositórios em arquivo, container
  knowledge/       rubrica fixa e chunks curados dos manuais
  server/          routers tRPC e execução de experimentos em segundo plano
  app/, components/ interface Next.js
```

O domínio não depende de nada externo; trocar o LLM ou o provedor de embeddings é implementar uma porta em
`application/ports.ts`.

## Configuração (`.env.local`)

`GEMINI_MODEL` (padrão `gemini-3.5-flash-lite`), `GEMINI_TEMPERATURE` (0), `GEMINI_MAX_CONCURRENCY` (4 — reduza se
houver erro 429), `GEMINI_RATE_LIMIT_MAX_WAIT` (120 s), `EXPERIMENT_RATE_LIMIT_PAUSES` (8), `EMBEDDING_PROVIDER`,
`RAG_TOP_K`, `RAG_MIN_DENSE_Z`, `RAG_BM25_MAX_RANK`, `RAG_RRF_K`.

Cada correção faz 6 chamadas ao Gemini (C1, C2 e C4 em paralelo; C3 e C5 recebem a abordagem do tema; parecer).
Os resultados dos experimentos ficam em `data/experiments/`.
