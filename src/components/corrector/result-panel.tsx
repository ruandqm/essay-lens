"use client";

import { BookOpen, ChevronDown, Clock, Cpu, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { COMPETENCIES } from "@/domain/competencies";
import type { CompetencyResult, GradingResult, RetrievedChunkRef } from "@/domain/grading";
import { Badge, Button, Card, CardHeader, Segmented, cn, levelColor } from "../ui";
import { AnnotatedEssay } from "./annotated-essay";

export function ScoreRing({ score, max = 1000, size = 128 }: { score: number; max?: number; size?: number }) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, score / max));
  const color = levelColor(Math.round(pct * 5));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={9} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
      <text x="50%" y="48%" textAnchor="middle" fill="var(--color-ink)" fontSize={size * 0.22} fontWeight={700} fontFamily="var(--font-display)">
        {score}
      </text>
      <text x="50%" y="64%" textAnchor="middle" fill="var(--color-ink-3)" fontSize={size * 0.09}>
        /{max}
      </text>
    </svg>
  );
}

function CompetencyCard({ c, open, onToggle }: { c: CompetencyResult; open: boolean; onToggle: () => void }) {
  const info = COMPETENCIES[c.competency];
  const color = levelColor(c.level);
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-2/60">
      <button type="button" onClick={onToggle} className="w-full p-4 text-left">
        <div className="flex items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand/10 text-xs font-bold text-brand-2">
            C{c.competency}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">
              Competência {info.roman} · <span className="font-normal text-ink-2">{info.short}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(c.score / 200) * 100}%`, background: color }} />
            </div>
          </div>
          <span className="rounded-full px-3 py-1 font-display text-sm font-bold" style={{ background: `${color}22`, color }}>
            {c.score}
          </span>
          <ChevronDown className={cn("size-4 text-ink-3 transition", open && "rotate-180")} />
        </div>
      </button>
      {open && (
        <div className="space-y-3 border-t border-line px-4 pt-3 pb-4">
          {c.axes.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-line">
              {c.axes.map((a) => (
                <div key={a.key} className="flex items-start justify-between gap-3 border-b border-line px-3 py-2 text-xs last:border-0">
                  <span className="text-ink-2">{a.label}</span>
                  <span className="text-right">
                    <span className="font-semibold text-ink">{a.value}</span>{" "}
                    <span className={cn(a.maxLevel < c.level + 1 && a.maxLevel < 5 ? "text-warn" : "text-ink-3")}>({a.category})</span>
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="text-sm font-medium text-ink">{c.summary}</p>
          <p className="text-sm leading-relaxed text-ink-2">{c.feedback}</p>
          {c.retrieved.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-rag uppercase">
                <BookOpen className="size-3.5" /> Manuais do INEP aplicados (RAG)
              </div>
              {c.applications?.length ? (
                <div className="space-y-1.5">
                  {[...c.applications]
                    .sort((a, b) => Number(b.seAplica) - Number(a.seAplica))
                    .map((a) => {
                      const ref = c.retrieved.find((r) => r.id === a.id);
                      return (
                        <div
                          key={a.id}
                          className={cn(
                            "rounded-lg border p-2.5 text-xs",
                            a.seAplica ? "border-rag/40 bg-rag/5" : "border-line bg-surface/40 text-ink-3",
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            {a.seAplica ? <Badge tone="rag">✓ aplicado</Badge> : <Badge>não se aplica</Badge>}
                            <span className={cn("font-medium", a.seAplica ? "text-ink" : "text-ink-3")} title={a.id}>
                              {ref?.type === "caso-limite" ? "◆ " : ""}
                              {ref?.title ?? a.id}
                            </span>
                          </div>
                          {a.seAplica && a.trechoRedacao && <p className="mt-1.5 text-ink-2 italic">“{a.trechoRedacao}”</p>}
                          {a.seAplica && <p className="mt-1 text-ink-2">→ {a.decisao}</p>}
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {c.retrieved.map((r) => (
                    <Badge key={r.id} tone="rag" title={r.id}>
                      {r.type === "caso-limite" ? "◆ " : ""}
                      {r.title}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ResultPanel({ result, onEdit }: { result: GradingResult; onEdit: () => void }) {
  const [open, setOpen] = useState<number | null>(1);
  const [filter, setFilter] = useState<string>("all");
  const chunks = useMemo(() => {
    const m = new Map<string, RetrievedChunkRef>();
    for (const c of result.competencies) for (const r of c.retrieved) m.set(r.id, r);
    return m;
  }, [result]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr] [&>*]:min-w-0">
      <Card className="order-2 lg:order-1">
        <CardHeader
          title="Redação corrigida"
          subtitle="Toque nas marcações coloridas para ver o feedback"
          actions={
            <Button size="sm" onClick={onEdit}>
              <Pencil className="size-3.5" /> Editar
            </Button>
          }
        />
        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="bad">Erro</Badge>
            <Badge tone="warn">Alerta</Badge>
            <Badge tone="ok">Destaque</Badge>
            {result.mode === "rag" && <Badge tone="rag">Anel = RAG</Badge>}
            <div className="ml-auto">
              <Segmented
                value={filter}
                onChange={setFilter}
                options={[{ value: "all", label: "Todas" }, ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `C${n}` }))]}
              />
            </div>
          </div>
          <AnnotatedEssay
            text={result.texto}
            annotations={result.annotations}
            chunks={chunks}
            filter={filter === "all" ? null : Number(filter)}
          />
        </div>
      </Card>

      <div className="order-1 space-y-6 lg:order-2">
        <Card className="p-5">
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <ScoreRing score={result.total} />
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="text-[11px] font-semibold tracking-[0.16em] text-ink-3 uppercase">Nota total</div>
              <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Badge tone="info">{result.model}</Badge>
                {result.mode === "rag" ? <Badge tone="ok">✓ Com RAG</Badge> : <Badge>Sem RAG</Badge>}
                {result.annulled && <Badge tone="bad">Anulada</Badge>}
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-3 sm:justify-start">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" /> {(result.stats.latencyMs / 1000).toFixed(1)} s
                </span>
                <span className="inline-flex items-center gap-1">
                  <Cpu className="size-3.5" /> {result.stats.llmCalls} chamadas ·{" "}
                  {(result.stats.inputTokens + result.stats.outputTokens).toLocaleString("pt-BR")} tokens
                </span>
                <span>
                  {result.stats.wordCount} palavras · ~{result.stats.estimatedLines} linhas
                </span>
              </div>
            </div>
          </div>
          {result.annulled && (
            <div className="mt-4 rounded-xl border border-bad/30 bg-bad/10 p-3 text-sm text-bad">
              Situação de nota zero: {result.annulled.labels.join("; ")}.
            </div>
          )}
          <div className="mt-5 rounded-xl border border-line bg-surface-2/60 p-4">
            <div className="text-[11px] font-semibold tracking-[0.16em] text-ink-3 uppercase">Parecer geral</div>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{result.parecerGeral}</p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Competências ENEM" subtitle="Notas calculadas pelas regras da Grade Específica" />
          <div className="space-y-2.5 p-5">
            {result.competencies.map((c) => (
              <CompetencyCard
                key={c.competency}
                c={c}
                open={open === c.competency}
                onToggle={() => setOpen(open === c.competency ? null : c.competency)}
              />
            ))}
          </div>
        </Card>

        {result.situations.length > 0 && (
          <Card>
            <CardHeader title="Situações detectadas" subtitle="Padrões da redação usados no roteamento da recuperação" />
            <div className="flex flex-wrap gap-1.5 p-5">
              {result.situations.map((s) => (
                <Badge key={s.id} tone="neutral">
                  C{s.competency} · {s.label}
                </Badge>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
