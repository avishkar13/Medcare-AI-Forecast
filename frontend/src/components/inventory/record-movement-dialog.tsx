"use client";

import { useState } from "react";
import { AlertTriangle, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRecordMovement } from "@/hooks/use-movements";
import { useProducts, useWarehouses } from "@/hooks/use-masterdata";
import { MOVEMENT_TYPES } from "@/lib/api/movements";
import { useScope } from "@/hooks/use-scope";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm " +
  "outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring";

/**
 * The one action in the product that changes stock.
 *
 * `quantity` is entered as a plain positive number: the movement type carries the
 * direction, and asking a user to type `-180` for a sale is how a receipt gets
 * recorded as a sale. `ADJUSTMENT` is the exception and shows a sign control, because
 * it is the one type where the direction is genuinely the user's choice.
 */
export function RecordMovementDialog() {
  const { dc, dcCode } = useScope();
  const { data: warehouses } = useWarehouses();
  const { data: products } = useProducts();
  const record = useRecordMovement();

  const [open, setOpen] = useState(false);
  const [warehouse, setWarehouse] = useState("");
  const [sku, setSku] = useState("");
  const [movementType, setMovementType] = useState<string>("SALE");
  const [quantity, setQuantity] = useState("");
  const [adjustDown, setAdjustDown] = useState(false);
  const [reference, setReference] = useState("");

  const selectedDc =
    warehouse || dcCode || warehouses?.find((row) => row.id === dc)?.code || "";

  const amount = Number(quantity);
  const isValid =
    selectedDc !== "" && sku !== "" && Number.isFinite(amount) && amount > 0;

  const submit = async () => {
    if (!isValid) return;

    const result = await record.mutateAsync({
      dc: selectedDc,
      body: {
        sku,
        movementType,
        quantity: movementType === "ADJUSTMENT" && adjustDown ? -amount : amount,
        ...(reference ? { reference } : {}),
      },
      // Minted per user action, not per attempt: a retry after a dropped response must
      // resolve to the same movement rather than applying the sale twice.
      idempotencyKey:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `mv-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    });

    /**
     * The resulting position, not just "saved".
     *
     * `clamped` means the server moved less than was asked for because the shelf did
     * not hold it. This dialog used to close silently on either outcome, so an
     * operator who sold 500 against 300 on hand walked away believing 500 had left.
     */
    const position = `${result.inventory.onHand.toLocaleString()} on hand · ${result.inventory.available.toLocaleString()} available`;

    if (result.clamped) {
      toast.warning(`${sku} movement was capped by available stock`, {
        description: `Less than ${amount.toLocaleString()} units could be moved. Now ${position}.`,
      });
    } else {
      toast.success(`${sku} updated at ${selectedDc}`, {
        description: result.alertsRaised.length
          ? `${position}. Raised ${result.alertsRaised.length} alert${result.alertsRaised.length === 1 ? "" : "s"}.`
          : position,
      });
    }

    setQuantity("");
    setReference("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="h-8 gap-2 cursor-pointer">
            <PackagePlus className="h-3.5 w-3.5" />
            Record Movement
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record a stock movement</DialogTitle>
          <DialogDescription>
            This changes stock immediately and re-runs alert detection.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="movement-dc">Distribution centre</Label>
            <select
              id="movement-dc"
              className={selectClass}
              value={selectedDc}
              onChange={(event) => setWarehouse(event.target.value)}
            >
              <option value="">Select a DC…</option>
              {(warehouses ?? []).map((row) => (
                <option key={row.id} value={row.code}>
                  {row.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="movement-sku">SKU</Label>
            <select
              id="movement-sku"
              className={selectClass}
              value={sku}
              onChange={(event) => setSku(event.target.value)}
            >
              <option value="">Select a product…</option>
              {(products ?? []).map((row) => (
                <option key={row.id} value={row.sku}>
                  {row.sku} — {row.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="movement-type">Type</Label>
              <select
                id="movement-type"
                className={selectClass}
                value={movementType}
                onChange={(event) => setMovementType(event.target.value)}
              >
                {MOVEMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="movement-qty">Quantity</Label>
              <Input
                id="movement-qty"
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="180"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
          </div>

          {movementType === "ADJUSTMENT" && (
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <input
                type="checkbox"
                checked={adjustDown}
                onChange={(event) => setAdjustDown(event.target.checked)}
              />
              Adjust downwards (reduce stock)
            </label>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="movement-ref">Reference (optional)</Label>
            <Input
              id="movement-ref"
              placeholder="Order number, count sheet…"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </div>

          {record.isError && (
            <p className="flex items-start gap-2 text-xs font-medium text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {record.error instanceof Error
                ? record.error.message
                : "The movement was not recorded."}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} className="cursor-pointer">
            Cancel
          </Button>
          <Button onClick={submit} disabled={!isValid || record.isPending} className="cursor-pointer">
            {record.isPending ? "Recording…" : "Record movement"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
