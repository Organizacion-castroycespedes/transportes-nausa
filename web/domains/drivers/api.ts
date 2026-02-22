import { apiClient } from "../../lib/http";
import type { CreateDriverPayload, DriverResponse, UpdateDriverPayload } from "./types";

export const listDrivers = (headers?: HeadersInit) =>
  apiClient<DriverResponse[]>("/drivers", { headers });

export const getDriver = (id: string, headers?: HeadersInit) =>
  apiClient<DriverResponse>(`/drivers/${id}`, { headers });

export const createDriver = (payload: CreateDriverPayload, headers?: HeadersInit) =>
  apiClient<DriverResponse>("/drivers", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export const updateDriver = (
  id: string,
  payload: UpdateDriverPayload,
  headers?: HeadersInit
) =>
  apiClient<DriverResponse>(`/drivers/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });

export const updateDriverStatus = (
  id: string,
  estado: "A" | "I",
  headers?: HeadersInit
) =>
  apiClient<DriverResponse>(`/drivers/${id}/status`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ estado }),
  });

export const getMyDriver = (headers?: HeadersInit) =>
  apiClient<DriverResponse>("/drivers/me", { headers });

export const updateMyDriver = (payload: UpdateDriverPayload, headers?: HeadersInit) =>
  apiClient<DriverResponse>("/drivers/me", {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });
