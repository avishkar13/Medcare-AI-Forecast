import { api } from "./client";
import type { QueryParams } from "./types";
import { z } from "zod";
import {
  distributorSchema,
  productSchema,
  promotionSchema,
  warehouseSchema,
} from "@/schemas/masterdata";

export type { Distributor, Product, Promotion, Warehouse } from "@/schemas/masterdata";

export interface MasterDataParams extends QueryParams {
  search?: string;
  category?: string;
  warehouse?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

// master data is mounted at the api root rather than under a prefix of its own
export const listProducts = async (params?: MasterDataParams) => {
  const page = await api.getPage<unknown>("/products", params);
  return { ...page, data: z.array(productSchema).parse(page.data) };
};

export const listWarehouses = async (params?: MasterDataParams) =>
  z.array(warehouseSchema).parse(await api.get<unknown>("/warehouses", params));

export const listDistributors = async (params?: MasterDataParams) =>
  z.array(distributorSchema).parse(await api.get<unknown>("/distributors", params));

export const listPromotions = async (params?: MasterDataParams) => {
  const page = await api.getPage<unknown>("/promotions", params);
  return { ...page, data: z.array(promotionSchema).parse(page.data) };
};
