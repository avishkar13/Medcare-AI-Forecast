"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QueryError } from "@/components/ui/query-state";
import { useInventoryPlans } from "@/hooks/use-movements";

/**
 * The projection curve. Phase 3.9.
 *
 * Reads `InventoryPlan`, which the executor has written per position per day since
 * Phase C and which nothing has ever read. Three things on one axis: what stock is
 * projected to do, the band the forecast allowed for, and the reorder point it is
 * heading towards - with the day the curve crosses zero marked.
 *
 * **A single position only.** Every pair overlaid is not a curve anyone can read, so
 * the route says which it returned and this refuses to draw the aggregate rather than
 * drawing something misleading.
 */
interface ProjectionChartProps {
  runId: string | null;
  sku?: string;
  warehouse?: string;
}

export function ProjectionChart({ runId, sku, warehouse }: ProjectionChartProps) {
  const { data, isPending, isError } = useInventoryPlans(runId, {
    ...(sku ? { sku } : {}),
    ...(warehouse ? { warehouse } : {}),
  });

  if (isError) return <QueryError label="the projection" />;

  if (!runId) {
    return (
      <Card className="h-full">
        <CardContent className="py-10 text-sm text-muted-foreground">
          No completed planning run yet. Run the planner to produce a projection.
        </CardContent>
      </Card>
    );
  }

  if (isPending) {
    return (
      <Card className="h-full">
        <CardContent className="py-10 text-sm text-muted-foreground">
          Loading the projection…
        </CardContent>
      </Card>
    );
  }

  if (data.scope === "aggregate") {
    return (
      <Card className="h-full">
        <CardContent className="py-10 text-sm text-muted-foreground">
          Pick a SKU and a DC to see its projection. Every position overlaid is not a
          curve that can be read.
        </CardContent>
      </Card>
    );
  }

  if (data.points.length === 0) {
    return (
      <Card className="h-full">
        <CardContent className="py-10 text-sm text-muted-foreground">
          This run produced no plan for that position.
        </CardContent>
      </Card>
    );
  }

  // Recharts stacks an area from a baseline, so the band is drawn as p10 plus the
  // width above it rather than as two independent series.
  const points = data.points.map((point) => ({
    ...point,
    bandBase: point.p10,
    bandWidth: point.p10 !== null && point.p90 !== null ? point.p90 - point.p10 : null,
  }));

  const crossing = points.find((point) => point.date === data.stockoutDate);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold">Projected stock</CardTitle>
            <CardDescription>
              What this position is projected to do over the next {data.horizonDays} days.
            </CardDescription>
          </div>
          {data.stockoutDate ? (
            <Badge variant="outline" className="gap-1.5 border-destructive/40 text-destructive">
              <AlertTriangle className="h-3 w-3" />
              Stockout {data.stockoutDate}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-success/40 text-success">
              No stockout in horizon
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickMargin={8} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} width={56} />
            <RechartsTooltip 
              contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
              labelStyle={{ fontWeight: 'bold', marginBottom: '8px', color: 'var(--card-foreground)' }}
              formatter={(value, name) => [
                typeof value === "number" ? Math.round(value) : value,
                name,
              ]}
            />

            {/* The forecast band the planner allowed for, behind everything else. */}
            <Area
              dataKey="bandBase"
              stackId="band"
              stroke="none"
              fill="transparent"
              name="p10"
              isAnimationActive={false}
            />
            <Area
              dataKey="bandWidth"
              stackId="band"
              stroke="none"
              fillOpacity={0.15}
              fill="var(--color-primary)"
              name="p10–p90 demand"
              isAnimationActive={false}
            />

            {/* The two policy lines the projection is judged against. */}
            <Line
              dataKey="reorderPoint"
              stroke="var(--color-warning)"
              strokeDasharray="5 4"
              dot={false}
              name="Reorder point"
              isAnimationActive={false}
            />
            <Line
              dataKey="safetyStock"
              stroke="var(--color-muted-foreground)"
              strokeDasharray="2 4"
              dot={false}
              name="Safety stock"
              isAnimationActive={false}
            />

            <Line
              dataKey="projectedOnHand"
              stroke="var(--color-primary)"
              strokeWidth={2}
              dot={false}
              name="Projected on hand"
              isAnimationActive={false}
            />

            {/* Zero, so the crossing is visible rather than inferred. */}
            <ReferenceLine y={0} stroke="var(--color-destructive)" strokeOpacity={0.5} />

            {crossing && (
              <ReferenceDot
                x={crossing.date}
                y={crossing.projectedOnHand}
                r={5}
                fill="var(--color-destructive)"
                stroke="none"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
