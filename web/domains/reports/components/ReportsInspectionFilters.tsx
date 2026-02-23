import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { SearchFilters } from "../../../components/design-system/SearchFilters";
import { Select } from "../../../components/design-system/Select";
import { Card } from "../../../components/design-system/Card";

type ReportsInspectionFiltersProps = {
  query: string;
  status: string;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  driverId: string;
  driverOptions: Array<{ value: string; label: string }>;
  onDriverIdChange: (value: string) => void;
  vehicleId: string;
  onVehicleIdChange: (value: string) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onClear: () => void;
  onSendBulk: () => void;
  onDownloadSelected: () => void;
  canSendBulk: boolean;
  canDownloadSelected: boolean;
  sendingBulk?: boolean;
};

export const ReportsInspectionFilters = ({
  query,
  status,
  onQueryChange,
  onStatusChange,
  driverId,
  driverOptions,
  onDriverIdChange,
  vehicleId,
  onVehicleIdChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear,
  onSendBulk,
  onDownloadSelected,
  canSendBulk,
  canDownloadSelected,
  sendingBulk,
}: ReportsInspectionFiltersProps) => {
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <SearchFilters
          query={query}
          status={status}
          onQueryChange={onQueryChange}
          onStatusChange={onStatusChange}
          queryLabel="Buscar"
          queryPlaceholder="Conductor, vehiculo o creador"
          statusLabel="Estado"
          statusOptions={[
            { value: "", label: "Todos" },
            { value: "DRAFT", label: "DRAFT" },
            { value: "FINALIZED", label: "FINALIZED" },
            { value: "REPORTED", label: "REPORTED" },
          ]}
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Select label="Conductor" value={driverId} onChange={(e) => onDriverIdChange(e.target.value)}>
            <option value="">Todos</option>
            {driverOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Input
            label="Vehiculo (ID o placa)"
            placeholder="Ej. 12 o ABC123"
            value={vehicleId}
            onChange={(e) => onVehicleIdChange(e.target.value)}
          />
          <Input
            label="Fecha inicio"
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
          <Input
            label="Fecha fin"
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={onClear}>
            Limpiar filtros
          </Button>
          <Button
            variant="outline"
            onClick={onDownloadSelected}
            disabled={!canDownloadSelected}
            title={!canDownloadSelected ? "Selecciona una inspeccion en la tabla" : undefined}
          >
            Descargar
          </Button>
          {canSendBulk ? (
            <Button onClick={onSendBulk} disabled={Boolean(sendingBulk)}>
              {sendingBulk ? "Enviando..." : "Enviar por correo"}
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
};
