"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Database, Search, SearchCode } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { COMPETENCIES, type CompetencyId } from "@/domain/competencies";
import { useTRPC } from "@/lib/trpc";
import { SAMPLE } from "../corrector/sample";
import { StatusBanner } from "../status-banner";
import { Badge, Button, Card, CardHeader, Empty, Input, Label, Segmented, Stat, Textarea, cn } from "../ui";
import { CopyTableButton } from "../experiments/export";

export function LabView() {
  const trpc = useTRPC();
  const status = useQuery(trpc.system.status.queryOptions());
  const stats = useQuery(trpc.knowledge.stats.queryOptions());

  return (
    <div className="pt-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Lab RAG</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-2">
        Inspecione a base de conhecimento e veja, canal a canal, por que cada trecho dos manuais foi (ou não) recuperado para
        uma redação: similaridade densa em z-score, BM25 e roteamento por situações, fundidos por RRF. Situações de alta precisão garantem vaga no prompt.
      </p>
      <StatusBanner />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Chunks indexados" value={status.data?.index.chunks ?? "—"} hint={status.data?.index.ok ? "índice atualizado" : "índice pendente"} />
        <Stat label="Embeddings" value={stats.data?.dimension ? `${stats.data.dimension} dims` : "—"} hint={status.data?.embedding.model} />
        <Stat label="Top-k / limiar z" value={status.data ? `${status.data.rag.topK} / ${status.data.rag.minDenseZ}` : "—"} hint="por competência" />
        <Stat label="Modelo" value={<span className="text-lg">{status.data?.model ?? "—"}</span>} hint="Gemini" />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Chunks e embeddings por competência"
          subtitle="Gerada a partir da base atual"
          actions={
            stats.data && (
              <CopyTableButton
                rows={[
                  ["Competência", "Chunks", "Embeddings", "Dimensão", "Regras", "Casos Limite"],
                  ...stats.data.rows.map((r) => [`C${r.competency}`, r.chunks, r.embeddings, stats.data!.dimension ?? "—", r.regras, r.casosLimite]),
                  [
                    "Total",
                    stats.data.rows.reduce((a, r) => a + r.chunks, 0),
                    stats.data.rows.reduce((a, r) => a + r.embeddings, 0),
                    stats.data.dimension ?? "—",
                    stats.data.rows.reduce((a, r) => a + r.regras, 0),
                    stats.data.rows.reduce((a, r) => a + r.casosLimite, 0),
                  ],
                ]}
              />
            )
          }
        />
        <div className="overflow-x-auto p-5">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-[11px] tracking-[0.12em] text-ink-3 uppercase">
              <tr>
                {["Competência", "Chunks", "Embeddings", "Dimensão", "Regras", "Casos-limite"].map((h) => (
                  <th key={h} className="pb-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.data?.rows.map((r) => (
                <tr key={r.competency} className="border-t border-line">
                  <td className="py-2 font-semibold">C{r.competency}</td>
                  <td>{r.chunks}</td>
                  <td>{r.embeddings}</td>
                  <td>{stats.data.dimension ?? "—"}</td>
                  <td>{r.regras}</td>
                  <td>{r.casosLimite}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Inspector />
      <ChunkBrowser />
    </div>
  );
}

function Inspector() {
  const trpc = useTRPC();
  const [tema, setTema] = useState(SAMPLE.tema);
  const [texto, setTexto] = useState(SAMPLE.texto);
  const [comp, setComp] = useState<string>("5");
  const [showAll, setShowAll] = useState(false);
  const inspect = useMutation(trpc.knowledge.inspect.mutationOptions({ onError: (e) => toast.error(e.message) }));
  const data = inspect.data;
  const current = data?.competencies.find((c) => String(c.competency) === comp);

  return (
    <Card className="mt-6">
      <CardHeader title="Inspecionar recuperação" subtitle="Rode apenas a etapa de recuperação (sem chamar o Gemini)" />
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] [&>*]:min-w-0">
        <form
          className="min-w-0 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            inspect.mutate({ tema, texto, textosMotivadores: "" });
          }}
        >
          <div>
            <Label>Tema</Label>
            <Input value={tema} onChange={(e) => setTema(e.target.value)} />
          </div>
          <div>
            <Label>Redação</Label>
            <Textarea rows={12} value={texto} onChange={(e) => setTexto(e.target.value)} />
          </div>
          <Button type="submit" variant="primary" loading={inspect.isPending}>
            <SearchCode className="size-4" /> Recuperar trechos
          </Button>
          {inspect.isPending && <p className="text-xs text-ink-3">Na primeira execução o modelo de embeddings é carregado (alguns segundos).</p>}
          {data && (
            <div className="rounded-xl border border-line bg-surface-2/60 p-3">
              <div className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">
                Situações detectadas ({data.situations.length}) · {data.latencyMs} ms
              </div>
              <div className="space-y-1.5">
                {data.situations.map((s) => (
                  <div key={s.id} className="min-w-0 text-xs">
                    <div className="flex items-start gap-1.5">
                      <Badge tone="neutral" className="shrink-0">C{s.competency}</Badge>
                      <span className="min-w-0 text-ink [overflow-wrap:anywhere]">{s.label}</span>
                    </div>
                    <div className="mt-0.5 truncate pl-1 text-ink-3" title={s.evidence[0]}>{s.evidence[0]}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>

        <div className="min-w-0">
          {!data ? (
            <Empty icon={<Search className="size-8" />} title="Nenhuma recuperação ainda">
              Use a redação de exemplo ou cole outra e clique em “Recuperar trechos”.
            </Empty>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Segmented value={comp} onChange={setComp} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `C${n}` }))} />
                <label className="flex items-center gap-2 text-xs text-ink-3">
                  <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> mostrar todos os chunks
                </label>
              </div>
              <div className="mt-3 overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[640px] text-xs">
                  <thead className="bg-surface-2 text-left text-[10px] tracking-[0.1em] text-ink-3 uppercase">
                    <tr>
                      <th className="p-2.5">Chunk</th>
                      <th className="p-2.5">Cosseno</th>
                      <th className="p-2.5" title="z-score do cosseno na competência">z</th>
                      <th className="p-2.5">BM25 (rank)</th>
                      <th className="p-2.5">Situação</th>
                      <th className="p-2.5">RRF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current?.items
                      .filter((i) => showAll || i.eligible)
                      .map((i) => (
                        <tr key={i.id} className={cn("border-t border-line align-top", i.selected && "bg-ok/5")}>
                          <td className="max-w-[260px] p-2.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {i.selected ? <Badge tone="ok">no prompt</Badge> : i.eligible ? <Badge tone="warn">elegível</Badge> : <Badge>abaixo do limiar</Badge>}
                              {i.type === "caso-limite" && <Badge tone="rag">caso-limite</Badge>}
                            </div>
                            <div className="mt-1 font-medium text-ink [overflow-wrap:anywhere]">{i.title}</div>
                            <div className="text-[10px] text-ink-3 [overflow-wrap:anywhere]">{i.id}</div>
                          </td>
                          <td className="p-2.5 tabular-nums">{i.dense.toFixed(3)}</td>
                          <td className={cn("p-2.5 tabular-nums", i.denseZ >= 1 && "text-ok")}>{i.denseZ.toFixed(2)}</td>
                          <td className="p-2.5 tabular-nums">
                            {i.bm25.toFixed(2)} {i.bm25Rank ? `(#${i.bm25Rank})` : ""}
                          </td>
                          <td className="max-w-[180px] p-2.5 [overflow-wrap:anywhere]">
                            {i.routeHits.length ? i.routeHits.join(", ") : "—"}
                            {i.routed && <div className="mt-1"><Badge tone="rag" title="Situação de alta precisão: vaga garantida no top-k">prioridade</Badge></div>}
                          </td>
                          <td className="p-2.5 font-semibold tabular-nums">{i.rrf.toFixed(4)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function ChunkBrowser() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.knowledge.chunks.queryOptions());
  const [comp, setComp] = useState<string>("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"chunks" | "rubric">("chunks");
  const filtered = useMemo(
    () =>
      (data?.chunks ?? []).filter(
        (c) => (comp === "all" || String(c.competency) === comp) && (`${c.title} ${c.text}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [data, comp, q],
  );

  return (
    <Card className="mt-6">
      <CardHeader
        title="Base de conhecimento"
        subtitle="Rubrica fixa (sempre no prompt) e chunks recuperáveis via RAG"
        actions={<Segmented value={view} onChange={setView} options={[{ value: "chunks", label: "Chunks RAG" }, { value: "rubric", label: "Rubrica fixa" }]} />}
      />
      <div className="p-5">
        <div className="flex flex-wrap gap-2">
          <Segmented value={comp} onChange={setComp} options={[{ value: "all", label: "Todas" }, ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `C${n}` }))]} />
          {view === "chunks" && <Input className="h-9 max-w-xs" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />}
        </div>
        {view === "chunks" ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {filtered.map((c) => (
              <div key={c.id} className="rounded-xl border border-line bg-surface-2/50 p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="brand">C{c.competency}</Badge>
                  <Badge tone={c.type === "caso-limite" ? "rag" : "neutral"}>{c.type}</Badge>
                  <span className="ml-auto text-[10px] text-ink-3">{c.id}</span>
                </div>
                <div className="mt-2 text-sm font-semibold">{c.title}</div>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-2">{c.text}</p>
                {c.situations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.situations.map((s) => (
                      <span key={s} className="rounded bg-line px-1.5 py-0.5 text-[10px] text-ink-3">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!filtered.length && <div className="text-sm text-ink-3">Nenhum chunk encontrado.</div>}
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {Object.values(data?.rubric ?? {})
              .filter((r) => comp === "all" || String(r.competency) === comp)
              .map((r) => (
                <div key={r.competency} className="rounded-xl border border-line bg-surface-2/50 p-4 text-xs leading-relaxed text-ink-2">
                  <div className="mb-2 text-sm font-semibold text-ink">
                    C{r.competency} · {COMPETENCIES[r.competency as CompetencyId].short}
                  </div>
                  <div className="font-semibold text-ink-3">Grade específica</div>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {r.grade.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                  <div className="mt-3 font-semibold text-ink-3">Critérios operacionais</div>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {r.counting.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        )}
        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-ink-3">
          <Database className="size-3.5" /> Fonte: manuais de correção do INEP em data/Competencia_*.pdf. Para editar, altere src/knowledge e rode pnpm kb:index.
        </p>
      </div>
    </Card>
  );
}
