"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTRPC } from "@/lib/trpc";
import { StatusBanner } from "../status-banner";
import { Segmented } from "../ui";
import { DatasetPanel } from "./dataset-panel";
import { ResultsPanel } from "./results-panel";
import { RunsPanel } from "./runs-panel";

type Tab = "dataset" | "run" | "results";

export function ExperimentsView() {
  const trpc = useTRPC();
  const [tab, setTab] = useState<Tab>("dataset");
  const [runId, setRunId] = useState<string | null>(null);
  const runs = useQuery({ ...trpc.run.list.queryOptions(), staleTime: 0, refetchOnMount: "always" });

  useEffect(() => {
    if (tab === "results") void runs.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (!runId && runs.data?.[0]) setRunId(runs.data[0].id);
  }, [runs.data, runId]);

  return (
    <div className="pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Experimentos</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-2">
            Corrija redações com notas humanas conhecidas nas duas configurações (sem e com RAG) e compare os resultados
            por competência, com gráficos e tabelas para exportar.
          </p>
        </div>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "dataset", label: "1 · Dataset" },
            { value: "run", label: "2 · Executar" },
            { value: "results", label: "3 · Resultados" },
          ]}
        />
      </div>
      <StatusBanner />
      <div className="mt-6">
        {tab === "dataset" && <DatasetPanel />}
        {tab === "run" && (
          <RunsPanel
            onOpen={(id) => {
              setRunId(id);
              setTab("results");
            }}
          />
        )}
        {tab === "results" && <ResultsPanel runId={runId} runs={runs.data ?? []} onSelect={setRunId} />}
      </div>
    </div>
  );
}
