"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, RefreshCw } from "lucide-react";
import { listInspecciones } from "../../../domains/inspecciones/api";
import { subscribeInspeccionEvents } from "../../../domains/inspecciones/events";
import type { InspeccionDiaria } from "../../../domains/inspecciones/types";
import { Button } from "../../../components/design-system/Button";
import { ApiError } from "../../../lib/request";
import { useAppSelector } from "../../../store/hooks";

const getTodayLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function InspeccionDiariaPage() {
  const PAGE_SIZE = 10;
  const params = useParams<{ tenant: string }>();
  const tenant = typeof params?.tenant === "string" ? params.tenant : "";
  const authUser = useAppSelector((state) => state.auth.user);
  const [rows, setRows] = useState<InspeccionDiaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fechaFilter, setFechaFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<"" | InspeccionDiaria["estado"]>("");
  const [conductorFilter, setConductorFilter] = useState("");
  const [placaFilter, setPlacaFilter] = useState("");
  const [page, setPage] = useState(1);

  const stats = {
    total: rows.length,
    draft: rows.filter((row) => row.estado === "DRAFT").length,
    finalized: rows.filter((row) => row.estado === "FINALIZED").length,
  };

  const normalizedConductorFilter = conductorFilter.trim().toLowerCase();
  const normalizedPlacaFilter = placaFilter.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    if (fechaFilter && row.fecha.slice(0, 10) !== fechaFilter) {
      return false;
    }
    if (estadoFilter && row.estado !== estadoFilter) {
      return false;
    }
    if (normalizedConductorFilter && !row.conductor.toLowerCase().includes(normalizedConductorFilter)) {
      return false;
    }
    if (normalizedPlacaFilter && !row.placa.toLowerCase().includes(normalizedPlacaFilter)) {
      return false;
    }
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasActiveFilters = Boolean(fechaFilter || estadoFilter || conductorFilter || placaFilter);
  const isUserRole = authUser?.role === "USER";
  const hasTodayInspection = isUserRole
    ? rows.some((row) => row.createdBy === authUser?.id && row.fecha.slice(0, 10) === getTodayLocalDate())
    : false;
  const canCreateInspeccion = isUserRole ? !loading && !hasTodayInspection : true;

  const loadInspecciones = useCallback(async () => {
    if (!tenant) {
      console.error("[inspeccion-diaria] tenant no disponible en la ruta");
      setError("No se pudo determinar el tenant actual.");
      setLoading(false);
      return;
    }

    const requestId = `list-inspecciones-${Date.now()}`;
    setLoading(true);
    setError(null);
    try {
      const data = await listInspecciones({ "x-debug-request-id": requestId });
      setRows(data);
    } catch (err) {
      console.error("[inspeccion-diaria] error al cargar inspecciones", {
        tenant,
        requestId,
        err,
      });
      if (err instanceof ApiError) {
        setError(`${err.message} (${err.status})`);
        return;
      }
      setError("No fue posible cargar inspecciones.");
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    void loadInspecciones();
  }, [loadInspecciones]);

  useEffect(() => {
    const unsubscribe = subscribeInspeccionEvents((event) => {
      if (event.inspeccion.tenantId !== tenant) {
        return;
      }
      void loadInspecciones();
    });

    return unsubscribe;
  }, [loadInspecciones, tenant]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Inspeccion diaria</h1>
            <p className="text-sm text-slate-500">Chequeo preoperacional digital.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => void loadInspecciones()} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            {canCreateInspeccion ? (
              <Link href={`/${tenant}/inspeccion-diaria/nueva`}>
                <Button variant="primary">
                  <Plus className="h-4 w-4" />
                  Nueva inspeccion
                </Button>
              </Link>
            ) : (
              <Button
                variant="primary"
                disabled
                title={loading ? "Validando inspeccion del dia..." : "Ya registraste una inspeccion hoy"}
              >
                <Plus className="h-4 w-4" />
                Nueva inspeccion
              </Button>
            )}
          </div>
        </div>
        {!canCreateInspeccion ? (
          <p className="mt-3 text-sm text-amber-700">
            Ya registraste tu inspeccion del dia. Los usuarios con rol USER solo pueden crear una inspeccion por dia.
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
            <p className="text-xl font-semibold text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-amber-700">Borradores</p>
            <p className="text-xl font-semibold text-amber-900">{stats.draft}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-emerald-700">Finalizadas</p>
            <p className="text-xl font-semibold text-emerald-900">{stats.finalized}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Fecha</span>
            <input
              type="date"
              value={fechaFilter}
              onChange={(event) => {
                setFechaFilter(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Estado</span>
            <select
              value={estadoFilter}
              onChange={(event) => {
                setEstadoFilter(event.target.value as "" | InspeccionDiaria["estado"]);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            >
              <option value="">Todos</option>
              <option value="DRAFT">DRAFT</option>
              <option value="FINALIZED">FINALIZED</option>
              <option value="REPORTED">REPORTED</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Conductor</span>
            <input
              type="text"
              value={conductorFilter}
              onChange={(event) => {
                setConductorFilter(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar conductor"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Placa</span>
            <input
              type="text"
              value={placaFilter}
              onChange={(event) => {
                setPlacaFilter(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar placa"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setFechaFilter("");
                setEstadoFilter("");
                setConductorFilter("");
                setPlacaFilter("");
                setPage(1);
              }}
              disabled={!hasActiveFilters}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando inspecciones...</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-600">{error}</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No hay inspecciones registradas.</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No hay resultados con los filtros aplicados.</div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Placa</th>
                  <th className="px-4 py-3">Conductor</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{row.fecha.slice(0, 10)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.placa}</td>
                    <td className="px-4 py-3 text-slate-700">{row.conductor}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          row.estado === "FINALIZED"
                            ? "bg-emerald-50 text-emerald-700"
                            : row.estado === "REPORTED"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {row.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link className="text-sm font-medium text-blue-600 hover:underline" href={`/${tenant}/inspeccion-diaria/${row.id}`}>
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredRows.length > PAGE_SIZE && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
                <p>
                  Mostrando {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filteredRows.length)} de {filteredRows.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="rounded-md border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <span className="min-w-20 text-center">
                    Pagina {currentPage} de {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-md border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
