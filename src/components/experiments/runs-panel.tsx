"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Play, RotateCcw, Square, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc";
import { Badge, Button, Card, CardHeader, Empty, Input, Label, cn } from "../ui";
import { RunStatusBadge, WaitCountdown } from "./results-panel";

export function RunsPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const dataset = useQuery(trpc.dataset.list.queryOptions());
  const runs = useQuery({
    ...trpc.run.list.queryOptions(),
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === "running") ? 2000 : false),
  });
  const [name, setName] = useState(`Experimento ${new Date().toLocaleDateString("pt-BR")}`);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [modes, setModes] = useState({ baseline: true, rag: true });
  const [reps, setReps] = useState(1);
  const invalidate = () => qc.invalidateQueries({ queryKey: trpc.run.list.queryKey() });

  const essays = dataset.data ?? [];
  const chosen = selected ?? essays.map((e) => e.id);
  const modeList = (["baseline", "rag"] as const).filter((m) => modes[m]);
  const calls = chosen.length * modeList.length * reps * 6;

  const start = useMutation(
    trpc.run.start.mutationOptions({
      onSuccess: () => (invalidate(), toast.success("Experimento iniciado")),
      onError: (e) => toast.error(e.message, { duration: 10000 }),
    }),
  );
  const cancel = useMutation(trpc.run.cancel.mutationOptions({ onSuccess: invalidate }));
  const remove = useMutation(trpc.run.remove.mutationOptions({ onSuccess: invalidate }));
  const resume = useMutation(
    trpc.run.resume.mutationOptions({
      onSuccess: ({ count }) => (invalidate(), toast.success(`Retomando ${count} correção(ões) pendente(s)`)),
      onError: (e) => toast.error(e.message, { duration: 10000 }),
    }),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      <Card className="lg:self-start">
        <CardHeader title="Nova execução" subtitle="Cada redação é corrigida sem RAG e com RAG" />
        <form
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            start.mutate({ name, essayIds: chosen, modes: modeList, repetitions: reps });
          }}
        >
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label hint={`${chosen.length} de ${essays.length}`}>Redações</Label>
            {essays.length === 0 ? (
              <p className="text-sm text-ink-3">Cadastre redações na aba Dataset.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {essays.map((e) => {
                  const on = chosen.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setSelected(on ? chosen.filter((x) => x !== e.id) : [...chosen, e.id])}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-xs font-semibold transition",
                        on ? "border-brand/50 bg-brand/10 text-brand-2" : "border-line text-ink-3",
                      )}
                    >
                      {e.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Configurações</Label>
              {(["baseline", "rag"] as const).map((m) => (
                <label key={m} className="flex items-center gap-2 py-1 text-sm text-ink-2">
                  <input type="checkbox" checked={modes[m]} onChange={(e) => setModes({ ...modes, [m]: e.target.checked })} />
                  {m === "rag" ? "IA com RAG" : "IA sem RAG"}
                </label>
              ))}
            </div>
            <div>
              <Label>Repetições</Label>
              <Input type="number" min={1} max={10} value={reps} onChange={(e) => setReps(Math.max(1, Math.min(10, Number(e.target.value))))} />
              <p className="mt-1 text-[11px] text-ink-3">&gt;1 mede a variabilidade do modelo</p>
            </div>
          </div>
          <div className="rounded-xl border border-line bg-surface-2/50 p-3 text-xs text-ink-3">
            ≈ {calls} chamadas ao Gemini. A execução continua em segundo plano; mantenha o servidor ligado.
          </div>
          <Button type="submit" variant="primary" disabled={!chosen.length || !modeList.length} loading={start.isPending}>
            <Play className="size-4" /> Iniciar experimento
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader title="Execuções" subtitle="Resultados ficam salvos em data/experiments/runs" />
        <div className="space-y-3 p-5">
          {!runs.data?.length && <Empty title="Nenhuma execução ainda" />}
          {runs.data?.map((r) => {
            const pct = r.progress.total ? (r.progress.done / r.progress.total) * 100 : 0;
            return (
              <div key={r.id} className="rounded-xl border border-line bg-surface-2/50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.name}</span>
                  <RunStatusBadge status={r.status} />
                  {r.errors > 0 && <Badge tone="bad">{r.errors} falha(s)</Badge>}
                  <span className="ml-auto text-xs text-ink-3">{new Date(r.createdAt).toLocaleString("pt-BR")}</span>
                </div>
                <div className="mt-1 text-xs text-ink-3">
                  {r.config.essayIds.length} redações · {r.config.modes.map((m) => (m === "rag" ? "com RAG" : "sem RAG")).join(" + ")} ·{" "}
                  {r.config.repetitions}× · {r.config.model}
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-ink-3">
                  <span>
                    {r.progress.current ?? `${r.progress.done}/${r.progress.total} correções`}
                    {r.status === "running" && <WaitCountdown until={r.progress.waitingUntil} />}
                  </span>
                  <span>{Math.round(pct)}%</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => onOpen(r.id)} disabled={r.progress.done === 0}>
                    <BarChart3 className="size-3.5" /> Resultados
                  </Button>
                  {r.status !== "running" && r.pending > 0 && (
                    <Button size="sm" variant="primary" onClick={() => resume.mutate({ id: r.id })} loading={resume.isPending && resume.variables?.id === r.id}>
                      <RotateCcw className="size-3.5" /> Retomar ({r.pending})
                    </Button>
                  )}
                  {r.status === "running" ? (
                    <Button size="sm" variant="danger" onClick={() => cancel.mutate({ id: r.id })}>
                      <Square className="size-3.5" /> Parar
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => confirm("Excluir esta execução?") && remove.mutate({ id: r.id })}>
                      <Trash2 className="size-3.5" /> Excluir
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
