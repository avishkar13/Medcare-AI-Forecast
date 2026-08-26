import { Router } from "express";
import * as masterDataController from "../controller/masterdatacontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

export const masterDataRouter = Router();

masterDataRouter.get("/products", rateLimiter.read, masterDataController.listProducts);
masterDataRouter.get("/products/:id", rateLimiter.read, masterDataController.getProduct);
masterDataRouter.get("/warehouses", rateLimiter.read, masterDataController.listWarehouses);
masterDataRouter.get("/warehouses/:id", rateLimiter.read, masterDataController.getWarehouse);
masterDataRouter.get("/distributors", rateLimiter.read, masterDataController.listDistributors);
masterDataRouter.get("/promotions", rateLimiter.read, masterDataController.listPromotions);
