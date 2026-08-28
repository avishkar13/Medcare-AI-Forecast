"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlansHeader } from "@/components/plans/plans-header";
import { SupplyPlanTable } from "@/components/plans/supply-plan-table";
import { DrpPlanTable } from "@/components/plans/drp-plan-table";
import {
  useDrpPlanDecision,
  useDrpPlans,
  useSupplyPlanDecision,
  useSupplyPlans,
} from "@/hooks/use-plans";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFormatters } from "@/hooks/use-formatters";
import { useAuthStore } from "@/store/auth.store";

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2 text-xs font-medium shadow-sm " +
  "outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring cursor-pointer";

const ALL = "all";

/**
 * The plan review surface.
 *
 * `SupplyPlan` and `DRPPlan` are what the executor writes between forecasting and
 * recommending, and both routes have been reachable since the engine landed with no
 * screen reading them - so the only visible trace of a planning run was the
 * recommendations at the end of it.
 */
export default function PlansPage() {
  const { formatNumber } = useFormatters();
  const canDecide = useAuthStore((state) => state.hasPermission("simulation:run"));

  const [status, setStatus] = useState(ALL);
  const [source, setSource] = useState(ALL);
  const [sku, setSku] = useState("");
  const debouncedSku = useDebouncedValue(sku);

  const supplyQuery = useSupplyPlans({
    ...(status === ALL ? {} : { status }),
    ...(source === ALL ? {} : { source }),
    ...(debouncedSku ? { sku: debouncedSku } : {}),
    pageSize: 100,
  });

  const drpQuery = useDrpPlans({
    ...(status === ALL ? {} : { status }),
    ...(debouncedSku ? { sku: debouncedSku } : {}),
    pageSize: 100,
  });

  const supplyDecision = useSupplyPlanDecision();
  const drpDecision = useDrpPlanDecision();

  // one row at a time, so only the row being decided shows a spinner
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const decide = (
    kind: "supply" | "transfer",
    id: string,
    action: "approve" | "reject",
  ) => {
    setDecidingId(id);
    const decision = kind === "supply" ? supplyDecision : drpDecision;
    const mutation = action === "approve" ? decision.approve : decision.reject;

    mutation.mutate(id, {
      onSuccess: () => toast.success(`${kind === "supply" ? "Plan" : "Transfer"} ${action}d`),
      // a plan decided in another tab answers 409, which is information, not a crash
      onError: (error: Error) =>
        toast.error(`Could not ${action} the ${kind}`, { description: error.message }),
      onSettled: () => setDecidingId(null),
    });
  };

  const supplyPlans = supplyQuery.data?.data ?? [];
  const drpPlans = drpQuery.data?.data.items ?? [];
  const planningRunId = supplyQuery.data?.meta.planningRunId ?? null;
  const isFetching = supplyQuery.isFetching || drpQuery.isFetching;

  const refresh = () => {
    void supplyQuery.refetch();
    void drpQuery.refetch();
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 pb-10">
      <PlansHeader
        planningRunId={planningRunId}
        isFetching={isFetching}
        onRefresh={refresh}
      />

      <Tabs defaultValue="supply" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 rounded-lg bg-muted/60 p-1">
          <TabsTrigger value="supply" className="text-xs font-semibold">
            Supply plans ({supplyQuery.data?.meta.total ?? 0})
          </TabsTrigger>
          <TabsTrigger value="drp" className="text-xs font-semibold">
            Transfers ({drpQuery.data?.meta.total ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="supply" className="mt-4">
          <Card>
            <CardContent className="flex flex-col gap-4 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  placeholder="Filter by SKU…"
                  className="h-8 max-w-xs text-sm"
                  value={sku}
                  onChange={(event) => setSku(event.target.value)}
                />
                <select
                  className={selectClass}
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  aria-label="Plan status"
                >
                  <option value={ALL}>All statuses</option>
                  <option value="PROPOSED">Proposed</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
                <select
                  className={selectClass}
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  aria-label="Supply source"
                >
                  <option value={ALL}>All sources</option>
                  <option value="PLANNED_SUPPLY">New order</option>
                  <option value="TRANSFER">From a transfer</option>
                  <option value="EXISTING">Already inbound</option>
                </select>
                <span className="ml-auto text-xs text-muted-foreground">
                  {supplyQuery.data?.meta.total ?? 0} plans
                </span>
              </div>

              <SupplyPlanTable
                plans={supplyPlans}
                isPending={supplyQuery.isPending}
                isError={supplyQuery.isError}
                canDecide={canDecide}
                decidingId={decidingId}
                onApprove={(id) => decide("supply", id, "approve")}
                onReject={(id) => decide("supply", id, "reject")}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drp" className="mt-4">
          <Card>
            <CardContent className="flex flex-col gap-4 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  placeholder="Filter by SKU…"
                  className="h-8 max-w-xs text-sm"
                  value={sku}
                  onChange={(event) => setSku(event.target.value)}
                />
                <select
                  className={selectClass}
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  aria-label="Transfer status"
                >
                  <option value={ALL}>All statuses</option>
                  <option value="PROPOSED">Proposed</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
                {/* totalUnits covers the whole filtered set, not just this page */}
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatNumber(drpQuery.data?.data.totalUnits ?? 0)} units moving across{" "}
                  {drpQuery.data?.meta.total ?? 0} lanes
                </span>
              </div>

              <DrpPlanTable
                plans={drpPlans}
                isPending={drpQuery.isPending}
                isError={drpQuery.isError}
                canDecide={canDecide}
                decidingId={decidingId}
                onApprove={(id) => decide("transfer", id, "approve")}
                onReject={(id) => decide("transfer", id, "reject")}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
