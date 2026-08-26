import type { QueryParams } from "@/lib/api";

// all query keys are built here. two spellings of the same key are two caches that
// never invalidate each other.
const list = (scope: string, params?: QueryParams) =>
  params ? ([scope, "list", params] as const) : ([scope, "list"] as const);

export const queryKeys = {
  dashboard: {
    all: ["dashboard"] as const,
    summary: () => ["dashboard", "summary"] as const,
    network: () => ["dashboard", "network"] as const,
    inventoryHealth: () => ["dashboard", "inventory-health"] as const,
    expiryRisk: () => ["dashboard", "expiry-risk"] as const,
    priorityActions: () => ["dashboard", "priority-actions"] as const,
  },

  inventory: {
    all: ["inventory"] as const,
    list: (params?: QueryParams) => list("inventory", params),
    one: (id: string) => ["inventory", "one", id] as const,
  },

  forecast: {
    all: ["forecast"] as const,
    kpi: (params?: QueryParams) => ["forecast", "kpi", params ?? {}] as const,
    summary: (params?: QueryParams) => ["forecast", "summary", params ?? {}] as const,
    mainChart: (params?: QueryParams) => ["forecast", "main-chart", params ?? {}] as const,
    trend: (params?: QueryParams) => ["forecast", "trend", params ?? {}] as const,
    seasonality: (params?: QueryParams) => ["forecast", "seasonality", params ?? {}] as const,
    network: (params?: QueryParams) => ["forecast", "network", params ?? {}] as const,
    skus: (params?: QueryParams) => ["forecast", "skus", params ?? {}] as const,
    performance: (params?: QueryParams) => ["forecast", "performance", params ?? {}] as const,
    impact: (params?: QueryParams) => ["forecast", "impact", params ?? {}] as const,
    insight: (params?: QueryParams) => ["forecast", "insight", params ?? {}] as const,
    accuracy: (params?: QueryParams) => ["forecast", "accuracy", params ?? {}] as const,
  },

  recommendations: {
    all: ["recommendations"] as const,
    list: (params?: QueryParams) => list("recommendations", params),
    kpi: (params?: QueryParams) => ["recommendations", "kpi", params ?? {}] as const,
    summary: (params?: QueryParams) => ["recommendations", "summary", params ?? {}] as const,
    impact: (params?: QueryParams) => ["recommendations", "impact", params ?? {}] as const,
    intelligence: (params?: QueryParams) => ["recommendations", "intelligence", params ?? {}] as const,
  },

  alerts: {
    all: ["alerts"] as const,
    list: (params?: QueryParams) => list("alerts", params),
    overview: () => ["alerts", "overview"] as const,
    trends: (params?: QueryParams) => ["alerts", "trends", params ?? {}] as const,
    distribution: () => ["alerts", "distribution"] as const,
    health: () => ["alerts", "health"] as const,
  },

  expiry: {
    all: ["expiry"] as const,
    batches: (params?: QueryParams) => list("expiry", params),
    overview: (params?: QueryParams) => ["expiry", "overview", params ?? {}] as const,
    timeline: (params?: QueryParams) => ["expiry", "timeline", params ?? {}] as const,
    dcExposure: (params?: QueryParams) => ["expiry", "dc-exposure", params ?? {}] as const,
    wastePrevention: () => ["expiry", "waste-prevention"] as const,
    assessment: (params?: QueryParams) => ["expiry", "assessment", params ?? {}] as const,
  },

  simulation: {
    all: ["simulation"] as const,
    history: (params?: QueryParams) => ["simulation", "history", params ?? {}] as const,
    saved: (params?: QueryParams) => ["simulation", "saved", params ?? {}] as const,
  },

  planning: {
    all: ["planning"] as const,
    runs: (params?: QueryParams) => list("planning", params),
    run: (id: string) => ["planning", "run", id] as const,
    compare: (id: string, baseline: string) => ["planning", "compare", id, baseline] as const,
    optimization: (id: string) => ["planning", "optimization", id] as const,
    simulation: (id: string) => ["planning", "simulation", id] as const,
  },

  scenarios: {
    all: ["scenarios"] as const,
    list: (params?: QueryParams) => list("scenarios", params),
    one: (id: string) => ["scenarios", "one", id] as const,
  },

  plans: {
    all: ["plans"] as const,
    supply: (params?: QueryParams) => ["plans", "supply", params ?? {}] as const,
    drp: (params?: QueryParams) => ["plans", "drp", params ?? {}] as const,
  },

  parameters: {
    all: ["parameters"] as const,
    list: (params?: QueryParams) => list("parameters", params),
  },

  models: {
    all: ["models"] as const,
    metrics: () => ["models", "metrics"] as const,
  },

  masterdata: {
    all: ["masterdata"] as const,
    products: (params?: QueryParams) => ["masterdata", "products", params ?? {}] as const,
    product: (id: string) => ["masterdata", "product", id] as const,
    warehouses: (params?: QueryParams) => ["masterdata", "warehouses", params ?? {}] as const,
    warehouse: (id: string) => ["masterdata", "warehouse", id] as const,
    distributors: (params?: QueryParams) => ["masterdata", "distributors", params ?? {}] as const,
    promotions: (params?: QueryParams) => ["masterdata", "promotions", params ?? {}] as const,
  },

  settings: {
    all: ["settings"] as const,
  },
} as const;
