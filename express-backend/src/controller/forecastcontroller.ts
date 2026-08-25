import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

export const forecastController = {
  getKpi: async (_req: Request, res: Response) => {
    res.json({
      forecastedDemand: 12480,
      forecastHorizonDays: 30,
      forecastAccuracy: 88.5,
      accuracyChange: 1.2,
      confidenceLevel: 94,
      expectedPeakDemand: 620,
      peakDate: new Date(Date.now() + 86400000 * 15).toISOString(),
      demandGrowth: 8.4
    });
  },

  getSummary: async (_req: Request, res: Response) => {
    res.json({
      predictedPeak: 620,
      peakDate: new Date(Date.now() + 86400000 * 15).toISOString(),
      avgDailyDemand: 416,
      minExpectedDemand: 390,
      maxExpectedDemand: 710,
      confidenceRange: [540, 690],
      historicalAccuracy: 88.5,
      expectedTrend: "Growing"
    });
  },

  getMainChart: async (_req: Request, res: Response) => {
    res.json({
      "SKU-LIS-10": [
        {
          date: new Date().toISOString(),
          actualDemand: 160,
          predictedDemand: 150,
          lowerBound: 120,
          upperBound: 190
        }
      ]
    });
  },

  getTrend: async (_req: Request, res: Response) => {
    res.json({
      sevenDayTrend: 4.2,
      thirtyDayTrend: 8.4,
      seasonalPattern: "Weekly (Tue-Thu peaks)",
      growthRate: 12.5,
      demandVolatility: "Low"
    });
  },

  getSeasonality: async (_req: Request, res: Response) => {
    res.json({
      weeklyPattern: [
        { day: "Mon", value: 105 },
        { day: "Tue", value: 120 },
        { day: "Wed", value: 125 },
        { day: "Thu", value: 110 },
        { day: "Fri", value: 95 },
        { day: "Sat", value: 70 },
        { day: "Sun", value: 65 }
      ],
      monthlyTrend: [
        { month: "Jan", value: 110 },
        { month: "Feb", value: 115 },
        { month: "Mar", value: 130 }
      ],
      seasonalUplift: 14.5,
      volatility: "Low (Stable predictable peaks)"
    });
  },

  getNetwork: async (_req: Request, res: Response) => {
    try {
      const warehouses = await prisma.warehouse.findMany();
      const formatted = warehouses.map((w: any) => ({
        id: w.code,
        dcName: w.name,
        currentDemand: 4200,
        forecastDemand: 4650,
        growth: 10.7,
        confidence: 94,
        peakDemand: 4800,
        peakDate: new Date(Date.now() + 86400000 * 10).toISOString()
      }));
      res.json(formatted);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch network forecast" });
    }
  },

  getInsight: async (_req: Request, res: Response) => {
    res.json({
      keyDriver: "Recurring weekly pattern + Northeast DC volume increase",
      riskImplication: "Inventory may fall below safety stock during peak",
      confidence: "High",
      recommendedAttention: "Review replenishment schedule",
      detailedInsight: "Demand is expected to increase by 8.4% over the next 30 days due to seasonal flu trends."
    });
  },

  getPerformance: async (_req: Request, res: Response) => {
    res.json([
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
        modelName: "ARIMA",
        mape: 6.5,
        mae: 18.2,
        rmse: 22.4,
        accuracy: 88.5,
        bias: -1.2,
        isPrimary: false
      }
    ]);
  },

  getImpact: async (_req: Request, res: Response) => {
    res.json({
      stockoutRiskReduction: 14,
      safetyStockOptimization: 8,
      reorderQuantityChange: -3.5,
      excessInventoryReduction: 17800,
      expectedInventoryValue: 1227200,
      insightText: "Improved forecast accuracy is expected to reduce stockout exposure by 14% and optimize safety stock levels across tier-1 DCs."
    });
  },

  getSkus: async (_req: Request, res: Response) => {
    try {
      const products = await prisma.product.findMany({ take: 50 });
      const formatted = products.map((p: any) => ({
        id: p.sku,
        product: p.name,
        category: p.category || "General",
        currentDemand: 165,
        forecastDemand: 179,
        growth: 8.4,
        accuracy: 94.2,
        confidence: 96,
        trend: "Growing",
        risk: "Critical"
      }));
      res.json(formatted);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch SKU forecasts" });
    }
  }
};
