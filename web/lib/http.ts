import { store } from "../store";
import { refreshSession } from "../domains/auth/session-manager";
import { ApiError } from "./request";
import { requestRaw } from "./request";

const parseJson = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return undefined as T;
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }
  return (await response.json()) as T;
};

const parseApiError = async (response: Response) => {
  let payload: any;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
  }

  const message =
    (typeof payload?.message === "string" && payload.message) ||
    (typeof payload?.error === "string" && payload.error) ||
    "Request failed";
  const code =
    (typeof payload?.code === "string" && payload.code) ||
    (typeof payload?.message?.code === "string" && payload.message.code) ||
    undefined;

  return new ApiError(message, response.status, code, payload);
};

export const apiClient = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const authState = store.getState().auth;
  const accessToken = authState.accessToken;
  const mergedHeaders = new Headers(options?.headers);
  if (!mergedHeaders.has("Content-Type")) {
    mergedHeaders.set("Content-Type", "application/json");
  }
  if (accessToken) {
    mergedHeaders.set("Authorization", `Bearer ${accessToken}`);
  }
  if (authState.user?.id && !mergedHeaders.has("x-user-id")) {
    mergedHeaders.set("x-user-id", authState.user.id);
  }
  if (authState.tenantId && !mergedHeaders.has("x-tenant-id")) {
    mergedHeaders.set("x-tenant-id", authState.tenantId);
  }

  const response = await requestRaw(url, {
    ...options,
    credentials: "include",
    headers: mergedHeaders,
  });

  if (response.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      throw new Error("Unauthorized");
    }
    const retryHeaders = new Headers(mergedHeaders);
    retryHeaders.set("Authorization", `Bearer ${refreshedToken}`);
    const retryResponse = await requestRaw(url, {
      ...options,
      credentials: "include",
      headers: retryHeaders,
    });
    if (!retryResponse.ok) {
      throw await parseApiError(retryResponse);
    }
    return parseJson<T>(retryResponse);
  }

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return parseJson<T>(response);
};
