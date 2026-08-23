import type { Request as ExpressRequest } from "express";
import type { RateLimitInfo } from "express-rate-limit";

declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: string;
      roles?: string[];
    }

    interface Request {
      id: string;
      user?: AuthenticatedUser;
      rateLimit?: RateLimitInfo;
    }
  }
}

export type ErrorDetails = Record<string, unknown> | unknown[];

export interface AppErrorOptions {
  details?: ErrorDetails;
  cause?: unknown;
}

export interface NormalizedError {
  statusCode: number;
  code: string;
  message: string;
  details?: ErrorDetails;
}

export interface RateLimitRule {
  name: string;
  windowMs: number;
  limit: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  skip?: (req: ExpressRequest) => boolean;
}

export type RateLimitStoreKind = "redis" | "memory" | "disabled";

export type DependencyStatus = "up" | "down" | "not_configured";

export interface ReadinessReport {
  status: "ok" | "degraded";
  uptimeSeconds: number;
  dependencies: Record<"database" | "redis", DependencyStatus>;
}
