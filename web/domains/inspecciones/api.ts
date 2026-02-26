import { apiClient } from "../../lib/http";
import { ApiError, requestRaw } from "../../lib/request";
import { store } from "../../store";
import type { InspeccionDiaria, InspeccionItem, UpsertInspeccionDiariaPayload } from "./types";
import { publishInspeccionEvent } from "./events";

const INSPECCIONES_ROUTES = {
  diarias: "/inspecciones/diarias",
  items: "/inspecciones/items",
} as const;

const buildInspeccionesHeaders = (headers?: HeadersInit) => {
  const auth = store.getState().auth;
  const mergedHeaders = new Headers(headers);

  if (auth.accessToken && !mergedHeaders.has("Authorization")) {
    mergedHeaders.set("Authorization", `Bearer ${auth.accessToken}`);
  }
  if (auth.user?.id && !mergedHeaders.has("x-user-id")) {
    mergedHeaders.set("x-user-id", auth.user.id);
  }
  if (auth.tenantId && !mergedHeaders.has("x-tenant-id")) {
    mergedHeaders.set("x-tenant-id", auth.tenantId);
  }
  return mergedHeaders;
};

const inspeccionesApi = <T>(url: string, options: RequestInit = {}) =>
  apiClient<T>(url, {
    ...options,
    headers: buildInspeccionesHeaders(options.headers),
  });

export const listInspecciones = (headers?: HeadersInit) =>
  inspeccionesApi<InspeccionDiaria[]>(INSPECCIONES_ROUTES.diarias, { headers });

export const listInspeccionItems = (headers?: HeadersInit) =>
  inspeccionesApi<InspeccionItem[]>(INSPECCIONES_ROUTES.items, { headers });

export const getInspeccion = (id: string, headers?: HeadersInit) =>
  inspeccionesApi<InspeccionDiaria>(`${INSPECCIONES_ROUTES.diarias}/${id}`, { headers });

export const createInspeccion = (
  payload: UpsertInspeccionDiariaPayload,
  headers?: HeadersInit
) =>
  inspeccionesApi<InspeccionDiaria>(INSPECCIONES_ROUTES.diarias, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  }).then((created) => {
    publishInspeccionEvent("created", created);
    return created;
  });

export const updateInspeccion = (
  id: string,
  payload: UpsertInspeccionDiariaPayload,
  headers?: HeadersInit
) =>
  inspeccionesApi<InspeccionDiaria>(`${INSPECCIONES_ROUTES.diarias}/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  }).then((updated) => {
    publishInspeccionEvent("updated", updated);
    return updated;
  });

export const finalizeInspeccion = (id: string, headers?: HeadersInit) =>
  inspeccionesApi<InspeccionDiaria>(`${INSPECCIONES_ROUTES.diarias}/${id}/finalizar`, {
    method: "POST",
    headers,
  }).then((finalized) => {
    publishInspeccionEvent("finalized", finalized);
    return finalized;
  });

export const downloadInspeccionPdf = async (id: string) => {
  const response = await requestRaw(`${INSPECCIONES_ROUTES.diarias}/${id}/pdf`, {
    method: "GET",
    credentials: "include",
    headers: buildInspeccionesHeaders({ Accept: "application/pdf" }),
  });

  if (!response.ok) {
    let message = "No fue posible descargar el PDF.";
    try {
      const payload = await response.json();
      if (typeof payload?.message === "string" && payload.message.trim()) {
        message = payload.message;
      }
    } catch {
      // ignore parse error
    }
    throw new ApiError(message, response.status);
  }

  const blob = await response.blob();
  return {
    blob,
    filename: `inspeccion-diaria-${id}.pdf`,
  };
};
