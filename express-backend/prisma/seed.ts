import { prisma } from "../src/config/prisma.js";
import bcrypt from "bcryptjs";
import type { Criticality, WarehouseTier } from "../generated/prisma/enums.js";
import { createRng, between as betweenOf, intBetween as intBetweenOf } from "../src/utils/random.js";
import { refreshAlerts } from "../src/services/alert-detector.service.js";

const SEED = 0x2f6e2b1;

const rng = createRng(SEED);
const between = (min: number, max: number) => betweenOf(rng, min, max);
const intBetween = (min: number, max: number) => intBetweenOf(rng, min, max);

/**
 * Four months, ending today.
 *
 * Enough for the model: 120 dates split 80/20 gives 96 training days over 160 series
 * (~15,400 rows) and three `TimeSeriesSplit` folds, comfortably past every guard in
 * `training_core.py`.
 *
 * Not enough for annual seasonality, and that shapes the generator below. The feature
 * set includes `month`, `quarter` and `doy_sin/cos`, but four months spans four values
 * of `month` and a September forecast asks for one never seen in training. So the
 * surge is deliberately built where the model *can* learn it - in the lags and rolling
 * means, and in the regional signal, which is the only exogenous input published for
 * future dates.
 */
const HISTORY_DAYS = 120;
const startOfDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const TODAY = startOfDay(new Date());
const dayOffset = (days: number) => new Date(TODAY.getTime() + days * 86_400_000);

const chunked = async <T>(rows: T[], size: number, insert: (batch: T[]) => Promise<unknown>) => {
  for (let index = 0; index < rows.length; index += size) {
    await insert(rows.slice(index, index + size));
  }
};

/**
 * Two metros carrying the network and two Tier-2 DCs that starve first - the brief's
 * failure mode, expressed in the network itself rather than bolted on afterwards.
 *
 * `region` is load-bearing, not decoration: `DemandSignal` is keyed by region
 * (`training.service.ts`), so Delhi and Lucknow share North and a surge that hits one
 * hits the other. That is what makes a regional signal worth having at all.
 */
const WAREHOUSES = [
  { code: "DC-01", name: "Delhi NCR Hub", region: "North", tier: "METRO", location: "Delhi NCR", capacity: 600_000 },
  { code: "DC-02", name: "Mumbai West Hub", region: "West", tier: "METRO", location: "Mumbai, MH", capacity: 550_000 },
  { code: "DC-03", name: "Nagpur Regional", region: "Central", tier: "TIER_2", location: "Nagpur, MH", capacity: 220_000 },
  { code: "DC-04", name: "Lucknow Regional", region: "North", tier: "TIER_2", location: "Lucknow, UP", capacity: 180_000 },
] as const satisfies readonly { code: string; name: string; region: string; tier: WarehouseTier; location: string; capacity: number }[];

type ProductSeed = {
  sku: string;
  name: string;
  category: string;
  unitCost: number;
  shelfLifeDays: number;
  criticality: Criticality;
};

const PRODUCTS: ProductSeed[] = [
  { sku: "SKU-AMX-500", name: "Amoxicillin 500mg Capsules", category: "Antibiotics", unitCost: 0.15, shelfLifeDays: 730, criticality: "HIGH" },
  { sku: "SKU-IBU-400", name: "Ibuprofen 400mg Tablets", category: "Analgesics", unitCost: 0.08, shelfLifeDays: 900, criticality: "MEDIUM" },
  { sku: "SKU-LIS-10", name: "Lisinopril 10mg Tablets", category: "Cardiovascular", unitCost: 0.22, shelfLifeDays: 730, criticality: "CRITICAL" },
  { sku: "SKU-ATO-20", name: "Atorvastatin 20mg Tablets", category: "Cardiovascular", unitCost: 0.18, shelfLifeDays: 730, criticality: "HIGH" },
  { sku: "SKU-MET-500", name: "Metformin 500mg Tablets", category: "Antidiabetics", unitCost: 0.05, shelfLifeDays: 1095, criticality: "CRITICAL" },
  { sku: "SKU-SAL-INH", name: "Salbutamol 100mcg Inhaler", category: "Respiratory", unitCost: 3.5, shelfLifeDays: 540, criticality: "CRITICAL" },
  { sku: "SKU-OME-20", name: "Omeprazole 20mg Capsules", category: "Gastrointestinal", unitCost: 0.12, shelfLifeDays: 540, criticality: "HIGH" },
  { sku: "SKU-AML-05", name: "Amlodipine 5mg Tablets", category: "Cardiovascular", unitCost: 0.09, shelfLifeDays: 730, criticality: "HIGH" },
  { sku: "SKU-AZI-250", name: "Azithromycin 250mg Tablets", category: "Antibiotics", unitCost: 0.45, shelfLifeDays: 540, criticality: "HIGH" },
  { sku: "SKU-CET-10", name: "Cetirizine 10mg Tablets", category: "Antihistamines", unitCost: 0.06, shelfLifeDays: 1095, criticality: "LOW" },
  { sku: "SKU-DXM-30", name: "Dextromethorphan 30mg Syrup", category: "Respiratory", unitCost: 1.2, shelfLifeDays: 365, criticality: "MEDIUM" },
  { sku: "SKU-PRD-20", name: "Prednisone 20mg Tablets", category: "Anti-inflammatory", unitCost: 0.14, shelfLifeDays: 730, criticality: "HIGH" },
  { sku: "SKU-CIP-500", name: "Ciprofloxacin 500mg Tablets", category: "Antibiotics", unitCost: 0.32, shelfLifeDays: 730, criticality: "HIGH" },
  { sku: "SKU-DOX-100", name: "Doxycycline 100mg Capsules", category: "Antibiotics", unitCost: 0.28, shelfLifeDays: 730, criticality: "MEDIUM" },
  { sku: "SKU-CEF-250", name: "Cefuroxime 250mg Tablets", category: "Antibiotics", unitCost: 0.62, shelfLifeDays: 540, criticality: "HIGH" },
  { sku: "SKU-PAR-650", name: "Paracetamol 650mg Tablets", category: "Analgesics", unitCost: 0.04, shelfLifeDays: 1095, criticality: "MEDIUM" },
  { sku: "SKU-NAP-250", name: "Naproxen 250mg Tablets", category: "Analgesics", unitCost: 0.11, shelfLifeDays: 900, criticality: "LOW" },
  { sku: "SKU-TRA-50", name: "Tramadol 50mg Capsules", category: "Analgesics", unitCost: 0.19, shelfLifeDays: 730, criticality: "MEDIUM" },
  { sku: "SKU-MET-25", name: "Metoprolol 25mg Tablets", category: "Cardiovascular", unitCost: 0.07, shelfLifeDays: 730, criticality: "CRITICAL" },
  { sku: "SKU-CLO-75", name: "Clopidogrel 75mg Tablets", category: "Cardiovascular", unitCost: 0.38, shelfLifeDays: 730, criticality: "CRITICAL" },
  { sku: "SKU-WAR-05", name: "Warfarin 5mg Tablets", category: "Cardiovascular", unitCost: 0.13, shelfLifeDays: 730, criticality: "CRITICAL" },
  { sku: "SKU-ROS-10", name: "Rosuvastatin 10mg Tablets", category: "Cardiovascular", unitCost: 0.29, shelfLifeDays: 730, criticality: "HIGH" },
  { sku: "SKU-GLI-05", name: "Glimepiride 2mg Tablets", category: "Antidiabetics", unitCost: 0.08, shelfLifeDays: 730, criticality: "HIGH" },
  { sku: "SKU-INS-100", name: "Insulin Glargine 100IU Pen", category: "Antidiabetics", unitCost: 12.4, shelfLifeDays: 365, criticality: "CRITICAL" },
  { sku: "SKU-SIT-100", name: "Sitagliptin 100mg Tablets", category: "Antidiabetics", unitCost: 1.05, shelfLifeDays: 730, criticality: "HIGH" },
  { sku: "SKU-BUD-200", name: "Budesonide 200mcg Inhaler", category: "Respiratory", unitCost: 4.2, shelfLifeDays: 540, criticality: "CRITICAL" },
  { sku: "SKU-MON-10", name: "Montelukast 10mg Tablets", category: "Respiratory", unitCost: 0.24, shelfLifeDays: 730, criticality: "MEDIUM" },
  { sku: "SKU-IPR-NEB", name: "Ipratropium Nebuliser Solution", category: "Respiratory", unitCost: 1.85, shelfLifeDays: 365, criticality: "HIGH" },
  { sku: "SKU-PAN-40", name: "Pantoprazole 40mg Tablets", category: "Gastrointestinal", unitCost: 0.16, shelfLifeDays: 540, criticality: "MEDIUM" },
  { sku: "SKU-OND-04", name: "Ondansetron 4mg Tablets", category: "Gastrointestinal", unitCost: 0.35, shelfLifeDays: 730, criticality: "HIGH" },
  { sku: "SKU-LOP-02", name: "Loperamide 2mg Capsules", category: "Gastrointestinal", unitCost: 0.05, shelfLifeDays: 1095, criticality: "LOW" },
  // Replaces ranitidine, withdrawn worldwide in 2020 over NDMA contamination and so
  // out of place in a 2026 catalogue. ORS is also the single most-moved line of an
  // Indian monsoon, which the old list had no representation for at all.
  { sku: "SKU-ORS-21", name: "ORS Rehydration Sachets 21g", category: "Gastrointestinal", unitCost: 0.09, shelfLifeDays: 1095, criticality: "HIGH" },
  { sku: "SKU-LOR-10", name: "Loratadine 10mg Tablets", category: "Antihistamines", unitCost: 0.05, shelfLifeDays: 1095, criticality: "LOW" },
  { sku: "SKU-FEX-180", name: "Fexofenadine 180mg Tablets", category: "Antihistamines", unitCost: 0.14, shelfLifeDays: 900, criticality: "LOW" },
  { sku: "SKU-CHL-04", name: "Chlorpheniramine 4mg Tablets", category: "Antihistamines", unitCost: 0.03, shelfLifeDays: 1095, criticality: "LOW" },
  { sku: "SKU-DEX-05", name: "Dexamethasone 0.5mg Tablets", category: "Anti-inflammatory", unitCost: 0.09, shelfLifeDays: 730, criticality: "HIGH" },
  { sku: "SKU-HYD-100", name: "Hydrocortisone 100mg Injection", category: "Anti-inflammatory", unitCost: 2.75, shelfLifeDays: 540, criticality: "CRITICAL" },
  { sku: "SKU-DIC-50", name: "Diclofenac 50mg Tablets", category: "Anti-inflammatory", unitCost: 0.06, shelfLifeDays: 900, criticality: "MEDIUM" },
  { sku: "SKU-MEL-15", name: "Meloxicam 15mg Tablets", category: "Anti-inflammatory", unitCost: 0.12, shelfLifeDays: 730, criticality: "LOW" },
  { sku: "SKU-OSE-75", name: "Oseltamivir 75mg Capsules", category: "Antibiotics", unitCost: 2.1, shelfLifeDays: 540, criticality: "CRITICAL" },
];

/**
 * The three demand cohorts an Indian monsoon actually moves.
 *
 * India's influenza-like-illness season *is* the monsoon, not the northern-hemisphere
 * winter the previous curve modelled - which mattered, because that curve put its
 * annual minimum across exactly the window this dataset covers, leaving the brief's
 * surge absent from the data the model trains on.
 */
const ILI_COHORT = new Set([
  "SKU-OSE-75", "SKU-SAL-INH", "SKU-BUD-200", "SKU-DXM-30", "SKU-PAR-650",
  "SKU-AMX-500", "SKU-AZI-250", "SKU-IPR-NEB", "SKU-CET-10", "SKU-CHL-04",
  "SKU-MON-10",
]);

/** Waterborne and vector-borne illness - the other half of a monsoon. */
const GI_COHORT = new Set([
  "SKU-ORS-21", "SKU-LOP-02", "SKU-CIP-500", "SKU-DOX-100", "SKU-OND-04", "SKU-PAN-40",
]);

/** Pre-monsoon heat: dehydration and heatstroke through April and May. */
const HEAT_COHORT = new Set(["SKU-ORS-21", "SKU-PAR-650", "SKU-OND-04"]);

/**
 * Monsoon onset and ILI peak, as day offsets from today.
 *
 * The rains cross India from the south-west, so the surge arrives in waves rather
 * than everywhere at once - which gives the model four series-groups that peak on
 * different dates instead of one synchronised bump it could fit with a date alone.
 */
const MONSOON: Record<string, { onset: number; peak: number }> = {
  West: { onset: -78, peak: -17 },     // Mumbai   ~10 Jun -> ~10 Aug
  Central: { onset: -68, peak: -12 },  // Nagpur   ~20 Jun -> ~15 Aug
  North: { onset: -60, peak: -7 },     // Delhi/Lucknow ~28 Jun -> ~20 Aug
};

/** 0 before the rains, ramping to 1 at peak, easing slowly after. */
const monsoonIntensity = (region: string | null, offset: number): number => {
  const phase = MONSOON[region ?? "North"] ?? MONSOON.North!;
  if (offset < phase.onset) return 0;
  if (offset <= phase.peak) return (offset - phase.onset) / (phase.peak - phase.onset);
  return Math.max(0.7, 1 - (offset - phase.peak) / 45);
};

/** Peaks in mid-May and is gone once the rains arrive. */
const heatIntensity = (offset: number): number =>
  offset > -78 ? 0 : Math.max(0, 1 - Math.abs(offset + 105) / 32);

/**
 * Discrete outbreaks, on top of the seasonal ramp.
 *
 * Without these the regional signal is worthless to the model, and measurably so: a
 * smooth monotonic ramp is already encoded perfectly by `demand_lag_7`, so the signal
 * is collinear with the lags and XGBoost ignores it — it ranked 41st of 83 features.
 * That matters because `demand_signal_value` is the *only* exogenous input available
 * for a future date. If it carries nothing, a real forecast is just the model
 * extrapolating its own history.
 *
 * Outbreaks are what make surveillance data worth having. A cholera cluster or a
 * dengue wave is lumpy and local, case counts move days before dispensing does, and
 * no lag can anticipate it. Each entry below spikes the regional signal and pulls the
 * matching cohort's demand up a few days later.
 */
interface Outbreak {
  region: string;
  /** Day offset where reported cases start climbing. */
  start: number;
  durationDays: number;
  /** Peak demand uplift for the affected cohort. */
  magnitude: number;
  cohort: "ILI" | "GI";
}

const OUTBREAKS: Outbreak[] = [
  { region: "West", start: -71, durationDays: 12, magnitude: 0.5, cohort: "GI" },
  { region: "Central", start: -55, durationDays: 10, magnitude: 0.65, cohort: "GI" },
  { region: "North", start: -40, durationDays: 14, magnitude: 0.55, cohort: "ILI" },
  { region: "West", start: -27, durationDays: 9, magnitude: 0.45, cohort: "ILI" },
  { region: "North", start: -9, durationDays: 11, magnitude: 0.6, cohort: "GI" },
];

/** A triangular pulse: cases climb to the midpoint, then fall away. */
const outbreakIntensity = (region: string | null, offset: number, cohort: "ILI" | "GI"): number => {
  let peak = 0;
  for (const event of OUTBREAKS) {
    if (event.region !== (region ?? "North") || event.cohort !== cohort) continue;
    const end = event.start + event.durationDays;
    if (offset < event.start || offset > end) continue;
    const mid = event.start + event.durationDays / 2;
    const shape = 1 - Math.abs(offset - mid) / (event.durationDays / 2);
    peak = Math.max(peak, shape * event.magnitude);
  }
  return peak;
};

/**
 * How much a SKU moves with the season.
 *
 * The ILI cohort reaches +60% at peak, which is the figure the brief names.
 */
const seasonalMultiplier = (sku: string, region: string | null, offset: number): number => {
  const monsoon = monsoonIntensity(region, offset);
  const heat = heatIntensity(offset);

  const seasonal = ILI_COHORT.has(sku)
    ? 1 + 0.6 * monsoon
    : GI_COHORT.has(sku)
      ? 1 + 0.45 * monsoon
      : 1 + 0.1 * monsoon;

  // The outbreak arrives in demand after it appears in the case counts, which is the
  // lead the signal is published on.
  const outbreak = ILI_COHORT.has(sku)
    ? outbreakIntensity(region, offset - SIGNAL_LEAD_DAYS, "ILI")
    : GI_COHORT.has(sku)
      ? outbreakIntensity(region, offset - SIGNAL_LEAD_DAYS, "GI")
      : 0;

  return seasonal * (1 + outbreak) * (HEAT_COHORT.has(sku) ? 1 + 0.25 * heat : 1);
};

/**
 * How far the surveillance signal runs ahead of dispensing.
 *
 * Reported cases genuinely lead prescriptions: someone is counted when they present,
 * and dispensed for over the following days. Four days is the whole reason the signal
 * is usable at forecast time.
 */
const SIGNAL_LEAD_DAYS = 4;

const weekdayMultiplier = (date: Date) => ([0.55, 1.15, 1.1, 1.05, 1.05, 1.1, 0.6][date.getUTCDay()] ?? 1);

/** Keeps two DCs of the same tier from being numerically identical series. */
const warehouseScale = (code: string): number =>
  ({ "DC-01": 1.08, "DC-02": 0.94, "DC-03": 1.05, "DC-04": 0.92 })[code] ?? 1;

/**
 * Indian public holidays inside the window, as day offsets from today.
 *
 * Dispensing dips on a public holiday and recovers the next day. Worth having because
 * `holiday_flag` travels on every exported row - a column that never varies teaches
 * the model nothing.
 */
const HOLIDAYS = new Set([
  -119, // 1 May, Maharashtra Day
  -60,  // 28 Jun (regional)
  -42,  // 16 Jul, Muharram
  -12,  // 15 Aug, Independence Day
  -1,   // 26 Aug, Janmashtami
]);
const isHoliday = (offset: number) => HOLIDAYS.has(offset);

/**
 * Campaigns, defined once.
 *
 * The same list drives `promotionFlag` on the demand rows and the `PromotionEvent`
 * rows the exporter joins against, so the flag a model trains on and the uplift the
 * planner reads describe the same campaign. Two separate lists would drift.
 */
interface Campaign {
  name: string;
  type: "PROMOTION" | "SEASONAL" | "HOLIDAY" | "CAMPAIGN";
  skus: string[] | null;
  warehouseCodes: string[] | null;
  from: number;
  to: number;
  uplift: number;
}

const CAMPAIGNS: Campaign[] = [
  {
    name: "Monsoon Preparedness Drive",
    type: "SEASONAL",
    skus: ["SKU-ORS-21", "SKU-PAR-650", "SKU-LOP-02"],
    warehouseCodes: null,
    from: -74,
    to: -46,
    uplift: 1.45,
  },
  {
    name: "Respiratory Care Campaign",
    type: "CAMPAIGN",
    skus: ["SKU-SAL-INH", "SKU-BUD-200", "SKU-IPR-NEB"],
    warehouseCodes: ["DC-01", "DC-04"],
    from: -38,
    to: -16,
    uplift: 1.3,
  },
  {
    name: "Chronic Care Adherence Push",
    type: "CAMPAIGN",
    skus: ["SKU-LIS-10", "SKU-MET-500", "SKU-ATO-20"],
    warehouseCodes: ["DC-02"],
    from: -22,
    to: -4,
    uplift: 1.2,
  },
  // Starts after today, so a forecast has a campaign to reason about rather than only
  // history. The exporter publishes forward-dated promotions for exactly this.
  {
    name: "Post-Monsoon Antibiotic Stewardship",
    type: "PROMOTION",
    skus: ["SKU-AMX-500", "SKU-AZI-250"],
    warehouseCodes: null,
    from: 5,
    to: 26,
    uplift: 1.25,
  },
];

const promotionActive = (sku: string, warehouseCode: string, offset: number): boolean =>
  CAMPAIGNS.some(
    (campaign) =>
      offset >= campaign.from &&
      offset <= campaign.to &&
      (campaign.skus === null || campaign.skus.includes(sku)) &&
      (campaign.warehouseCodes === null || campaign.warehouseCodes.includes(warehouseCode)),
  );

const tierDemandShare: Record<WarehouseTier, number> = {
  METRO: 0.36,
  TIER_1: 0.26,
  TIER_2: 0.22,
  TIER_3: 0.16,
};

/**
 * Everything, in foreign-key-safe order.
 *
 * The alert tables matter more than they used to. `Alert` now carries `productId` and
 * `warehouseId` with `ON DELETE SET NULL`, so deleting warehouses without clearing
 * alerts first does not fail - it quietly nulls the ids and leaves orphan rows naming
 * DCs that no longer exist. A partial wipe is worse than none.
 */
const clear = async () => {
  /**
   * Settings go too, so a reseed re-applies the intended baseline.
   *
   * They are configuration rather than data, but leaving the row behind means a
   * threshold tuned against the *old* dataset silently governs the new one - which is
   * how a stockout threshold of 70 survived long enough to suppress every alert the
   * brief is about. `getSettings()` recreates them from `DEFAULT_SETTINGS` on first
   * read, so this is a reset rather than a hole. Hand-tuning is lost, which is what
   * "delete all existing data" asks for.
   */
  await prisma.notificationRule.deleteMany();
  await prisma.integrationSource.deleteMany();
  await prisma.generalSettings.deleteMany();
  await prisma.forecastSettings.deleteMany();
  await prisma.inventorySettings.deleteMany();
  await prisma.alertSettings.deleteMany();
  await prisma.notificationSettings.deleteMany();
  await prisma.aISettings.deleteMany();
  await prisma.integrationSettings.deleteMany();
  await prisma.securitySettings.deleteMany();
  await prisma.systemSettings.deleteMany();

  await prisma.notificationDelivery.deleteMany();
  await prisma.alertMetric.deleteMany();
  await prisma.alertTimelineEvent.deleteMany();
  await prisma.alert.deleteMany();
  // Phase 3's execution tables. `RestockRequest` holds required FKs to Product and
  // Warehouse, so it has to go before either of them.
  await prisma.restockRequest.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.wastePreventionRecord.deleteMany();
  await prisma.recommendationSignal.deleteMany();
  await prisma.simulationMetric.deleteMany();
  await prisma.scenarioDCImpact.deleteMany();
  await prisma.scenarioSKUImpact.deleteMany();
  await prisma.scenarioRiskIndicator.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.simulationRun.deleteMany();
  await prisma.optimizationResult.deleteMany();
  await prisma.dRPPlan.deleteMany();
  await prisma.supplyPlan.deleteMany();
  await prisma.inventoryPlan.deleteMany();
  await prisma.forecast.deleteMany();
  await prisma.planningRun.deleteMany();
  await prisma.scenario.deleteMany();
  await prisma.distributorOrder.deleteMany();
  await prisma.distributor.deleteMany();
  await prisma.demandSignal.deleteMany();
  await prisma.promotionEvent.deleteMany();
  await prisma.planningParameter.deleteMany();
  await prisma.inventoryBatch.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.demandHistory.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
};

const main = async () => {
  await clear();

  const permissionsData = [
    { key: "dashboard:view", name: "View Dashboard", module: "dashboard", action: "view" },
    { key: "inventory:view", name: "View Inventory", module: "inventory", action: "view" },
    { key: "inventory:adjust", name: "Adjust Inventory", module: "inventory", action: "adjust" },
    { key: "forecast:view", name: "View Forecasts", module: "forecast", action: "view" },
    { key: "recommendations:view", name: "View Recommendations", module: "recommendations", action: "view" },
    { key: "recommendations:execute", name: "Execute Recommendations", module: "recommendations", action: "execute" },
    { key: "recommendations:dismiss", name: "Dismiss Recommendations", module: "recommendations", action: "dismiss" },
    { key: "simulation:view", name: "View Simulations", module: "simulation", action: "view" },
    { key: "simulation:run", name: "Run Simulations", module: "simulation", action: "run" },
    { key: "alerts:view", name: "View Alerts", module: "alerts", action: "view" },
    { key: "alerts:manage", name: "Manage Alerts", module: "alerts", action: "manage" },
    { key: "expiry:view", name: "View Expiry Risks", module: "expiry", action: "view" },
    { key: "settings:view", name: "View Settings", module: "settings", action: "view" },
    { key: "settings:update", name: "Update Settings", module: "settings", action: "update" },
    { key: "users:view", name: "View Users", module: "users", action: "view" },
    { key: "users:create", name: "Create Users", module: "users", action: "create" },
    { key: "users:update", name: "Update Users", module: "users", action: "update" },
    { key: "users:deactivate", name: "Deactivate Users", module: "users", action: "deactivate" },
    { key: "roles:view", name: "View Roles", module: "roles", action: "view" },
    { key: "roles:create", name: "Create Roles", module: "roles", action: "create" },
    { key: "roles:update", name: "Update Roles", module: "roles", action: "update" },
    { key: "roles:delete", name: "Delete Roles", module: "roles", action: "delete" },
  ];

  await prisma.permission.createMany({ data: permissionsData });
  const permissions = await prisma.permission.findMany();

  const adminRole = await prisma.role.create({
    data: { name: "ADMIN", description: "Global Administrator", isSystemRole: true }
  });
  const plannerRole = await prisma.role.create({
    data: { name: "PLANNER", description: "Supply Chain Planner", isSystemRole: true }
  });
  const viewerRole = await prisma.role.create({
    data: { name: "VIEWER", description: "Read-only Viewer", isSystemRole: true }
  });

  const adminPerms = permissions.map(p => ({ roleId: adminRole.id, permissionId: p.id }));
  const plannerPermKeys = new Set(["dashboard:view", "inventory:view", "inventory:adjust", "forecast:view", "recommendations:view", "recommendations:execute", "recommendations:dismiss", "simulation:view", "simulation:run", "alerts:view", "alerts:manage", "expiry:view"]);
  const plannerPerms = permissions.filter(p => plannerPermKeys.has(p.key)).map(p => ({ roleId: plannerRole.id, permissionId: p.id }));
  const viewerPermKeys = new Set(["dashboard:view", "inventory:view", "forecast:view", "recommendations:view", "simulation:view", "alerts:view", "expiry:view"]);
  const viewerPerms = permissions.filter(p => viewerPermKeys.has(p.key)).map(p => ({ roleId: viewerRole.id, permissionId: p.id }));

  await prisma.rolePermission.createMany({ data: [...adminPerms, ...plannerPerms, ...viewerPerms] });

  const defaultPasswordHash = await bcrypt.hash("!", 10);

  const systemUser = await prisma.user.create({
    data: {
      name: "System",
      email: "system@medcare.local",
      passwordHash: defaultPasswordHash,
      roleId: adminRole.id,
      warehouseId: null,
    },
  });

  // A real administrator that can actually be signed in as. The three accounts around
  // it share a placeholder hash of "!", which is fine for an actor id on a row but
  // cannot be typed into the login form.
  await prisma.user.create({
    data: {
      name: "Aniket Jha",
      email: "jhaaniket2005@gmail.com",
      passwordHash: await bcrypt.hash("Anik@1234", 10),
      roleId: adminRole.id,
      // null means network-wide rather than confined to one DC.
      warehouseId: null,
    },
  });

  await prisma.warehouse.createMany({ data: WAREHOUSES.map((warehouse) => ({ ...warehouse })) });

  await prisma.user.create({
    data: {
      name: "DC1 Planner",
      email: "planner@medcare.local",
      passwordHash: defaultPasswordHash,
      roleId: plannerRole.id,
      warehouseId: (await prisma.warehouse.findFirst({ where: { code: "DC-01" } }))?.id || null,
    }
  });

  await prisma.user.create({
    data: {
      name: "DC2 Viewer",
      email: "viewer@medcare.local",
      passwordHash: defaultPasswordHash,
      roleId: viewerRole.id,
      warehouseId: (await prisma.warehouse.findFirst({ where: { code: "DC-02" } }))?.id || null,
    }
  });

  await prisma.scenario.create({
    data: {
      name: "Flu Surge +60%",
      description:
        "Peak flu season. Demand runs 60% above baseline and critical SKUs are held to a 98% service level.",
      demandMultiplier: 1.6,
      serviceLevelTarget: 0.98,
      createdById: systemUser.id,
    },
  });

  await prisma.product.createMany({ data: PRODUCTS });

  const warehouses = await prisma.warehouse.findMany({ orderBy: { code: "asc" } });
  const products = await prisma.product.findMany({ orderBy: { sku: "asc" } });
  const productBySku = new Map(products.map((product) => [product.sku, product]));

  const baselineDemand = new Map<string, number>();
  for (const product of products) {
    baselineDemand.set(product.id, intBetween(40, 320));
  }

  const demandRows: {
    productId: string;
    warehouseId: string;
    date: Date;
    orderedQuantity: number;
    fulfilledQuantity: number;
    stockoutFlag: boolean;
    promotionFlag: boolean;
    holidayFlag: boolean;
    season: string;
  }[] = [];

  for (const product of products) {
    const baseline = baselineDemand.get(product.id) ?? 100;

    for (const warehouse of warehouses) {
      // Tier sets the order of magnitude; the per-DC jitter stops two metros from
      // being numerically identical series, which would teach `dc_id` nothing.
      const share = tierDemandShare[warehouse.tier] * warehouseScale(warehouse.code);
      const region = warehouse.region;

      /**
       * Tier-2 runs thinner cover, so the same surge censors its supply where a metro
       * absorbs it. This is the mechanism behind the brief, not a random sprinkle.
       */
      const isTier2 = warehouse.tier === "TIER_2" || warehouse.tier === "TIER_3";

      for (let offset = -HISTORY_DAYS; offset < 0; offset += 1) {
        const date = dayOffset(offset);
        const seasonal = seasonalMultiplier(product.sku, region, offset);
        const promotionFlag = promotionActive(product.sku, warehouse.code, offset);
        const holidayFlag = isHoliday(offset);

        const ordered = Math.max(
          0,
          Math.round(
            baseline *
              share *
              seasonal *
              weekdayMultiplier(date) *
              (promotionFlag ? between(1.2, 1.5) : 1) *
              (holidayFlag ? 0.7 : 1) *
              between(0.88, 1.12),
          ),
        );

        /**
         * `orderedQuantity` is uncensored demand; `fulfilledQuantity` is what the
         * shelf could actually serve.
         *
         * `project_adapter.py` fits on `orderedQuantity` precisely so a stockout is
         * not taught to the model as a quiet day. The split matters: a Tier-2 DC deep
         * in the surge misses part of its demand, and the *record* of that has to say
         * so rather than simply showing lower sales.
         */
        const monsoon = monsoonIntensity(region, offset);
        const pressure = isTier2 ? 0.05 + 0.35 * monsoon : 0.02 + 0.06 * monsoon;
        const stockoutFlag = rng() < pressure * (ILI_COHORT.has(product.sku) ? 1.6 : 0.7);
        const fulfilled = stockoutFlag ? Math.round(ordered * between(0.45, 0.85)) : ordered;

        demandRows.push({
          productId: product.id,
          warehouseId: warehouse.id,
          date,
          orderedQuantity: ordered,
          fulfilledQuantity: fulfilled,
          stockoutFlag,
          promotionFlag,
          holidayFlag,
          season: monsoon > 0.5 ? "monsoon" : monsoon > 0 ? "monsoon_onset" : "pre_monsoon",
        });
      }
    }
  }

  await chunked(demandRows, 5_000, (batch) => prisma.demandHistory.createMany({ data: batch }));

  const averageDailyDemand = new Map<string, number>();
  for (const row of demandRows) {
    const key = `${row.productId}:${row.warehouseId}`;
    averageDailyDemand.set(key, (averageDailyDemand.get(key) ?? 0) + row.orderedQuantity / HISTORY_DAYS);
  }

  const inventoryRows: { productId: string; warehouseId: string; onHand: number; reserved: number; inTransit: number }[] = [];
  const batchRows: {
    productId: string;
    warehouseId: string;
    batchNumber: string;
    quantity: number;
    manufacturingDate: Date;
    expiryDate: Date;
  }[] = [];
  const parameterRows: {
    productId: string;
    warehouseId: string;
    leadTimeDays: number;
    leadTimeStdDev: number;
    serviceLevel: number;
    reviewPeriodDays: number;
    minimumOrderQty: number;
    maximumInventory: number;
    holdingCostPerUnit: number;
    stockoutCostPerUnit: number;
    expiryCostPerUnit: number;
  }[] = [];

  for (const product of products) {
    const unitCost = Number(product.unitCost);

    for (const warehouse of warehouses) {
      const key = `${product.id}:${warehouse.id}`;
      const daily = Math.max(1, averageDailyDemand.get(key) ?? 1);
      const isMetro = warehouse.tier === "METRO";
      const isIli = ILI_COHORT.has(product.sku);

      /**
       * Lead time is *why* a Tier-2 DC starves first.
       *
       * A metro sits near its suppliers and reorders in under a week; a Tier-2 DC
       * waits twice as long with twice the variance, so the same surge empties it
       * before a replenishment can land. The mechanism, not a coincidence.
       */
      const leadTimeDays = isMetro ? intBetween(3, 7) : intBetween(8, 16);

      /**
       * Cover, by the story rather than by a coin flip.
       *
       * The previous version drew metro cover from 40-110 days against a maximum of
       * 60, so most metro positions were over their ceiling and `overstock` accounted
       * for 58 of 128 alerts. Here the excess is concentrated where the brief puts it:
       * metros holding ILI stock they cannot turn over, Tier-2 DCs running on fumes
       * through exactly the cohort the monsoon is about to hit.
       */
      const coverageDays = isMetro
        ? isIli
          ? between(45, 75)
          : between(25, 45)
        : isIli
          ? between(4, 12)
          : between(15, 30);

      const onHand = Math.round(daily * coverageDays);

      inventoryRows.push({
        productId: product.id,
        warehouseId: warehouse.id,
        onHand,
        reserved: Math.round(onHand * between(0, 0.08)),
        inTransit: rng() < 0.3 ? Math.round(daily * between(5, 20)) : 0,
      });

      parameterRows.push({
        productId: product.id,
        warehouseId: warehouse.id,
        leadTimeDays,
        // Tier-2 lead times are not just longer, they are less reliable - which is
        // what drives the safety stock the planner computes for those positions up.
        leadTimeStdDev: Number((leadTimeDays * (isMetro ? between(0.1, 0.2) : between(0.25, 0.4))).toFixed(2)),
        serviceLevel: product.criticality === "CRITICAL" ? 0.98 : product.criticality === "HIGH" ? 0.96 : 0.95,
        reviewPeriodDays: 7,
        minimumOrderQty: Math.round(daily * 5),
        // A ceiling each position is actually run to, rather than one flat number the
        // metros were always going to breach. Overstock now means genuine excess.
        maximumInventory: Math.round(daily * (isMetro ? 70 : 40)),
        holdingCostPerUnit: Number((unitCost * 0.0025).toFixed(4)),
        stockoutCostPerUnit: Number((unitCost * 6).toFixed(4)),
        expiryCostPerUnit: Number(unitCost.toFixed(4)),
      });

      const batchCount = intBetween(1, 3);
      let remaining = onHand;

      for (let index = 0; index < batchCount; index += 1) {
        const isLast = index === batchCount - 1;
        const quantity = isLast ? remaining : Math.round(remaining * between(0.3, 0.6));
        remaining -= quantity;
        if (quantity <= 0) continue;

        /**
         * The write-off risk sits in the metros, which is where the brief puts it.
         *
         * A metro holding 45-75 days of an ILI line it cannot turn over accumulates a
         * near-expiry tail; a Tier-2 DC running four days of cover simply never holds
         * stock long enough to age. Drawing the same ladder everywhere spread expiry
         * risk uniformly and lost the point.
         */
        const nearExpiryProne = isMetro && isIli;
        const draw = rng();
        const daysToExpiry = nearExpiryProne
          ? draw < 0.3
            ? intBetween(10, 60)
            : draw < 0.6
              ? intBetween(61, 120)
              : intBetween(121, product.shelfLifeDays ?? 500)
          : draw < 0.06
            ? intBetween(20, 60)
            : draw < 0.2
              ? intBetween(61, 120)
              : intBetween(121, product.shelfLifeDays ?? 500);

        const expiryDate = dayOffset(daysToExpiry);

        batchRows.push({
          productId: product.id,
          warehouseId: warehouse.id,
          batchNumber: `B-${product.sku.split("-")[1] ?? "GEN"}-${warehouse.code.slice(-2)}${index + 1}`,
          quantity,
          manufacturingDate: new Date(expiryDate.getTime() - (product.shelfLifeDays ?? 500) * 86_400_000),
          expiryDate,
        });
      }
    }
  }

  await chunked(inventoryRows, 5_000, (batch) => prisma.inventory.createMany({ data: batch }));
  await chunked(parameterRows, 5_000, (batch) => prisma.planningParameter.createMany({ data: batch }));
  await chunked(batchRows, 5_000, (batch) => prisma.inventoryBatch.createMany({ data: batch }));

  /**
   * The same `CAMPAIGNS` that set `promotionFlag` on the demand rows above.
   *
   * A campaign covering several SKUs becomes one row per SKU, because `PromotionEvent`
   * carries a single nullable `productId`. A campaign with no SKU list stays null,
   * which the exporter reads as "applies to everything".
   */
  const warehouseByCode = new Map(warehouses.map((warehouse) => [warehouse.code, warehouse]));

  await prisma.promotionEvent.createMany({
    data: CAMPAIGNS.flatMap((campaign) => {
      const skuIds = campaign.skus === null ? [null] : campaign.skus.map((sku) => productBySku.get(sku)?.id ?? null);
      const warehouseIds =
        campaign.warehouseCodes === null
          ? [null]
          : campaign.warehouseCodes.map((code) => warehouseByCode.get(code)?.id ?? null);

      return skuIds.flatMap((productId) =>
        warehouseIds.map((warehouseId) => ({
          name: campaign.name,
          type: campaign.type,
          productId,
          warehouseId,
          startDate: dayOffset(campaign.from),
          endDate: dayOffset(campaign.to),
          upliftFactor: campaign.uplift,
        })),
      );
    }),
  });

  /**
   * The regional ILI signal - the one exogenous feature the model has for a future
   * date, so it is generated per region and published 30 days past today.
   *
   * It **leads demand by four days**. That lead is the entire point: a signal that
   * merely echoed the same day's demand would be unusable at forecast time, and the
   * model would fall back on extrapolating its own lags. Reported cases also lag
   * infection in reality, so a surveillance series genuinely does turn before
   * dispensing does.
   *
   * One row per region, not per warehouse: Delhi and Lucknow share North, and two rows
   * for the same region and day would leave the exporter picking arbitrarily.
   */
  const regions = [...new Set(warehouses.map((warehouse) => warehouse.region ?? "Unknown"))];
  const signalRows: { productId: string | null; region: string; date: Date; signalType: string; value: number }[] = [];

  for (const region of regions) {
    for (let offset = -HISTORY_DAYS; offset <= 30; offset += 1) {
      // Read at the lead: what the counts say today is what demand does in four days.
      const seasonal = monsoonIntensity(region, offset + SIGNAL_LEAD_DAYS);
      const outbreak =
        outbreakIntensity(region, offset, "ILI") + outbreakIntensity(region, offset, "GI");

      signalRows.push({
        productId: null,
        region,
        date: dayOffset(offset),
        signalType: "ili_cases_per_100k",
        // A believable surveillance range: a quiet baseline that climbs roughly
        // fourfold across the season, with outbreak clusters on top of it.
        value: Number((14 + 46 * seasonal + 55 * outbreak + between(-2.5, 2.5)).toFixed(2)),
      });
    }
  }
  await chunked(signalRows, 5_000, (batch) => prisma.demandSignal.createMany({ data: batch }));

  await prisma.distributor.createMany({
    data: warehouses.flatMap((warehouse, index) => [
      {
        code: `DST-${String(index * 2 + 1).padStart(3, "0")}`,
        name: `${warehouse.region} Hospital Group`,
        region: warehouse.region,
        warehouseId: warehouse.id,
      },
      {
        code: `DST-${String(index * 2 + 2).padStart(3, "0")}`,
        name: `${warehouse.region} Retail Pharmacy Network`,
        region: warehouse.region,
        warehouseId: warehouse.id,
      },
    ]),
  });

  const distributors = await prisma.distributor.findMany();
  const orderedProducts = products.slice(0, 12);
  const orderRows: {
    distributorId: string;
    productId: string;
    warehouseId: string;
    orderDate: Date;
    requestedDate: Date;
    quantity: number;
    fulfilledQuantity: number;
  }[] = [];

  /**
   * One named supplier is in trouble; the rest are fine.
   *
   * Every historical order used to arrive 70-100% fulfilled, which made *every* pair
   * look chronically short and turned `supplier_delay` into 48 alerts of pure noise.
   * A real escalation has a subject: one distributor, one region, a backlog you can
   * point at. Everyone else delivers in full.
   */
  const troubledDistributor = distributors.find((row) => row.code === "DST-001") ?? distributors[0];

  for (const distributor of distributors) {
    if (!distributor.warehouseId) continue;
    const isTroubled = distributor.id === troubledDistributor?.id;
    const warehouse = warehouses.find((row) => row.id === distributor.warehouseId);

    for (const product of orderedProducts) {
      for (let offset = -90; offset < 0; offset += 7) {
        const orderDate = dayOffset(offset + intBetween(0, 2));
        const quantity = Math.round(
          (baselineDemand.get(product.id) ?? 100) *
            between(1.5, 4.5) *
            seasonalMultiplier(product.sku, warehouse?.region ?? null, offset),
        );

        // A healthy supplier is complete and roughly on time. The troubled one is
        // short and slipping, and its recent orders are still open - which is what
        // puts it inside the detector's window instead of in ancient history.
        const leadDays = isTroubled ? intBetween(9, 16) : intBetween(3, 8);
        const fulfilled = isTroubled
          ? Math.round(quantity * between(0.35, 0.75))
          : rng() < 0.06
            ? Math.round(quantity * between(0.8, 0.97))
            : quantity;

        orderRows.push({
          distributorId: distributor.id,
          productId: product.id,
          warehouseId: distributor.warehouseId,
          orderDate,
          requestedDate: new Date(orderDate.getTime() + leadDays * 86_400_000),
          quantity,
          fulfilledQuantity: fulfilled,
        });
      }
    }
  }
  await chunked(orderRows, 5_000, (batch) => prisma.distributorOrder.createMany({ data: batch }));

  /**
   * Alerts are derived, never seeded as literals - they have to agree with the
   * positions above or the review surface contradicts the dashboard reading the same
   * rows. Running detection here is what gives a fresh database a populated bell
   * without first requiring a planning run, which is how it used to come up empty.
   */
  const detection = await refreshAlerts();

  const counts = {
    warehouses: warehouses.length,
    products: products.length,
    demandHistory: demandRows.length,
    inventory: inventoryRows.length,
    batches: batchRows.length,
    planningParameters: parameterRows.length,
    demandSignals: signalRows.length,
    distributors: distributors.length,
    distributorOrders: orderRows.length,
    alerts: detection.created,
  };

  console.log("seed complete", counts);
};

main()
  .catch((error) => {
    console.error("seed failed", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
