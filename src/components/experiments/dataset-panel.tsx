"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown, FileUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DatasetEssaySchema, type DatasetEssay } from "@/application/experiments/types";
import { COMPETENCY_IDS } from "@/domain/competencies";
import { useTRPC } from "@/lib/trpc";
import { Button, Card, CardHeader, Empty, Input, Label, Textarea } from "../ui";

const blank = (n: number): DatasetEssay => ({
  id: crypto.randomUUID().slice(0, 8),
  label: `R${String(n).padStart(2, "0")}`,
  tema: "",
  texto: "",
  textosMotivadores: "",
  human: { 1: 120, 2: 120, 3: 120, 4: 120, 5: 120 },
  notes: "",
});

const TEMPLATE = [
  {
    id: "r01",
    label: "R01",
    tema: "Tema da proposta",
    texto: "Texto completo da redação, com parágrafos separados por quebra de linha.",
    textosMotivadores: "",
    human: { 1: 120, 2: 120, 3: 120, 4: 120, 5: 120 },
    notes: "Fonte da nota humana (ex.: espelho oficial do INEP)",
  },
];

export function DatasetPanel() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const list = useQuery(trpc.dataset.list.queryOptions());
  const [editing, setEditing] = useState<DatasetEssay | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: trpc.dataset.list.queryKey() });

  const upsert = useMutation(
    trpc.dataset.upsert.mutationOptions({
      onSuccess: () => (invalidate(), setEditing(null), toast.success("Redação salva")),
      onError: (e) => toast.error(e.message),
    }),
  );
  const remove = useMutation(trpc.dataset.remove.mutationOptions({ onSuccess: invalidate }));
  const importer = useMutation(
    trpc.dataset.import.mutationOptions({
      onSuccess: (r) => (invalidate(), toast.success(`${r.count} redação(ões) importada(s)`)),
      onError: (e) => toast.error(e.message),
    }),
  );

  const items = list.data ?? [];

  const onFile = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());
      const parsed = z.array(DatasetEssaySchema).parse(Array.isArray(raw) ? raw : [raw]);
      importer.mutate({ items: parsed, replace: false });
    } catch (e) {
      toast.error(`Arquivo inválido: ${e instanceof Error ? e.message.slice(0, 200) : e}`);
    }
  };

  const downloadJson = (data: unknown, name: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = name;
    a.click();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Redações de referência"
          subtitle="Redações reais com as notas atribuídas por avaliadores humanos (usadas como gabarito no cálculo do MAE)"
          actions={
            <>
              <Button size="sm" variant="primary" onClick={() => setEditing(blank(items.length + 1))}>
                <Plus className="size-3.5" /> Adicionar
              </Button>
              <Button size="sm" onClick={() => fileRef.current?.click()} loading={importer.isPending}>
                <FileUp className="size-3.5" /> Importar JSON
              </Button>
              <Button size="sm" variant="ghost" onClick={() => downloadJson(items.length ? items : TEMPLATE, items.length ? "dataset.json" : "modelo-dataset.json")}>
                <FileDown className="size-3.5" /> {items.length ? "Exportar" : "Baixar modelo"}
              </Button>
              <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </>
          }
        />
        <div className="p-5">
          {items.length === 0 ? (
            <Empty title="Nenhuma redação cadastrada">
              Adicione redações com as notas humanas por competência, ou importe um JSON no formato do modelo.
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-[11px] tracking-[0.12em] text-ink-3 uppercase">
                  <tr>
                    <th className="pb-2">Redação</th>
                    <th className="pb-2">Tema</th>
                    {COMPETENCY_IDS.map((c) => (
                      <th key={c} className="pb-2 text-right">
                        C{c}
                      </th>
                    ))}
                    <th className="pb-2 text-right">Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((e) => (
                    <tr key={e.id} className="border-t border-line">
                      <td className="py-2.5 font-semibold">{e.label}</td>
                      <td className="max-w-[260px] truncate pr-3 text-ink-2">{e.tema}</td>
                      {COMPETENCY_IDS.map((c) => (
                        <td key={c} className="text-right tabular-nums">
                          {e.human[c]}
                        </td>
                      ))}
                      <td className="text-right font-semibold tabular-nums">{COMPETENCY_IDS.reduce((a, c) => a + e.human[c], 0)}</td>
                      <td className="pl-3 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(e)} aria-label="Editar">
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Excluir"
                          onClick={() => confirm(`Excluir ${e.label}?`) && remove.mutate({ id: e.id })}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {editing && <EssayForm value={editing} onCancel={() => setEditing(null)} onSave={(v) => upsert.mutate(v)} saving={upsert.isPending} />}
    </div>
  );
}

function EssayForm({
  value,
  onSave,
  onCancel,
  saving,
}: {
  value: DatasetEssay;
  onSave: (v: DatasetEssay) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [v, setV] = useState(value);
  return (
    <Card>
      <CardHeader
        title={`${value.texto ? "Editar" : "Nova"} redação · ${v.label}`}
        actions={
          <Button size="sm" variant="ghost" onClick={onCancel}>
            <X className="size-4" />
          </Button>
        }
      />
      <form
        className="grid gap-4 p-5 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = DatasetEssaySchema.safeParse(v);
          if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
          onSave(parsed.data);
        }}
      >
        <div className="grid grid-cols-[110px_1fr] gap-3 md:col-span-2">
          <div>
            <Label>Rótulo</Label>
            <Input value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} />
          </div>
          <div>
            <Label>Tema</Label>
            <Input value={v.tema} onChange={(e) => setV({ ...v, tema: e.target.value })} />
          </div>
        </div>
        <div className="md:col-span-2">
          <Label>Redação</Label>
          <Textarea rows={12} value={v.texto} onChange={(e) => setV({ ...v, texto: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <Label>Notas humanas por competência</Label>
          <div className="grid grid-cols-5 gap-2">
            {COMPETENCY_IDS.map((c) => (
              <label key={c} className="text-xs text-ink-3">
                C{c}
                <Input
                  type="number"
                  min={0}
                  max={200}
                  step={20}
                  value={v.human[c]}
                  onChange={(e) => setV({ ...v, human: { ...v.human, [c]: Number(e.target.value) } })}
                />
              </label>
            ))}
          </div>
        </div>
        <div>
          <Label>Textos motivadores (opcional)</Label>
          <Textarea rows={3} value={v.textosMotivadores} onChange={(e) => setV({ ...v, textosMotivadores: e.target.value })} />
        </div>
        <div>
          <Label>Observações (opcional)</Label>
          <Textarea rows={3} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 md:col-span-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Salvar
          </Button>
        </div>
      </form>
    </Card>
  );
}
