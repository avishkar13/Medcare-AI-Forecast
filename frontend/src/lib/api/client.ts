import { env } from "@/config/env";
import { useAuthStore } from "@/store/auth.store";
import { ApiError, ApiErrorCode, toApiError } from "./errors";
import type { ApiResult, QueryParams, ResponseMeta } from "./types";

const REQUEST_ID_HEADER = "x-request-id";

// env.apiUrl is a same-origin path when the app proxies the backend through next,
// and URL() needs a base to resolve one. every caller runs in the browser.
const apiBase = () => (env.apiUrl.startsWith("/") ? window.location.origin : undefined);

const buildUrl = (path: string, params?: QueryParams) => {
  const url = new URL(`${env.apiUrl}${path.startsWith("/") ? path : `/${path}`}`, apiBase());

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  return url.toString();
};

// the server echoes this back and puts it in error.requestId, so a report from a
// user can be matched to a server log line. must be 8-64 of [A-Za-z0-9_-].
const newRequestId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

interface RequestOptions {
  params?: QueryParams;
  body?: unknown;
  signal?: AbortSignal;
  /**
   * Extra request headers. Currently only `Idempotency-Key`, which is what makes a
   * retried write safe rather than a duplicate.
   */
  headers?: Record<string, string>;
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const requestId = newRequestId();
  const hasBody = options.body !== undefined;

  const token = useAuthStore.getState().token;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.params), {
      method,
      headers: {
        accept: "application/json",
        [REQUEST_ID_HEADER]: requestId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(hasBody ? { "content-type": "application/json" } : {}),
        ...(options.headers ?? {}),
      },
      ...(hasBody ? { body: JSON.stringify(options.body) } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError({
      code: ApiErrorCode.NetworkError,
      message: "could not reach the api",
      status: 0,
      requestId,
    });
  }

  const echoedId = response.headers.get(REQUEST_ID_HEADER) ?? requestId;

  // 204 on delete, and any empty body
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    if (!response.ok) throw toApiError(null, response.status, echoedId);
    return { data: undefined as T, meta: { generatedAt: new Date().toISOString() } };
  }

  const payload = await response.json().catch(() => null);

  if (response.status === 401) {
    const authStore = useAuthStore.getState();
    if (authStore.isAuthenticated) {
      authStore.clearAuth();
    }
  } else if (response.status === 403) {
    // We dynamically import or use the toast function to avoid circular dependencies
    // if sonner is not client-ready, or we can just import it at the top.
    // For now we'll throw the error below, but let's change the payload message.
    if (payload && typeof payload === "object") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (payload as any).message = "You don't have permission to perform this action";
    }
  }

  if (!response.ok) throw toApiError(payload, response.status, echoedId);

  // health probes answer with a bare payload rather than the envelope
  if (payload && typeof payload === "object" && "data" in payload) {
    const envelope = payload as { data: T; meta?: ResponseMeta };
    return {
      data: envelope.data,
      meta: envelope.meta ?? { generatedAt: new Date().toISOString() },
    };
  }

  return { data: payload as T, meta: { generatedAt: new Date().toISOString() } };
}

/**
 * The filename the server chose, or a sensible fallback.
 *
 * `Content-Disposition` is only readable cross-origin because it is listed in the
 * backend's `CORS.exposedHeaders`; when it is missing the browser would otherwise save
 * every file as "download".
 */
const filenameFrom = (disposition: string | null, fallback: string): string => {
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return match?.[1] ? decodeURIComponent(match[1]) : fallback;
};

/**
 * Fetches a file and hands it to the browser.
 *
 * Not a plain `<a href>`: these routes are authenticated, and a bare navigation carries
 * no `Authorization` header, so the link would answer 401. The request goes through
 * fetch with the token, and the response is turned into an object URL.
 *
 * Errors still arrive as an envelope, because the export routes build the whole file
 * before sending - so a failure is a JSON error, not a truncated download.
 */
export const downloadFile = async (
  path: string,
  params?: QueryParams,
  fallbackName = "export.csv",
): Promise<{ filename: string; rows: number | null }> => {
  const requestId = newRequestId();
  const token = useAuthStore.getState().token;

  const response = await fetch(buildUrl(path, params), {
    headers: {
      [REQUEST_ID_HEADER]: requestId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw toApiError(payload, response.status, response.headers.get(REQUEST_ID_HEADER) ?? requestId);
  }

  const filename = filenameFrom(response.headers.get("content-disposition"), fallbackName);
  const rowsHeader = response.headers.get("x-export-rows");
  const blob = await response.blob();

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoked on the next tick rather than immediately: Safari cancels an in-flight
  // download when the object URL disappears in the same frame as the click.
  setTimeout(() => URL.revokeObjectURL(url), 0);

  return { filename, rows: rowsHeader === null ? null : Number(rowsHeader) };
};

export const api = {
  get: <T>(path: string, params?: QueryParams, signal?: AbortSignal) =>
    request<T>("GET", path, { ...(params ? { params } : {}), ...(signal ? { signal } : {}) }).then(
      (result) => result.data,
    ),

  // lists need meta for page, pageSize, total and planningRunId
  getPage: <T>(path: string, params?: QueryParams, signal?: AbortSignal) =>
    request<T>("GET", path, { ...(params ? { params } : {}), ...(signal ? { signal } : {}) }),

  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>("POST", path, { body, ...(headers ? { headers } : {}) }).then(
      (result) => result.data,
    ),

  patch: <T>(path: string, body?: unknown) =>
    request<T>("PATCH", path, { body }).then((result) => result.data),

  put: <T>(path: string, body?: unknown) =>
    request<T>("PUT", path, { body }).then((result) => result.data),

  delete: <T>(path: string) => request<T>("DELETE", path).then((result) => result.data),
};
