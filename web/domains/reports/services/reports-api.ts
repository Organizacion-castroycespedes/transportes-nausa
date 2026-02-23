import { apiClient } from "../../../lib/http";
import { requestRaw, ApiError } from "../../../lib/request";
import { store } from "../../../store";
import type {
  ReportDashboardResponse,
  ReportInspectionsQuery,
  ReportInspectionsResponse,
  SendBulkInspectionsReportPayload,
} from "../types";

const REPORTS_BASE = "/reports";

const buildAuthHeaders = (headers?: HeadersInit) => {
  const auth = store.getState().auth;
  const merged = new Headers(headers);
  if (auth.accessToken && !merged.has("Authorization")) {
    merged.set("Authorization", `Bearer ${auth.accessToken}`);
  }
  if (auth.user?.id && !merged.has("x-user-id")) {
    merged.set("x-user-id", auth.user.id);
  }
  if (auth.tenantId && !merged.has("x-tenant-id")) {
    merged.set("x-tenant-id", auth.tenantId);
  }
  return merged;
};

const toQueryString = (query: ReportInspectionsQuery) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value == null || value === "") return;
    params.set(key, String(value));
  });
  const search = params.toString();
  return search ? `?${search}` : "";
};

export const fetchReportsDashboard = () =>
  apiClient<ReportDashboardResponse>(`${REPORTS_BASE}/dashboard`);

export const fetchReportInspections = (query: ReportInspectionsQuery) =>
  apiClient<ReportInspectionsResponse>(`${REPORTS_BASE}/inspections${toQueryString(query)}`);

export const sendBulkInspectionReports = (payload: SendBulkInspectionsReportPayload) =>
  apiClient<{
    ok: boolean;
    sentTo: number;
    inspectionCount: number;
    range: { startDate: string; endDate: string };
    frequency: string;
  }>(`${REPORTS_BASE}/inspections/send-bulk`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const downloadInspectionPdf = async (id: string) => {
  const response = await requestRaw(`${REPORTS_BASE}/inspections/${id}/pdf`, {
    method: "GET",
    credentials: "include",
    headers: buildAuthHeaders({ Accept: "application/pdf" }),
  });

  if (!response.ok) {
    let message = "No se pudo descargar el PDF";
    try {
      const payload = await response.json();
      if (typeof payload?.message === "string") {
        message = payload.message;
      }
    } catch {
      // ignore
    }
    throw new ApiError(message, response.status);
  }

  const blob = await response.blob();
  return {
    blob,
    filename: `inspection-report-${id}.pdf`,
  };
};
