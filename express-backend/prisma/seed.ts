import { prisma } from "../src/config/prisma.js";
import type { Criticality, WarehouseTier } from "../generated/prisma/enums.js";
import { createRng, between as betweenOf, intBetween as intBetweenOf } from "../src/utils/random.js";

const SEED = 0x2f6e2b1;

const rng = createRng(SEED);
const between = (min: number, max: number) => betweenOf(rng, min, max);
const intBetween = (min: number, max: number) => intBetweenOf(rng, min, max);

const HISTORY_DAYS = 180;
const startOfDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const TODAY = startOfDay(new Date());
const dayOffset = (days: number) => new Date(TODAY.getTime() + days * 86_400_000);

const chunked = async <T>(rows: T[], size: number, insert: (batch: T[]) => Promise<unknown>) => {
  for (let index = 0; index < rows.length; index += size) {
    await insert(rows.slice(index, index + size));
  }
};

const WAREHOUSES = [
  { code: "DC-01", name: "Northeast DC", region: "Northeast", tier: "METRO", location: "Boston, MA", capacity: 500_000 },
  { code: "DC-02", name: "South DC", region: "South", tier: "TIER_1", location: "Atlanta, GA", capacity: 350_000 },
  { code: "DC-03", name: "West Coast DC", region: "West", tier: "METRO", location: "Oakland, CA", capacity: 600_000 },
  { code: "DC-04", name: "Midwest DC", region: "Midwest", tier: "TIER_2", location: "Columbus, OH", capacity: 250_000 },
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
  { sku: "SKU-RAN-150", name: "Ranitidine 150mg Tablets", category: "Gastrointestinal", unitCost: 0.07, shelfLifeDays: 730, criticality: "LOW" },
  { sku: "SKU-LOR-10", name: "Loratadine 10mg Tablets", category: "Antihistamines", unitCost: 0.05, shelfLifeDays: 1095, criticality: "LOW" },
  { sku: "SKU-FEX-180", name: "Fexofenadine 180mg Tablets", category: "Antihistamines", unitCost: 0.14, shelfLifeDays: 900, criticality: "LOW" },
  { sku: "SKU-CHL-04", name: "Chlorpheniramine 4mg Tablets", category: "Antihistamines", unitCost: 0.03, shelfLifeDays: 1095, criticality: "LOW" },
  { sku: "SKU-DEX-05", name: "Dexamethasone 0.5mg Tablets", category: "Anti-inflammatory", unitCost: 0.09, shelfLifeDays: 730, criticality: "HIGH" },
  { sku: "SKU-HYD-100", name: "Hydrocortisone 100mg Injection", category: "Anti-inflammatory", unitCost: 2.75, shelfLifeDays: 540, criticality: "CRITICAL" },
  { sku: "SKU-DIC-50", name: "Diclofenac 50mg Tablets", category: "Anti-inflammatory", unitCost: 0.06, shelfLifeDays: 900, criticality: "MEDIUM" },
  { sku: "SKU-MEL-15", name: "Meloxicam 15mg Tablets", category: "Anti-inflammatory", unitCost: 0.12, shelfLifeDays: 730, criticality: "LOW" },
  { sku: "SKU-OSE-75", name: "Oseltamivir 75mg Capsules", category: "Antibiotics", unitCost: 2.1, shelfLifeDays: 540, criticality: "CRITICAL" },
];

const FLU_SENSITIVE = new Set([
  "SKU-OSE-75", "SKU-SAL-INH", "SKU-BUD-200", "SKU-DXM-30", "SKU-PAR-650",
  "SKU-AMX-500", "SKU-AZI-250", "SKU-IPR-NEB", "SKU-CET-10", "SKU-CHL-04",
]);

const seasonalMultiplier = (date: Date, fluSensitive: boolean) => {
  const month = date.getUTCMonth();
  const fluIntensity = [1, 0.95, 0.75, 0.45, 0.2, 0.1, 0.1, 0.15, 0.3, 0.55, 0.85, 1][month] ?? 0.3;
  return 1 + fluIntensity * (fluSensitive ? 0.6 : 0.12);
};

const weekdayMultiplier = (date: Date) => ([0.55, 1.15, 1.1, 1.05, 1.05, 1.1, 0.6][date.getUTCDay()] ?? 1);

const tierDemandShare: Record<WarehouseTier, number> = {
  METRO: 0.36,
  TIER_1: 0.26,
  TIER_2: 0.22,
  TIER_3: 0.16,
};

const clear = async () => {
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
};

const main = async () => {
  await clear();

  const systemUser = await prisma.user.create({
    data: {
      name: "System",
      email: "system@medcare.local",
      passwordHash: "!",
      role: "ADMIN",
    },
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

  await prisma.warehouse.createMany({ data: WAREHOUSES.map((warehouse) => ({ ...warehouse })) });
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
    const fluSensitive = FLU_SENSITIVE.has(product.sku);
    const baseline = baselineDemand.get(product.id) ?? 100;

    for (const warehouse of warehouses) {
      const share = tierDemandShare[warehouse.tier];
      const stockoutProneness = warehouse.tier === "TIER_2" || warehouse.tier === "TIER_3" ? 0.12 : 0.03;

      for (let offset = -HISTORY_DAYS; offset < 0; offset += 1) {
        const date = dayOffset(offset);
        const promotionFlag = rng() < 0.04;
        const holidayFlag = date.getUTCDay() === 0 && rng() < 0.15;

        const ordered = Math.max(
          0,
          Math.round(
            baseline *
              share *
              seasonalMultiplier(date, fluSensitive) *
              weekdayMultiplier(date) *
              (promotionFlag ? between(1.3, 1.8) : 1) *
              between(0.82, 1.18),
          ),
        );

        const stockoutFlag = rng() < stockoutProneness * seasonalMultiplier(date, fluSensitive);
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
          season: seasonalMultiplier(date, fluSensitive) > 1.3 ? "flu" : "regular",
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
      const leadTimeDays = intBetween(4, 14);
      const isMetro = warehouse.tier === "METRO";

      const coverageDays = isMetro ? between(40, 110) : between(3, 22);
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
        leadTimeStdDev: Number((leadTimeDays * between(0.12, 0.3)).toFixed(2)),
        serviceLevel: product.criticality === "CRITICAL" ? 0.98 : product.criticality === "HIGH" ? 0.96 : 0.95,
        reviewPeriodDays: 7,
        minimumOrderQty: Math.round(daily * 5),
        maximumInventory: Math.round(daily * 60),
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

        const draw = rng();
        const daysToExpiry =
          draw < 0.1 ? intBetween(5, 30)
          : draw < 0.25 ? intBetween(31, 60)
          : draw < 0.45 ? intBetween(61, 90)
          : intBetween(91, product.shelfLifeDays ?? 500);

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

  const fluSeasonStart = dayOffset(intBetween(60, 80));
  await prisma.promotionEvent.createMany({
    data: [
      {
        name: "Flu Season Preparedness Campaign",
        type: "SEASONAL",
        startDate: fluSeasonStart,
        endDate: new Date(fluSeasonStart.getTime() + 120 * 86_400_000),
        upliftFactor: 1.6,
      },
      {
        name: "Respiratory Care Distributor Promotion",
        type: "PROMOTION",
        productId: productBySku.get("SKU-SAL-INH")?.id ?? null,
        startDate: dayOffset(14),
        endDate: dayOffset(45),
        upliftFactor: 1.35,
      },
      {
        name: "Antibiotic Stewardship Push",
        type: "CAMPAIGN",
        productId: productBySku.get("SKU-AMX-500")?.id ?? null,
        startDate: dayOffset(7),
        endDate: dayOffset(28),
        upliftFactor: 1.2,
      },
      {
        name: "Cardiac Care Awareness Month",
        type: "CAMPAIGN",
        productId: productBySku.get("SKU-LIS-10")?.id ?? null,
        startDate: dayOffset(30),
        endDate: dayOffset(60),
        upliftFactor: 1.25,
      },
      {
        name: "Winter Holiday Demand Peak",
        type: "HOLIDAY",
        startDate: dayOffset(105),
        endDate: dayOffset(125),
        upliftFactor: 1.4,
      },
    ],
  });

  const signalRows: { productId: string | null; region: string; date: Date; signalType: string; value: number }[] = [];
  for (const warehouse of warehouses) {
    for (let offset = -HISTORY_DAYS; offset <= 30; offset += 1) {
      const date = dayOffset(offset);
      signalRows.push({
        productId: null,
        region: warehouse.region ?? "Unknown",
        date,
        signalType: "flu_incidence_per_100k",
        value: Number((seasonalMultiplier(date, true) * between(18, 42)).toFixed(2)),
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

  for (const distributor of distributors) {
    if (!distributor.warehouseId) continue;
    for (const product of orderedProducts) {
      for (let offset = -90; offset < 0; offset += 7) {
        const orderDate = dayOffset(offset + intBetween(0, 2));
        const quantity = Math.round(
          (baselineDemand.get(product.id) ?? 100) * between(1.5, 4.5) * seasonalMultiplier(orderDate, FLU_SENSITIVE.has(product.sku)),
        );
        orderRows.push({
          distributorId: distributor.id,
          productId: product.id,
          warehouseId: distributor.warehouseId,
          orderDate,
          requestedDate: new Date(orderDate.getTime() + intBetween(3, 10) * 86_400_000),
          quantity,
          fulfilledQuantity: Math.round(quantity * between(0.7, 1)),
        });
      }
    }
  }
  await chunked(orderRows, 5_000, (batch) => prisma.distributorOrder.createMany({ data: batch }));

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
  };

  console.log("seed complete", counts);
};

main()
  .catch((error) => {
    console.error("seed failed", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
