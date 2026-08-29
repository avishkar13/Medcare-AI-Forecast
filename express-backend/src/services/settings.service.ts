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
  alerts: {
    realTimeMonitoring: true,
    types: {
      stockoutRisk: true,
      demandSpike: true,
      expiryRisk: true,
      supplierDelay: true,
      capacityBreach: true,
      overstock: true,
    },
    thresholds: {
      /**
       * Share of the lead time a position is *not* covered for.
       *
       * 70 meant "less than a third of your lead time is covered", which is past the
       * point of acting: a replenishment takes the whole lead time to arrive, so an
       * alert that late is a report, not a warning. At 40 there is still room to
       * expedite or transfer. Measured against the seeded network, every alert this
       * raises is at a Tier-2 DC - which is the failure mode the brief describes.
       */
      stockoutProbability: 40,
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
    /**
     * Keyed on the alert type, because that is what `routeAlert` matches against.
     *
     * These were display labels - "Critical Stockout" against a detector emitting
     * `stockout_risk` - so `rules.find(r => r.event === alert.type)` never matched and
     * every alert fell through to `rule?.email ?? false`. Email and SMS were off for
     * every alert ever raised, whatever the master toggles said.
     *
     * All six types are listed: three were missing entirely, so overstock, capacity
     * breaches and supplier delays had no rule to find even in principle. The severity
     * floor still applies on top, so this does not turn every low alert into an SMS.
     */
    rules: [
      { event: "stockout_risk", inApp: true, email: true, sms: true },
      { event: "expiry_risk", inApp: true, email: true, sms: false },
      { event: "supplier_delay", inApp: true, email: true, sms: false },
      { event: "capacity_breach", inApp: true, email: true, sms: false },
      { event: "demand_spike", inApp: true, email: true, sms: false },
      // Money sitting still rather than a risk to act on today: the bell is enough.
      { event: "overstock", inApp: true, email: false, sms: false },
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
    alerts: {
      realTimeMonitoring: dbSettings.alerts.realTimeMonitoring,
      types: {
        stockoutRisk: dbSettings.alerts.typeStockoutRisk,
        demandSpike: dbSettings.alerts.typeDemandSpike,
        expiryRisk: dbSettings.alerts.typeExpiryRisk,
        supplierDelay: dbSettings.alerts.typeSupplierDelay,
        capacityBreach: dbSettings.alerts.typeCapacityBreach,
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
    alerts: {
      create: {
        realTimeMonitoring: payload.alerts.realTimeMonitoring,
        typeStockoutRisk: payload.alerts.types.stockoutRisk,
        typeDemandSpike: payload.alerts.types.demandSpike,
        typeExpiryRisk: payload.alerts.types.expiryRisk,
        typeSupplierDelay: payload.alerts.types.supplierDelay,
        typeCapacityBreach: payload.alerts.types.capacityBreach,
        // Still required by the column, but no detector raises a forecast anomaly, so it
        // is written off rather than offered as a toggle that changes nothing.
        typeForecastAnomaly: false,
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
  };
};


/**
 * Only the blocks something reads.
 *
 * `ForecastSettings`, `InventorySettings`, `IntegrationSettings` and `SecuritySettings`
 * are still declared in the schema but are no longer created, fetched or exposed. Every
 * field in them was written on save and then consulted by nothing - no detector, no
 * formatter, no view - so the controls above them promised behaviour that did not exist.
 * A "Sync Frequency" nothing schedules on and a 2FA toggle nothing enforces are worse
 * than absent settings, because they read as configuration that has taken effect.
 */
const include = {
  general: true,
  alerts: true,
  notifications: { include: { rules: true } },
  ai: true,
} as const;

/**
 * Recursively merges a patch into the current settings.
 *
 * A shallow spread was wrong in a way that lost data quietly: PATCH with
 * `{ general: { theme: "dark" } }` replaced the whole `general` block, wiping every
 * other field in it. Arrays are replaced rather than merged - a notification rule
 * list is a whole value, and merging two lists by index means nothing.
 */
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const deepMerge = <T>(base: T, patch: unknown): T => {
  if (!isPlainObject(base) || !isPlainObject(patch)) return (patch === undefined ? base : patch) as T;

  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    merged[key] = isPlainObject(value) ? deepMerge(merged[key], value) : value;
  }
  return merged as T;
};

const loadRow = () => prisma.systemSettings.findFirst({ include });

/** Reads the settings, seeding the defaults on first use. */
export const getSettings = async () => {
  const existing = await loadRow();
  if (existing) return mapPrismaToFrontend(existing);

  const created = await prisma.systemSettings.create({
    data: mapFrontendToPrismaCreate(DEFAULT_SETTINGS),
    include,
  });
  return mapPrismaToFrontend(created);
};

/**
 * Replaces the configuration tree with the current one deep-merged with `patch`.
 *
 * The whole tree is rewritten because the shape is four related tables and a
 * partial update across them would need four upserts plus child reconciliation.
 * The delete and the create run **in one transaction**: they used to be two awaits,
 * so a failure between them left the system with no settings at all and no way back.
 */
export const updateSettings = async (patch: unknown) => {
  const current = await loadRow();
  const merged = deepMerge(current ? mapPrismaToFrontend(current) : DEFAULT_SETTINGS, patch);

  const created = await prisma.$transaction(async (tx) => {
    if (current) await tx.systemSettings.delete({ where: { id: current.id } });
    return tx.systemSettings.create({ data: mapFrontendToPrismaCreate(merged), include });
  });

  return mapPrismaToFrontend(created);
};

export const resetSettings = async () => {
  const current = await loadRow();

  const created = await prisma.$transaction(async (tx) => {
    if (current) await tx.systemSettings.delete({ where: { id: current.id } });
    return tx.systemSettings.create({ data: mapFrontendToPrismaCreate(DEFAULT_SETTINGS), include });
  });

  return mapPrismaToFrontend(created);
};
