export interface ResponseMeta {
  generatedAt: string;
  planningRunId?: string | null;
  page?: number;
  pageSize?: number;
  total?: number;
}

export interface ApiResult<T> {
  data: T;
  meta: ResponseMeta;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export interface RateLimitDetails {
  retryAfterSeconds: number;
}

export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined
>;
