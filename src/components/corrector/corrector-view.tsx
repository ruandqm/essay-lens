"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, ChevronRight, FileText, Paperclip, Target, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { GradingResult } from "@/domain/grading";
import { analyzeText } from "@/domain/text-analysis";
import { useTRPC } from "@/lib/trpc";
import { StatusBanner } from "../status-banner";
import { Button, Card, CardHeader, Empty, Input, Label, Textarea, Toggle, cn } from "../ui";
import { ResultPanel } from "./result-panel";
import { SAMPLE } from "./sample";

const DRAFT_KEY = "redaia:draft";
const RESULT_KEY = "redaia:last-result";

function load<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* armazenamento indisponível */
  }
}

const STAGES = ["Recuperando trechos dos manuais", "Analisando competências I, II e IV", "Analisando competências III e V", "Calculando notas pela grade"];

export function CorrectorView() {
  const trpc = useTRPC();
  const [tema, setTema] = useState("");
  const [texto, setTexto] = useState("");
  const [motivadores, setMotivadores] = useState("");
  const [showMotivadores, setShowMotivadores] = useState(false);
  const [useRag, setUseRag] = useState(true);
  const [result, setResult] = useState<GradingResult | null>(null);
  const [editing, setEditing] = useState(true);
  const [stage, setStage] = useState(0);
  const hydrated = useRef(false);

  useEffect(() => {
    const d = load<{ tema: string; texto: string; motivadores: string; useRag: boolean }>(DRAFT_KEY);
    if (d) {
      setTema(d.tema);
      setTexto(d.texto);
      setMotivadores(d.motivadores);
      setUseRag(d.useRag);
    }
    const r = load<GradingResult>(RESULT_KEY);
    if (r) {
      setResult(r);
      setEditing(false);
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (hydrated.current) save(DRAFT_KEY, { tema, texto, motivadores, useRag });
  }, [tema, texto, motivadores, useRag]);

  const grade = useMutation(
    trpc.essay.grade.mutationOptions({
      onSuccess: (r) => {
        setResult(r);
        setEditing(false);
        save(RESULT_KEY, r);
        toast.success(`Redação corrigida: ${r.total} pontos`);
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
      onError: (e) => toast.error(e.message, { duration: 10000 }),
    }),
  );

  useEffect(() => {
    if (!grade.isPending) return setStage(0);
    const id = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 3500);
    return () => clearInterval(id);
  }, [grade.isPending]);

  const stats = analyzeText(texto);
  const step = !tema.trim() ? 1 : !texto.trim() || editing ? 2 : 3;
  const canSubmit = tema.trim().length >= 5 && stats.wordCount >= 20 && !grade.isPending;

  return (
    <div>
      <section className="grid gap-6 pt-10 pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <span className="text-[11px] font-semibold tracking-[0.14em] text-ink-3 uppercase">Redação · ENEM</span>
          <h1 className="mt-3 font-display text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            Correção pelos <br className="hidden sm:block" />
            <span className="text-brand">critérios oficiais</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-ink-2">
            Informe o tema, cole a redação e receba a nota por competência, os comentários no próprio texto e as
            explicações com base nos manuais do INEP.
          </p>
        </div>
        <Card className="hidden p-4 lg:block">
          <div className="text-[11px] font-semibold tracking-[0.14em] text-ink-3 uppercase">Como funciona</div>
          {["Informe o tema e escreva a redação", "O texto é analisado com base nos manuais do INEP", "A nota é calculada pela Grade Específica"].map((t, i) => (
            <div key={t} className="mt-2.5 flex items-center gap-2.5 text-sm text-ink-2">
              <span className="grid size-5 place-items-center rounded-full border border-line-strong text-[10px] font-bold text-ink-2">{i + 1}</span>
              {t}
            </div>
          ))}
        </Card>
      </section>

      <Steps step={step} />
      <StatusBanner needIndex={useRag} />

      {!editing && result ? (
        <div className="mt-6">
          <ResultPanel result={result} onEdit={() => setEditing(true)} />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_1fr] [&>*]:min-w-0">
          <Card>
            <CardHeader
              title="Escreva sua redação"
              subtitle="Mínimo de 8 linhas · máximo de 30 linhas na folha oficial"
              actions={
                <>
                  <Button size="sm" onClick={() => (setTema(SAMPLE.tema), setTexto(SAMPLE.texto))}>
                    <FileText className="size-3.5" /> Exemplo
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => (setTema(""), setTexto(""), setMotivadores(""))}>
                    <Trash2 className="size-3.5" /> Limpar
                  </Button>
                </>
              }
            />
            <form
              className="space-y-4 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (canSubmit) grade.mutate({ tema, texto, textosMotivadores: motivadores, mode: useRag ? "rag" : "baseline" });
              }}
            >
              <div>
                <Label>Tema da proposta</Label>
                <Input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ex.: Desafios para a valorização da herança africana no Brasil" />
              </div>
              <div>
                <Label hint={`${stats.wordCount} palavras · ${stats.paragraphCount} parágrafos · ~${stats.estimatedLines} linhas`}>Redação</Label>
                <Textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={16}
                  placeholder="Cole ou digite aqui sua redação dissertativo-argumentativa. Separe os parágrafos com uma quebra de linha."
                />
              </div>
              <div className="rounded-xl border border-line bg-surface-2/50">
                <button
                  type="button"
                  onClick={() => setShowMotivadores(!showMotivadores)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-sm text-ink-2"
                >
                  <ChevronRight className={cn("size-4 transition", showMotivadores && "rotate-90")} />
                  <Paperclip className="size-3.5" /> Textos motivadores (opcional)
                </button>
                {showMotivadores && (
                  <div className="px-4 pb-4">
                    <Textarea
                      value={motivadores}
                      onChange={(e) => setMotivadores(e.target.value)}
                      rows={6}
                      placeholder="Cole os textos motivadores para detectar cópia e repertório baseado na prova."
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-2/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Toggle checked={useRag} onChange={setUseRag} label="Modo RAG" />
                  <div>
                    <div className="text-sm font-semibold">Modo RAG</div>
                    <div className="text-xs text-ink-3">Recupera trechos dos manuais do INEP antes da correção</div>
                  </div>
                </div>
                <Button type="submit" variant="primary" disabled={!canSubmit} loading={grade.isPending}>
                  {!grade.isPending && <Check className="size-4" />}
                  Corrigir redação
                </Button>
              </div>
            </form>
          </Card>

          <Card className="lg:sticky lg:top-24 lg:self-start">
            {grade.isPending ? (
              <div className="p-6">
                <div className="mb-5 font-display text-base font-semibold">Corrigindo…</div>
                <div className="space-y-3">
                  {STAGES.map((s, i) => {
                    if (i === 0 && !useRag) return null;
                    const done = i < stage;
                    const current = i === stage;
                    return (
                      <div key={s} className={cn("flex items-center gap-3 text-sm", done ? "text-ok" : current ? "text-ink" : "text-ink-3")}>
                        <span className={cn("grid size-6 place-items-center rounded-full border", done ? "border-ok bg-ok/15" : current ? "border-brand" : "border-line")}>
                          {done ? <Check className="size-3.5" /> : current ? <span className="size-2 animate-pulse rounded-full bg-brand" /> : null}
                        </span>
                        {s}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 space-y-2">
                  {[80, 60, 70].map((w) => (
                    <div key={w} className="skeleton h-3 rounded" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </div>
            ) : result ? (
              <div className="p-6">
                <div className="text-sm text-ink-2">Última correção</div>
                <div className="mt-1 font-display text-3xl font-semibold">{result.total} pontos</div>
                <p className="mt-1 truncate text-xs text-ink-3">{result.tema}</p>
                <Button className="mt-4" size="sm" onClick={() => setEditing(false)}>
                  Ver resultado
                </Button>
              </div>
            ) : (
              <Empty icon={<Target className="size-9" />} title="Seu resultado aparece aqui">
                Depois de corrigir, você verá a nota total, o parecer geral e o detalhamento por competência.
              </Empty>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function Steps({ step }: { step: number }) {
  const items = ["Tema", "Redação", "Resultado"];
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {items.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <div key={label} className={cn("flex items-center gap-2 sm:gap-3", i < items.length - 1 && "flex-1")}>
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full border text-xs font-bold",
                done && "border-ok/50 bg-ok/10 text-ok",
                current && "border-brand bg-brand text-white",
                !done && !current && "border-line-strong text-ink-3",
              )}
            >
              {done ? <Check className="size-4" /> : n}
            </span>
            <span className={cn("text-sm", current ? "text-ink" : "text-ink-3")}>{label}</span>
            {i < items.length - 1 && <span className={cn("h-px flex-1", done ? "bg-ok/50" : "bg-line")} />}
          </div>
        );
      })}
    </div>
  );
}
