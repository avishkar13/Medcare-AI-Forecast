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

export interface AppSettings {
  general: GeneralSettings;
  alerts: AlertSettings;
  notifications: NotificationSettings;
  ai: AISettings;
}
