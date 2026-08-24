import {
  Alert,
  DashboardKPIs,
  DistributionCenterStats,
  ExpiryRiskItem,
  ForecastPoint,
  InventoryItem,
  NetworkHealth,
  OptimizationMetrics,
  PriorityAction,
  ReplenishmentRecommendation,
  SimulationResult,
  InventoryTableItem,
  InventoryPageKPIs,
  InventoryHealthBreakdown,
  SkuDetailData,
  // StockBatch,
  // StockMovement,
} from "@/types/inventory";

const today = new Date();
const formatDate = (daysOffset: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString();
};

export const mockDashboardKPIs: DashboardKPIs = {
  totalInventoryValue: 1245000,
  skusMonitored: 845,
  stockoutRiskItems: 12,
  expiryRiskItems: 8,
  onTimeDeliveryRate: 94.2,
  forecastAccuracy: 88.5,
  activeAlerts: 4,
  pendingRecommendations: 5,
};

export const mockInventoryItems: InventoryItem[] = [
  {
    id: "SKU-AMX-500",
    name: "Amoxicillin 500mg Capsules",
    category: "Antibiotics",
    currentStock: 12500,
    minimumStock: 5000,
    maximumStock: 25000,
    unitCost: 0.15,
    status: "healthy",
    leadTimeDays: 7,
    expiryDate: formatDate(365),
  },
  {
    id: "SKU-IBU-400",
    name: "Ibuprofen 400mg Tablets",
    category: "Analgesics",
    currentStock: 3200,
    minimumStock: 4000,
    maximumStock: 15000,
    unitCost: 0.08,
    status: "low",
    leadTimeDays: 5,
    expiryDate: formatDate(180),
  },
  {
    id: "SKU-LIS-10",
    name: "Lisinopril 10mg Tablets",
    category: "Cardiovascular",
    currentStock: 800,
    minimumStock: 2000,
    maximumStock: 10000,
    unitCost: 0.22,
    status: "critical",
    leadTimeDays: 14,
    expiryDate: formatDate(240),
  },
  {
    id: "SKU-ATO-20",
    name: "Atorvastatin 20mg Tablets",
    category: "Cardiovascular",
    currentStock: 8500,
    minimumStock: 3000,
    maximumStock: 12000,
    unitCost: 0.18,
    status: "healthy",
    leadTimeDays: 10,
    expiryDate: formatDate(400),
  },
  {
    id: "SKU-MET-500",
    name: "Metformin 500mg Tablets",
    category: "Antidiabetics",
    currentStock: 15000,
    minimumStock: 6000,
    maximumStock: 30000,
    unitCost: 0.05,
    status: "healthy",
    leadTimeDays: 6,
    expiryDate: formatDate(300),
  },
  {
    id: "SKU-SAL-INH",
    name: "Salbutamol 100mcg Inhaler",
    category: "Respiratory",
    currentStock: 1200,
    minimumStock: 1500,
    maximumStock: 5000,
    unitCost: 3.50,
    status: "low",
    leadTimeDays: 8,
    expiryDate: formatDate(120),
  },
  {
    id: "SKU-OME-20",
    name: "Omeprazole 20mg Capsules",
    category: "Gastrointestinal",
    currentStock: 450,
    minimumStock: 2500,
    maximumStock: 8000,
    unitCost: 0.12,
    status: "critical",
    leadTimeDays: 5,
    expiryDate: formatDate(90),
  },
  {
    id: "SKU-AML-05",
    name: "Amlodipine 5mg Tablets",
    category: "Cardiovascular",
    currentStock: 6200,
    minimumStock: 2000,
    maximumStock: 10000,
    unitCost: 0.09,
    status: "healthy",
    leadTimeDays: 7,
    expiryDate: formatDate(320),
  },
  {
    id: "SKU-AZI-250",
    name: "Azithromycin 250mg Tablets",
    category: "Antibiotics",
    currentStock: 2100,
    minimumStock: 1500,
    maximumStock: 7000,
    unitCost: 0.45,
    status: "healthy",
    leadTimeDays: 12,
    expiryDate: formatDate(150),
  },
  {
    id: "SKU-CET-10",
    name: "Cetirizine 10mg Tablets",
    category: "Antihistamines",
    currentStock: 900,
    minimumStock: 3000,
    maximumStock: 15000,
    unitCost: 0.06,
    status: "critical",
    leadTimeDays: 4,
    expiryDate: formatDate(110),
  }
];

export const mockForecastData: Record<string, ForecastPoint[]> = {
  "SKU-LIS-10": [
    // Historical (last 7 days)
    ...Array.from({ length: 7 }).map((_, i) => ({
      date: formatDate(i - 7),
      actualDemand: 160 + ((i * 13) % 30),
    })),
    // Forecast (next 14 days)
    ...Array.from({ length: 14 }).map((_, i) => ({
      date: formatDate(i),
      predictedDemand: 150 + ((i * 17) % 50),
      lowerBound: 120 + ((i * 11) % 30),
      upperBound: 190 + ((i * 19) % 40),
    }))
  ],
  "SKU-OME-20": [
    // Historical (last 7 days)
    ...Array.from({ length: 7 }).map((_, i) => ({
      date: formatDate(i - 7),
      actualDemand: 210 + ((i * 23) % 40),
    })),
    // Forecast (next 14 days)
    ...Array.from({ length: 14 }).map((_, i) => ({
      date: formatDate(i),
      predictedDemand: 200 + ((i * 29) % 80),
      lowerBound: 160 + ((i * 7) % 40),
      upperBound: 260 + ((i * 31) % 60),
    }))
  ],
};

export const mockAlerts: Alert[] = [
  {
    id: "ALT-001",
    itemId: "SKU-LIS-10",
    title: "Critical Stockout Risk",
    message: "Lisinopril 10mg is projected to stock out in 4 days. Current stock is critically low (800).",
    severity: "critical",
    timestamp: formatDate(-1),
    isRead: false,
  },
  {
    id: "ALT-002",
    itemId: "SKU-OME-20",
    title: "Demand Spike Detected",
    message: "Unusual 35% spike in demand for Omeprazole 20mg detected in the Northeast region.",
    severity: "warning",
    timestamp: formatDate(0),
    isRead: false,
  },
  {
    id: "ALT-003",
    itemId: "SKU-IBU-400",
    title: "Low Inventory Warning",
    message: "Ibuprofen 400mg has fallen below the minimum threshold (3,200 < 4,000).",
    severity: "warning",
    timestamp: formatDate(-2),
    isRead: true,
  },
  {
    id: "ALT-004",
    itemId: "SKU-OME-20",
    title: "Expiring Batch Warning",
    message: "A batch of Omeprazole 20mg (Qty: 250) is expiring in less than 90 days.",
    severity: "info",
    timestamp: formatDate(-5),
    isRead: true,
  }
];

export const mockRecommendations: ReplenishmentRecommendation[] = [
  {
    id: "REC-001",
    itemId: "SKU-LIS-10",
    action: "order",
    destinationDc: "Northeast DC",
    currentInventory: 800,
    forecastDemand: 2100, // 14 day
    riskStatus: "critical",
    suggestedQuantity: 5000,
    confidenceScore: 94,
    estimatedDeliveryDate: formatDate(14),
    reason: "Projected stockout in 4 days. Supplier lead time is 14 days.",
    expectedImpact: "Avoids $45k in stockout penalties",
    priority: "critical"
  },
  {
    id: "REC-002",
    itemId: "SKU-OME-20",
    action: "transfer",
    sourceDc: "West Coast DC",
    destinationDc: "South DC",
    currentInventory: 450,
    forecastDemand: 2800, // 14 day
    riskStatus: "high",
    suggestedQuantity: 1500,
    confidenceScore: 88,
    estimatedDeliveryDate: formatDate(2),
    reason: "Excess stock available at Regional Warehouse B. Internal transfer is faster and cheaper.",
    expectedImpact: "Balances network, saves $1.2k freight",
    priority: "high"
  },
  {
    id: "REC-003",
    itemId: "SKU-IBU-400",
    action: "order",
    destinationDc: "West Coast DC",
    currentInventory: 3200,
    forecastDemand: 7000, // 14 day
    riskStatus: "medium",
    suggestedQuantity: 8000,
    confidenceScore: 76,
    estimatedDeliveryDate: formatDate(5),
    reason: "Stock fell below minimum threshold. Standard reorder quantity recommended.",
    expectedImpact: "Maintains optimal 98% service level",
    priority: "medium"
  },
  {
    id: "REC-004",
    itemId: "SKU-CET-10",
    action: "discard", // Reusing 'discard' as prioritize action for expiring batch
    sourceDc: "West Coast DC",
    currentInventory: 5000,
    forecastDemand: 1200,
    riskStatus: "medium",
    suggestedQuantity: 5000,
    confidenceScore: 82,
    estimatedDeliveryDate: formatDate(0),
    reason: "Batch B-2024-11X expiring in 45 days. Demand is insufficient to clear before expiry.",
    expectedImpact: "Prioritize fulfillment to avoid $300 waste",
    priority: "high"
  }
];

export const mockOptimizationMetrics: OptimizationMetrics = {
  current: {
    holdingCost: 28500,
    stockoutPenalty: 14200,
    expiryCost: 5400,
    transferCost: 1200,
    totalCost: 49300,
  },
  optimized: {
    holdingCost: 24100,
    stockoutPenalty: 2100,
    expiryCost: 1800,
    transferCost: 3500, // Slightly higher transfer cost to avoid stockouts
    totalCost: 31500,
  },
  savings: 17800,
  savingsPercentage: 36.1,
};

export const mockSimulationResults: SimulationResult[] = [
  {
    scenarioId: "SIM-001",
    scenarioName: "Expedited Air Freight (Lisinopril)",
    projectedStockoutRisk: 5.2,
    estimatedCostSavings: -1200, // Negative means extra cost
    impactScore: 85,
  },
  {
    scenarioId: "SIM-002",
    scenarioName: "Internal Transfer (Omeprazole)",
    projectedStockoutRisk: 1.5,
    estimatedCostSavings: 450,
    impactScore: 92,
  },
];

export const mockNetworkHealth: NetworkHealth = {
  overallScore: 92,
  inStockPercentage: 96.5,
  atRiskSkuCount: 12,
  excessInventoryValue: 45000,
  shortageValue: 12500,
};

export const mockPriorityActions: PriorityAction[] = [
  {
    id: "ACT-001",
    sku: "SKU-LIS-10",
    dc: "Northeast DC",
    problem: "Projected Stockout (4 days)",
    severity: "critical",
    recommendedAction: "Expedite Air Freight",
  },
  {
    id: "ACT-002",
    sku: "SKU-OME-20",
    dc: "West Coast DC",
    problem: "Excess Inventory / Demand Drop",
    severity: "warning",
    recommendedAction: "Internal Transfer to South DC",
  },
  {
    id: "ACT-003",
    sku: "SKU-CET-10",
    dc: "South DC",
    problem: "Expiring Batch (30 days)",
    severity: "info",
    recommendedAction: "Discount & Prioritize Fulfillment",
  },
  {
    id: "ACT-004",
    sku: "SKU-IBU-400",
    dc: "West Coast DC",
    problem: "Excess Inventory / Demand Drop",
    severity: "warning",
    recommendedAction: "Internal Transfer to South DC",
  },
];

export const mockExpiryRisks: ExpiryRiskItem[] = [
  {
    id: "EXP-001",
    sku: "SKU-OME-20",
    name: "Omeprazole 20mg Capsules",
    batchId: "B-2024-89A",
    currentQuantity: 250,
    daysToExpiry: 12,
    inventoryValue: 30,
    dc: "South DC",
    severity: "critical"
  },
  {
    id: "EXP-002",
    sku: "SKU-IBU-400",
    name: "Ibuprofen 400mg Tablets",
    batchId: "B-2024-42C",
    currentQuantity: 1200,
    daysToExpiry: 28,
    inventoryValue: 96,
    dc: "Northeast DC",
    severity: "high"
  },
  {
    id: "EXP-003",
    sku: "SKU-CET-10",
    name: "Cetirizine 10mg Tablets",
    batchId: "B-2024-11X",
    currentQuantity: 5000,
    daysToExpiry: 45,
    inventoryValue: 300,
    dc: "West Coast DC",
    severity: "medium"
  },
  {
    id: "EXP-004",
    sku: "SKU-SAL-INH",
    name: "Salbutamol 100mcg Inhaler",
    batchId: "B-2024-77D",
    currentQuantity: 350,
    daysToExpiry: 85,
    inventoryValue: 1225,
    dc: "Midwest DC",
    severity: "low"
  }
];

export const mockDistributionCenters: DistributionCenterStats[] = [
  {
    id: "DC-01",
    name: "Northeast DC",
    capacity: 500000,
    utilization: 88.5,
    inventoryValue: 450000,
    atRiskInventory: 12500,
    stockoutRisk: 4.2
  },
  {
    id: "DC-02",
    name: "South DC",
    capacity: 350000,
    utilization: 62.4,
    inventoryValue: 280000,
    atRiskInventory: 45000,
    stockoutRisk: 1.5
  },
  {
    id: "DC-03",
    name: "West Coast DC",
    capacity: 600000,
    utilization: 94.2,
    inventoryValue: 625000,
    atRiskInventory: 8000,
    stockoutRisk: 8.7
  },
  {
    id: "DC-04",
    name: "Midwest DC",
    capacity: 250000,
    utilization: 45.0,
    inventoryValue: 180000,
    atRiskInventory: 2500,
    stockoutRisk: 2.1
  }
];

// ============================================
// INVENTORY PAGE DATA
// ============================================

export const mockInventoryPageKPIs: InventoryPageKPIs = {
  totalInventoryValue: 1245000,
  totalSkus: 845,
  inStockRate: 96.5,
  atRiskSkus: 12,
  atRiskCritical: 4,
  excessInventoryValue: 45000,
};

export const mockInventoryHealthBreakdown: InventoryHealthBreakdown = {
  healthy: 612,
  belowReorderPoint: 98,
  criticalStock: 42,
  excessStock: 58,
  expiringSoon: 35,
  total: 845,
};

export const mockInventoryTableItems: InventoryTableItem[] = [
  {
    id: "SKU-LIS-10",
    name: "Lisinopril 10mg Tablets",
    category: "Cardiovascular",
    location: "Northeast DC",
    onHand: 800,
    safetyStock: 2000,
    reorderPoint: 2400,
    daysOfSupply: 4,
    unitValue: 0.22,
    inventoryValue: 176,
    risk: "critical",
    status: "at_risk",
  },
  {
    id: "SKU-OME-20",
    name: "Omeprazole 20mg Capsules",
    category: "Gastrointestinal",
    location: "South DC",
    onHand: 450,
    safetyStock: 2500,
    reorderPoint: 3000,
    daysOfSupply: 2,
    unitValue: 0.12,
    inventoryValue: 54,
    risk: "critical",
    status: "expiring",
  },
  {
    id: "SKU-AMX-500",
    name: "Amoxicillin 500mg Capsules",
    category: "Antibiotics",
    location: "Northeast DC",
    onHand: 12500,
    safetyStock: 5000,
    reorderPoint: 6000,
    daysOfSupply: 45,
    unitValue: 0.15,
    inventoryValue: 1875,
    risk: "low",
    status: "healthy",
  },
  {
    id: "SKU-IBU-400",
    name: "Ibuprofen 400mg Tablets",
    category: "Analgesics",
    location: "West Coast DC",
    onHand: 3200,
    safetyStock: 4000,
    reorderPoint: 4800,
    daysOfSupply: 8,
    unitValue: 0.08,
    inventoryValue: 256,
    risk: "high",
    status: "reorder_required",
  },
  {
    id: "SKU-ATO-20",
    name: "Atorvastatin 20mg Tablets",
    category: "Cardiovascular",
    location: "South DC",
    onHand: 8500,
    safetyStock: 3000,
    reorderPoint: 3600,
    daysOfSupply: 32,
    unitValue: 0.18,
    inventoryValue: 1530,
    risk: "low",
    status: "healthy",
  },
  {
    id: "SKU-MET-500",
    name: "Metformin 500mg Tablets",
    category: "Antidiabetics",
    location: "Midwest DC",
    onHand: 15000,
    safetyStock: 6000,
    reorderPoint: 7200,
    daysOfSupply: 60,
    unitValue: 0.05,
    inventoryValue: 750,
    risk: "low",
    status: "overstocked",
  },
  {
    id: "SKU-SAL-INH",
    name: "Salbutamol 100mcg Inhaler",
    category: "Respiratory",
    location: "West Coast DC",
    onHand: 1200,
    safetyStock: 1500,
    reorderPoint: 1800,
    daysOfSupply: 12,
    unitValue: 3.50,
    inventoryValue: 4200,
    risk: "medium",
    status: "reorder_required",
  },
  {
    id: "SKU-AML-05",
    name: "Amlodipine 5mg Tablets",
    category: "Cardiovascular",
    location: "Northeast DC",
    onHand: 6200,
    safetyStock: 2000,
    reorderPoint: 2400,
    daysOfSupply: 28,
    unitValue: 0.09,
    inventoryValue: 558,
    risk: "low",
    status: "healthy",
  },
  {
    id: "SKU-AZI-250",
    name: "Azithromycin 250mg Tablets",
    category: "Antibiotics",
    location: "South DC",
    onHand: 2100,
    safetyStock: 1500,
    reorderPoint: 1800,
    daysOfSupply: 18,
    unitValue: 0.45,
    inventoryValue: 945,
    risk: "low",
    status: "healthy",
  },
  {
    id: "SKU-CET-10",
    name: "Cetirizine 10mg Tablets",
    category: "Antihistamines",
    location: "West Coast DC",
    onHand: 900,
    safetyStock: 3000,
    reorderPoint: 3600,
    daysOfSupply: 5,
    unitValue: 0.06,
    inventoryValue: 54,
    risk: "critical",
    status: "at_risk",
  },
  {
    id: "SKU-DXM-30",
    name: "Dextromethorphan 30mg Syrup",
    category: "Respiratory",
    location: "Midwest DC",
    onHand: 4800,
    safetyStock: 2000,
    reorderPoint: 2500,
    daysOfSupply: 35,
    unitValue: 1.20,
    inventoryValue: 5760,
    risk: "low",
    status: "healthy",
  },
  {
    id: "SKU-PRD-20",
    name: "Prednisone 20mg Tablets",
    category: "Anti-inflammatory",
    location: "Northeast DC",
    onHand: 7800,
    safetyStock: 2500,
    reorderPoint: 3000,
    daysOfSupply: 42,
    unitValue: 0.14,
    inventoryValue: 1092,
    risk: "low",
    status: "overstocked",
  },
];

// ============================================
// DETAILED SKU OPERATIONAL DATA (Batches, Movements, AI Reasoning)
// ============================================

export const mockDetailedSkus: Record<string, Partial<SkuDetailData>> = {
  "SKU-LIS-10": {
    manufacturer: "Pfizer / Greenstone LLC",
    maximumStock: 10000,
    avgDailyDemand: 165,
    leadTimeDays: 14,
    stockoutRiskLevel: "critical",
    stockoutRiskReason: "Projected stockout in 4 days. Daily consumption (165 units) will deplete 800 on-hand stock before the 14-day supplier lead time completes.",
    expiryRiskLevel: "none",
    expiryRiskReason: "All active batches have over 240 days of shelf life remaining.",
    excessRiskLevel: "none",
    excessRiskReason: "Stock is 60% below safety stock baseline.",
    aiRecommendation: {
      action: "Expedite Replenishment (Air Freight)",
      confidence: 94,
      expectedImpact: "Prevents estimated $45,000 in stockout penalties and avoids hospital surgery delays.",
      reasoning: "Current stock is 60% below the safety stock threshold (800 vs 2,000 target). Standard 14-day replenishment will result in 10 days of stockout. Expediting 5,000 units reduces stockout probability from 98% to 1.2%.",
      suggestedQuantity: 5000,
    },
    batches: [
      {
        id: "B-2024-LIS-01",
        sku: "SKU-LIS-10",
        location: "Northeast DC - Bay A-04",
        quantity: 500,
        manufacturingDate: "2024-03-15",
        expiryDate: "2025-11-30",
        daysRemaining: 462,
        valueAtRisk: 110,
        expiryRisk: "low",
      },
      {
        id: "B-2024-LIS-02",
        sku: "SKU-LIS-10",
        location: "Northeast DC - Bay A-05",
        quantity: 300,
        manufacturingDate: "2024-05-10",
        expiryDate: "2026-01-15",
        daysRemaining: 508,
        valueAtRisk: 66,
        expiryRisk: "low",
      },
    ],
    movements: [
      {
        id: "MOV-1001",
        date: formatDate(-1),
        movementType: "Consumption",
        sku: "SKU-LIS-10",
        quantity: -180,
        fromLocation: "Northeast DC",
        toLocation: "Boston Medical Center",
        reference: "ORD-89421",
        userOrSystem: "Automated Dispatch",
      },
      {
        id: "MOV-1002",
        date: formatDate(-3),
        movementType: "Consumption",
        sku: "SKU-LIS-10",
        quantity: -155,
        fromLocation: "Northeast DC",
        toLocation: "Mass General Pharmacy",
        reference: "ORD-89210",
        userOrSystem: "Automated Dispatch",
      },
      {
        id: "MOV-1003",
        date: formatDate(-8),
        movementType: "Replenishment",
        sku: "SKU-LIS-10",
        quantity: 2000,
        fromLocation: "Pfizer Logistics (Kalamazoo)",
        toLocation: "Northeast DC",
        reference: "PO-77412",
        userOrSystem: "Jane Doe (Analyst)",
      },
      {
        id: "MOV-1004",
        date: formatDate(-14),
        movementType: "Adjustment",
        sku: "SKU-LIS-10",
        quantity: -20,
        fromLocation: "Northeast DC",
        toLocation: "Damaged / Quarantine",
        reference: "ADJ-0044",
        userOrSystem: "QC Inspector",
      },
    ],
  },
  "SKU-OME-20": {
    manufacturer: "AstraZeneca Pharmaceuticals",
    maximumStock: 8000,
    avgDailyDemand: 215,
    leadTimeDays: 5,
    stockoutRiskLevel: "critical",
    stockoutRiskReason: "Current stock of 450 units provides only 2 days of supply against 215 daily demand.",
    expiryRiskLevel: "high",
    expiryRiskReason: "Batch B-2024-89A (250 units) expires in 12 days; cannot be cleared through regular local fulfillment.",
    excessRiskLevel: "none",
    excessRiskReason: "Stock is severely depleted at South DC.",
    aiRecommendation: {
      action: "Internal Transfer from West Coast DC + FEFO Prioritization",
      confidence: 88,
      expectedImpact: "Balances regional network demand and saves $1,200 in freight vs external order.",
      reasoning: "West Coast DC holds 3,200 surplus units. Transferring 1,500 units by regional ground courier takes 2 days and avoids stockout. Simultaneously, dispatching the 250 expiring units to high-volume clinics clears batch before expiry.",
      suggestedQuantity: 1500,
    },
    batches: [
      {
        id: "B-2024-89A",
        sku: "SKU-OME-20",
        location: "South DC - Bay C-12",
        quantity: 250,
        manufacturingDate: "2023-09-01",
        expiryDate: formatDate(12),
        daysRemaining: 12,
        valueAtRisk: 30,
        expiryRisk: "critical",
      },
      {
        id: "B-2024-91B",
        sku: "SKU-OME-20",
        location: "South DC - Bay C-14",
        quantity: 200,
        manufacturingDate: "2024-02-15",
        expiryDate: formatDate(270),
        daysRemaining: 270,
        valueAtRisk: 24,
        expiryRisk: "low",
      },
    ],
    movements: [
      {
        id: "MOV-2001",
        date: formatDate(0),
        movementType: "Transfer",
        sku: "SKU-OME-20",
        quantity: 1500,
        fromLocation: "West Coast DC",
        toLocation: "South DC",
        reference: "TRF-33019",
        userOrSystem: "AI Engine",
      },
      {
        id: "MOV-2002",
        date: formatDate(-2),
        movementType: "Consumption",
        sku: "SKU-OME-20",
        quantity: -210,
        fromLocation: "South DC",
        toLocation: "Atlanta Regional Health",
        reference: "ORD-90112",
        userOrSystem: "Automated Dispatch",
      },
      {
        id: "MOV-2003",
        date: formatDate(-5),
        movementType: "Consumption",
        sku: "SKU-OME-20",
        quantity: -195,
        fromLocation: "South DC",
        toLocation: "Miami Specialty Clinic",
        reference: "ORD-89984",
        userOrSystem: "Automated Dispatch",
      },
    ],
  },
  "SKU-IBU-400": {
    manufacturer: "Bayer Healthcare AG",
    maximumStock: 15000,
    avgDailyDemand: 400,
    leadTimeDays: 5,
    stockoutRiskLevel: "high",
    stockoutRiskReason: "Stock has fallen below the 4,000 unit safety threshold (currently 3,200 units).",
    expiryRiskLevel: "medium",
    expiryRiskReason: "Batch B-2024-42C (1,200 units) has 28 days remaining.",
    excessRiskLevel: "none",
    excessRiskReason: "Stock is in reorder position.",
    aiRecommendation: {
      action: "Standard Replenishment Order",
      confidence: 76,
      expectedImpact: "Maintains optimal 98% service level across West Coast clinics.",
      reasoning: "Standard lead time is 5 days. Placing a purchase order for 8,000 units brings inventory to 11,200 (within normal operating band of 4,000–15,000).",
      suggestedQuantity: 8000,
    },
    batches: [
      {
        id: "B-2024-42C",
        sku: "SKU-IBU-400",
        location: "West Coast DC - Bay B-01",
        quantity: 1200,
        manufacturingDate: "2023-11-20",
        expiryDate: formatDate(28),
        daysRemaining: 28,
        valueAtRisk: 96,
        expiryRisk: "high",
      },
      {
        id: "B-2024-88F",
        sku: "SKU-IBU-400",
        location: "West Coast DC - Bay B-02",
        quantity: 2000,
        manufacturingDate: "2024-04-10",
        expiryDate: formatDate(310),
        daysRemaining: 310,
        valueAtRisk: 160,
        expiryRisk: "low",
      },
    ],
    movements: [
      {
        id: "MOV-3001",
        date: formatDate(-1),
        movementType: "Consumption",
        sku: "SKU-IBU-400",
        quantity: -420,
        fromLocation: "West Coast DC",
        toLocation: "San Francisco Health Network",
        reference: "ORD-90214",
        userOrSystem: "Automated Dispatch",
      },
      {
        id: "MOV-3002",
        date: formatDate(-4),
        movementType: "Purchase",
        sku: "SKU-IBU-400",
        quantity: 5000,
        fromLocation: "Bayer Supply (Reno)",
        toLocation: "West Coast DC",
        reference: "PO-76819",
        userOrSystem: "Purchasing Agent",
      },
    ],
  },
  "SKU-CET-10": {
    manufacturer: "Johnson & Johnson / McNeil",
    maximumStock: 15000,
    avgDailyDemand: 180,
    leadTimeDays: 4,
    stockoutRiskLevel: "critical",
    stockoutRiskReason: "On hand 900 units vs safety stock 3,000 units. 5 days of supply remaining.",
    expiryRiskLevel: "medium",
    expiryRiskReason: "Batch B-2024-11X (5,000 units total across network) is expiring in 45 days.",
    excessRiskLevel: "none",
    excessRiskReason: "Local stock is depleted.",
    aiRecommendation: {
      action: "Discount & Prioritize Fulfillment + Reorder",
      confidence: 82,
      expectedImpact: "Clears expiring inventory to prevent $300 waste while replenishing stock.",
      reasoning: "Prioritize FEFO dispatch for Batch B-2024-11X to high-volume outpatient centers. Trigger supplier order for fresh batch of 6,000 units.",
      suggestedQuantity: 6000,
    },
    batches: [
      {
        id: "B-2024-11X",
        sku: "SKU-CET-10",
        location: "West Coast DC - Bay E-03",
        quantity: 900,
        manufacturingDate: "2023-10-15",
        expiryDate: formatDate(45),
        daysRemaining: 45,
        valueAtRisk: 54,
        expiryRisk: "medium",
      },
    ],
    movements: [
      {
        id: "MOV-4001",
        date: formatDate(-1),
        movementType: "Consumption",
        sku: "SKU-CET-10",
        quantity: -160,
        fromLocation: "West Coast DC",
        toLocation: "Seattle Urgent Care",
        reference: "ORD-90451",
        userOrSystem: "Automated Dispatch",
      },
    ],
  },
};

export function getSkuDetailData(skuId: string): SkuDetailData {
  const baseItem = mockInventoryTableItems.find((i) => i.id === skuId) || mockInventoryTableItems[0];
  const custom = mockDetailedSkus[skuId] || {};

  const defaultManufacturer = baseItem.category === "Antibiotics" ? "Sandoz / Novartis" :
    baseItem.category === "Cardiovascular" ? "Viatris / Mylan" :
    baseItem.category === "Respiratory" ? "GlaxoSmithKline" :
    baseItem.category === "Antidiabetics" ? "Teva Pharmaceuticals" : "Generic Pharma Corp";

  const defaultMaxStock = baseItem.safetyStock * 3;
  const defaultAvgDailyDemand = Math.round(baseItem.onHand / (baseItem.daysOfSupply || 20)) || 120;

  return {
    ...baseItem,
    manufacturer: custom.manufacturer || defaultManufacturer,
    maximumStock: custom.maximumStock || defaultMaxStock,
    avgDailyDemand: custom.avgDailyDemand || defaultAvgDailyDemand,
    leadTimeDays: custom.leadTimeDays || 7,
    stockoutRiskLevel: custom.stockoutRiskLevel || (baseItem.risk === "critical" ? "critical" : baseItem.risk === "high" ? "high" : "low"),
    stockoutRiskReason: custom.stockoutRiskReason || (baseItem.onHand < baseItem.safetyStock ? `Stock is below the recommended safety threshold (${baseItem.onHand.toLocaleString()} < ${baseItem.safetyStock.toLocaleString()}).` : "Inventory is above safety stock buffer."),
    expiryRiskLevel: custom.expiryRiskLevel || (baseItem.status === "expiring" ? "critical" : "none"),
    expiryRiskReason: custom.expiryRiskReason || (baseItem.status === "expiring" ? "Batch expires in less than 45 days. Prioritize dispatch." : "No imminent expiry risks detected."),
    excessRiskLevel: custom.excessRiskLevel || (baseItem.status === "overstocked" ? "medium" : "none"),
    excessRiskReason: custom.excessRiskReason || (baseItem.status === "overstocked" ? `Stock exceeds forecast demand by ${Math.round((baseItem.onHand / baseItem.safetyStock - 1) * 100)}%.` : "Inventory level aligned with demand forecast."),
    aiRecommendation: custom.aiRecommendation || {
      action: baseItem.status === "at_risk" || baseItem.status === "reorder_required" ? "Order Replenishment" : baseItem.status === "overstocked" ? "Hold Procurement" : "Maintain Current Policy",
      confidence: 86,
      expectedImpact: baseItem.status === "at_risk" ? "Prevents network service disruption." : "Maintains target 98% service level.",
      reasoning: `Stock position is currently ${baseItem.status.replace("_", " ")}. Demand trend is stable across the network.`,
      suggestedQuantity: baseItem.safetyStock * 2,
    },
    batches: custom.batches || [
      {
        id: `B-2024-${baseItem.id.split("-")[1] || "GEN"}-01`,
        sku: baseItem.id,
        location: `${baseItem.location} - Bay A-01`,
        quantity: baseItem.onHand,
        manufacturingDate: "2024-01-10",
        expiryDate: formatDate(280),
        daysRemaining: 280,
        valueAtRisk: baseItem.inventoryValue,
        expiryRisk: "low",
      },
    ],
    movements: custom.movements || [
      {
        id: `MOV-${Math.floor(Math.random() * 8000 + 1000)}`,
        date: formatDate(-1),
        movementType: "Consumption",
        sku: baseItem.id,
        quantity: -defaultAvgDailyDemand,
        fromLocation: baseItem.location,
        toLocation: "Regional Medical Center",
        reference: `ORD-${Math.floor(Math.random() * 80000 + 10000)}`,
        userOrSystem: "Automated Dispatch",
      },
      {
        id: `MOV-${Math.floor(Math.random() * 8000 + 1000)}`,
        date: formatDate(-7),
        movementType: "Replenishment",
        sku: baseItem.id,
        quantity: baseItem.safetyStock,
        fromLocation: "Primary Supplier",
        toLocation: baseItem.location,
        reference: `PO-${Math.floor(Math.random() * 80000 + 10000)}`,
        userOrSystem: "Procurement System",
      },
    ],
  };
}

// ============================================
// FORECAST PAGE DATA
// ============================================

import { 
  ForecastPageKPIs, 
  ForecastSummaryData, 
  ForecastTrendData, 
  ForecastInsightData 
} from "@/types/forecast";

export const mockForecastPageKPIs: ForecastPageKPIs = {
  forecastedDemand: 12480,
  forecastHorizonDays: 30,
  forecastAccuracy: 88.5,
  accuracyChange: 1.2,
  confidenceLevel: 94,
  expectedPeakDemand: 620,
  peakDate: formatDate(18), // Sep 12 approx
  demandGrowth: 8.4,
};

export const mockForecastSummary: ForecastSummaryData = {
  predictedPeak: 620,
  peakDate: formatDate(18),
  avgDailyDemand: 416,
  minExpectedDemand: 390,
  maxExpectedDemand: 710,
  confidenceRange: [540, 690],
  historicalAccuracy: 88.5,
  expectedTrend: "Growing",
};

export const mockForecastTrends: ForecastTrendData = {
  sevenDayTrend: 4.2,
  thirtyDayTrend: 8.4,
  seasonalPattern: "Weekly (Tue-Thu peaks)",
  growthRate: 12.5,
  demandVolatility: "Low",
};

export const mockForecastInsights: ForecastInsightData = {
  keyDriver: "Recurring weekly pattern + Northeast DC volume increase",
  riskImplication: "Inventory may fall below safety stock during peak (Sep 12)",
  confidence: "High",
  recommendedAttention: "Review replenishment schedule for Northeast DC",
  detailedInsight: "Demand for Lisinopril is expected to increase by 8.4% over the next 30 days. The model identifies a recurring weekly pattern and increasing demand across Northeast DC. Current inventory may fall below safety stock during the forecast peak.",
};

import { ForecastTableItem, NetworkForecastItem, SeasonalityData, ModelPerformanceItem, ForecastImpactData } from "@/types/forecast";

export const mockForecastTableItems: ForecastTableItem[] = [
  {
    id: "SKU-LIS-10",
    product: "Lisinopril 10mg Tablets",
    category: "Cardiovascular",
    currentDemand: 165,
    forecastDemand: 179,
    growth: 8.4,
    accuracy: 94.2,
    confidence: 96,
    trend: "Growing",
    risk: "Critical"
  },
  {
    id: "SKU-OME-20",
    product: "Omeprazole 20mg Capsules",
    category: "Gastrointestinal",
    currentDemand: 215,
    forecastDemand: 210,
    growth: -2.3,
    accuracy: 88.5,
    confidence: 82,
    trend: "Stable",
    risk: "Medium"
  },
  {
    id: "SKU-IBU-400",
    product: "Ibuprofen 400mg Tablets",
    category: "Analgesics",
    currentDemand: 420,
    forecastDemand: 450,
    growth: 7.1,
    accuracy: 91.0,
    confidence: 89,
    trend: "Growing",
    risk: "Low"
  },
  {
    id: "SKU-CET-10",
    product: "Cetirizine 10mg Tablets",
    category: "Antihistamines",
    currentDemand: 180,
    forecastDemand: 140,
    growth: -22.2,
    accuracy: 85.4,
    confidence: 78,
    trend: "Declining",
    risk: "High"
  },
  {
    id: "SKU-AMX-500",
    product: "Amoxicillin 500mg Capsules",
    category: "Antibiotics",
    currentDemand: 310,
    forecastDemand: 345,
    growth: 11.2,
    accuracy: 89.9,
    confidence: 92,
    trend: "Growing",
    risk: "Low"
  },
  {
    id: "SKU-MET-500",
    product: "Metformin 500mg Tablets",
    category: "Antidiabetics",
    currentDemand: 520,
    forecastDemand: 530,
    growth: 1.9,
    accuracy: 95.1,
    confidence: 97,
    trend: "Stable",
    risk: "Low"
  }
];

export const mockNetworkForecasts: NetworkForecastItem[] = [
  {
    id: "DC-01",
    dcName: "Northeast DC",
    currentDemand: 4200,
    forecastDemand: 4650,
    growth: 10.7,
    confidence: 94,
    peakDemand: 4800,
    peakDate: formatDate(12)
  },
  {
    id: "DC-02",
    dcName: "South DC",
    currentDemand: 3100,
    forecastDemand: 3050,
    growth: -1.6,
    confidence: 88,
    peakDemand: 3200,
    peakDate: formatDate(18)
  },
  {
    id: "DC-03",
    dcName: "West Coast DC",
    currentDemand: 5800,
    forecastDemand: 6200,
    growth: 6.8,
    confidence: 91,
    peakDemand: 6500,
    peakDate: formatDate(22)
  },
  {
    id: "DC-04",
    dcName: "Midwest DC",
    currentDemand: 2400,
    forecastDemand: 2300,
    growth: -4.1,
    confidence: 85,
    peakDemand: 2600,
    peakDate: formatDate(8)
  }
];

export const mockSeasonalityData: SeasonalityData = {
  weeklyPattern: [
    { day: "Mon", value: 105 },
    { day: "Tue", value: 120 },
    { day: "Wed", value: 125 },
    { day: "Thu", value: 115 },
    { day: "Fri", value: 95 },
    { day: "Sat", value: 45 },
    { day: "Sun", value: 35 }
  ],
  monthlyTrend: [
    { month: "Jan", value: 110 },
    { month: "Feb", value: 115 },
    { month: "Mar", value: 105 },
    { month: "Apr", value: 95 },
    { month: "May", value: 85 },
    { month: "Jun", value: 80 }
  ],
  seasonalUplift: 14.5,
  volatility: "Low (Stable predictable peaks)"
};

export const mockModelPerformances: ModelPerformanceItem[] = [
  {
    modelName: "AI Ensemble",
    mape: 4.2,
    mae: 12.5,
    rmse: 15.8,
    accuracy: 95.8,
    bias: 0.4,
    isPrimary: true
  },
  {
    modelName: "Seasonal Model",
    mape: 8.5,
    mae: 24.1,
    rmse: 31.2,
    accuracy: 91.5,
    bias: -2.1,
    isPrimary: false
  },
  {
    modelName: "Moving Average",
    mape: 12.4,
    mae: 35.6,
    rmse: 42.9,
    accuracy: 87.6,
    bias: -5.4,
    isPrimary: false
  },
  {
    modelName: "Exponential Smoothing",
    mape: 11.2,
    mae: 32.1,
    rmse: 38.4,
    accuracy: 88.8,
    bias: 3.2,
    isPrimary: false
  }
];

export const mockForecastImpact: ForecastImpactData = {
  stockoutRiskReduction: 14,
  safetyStockOptimization: 8,
  reorderQuantityChange: -3.5,
  excessInventoryReduction: 17800,
  expectedInventoryValue: 1227200,
  insightText: "Improved forecast accuracy is expected to reduce stockout exposure by 14% while reducing excess inventory by approximately $17.8K across the network."
};
