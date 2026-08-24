export interface ForecastPageKPIs {
  forecastedDemand: number;
  forecastHorizonDays: number;
  forecastAccuracy: number;
  accuracyChange: number;
  confidenceLevel: number;
  expectedPeakDemand: number;
  peakDate: string;
  demandGrowth: number;
}

export interface ForecastSummaryData {
  predictedPeak: number;
  peakDate: string;
  avgDailyDemand: number;
  minExpectedDemand: number;
  maxExpectedDemand: number;
  confidenceRange: [number, number];
  historicalAccuracy: number;
  expectedTrend: "Growing" | "Stable" | "Declining";
}

export interface ForecastTrendData {
  sevenDayTrend: number; // percentage
  thirtyDayTrend: number; // percentage
  seasonalPattern: string;
  growthRate: number; // percentage
  demandVolatility: "High" | "Medium" | "Low";
}

export interface ForecastInsightData {
  keyDriver: string;
  riskImplication: string;
  confidence: "High" | "Medium" | "Low";
  recommendedAttention: string;
  detailedInsight: string;
}

export type TrendIndicator = "Growing" | "Stable" | "Declining";
export type RiskLevel = "Critical" | "High" | "Medium" | "Low";

export interface ForecastTableItem {
  id: string; // SKU
  product: string;
  category: string;
  currentDemand: number;
  forecastDemand: number;
  growth: number; // percentage
  accuracy: number; // percentage
  confidence: number; // percentage
  trend: TrendIndicator;
  risk: RiskLevel;
}

export interface NetworkForecastItem {
  id: string;
  dcName: string;
  currentDemand: number;
  forecastDemand: number;
  growth: number;
  confidence: number;
  peakDemand: number;
  peakDate: string;
}

export interface SeasonalityData {
  weeklyPattern: { day: string; value: number }[];
  monthlyTrend: { month: string; value: number }[];
  seasonalUplift: number; // percentage
  volatility: string;
}

export interface ModelPerformanceItem {
  modelName: string;
  mape: number; // Mean Absolute Percentage Error
  mae: number; // Mean Absolute Error
  rmse: number; // Root Mean Square Error
  accuracy: number;
  bias: number; // percentage
  isPrimary: boolean;
}

export interface ForecastImpactData {
  stockoutRiskReduction: number; // percentage
  safetyStockOptimization: number; // percentage
  reorderQuantityChange: number; // percentage
  excessInventoryReduction: number; // value in dollars
  expectedInventoryValue: number; // value in dollars
  insightText: string;
}
