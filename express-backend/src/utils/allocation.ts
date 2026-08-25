import { allocateTransfers } from "./inventory.js";

export interface AllocatablePosition {
  onHand: number;
  reorderPoint: number;
  maximumInventory: number | null;
}

export interface TransferPlan<T> {
  destination: T;
  source: T;
  need: number;
  available: number;
  quantity: number;
  unitsRescued: number;
}

export interface PlanTransfersInput<T> {
  positions: T[];
  wasteUnitsOf: (position: T) => number;
  minimumUnits?: number;
}

const isShort = (position: AllocatablePosition) => position.onHand < position.reorderPoint;

const isExcess = (position: AllocatablePosition) =>
  position.maximumInventory !== null && position.onHand > position.maximumInventory;

// Pairs positions of one product that are short against positions of the same product
// holding stock above their maximum, draining the sources that would otherwise expire
// first. The matching itself lives in allocateTransfers, which is where the two
// depleting pools - available units and units that would be wasted - are kept honest.
export const planTransfers = <T extends AllocatablePosition>({
  positions,
  wasteUnitsOf,
  minimumUnits = 1,
}: PlanTransfersInput<T>): TransferPlan<T>[] => {
  const shortages = positions
    .filter(isShort)
    .map((position) => ({ position, need: position.reorderPoint - position.onHand }))
    .sort((left, right) => right.need - left.need);

  // A position below its own reorder point is never a donor, even when it also sits
  // above its maximum. That contradiction is reachable whenever maximumInventory is
  // configured below reorderPoint, and without this guard the position resupplies
  // itself - a transfer from a warehouse to that same warehouse.
  const surpluses = positions
    .filter((position) => isExcess(position) && !isShort(position))
    .map((position) => ({
      position,
      available: position.onHand - (position.maximumInventory ?? 0),
      wasteRemaining: wasteUnitsOf(position),
    }))
    .sort(
      (left, right) =>
        right.wasteRemaining - left.wasteRemaining || right.available - left.available,
    );

  const matches = allocateTransfers(
    shortages.map((shortage) => shortage.need),
    surpluses,
    minimumUnits,
  );

  const plans: TransferPlan<T>[] = [];

  for (const [index, match] of matches.entries()) {
    if (!match) continue;

    const destination = shortages[index]!;
    const source = surpluses[match.sourceIndex]!;

    plans.push({
      destination: destination.position,
      source: source.position,
      need: destination.need,
      available: source.available,
      quantity: match.quantity,
      unitsRescued: match.unitsRescued,
    });
  }

  return plans;
};
