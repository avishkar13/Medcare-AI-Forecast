import { env } from "@/config/env";
import { ApiError, ApiErrorCode, toApiError } from "./errors";
import type { ApiResult, QueryParams, ResponseMeta } from "./types";

const REQUEST_ID_HEADER = "x-request-id";

const buildUrl = (path: string, params?: QueryParams) => {
  const url = new URL(`${env.apiUrl}${path.startsWith("/") ? path : `/${path}`}`);

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
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const requestId = newRequestId();
  const hasBody = options.body !== undefined;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.params), {
      method,
      headers: {
        accept: "application/json",
        [REQUEST_ID_HEADER]: requestId,
        ...(hasBody ? { "content-type": "application/json" } : {}),
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

export const api = {
  get: <T>(path: string, params?: QueryParams, signal?: AbortSignal) =>
    request<T>("GET", path, { ...(params ? { params } : {}), ...(signal ? { signal } : {}) }).then(
      (result) => result.data,
    ),

  // lists need meta for page, pageSize, total and planningRunId
  getPage: <T>(path: string, params?: QueryParams, signal?: AbortSignal) =>
    request<T>("GET", path, { ...(params ? { params } : {}), ...(signal ? { signal } : {}) }),

  post: <T>(path: string, body?: unknown) =>
    request<T>("POST", path, { body }).then((result) => result.data),

  patch: <T>(path: string, body?: unknown) =>
    request<T>("PATCH", path, { body }).then((result) => result.data),

  put: <T>(path: string, body?: unknown) =>
    request<T>("PUT", path, { body }).then((result) => result.data),

  delete: <T>(path: string) => request<T>("DELETE", path).then((result) => result.data),
};
