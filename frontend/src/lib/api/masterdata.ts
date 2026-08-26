import { api } from "./client";

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  unitCost: number;
  shelfLifeDays: number;
  criticality: string;
  isActive: boolean;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  region: string;
  tier: string;
  location: string;
  capacity: number;
  isActive: boolean;
}

export interface Distributor {
  id: string;
  code: string;
  name: string;
  region: string;
  warehouseId: string | null;
  isActive: boolean;
}

export interface Promotion {
  id: string;
  name: string;
  productId: string;
  region: string | null;
  startDate: string;
  endDate: string;
  upliftPercent: number;
}

// master data is mounted at the api root rather than under a prefix of its own
export const listProducts = (params?: { pageSize?: number; page?: number }) =>
  api.getPage<Product[]>("/products", params);

export const listWarehouses = () => api.get<Warehouse[]>("/warehouses");

export const listDistributors = () => api.get<Distributor[]>("/distributors");

export const listPromotions = (params?: { pageSize?: number }) =>
  api.getPage<Promotion[]>("/promotions", params);
