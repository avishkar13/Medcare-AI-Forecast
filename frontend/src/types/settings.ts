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

export const defaultSettings: AppSettings = {
  general: {
    workspaceName: "MedCare Supply Chain",
    organization: "MedCare Healthcare Network",
    region: "India",
    timezone: "Asia/Kolkata (IST)",
    dateFormat: "DD MMM YYYY",
    currency: "INR (₹)",
    language: "English",
    theme: "light",
    density: "comfortable",
    defaultLandingPage: "/dashboard",
  },
  forecast: {
    defaultHorizon: 30,
    defaultModel: "AI Ensemble",
    confidenceThreshold: 85,
    updateFrequency: "6_hours",
    predictionInterval: 95,
    autoRefresh: true,
    targetAccuracy: 85,
    alertAccuracyThreshold: 80,
  },
  inventory: {
    defaultSafetyStock: 14,
    reorderPoint: 7,
    maxInventory: 45,
    minServiceLevel: 95,
    autoReorder: true,
    thresholds: {
      stockCoverage: { warning: 14, critical: 7 },
      safetyStock: { warning: 100, critical: 70 },
      capacity: { warning: 85, critical: 100 },
      expiryWindow: { warning: 60, critical: 30 },
    },
  },
  alerts: {
    realTimeMonitoring: true,
    types: {
      stockoutRisk: true,
      demandSpike: true,
      expiryRisk: true,
      supplierDelay: true,
      capacityBreach: true,
      forecastAnomaly: true,
      overstock: true,
    },
    thresholds: {
      stockoutProbability: 70,
      demandDeviation: 20,
      expiryWindow: 30,
      capacityUtilization: 90,
      supplierDelay: 3,
    },
    escalation: {
      critical: "Immediate",
      high: "Within 15 minutes",
      medium: "Within 1 hour",
      low: "Daily Digest",
    },
  },
  notifications: {
    channels: {
      inApp: true,
      email: true,
      sms: false,
      teams: false,
    },
    rules: [
      { event: "Critical Stockout", inApp: true, email: true, sms: true },
      { event: "Expiry Risk", inApp: true, email: true, sms: false },
      { event: "Demand Spike", inApp: true, email: false, sms: false },
      { event: "Supplier Delay", inApp: true, email: true, sms: false },
      { event: "Capacity Breach", inApp: true, email: true, sms: false },
    ],
    dailyDigest: {
      enabled: true,
      deliveryTime: "08:00",
    },
  },
  ai: {
    primaryModel: "AI Ensemble",
    modelConfidence: 85,
    recommendationConfidence: 80,
    features: {
      recommendations: true,
      explainability: true,
      autoRiskDetection: true,
    },
    decisionFactors: {
      demandForecast: 35,
      inventoryPosition: 25,
      leadTime: 15,
      expiryRisk: 15,
      networkCapacity: 10,
    },
  },
  integrations: {
    sources: [
      { id: "erp", name: "ERP", status: "connected", lastSync: "2 minutes ago", records: 42840 },
      { id: "inv", name: "Inventory Database", status: "connected", lastSync: "5 minutes ago", records: 12500 },
      { id: "sup", name: "Supplier Data", status: "connected", lastSync: "1 hour ago", records: 340 },
      { id: "dem", name: "Demand Data", status: "connected", lastSync: "10 minutes ago", records: 8900 },
    ],
    dataRefresh: {
      autoSync: true,
      frequency: "15_minutes",
    },
    api: {
      status: "Connected",
      environment: "Demo",
      version: "v1.0",
    },
  },
  security: {
    twoFactor: true,
    sessionTimeout: 30,
    passwordPolicy: "Strong",
    loginAlerts: true,
    auditLogging: true,
  },
};
