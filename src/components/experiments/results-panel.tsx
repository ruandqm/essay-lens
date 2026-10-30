"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { COMPETENCY_IDS, type CompetencyId, type GradingMode } from "@/domain/competencies";
import { averagePrediction, totalOf, type AgreementStats, type ModeMetrics } from "@/domain/metrics";
import { useTRPC } from "@/lib/trpc";
import { GroupedBarChart, Heatmap, SERIES_COLORS, ScatterChart, type Series } from "../charts/charts";
import { Badge, Button, Card, CardHeader, Empty, Segmented, Stat, cn } from "../ui";
import { ChartCard, CopyTableButton } from "./export";

const n1 = (v: number | null | undefined, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? "—" : v.toFixed(d).replace(".", ","));
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
const LABEL: Record<GradingMode, string> = { baseline: "IA sem RAG", rag: "IA com RAG" };

const STATUS_LABEL = { done: "concluída", running: "em andamento", error: "erro", cancelled: "interrompida", paused: "pausada (limite do Gemini)" } as const;

export function RunStatusBadge({ status }: { status: keyof typeof STATUS_LABEL }) {
  return (
    <Badge tone={status === "done" ? "ok" : status === "running" ? "info" : status === "error" ? "bad" : "warn"}>{STATUS_LABEL[status]}</Badge>
  );
}

/** Contagem regressiva da espera pelo limite do Gemini. */
export function WaitCountdown({ until }: { until?: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [until]);
  if (!until) return null;
  const left = Math.max(0, Math.round((new Date(until).getTime() - now) / 1000));
  return <span className="ml-1 font-semibold text-warn tabular-nums">({left >= 60 ? `${Math.floor(left / 60)}min ${left % 60}s` : `${left}s`})</span>;
}

export function ResultsPanel({ runId, runs, onSelect }: { runId: string | null; runs: { id: string; name: string }[]; onSelect: (id: string) => void }) {
  const trpc = useTRPC();
  const q = useQuery({
    ...trpc.run.get.queryOptions({ id: runId ?? "" }),
    enabled: Boolean(runId),
    refetchInterval: (query) => (query.state.data?.run.status === "running" ? 3000 : false),
  });
  const chunks = useQuery(trpc.knowledge.chunks.queryOptions());
  const [heatMode, setHeatMode] = useState<GradingMode>("rag");
  const qc = useQueryClient();
  const resume = useMutation(
    trpc.run.resume.mutationOptions({
      onSuccess: ({ count }) => {
        toast.success(`Retomando ${count} correção(ões) pendente(s)`);
        void qc.invalidateQueries({ queryKey: trpc.run.get.queryKey({ id: runId ?? "" }) });
        void qc.invalidateQueries({ queryKey: trpc.run.list.queryKey() });
      },
      onError: (e) => toast.error(e.message, { duration: 10000 }),
    }),
  );

  if (!runId)
    return (
      <Card>
        <Empty title="Selecione uma execução">Inicie uma execução na aba “Executar” ou escolha uma existente.</Empty>
      </Card>
    );
  if (!q.data) return <Card className="skeleton h-64" />;

  const { run, rows, metrics } = q.data;
  const { baseline, rag, comparison } = metrics;
  const modes = run.config.modes.filter((m) => metrics[m]);
  const cats = COMPETENCY_IDS.map((c) => `C${c}`);
  const fileBase = `${run.name.replace(/[^\w-]+/g, "_")}`;
  const color = (m: GradingMode | "human") => (theme: "dark" | "print") => SERIES_COLORS[m][theme];
  const expected = run.config.essayIds.length * run.config.modes.length * run.config.repetitions;
  const okCount = run.results.filter((r) => !r.error).length;
  const failedCount = run.results.filter((r) => r.error).length;
  const pending = { total: Math.max(0, expected - okCount), failed: failedCount, missing: Math.max(0, expected - okCount - failedCount) };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={runId}
          onChange={(e) => onSelect(e.target.value)}
          className="h-10 rounded-xl border border-line-strong bg-surface-2 px-3 text-sm text-ink"
        >
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <RunStatusBadge status={run.status} />
        {run.status === "running" && (
          <span className="text-xs text-ink-2">
            {run.progress.done}/{run.progress.total}
            {run.progress.current ? ` · ${run.progress.current}` : ""}
            <WaitCountdown until={run.progress.waitingUntil} />
          </span>
        )}
        <span className="text-xs text-ink-3">
          {run.config.model} · {run.config.embeddingModel} · top-k {run.config.rag.topK} · {run.config.repetitions} repetição(ões)
        </span>
      </div>

      {run.status !== "running" && pending.total > 0 && (
        <Card className="flex flex-col gap-3 border-warn/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <div className="font-semibold text-warn">
              {pending.total} correção(ões) pendente(s)
              {pending.failed > 0 && pending.missing > 0
                ? ` · ${pending.failed} falharam, ${pending.missing} não chegaram a rodar`
                : pending.failed > 0
                  ? " · falharam"
                  : " · não chegaram a rodar"}
            </div>
            <div className="mt-0.5 text-xs text-ink-3">
              {run.error ?? "As métricas abaixo usam só as correções concluídas."} Ao retomar, só as pendentes são corrigidas.
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={() => resume.mutate({ id: run.id })} loading={resume.isPending}>
            {!resume.isPending && <RotateCcw className="size-3.5" />} Retomar
          </Button>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="MAE geral · sem RAG" value={n1(baseline?.maeMean)} hint="média dos MAE por competência" />
        <Stat label="MAE geral · com RAG" value={n1(rag?.maeMean)} hint="pontos por competência" />
        <Stat
          label="Redução do MAE"
          value={comparison ? `${n1(comparison.reduction.mean.percent, 0)}%` : "—"}
          tone={comparison ? (comparison.reduction.mean.absolute >= 0 ? "ok" : "bad") : undefined}
          hint={comparison ? `${n1(comparison.reduction.mean.absolute)} pontos` : "requer as duas configurações"}
        />
        <Stat
          label="Wilcoxon (pareado)"
          value={comparison?.wilcoxon ? `p = ${comparison.wilcoxon.pValue < 0.001 ? "<0,001" : n1(comparison.wilcoxon.pValue, 3)}` : "—"}
          hint={comparison?.wilcoxon ? `n = ${comparison.wilcoxon.n} pares com diferença` : "amostra insuficiente"}
        />
      </div>

      {comparison && <SummaryText baseline={baseline!} rag={rag!} n={rows.length} />}

      <ChartCard
        title="Erro Absoluto Médio (MAE) por competência"
        subtitle="Diferença média entre a nota atribuída e a do avaliador humano"
        filename={`${fileBase}-mae-por-competencia`}
        render={(theme) => (
          <GroupedBarChart
            theme={theme}
            title={theme === "print" ? "Erro Absoluto Médio (MAE) por Competência" : undefined}
            categories={cats}
            yLabel="MAE (pontos)"
            xLabel="Competência"
            decimals={1}
            series={modes.map((m) => ({ key: m, label: LABEL[m], color: color(m)(theme), values: COMPETENCY_IDS.map((c) => metrics[m]!.perCompetency[c].mae) }))}
          />
        )}
      />

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <ChartCard
          title="Nota total por redação"
          subtitle="Nota humana × nota atribuída (média das repetições)"
          filename={`${fileBase}-nota-total`}
          render={(theme) => (
            <GroupedBarChart
              theme={theme}
              title={theme === "print" ? "Nota total por redação" : undefined}
              categories={rows.map((r) => r.label)}
              yLabel="Nota total"
              yMax={1000}
              width={900}
              series={[
                { key: "human", label: "Humano", color: color("human")(theme), values: rows.map((r) => totalOf(r.human)) },
                ...modes.map<Series>((m) => ({
                  key: m,
                  label: LABEL[m],
                  color: color(m)(theme),
                  values: rows.map((r) => (r.predictions[m]?.length ? totalOf(averagePrediction(r.predictions[m]!)) : null)),
                })),
              ]}
            />
          )}
        />
        <ChartCard
          title="Concordância na nota total"
          subtitle="Cada ponto é uma redação; a diagonal é a concordância perfeita"
          filename={`${fileBase}-dispersao`}
          render={(theme) => (
            <ScatterChart
              theme={theme}
              title={theme === "print" ? "Nota humana × nota da IA" : undefined}
              xLabel="Nota humana"
              yLabel="Nota da IA"
              points={modes.flatMap((m) =>
                rows
                  .filter((r) => r.predictions[m]?.length)
                  .map((r) => ({ series: LABEL[m], color: color(m)(theme), x: totalOf(r.human), y: totalOf(averagePrediction(r.predictions[m]!)), label: r.label })),
              )}
            />
          )}
        />
      </div>

      <ChartCard
        title="Mapa de erro por redação e competência"
        subtitle="Onde a correção mais divergiu do avaliador humano"
        filename={`${fileBase}-mapa-erro-${heatMode}`}
        render={(theme) => (
          <Heatmap
            theme={theme}
            title={theme === "print" ? `Erro absoluto por redação — ${LABEL[heatMode]}` : undefined}
            rows={rows.map((r) => r.label)}
            cols={cats}
            values={rows.map((r) => {
              const p = r.predictions[heatMode];
              if (!p?.length) return COMPETENCY_IDS.map(() => 0);
              const avg = averagePrediction(p);
              return COMPETENCY_IDS.map((c) => Math.abs(avg[c] - r.human[c]));
            })}
          />
        )}
      >
        {modes.length > 1 && (
          <div className="px-5 pb-5">
            <Segmented value={heatMode} onChange={setHeatMode} options={modes.map((m) => ({ value: m, label: LABEL[m] }))} />
          </div>
        )}
      </ChartCard>

      <ScoresTable rows={rows} modes={modes} fileBase={fileBase} />
      <MetricsTable metrics={modes.map((m) => metrics[m]!)} fileBase={fileBase} />
      {run.config.modes.includes("rag") && <RetrievalUsage run={run} titles={new Map((chunks.data?.chunks ?? []).map((c) => [c.id, c.title]))} />}

      {run.results.some((r) => r.error) && (
        <Card>
          <CardHeader title="Falhas" subtitle="Correções que não terminaram (não entram nas métricas). Use “Retomar” para refazê-las." />
          <div className="space-y-2 p-5 text-xs">
            {run.results
              .filter((r) => r.error)
              .map((r, i) => (
                <div key={i} className="rounded-lg border border-bad/30 bg-bad/5 p-2.5 text-bad">
                  {run.human[r.essayId]?.label} · {LABEL[r.mode]} · rep. {r.repetition}: {r.error}
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function SummaryText({ baseline, rag, n }: { baseline: ModeMetrics; rag: ModeMetrics; n: number }) {
  const red = COMPETENCY_IDS.map((c) => ({ c, d: baseline.perCompetency[c].mae - rag.perCompetency[c].mae })).sort((a, b) => b.d - a.d);
  const best = red[0]!;
  const worst = red[red.length - 1]!;
  const text =
    `Na amostra analisada (${n} redações), o Erro Absoluto Médio (MAE) geral foi ${rag.maeMean <= baseline.maeMean ? "reduzido" : "elevado"} de ${n1(baseline.maeMean)} pontos, sem RAG, para ${n1(rag.maeMean)} pontos, com RAG. ` +
    `A maior ${best.d >= 0 ? "redução" : "variação"} ocorreu na Competência ${best.c} (de ${n1(baseline.perCompetency[best.c].mae)} para ${n1(rag.perCompetency[best.c].mae)} pontos), ` +
    `e a menor na Competência ${worst.c} (de ${n1(baseline.perCompetency[worst.c].mae)} para ${n1(rag.perCompetency[worst.c].mae)} pontos). ` +
    `Na nota total, o MAE passou de ${n1(baseline.total.mae)} para ${n1(rag.total.mae)} pontos.`;
  return (
    <Card>
      <CardHeader title="Resumo dos resultados" subtitle="Gerado a partir das métricas desta execução" actions={<CopyTableButton rows={[[text]]} />} />
      <p className="p-5 text-sm leading-relaxed text-ink-2">{text}</p>
    </Card>
  );
}

function ScoresTable({ rows, modes, fileBase }: { rows: { label: string; human: Record<CompetencyId, number>; predictions: Partial<Record<GradingMode, Record<CompetencyId, number>[]>> }[]; modes: GradingMode[]; fileBase: string }) {
  const table = useMemo(() => {
    const out: (string | number)[][] = [["Redação", "Avaliação", ...COMPETENCY_IDS.map((c) => `C${c}`), "Total"]];
    for (const r of rows) {
      out.push([r.label, "Humano", ...COMPETENCY_IDS.map((c) => r.human[c]), totalOf(r.human)]);
      for (const m of modes) {
        const p = r.predictions[m];
        if (!p?.length) continue;
        const avg = averagePrediction(p);
        const fmt = (v: number) => (Number.isInteger(v) ? v : Number(v.toFixed(1)));
        out.push([r.label, LABEL[m], ...COMPETENCY_IDS.map((c) => fmt(avg[c])), fmt(totalOf(avg))]);
      }
    }
    return out;
  }, [rows, modes]);
  return (
    <Card>
      <CardHeader
        title="Avaliador humano × correção automática"
        subtitle="Notas por competência (média das repetições)"
        actions={<CopyTableButton rows={table} filename={`${fileBase}-tabela-notas`} />}
      />
      <div className="overflow-x-auto p-5">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="text-left text-[11px] tracking-[0.1em] text-ink-3 uppercase">
            <tr>
              {table[0]!.map((h) => (
                <th key={h} className="pb-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.slice(1).map((r, i) => (
              <tr key={i} className={r[1] === "Humano" ? "border-t border-line-strong" : ""}>
                {r.map((c, j) => (
                  <td key={j} className={j === 0 ? "py-1.5 font-semibold" : j === 1 ? "text-ink-2" : "tabular-nums"}>
                    {j === 0 && r[1] !== "Humano" ? "" : c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function MetricsTable({ metrics, fileBase }: { metrics: ModeMetrics[]; fileBase: string }) {
  const line = (label: string, comp: string, s: AgreementStats) => [label, comp, n1(s.mae), n1(s.rmse), n1(s.bias), pct(s.exactAgreement), pct(s.adjacentAgreement), n1(s.qwk, 2), n1(s.pearson, 2)];
  const table: (string | number)[][] = [["Configuração", "Competência", "MAE", "RMSE", "Viés", "Exata", "±40", "QWK", "Pearson"]];
  for (const m of metrics) {
    for (const c of COMPETENCY_IDS) table.push(line(LABEL[m.mode], `C${c}`, m.perCompetency[c]));
    table.push(line(LABEL[m.mode], "Total (0–1000)", m.total));
  }
  return (
    <Card>
      <CardHeader
        title="Métricas de concordância"
        subtitle="Viés positivo = correção mais generosa que o humano · Exata = mesma nota · ±40 = até um nível de diferença · QWK = kappa ponderado quadrático"
        actions={<CopyTableButton rows={table} filename={`${fileBase}-metricas`} />}
      />
      <div className="overflow-x-auto p-5">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-[11px] tracking-[0.1em] text-ink-3 uppercase">
            <tr>
              {table[0]!.map((h) => (
                <th key={h} className="pb-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.slice(1).map((r, i) => (
              <tr key={i} className={r[1] === "C1" ? "border-t border-line-strong" : ""}>
                {r.map((c, j) => (
                  <td key={j} className={j < 2 ? "py-1.5 text-ink-2" : "tabular-nums"}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {metrics.some((m) => m.stability !== null) && (
          <p className="mt-3 text-xs text-ink-3">
            Variabilidade entre repetições (desvio-padrão médio por competência):{" "}
            {metrics.map((m) => `${LABEL[m.mode]} ${n1(m.stability)} pts`).join(" · ")}
          </p>
        )}
      </div>
    </Card>
  );
}

function RetrievalUsage({
  run,
  titles,
}: {
  run: { results: { mode: GradingMode; error: string | null; retrievedIds: Record<CompetencyId, string[]>; ragApplied?: Record<CompetencyId, string[]> }[] };
  titles: Map<string, string>;
}) {
  const rs = run.results.filter((r) => r.mode === "rag" && !r.error);
  const hasApplied = rs.some((r) => r.ragApplied);
  const counts = new Map<string, { n: number; applied: number }>();
  for (const r of rs)
    for (const c of COMPETENCY_IDS) {
      const applied = new Set(r.ragApplied?.[c] ?? []);
      for (const id of r.retrievedIds[c] ?? []) {
        const x = counts.get(id) ?? { n: 0, applied: 0 };
        x.n++;
        if (applied.has(id)) x.applied++;
        counts.set(id, x);
      }
    }
  const top = [...counts.entries()].sort((a, b) => b[1].applied - a[1].applied || b[1].n - a[1].n).slice(0, 14);
  const perComp = COMPETENCY_IDS.map((c) => {
    const inPrompt = rs.reduce((a, r) => a + (r.retrievedIds[c]?.length ?? 0), 0);
    const applied = rs.reduce((a, r) => a + (r.ragApplied?.[c]?.length ?? 0), 0);
    return { c, avg: rs.length ? inPrompt / rs.length : 0, rate: inPrompt ? applied / inPrompt : 0 };
  });
  return (
    <Card>
      <CardHeader
        title="Uso da base de conhecimento"
        subtitle={`${rs.length} correções com RAG · ${hasApplied ? "barra clara = recuperado, barra cheia = aplicado à redação" : "trechos mais recuperados"}`}
      />
      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_2fr] [&>*]:min-w-0">
        <div className="space-y-2 text-sm">
          {perComp.map(({ c, avg, rate }) => (
            <div key={c} className="flex justify-between gap-3 border-b border-line pb-1.5">
              <span className="text-ink-2">C{c} · trechos no prompt</span>
              <span className="tabular-nums">
                <span className="font-semibold">{n1(avg)}</span>
                {hasApplied && <span className="ml-2 text-xs text-rag">{pct(rate)} aplicados</span>}
              </span>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          {top.map(([id, { n, applied }]) => (
            <div key={id} className="flex items-center gap-3 text-xs">
              <span className="hidden w-28 shrink-0 whitespace-nowrap text-ink-3 sm:block">{id}</span>
              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-line">
                <div className={cn("absolute inset-y-0 left-0 rounded-full", hasApplied ? "bg-rag/35" : "bg-rag")} style={{ width: `${(n / Math.max(1, rs.length)) * 100}%` }} />
                {hasApplied && <div className="absolute inset-y-0 left-0 rounded-full bg-rag" style={{ width: `${(applied / Math.max(1, rs.length)) * 100}%` }} />}
              </div>
              <span className="w-40 truncate text-ink-2 sm:w-56" title={titles.get(id)}>
                {titles.get(id) ?? id}
              </span>
              <span className="w-12 text-right tabular-nums" title="aplicado / recuperado">
                {hasApplied ? `${applied}/${n}` : n}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
