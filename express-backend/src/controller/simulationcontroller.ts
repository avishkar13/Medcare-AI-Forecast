import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

export const simulationController = {
  run: async (req: Request, res: Response) => {
    try {
      const params = req.body; 

      const riskDelta = params.demandShock ? params.demandShock * 0.3 : 0;
      
      const result = {
        metrics: [
          { id: "stockout_risk", label: "Stockout Risk", value: 15.2 + riskDelta, delta: riskDelta },
          { id: "service_level", label: "Service Level", value: Math.max(0, 95 - riskDelta), delta: -riskDelta },
          { id: "total_cost", label: "Total Cost", value: 125000 + (riskDelta * 1000), delta: riskDelta * 1000 }
        ],
        skuImpacts: [
          { sku: "SKU-LIS-10", impactScore: 92, stockoutDays: 5 }
        ],
        dcImpacts: [
          { dcId: "DC-01", capacityUtilization: 105, bottleneck: true }
        ],
        risks: [
          { type: "financial", description: "High expediting costs required", severity: "high" }
        ],
        financial: {
          holdingCostChange: 2000,
          stockoutPenaltyChange: 15000,
          expeditingCostChange: 7000
        },
        aiInsight: {
          overallRisk: riskDelta > 10 ? "critical" : "moderate",
          summary: `Stockout risk increases significantly due to ${params.demandShock || 0}% demand surge.`,
          recommendedMitigation: "Pre-position inventory in Northeast DC."
        }
      };

      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to run simulation" });
    }
  },

  getHistory: async (_req: Request, res: Response) => {
    try {
      const scenarios = await prisma.scenario.findMany({ take: 20, orderBy: { createdAt: "desc" } });
      const formatted = scenarios.map((s: any) => ({
        id: s.id,
        scenario: s.name,
        preset: "custom",
        date: s.createdAt.toISOString(),
        keyChange: `Demand Mult: ${s.demandMultiplier}`,
        riskLevel: s.riskLevel || "moderate",
        resultSummary: s.description || "Simulation completed",
        params: { 
          demandShock: (s.demandMultiplier - 1) * 100, 
          inventoryAvailability: 100, 
          supplierLeadTime: (s.leadTimeMultiplier - 1) * 10,
          serviceLevelTarget: s.serviceLevelTarget * 100,
          distributionCapacity: (s.capacityMultiplier - 1) * 100,
          transportationCost: 0
        }
      }));
      res.json(formatted);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch simulation history" });
    }
  },

  getSaved: async (_req: Request, res: Response) => {
    try {
      res.json([
        {
          id: "saved-1001",
          name: "Holiday Season Prep",
          preset: "demand-surge",
          params: { demandShock: 25 },
          metrics: [],
          riskLevel: "high",
          date: new Date().toISOString()
        }
      ]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch saved scenarios" });
    }
  },

  save: async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, params } = req.body;
      const user = await prisma.user.findFirst(); 
      
      if (!user) {
         res.status(400).json({ error: "No user found to associate scenario" });
         return;
      }

      const scenario = await prisma.scenario.create({
        data: {
          name: name || "Saved Scenario",
          description: "Saved from UI",
          demandMultiplier: 1 + ((params?.demandShock || 0) / 100),
          createdById: user.id
        }
      });
      res.json({ success: true, id: scenario.id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to save scenario" });
    }
  },

  deleteSaved: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      await prisma.scenario.delete({ where: { id } });
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete saved scenario" });
    }
  }
};
