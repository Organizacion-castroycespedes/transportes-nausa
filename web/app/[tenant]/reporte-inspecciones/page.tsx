"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { Card } from "../../../components/design-system/Card";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { useAppSelector } from "../../../store/hooks";
import { ApiError } from "../../../lib/request";
import { ReportsInspectionFilters } from "../../../domains/reports/components/ReportsInspectionFilters";
import { ReportsInspectionTable } from "../../../domains/reports/components/ReportsInspectionTable";
import { useInspectionReports } from "../../../domains/reports/hooks/useInspectionReports";
import { useTenantRouteGuard } from "../../../domains/reports/hooks/useTenantRouteGuard";
import type { ReportInspectionItem } from "../../../domains/reports/types";
import {
  downloadInspectionPdf,
  sendBulkInspectionReports,
} from "../../../domains/reports/services/reports-api";

const triggerFileDownload = (blob: Blob, filename: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};

export default function ReporteInspeccionesPage() {
  const params = useParams<{ tenant: string }>();
  const tenant = typeof params?.tenant === "string" ? params.tenant : "";
  const { isReady, isAuthenticated, isValidTenant } = useTenantRouteGuard(tenant);
  const authUserId = useAppSelector((state) => state.auth.user?.id ?? "");
  const authRole = useAppSelector((state) => state.auth.user?.role ?? "");
  const isUserRole = authRole === "USER";
  const canSendBulkEmails = authRole === "SUPER_ADMIN";

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [driverId, setDriverId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [query, setQuery] = useState("");
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [bulkEmails, setBulkEmails] = useState("");
  const [bulkFrequency, setBulkFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const reportQuery = useMemo(
    () => ({
      page,
      pageSize: 10,
      status: status || undefined,
      driverId: driverId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      vehicleId: vehicleId.trim() || undefined,
    }),
    [driverId, endDate, page, startDate, status, vehicleId]
  );

  const { data, loading, error, reload } = useInspectionReports(reportQuery);

  const visibleItems = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return data.items;
    return data.items.filter((item) =>
      [item.driverName, item.vehicleLabel, item.creatorName, item.status, item.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [data, query]);

  const normalizeId = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();
  const canUserDownloadInspection = (item: ReportInspectionItem) => {
    if (!isUserRole) {
      return true;
    }
    return normalizeId(item.createdBy) === normalizeId(authUserId);
  };
  const selectedInspection = selectedInspectionId
    ? visibleItems.find((item) => item.id === selectedInspectionId) ?? null
    : null;

  const handleDownload = async (id: string) => {
    const targetItem = visibleItems.find((item) => item.id === id) ?? data?.items.find((item) => item.id === id);
    if (targetItem && !canUserDownloadInspection(targetItem)) {
      setBulkError("Solo puedes descargar tus propias inspecciones.");
      return;
    }

    setDownloadingId(id);
    setBulkError(null);
    try {
      const file = await downloadInspectionPdf(id);
      triggerFileDownload(file.blob, file.filename);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "No se pudo descargar el PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSendBulk = async () => {
    const emails = bulkEmails
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (emails.length === 0) {
      setBulkError("Debes ingresar al menos un correo.");
      return;
    }
    if ((bulkFrequency === "weekly" || bulkFrequency === "monthly") && (!startDate || !endDate)) {
      setBulkError("Para envío semanal/mensual define rango de fechas.");
      return;
    }

    setBulkSending(true);
    setBulkError(null);
    setBulkMessage(null);
    try {
      const result = await sendBulkInspectionReports({
        frequency: bulkFrequency,
        emails,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setBulkMessage(
        `Enviado a ${result.sentTo} destinatarios. ${result.inspectionCount} inspecciones (${result.range.startDate} a ${result.range.endDate}).`
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setBulkError(`${err.message} (${err.status})`);
      } else {
        setBulkError(err instanceof Error ? err.message : "No se pudo enviar el reporte.");
      }
    } finally {
      setBulkSending(false);
    }
  };

  if (!isReady) {
    return null;
  }

  if (!isAuthenticated || !isValidTenant) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Validando tenant y sesión...</p>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Reporte de inspecciones</h1>
          <p className="text-sm text-muted-foreground">
            Consulta, descarga PDF y envío masivo con filtros por rango, estado y conductor.
          </p>
        </div>
        <Button variant="outline" onClick={() => void reload()} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <ReportsInspectionFilters
        query={query}
        status={status}
        onQueryChange={(value) => {
          setQuery(value);
        }}
        onStatusChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
        driverId={driverId}
        driverOptions={data?.filters.driverOptions ?? []}
        onDriverIdChange={(value) => {
          setDriverId(value);
          setPage(1);
        }}
        vehicleId={vehicleId}
        onVehicleIdChange={(value) => {
          setVehicleId(value);
          setPage(1);
        }}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={(value) => {
          setStartDate(value);
          setPage(1);
        }}
        onEndDateChange={(value) => {
          setEndDate(value);
          setPage(1);
        }}
        onClear={() => {
          setQuery("");
          setStatus("");
          setDriverId("");
          setVehicleId("");
          setStartDate("");
          setEndDate("");
          setSelectedInspectionId(null);
          setPage(1);
        }}
        onSendBulk={() => void handleSendBulk()}
        onDownloadSelected={() =>
          selectedInspectionId ? void handleDownload(selectedInspectionId) : undefined
        }
        canSendBulk={canSendBulkEmails}
        canDownloadSelected={
          Boolean(selectedInspectionId) &&
          !Boolean(downloadingId) &&
          (!selectedInspection || canUserDownloadInspection(selectedInspection))
        }
        sendingBulk={bulkSending}
      />

      {bulkError && !canSendBulkEmails ? (
        <Card className="p-4">
          <p className="text-sm text-primary">{bulkError}</p>
        </Card>
      ) : null}

      {canSendBulkEmails ? <Card className="p-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px_auto]">
          <Input
            label="Correos para envío masivo"
            placeholder="correo1@empresa.com, correo2@empresa.com"
            value={bulkEmails}
            onChange={(e) => setBulkEmails(e.target.value)}
            disabled={!canSendBulkEmails}
          />
          <Select
            label="Frecuencia"
            value={bulkFrequency}
            onChange={(e) => setBulkFrequency(e.target.value as "daily" | "weekly" | "monthly")}
            disabled={!canSendBulkEmails}
          >
            <option value="daily">Diario</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensual</option>
          </Select>
          <div className="flex items-end">
            <Button onClick={() => void handleSendBulk()} disabled={!canSendBulkEmails || bulkSending} className="w-full">
              {bulkSending ? "Enviando..." : "Enviar por correo"}
            </Button>
          </div>
        </div>
        {bulkMessage ? <p className="mt-3 text-sm text-secondary">{bulkMessage}</p> : null}
        {bulkError ? <p className="mt-3 text-sm text-primary">{bulkError}</p> : null}
      </Card> : null}

      <ReportsInspectionTable
        items={visibleItems}
        loading={loading}
        error={error}
        page={data?.page ?? page}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        pageSize={data?.pageSize ?? 10}
        selectedId={selectedInspectionId}
        onSelect={setSelectedInspectionId}
        onPreviousPage={() => setPage((prev) => Math.max(1, prev - 1))}
        onNextPage={() => setPage((prev) => Math.min(data?.totalPages ?? 1, prev + 1))}
        onDownloadRow={(id) => void handleDownload(id)}
        downloadingId={downloadingId}
        canDownloadRow={canUserDownloadInspection}
      />
    </section>
  );
}
