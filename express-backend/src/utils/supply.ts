/**
 * Inbound supply that has not arrived.
 *
 * `DistributorOrder` records no delivery date, so lateness can only be derived from
 * the requested date and how much of the order is still short. Kept pure and separate
 * from the query that feeds it so the aggregation is testable without a database.
 */

export interface SupplyOrderRow {
  productId: string;
  warehouseId: string;
  quantity: number;
  fulfilledQuantity: number | null;
  requestedDate: Date;
}

export interface OverdueSupply {
  productId: string;
  warehouseId: string;
  /** Units ordered but not yet received, summed across every late order for the pair. */
  outstanding: number;
  /** The worst lateness in the group, not the average - that is the one to act on. */
  daysLate: number;
  orderCount: number;
}

const MS_PER_DAY = 86_400_000;

const pairKey = (productId: string, warehouseId: string) => `${productId}:${warehouseId}`;

/**
 * Rolls late orders up to one row per product/warehouse.
 *
 * Orders that arrived in full are dropped rather than counted as zero: a pair whose
 * every order landed has nothing outstanding and must not appear at all, which is not
 * the same as appearing with `outstanding: 0`.
 *
 * `now` is a parameter rather than read from the clock so a test can pin it.
 */
export const aggregateOverdueSupply = (
  orders: SupplyOrderRow[],
  now: number,
): OverdueSupply[] => {
  const byPair = new Map<string, OverdueSupply>();

  for (const order of orders) {
    const shortfall = order.quantity - (order.fulfilledQuantity ?? 0);
    if (shortfall <= 0) continue;

    const key = pairKey(order.productId, order.warehouseId);
    const daysLate = Math.floor((now - order.requestedDate.getTime()) / MS_PER_DAY);
    const current = byPair.get(key);

    if (current) {
      current.outstanding += shortfall;
      current.daysLate = Math.max(current.daysLate, daysLate);
      current.orderCount += 1;
    } else {
      byPair.set(key, {
        productId: order.productId,
        warehouseId: order.warehouseId,
        outstanding: shortfall,
        daysLate,
        orderCount: 1,
      });
    }
  }

  return [...byPair.values()];
};
