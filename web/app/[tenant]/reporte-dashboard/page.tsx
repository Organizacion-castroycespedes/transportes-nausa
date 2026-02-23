"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { Card } from "../../../components/design-system/Card";
import { SearchFilters } from "../../../components/design-system/SearchFilters";
import { useAppSelector } from "../../../store/hooks";
import { DashboardCharts } from "../../../domains/reports/components/DashboardCharts";
import { DashboardSummaryCards } from "../../../domains/reports/components/DashboardSummaryCards";
import { useReportsDashboard } from "../../../domains/reports/hooks/useReportsDashboard";
import { useTenantRouteGuard } from "../../../domains/reports/hooks/useTenantRouteGuard";

const USER_STATUS_META: Record<string, { color: string; label: string }> = {
  FINALIZED: { color: "#16a34a", label: "Finalizadas" },
  REPORTED: { color: "#f59e0b", label: "Reportadas" },
  DRAFT: { color: "#64748b", label: "Borradores" },
};

const formatShortDate = (value?: string | null) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

export default function ReporteDashboardPage() {
  const params = useParams<{ tenant: string }>();
  const tenant = typeof params?.tenant === "string" ? params.tenant : "";
  const { isReady, isAuthenticated, isValidTenant } = useTenantRouteGuard(tenant);
  const { data, loading, error, reload } = useReportsDashboard();
  const authRole = useAppSelector((state) => state.auth.user?.role ?? "");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  const filteredAdminData = useMemo(() => {
    if (!data || data.scope === "USER") {
      return null;
    }
    const normalizedQuery = query.trim().toLowerCase();
    const byStatus = status
      ? data.inspeccionesPorEstado.filter((item) => item.status === status)
      : data.inspeccionesPorEstado;
    const topConductores = normalizedQuery
      ? data.topConductores.filter((driver) =>
          driver.driverName.toLowerCase().includes(normalizedQuery)
        )
      : data.topConductores;

    return {
      ...data,
      inspeccionesPorEstado: byStatus,
      topConductores,
    };
  }, [data, query, status]);

  const cards = useMemo(() => {
    if (!data) return [];
    if (data.scope === "USER") {
      return [
        { label: "Total propias", value: String(data.totalInspeccionesPropias) },
        {
          label: "Cumplimiento",
          value: `${data.estadoPromedio.cumplimientoPorcentaje}%`,
          hint: "Finalizadas sobre total",
        },
        {
          label: "Score estado",
          value: data.estadoPromedio.score.toFixed(2),
          hint: "FINALIZED=1 / REPORTED=0.5 / DRAFT=0",
        },
        {
          label: "Ultima inspeccion",
          value: data.ultimaInspeccion?.inspectionDate ?? "Sin registros",
          hint: data.ultimaInspeccion?.status ?? "",
        },
      ];
    }

    const totalFinalizadas = data.inspeccionesPorEstado.find((s) => s.status === "FINALIZED")?.count ?? 0;
    return [
      { label: "Total tenant", value: String(data.totalInspeccionesTenant) },
      { label: "Finalizadas", value: String(totalFinalizadas) },
      { label: "Top conductores", value: String(data.topConductores.length) },
      { label: "Rol", value: authRole || data.scope },
    ];
  }, [authRole, data]);

  const userDashboardView = useMemo(() => {
    if (!data || data.scope !== "USER") return null;

    const total = data.totalInspeccionesPropias;
    const sortedStatuses = Object.entries(data.distribucionEstados)
      .map(([statusKey, count]) => ({
        statusKey,
        count,
        percent: total > 0 ? Math.round((count / total) * 100) : 0,
        color: USER_STATUS_META[statusKey]?.color ?? "#8b5cf6",
        label: USER_STATUS_META[statusKey]?.label ?? statusKey,
      }))
      .sort((a, b) => b.count - a.count);

    const topStatus = sortedStatuses[0] ?? null;
    const draftCount = data.distribucionEstados.DRAFT ?? 0;
    const finalizedCount = data.distribucionEstados.FINALIZED ?? 0;
    const reportedCount = data.distribucionEstados.REPORTED ?? 0;
    const pendingPercent = total > 0 ? Math.round((draftCount / total) * 100) : 0;

    return {
      total,
      sortedStatuses,
      topStatus,
      draftCount,
      finalizedCount,
      reportedCount,
      pendingPercent,
      score: data.estadoPromedio.score,
      compliance: data.estadoPromedio.cumplimientoPorcentaje,
      latest: data.ultimaInspeccion,
    };
  }, [data]);

  if (!isReady) {
    return null;
  }

  if (!isAuthenticated || !isValidTenant) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Validando tenant y sesion...</p>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Reporte dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Metricas de inspecciones por rol con alcance multi-tenant seguro.
          </p>
        </div>
        <Button variant="outline" onClick={() => void reload()} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {data && data.scope !== "USER" ? (
        <SearchFilters
          query={query}
          status={status}
          onQueryChange={setQuery}
          onStatusChange={setStatus}
          queryLabel="Buscar conductor"
          queryPlaceholder="Filtrar top conductores"
          statusLabel="Estado"
          statusOptions={[
            { value: "", label: "Todos" },
            { value: "DRAFT", label: "DRAFT" },
            { value: "FINALIZED", label: "FINALIZED" },
            { value: "REPORTED", label: "REPORTED" },
          ]}
        />
      ) : null}

      {loading ? (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Cargando dashboard...</p>
        </Card>
      ) : error ? (
        <Card className="p-6">
          <p className="text-sm text-primary">{error}</p>
        </Card>
      ) : !data ? (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Sin datos disponibles.</p>
        </Card>
      ) : (
        <>
          <DashboardSummaryCards cards={cards} />

          {data.scope === "USER" ? (
            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="p-4 xl:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-card-foreground">Resumen del conductor</h2>
                    <p className="text-xs text-muted-foreground">
                      Vista rapida de desempeno personal y avance de inspecciones.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-right">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Estado dominante</p>
                    <p className="text-sm font-semibold text-card-foreground">
                      {userDashboardView?.topStatus
                        ? `${userDashboardView.topStatus.label} (${userDashboardView.topStatus.percent}%)`
                        : "Sin datos"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Cumplimiento</p>
                    <p className="mt-2 text-2xl font-semibold text-card-foreground">
                      {(userDashboardView?.compliance ?? 0).toFixed(2)}%
                    </p>
                    <div className="mt-3 h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-green-600 transition-all"
                        style={{ width: `${Math.max(0, Math.min(100, userDashboardView?.compliance ?? 0))}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Porcentaje de inspecciones finalizadas sobre el total.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Score de estado</p>
                    <p className="mt-2 text-2xl font-semibold text-card-foreground">
                      {(userDashboardView?.score ?? 0).toFixed(2)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Referencia: FINALIZED=1, REPORTED=0.5, DRAFT=0.
                    </p>
                    <div className="mt-3 flex gap-1">
                      <span className="h-1.5 flex-1 rounded-full bg-slate-500/40" />
                      <span className="h-1.5 flex-1 rounded-full bg-amber-500/40" />
                      <span className="h-1.5 flex-1 rounded-full bg-green-600/40" />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Pendientes (DRAFT)</p>
                    <p className="mt-2 text-2xl font-semibold text-card-foreground">
                      {userDashboardView?.draftCount ?? 0}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {userDashboardView?.pendingPercent ?? 0}% del total de tus inspecciones.
                    </p>
                    <div className="mt-3 h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-slate-500 transition-all"
                        style={{ width: `${Math.max(0, Math.min(100, userDashboardView?.pendingPercent ?? 0))}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-border bg-muted/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Finalizadas</p>
                    <p className="mt-1 text-lg font-semibold text-card-foreground">
                      {userDashboardView?.finalizedCount ?? 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Reportadas</p>
                    <p className="mt-1 text-lg font-semibold text-card-foreground">
                      {userDashboardView?.reportedCount ?? 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Total propias</p>
                    <p className="mt-1 text-lg font-semibold text-card-foreground">
                      {userDashboardView?.total ?? 0}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 xl:col-span-1">
                <h2 className="text-sm font-semibold text-card-foreground">Distribucion de estados</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Colores fijos para identificar rapido tus resultados.
                </p>
                <div className="mt-4 space-y-3">
                  {(userDashboardView?.sortedStatuses ?? []).map((item) => (
                    <div key={item.statusKey} className="rounded-xl border border-border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2 text-sm text-card-foreground">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          {item.label}
                        </span>
                        <span className="text-xs font-semibold text-card-foreground">{item.count}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{ width: `${item.percent}%`, backgroundColor: item.color }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{item.percent}% del total</p>
                    </div>
                  ))}
                  {(userDashboardView?.sortedStatuses.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">Aun no hay inspecciones para mostrar.</p>
                  ) : null}
                </div>
              </Card>

              <Card className="p-4 xl:col-span-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-card-foreground">Ultima inspeccion registrada</h2>
                    <p className="text-xs text-muted-foreground">
                      Detalle rapido de tu actividad mas reciente.
                    </p>
                  </div>
                  {userDashboardView?.latest?.status ? (
                    <span
                      className="rounded-full border px-3 py-1 text-xs font-semibold"
                      style={{
                        borderColor:
                          USER_STATUS_META[userDashboardView.latest.status]?.color ?? "var(--color-border)",
                        color: USER_STATUS_META[userDashboardView.latest.status]?.color ?? "var(--color-foreground)",
                      }}
                    >
                      {userDashboardView.latest.status}
                    </span>
                  ) : null}
                </div>

                {userDashboardView?.latest ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-border bg-muted/40 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Fecha</p>
                      <p className="mt-1 text-sm font-semibold text-card-foreground">
                        {formatShortDate(userDashboardView.latest.inspectionDate)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/40 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Vehiculo</p>
                      <p className="mt-1 text-sm font-semibold text-card-foreground">
                        {userDashboardView.latest.vehicleLabel || userDashboardView.latest.vehicleId || "N/A"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/40 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Conductor</p>
                      <p className="mt-1 text-sm font-semibold text-card-foreground">
                        {userDashboardView.latest.driverName || "N/A"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/40 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Registro</p>
                      <p className="mt-1 text-sm font-semibold text-card-foreground">
                        {formatShortDate(userDashboardView.latest.createdAt)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Todavia no tienes inspecciones registradas. Cuando crees la primera, aparecera aqui.
                  </p>
                )}
              </Card>

              <Card className="p-4 xl:col-span-1">
                <h2 className="text-sm font-semibold text-card-foreground">Lectura rapida</h2>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="rounded-xl border border-border bg-card p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Estado general</p>
                    <p className="mt-1 font-semibold text-card-foreground">
                      {(userDashboardView?.compliance ?? 0) >= 80
                        ? "Buen cumplimiento"
                        : (userDashboardView?.compliance ?? 0) >= 50
                          ? "Cumplimiento medio"
                          : "Requiere atencion"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Basado en el porcentaje de inspecciones finalizadas.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Accion sugerida</p>
                    <p className="mt-1 font-semibold text-card-foreground">
                      {(userDashboardView?.draftCount ?? 0) > 0
                        ? "Finaliza inspecciones en borrador"
                        : "Manten el ritmo de registro"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(userDashboardView?.draftCount ?? 0) > 0
                        ? `Tienes ${userDashboardView?.draftCount ?? 0} inspecciones DRAFT.`
                        : "No tienes pendientes en borrador actualmente."}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <>
              <DashboardCharts
                byStatus={filteredAdminData?.inspeccionesPorEstado ?? data.inspeccionesPorEstado}
                byDay={data.inspeccionesPorDia}
                monthlyTrend={data.tendenciaMensual}
              />
              <Card className="p-4">
                <h2 className="text-sm font-semibold text-card-foreground">Top 5 conductores</h2>
                <div className="mt-3 grid gap-2">
                  {(filteredAdminData?.topConductores ?? data.topConductores).map((driver) => (
                    <div
                      key={driver.driverId}
                      className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
                    >
                      <span className="text-sm text-card-foreground">{driver.driverName}</span>
                      <span className="text-sm font-semibold text-card-foreground">{driver.count}</span>
                    </div>
                  ))}
                  {(filteredAdminData?.topConductores ?? data.topConductores).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin resultados para el filtro actual.</p>
                  ) : null}
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </section>
  );
}
