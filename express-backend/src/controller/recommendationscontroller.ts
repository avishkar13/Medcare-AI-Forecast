import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

export const recommendationsController = {
  getKpi: async (_req: Request, res: Response) => {
    res.json({
      totalRecommendations: 12,
      potentialSavings: 17800,
      executionRate: 85.5
    });
  },

  getImpact: async (_req: Request, res: Response) => {
    res.json({
      currentSupplyChainCost: 49300,
      aiOptimizedCost: 31500,
      projectedSavings: 17800,
      costReductionPercentage: 36.1,
      categories: {
        stockout: 45,
        excessInventory: 30,
        expiry: 15,
        transfers: 10
      }
    });
  },

  getSummary: async (_req: Request, res: Response) => {
    res.json({
      replenishments: 5,
      transfers: 3,
      expedites: 2,
      discounts: 2
    });
  },

  getList: async (_req: Request, res: Response) => {
    try {
      const recommendations = await prisma.recommendation.findMany({
        include: { product: true, warehouse: true, signals: true },
        take: 50
      });

      const formatted = recommendations.map((r: any) => ({
        id: r.id,
        title: r.actionType ? `${r.actionType.toUpperCase()} ${r.quantity} UNITS` : `ACTION REQUIRED FOR ${r.product.sku}`,
        actionType: r.actionType || "Replenish",
        priority: r.priority === "CRITICAL" ? "Critical" : r.priority === "HIGH" ? "High" : r.priority === "MEDIUM" ? "Medium" : "Low",
        confidence: r.confidence || 94,
        reason: r.message,
        sku: r.product.sku,
        location: r.warehouse.name,
        currentStock: 800, // mock
        forecastDemand: 2100, // mock
        recommendedQuantity: r.quantity || 0,
        expectedImpact: r.expectedImpact || "Avoids potential stockout penalties",
        impactValue: r.impactValue || 1000,
        signals: r.signals || [
          { type: "Demand", label: "Demand", direction: "up" }
        ],
        status: r.status === "OPEN" ? "Pending" : r.status === "COMPLETED" ? "Executed" : "Dismissed",
        createdAt: r.createdAt.toISOString()
      }));

      res.json(formatted);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch recommendations" });
    }
  },

  getIntelligence: async (_req: Request, res: Response) => {
    res.json({
      signals: {
        demandForecast: 92,
        inventoryPosition: 89,
        leadTime: 84,
        expiryRisk: 91
      },
      modelConfidence: 89.4,
      explanation: "Recommendations combine forecast demand, inventory levels, lead times, and expiry risk to optimize supply chain cost."
    });
  },

  execute: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      await prisma.recommendation.update({
        where: { id },
        data: { status: "COMPLETED" }
      });
      res.json({ success: true, status: "Executed" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to execute recommendation" });
    }
  },

  dismiss: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      await prisma.recommendation.update({
        where: { id },
        data: { status: "REJECTED" } 
      });
      res.json({ success: true, status: "Dismissed" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to dismiss recommendation" });
    }
  }
};
