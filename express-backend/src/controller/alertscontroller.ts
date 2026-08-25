import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

export const alertsController = {
  getAlerts: async (_req: Request, res: Response) => {
    try {
      const alerts = await prisma.alert.findMany({
        orderBy: { detectedAt: "desc" },
        take: 50,
        include: { metrics: true, timeline: true }
      });
      res.json(alerts);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  },

  getOverview: async (_req: Request, res: Response) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const criticalCount = await prisma.alert.count({ where: { severity: "critical" } });
      const highCount = await prisma.alert.count({ where: { severity: "high" } });
      const unresolvedCount = await prisma.alert.count({ where: { status: { in: ["new", "acknowledged", "in_progress"] } } });
      const todayCount = await prisma.alert.count({ where: { detectedAt: { gte: today } } });
      const resolvedCount = await prisma.alert.count({ where: { status: "resolved" } });
      
      const totalCount = criticalCount + highCount + unresolvedCount + resolvedCount;
      const resolvedPercentage = totalCount === 0 ? 100 : Math.round((resolvedCount / totalCount) * 100);

      res.json({
        criticalCount,
        highCount,
        unresolvedCount,
        todayCount,
        todayDelta: 0, // Mocked delta
        resolvedCount,
        resolvedPercentage,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch alert overview" });
    }
  },

  getTrends: async (_req: Request, res: Response) => {
    try {
      res.json([
        { date: new Date().toISOString().split("T")[0], critical: 2, high: 4, medium: 10 }
      ]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch alert trends" });
    }
  },

  getDistribution: async (_req: Request, res: Response) => {
    try {
      const alerts = await prisma.alert.findMany();
      const byLocation = alerts.reduce((acc: Record<string, number>, curr: any) => {
        acc[curr.location] = (acc[curr.location] || 0) + 1;
        return acc;
      }, {});

      const byType = alerts.reduce((acc: Record<string, number>, curr: any) => {
        acc[curr.type] = (acc[curr.type] || 0) + 1;
        return acc;
      }, {});

      res.json({ byLocation, byType });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch alert distribution" });
    }
  },

  getHealth: async (_req: Request, res: Response) => {
    res.json({ systemUptime: 99.9, sensorsActive: 1420, lastSync: new Date().toISOString() });
  },

  acknowledge: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const alert = await prisma.alert.update({
        where: { id },
        data: { status: "acknowledged" },
      });
      res.json({ success: true, status: alert.status });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to acknowledge alert" });
    }
  },

  resolve: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const alert = await prisma.alert.update({
        where: { id },
        data: { status: "resolved" },
      });
      res.json({ success: true, status: alert.status });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to resolve alert" });
    }
  },
  
  markAllRead: async (_req: Request, res: Response) => {
    try {
      const result = await prisma.alert.updateMany({
        where: { status: "new" },
        data: { status: "acknowledged" },
      });
      res.json({ success: true, updatedCount: result.count });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to mark all as read" });
    }
  },
};
