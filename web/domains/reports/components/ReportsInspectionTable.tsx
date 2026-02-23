import { Card } from "../../../components/design-system/Card";
import { Button } from "../../../components/design-system/Button";
import type { ReportInspectionItem } from "../types";

type ReportsInspectionTableProps = {
  items: ReportInspectionItem[];
  loading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onDownloadRow: (id: string) => void;
  downloadingId?: string | null;
  canDownloadRow?: (item: ReportInspectionItem) => boolean;
};

const statusClassMap: Record<string, string> = {
  FINALIZED: "bg-secondary/10 text-secondary",
  REPORTED: "bg-primary/10 text-primary",
  DRAFT: "bg-muted text-muted-foreground",
};

export const ReportsInspectionTable = ({
  items,
  loading,
  error,
  page,
  totalPages,
  total,
  pageSize,
  selectedId,
  onSelect,
  onPreviousPage,
  onNextPage,
  onDownloadRow,
  downloadingId,
  canDownloadRow,
}: ReportsInspectionTableProps) => {
  return (
    <Card className="overflow-hidden">
      {loading ? (
        <div className="p-6 text-sm text-muted-foreground">Cargando inspecciones...</div>
      ) : error ? (
        <div className="p-6 text-sm text-primary">{error}</div>
      ) : items.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">No hay inspecciones para los filtros seleccionados.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Sel.</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Conductor</th>
                  <th className="px-4 py-3">Vehiculo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Creado por</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const canDownload = canDownloadRow ? canDownloadRow(item) : true;
                  const isDownloading = downloadingId === item.id;
                  return (
                  <tr
                    key={item.id}
                    className={`border-b border-border/60 ${selectedId === item.id ? "bg-accent/50" : "bg-card"}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="radio"
                        name="selectedInspection"
                        checked={selectedId === item.id}
                        onChange={() => onSelect(item.id)}
                        className="h-4 w-4 accent-[var(--color-primary)]"
                        aria-label={`Seleccionar inspeccion ${item.id}`}
                      />
                    </td>
                    <td className="px-4 py-3">{item.inspectionDate}</td>
                    <td className="px-4 py-3">{item.driverName ?? `#${item.driverId}`}</td>
                    <td className="px-4 py-3">{item.vehicleLabel ?? `#${item.vehicleId}`}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          statusClassMap[item.status] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{item.creatorName ?? `#${item.createdBy}`}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDownloadRow(item.id)}
                        disabled={!canDownload || isDownloading}
                        title={!canDownload ? "Solo puedes descargar tus propias inspecciones" : undefined}
                      >
                        {isDownloading ? "Descargando..." : "Descargar PDF"}
                      </Button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
            <p className="text-muted-foreground">
              Mostrando {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} de {total}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onPreviousPage} disabled={page <= 1}>
                Anterior
              </Button>
              <span className="min-w-24 text-center text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={onNextPage}
                disabled={page >= totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};
