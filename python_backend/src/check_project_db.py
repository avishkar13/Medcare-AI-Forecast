"""Quick connectivity/schema check for the MedCare PostgreSQL database."""
from src.data_project import load_all_history

if __name__ == "__main__":
    df = load_all_history()
    print(f"Connected. DemandHistory rows: {len(df)}")
    print(f"SKUs: {df.sku_id.nunique()} | Warehouses: {df.dc_id.nunique()}")
    if not df.empty:
        print(f"Date range: {df.date.min()} -> {df.date.max()}")
