"use client";

import { useEffect, useMemo, useState } from "react";
import { finalizeInspeccion, listInspeccionItems } from "./api";
import type { InspeccionDiaria, InspeccionItem, UpsertInspeccionDiariaPayload } from "./types";
import { ApiError } from "../../lib/request";
import { Toast, type ToastVariant } from "../../components/design-system/Toast";
import { useAutoClearState } from "../../lib/useAutoClearState";
import { getMyDriver, listDrivers } from "../drivers/api";
import type { DriverResponse } from "../drivers/types";
import { useAppSelector } from "../../store/hooks";

type Props = {
  initial?: InspeccionDiaria;
  canEditFinalized?: boolean;
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

export function InspeccionWizard({ initial, canEditFinalized = false, onSave }: Props) {
  const authUser = useAppSelector((state) => state.auth.user);
  const [items, setItems] = useState<InspeccionItem[]>([]);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<InspeccionDiaria | null>(initial ?? null);
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null);
  const [driverContext, setDriverContext] = useState<DriverResponse | null>(null);
  const [driverOptions, setDriverOptions] = useState<DriverResponse[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [driversError, setDriversError] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState("");
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

  const isFinalized = current?.estado === "FINALIZED";
  const editingBlocked = isFinalized && !canEditFinalized;
  const canChooseDriver =
    !initial?.id &&
    (authUser?.role === "ADMIN" || authUser?.role === "SUPER_ADMIN");

  useAutoClearState(toast, setToast, 4000);

  useEffect(() => {
    if (initial?.id) return;
    if (canChooseDriver) return;
    let active = true;
    void getMyDriver()
      .then((driver) => {
        if (!active) return;
        setDriverContext(driver);
        setForm((prev) => ({
          ...prev,
          placa: prev.placa.trim() ? prev.placa : driver.vehiculoPlaca ?? "",
          conductor: prev.conductor.trim() ? prev.conductor : getDriverFullName(driver),
          cedula: prev.cedula?.trim() ? prev.cedula : driver.persona.documentoNumero ?? "",
        }));
      })
      .catch(() => {
        // La precarga es opcional; si no existe perfil de conductor se mantiene el flujo manual.
        if (!active) return;
        setDriverContext(null);
      });
    return () => {
      active = false;
    };
  }, [canChooseDriver, initial?.id]);

  useEffect(() => {
    if (!canChooseDriver) return;
    let active = true;
    setDriversLoading(true);
    setDriversError(null);
    void listDrivers()
      .then((drivers) => {
        if (!active) return;
        setDriverOptions(drivers);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError) {
          setDriversError(`${err.message} (${err.status})`);
        } else {
          setDriversError("No fue posible cargar los conductores.");
        }
      })
      .finally(() => {
        if (!active) return;
        setDriversLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canChooseDriver]);

  useEffect(() => {
    if (!canChooseDriver || !selectedDriverId) return;
    const selected = driverOptions.find((driver) => driver.id === selectedDriverId);
    if (!selected) return;
    setDriverContext(selected);
    setForm((prev) => ({
      ...prev,
      placa: selected.vehiculoPlaca ?? "",
      conductor: getDriverFullName(selected),
      cedula: selected.persona.documentoNumero ?? "",
    }));
  }, [canChooseDriver, driverOptions, selectedDriverId]);

  useEffect(() => {
    let active = true;
    setItemsError(null);
    void listInspeccionItems()
      .then((data) => {
        if (!active) return;
        setItems(data);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError) {
          setItemsError(`${err.message} (${err.status})`);
          return;
        }
        setItemsError("No fue posible cargar los items de inspeccion.");
      });
    return () => {
      active = false;
    };
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

  const sortedDriverOptions = useMemo(
    () =>
      [...driverOptions].sort((a, b) =>
        getDriverFullName(a).localeCompare(getDriverFullName(b), "es", { sensitivity: "base" })
      ),
    [driverOptions]
  );

  useEffect(() => {
    if (!current?.id || current.estado !== "DRAFT") return;
    const id = setTimeout(() => {
      void onSave(form)
        .then((saved) => {
          setCurrent(saved);
          setToast({ message: "Cambios guardados automaticamente.", variant: "success" });
        })
        .catch(() => {
          setToast({ message: "No fue posible guardar cambios automaticamente.", variant: "error" });
        });
    }, 800);
    return () => clearTimeout(id);
  }, [current?.estado, current?.id, form, onSave]);

  const section = sections[step];

  const setAnswer = (itemId: string, respuesta: "SI" | "NO" | "NA") => {
    if (editingBlocked) return;
    setForm((prev) => ({
      ...prev,
      respuestas: prev.respuestas.map((r) => (r.itemId === itemId ? { ...r, respuesta } : r)),
    }));
  };

  const setObs = (itemId: string, observacion: string) => {
    if (editingBlocked) return;
    setForm((prev) => ({
      ...prev,
      respuestas: prev.respuestas.map((r) => (r.itemId === itemId ? { ...r, observacion } : r)),
    }));
  };

  const handleSave = async () => {
    if (editingBlocked) {
      setToast({ message: "La inspeccion esta finalizada. Solo puedes descargar el PDF.", variant: "warning" });
      return;
    }
    setActionError(null);
    setSaving(true);
    try {
      const saved = await onSave(form);
      setCurrent(saved);
      setToast({ message: "Inspeccion guardada correctamente.", variant: "success" });
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(`${err.message} (${err.status})`);
      } else {
        setActionError("No fue posible guardar la inspeccion.");
      }
      setToast({ message: "No fue posible guardar la inspeccion.", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (isFinalized) {
      setToast({ message: "La inspeccion ya esta finalizada. Solo puedes descargar el PDF.", variant: "warning" });
      return;
    }
    if (!current?.id) return;
    setActionError(null);
    setSaving(true);
    try {
      const finalized = await finalizeInspeccion(current.id);
      setCurrent(finalized);
      setToast({ message: "Inspeccion finalizada correctamente.", variant: "success" });
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(`${err.message} (${err.status})`);
      } else {
        setActionError("No fue posible finalizar la inspeccion.");
      }
      setToast({ message: "No fue posible finalizar la inspeccion.", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {toast ? <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} /> : null}

      <div className="flex flex-wrap gap-2 text-xs">
        {sections.map((name, index) => (
          <button key={name} type="button" onClick={() => setStep(index)} className={`rounded-full px-3 py-1 ${index === step ? "bg-slate-900 text-white" : "bg-slate-100"}`}>
            {name}
          </button>
        ))}
      </div>

      {section === "Encabezado" && (
        <div className="space-y-4">
          {canChooseDriver ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="inspeccion-driver-select">
                Conductor
              </label>
              <select
                id="inspeccion-driver-select"
                className="w-full rounded-lg border p-2 disabled:cursor-not-allowed disabled:bg-slate-100"
                value={selectedDriverId}
                disabled={editingBlocked || driversLoading}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedDriverId(value);
                  if (!value) {
                    setDriverContext(null);
                  }
                }}
              >
                <option value="">Seleccionar conductor...</option>
                {sortedDriverOptions.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {getDriverFullName(driver) || driver.userEmail}{" "}
                    {driver.vehiculoPlaca ? `- ${driver.vehiculoPlaca}` : ""}
                  </option>
                ))}
              </select>
              {driversLoading ? <p className="text-xs text-slate-500">Cargando conductores...</p> : null}
              {driversError ? <p className="text-xs text-red-600">{driversError}</p> : null}
            </div>
          ) : null}

          {driverContext ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Datos precargados del conductor</p>
              <div className="mt-2 grid gap-2 text-sm text-emerald-900 md:grid-cols-2">
                <p><span className="font-medium">Conductor:</span> {getDriverFullName(driverContext) || "Sin nombre"}</p>
                <p><span className="font-medium">Documento:</span> {driverContext.persona.documentoNumero ?? "Sin documento"}</p>
                <p><span className="font-medium">Placa:</span> {driverContext.vehiculoPlaca ?? "Sin placa"}</p>
                <p><span className="font-medium">Vehiculo:</span> {[driverContext.vehiculoTipo, driverContext.vehiculoMarca, driverContext.vehiculoModelo].filter(Boolean).join(" / ") || "Sin datos"}</p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <input className="rounded-lg border p-2 disabled:cursor-not-allowed disabled:bg-slate-100" placeholder="Placa" value={form.placa} disabled={editingBlocked} onChange={(e) => setForm({ ...form, placa: e.target.value })} />
            <input className="rounded-lg border p-2 disabled:cursor-not-allowed disabled:bg-slate-100" placeholder="Conductor" value={form.conductor} disabled={editingBlocked} onChange={(e) => setForm({ ...form, conductor: e.target.value })} />
            <input className="rounded-lg border p-2 disabled:cursor-not-allowed disabled:bg-slate-100" placeholder="Cédula" value={form.cedula} disabled={editingBlocked} onChange={(e) => setForm({ ...form, cedula: e.target.value })} />
            <input className="rounded-lg border p-2 disabled:cursor-not-allowed disabled:bg-slate-100" type="date" value={form.fecha} disabled={editingBlocked} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            <input className="rounded-lg border p-2 disabled:cursor-not-allowed disabled:bg-slate-100" placeholder="Núm. manifiesto" value={form.numeroManifiesto} disabled={editingBlocked} onChange={(e) => setForm({ ...form, numeroManifiesto: e.target.value })} />
            <input className="rounded-lg border p-2 disabled:cursor-not-allowed disabled:bg-slate-100" placeholder="Destino" value={form.destino} disabled={editingBlocked} onChange={(e) => setForm({ ...form, destino: e.target.value })} />
          </div>
        </div>
      )}

      {grouped[section]?.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {grouped[section].map((item) => {
            const answer = form.respuestas.find((r) => r.itemId === item.id);
            return (
              <div key={item.id} className="rounded-xl border p-3">
                <p className="text-sm font-medium">{item.descripcion}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  {(["SI", "NO", "NA"] as const).map((opt) => {
                    const checked = answer?.respuesta === opt;
                    return (
                      <label
                        key={opt}
                        className={`flex items-center justify-center rounded-lg border px-2 py-2 text-center ${
                          checked ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
                        } ${editingBlocked ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          checked={checked}
                          disabled={editingBlocked}
                          onChange={() => setAnswer(item.id, opt)}
                        />
                        {opt}
                      </label>
                    );
                  })}
                </div>
                {answer?.respuesta === "NO" && (
                  <textarea
                    className="mt-2 w-full rounded-lg border p-2 disabled:cursor-not-allowed disabled:bg-slate-100"
                    placeholder="Observación obligatoria"
                    value={answer.observacion ?? ""}
                    disabled={editingBlocked}
                    onChange={(e) => setObs(item.id, e.target.value)}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : null}
      {section === "Hallazgos" && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.puntoCritico} disabled={editingBlocked} onChange={(e) => setForm({ ...form, puntoCritico: e.target.checked })} /> Punto crítico</label>
          <textarea className="w-full rounded-lg border p-2 disabled:cursor-not-allowed disabled:bg-slate-100" placeholder="Hallazgos" value={form.hallazgos} disabled={editingBlocked} onChange={(e) => setForm({ ...form, hallazgos: e.target.value })} />
          <textarea className="w-full rounded-lg border p-2 disabled:cursor-not-allowed disabled:bg-slate-100" placeholder="Acciones correctivas" value={form.accionesCorrectivas} disabled={editingBlocked} onChange={(e) => setForm({ ...form, accionesCorrectivas: e.target.value })} />
        </div>
      )}

      {section === "Confirmación" && <p className="text-sm text-slate-500">Estado actual: {current?.estado ?? "DRAFT"}.</p>}

      {itemsError ? <p className="text-sm text-red-600">{itemsError}</p> : null}
      {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
      <div className="flex gap-2">
        {!isFinalized || canEditFinalized ? (
          <>
            <button type="button" disabled={saving} onClick={() => void handleSave()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">Guardar borrador</button>
            <button type="button" disabled={saving || current?.estado !== "DRAFT" || !current?.id} onClick={() => void handleFinalize()} className="rounded-lg border px-4 py-2 text-sm">Finalizar inspección</button>
          </>
        ) : null}
        {current?.id && isFinalized && (
          <a className="rounded-lg border px-4 py-2 text-sm" href={`${process.env.NEXT_PUBLIC_API_URL}/inspecciones/diarias/${current.id}/pdf`} target="_blank">Descargar PDF</a>
        )}
      </div>
    </div>
  );
}

const getDriverFullName = (driver: DriverResponse) =>
  `${driver.persona.nombres ?? ""} ${driver.persona.apellidos ?? ""}`.trim();
