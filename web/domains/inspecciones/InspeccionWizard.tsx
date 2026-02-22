"use client";

import { useEffect, useMemo, useState } from "react";
import { finalizeInspeccion, listInspeccionItems } from "./api";
import type { InspeccionDiaria, InspeccionItem, UpsertInspeccionDiariaPayload } from "./types";

type Props = {
  initial?: InspeccionDiaria;
  onSave: (payload: UpsertInspeccionDiariaPayload) => Promise<InspeccionDiaria>;
};

const sections = [
  "Encabezado",
  "DOCUMENTOS",
  "LUCES",
  "CABINA",
  "LLANTAS",
  "ESTADO_MECANICO",
  "SEGURIDAD_SOCIAL",
  "Hallazgos",
  "Confirmación",
];

export function InspeccionWizard({ initial, onSave }: Props) {
  const [items, setItems] = useState<InspeccionItem[]>([]);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<InspeccionDiaria | null>(initial ?? null);
  const [form, setForm] = useState<UpsertInspeccionDiariaPayload>(() => ({
    placa: initial?.placa ?? "",
    conductor: initial?.conductor ?? "",
    cedula: initial?.cedula ?? "",
    fecha: initial?.fecha ? initial.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10),
    numeroManifiesto: initial?.numeroManifiesto ?? "",
    destino: initial?.destino ?? "",
    puntoCritico: initial?.puntoCritico ?? false,
    hallazgos: initial?.hallazgos ?? "",
    accionesCorrectivas: initial?.accionesCorrectivas ?? "",
    respuestas: initial?.respuestas?.map((r) => ({ itemId: r.itemId, respuesta: r.respuesta, observacion: r.observacion ?? "" })) ?? [],
  }));

  useEffect(() => {
    void listInspeccionItems().then(setItems);
  }, []);

  useEffect(() => {
    if (!items.length || form.respuestas.length > 0) return;
    setForm((prev) => ({
      ...prev,
      respuestas: items.map((item) => ({ itemId: item.id, respuesta: "NA", observacion: "" })),
    }));
  }, [items, form.respuestas.length]);

  const grouped = useMemo(() => {
    return items.reduce<Record<string, InspeccionItem[]>>((acc, item) => {
      acc[item.seccion] = [...(acc[item.seccion] ?? []), item];
      return acc;
    }, {});
  }, [items]);

  useEffect(() => {
    if (!initial?.id || initial.estado !== "DRAFT") return;
    const id = setTimeout(() => {
      void onSave(form).then(setCurrent).catch(() => undefined);
    }, 800);
    return () => clearTimeout(id);
  }, [form, initial?.id, initial?.estado, onSave]);

  const section = sections[step];

  const setAnswer = (itemId: string, respuesta: "SI" | "NO" | "NA") => {
    setForm((prev) => ({
      ...prev,
      respuestas: prev.respuestas.map((r) => (r.itemId === itemId ? { ...r, respuesta } : r)),
    }));
  };

  const setObs = (itemId: string, observacion: string) => {
    setForm((prev) => ({
      ...prev,
      respuestas: prev.respuestas.map((r) => (r.itemId === itemId ? { ...r, observacion } : r)),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await onSave(form);
      setCurrent(saved);
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!current?.id) return;
    setSaving(true);
    try {
      const finalized = await finalizeInspeccion(current.id);
      setCurrent(finalized);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap gap-2 text-xs">
        {sections.map((name, index) => (
          <button key={name} type="button" onClick={() => setStep(index)} className={`rounded-full px-3 py-1 ${index === step ? "bg-slate-900 text-white" : "bg-slate-100"}`}>
            {name}
          </button>
        ))}
      </div>

      {section === "Encabezado" && (
        <div className="grid gap-3 md:grid-cols-2">
          <input className="rounded-lg border p-2" placeholder="Placa" value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value })} />
          <input className="rounded-lg border p-2" placeholder="Conductor" value={form.conductor} onChange={(e) => setForm({ ...form, conductor: e.target.value })} />
          <input className="rounded-lg border p-2" placeholder="Cédula" value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} />
          <input className="rounded-lg border p-2" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          <input className="rounded-lg border p-2" placeholder="Núm. manifiesto" value={form.numeroManifiesto} onChange={(e) => setForm({ ...form, numeroManifiesto: e.target.value })} />
          <input className="rounded-lg border p-2" placeholder="Destino" value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })} />
        </div>
      )}

      {grouped[section]?.map((item) => {
        const answer = form.respuestas.find((r) => r.itemId === item.id);
        return (
          <div key={item.id} className="rounded-xl border p-3">
            <p className="text-sm font-medium">{item.descripcion}</p>
            <div className="mt-2 flex gap-3 text-sm">
              {(["SI", "NO", "NA"] as const).map((opt) => (
                <label key={opt} className="flex items-center gap-1">
                  <input type="radio" checked={answer?.respuesta === opt} onChange={() => setAnswer(item.id, opt)} /> {opt}
                </label>
              ))}
            </div>
            {answer?.respuesta === "NO" && (
              <textarea className="mt-2 w-full rounded-lg border p-2" placeholder="Observación obligatoria" value={answer.observacion ?? ""} onChange={(e) => setObs(item.id, e.target.value)} />
            )}
          </div>
        );
      })}

      {section === "Hallazgos" && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.puntoCritico} onChange={(e) => setForm({ ...form, puntoCritico: e.target.checked })} /> Punto crítico</label>
          <textarea className="w-full rounded-lg border p-2" placeholder="Hallazgos" value={form.hallazgos} onChange={(e) => setForm({ ...form, hallazgos: e.target.value })} />
          <textarea className="w-full rounded-lg border p-2" placeholder="Acciones correctivas" value={form.accionesCorrectivas} onChange={(e) => setForm({ ...form, accionesCorrectivas: e.target.value })} />
        </div>
      )}

      {section === "Confirmación" && <p className="text-sm text-slate-500">Estado actual: {current?.estado ?? "DRAFT"}.</p>}

      <div className="flex gap-2">
        <button type="button" disabled={saving} onClick={() => void handleSave()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">Guardar borrador</button>
        <button type="button" disabled={saving || current?.estado !== "DRAFT" || !current?.id} onClick={() => void handleFinalize()} className="rounded-lg border px-4 py-2 text-sm">Finalizar inspección</button>
        {current?.id && current.estado === "FINALIZED" && (
          <a className="rounded-lg border px-4 py-2 text-sm" href={`${process.env.NEXT_PUBLIC_API_URL}/inspecciones/diarias/${current.id}/pdf`} target="_blank">Descargar PDF</a>
        )}
      </div>
    </div>
  );
}
