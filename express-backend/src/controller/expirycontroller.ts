import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

export const expiryController = {
  getBatches: async (_req: Request, res: Response) => {
    try {
      const batches = await prisma.inventoryBatch.findMany({
        include: { product: true, warehouse: true },
        take: 50,
      });

      const formatted = batches.map((b: any) => {
        const daysRemaining = Math.max(0, Math.floor((b.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        const risk = daysRemaining < 30 ? "critical" : daysRemaining < 60 ? "high" : "medium";
        
        return {
          id: b.id,
          sku: b.product.sku,
          productName: b.product.name,
          location: b.warehouse.name,
          quantity: b.quantity,
          manufacturingDate: b.manufacturingDate,
          expiryDate: b.expiryDate,
          daysRemaining,
          valueAtRisk: b.quantity * Number(b.product.unitCost),
          expiryRisk: risk,
          riskLevel: risk,
          wasteValue: b.quantity * Number(b.product.unitCost),
          demandCoverage: 100, 
          inventoryValue: b.quantity * Number(b.product.unitCost),
          batchNumber: b.batchNumber
        };
      });
      res.json(formatted);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch expiry batches" });
    }
  },

  getOverview: async (_req: Request, res: Response) => {
    res.json({
      totalAtRiskValue: 45000,
      criticalBatchesCount: 12,
      preventedWaste: 12500,
      averageDaysToExpiry: 85
    });
  },

  getTimeline: async (_req: Request, res: Response) => {
    res.json([
      { month: "2024-04", valueExpiring: 5400, batchCount: 3 },
      { month: "2024-05", valueExpiring: 12000, batchCount: 8 }
    ]);
  },

  getDcExposure: async (_req: Request, res: Response) => {
    res.json([
      { dcId: "DC-01", dcName: "Northeast DC", totalExposureValue: 15400, criticalExposure: 4500 }
    ]);
  },

  getAiAssessment: async (_req: Request, res: Response) => {
    res.json({
      riskAssessment: "Elevated risk in West Coast DC due to slow-moving inventory.",
      recommendedStrategy: "Initiate network transfer for Cetirizine 10mg.",
      confidence: 88
    });
  },

  getWastePrevention: async (_req: Request, res: Response) => {
    try {
      const records = await prisma.wastePreventionRecord.findMany({ take: 10 });
      res.json(records);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch waste prevention records" });
    }
  },

  prioritizeBatch: async (_req: Request, res: Response) => {
    res.json({ success: true, status: "prioritized" });
  }
};
