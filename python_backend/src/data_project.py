"""Read MedCare project data from the PostgreSQL/Prisma schema.

The ML service is read-only: it never writes forecasts or planning decisions.
"""
from __future__ import annotations

import os
from datetime import datetime, date
from typing import Optional

from dotenv import load_dotenv
import pandas as pd
import psycopg

load_dotenv()

def database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL is required for project mode. Example: "
            "postgresql://cognizant:cognizant_secret@localhost:5432/cognizant"
        )
    return url


def _query_df(sql: str, params=()) -> pd.DataFrame:
    with psycopg.connect(database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
            columns = [d.name for d in cur.description]
    return pd.DataFrame(rows, columns=columns)


def load_history(sku: str, warehouse_code: str, min_date: Optional[date] = None) -> pd.DataFrame:
    """Load DemandHistory using the project's Product.sku/Product.id and Warehouse.code/Warehouse.id."""
    sql = """
        SELECT
            dh.date,
            p.sku AS sku_id,
            w.code AS dc_id,
            dh."orderedQuantity" AS demand,
            CASE WHEN dh."promotionFlag" THEN 1 ELSE 0 END AS promotion_flag,
            CASE WHEN dh."holidayFlag" THEN 1 ELSE 0 END AS holiday_flag,
            dh.season
        FROM "DemandHistory" dh
        JOIN "Product" p ON p.id = dh."productId"
        JOIN "Warehouse" w ON w.id = dh."warehouseId"
        WHERE (p.sku = %s OR p.id = %s)
          AND (w.code = %s OR w.id = %s)
         AND (%s::date IS NULL OR dh.date >= %s::date)
        ORDER BY dh.date ASC
    """
    cutoff = min_date.isoformat() if min_date else None
    return _query_df(sql, (sku, sku, warehouse_code, warehouse_code, cutoff, cutoff))


def load_all_history() -> pd.DataFrame:
    """Load all demand history for project-mode training."""
    sql = """
        SELECT
            dh.date,
            p.sku AS sku_id,
            w.code AS dc_id,
            dh."orderedQuantity" AS demand,
            CASE WHEN dh."promotionFlag" THEN 1 ELSE 0 END AS promotion_flag,
            CASE WHEN dh."holidayFlag" THEN 1 ELSE 0 END AS holiday_flag,
            dh.season
        FROM "DemandHistory" dh
        JOIN "Product" p ON p.id = dh."productId"
        JOIN "Warehouse" w ON w.id = dh."warehouseId"
        ORDER BY p.sku, w.code, dh.date ASC
    """
    return _query_df(sql)


def load_future_promotions(sku: str, warehouse_code: str, start: datetime, end: datetime) -> pd.DataFrame:
    """Load explicit future PromotionEvent records for the SKU/DC."""
    sql = """
        SELECT
            pe."startDate" AS start_date,
            pe."endDate" AS end_date,
            pe."upliftFactor" AS uplift_factor
        FROM "PromotionEvent" pe
        LEFT JOIN "Product" p ON p.id = pe."productId"
        LEFT JOIN "Warehouse" w ON w.id = pe."warehouseId"
        WHERE (pe."productId" IS NULL OR p.sku = %s OR p.id = %s)
          AND (pe."warehouseId" IS NULL OR w.code = %s OR w.id = %s)
          AND pe."endDate" >= %s
          AND pe."startDate" <= %s
        ORDER BY pe."startDate"
    """
    return _query_df(sql, (sku, sku, warehouse_code, warehouse_code, start, end))


def load_product_metadata(sku: str, warehouse_code: str) -> dict:
    sql = """
        SELECT
            p.id AS product_id, p.sku, p.name, p.category, p.criticality,
            w.id AS warehouse_id, w.code AS warehouse_code, w.name AS warehouse_name
        FROM "Product" p
        CROSS JOIN "Warehouse" w
        WHERE (p.sku = %s OR p.id = %s)
          AND (w.code = %s OR w.id = %s)
        LIMIT 1
    """
    rows = _query_df(sql, (sku, sku, warehouse_code, warehouse_code))
    if rows.empty:
        raise ValueError(f"Unknown SKU/warehouse combination: {sku}/{warehouse_code}")
    return rows.iloc[0].to_dict()
