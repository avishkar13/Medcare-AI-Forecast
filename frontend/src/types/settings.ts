export interface GeneralSettings {
  workspaceName: string;
  organization: string;
  region: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  language: string;
  theme: "light" | "dark" | "system";
  density: "comfortable" | "compact";
  defaultLandingPage: string;
}

export interface ForecastSettings {
  defaultHorizon: number; // 7, 14, 30, 60, 90
  defaultModel: string;
  confidenceThreshold: number; // 0-100
  updateFrequency: string; // 'hourly', '6_hours', '12_hours', 'daily'
  predictionInterval: number; // 95
  autoRefresh: boolean;
  targetAccuracy: number;
  alertAccuracyThreshold: number;
}

export interface InventoryThresholds {
  stockCoverage: { warning: number; critical: number }; // days
  safetyStock: { warning: number; critical: number }; // percentage
  capacity: { warning: number; critical: number }; // percentage
  expiryWindow: { warning: number; critical: number }; // days
}

export interface InventorySettings {
  defaultSafetyStock: number; // days
  reorderPoint: number; // days of demand
  maxInventory: number; // days of demand
  minServiceLevel: number; // percentage
  autoReorder: boolean;
  thresholds: InventoryThresholds;
}

export interface AlertThresholds {
  stockoutProbability: number;
  demandDeviation: number;
  expiryWindow: number;
  capacityUtilization: number;
  supplierDelay: number;
}

export interface AlertSettings {
  realTimeMonitoring: boolean;
  types: {
    stockoutRisk: boolean;
    demandSpike: boolean;
    expiryRisk: boolean;
    supplierDelay: boolean;
    capacityBreach: boolean;
    forecastAnomaly: boolean;
    overstock: boolean;
  };
  thresholds: AlertThresholds;
  escalation: {
    critical: string;
    high: string;
    medium: string;
    low: string;
  };
}

export interface NotificationRule {
  event: string;
  inApp: boolean;
  email: boolean;
  sms: boolean;
}

export interface NotificationSettings {
  channels: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
    teams: boolean;
  };
  rules: NotificationRule[];
  dailyDigest: {
    enabled: boolean;
    deliveryTime: string;
  };
}

export interface AISettings {
  primaryModel: string;
  modelConfidence: number;
  recommendationConfidence: number;
  features: {
    recommendations: boolean;
    explainability: boolean;
    autoRiskDetection: boolean;
  };
  decisionFactors: {
    demandForecast: number;
    inventoryPosition: number;
    leadTime: number;
    expiryRisk: number;
    networkCapacity: number;
  };
}

export interface Integration {
  id: string;
  name: string;
  status: "connected" | "disconnected" | "error";
  lastSync: string;
  records: number;
}

export interface IntegrationSettings {
  sources: Integration[];
  totalRecords: number;
  dataRefresh: {
    autoSync: boolean;
    frequency: string;
  };
  api: {
    status: string;
    environment: string;
    version: string;
  };
}

export interface SecuritySettings {
  twoFactor: boolean;
  sessionTimeout: number; // minutes
  passwordPolicy: string;
  loginAlerts: boolean;
  auditLogging: boolean;
}

export interface AppSettings {
  general: GeneralSettings;
  forecast: ForecastSettings;
  inventory: InventorySettings;
  alerts: AlertSettings;
  notifications: NotificationSettings;
  ai: AISettings;
  integrations: IntegrationSettings;
  security: SecuritySettings;
}
