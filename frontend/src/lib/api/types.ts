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

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  roleId: string;
  warehouseId: string | null;
  role?: {
    id: string;
    name: string;
  };
  permissions: string[];
}

export interface LoginResponse {
  user: AuthenticatedUser;
  token: string;
}
