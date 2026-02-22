import { apiClient } from "../../lib/http";
import type { InspeccionDiaria, InspeccionItem, UpsertInspeccionDiariaPayload } from "./types";

export const listInspecciones = () => apiClient<InspeccionDiaria[]>("/inspecciones/diarias");
export const listInspeccionItems = () => apiClient<InspeccionItem[]>("/inspecciones/items");
export const getInspeccion = (id: string) => apiClient<InspeccionDiaria>(`/inspecciones/diarias/${id}`);
export const createInspeccion = (payload: UpsertInspeccionDiariaPayload) =>
  apiClient<InspeccionDiaria>("/inspecciones/diarias", {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const updateInspeccion = (id: string, payload: UpsertInspeccionDiariaPayload) =>
  apiClient<InspeccionDiaria>(`/inspecciones/diarias/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
export const finalizeInspeccion = (id: string) =>
  apiClient<InspeccionDiaria>(`/inspecciones/diarias/${id}/finalizar`, { method: "POST" });
