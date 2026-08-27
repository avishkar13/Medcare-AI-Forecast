import { api } from "./client";
import { modelMetricsSchema } from "@/schemas/models";

export type { ErrorMetrics, ModelMetrics } from "@/schemas/models";

export const getModelMetrics = async () =>
  modelMetricsSchema.parse(await api.get<unknown>("/planning/models/metrics"));
