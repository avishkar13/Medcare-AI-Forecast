import { api } from "./client";
import type { QueryParams } from "./types";
import { z } from "zod";
import {
  productSchema,
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
