import { api } from "./client";

export interface ReadinessReport {
  status: "ok" | "degraded";
  uptimeSeconds: number;
  dependencies: {
    database: "up" | "down";
    redis: "up" | "down";
    forecast: "up" | "down";
  };
}

// answers with a bare payload rather than the envelope, which the client handles
export const getReadiness = () => api.get<ReadinessReport>("/health/ready");
