export type AlertSeverity = "critical" | "high" | "medium" | "low";

export type AlertType =
  | "stockout_risk"
  | "demand_spike"
  | "expiry_risk"
  | "overstock"
  | "supplier_delay"
  | "capacity_breach"
  | "forecast_anomaly";

export type AlertStatus = "new" | "acknowledged" | "in_progress" | "resolved";

export interface AlertTimelineEvent {
  time: string; // ISO string
  description: string;
}

export interface SystemAlert {
  id: string;
  severity: AlertSeverity;
  type: AlertType;
  title: string;
  sku?: string;
  product?: string;
  location: string;
  detectedAt: string; // ISO string
  businessImpact: string;
  status: AlertStatus;
  recommendedAction: string;
  explanation: string;
  metrics: {
    label: string;
    value: string | number;
  }[];
  timeline: AlertTimelineEvent[];
}

export interface AlertOverviewData {
  criticalCount: number;
  highCount: number;
  unresolvedCount: number;
  todayCount: number;
  todayDelta: number;
  resolvedCount: number;
  resolvedPercentage: number;
}
