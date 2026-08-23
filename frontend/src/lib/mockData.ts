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
  SimulationResult
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
      actualDemand: 160 + Math.floor(Math.random() * 30),
    })),
    // Forecast (next 14 days)
    ...Array.from({ length: 14 }).map((_, i) => ({
      date: formatDate(i),
      predictedDemand: 150 + Math.floor(Math.random() * 50),
      lowerBound: 120 + Math.floor(Math.random() * 30),
      upperBound: 190 + Math.floor(Math.random() * 40),
    }))
  ],
  "SKU-OME-20": [
    // Historical (last 7 days)
    ...Array.from({ length: 7 }).map((_, i) => ({
      date: formatDate(i - 7),
      actualDemand: 210 + Math.floor(Math.random() * 40),
    })),
    // Forecast (next 14 days)
    ...Array.from({ length: 14 }).map((_, i) => ({
      date: formatDate(i),
      predictedDemand: 200 + Math.floor(Math.random() * 80),
      lowerBound: 160 + Math.floor(Math.random() * 40),
      upperBound: 260 + Math.floor(Math.random() * 60),
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
