export type ReportDashboardUser = {
  scope: "USER";
  totalInspeccionesPropias: number;
  ultimaInspeccion: ReportInspectionItem | null;
  estadoPromedio: {
    score: number;
    cumplimientoPorcentaje: number;
  };
  distribucionEstados: Record<string, number>;
};

export type ReportDashboardAdmin = {
  scope: "ADMIN" | "SUPER_ADMIN";
  totalInspeccionesTenant: number;
  inspeccionesPorEstado: Array<{ status: string; count: number }>;
  inspeccionesPorDia: Array<{ date: string; count: number }>;
  topConductores: Array<{ driverId: string; driverName: string; count: number }>;
  cumplimientoSemanal: Array<{
    weekStart: string;
    total: number;
    finalized: number;
    complianceRate: number;
  }>;
  tendenciaMensual: Array<{ month: string; total: number; finalized: number }>;
};

export type ReportDashboardResponse = ReportDashboardUser | ReportDashboardAdmin;

export type ReportInspectionItem = {
  id: string;
  tenantId: string;
  vehicleId: string;
  driverId: string;
  createdBy: string;
  inspectionDate: string;
  status: "DRAFT" | "FINALIZED" | "REPORTED" | string;
  payload: unknown;
  createdAt: string;
  updatedAt: string | null;
  driverName: string | null;
  vehicleLabel: string | null;
  creatorName: string | null;
};

export type ReportInspectionsResponse = {
  items: ReportInspectionItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  filters: {
    driverOptions: Array<{ value: string; label: string }>;
    statusOptions: string[];
  };
};

export type ReportInspectionsQuery = {
  startDate?: string;
  endDate?: string;
  driverId?: string;
  status?: string;
  vehicleId?: string;
  createdBy?: string;
  page?: number;
  pageSize?: number;
};

export type SendBulkInspectionsReportPayload = {
  frequency: "daily" | "weekly" | "monthly";
  emails: string[];
  startDate?: string;
  endDate?: string;
  subject?: string;
};
