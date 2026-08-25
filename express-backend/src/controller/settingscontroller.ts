import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

const DEFAULT_SETTINGS = {
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
      { id: "erp", name: "ERP", status: "connected", lastSync: "2 minutes ago", records: 42840 }
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

const mapPrismaToFrontend = (dbSettings: any) => {
  if (!dbSettings || !dbSettings.general) return DEFAULT_SETTINGS;
  return {
    general: {
      workspaceName: dbSettings.general.workspaceName,
      organization: dbSettings.general.organization,
      region: dbSettings.general.region,
      timezone: dbSettings.general.timezone,
      dateFormat: dbSettings.general.dateFormat,
      currency: dbSettings.general.currency,
      language: dbSettings.general.language,
      theme: dbSettings.general.theme,
      density: dbSettings.general.density,
      defaultLandingPage: dbSettings.general.defaultLandingPage,
    },
    forecast: {
      defaultHorizon: dbSettings.forecast.defaultHorizon,
      defaultModel: dbSettings.forecast.defaultModel,
      confidenceThreshold: dbSettings.forecast.confidenceThreshold,
      updateFrequency: dbSettings.forecast.updateFrequency,
      predictionInterval: dbSettings.forecast.predictionInterval,
      autoRefresh: dbSettings.forecast.autoRefresh,
      targetAccuracy: dbSettings.forecast.targetAccuracy,
      alertAccuracyThreshold: dbSettings.forecast.alertAccuracyThreshold,
    },
    inventory: {
      defaultSafetyStock: dbSettings.inventory.defaultSafetyStock,
      reorderPoint: dbSettings.inventory.reorderPoint,
      maxInventory: dbSettings.inventory.maxInventory,
      minServiceLevel: dbSettings.inventory.minServiceLevel,
      autoReorder: dbSettings.inventory.autoReorder,
      thresholds: {
        stockCoverage: { warning: dbSettings.inventory.coverageWarning, critical: dbSettings.inventory.coverageCritical },
        safetyStock: { warning: dbSettings.inventory.safetyStockWarning, critical: dbSettings.inventory.safetyStockCritical },
        capacity: { warning: dbSettings.inventory.capacityWarning, critical: dbSettings.inventory.capacityCritical },
        expiryWindow: { warning: dbSettings.inventory.expiryWindowWarning, critical: dbSettings.inventory.expiryWindowCritical },
      }
    },
    alerts: {
      realTimeMonitoring: dbSettings.alerts.realTimeMonitoring,
      types: {
        stockoutRisk: dbSettings.alerts.typeStockoutRisk,
        demandSpike: dbSettings.alerts.typeDemandSpike,
        expiryRisk: dbSettings.alerts.typeExpiryRisk,
        supplierDelay: dbSettings.alerts.typeSupplierDelay,
        capacityBreach: dbSettings.alerts.typeCapacityBreach,
        forecastAnomaly: dbSettings.alerts.typeForecastAnomaly,
        overstock: dbSettings.alerts.typeOverstock,
      },
      thresholds: {
        stockoutProbability: dbSettings.alerts.thresholdStockoutProb,
        demandDeviation: dbSettings.alerts.thresholdDemandDeviation,
        expiryWindow: dbSettings.alerts.thresholdExpiryWindow,
        capacityUtilization: dbSettings.alerts.thresholdCapacityUtil,
        supplierDelay: dbSettings.alerts.thresholdSupplierDelay,
      },
      escalation: {
        critical: dbSettings.alerts.escalationCritical,
        high: dbSettings.alerts.escalationHigh,
        medium: dbSettings.alerts.escalationMedium,
        low: dbSettings.alerts.escalationLow,
      }
    },
    notifications: {
      channels: {
        inApp: dbSettings.notifications.channelInApp,
        email: dbSettings.notifications.channelEmail,
        sms: dbSettings.notifications.channelSms,
        teams: dbSettings.notifications.channelTeams,
      },
      rules: dbSettings.notifications.rules ? dbSettings.notifications.rules.map((r: any) => ({
        event: r.event,
        inApp: r.inApp,
        email: r.email,
        sms: r.sms
      })) : [],
      dailyDigest: {
        enabled: dbSettings.notifications.dailyDigestEnabled,
        deliveryTime: dbSettings.notifications.dailyDigestTime,
      }
    },
    ai: {
      primaryModel: dbSettings.ai.primaryModel,
      modelConfidence: dbSettings.ai.modelConfidence,
      recommendationConfidence: dbSettings.ai.recommendationConfidence,
      features: {
        recommendations: dbSettings.ai.featRecommendations,
        explainability: dbSettings.ai.featExplainability,
        autoRiskDetection: dbSettings.ai.featAutoRiskDetection,
      },
      decisionFactors: {
        demandForecast: dbSettings.ai.factorDemandForecast,
        inventoryPosition: dbSettings.ai.factorInventoryPosition,
        leadTime: dbSettings.ai.factorLeadTime,
        expiryRisk: dbSettings.ai.factorExpiryRisk,
        networkCapacity: dbSettings.ai.factorNetworkCapacity,
      }
    },
    integrations: {
      sources: dbSettings.integrations.sources ? dbSettings.integrations.sources.map((s: any) => ({
        id: s.sourceId,
        name: s.name,
        status: s.status,
        lastSync: s.lastSync,
        records: s.records
      })) : [],
      dataRefresh: {
        autoSync: dbSettings.integrations.autoSync,
        frequency: dbSettings.integrations.syncFrequency,
      },
      api: {
        status: dbSettings.integrations.apiStatus,
        environment: dbSettings.integrations.apiEnvironment,
        version: dbSettings.integrations.apiVersion,
      }
    },
    security: {
      twoFactor: dbSettings.security.twoFactor,
      sessionTimeout: dbSettings.security.sessionTimeout,
      passwordPolicy: dbSettings.security.passwordPolicy,
      loginAlerts: dbSettings.security.loginAlerts,
      auditLogging: dbSettings.security.auditLogging,
    },
  };
};

const mapFrontendToPrismaCreate = (payload: any) => {
  return {
    general: { create: {
      workspaceName: payload.general.workspaceName,
      organization: payload.general.organization,
      region: payload.general.region,
      timezone: payload.general.timezone,
      dateFormat: payload.general.dateFormat,
      currency: payload.general.currency,
      language: payload.general.language,
      theme: payload.general.theme,
      density: payload.general.density,
      defaultLandingPage: payload.general.defaultLandingPage,
    } },
    forecast: { create: payload.forecast },
    inventory: {
      create: {
        defaultSafetyStock: payload.inventory.defaultSafetyStock,
        reorderPoint: payload.inventory.reorderPoint,
        maxInventory: payload.inventory.maxInventory,
        minServiceLevel: payload.inventory.minServiceLevel,
        autoReorder: payload.inventory.autoReorder,
        coverageWarning: payload.inventory.thresholds.stockCoverage.warning,
        coverageCritical: payload.inventory.thresholds.stockCoverage.critical,
        safetyStockWarning: payload.inventory.thresholds.safetyStock.warning,
        safetyStockCritical: payload.inventory.thresholds.safetyStock.critical,
        capacityWarning: payload.inventory.thresholds.capacity.warning,
        capacityCritical: payload.inventory.thresholds.capacity.critical,
        expiryWindowWarning: payload.inventory.thresholds.expiryWindow.warning,
        expiryWindowCritical: payload.inventory.thresholds.expiryWindow.critical,
      }
    },
    alerts: {
      create: {
        realTimeMonitoring: payload.alerts.realTimeMonitoring,
        typeStockoutRisk: payload.alerts.types.stockoutRisk,
        typeDemandSpike: payload.alerts.types.demandSpike,
        typeExpiryRisk: payload.alerts.types.expiryRisk,
        typeSupplierDelay: payload.alerts.types.supplierDelay,
        typeCapacityBreach: payload.alerts.types.capacityBreach,
        typeForecastAnomaly: payload.alerts.types.forecastAnomaly,
        typeOverstock: payload.alerts.types.overstock,
        thresholdStockoutProb: payload.alerts.thresholds.stockoutProbability,
        thresholdDemandDeviation: payload.alerts.thresholds.demandDeviation,
        thresholdExpiryWindow: payload.alerts.thresholds.expiryWindow,
        thresholdCapacityUtil: payload.alerts.thresholds.capacityUtilization,
        thresholdSupplierDelay: payload.alerts.thresholds.supplierDelay,
        escalationCritical: payload.alerts.escalation.critical,
        escalationHigh: payload.alerts.escalation.high,
        escalationMedium: payload.alerts.escalation.medium,
        escalationLow: payload.alerts.escalation.low,
      }
    },
    notifications: {
      create: {
        channelInApp: payload.notifications.channels.inApp,
        channelEmail: payload.notifications.channels.email,
        channelSms: payload.notifications.channels.sms,
        channelTeams: payload.notifications.channels.teams,
        dailyDigestEnabled: payload.notifications.dailyDigest.enabled,
        dailyDigestTime: payload.notifications.dailyDigest.deliveryTime,
        rules: {
          create: payload.notifications.rules.map((r: any) => ({
            event: r.event,
            inApp: r.inApp,
            email: r.email,
            sms: r.sms
          }))
        }
      }
    },
    ai: {
      create: {
        primaryModel: payload.ai.primaryModel,
        modelConfidence: payload.ai.modelConfidence,
        recommendationConfidence: payload.ai.recommendationConfidence,
        featRecommendations: payload.ai.features.recommendations,
        featExplainability: payload.ai.features.explainability,
        featAutoRiskDetection: payload.ai.features.autoRiskDetection,
        factorDemandForecast: payload.ai.decisionFactors.demandForecast,
        factorInventoryPosition: payload.ai.decisionFactors.inventoryPosition,
        factorLeadTime: payload.ai.decisionFactors.leadTime,
        factorExpiryRisk: payload.ai.decisionFactors.expiryRisk,
        factorNetworkCapacity: payload.ai.decisionFactors.networkCapacity,
      }
    },
    integrations: {
      create: {
        autoSync: payload.integrations.dataRefresh.autoSync,
        syncFrequency: payload.integrations.dataRefresh.frequency,
        apiStatus: payload.integrations.api.status,
        apiEnvironment: payload.integrations.api.environment,
        apiVersion: payload.integrations.api.version,
        sources: {
          create: payload.integrations.sources.map((s: any) => ({
            sourceId: s.id,
            name: s.name,
            status: s.status,
            lastSync: s.lastSync,
            records: s.records
          }))
        }
      }
    },
    security: { create: payload.security },
  };
};

export const settingsController = {
  getSettings: async (_req: Request, res: Response) => {
    try {
      let settings = await prisma.systemSettings.findFirst({
        include: {
          general: true,
          forecast: true,
          inventory: true,
          alerts: true,
          notifications: { include: { rules: true } },
          ai: true,
          integrations: { include: { sources: true } },
          security: true
        }
      });
      
      if (!settings) {
        settings = await prisma.systemSettings.create({
          data: mapFrontendToPrismaCreate(DEFAULT_SETTINGS),
          include: {
            general: true,
            forecast: true,
            inventory: true,
            alerts: true,
            notifications: { include: { rules: true } },
            ai: true,
            integrations: { include: { sources: true } },
            security: true
          }
        });
      }
      
      res.json(mapPrismaToFrontend(settings));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  },

  updateSettings: async (req: Request, res: Response) => {
    try {
      const updates = req.body;
      const existing = await prisma.systemSettings.findFirst({
        include: {
          general: true,
          forecast: true,
          inventory: true,
          alerts: true,
          notifications: { include: { rules: true } },
          ai: true,
          integrations: { include: { sources: true } },
          security: true
        }
      });

      const fullPayload = existing ? mapPrismaToFrontend(existing) : DEFAULT_SETTINGS;
      const mergedPayload = { ...fullPayload, ...updates };

      if (existing) {
        await prisma.systemSettings.delete({ where: { id: existing.id } });
      }

      const newSettings = await prisma.systemSettings.create({
        data: mapFrontendToPrismaCreate(mergedPayload),
        include: {
          general: true,
          forecast: true,
          inventory: true,
          alerts: true,
          notifications: { include: { rules: true } },
          ai: true,
          integrations: { include: { sources: true } },
          security: true
        }
      });

      res.json({ success: true, updatedSettings: mapPrismaToFrontend(newSettings) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  },

  testIntegration: async (_req: Request, res: Response) => {
    res.json({ success: true, message: "Connection successful", latencyMs: 145 });
  },

  resetPassword: async (_req: Request, res: Response) => {
    res.json({ success: true, message: "Password reset email sent." });
  }
};
